import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiffModal?: () => void;
}

export const GitModal: React.FC<GitModalProps> = ({ isOpen, onClose, onOpenDiffModal }) => {
  const {
    activeRepo,
    gitStatus,
    gitLog,
    pendingChanges,
    refreshGitStatus,
    refreshGitLog,
    refreshPendingChanges,
    commitGit,
    syncGit,
    createOrSwitchBranch,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'branches'>('status');
  const [commitMsg, setCommitMsg] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expandable file diffs state
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [fileDiffs, setFileDiffs] = useState<Record<string, string>>({});
  const [loadingDiffs, setLoadingDiffs] = useState<Record<string, boolean>>({});

  const changedFiles = gitStatus?.files || [];
  const currentBranch = gitStatus?.branch || 'main';
  const isClean = gitStatus?.isClean ?? true;

  // Load status and pending changes when opened
  useEffect(() => {
    if (isOpen) {
      refreshGitStatus();
      refreshGitLog(20);
      refreshPendingChanges();
      setFeedback(null);
    }
  }, [isOpen, refreshGitStatus, refreshGitLog, refreshPendingChanges]);

  // Fetch diff on demand if not available in pendingChanges
  const fetchFileDiff = useCallback(async (filePath: string) => {
    if (fileDiffs[filePath]) return;
    setLoadingDiffs(prev => ({ ...prev, [filePath]: true }));
    try {
      const res = await API.getGitDiff(filePath);
      if (res.ok && res.data && res.data.diff) {
        setFileDiffs(prev => ({ ...prev, [filePath]: res.data.diff }));
      }
    } catch (err) {
      console.error(`[GitModal] Erro ao buscar diff de ${filePath}:`, err);
    } finally {
      setLoadingDiffs(prev => ({ ...prev, [filePath]: false }));
    }
  }, [fileDiffs]);

  // Toggle single file accordion
  const toggleFileExpand = (filePath: string) => {
    const nextState = !expandedFiles[filePath];
    setExpandedFiles(prev => ({ ...prev, [filePath]: nextState }));
    if (nextState) {
      fetchFileDiff(filePath);
    }
  };

  // Expand all / Collapse all
  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    changedFiles.forEach(f => {
      allExpanded[f.path] = true;
      fetchFileDiff(f.path);
    });
    setExpandedFiles(allExpanded);
  };

  const collapseAll = () => {
    setExpandedFiles({});
  };

  if (!isOpen) return null;

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;

    setIsCommitting(true);
    setFeedback(null);
    try {
      const res = await commitGit(commitMsg.trim());
      if (res.success) {
        setFeedback({ type: 'success', message: `Nova versão registrada com sucesso (${res.commitHash ? res.commitHash.slice(0, 7) : 'v-atual'})!` });
        setCommitMsg('');
        await refreshPendingChanges();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Falha ao registrar versão.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado ao registrar versão.' });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncGit();
      if (res.success) {
        setFeedback({ type: 'success', message: `Sincronização com a equipe concluída: ${res.message}` });
        await refreshPendingChanges();
      } else {
        setFeedback({ type: 'error', message: `Aviso de sincronização: ${res.message}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao sincronizar com o servidor remoto.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      const res = await createOrSwitchBranch(newBranchName.trim());
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setNewBranchName('');
        await refreshPendingChanges();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao alternar trilha de trabalho.' });
    }
  };

  // Helper to get diff text and stats for a given file
  const getFileDiffInfo = (filePath: string) => {
    const cleanPath = filePath.replace(/^\/+/, '');
    const wsChange = pendingChanges.find(
      c => c.path === filePath || c.path.replace(/^\/+/, '') === cleanPath
    );

    const diffText = wsChange?.diff_text || wsChange?.diff || fileDiffs[filePath] || '';

    let adds = wsChange?.additions;
    let dels = wsChange?.deletions;

    if (adds === undefined || dels === undefined) {
      if (diffText) {
        const lines = diffText.split('\n');
        adds = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        dels = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
      } else {
        adds = 0;
        dels = 0;
      }
    }

    return { diffText, additions: adds, deletions: dels, type: wsChange?.type };
  };

  const renderDiffViewer = (diffText: string, filePath: string) => {
    if (loadingDiffs[filePath]) {
      return (
        <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', background: '#0d1117', textAlign: 'center', borderRadius: '0 0 6px 6px' }}>
          <span className="material-symbols-outlined icon-xs" style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: '6px' }}>
            progress_activity
          </span>
          Carregando comparativo de mudanças...
        </div>
      );
    }

    if (!diffText || !diffText.trim()) {
      return (
        <div style={{ padding: '14px', color: '#8b949e', fontSize: '12px', fontStyle: 'italic', background: '#0d1117', borderRadius: '0 0 6px 6px' }}>
          Nenhuma alteração de texto detectada neste arquivo (ou arquivo binário).
        </div>
      );
    }

    const lines = diffText.split('\n');

    return (
      <pre
        style={{
          margin: 0,
          padding: '8px 0',
          fontSize: '12px',
          lineHeight: '1.5',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          background: '#0d1117',
          color: '#e6edf3',
          overflowX: 'auto',
          maxHeight: '320px',
          borderRadius: '0 0 6px 6px',
        }}
      >
        {lines.map((line, idx) => {
          let bg = 'transparent';
          let color = '#e6edf3';
          let fontWeight = 'normal';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            bg = 'rgba(46, 160, 67, 0.2)';
            color = '#3fb950';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            bg = 'rgba(248, 81, 73, 0.2)';
            color = '#f85149';
          } else if (line.startsWith('@@')) {
            bg = 'rgba(56, 139, 253, 0.15)';
            color = '#79c0ff';
            fontWeight = '600';
          } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
            color = '#8b949e';
            fontWeight = '600';
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                padding: '1px 12px',
                backgroundColor: bg,
                color: color,
                fontWeight: fontWeight,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '32px',
                  userSelect: 'none',
                  color: '#6e7681',
                  textAlign: 'right',
                  marginRight: '12px',
                  fontSize: '11px',
                }}
              >
                {idx + 1}
              </span>
              <span style={{ flex: 1 }}>{line || ' '}</span>
            </div>
          );
        })}
      </pre>
    );
  };

  const allAreExpanded = changedFiles.length > 0 && changedFiles.every(f => expandedFiles[f.path]);

  return (
    <div id="git-status-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box" style={{ maxWidth: '820px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary, #3b82f6)', fontSize: '24px' }}>
                history_edu
              </span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Central de Versões & Evolução</h3>
              <span className="badge badge-primary-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                Trilha: {currentBranch}
              </span>
            </div>
            <span className="subtitle" style={{ marginTop: '4px', display: 'block' }}>
              Repositório de Documentação: <code>{activeRepo?.name || 'local'}</code> {gitStatus?.remoteUrl ? `(${gitStatus.remoteUrl})` : '(Modo Local)'}
            </span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', padding: '0 20px', background: 'var(--bg-surface)' }}>
          <button
            type="button"
            className={`btn-tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'status' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'status' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined icon-xs">pending_actions</span>
            Rascunhos & Mudanças {changedFiles.length > 0 && `(${changedFiles.length})`}
          </button>
          <button
            type="button"
            className={`btn-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'history' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'history' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined icon-xs">history</span>
            Histórico de Versões ({gitLog.length})
          </button>
          <button
            type="button"
            className={`btn-tab ${activeTab === 'branches' ? 'active' : ''}`}
            onClick={() => setActiveTab('branches')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'branches' ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'branches' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span className="material-symbols-outlined icon-xs">alt_route</span>
            Trilhas de Trabalho
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              margin: '12px 20px 0 20px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: feedback.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {feedback.message}
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px', gap: '16px' }}>
          
          {/* TAB 1: STATUS, DIFFS & COMMIT */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Actions Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-secondary, #f8fafc)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`pill-dot ${isClean ? 'success' : 'warning'}`}>
                    <span className="dot"></span> {isClean ? 'Documentação 100% Sincronizada' : `${changedFiles.length} documento(s) com rascunhos pendentes`}
                  </span>
                  {gitStatus?.ahead ? (
                    <span className="badge badge-primary-subtle">{gitStatus.ahead} marco(s) não sincronizados</span>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { refreshGitStatus(); refreshGitLog(); refreshPendingChanges(); }}
                    title="Atualizar status e comparativo"
                  >
                    <span className="material-symbols-outlined icon-xs">refresh</span>
                    Atualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    title="Sincronizar com a equipe (baixar novidades e enviar contribuições)"
                  >
                    <span className="material-symbols-outlined icon-xs">sync</span>
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar com a Nuvem'}
                  </button>
                </div>
              </div>

              {/* Changed Files List with Dropdown Accordion Diffs */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    Documentos em Edição &bull; Comparativo de Mudanças
                  </span>
                  {changedFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={allAreExpanded ? collapseAll : expandAll}
                        style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span className="material-symbols-outlined icon-xs">
                          {allAreExpanded ? 'unfold_less' : 'unfold_more'}
                        </span>
                        {allAreExpanded ? 'Recolher Todos' : 'Expandir Todos'}
                      </button>
                    </div>
                  )}
                </div>

                {changedFiles.length === 0 ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <span className="material-symbols-outlined icon-md" style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                      check_circle
                    </span>
                    Nenhuma alteração pendente. Todos os documentos estão consolidados e sincronizados.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {changedFiles.map(file => {
                      const isExpanded = !!expandedFiles[file.path];
                      const { diffText, additions, deletions } = getFileDiffInfo(file.path);

                      return (
                        <div
                          key={file.path}
                          style={{
                            borderBottom: '1px solid var(--border-color-subtle, #f1f5f9)',
                            background: isExpanded ? 'var(--bg-surface)' : 'transparent'
                          }}
                        >
                          {/* File Accordion Header / Dropdown Toggle */}
                          <div
                            onClick={() => toggleFileExpand(file.path)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              background: isExpanded ? 'var(--bg-surface-secondary, #f8fafc)' : 'transparent',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              if (!isExpanded) e.currentTarget.style.background = 'var(--bg-hover, #f1f5f9)';
                            }}
                            onMouseLeave={e => {
                              if (!isExpanded) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {/* Left side: Icon, Path and Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: '18px',
                                  color: isExpanded ? 'var(--primary, #3b82f6)' : 'var(--text-dim)',
                                  transition: 'transform 0.2s ease',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                }}
                              >
                                chevron_right
                              </span>

                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: '16px',
                                  color:
                                    file.status === 'M' ? '#d97706' :
                                    file.status === 'A' || file.status === '??' ? '#16a34a' :
                                    file.status === 'D' ? '#dc2626' : 'var(--text-muted)'
                                }}
                              >
                                {file.status === 'D' ? 'delete' : file.status === 'A' || file.status === '??' ? 'note_add' : 'edit_document'}
                              </span>

                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '12.5px',
                                  fontWeight: isExpanded ? 600 : 500,
                                  color: 'var(--text-heading, #1e293b)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={file.path}
                              >
                                {file.path}
                              </span>

                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  background:
                                    file.status === 'M' ? '#fef3c7' :
                                    file.status === 'A' || file.status === '??' ? '#dcfce7' :
                                    file.status === 'D' ? '#fee2e2' : '#e0e7ff',
                                  color:
                                    file.status === 'M' ? '#b45309' :
                                    file.status === 'A' || file.status === '??' ? '#15803d' :
                                    file.status === 'D' ? '#b91c1c' : '#4338ca'
                                }}
                              >
                                {file.status === '??' ? 'NOVO' : file.status === 'M' ? 'ALTERADO' : file.status === 'A' ? 'ADICIONADO' : file.status === 'D' ? 'REMOVIDO' : file.status}
                              </span>
                            </div>

                            {/* Right side: Additions/Deletions and Dropdown state */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              {(additions > 0 || deletions > 0) && (
                                <div style={{ display: 'flex', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                                  {additions > 0 && (
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>+{additions}</span>
                                  )}
                                  {deletions > 0 && (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>-{deletions}</span>
                                  )}
                                </div>
                              )}

                              <span
                                className="badge badge-neutral"
                                style={{
                                  fontSize: '10.5px',
                                  padding: '2px 6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                {isExpanded ? 'Ocultar mudanças' : 'Ver mudanças'}
                              </span>
                            </div>
                          </div>

                          {/* Expandable Diff Panel (Drop Down) */}
                          {isExpanded && (
                            <div
                              style={{
                                borderTop: '1px solid var(--border-color)',
                                animation: 'fadeIn 0.2s ease-in-out'
                              }}
                            >
                              {renderDiffViewer(diffText, file.path)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Protection & PR Flow vs Branch Versioning */}
              {currentBranch === 'main' ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface-secondary, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary, #3b82f6)', fontSize: '20px' }}>
                      lock
                    </span>
                    <strong style={{ fontSize: '13.5px' }}>Trilha Oficial (<code>main</code>) Protegida por Governança</strong>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Para garantir a qualidade, integridade e revisão por pares, alterações diretas na trilha oficial não são publicadas sem validação. Suas contribuições são submetidas como uma <strong>Proposta de Revisão e Aprovação</strong>.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onClose();
                        if (onOpenDiffModal) onOpenDiffModal();
                      }}
                      disabled={isClean}
                    >
                      <span className="material-symbols-outlined icon-xs">rate_review</span>
                      Propor Revisão & Aprovação Oficial
                    </button>
                  </div>
                </div>
              ) : (
                /* Versioning Form for working branches */
                <form onSubmit={handleCommit} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>
                    Registrar Marco de Versão na Trilha <code>{currentBranch}</code>
                  </h4>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Descreva a evolução realizada (ex: Atualização das políticas e requisitos)..."
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      disabled={isCommitting || isClean}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isCommitting || isClean || !commitMsg.trim()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span
                        className="material-symbols-outlined icon-xs"
                        style={isCommitting ? { animation: 'spin 1s linear infinite' } : {}}
                      >
                        {isCommitting ? 'progress_activity' : 'bookmark_add'}
                      </span>
                      {isCommitting ? 'Registrando versão...' : 'Salvar Nova Versão'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: HISTORY (TIMELINE OF VERSIONS) */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gitLog.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma versão anterior registrada no histórico.
                </div>
              ) : (
                gitLog.map((commit, idx) => (
                  <div
                    key={commit.hash || idx}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
                          #{commit.shortHash || commit.hash.slice(0, 7)}
                        </span>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-heading)' }}>{commit.message}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Contribuído por <strong>{commit.author}</strong> em {commit.date}
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-dim)', fontSize: '18px' }}>
                      history_edu
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: TRILHAS DE TRABALHO */}
          {activeTab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Create Branch Form */}
              <form onSubmit={handleCreateBranch} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Criar ou Alternar Trilha de Trabalho</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: revisao-politicas ou especificacao-v2"
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!newBranchName.trim()}>
                    Alternar / Criar Trilha
                  </button>
                </div>
              </form>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Trilha Ativa</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>done</span>
                  <code style={{ fontSize: '14px', fontWeight: 700 }}>{currentBranch}</code>
                  <span className="badge badge-primary-subtle">Em Edição</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

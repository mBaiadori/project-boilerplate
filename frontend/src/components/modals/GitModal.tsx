import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDiffModal?: () => void;
}

type TabType = 'status' | 'whats-new' | 'history' | 'branches';
type WhatsNewFilterType = 'all' | 'new' | 'modified' | 'proposals';

export const GitModal: React.FC<GitModalProps> = ({ isOpen, onClose, onOpenDiffModal: _onOpenDiffModal }) => {
  const {
    activeRepo,
    gitStatus,
    gitLog = [],
    pendingChanges = [],
    whatsNewSummary,
    hasUnreadWhatsNew,
    refreshGitStatus,
    refreshGitLog,
    refreshPendingChanges,
    refreshWhatsNew,
    markWhatsNewAsSeen,
    commitGit,
    syncGit,
    createOrSwitchBranch,
    loadFile,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [whatsNewFilter, setWhatsNewFilter] = useState<WhatsNewFilterType>('all');
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
  const isClean = gitStatus?.isClean ?? (changedFiles.length === 0);

  // Load status and pending changes when opened
  useEffect(() => {
    if (isOpen) {
      if (refreshGitStatus) refreshGitStatus();
      if (refreshGitLog) refreshGitLog(25);
      if (refreshPendingChanges) refreshPendingChanges();
      if (refreshWhatsNew) refreshWhatsNew();
      setFeedback(null);
      if (hasUnreadWhatsNew && isClean) {
        setActiveTab('whats-new');
      }
    }
  }, [isOpen, hasUnreadWhatsNew, isClean, refreshGitStatus, refreshGitLog, refreshPendingChanges, refreshWhatsNew]);

  // Fetch diff on demand if not available in pendingChanges
  const fetchFileDiff = useCallback(async (filePath: string) => {
    if (!filePath || fileDiffs[filePath]) return;
    setLoadingDiffs(prev => ({ ...prev, [filePath]: true }));
    try {
      const res = await API.getGitDiff(filePath);
      if (res?.ok && res?.data?.diff) {
        setFileDiffs(prev => ({ ...prev, [filePath]: res.data.diff }));
      }
    } catch (err) {
      console.error(`[GitModal] Erro ao buscar comparativo de ${filePath}:`, err);
    } finally {
      setLoadingDiffs(prev => ({ ...prev, [filePath]: false }));
    }
  }, [fileDiffs]);

  // Toggle single file accordion
  const toggleFileExpand = (filePath: string) => {
    if (!filePath) return;
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
      if (f?.path) {
        allExpanded[f.path] = true;
        fetchFileDiff(f.path);
      }
    });
    setExpandedFiles(allExpanded);
  };

  const collapseAll = () => {
    setExpandedFiles({});
  };

  const handleOpenFile = async (filePath: string) => {
    if (!filePath) return;
    try {
      if (loadFile) await loadFile(filePath);
      onClose();
    } catch (err) {
      console.error('[GitModal] Erro ao abrir documento:', err);
    }
  };

  const handleMarkAsSeen = () => {
    if (markWhatsNewAsSeen) markWhatsNewAsSeen();
    setFeedback({
      type: 'success',
      message: 'Todas as novidades da equipe foram marcadas como visualizadas!'
    });
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;

    setIsCommitting(true);
    setFeedback(null);
    try {
      const res = await commitGit(commitMsg.trim());
      if (res?.success) {
        setFeedback({ type: 'success', message: `Novo marco oficial registrado com sucesso (${res.commitHash ? res.commitHash.slice(0, 7) : 'versão atual'})!` });
        setCommitMsg('');
        if (refreshPendingChanges) await refreshPendingChanges();
      } else {
        setFeedback({ type: 'error', message: res?.message || 'Falha ao registrar novo marco de versão.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado ao registrar marco de versão.' });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncGit();
      if (res?.success) {
        setFeedback({ type: 'success', message: `Sincronização com a equipe concluída: ${res.message || 'Atualizado'}` });
        if (refreshPendingChanges) await refreshPendingChanges();
        if (refreshWhatsNew) await refreshWhatsNew();
        if (hasUnreadWhatsNew) {
          setActiveTab('whats-new');
        }
      } else {
        setFeedback({ type: 'error', message: `Aviso de sincronização: ${res?.message || 'Falha ao sincronizar'}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao sincronizar com o servidor da equipe.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      const res = await createOrSwitchBranch(newBranchName.trim());
      if (res?.success) {
        setFeedback({ type: 'success', message: res.message });
        setNewBranchName('');
        if (refreshPendingChanges) await refreshPendingChanges();
      } else {
        setFeedback({ type: 'error', message: res?.message || 'Erro ao alternar trilha' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao alternar trilha de trabalho.' });
    }
  };

  // Helper to get diff text and stats for a given file
  const getFileDiffInfo = (filePath: string) => {
    if (!filePath) return { diffText: '', additions: 0, deletions: 0 };
    const cleanPath = filePath.replace(/^\/+/, '');
    const wsChange = (pendingChanges || []).find(
      c => c?.path === filePath || c?.path?.replace(/^\/+/, '') === cleanPath
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

  const allAreExpanded = changedFiles.length > 0 && changedFiles.every(f => expandedFiles[f?.path]);

  // Whats New computed list with safety fallbacks
  const whatsNewFiles = whatsNewSummary?.files || [];
  const whatsNewProposals = whatsNewSummary?.proposals || [];
  const whatsNewCommits = whatsNewSummary?.commits || [];

  const newFilesCount = whatsNewFiles.filter(f => f?.status === 'A').length;
  const modFilesCount = whatsNewFiles.filter(f => f?.status === 'M').length;

  const filteredWhatsNewFiles = useMemo(() => {
    if (whatsNewFilter === 'new') return whatsNewFiles.filter(f => f?.status === 'A');
    if (whatsNewFilter === 'modified') return whatsNewFiles.filter(f => f?.status === 'M');
    if (whatsNewFilter === 'proposals') return [];
    return whatsNewFiles;
  }, [whatsNewFiles, whatsNewFilter]);

  if (!isOpen) return null;

  return (
    <div id="git-status-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box" style={{ maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary, #3b82f6)', fontSize: '26px' }}>
                history_edu
              </span>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: 'var(--text-heading)' }}>
                Central de Versões & Evolução
              </h3>
              <span className="badge badge-primary-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>layers</span>
                Trilha: {currentBranch}
              </span>
            </div>
            <span className="subtitle" style={{ marginTop: '5px', display: 'block', color: 'var(--text-muted)', fontSize: '12.5px' }}>
              Documentação: <strong>{activeRepo?.name || 'Local'}</strong> {gitStatus?.remoteUrl ? `(${gitStatus.remoteUrl})` : '(Armazenamento Local)'}
            </span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            background: 'var(--bg-surface-secondary, rgba(255,255,255,0.03))',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
          }}
        >
          {/* Tab 1: Meus Rascunhos */}
          <button
            type="button"
            className={`btn-tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '8px',
              border: activeTab === 'status' ? '1px solid var(--primary, #3b82f6)' : '1px solid transparent',
              background: activeTab === 'status' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: activeTab === 'status' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              edit_note
            </span>
            <span>Meus Rascunhos</span>
            {changedFiles.length > 0 && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: activeTab === 'status' ? 'var(--primary, #3b82f6)' : 'rgba(234, 179, 8, 0.2)',
                  color: activeTab === 'status' ? '#ffffff' : '#eab308',
                }}
              >
                {changedFiles.length}
              </span>
            )}
          </button>

          {/* Tab 2: Novidades da Equipe (What's New) */}
          <button
            type="button"
            className={`btn-tab ${activeTab === 'whats-new' ? 'active' : ''}`}
            onClick={() => setActiveTab('whats-new')}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '8px',
              border: activeTab === 'whats-new' ? '1px solid #22c55e' : '1px solid transparent',
              background: activeTab === 'whats-new' ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
              color: activeTab === 'whats-new' ? '#16a34a' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#22c55e' }}>
              auto_awesome
            </span>
            <span>Novidades da Equipe</span>
            {whatsNewFiles.length > 0 && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: activeTab === 'whats-new' ? '#16a34a' : 'rgba(34, 197, 94, 0.2)',
                  color: activeTab === 'whats-new' ? '#ffffff' : '#16a34a',
                }}
              >
                {whatsNewFiles.length}
              </span>
            )}
            {hasUnreadWhatsNew && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                }}
                title="Novidades não visualizadas!"
              />
            )}
          </button>

          {/* Tab 3: Histórico de Publicações */}
          <button
            type="button"
            className={`btn-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '8px',
              border: activeTab === 'history' ? '1px solid var(--primary, #3b82f6)' : '1px solid transparent',
              background: activeTab === 'history' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: activeTab === 'history' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              history
            </span>
            <span>Histórico de Publicações</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>({(gitLog || []).length})</span>
          </button>

          {/* Tab 4: Trilhas de Trabalho */}
          <button
            type="button"
            className={`btn-tab ${activeTab === 'branches' ? 'active' : ''}`}
            onClick={() => setActiveTab('branches')}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '8px',
              border: activeTab === 'branches' ? '1px solid var(--primary, #3b82f6)' : '1px solid transparent',
              background: activeTab === 'branches' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: activeTab === 'branches' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              layers
            </span>
            <span>Trilhas de Trabalho</span>
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
              background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span className="material-symbols-outlined icon-xs">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {feedback.message}
          </div>
        )}

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px', gap: '16px' }}>
          
          {/* TAB 1: MEUS RASCUNHOS & MODIFICAÇÕES LOCAIS */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Actions Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-secondary, #f8fafc)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`pill-dot ${isClean ? 'success' : 'warning'}`}>
                    <span className="dot"></span> {isClean ? 'Documentação consolidada e sincronizada' : `${changedFiles.length} documento(s) com rascunhos pendentes`}
                  </span>
                  {gitStatus?.ahead ? (
                    <span className="badge badge-primary-subtle">{gitStatus.ahead} marco(s) pendentes de envio</span>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (refreshGitStatus) refreshGitStatus();
                      if (refreshGitLog) refreshGitLog();
                      if (refreshPendingChanges) refreshPendingChanges();
                      if (refreshWhatsNew) refreshWhatsNew();
                    }}
                    title="Atualizar status e comparativo"
                  >
                    <span className="material-symbols-outlined icon-xs">sync</span>
                    Atualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    title="Sincronizar com a equipe (baixar novidades e enviar contribuições)"
                  >
                    <span className="material-symbols-outlined icon-xs">cloud_sync</span>
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar com a Equipe'}
                  </button>
                </div>
              </div>

              {/* Changed Files List with Accordions */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    Documentos em Edição Local &bull; Comparativo de Mudanças
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
                    Nenhum rascunho pendente no momento. Todos os seus documentos estão consolidados.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {changedFiles.map((file, idx) => {
                      if (!file?.path) return null;
                      const isExpanded = !!expandedFiles[file.path];
                      const { diffText, additions, deletions } = getFileDiffInfo(file.path);

                      return (
                        <div
                          key={file.path || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color-subtle, #f1f5f9)',
                            background: isExpanded ? 'var(--bg-surface)' : 'transparent'
                          }}
                        >
                          {/* File Accordion Header */}
                          <div
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
                          >
                            {/* Left side: Icon, Path and Status */}
                            <div
                              onClick={() => toggleFileExpand(file.path)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingRight: '12px' }}
                            >
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
                                  fontSize: '18px',
                                  color:
                                    file.status === 'M' ? '#d97706' :
                                    file.status === 'A' || file.status === '??' ? '#16a34a' :
                                    file.status === 'D' ? '#dc2626' : 'var(--text-muted)'
                                }}
                              >
                                {file.status === 'D' ? 'delete_outline' : file.status === 'A' || file.status === '??' ? 'note_add' : 'description'}
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

                            {/* Right side: Additions/Deletions and Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {(additions > 0 || deletions > 0) && (
                                <div style={{ display: 'flex', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', marginRight: '6px' }}>
                                  {additions > 0 && (
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>+{additions}</span>
                                  )}
                                  {deletions > 0 && (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>-{deletions}</span>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFile(file.path);
                                }}
                                title="Abrir este documento no editor"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                Abrir Documento
                              </button>

                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => toggleFileExpand(file.path)}
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                {isExpanded ? 'Ocultar mudanças' : 'Ver mudanças'}
                              </button>
                            </div>
                          </div>

                          {/* Accordion Diff View */}
                          {isExpanded && renderDiffViewer(diffText, file.path)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Versioning & Save actions */}
              <form onSubmit={handleCommit} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>bookmark_add</span>
                  Salvar Marco de Versão Oficial na Trilha <code>{currentBranch}</code>
                </h4>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Descreva as atualizações realizadas (ex: Atualização das políticas e regras de negócio)..."
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
                      {isCommitting ? 'progress_activity' : 'check'}
                    </span>
                    {isCommitting ? 'Salvando marco...' : 'Salvar Versão Oficial'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: NOVIDADES DA EQUIPE (WHAT'S NEW) */}
          {activeTab === 'whats-new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header Banner with summary and Mark As Read Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface-secondary, #f8fafc)',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#16a34a'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      auto_awesome
                    </span>
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      Novidades da Equipe nesta Trilha
                    </h4>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                      {whatsNewSummary?.summaryMessage || 'Nenhuma atualização recente da equipe.'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    title="Buscar e baixar as últimas novidades da equipe"
                  >
                    <span className="material-symbols-outlined icon-xs">cloud_sync</span>
                    {isSyncing ? 'Buscando...' : 'Buscar Novidades'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={handleMarkAsSeen}
                    title="Marcar todas as novidades como vistas"
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span className="material-symbols-outlined icon-xs">done_all</span>
                    Marcar como visto
                  </button>
                </div>
              </div>

              {/* Filter Chips Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
                  Filtrar por:
                </span>
                
                <button
                  type="button"
                  onClick={() => setWhatsNewFilter('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: whatsNewFilter === 'all' ? '1px solid var(--primary, #3b82f6)' : '1px solid var(--border-color)',
                    background: whatsNewFilter === 'all' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    color: whatsNewFilter === 'all' ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Todos ({whatsNewFiles.length})
                </button>

                <button
                  type="button"
                  onClick={() => setWhatsNewFilter('new')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: whatsNewFilter === 'new' ? '1px solid #22c55e' : '1px solid var(--border-color)',
                    background: whatsNewFilter === 'new' ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                    color: whatsNewFilter === 'new' ? '#16a34a' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ✨ Novos Documentos ({newFilesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setWhatsNewFilter('modified')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: whatsNewFilter === 'modified' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                    background: whatsNewFilter === 'modified' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    color: whatsNewFilter === 'modified' ? '#d97706' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📝 Documentos Alterados ({modFilesCount})
                </button>

                {whatsNewProposals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWhatsNewFilter('proposals')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: whatsNewFilter === 'proposals' ? '1px solid #8b5cf6' : '1px solid var(--border-color)',
                      background: whatsNewFilter === 'proposals' ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                      color: whatsNewFilter === 'proposals' ? '#7c3aed' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🔀 Propostas Integradas ({whatsNewProposals.length})
                  </button>
                )}
              </div>

              {/* Integrated Proposals Section */}
              {(whatsNewFilter === 'all' || whatsNewFilter === 'proposals') && whatsNewProposals.length > 0 && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(139, 92, 246, 0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#8b5cf6' }}>
                      verified
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-heading)' }}>
                      Propostas de Especificação Aprovadas e Integradas
                    </strong>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {whatsNewProposals.map((pr, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--bg-surface-secondary, #f8fafc)',
                          border: '1px solid var(--border-color-subtle, #f1f5f9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                            Proposta #{pr.id}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {pr.title}
                          </span>
                        </div>
                        {pr.author && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Autor: <strong>{pr.author}</strong>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files List in What's New */}
              {whatsNewFilter !== 'proposals' && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-surface-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>
                      Documentos Recebidos da Equipe ({filteredWhatsNewFiles.length})
                    </span>
                  </div>

                  {filteredWhatsNewFiles.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <span className="material-symbols-outlined icon-md" style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                        check_circle
                      </span>
                      Nenhum documento com este filtro nesta atualização.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filteredWhatsNewFiles.map((file, idx) => {
                        if (!file?.path) return null;
                        const isExpanded = !!expandedFiles[file.path];
                        const { diffText } = getFileDiffInfo(file.path);

                        return (
                          <div
                            key={file.path || idx}
                            style={{
                              borderBottom: '1px solid var(--border-color-subtle, #f1f5f9)',
                              background: isExpanded ? 'var(--bg-surface)' : 'transparent'
                            }}
                          >
                            <div
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
                            >
                              {/* Left side: Icon, Path and Status */}
                              <div
                                onClick={() => toggleFileExpand(file.path)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingRight: '12px' }}
                              >
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
                                    fontSize: '18px',
                                    color:
                                      file.status === 'M' ? '#d97706' :
                                      file.status === 'A' ? '#16a34a' :
                                      file.status === 'D' ? '#dc2626' : 'var(--text-muted)'
                                  }}
                                >
                                  {file.status === 'D' ? 'delete_outline' : file.status === 'A' ? 'note_add' : 'description'}
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
                                      file.status === 'A' ? '#dcfce7' :
                                      file.status === 'D' ? '#fee2e2' : '#e0e7ff',
                                    color:
                                      file.status === 'M' ? '#b45309' :
                                      file.status === 'A' ? '#15803d' :
                                      file.status === 'D' ? '#b91c1c' : '#4338ca'
                                  }}
                                >
                                  {file.statusLabel || (file.status === 'A' ? 'Novo Documento' : file.status === 'D' ? 'Documento Removido' : 'Documento Atualizado')}
                                </span>
                              </div>

                              {/* Right side: Additions/Deletions and Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {(file.additions > 0 || file.deletions > 0) && (
                                  <div style={{ display: 'flex', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', marginRight: '6px' }}>
                                    {file.additions > 0 && (
                                      <span style={{ color: '#16a34a', fontWeight: 600 }}>+{file.additions}</span>
                                    )}
                                    {file.deletions > 0 && (
                                      <span style={{ color: '#dc2626', fontWeight: 600 }}>-{file.deletions}</span>
                                    )}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFile(file.path);
                                  }}
                                  title="Abrir este documento no editor"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                  Abrir Documento
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => toggleFileExpand(file.path)}
                                  style={{ fontSize: '11px', padding: '3px 8px' }}
                                >
                                  {isExpanded ? 'Ocultar mudanças' : 'Ver mudanças'}
                                </button>
                              </div>
                            </div>

                            {/* Accordion Diff View */}
                            {isExpanded && renderDiffViewer(diffText, file.path)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Commits List Received */}
              {whatsNewCommits.length > 0 && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', background: 'var(--bg-surface)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
                      history
                    </span>
                    Publicações e Marcos Trazidos pela Atualização ({whatsNewCommits.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {whatsNewCommits.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'var(--bg-surface-secondary, #f8fafc)',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                            #{item?.shortHash || item?.hash?.slice(0, 7) || 'v-atual'}
                          </span>
                          <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>
                            {item?.message || 'Atualização de documentação'}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                          {item?.author || 'Equipe'} &bull; {item?.date || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTÓRICO DE PUBLICAÇÕES */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(gitLog || []).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum marco de publicação registrado no histórico desta trilha.
                </div>
              ) : (
                (gitLog || []).map((commit, idx) => (
                  <div
                    key={commit?.hash || idx}
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
                          #{commit?.shortHash || commit?.hash?.slice(0, 7) || 'marco'}
                        </span>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-heading)' }}>{commit?.message || 'Publicação'}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Publicado por <strong>{commit?.author || 'Equipe'}</strong> em {commit?.date || ''}
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

          {/* TAB 4: TRILHAS DE TRABALHO */}
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

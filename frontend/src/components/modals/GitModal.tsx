import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitModal: React.FC<GitModalProps> = ({ isOpen, onClose }) => {
  const {
    activeRepo,
    gitStatus,
    gitLog,
    refreshGitStatus,
    refreshGitLog,
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

  useEffect(() => {
    if (isOpen) {
      refreshGitStatus();
      refreshGitLog(20);
      setFeedback(null);
    }
  }, [isOpen, refreshGitStatus, refreshGitLog]);

  if (!isOpen) return null;

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;

    setIsCommitting(true);
    setFeedback(null);
    try {
      const res = await commitGit(commitMsg.trim());
      if (res.success) {
        setFeedback({ type: 'success', message: `Commit realizado com sucesso (${res.commitHash || 'HEAD'})!` });
        setCommitMsg('');
      } else {
        setFeedback({ type: 'error', message: res.message || 'Falha ao realizar commit.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado ao commitar.' });
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
        setFeedback({ type: 'success', message: `Sincronização concluída: ${res.message}` });
      } else {
        setFeedback({ type: 'error', message: `Aviso de sincronização: ${res.message}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao sincronizar com remote.' });
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
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao criar branch.' });
    }
  };

  const changedFiles = gitStatus?.files || [];
  const currentBranch = gitStatus?.branch || 'main';
  const isClean = gitStatus?.isClean ?? true;

  return (
    <div id="git-status-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box" style={{ maxWidth: '780px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary, #3b82f6)', fontSize: '24px' }}>
                alt_route
              </span>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Painel de Controle Git</h3>
              <span className="badge badge-primary-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {currentBranch}
              </span>
            </div>
            <span className="subtitle" style={{ marginTop: '4px', display: 'block' }}>
              Repositório local: <code>{activeRepo?.name || 'local'}</code> {gitStatus?.remoteUrl ? `(${gitStatus.remoteUrl})` : '(Modo Local)'}
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
            Status & Commit {changedFiles.length > 0 && `(${changedFiles.length})`}
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
            Histórico ({gitLog.length})
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
            <span className="material-symbols-outlined icon-xs">fork_right</span>
            Branches
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
          
          {/* TAB 1: STATUS & COMMIT */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Actions Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-secondary, #f8fafc)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`pill-dot ${isClean ? 'success' : 'warning'}`}>
                    <span className="dot"></span> {isClean ? 'Árvore de trabalho limpa' : `${changedFiles.length} arquivo(s) modificado(s)`}
                  </span>
                  {gitStatus?.ahead ? (
                    <span className="badge badge-primary-subtle">{gitStatus.ahead} commit(s) à frente</span>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { refreshGitStatus(); refreshGitLog(); }}
                    title="Atualizar status"
                  >
                    <span className="material-symbols-outlined icon-xs">refresh</span>
                    Atualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    title="Sincronizar (Pull & Push com Remote)"
                  >
                    <span className="material-symbols-outlined icon-xs">sync</span>
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Remote'}
                  </button>
                </div>
              </div>

              {/* Changed Files List */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '13px' }}>
                  Arquivos no Working Tree
                </div>
                {changedFiles.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhuma alteração pendente de commit.
                  </div>
                ) : (
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {changedFiles.map(file => (
                      <div
                        key={file.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          borderBottom: '1px solid var(--border-color-subtle, #f1f5f9)',
                          fontSize: '12.5px',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        <span style={{ color: 'var(--text-normal)' }}>{file.path}</span>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
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
                          {file.status === '??' ? 'UNTRACKED' : file.status === 'M' ? 'MODIFIED' : file.status === 'A' ? 'ADDED' : file.status === 'D' ? 'DELETED' : file.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Commit Form */}
              <form onSubmit={handleCommit} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Criar Commit Local</h4>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="feat: descreva a alteração realizada..."
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
                  >
                    <span className="material-symbols-outlined icon-xs">check</span>
                    {isCommitting ? 'Commitando...' : 'Fazer Commit (git commit)'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: HISTORY (GIT LOG) */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gitLog.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum commit encontrado no histórico.
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
                          {commit.shortHash || commit.hash.slice(0, 7)}
                        </span>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-heading)' }}>{commit.message}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Por <strong>{commit.author}</strong> em {commit.date}
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-dim)', fontSize: '18px' }}>
                      commit
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: BRANCHES */}
          {activeTab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Create Branch Form */}
              <form onSubmit={handleCreateBranch} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Criar ou Trocar de Branch</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: feature/nova-especificacao ou gov/regras"
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!newBranchName.trim()}>
                    Trocar / Criar
                  </button>
                </div>
              </form>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-surface)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Branch Atual</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>done</span>
                  <code style={{ fontSize: '14px', fontWeight: 700 }}>{currentBranch}</code>
                  <span className="badge badge-primary-subtle">Ativa</span>
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

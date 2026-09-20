import React, { useState, useEffect, useCallback } from 'react';
import type { PR } from '../../types';
import { API } from '../../services/api';

interface PRsSubViewProps {
  onOpenDiffModal: () => void;
}

export const PRsSubView: React.FC<PRsSubViewProps> = ({ onOpenDiffModal }) => {
  const [prs, setPrs] = useState<PR[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<'all' | 'open' | 'merged' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPRs, setExpandedPRs] = useState<Record<number | string, boolean>>({});
  const [actionFeedback, setActionFeedback] = useState<{ id: number; message: string; type: 'success' | 'error' } | null>(null);

  const loadPRs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getPRs();
      if (res && Array.isArray(res.prs)) {
        setPrs(res.prs);
      }
    } catch (err) {
      console.error('[PRsSubView] Erro ao carregar PRs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPRs();
  }, [loadPRs]);

  const toggleExpand = (id: number | string) => {
    setExpandedPRs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await API.approvePR(id);
      if (res.ok) {
        setActionFeedback({ id, message: res.data?.message || 'Aprovação registrada com sucesso!', type: 'success' });
        await loadPRs();
      } else {
        setActionFeedback({ id, message: res.data?.error || 'Erro ao aprovar PR.', type: 'error' });
      }
    } catch (err: any) {
      setActionFeedback({ id, message: err.message || 'Erro ao aprovar PR.', type: 'error' });
    }
  };

  const handleMerge = async (id: number) => {
    try {
      const res = await API.mergePR(id);
      if (res.ok) {
        setActionFeedback({ id, message: res.data?.message || 'PR mesclado na main com sucesso!', type: 'success' });
        await loadPRs();
      } else {
        setActionFeedback({ id, message: res.data?.error || 'Erro ao fazer merge.', type: 'error' });
      }
    } catch (err: any) {
      setActionFeedback({ id, message: err.message || 'Erro ao fazer merge.', type: 'error' });
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt('Informe o motivo da rejeição do Pull Request (opcional):');
    if (reason === null) return; // cancelou

    try {
      const res = await API.rejectPR(id, reason || 'Rejeitado pelo revisor');
      if (res.ok) {
        setActionFeedback({ id, message: 'Pull Request rejeitado e fechado.', type: 'success' });
        await loadPRs();
      } else {
        setActionFeedback({ id, message: res.data?.error || 'Erro ao rejeitar PR.', type: 'error' });
      }
    } catch (err: any) {
      setActionFeedback({ id, message: err.message || 'Erro ao rejeitar PR.', type: 'error' });
    }
  };

  const countAll = prs.length;
  const countOpen = prs.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s === 'open' || s === 'in_review';
  }).length;
  const countMerged = prs.filter(p => (p.status || '').toLowerCase() === 'merged').length;
  const countClosed = prs.filter(p => (p.status || '').toLowerCase() === 'closed').length;

  const filteredPRs = prs.filter(pr => {
    const statusLower = (pr.status || '').toLowerCase();
    const matchesStatus =
      activeStatus === 'all' ||
      (activeStatus === 'open' && (statusLower === 'open' || statusLower === 'in_review')) ||
      (activeStatus === 'merged' && statusLower === 'merged') ||
      (activeStatus === 'closed' && statusLower === 'closed');

    const matchesSearch =
      pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pr.author && pr.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pr.branch && pr.branch.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(pr.id).includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  return (
    <div id="subview-prs" className="dash-subview" style={{ display: 'block', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="prs-view-wrapper">
        <div className="template-store-header">
          <div className="templates-header" style={{ marginBottom: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--primary, #3b82f6)' }}>
                  call_split
                </span>
                <h2 style={{ margin: 0 }}>Central Colaborativa de Pull Requests</h2>
              </div>
              <p className="subtitle" style={{ marginTop: '4px' }}>
                Ambiente de revisão por pares: inspecione alterações propostas, aprove com quórum ou realize o merge na branch <code>main</code> protegida.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="btn-refresh-prs"
                className="btn btn-secondary btn-sm"
                title="Recarregar PRs do repositório"
                type="button"
                onClick={loadPRs}
              >
                <span className="material-symbols-outlined icon-xs">refresh</span>
                Atualizar
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={onOpenDiffModal}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Propor Novo PR
              </button>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
            <div className="store-filter-bar" id="prs-status-filters">
              <button
                className={`store-filter-chip ${activeStatus === 'all' ? 'active' : ''}`}
                data-status="all"
                type="button"
                onClick={() => setActiveStatus('all')}
              >
                Todos (<span id="count-prs-all">{countAll}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === 'open' ? 'active' : ''}`}
                data-status="open"
                type="button"
                onClick={() => setActiveStatus('open')}
              >
                Abertos / Em Revisão (<span id="count-prs-open">{countOpen}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === 'merged' ? 'active' : ''}`}
                data-status="merged"
                type="button"
                onClick={() => setActiveStatus('merged')}
              >
                Merged (<span id="count-prs-merged">{countMerged}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === 'closed' ? 'active' : ''}`}
                data-status="closed"
                type="button"
                onClick={() => setActiveStatus('closed')}
              >
                Fechados / Rejeitados (<span id="count-prs-closed">{countClosed}</span>)
              </button>
            </div>

            <div className="store-search-box">
              <input
                type="text"
                id="prs-search-input"
                placeholder="Buscar por título, autor, branch ou #ID..."
                spellCheck="false"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* PRs List Grid */}
        <div id="prs-full-list" className="prs-full-grid" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isLoading ? (
            <div className="loading-state">Carregando PRs...</div>
          ) : filteredPRs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'var(--bg-surface)' }}>
              <span className="material-symbols-outlined icon-lg" style={{ color: 'var(--text-dim)', marginBottom: '8px' }}>
                inbox
              </span>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Nenhum Pull Request encontrado</div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Faça alterações no editor e clique em "Propor Novo PR" para abrir uma proposta.</p>
            </div>
          ) : (
            filteredPRs.map(pr => {
              const statusLower = (pr.status || '').toLowerCase();
              const isMerged = statusLower === 'merged';
              const isClosed = statusLower === 'closed';
              const isOpen = !isMerged && !isClosed;
              const isExpanded = !!expandedPRs[pr.id];
              const approvals = Array.isArray(pr.approvals) ? pr.approvals : [];
              const prFiles = Array.isArray((pr as any).files) ? (pr as any).files : [];

              return (
                <div
                  key={pr.id}
                  className="pr-card"
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
                  }}
                >
                  {/* Top Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: isMerged ? 'var(--primary, #3b82f6)' : isClosed ? 'var(--danger, #ef4444)' : 'var(--success, #16a34a)',
                          fontSize: '22px'
                        }}
                      >
                        {isMerged ? 'merge' : isClosed ? 'cancel' : 'call_split'}
                      </span>
                      <div>
                        <strong style={{ fontSize: '15px', color: 'var(--text-heading)' }}>
                          #{pr.id} {pr.title}
                        </strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Criado por <strong>{pr.author}</strong> em {pr.created_at} &bull; Branch: <code>{pr.branch}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`pill-dot ${isMerged ? 'info' : isClosed ? 'danger' : 'success'}`}>
                        <span className="dot"></span> {pr.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* PR Description */}
                  {pr.description && (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-normal)', lineHeight: '1.5', background: 'var(--bg-surface-secondary, #f8fafc)', padding: '10px 12px', borderRadius: '6px' }}>
                      {pr.description}
                    </p>
                  )}

                  {/* Approvals & Reviewers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Revisão & Aprovações:</span>
                    {approvals.length === 0 ? (
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>Aguardando revisores</span>
                    ) : (
                      approvals.map((app, idx) => (
                        <span key={idx} className="badge badge-success" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>
                          {app}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Feedback Message */}
                  {actionFeedback && actionFeedback.id === pr.id && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        background: actionFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        color: actionFeedback.type === 'success' ? '#166534' : '#991b1b',
                        border: `1px solid ${actionFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                      }}
                    >
                      {actionFeedback.message}
                    </div>
                  )}

                  {/* Files & Diffs Toggle */}
                  {prFiles.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleExpand(pr.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                      >
                        <span className="material-symbols-outlined icon-xs">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                        {isExpanded ? 'Ocultar alterações dos arquivos' : `Ver ${prFiles.length} arquivo(s) modificado(s)`}
                      </button>

                      {isExpanded && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {prFiles.map((f: any, fIdx: number) => (
                            <div
                              key={fIdx}
                              style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                fontSize: '12px'
                              }}
                            >
                              <div
                                style={{
                                  padding: '6px 10px',
                                  background: 'var(--bg-surface-secondary, #f8fafc)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontFamily: 'var(--font-mono)'
                                }}
                              >
                                <span>{f.path}</span>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                                  <span style={{ color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>+{f.additions || 0}</span>
                                  <span style={{ color: 'var(--color-error, #dc2626)', fontWeight: 600 }}>-{f.deletions || 0}</span>
                                </div>
                              </div>
                              {f.diff_text && (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: '8px 10px',
                                    fontSize: '11.5px',
                                    background: 'var(--bg-surface-lowest, #1e293b)',
                                    color: '#f8fafc',
                                    overflowX: 'auto',
                                    fontFamily: 'var(--font-mono)'
                                  }}
                                >
                                  {f.diff_text}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      {(pr as any).html_url ? (
                        <a
                          href={(pr as any).html_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '12px', color: 'var(--primary, #3b82f6)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Ver no GitHub <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Modo de Governança Local</span>
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => handleReject(pr.id)}
                          style={{ color: 'var(--danger, #ef4444)' }}
                          title="Rejeitar e fechar este Pull Request"
                        >
                          <span className="material-symbols-outlined icon-xs">close</span>
                          Rejeitar
                        </button>
                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => handleApprove(pr.id)}
                          title="Aprovar proposta como revisor"
                        >
                          <span className="material-symbols-outlined icon-xs">thumb_up</span>
                          Aprovar PR {approvals.length > 0 ? `(${approvals.length})` : ''}
                        </button>
                        <button
                          className="btn btn-primary btn-xs"
                          type="button"
                          onClick={() => handleMerge(pr.id)}
                          title="Fazer merge na branch main"
                        >
                          <span className="material-symbols-outlined icon-xs">merge</span>
                          Fazer Merge na Main
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

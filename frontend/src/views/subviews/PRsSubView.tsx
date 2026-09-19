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

  const handleApprove = async (id: number) => {
    try {
      await API.approvePR(id);
      await loadPRs();
    } catch (err) {
      console.error('[PRsSubView] Erro ao aprovar PR:', err);
    }
  };

  const handleMerge = async (id: number) => {
    try {
      await API.mergePR(id);
      await loadPRs();
    } catch (err) {
      console.error('[PRsSubView] Erro ao fazer merge:', err);
    }
  };

  const countAll = prs.length;
  const countOpen = prs.filter(p => p.status === 'OPEN' || p.status === 'open').length;
  const countMerged = prs.filter(p => p.status === 'MERGED' || p.status === 'merged').length;
  const countClosed = prs.filter(p => p.status === 'CLOSED' || p.status === 'closed').length;

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
              <h2>Central de Pull Requests & Visão Histórica</h2>
              <p className="subtitle">
                Audite o ciclo de vida completo de propostas, aprovações de reviewers e histórico de merges na branch <code>main</code>.
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
                Abertos (<span id="count-prs-open">{countOpen}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === 'merged' ? 'active' : ''}`}
                data-status="merged"
                type="button"
                onClick={() => setActiveStatus('merged')}
              >
                Merged / Histórico (<span id="count-prs-merged">{countMerged}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === 'closed' ? 'active' : ''}`}
                data-status="closed"
                type="button"
                onClick={() => setActiveStatus('closed')}
              >
                Fechados (<span id="count-prs-closed">{countClosed}</span>)
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

        <div id="prs-full-list" className="prs-full-grid" style={{ marginTop: '16px' }}>
          {isLoading ? (
            <div className="loading-state">Carregando PRs...</div>
          ) : filteredPRs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum Pull Request encontrado.
            </div>
          ) : (
            filteredPRs.map(pr => {
              const statusLower = (pr.status || '').toLowerCase();
              const isMerged = statusLower === 'merged';
              const isClosed = statusLower === 'closed';
              const approvalsCount = pr.approvals?.length || 0;

              return (
                <div key={pr.id} className="pr-card" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-card, #fff)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="material-symbols-outlined" style={{ color: isMerged ? 'var(--primary)' : isClosed ? 'var(--danger, #ef4444)' : 'var(--success, #16a34a)', fontSize: '20px' }}>
                        {isMerged ? 'merge' : isClosed ? 'cancel' : 'call_split'}
                      </span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-heading)' }}>
                        #{pr.id} {pr.title}
                      </strong>
                    </div>

                    <span className={`pill-dot ${isMerged ? 'info' : isClosed ? 'danger' : 'success'}`}>
                      <span className="dot"></span> {pr.status.toUpperCase()}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {pr.description || 'Proposta de atualização de documentação e arquitetura.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                    <div>
                      Por <strong>@{pr.author}</strong> em {pr.created_at} &bull; Branch: <code>{pr.branch}</code>
                    </div>

                    {!isMerged && !isClosed && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => handleApprove(pr.id)}
                        >
                          Aprovar PR {approvalsCount > 0 ? `(${approvalsCount})` : ''}
                        </button>
                        <button
                          className="btn btn-primary btn-xs"
                          type="button"
                          onClick={() => handleMerge(pr.id)}
                        >
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

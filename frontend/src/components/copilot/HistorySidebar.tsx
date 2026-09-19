import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  repo: string;
  docPath: string;
  onRestoreSession?: (session: any) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  repo,
  docPath
}) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, repo, docPath]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const [histRes, briefRes] = await Promise.all([
        API.getMemoryHistory({ repo, path: docPath }),
        API.getMemoryBrief({ repo, path: docPath })
      ]);

      if (histRes.ok && histRes.data) {
        setSessions(histRes.data.sessions || []);
      }
      if (briefRes.ok && briefRes.data) {
        setBriefing(briefRes.data.briefing || '');
      }
    } catch (err) {
      console.error('[HistorySidebar] Erro ao carregar histórico:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const res = await API.getMemorySession({ repo, session_id: sessionId });
      if (res.ok && res.data?.session) {
        setSelectedSession(res.data.session);
      }
    } catch (e) {
      console.warn('Erro ao carregar detalhes da sessão:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="ai-copilot-prompt-sidebar ai-copilot-history-sidebar" style={{ display: 'flex' }}>
      <div className="ai-prompt-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
            history
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-heading, #0f172a)', whiteSpace: 'nowrap' }}>
              Linha de Raciocínio & Sessões
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Context OS &bull; <span className="ai-copilot-history-path-tag">{docPath}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-icon ai-copilot-refresh-history-btn"
            type="button"
            title="Recarregar sessões"
            onClick={loadHistory}
          >
            <span className="material-symbols-outlined icon-xs">refresh</span>
          </button>
          <button
            className="btn-icon ai-copilot-close-history-sidebar-btn"
            type="button"
            title="Fechar painel de histórico"
            onClick={onClose}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <div className="ai-history-sidebar-body" style={{ padding: '14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selectedSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <button
                className="btn btn-ghost btn-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                onClick={() => setSelectedSession(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span> Voltar à Lista
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {selectedSession.session_id ? selectedSession.session_id.slice(-14) : ''}
              </span>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '10px 12px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-heading)', display: 'block', marginBottom: '4px' }}>
                {selectedSession.author?.name || 'Developer'}
              </strong>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                🤖 {selectedSession.frontmatter?.agent_model || 'IA'}
              </span>
            </div>

            {selectedSession.handoff && (
              <div style={{ background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                <strong style={{ fontSize: '11.5px', color: 'var(--primary, #2563eb)', display: 'block', marginBottom: '6px' }}>
                  Handoff Consolidado
                </strong>
                <div style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-body)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  {selectedSession.handoff.replace(/^---[\s\S]*?---\n*/, '').trim()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active Handoff Card */}
            {briefing && (
              <div style={{ padding: '10px 12px', background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--primary, #2563eb)' }}>psychology</span>
                    <strong style={{ fontSize: '12px', color: 'var(--primary, #2563eb)' }}>Handoff Consolidado Ativo</strong>
                  </div>
                  <span className="ai-copilot-status-badge custom" style={{ fontSize: '9px', padding: '1px 6px' }}>MEMÓRIA GIT</span>
                </div>
                <div style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-body)', maxHeight: '130px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)', marginTop: '6px' }}>
                  {briefing}
                </div>
              </div>
            )}

            {/* Sessions List */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Carregando sessões...
              </div>
            ) : sessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-heading)' }}>Sessões Gravadas (.spec-memory/):</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{sessions.length} arquivada{sessions.length > 1 ? 's' : ''}</span>
                </div>
                {sessions.map((s, idx) => (
                  <div
                    key={idx}
                    className="ai-history-session-card"
                    style={{
                      padding: '10px 12px',
                      background: '#ffffff',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => handleSelectSession(s.session_id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--text-heading)' }}>
                        {s.author?.name || 'Developer'}
                      </strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      💬 {s.metrics?.rounds || 1} rounds &bull; 🏷️ {s.metrics?.total_tokens || 0} tokens
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-history-empty-state" style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--bg-surface, #ffffff)', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: '12px', margin: '4px 0' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #2563eb)' }}>
                  <span className="material-symbols-outlined icon-md">forum</span>
                </div>
                <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-heading, #0f172a)', marginBottom: '6px' }}>Nenhum histórico arquivado ainda</strong>
                <p style={{ margin: '0 0 14px 0', fontSize: '11.5px', lineHeight: 1.5, color: 'var(--text-muted, #64748b)' }}>
                  As mensagens, decisões de arquitetura e handoffs deste documento serão gravados e versionados automaticamente aqui.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '6px', color: 'var(--text-muted, #64748b)' }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: '#10b981' }}>check_circle</span> Memória Git Ativa (.spec-memory/)
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

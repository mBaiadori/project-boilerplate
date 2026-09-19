import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  repo: string;
  docPath: string;
  onRestoreSession: (session: any) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  repo,
  docPath,
  onRestoreSession
}) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

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
        setBriefing(briefRes.data.briefing || 'Nenhum briefing compilado ainda.');
      }
    } catch (err) {
      console.error('[HistorySidebar] Erro ao carregar histórico:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="copilot-nested-sidebar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--color-surface)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
            history
          </span>
          <strong style={{ fontSize: '14px' }}>Memória Contínua & Handoffs</strong>
        </div>
        <button className="btn-close" onClick={onClose}>
          <span className="material-symbols-outlined icon-sm">close</span>
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-outline)' }}>
          Carregando memória...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Briefing Box */}
          <div style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: '8px', padding: '12px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              🧠 Briefing Consolidado de Contexto
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--color-on-surface)' }}>
              {briefing}
            </p>
          </div>

          {/* Past Sessions List */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', display: 'block', marginBottom: '8px' }}>
              Sessões Anteriores ({sessions.length})
            </span>

            {sessions.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--color-outline)', textAlign: 'center', padding: '16px' }}>
                Nenhuma sessão anterior gravada neste documento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sessions.map((sess, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12px' }}>Sessão #{idx + 1}</strong>
                      <span style={{ fontSize: '10px', color: 'var(--color-outline)' }}>
                        {sess.timestamp || sess.created_at || 'Recente'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                      {sess.summary || sess.handoff || `${sess.messages_count || 0} mensagens trocadas`}
                    </p>
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ alignSelf: 'flex-end', fontSize: '11px', marginTop: '4px' }}
                      onClick={() => {
                        onRestoreSession(sess);
                        onClose();
                      }}
                    >
                      Restaurar Sessão →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

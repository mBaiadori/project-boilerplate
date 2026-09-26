import React, { useState, useEffect } from 'react';
import { API } from '../../services/api';
import { useAI } from '../../context/AIContext';

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
  const { restoreSession, currentSessionId, resetMemory } = useAI();
  const [sessions, setSessions] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
      } else if (res.ok && res.data?.events) {
        setSelectedSession(res.data);
      }
    } catch (e) {
      console.warn('Erro ao carregar detalhes da sessão:', e);
    }
  };

  const handleRestoreToChat = async (sessionId: string) => {
    const success = await restoreSession(sessionId);
    if (success) {
      setFeedback('Conversa restaurada no Copilot! ✨');
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1200);
    } else {
      setFeedback('Erro ao restaurar sessão.');
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Deseja excluir esta sessão do histórico?')) return;
    try {
      const res = await API.deleteMemorySession({ repo, session_id: sessionId });
      if (res.ok) {
        if (selectedSession?.session_id === sessionId) {
          setSelectedSession(null);
        }
        await loadHistory();
      }
    } catch (err) {
      console.error('Erro ao excluir sessão:', err);
    }
  };

  const handleConsolidateMemory = async () => {
    setIsConsolidating(true);
    try {
      const res = await API.finalizeMemorySession({
        repo,
        path: docPath,
        session_id: currentSessionId,
      });
      if (res.ok && res.data?.briefing) {
        setBriefing(res.data.briefing);
        setFeedback('Memória consolidada com sucesso no Git! 🧠');
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (err) {
      console.error('Erro ao consolidar memória:', err);
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleResetMemory = async () => {
    if (!confirm('Tem certeza que deseja limpar a memória consolidada (.spec-memory/)?')) return;
    await resetMemory('repo');
    setBriefing('');
    setSessions([]);
    setSelectedSession(null);
    setFeedback('Memória reiniciada.');
    setTimeout(() => setFeedback(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside className="ai-copilot-prompt-sidebar ai-copilot-history-sidebar" style={{ display: 'flex', width: '360px', flexDirection: 'column' }}>
      <div className="ai-prompt-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
            history
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-heading, #0f172a)', whiteSpace: 'nowrap' }}>
              Histórico & AI Memory
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Context OS &bull; <span className="ai-copilot-history-path-tag">{docPath || 'Global'}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-icon ai-copilot-refresh-history-btn"
            type="button"
            title="Recarregar histórico"
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

      {feedback && (
        <div style={{ padding: '8px 12px', background: '#dcfce7', color: '#15803d', fontSize: '11.5px', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #bbf7d0' }}>
          {feedback}
        </div>
      )}

      <div className="ai-history-sidebar-body" style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selectedSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <button
                className="btn btn-ghost btn-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                onClick={() => setSelectedSession(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_back</span> Voltar
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-primary btn-xs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                  onClick={() => handleRestoreToChat(selectedSession.session_id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>restore</span> Restaurar Chat
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ color: '#ef4444', padding: '2px 6px' }}
                  title="Excluir sessão"
                  onClick={() => handleDeleteSession(selectedSession.session_id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                </button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-heading)' }}>
                  {selectedSession.author?.name || 'Developer'}
                </strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  {selectedSession.created_at ? new Date(selectedSession.created_at).toLocaleString('pt-BR') : ''}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                🤖 {selectedSession.model || 'IA Assistant'} &bull; 📄 {selectedSession.path || 'Global'}
              </div>
            </div>

            {/* Session Messages Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              {selectedSession.events && selectedSession.events.length > 0 ? (
                selectedSession.events.map((ev: any, i: number) => {
                  const isUser = ev.role === 'user';
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: isUser ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${isUser ? '#bfdbfe' : '#e2e8f0'}`,
                        fontSize: '11px',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '10px', color: isUser ? '#1d4ed8' : '#475569', marginBottom: '2px' }}>
                        {isUser ? '👤 Você' : '🤖 Agent'} {ev.timestamp ? `(${new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                      </strong>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{ev.text}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Nenhuma mensagem registrada nesta sessão.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* AI Memory & Handoff Card */}
            <div style={{ padding: '10px 12px', background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--primary, #2563eb)' }}>psychology</span>
                  <strong style={{ fontSize: '12px', color: 'var(--primary, #2563eb)' }}>Memória Consolidada (Handoff)</strong>
                </div>
                <span className="ai-copilot-status-badge custom" style={{ fontSize: '9px', padding: '1px 6px' }}>.spec-memory</span>
              </div>
              
              <div style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-body)', maxHeight: '110px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)', marginTop: '4px' }}>
                {briefing ? briefing : 'Nenhum handoff gerado ainda. Clique em "Consolidar Memória" abaixo para arquivar o raciocínio da sessão atual.'}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ flex: 1, fontSize: '10.5px', padding: '3px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  disabled={isConsolidating}
                  onClick={handleConsolidateMemory}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>save_as</span>
                  {isConsolidating ? 'Consolidando...' : 'Consolidar Memória'}
                </button>
                {briefing && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '10.5px', color: '#ef4444' }}
                    onClick={handleResetMemory}
                    title="Limpar memória"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sessions List */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Carregando sessões...
              </div>
            ) : sessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-heading)' }}>Sessões Arquivadas ({sessions.length}):</span>
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
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                    onClick={() => handleSelectSession(s.session_id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--text-heading)' }}>
                        {s.author?.name || 'Developer'}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {s.updated_at ? new Date(s.updated_at).toLocaleDateString('pt-BR') : ''}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.session_id, e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                          title="Excluir sessão"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                        </button>
                      </div>
                    </div>
                    {s.preview && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.3 }}>
                        "{s.preview}"
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>📄 {s.path || 'Global'}</span>
                      <span>💬 {s.event_count || s.metrics?.rounds || 1} msg</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-history-empty-state" style={{ textAlign: 'center', padding: '30px 16px', background: 'var(--bg-surface, #ffffff)', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: '12px' }}>
                <div style={{ width: '40px', height: '40px', margin: '0 auto 10px auto', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #2563eb)' }}>
                  <span className="material-symbols-outlined icon-md">forum</span>
                </div>
                <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-heading, #0f172a)', marginBottom: '4px' }}>Nenhum histórico arquivado ainda</strong>
                <p style={{ margin: '0 0 10px 0', fontSize: '11px', lineHeight: 1.4, color: 'var(--text-muted, #64748b)' }}>
                  Suas mensagens e decisões de arquitetura serão salvas e versionadas no histórico automaticamente.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', padding: '3px 8px', background: '#f1f5f9', borderRadius: '6px', color: 'var(--text-muted, #64748b)' }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: '#10b981' }}>check_circle</span> Memória Git Ativa
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

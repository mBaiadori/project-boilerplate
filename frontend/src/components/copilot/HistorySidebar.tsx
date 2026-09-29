import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../../services/api';
import { useAI } from '../../context/AIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCopilotStore } from '../../stores/copilotStore';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  repo: string;
  docPath: string;
  onRestoreSession?: (session: any) => void;
}

function formatRelativeTime(dateStr?: string | number): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 45) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  
  const isToday = now.toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje às ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) return `Ontem às ${timeStr}`;

  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${timeStr}`;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  repo,
  docPath,
}) => {
  const { restoreSession, currentSessionId, newChatSession, resetMemory } = useAI();
  const { projectConfig } = useWorkspace();
  const historyVersion = useCopilotStore((s) => s.historyVersion);
  const [sessions, setSessions] = useState<any[]>([]);
  const [briefing, setBriefing] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isHandoffExpanded, setIsHandoffExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, repo, docPath, historyVersion]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const [histRes, briefRes] = await Promise.all([
        API.getMemoryHistory({ repo, path: docPath }),
        API.getMemoryBrief({ repo, path: docPath }),
      ]);

      if (histRes.ok && histRes.data) {
        const rawSessions: any[] = Array.isArray(histRes.data.sessions) ? histRes.data.sessions : [];
        
        // Ordenação infalível: mais recente sempre primeiro
        rawSessions.sort((a, b) => {
          const timeA = a.timestamp || new Date(a.updated_at || a.created_at || 0).getTime() || 0;
          const timeB = b.timestamp || new Date(b.updated_at || b.created_at || 0).getTime() || 0;
          return timeB - timeA;
        });

        setSessions(rawSessions);
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

  const handleRestoreToChat = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await restoreSession(sessionId);
    if (success) {
      setFeedback('Conversa restaurada no Copilot! ✨');
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1000);
    } else {
      setFeedback('Erro ao restaurar sessão.');
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  const handleNewChat = () => {
    newChatSession();
    setFeedback('Nova conversa iniciada! 🚀');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 700);
  };

  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Deseja excluir esta conversa do histórico?')) return;
    try {
      const res = await API.deleteMemorySession({ repo, session_id: sessionId });
      if (res.ok) {
        if (selectedSession?.session_id === sessionId) {
          setSelectedSession(null);
        }
        await loadHistory();
        setFeedback('Conversa excluída.');
        setTimeout(() => setFeedback(null), 1500);
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
        setFeedback('Memória consolidada no Git! 🧠');
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (err) {
      console.error('Erro ao consolidar memória:', err);
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleResetMemory = async () => {
    if (!window.confirm('Tem certeza que deseja limpar a memória consolidada (.spec-memory/)?')) return;
    await resetMemory('repo');
    setBriefing('');
    setSessions([]);
    setSelectedSession(null);
    setFeedback('Memória reiniciada.');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  // Filtragem dinâmica por termo de busca
  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const term = searchTerm.toLowerCase();
    return sessions.filter((s) => {
      const preview = (s.preview || '').toLowerCase();
      const path = (s.path || '').toLowerCase();
      const model = (s.model || '').toLowerCase();
      const author = (s.author?.name || '').toLowerCase();
      return preview.includes(term) || path.includes(term) || model.includes(term) || author.includes(term);
    });
  }, [sessions, searchTerm]);

  // Taxonomia de cor primária do projeto
  const projectColor = projectConfig?.primary_color || 'var(--primary, #2563eb)';

  if (!isOpen) return null;

  return (
    <aside
      className="ai-copilot-prompt-sidebar ai-copilot-history-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* 1. Header do Painel */}
      <div className="ai-prompt-sidebar-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: `${projectColor}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: projectColor,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              history
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '12.5px', color: 'var(--text-heading, #0f172a)', whiteSpace: 'nowrap' }}>
              Histórico de Conversas
            </strong>
            <span
              style={{
                fontSize: '10.5px',
                color: 'var(--text-muted, #64748b)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {docPath || 'Global'} &bull; {sessions.length} {sessions.length === 1 ? 'salva' : 'salvas'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            title="Iniciar novo chat limpo"
            onClick={handleNewChat}
            style={{
              fontSize: '11px',
              padding: '3px 7px',
              color: 'var(--primary, #2563eb)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              add_comment
            </span>
            Novo
          </button>
          <button
            className="btn-icon ai-copilot-refresh-history-btn"
            type="button"
            title="Recarregar histórico"
            onClick={loadHistory}
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <span className="material-symbols-outlined icon-xs">refresh</span>
          </button>
          <button
            className="btn-icon ai-copilot-close-history-sidebar-btn"
            type="button"
            title="Fechar painel de histórico"
            onClick={onClose}
            style={{ width: '28px', height: '28px', padding: 0 }}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      {/* 2. Feedback Toast Bar */}
      {feedback && (
        <div
          style={{
            padding: '7px 12px',
            background: '#dcfce7',
            color: '#15803d',
            fontSize: '11px',
            fontWeight: 600,
            textAlign: 'center',
            borderBottom: '1px solid #bbf7d0',
            flexShrink: 0,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedback}
        </div>
      )}

      {/* 3. Corpo com Scroll Vertical Ilimitado */}
      <div
        className="ai-history-sidebar-body"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '12px',
          boxSizing: 'border-box',
        }}
      >
        {selectedSession ? (
          /* ================= VISUALIZAÇÃO DETALHADA DA SESSÃO ================= */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px' }}>
            {/* Header com Ações de Restauração */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                paddingBottom: '8px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
                onClick={() => setSelectedSession(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  arrow_back
                </span>
                Voltar à lista
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 9px' }}
                  onClick={() => handleRestoreToChat(selectedSession.session_id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    restore
                  </span>
                  Restaurar no Chat
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ color: '#ef4444', padding: '4px 6px' }}
                  title="Excluir sessão"
                  onClick={() => handleDeleteSession(selectedSession.session_id)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    delete
                  </span>
                </button>
              </div>
            </div>

            {/* Metadados da Sessão */}
            <div
              style={{
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '9px 12px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-heading, #0f172a)' }}>
                  {selectedSession.author?.name || 'Developer'}
                </strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748b)' }}>
                  {formatRelativeTime(selectedSession.updated_at || selectedSession.created_at)}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10.5px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                  🤖 {selectedSession.model || 'AI Assistant'}
                </span>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                  📄 {selectedSession.path || 'Global'}
                </span>
                {selectedSession.metrics?.total_tokens ? (
                  <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                    ⚡ {selectedSession.metrics.total_tokens} tokens
                  </span>
                ) : null}
              </div>
            </div>

            {/* Stream de Mensagens da Sessão (Scroll Livre sem maxHeight rígido) */}
            <div
              className="ai-history-messages-stream"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '2px',
              }}
            >
              {selectedSession.events && selectedSession.events.length > 0 ? (
                selectedSession.events.map((ev: any, i: number) => {
                  const isUser = ev.role === 'user';
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        padding: '9px 11px',
                        borderRadius: '9px',
                        background: isUser ? '#f0f7ff' : '#f8fafc',
                        border: `1px solid ${isUser ? '#bfdbfe' : '#e2e8f0'}`,
                        fontSize: '11.5px',
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong
                          style={{
                            fontSize: '10.5px',
                            color: isUser ? '#1d4ed8' : '#475569',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                            {isUser ? 'person' : 'smart_toy'}
                          </span>
                          {isUser ? 'Você' : (selectedSession.model || 'Assistente')}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)' }}>
                            {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(ev.text || ev.content || '', i)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              color: copiedIndex === i ? '#10b981' : '#94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Copiar mensagem"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                              {copiedIndex === i ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', wordBreak: 'break-word' }}>
                        {ev.text || ev.content}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Nenhuma mensagem registrada nesta sessão.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= LISTA GERAL DE SESSÕES COM SCROLL ================= */
          <>
            {/* 1. Card de Memória Consolidada (Handoff) */}
            <div
              style={{
                padding: '9px 12px',
                background: 'rgba(37, 99, 235, 0.03)',
                border: '1px solid rgba(37, 99, 235, 0.16)',
                borderRadius: '9px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => setIsHandoffExpanded(!isHandoffExpanded)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--primary, #2563eb)' }}>
                    psychology
                  </span>
                  <strong style={{ fontSize: '11.5px', color: 'var(--primary, #2563eb)' }}>
                    Memória Consolidada
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ai-copilot-status-badge custom" style={{ fontSize: '9px', padding: '1px 5px' }}>
                    .spec-memory
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                    {isHandoffExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>

              {isHandoffExpanded && (
                <div style={{ marginTop: '8px', animation: 'fadeIn 0.15s ease' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      lineHeight: '1.4',
                      color: 'var(--text-body)',
                      maxHeight: '110px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      background: '#fff',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color, #e2e8f0)',
                    }}
                  >
                    {briefing || 'Nenhum handoff gerado ainda. Clique em "Consolidar" para salvar a síntese desta sessão.'}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '7px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      style={{
                        flex: 1,
                        fontSize: '10.5px',
                        padding: '3px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                      disabled={isConsolidating}
                      onClick={handleConsolidateMemory}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        save_as
                      </span>
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
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          delete_sweep
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Barra de Busca e Filtro de Conversas */}
            {sessions.length > 0 && (
              <div className="ai-history-search-wrapper" style={{ flexShrink: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: 'absolute',
                    left: '9px',
                    fontSize: '16px',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  className="ai-history-search-input"
                  placeholder={`Buscar em ${sessions.length} conversas...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#94a3b8',
                    }}
                    title="Limpar busca"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      cancel
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* 3. Lista de Conversas com Scroll Natural Ilimitado */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px', animation: 'spin 1s infinite linear', color: 'var(--primary, #2563eb)', display: 'block', margin: '0 auto 8px auto' }}>
                  sync
                </span>
                Carregando histórico de conversas...
              </div>
            ) : filteredSessions.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-heading)' }}>
                    {searchTerm ? `Resultados (${filteredSessions.length} de ${sessions.length})` : `Conversas Recentes (${sessions.length})`}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Mais recente primeiro
                  </span>
                </div>

                {filteredSessions.map((s, idx) => {
                  const isActive = s.session_id === currentSessionId;
                  const formattedTime = formatRelativeTime(s.timestamp || s.updated_at || s.created_at);

                  return (
                    <div
                      key={s.session_id || idx}
                      className={`ai-history-session-card ${isActive ? 'is-active-session' : ''}`}
                      onClick={() => handleSelectSession(s.session_id)}
                    >
                      {/* Topo do Card: Autor, Badge Ativa e Data */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                          <strong
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-heading, #0f172a)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '140px',
                            }}
                          >
                            {s.author?.name || 'Developer'}
                          </strong>
                          {isActive && (
                            <span
                              style={{
                                fontSize: '9.5px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                fontWeight: 600,
                              }}
                            >
                              Ativa
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }} title={s.updated_at ? new Date(s.updated_at).toLocaleString('pt-BR') : ''}>
                            {formattedTime}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(s.session_id, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              color: '#94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Excluir sessão"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              close
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Preview da Mensagem */}
                      {s.preview && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#334155',
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          "{s.preview}"
                        </p>
                      )}

                      {/* Rodapé do Card: Metadados e Botão de Ação Rápida */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10px',
                          color: 'var(--text-muted, #64748b)',
                          marginTop: '2px',
                          paddingTop: '4px',
                          borderTop: '1px dashed #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '120px',
                            }}
                          >
                            📄 {s.path || 'Global'}
                          </span>
                          <span>💬 {s.event_count || s.metrics?.rounds || 1} msg</span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={(e) => handleRestoreToChat(s.session_id, e)}
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            height: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: 'var(--primary, #2563eb)',
                            fontWeight: 600,
                          }}
                          title="Restaurar esta conversa no Copilot"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                            restore
                          </span>
                          Restaurar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Estado Vazio */
              <div
                className="ai-history-empty-state"
                style={{
                  textAlign: 'center',
                  padding: '30px 16px',
                  background: 'var(--bg-surface, #ffffff)',
                  border: '1px dashed var(--border-color, #cbd5e1)',
                  borderRadius: '12px',
                  margin: 'auto 0',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    margin: '0 auto 10px auto',
                    borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary, #2563eb)',
                  }}
                >
                  <span className="material-symbols-outlined icon-md">
                    {searchTerm ? 'search_off' : 'forum'}
                  </span>
                </div>
                <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-heading, #0f172a)', marginBottom: '4px' }}>
                  {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhum histórico arquivado ainda'}
                </strong>
                <p style={{ margin: '0 0 12px 0', fontSize: '11px', lineHeight: 1.4, color: 'var(--text-muted, #64748b)' }}>
                  {searchTerm
                    ? `Nenhum resultado corresponde ao termo "${searchTerm}".`
                    : 'Todas as suas mensagens no Copilot são gravadas e versionadas automaticamente no Git.'}
                </p>
                {searchTerm ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setSearchTerm('')}
                    style={{ fontSize: '11px' }}
                  >
                    Limpar Filtro
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={handleNewChat}
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                      add
                    </span>
                    Iniciar Nova Conversa
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

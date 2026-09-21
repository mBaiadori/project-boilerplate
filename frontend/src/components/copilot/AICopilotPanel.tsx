// =============================================================================
// COMPONENT: UNIVERSAL AI CHAT COPILOT WITH CONTINUOUS CONTEXT MEMORY
// Enhanced with Full-Width Auto-Expanding Input Box, Modern User Bubble & Target Tool
// =============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { useAI } from '../../context/AIContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface AICopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrompt?: () => void;
  onOpenHistory?: () => void;
  onOpenRaw?: () => void;
  onApplyContent?: (content: string) => void;
  onInsertAtCursor?: (text: string) => void;
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  isOpen,
  onClose,
  onOpenPrompt = () => {},
  onOpenHistory = () => {},
  onOpenRaw = () => {},
  onApplyContent,
  onInsertAtCursor
}) => {
  const { messages, isThinking, sendMessage, dynamicContext } = useAI();
  const { activeFile, setFileContent } = useWorkspace();
  const [inputText, setInputText] = useState('');
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [inspectorFlash, setInspectorFlash] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Adjust textarea height dynamically up to 50% of the chat height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = Math.max(160, Math.floor(window.innerHeight * 0.45));
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 44), maxHeight);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [inputText]);

  // --- DOM Element & Section Picker (Dev / Target Mode Inspector) ---
  const markInspectableBlocks = useCallback(() => {
    const containers = document.querySelectorAll(
      'main, .dash-views-container, .dash-subview, #workbench-content, #editor-container, .notion-editor-surface, .wiki-article, .dictionary-view, .doc-editor-container'
    );

    const selector =
      'h1, h2, h3, h4, h5, h6, table, pre, code, blockquote, p, .notion-block, .dash-card, .spec-card, .card, .dict-term-card, .dict-term-row, article section, li';

    containers.forEach((container) => {
      if (
        container.closest('#global-ai-pane') ||
        container.closest('.workbench-ai-pane') ||
        container.closest('.ai-copilot-prompt-sidebar')
      ) {
        return;
      }

      const elements = container.querySelectorAll(selector);
      elements.forEach((el) => {
        if (
          el.closest('#global-ai-pane') ||
          el.closest('.workbench-ai-pane') ||
          el.closest('.ai-copilot-prompt-sidebar') ||
          el.closest('.pane-resizer') ||
          el.closest('#ai-settings-modal') ||
          el.closest('nav') ||
          el.closest('.sidebar') ||
          el.closest('.dash-header') ||
          el.closest('#top-header')
        ) {
          return;
        }

        if (
          el.tagName === 'P' &&
          (el.closest('blockquote') || el.closest('table') || el.closest('.notion-block') || el.closest('.dict-term-card'))
        ) {
          return;
        }

        const text = el.textContent?.trim();
        if (!text || text.length < 2) return;

        const tag = el.tagName.toUpperCase();
        let tagLabel = 'Bloco';
        if (tag.startsWith('H')) tagLabel = 'Título';
        else if (tag === 'TABLE') tagLabel = 'Tabela';
        else if (tag === 'PRE' || tag === 'CODE') tagLabel = 'Código';
        else if (tag === 'BLOCKQUOTE') tagLabel = 'Citação';
        else if (tag === 'P') tagLabel = 'Parágrafo';
        else if (tag === 'LI') tagLabel = 'Item';
        else if (el.classList.contains('dict-term-card') || el.classList.contains('dict-term-row')) tagLabel = 'Termo';
        else if (el.classList.contains('card') || el.classList.contains('dash-card')) tagLabel = 'Card';

        el.classList.add('ai-inspectable-block');
        el.setAttribute('data-ai-block-tag', tagLabel);
      });
    });
  }, []);

  const cleanseAndExtractText = (el: HTMLElement): string => {
    const tag = el.tagName.toUpperCase();

    if (tag === 'TABLE' || el.querySelector('table')) {
      const table = tag === 'TABLE' ? (el as HTMLTableElement) : el.querySelector('table')!;
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length > 0) {
        const tableLines: string[] = [];
        rows.forEach((r, idx) => {
          const cells = Array.from(r.querySelectorAll('th, td')).map(c => c.textContent?.trim().replace(/\|/g, '\\|') || '');
          tableLines.push(`| ${cells.join(' | ')} |`);
          if (idx === 0) {
            tableLines.push(`| ${cells.map(() => '---').join(' | ')} |`);
          }
        });
        return tableLines.join('\n');
      }
    }

    if (tag === 'PRE' || tag === 'CODE') {
      return `\`\`\`\n${el.textContent?.trim() || ''}\n\`\`\``;
    }

    if (tag === 'H1') return `# ${el.textContent?.trim() || ''}`;
    if (tag === 'H2') return `## ${el.textContent?.trim() || ''}`;
    if (tag === 'H3') return `### ${el.textContent?.trim() || ''}`;
    if (tag === 'H4') return `#### ${el.textContent?.trim() || ''}`;
    if (tag === 'LI') return `- ${el.textContent?.trim() || ''}`;

    const text = el.innerText || el.textContent || '';
    const clean = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');

    return clean;
  };

  const stopInspector = useCallback(() => {
    setIsInspectorActive(false);
    document.body.classList.remove('ai-inspecting-mode');
    document.querySelectorAll('.ai-inspectable-block').forEach((el) => {
      el.classList.remove('ai-inspectable-block');
      el.removeAttribute('data-ai-block-tag');
    });
  }, []);

  const startInspector = useCallback(() => {
    setIsInspectorActive(true);
    document.body.classList.add('ai-inspecting-mode');
    markInspectableBlocks();
  }, [markInspectableBlocks]);

  const toggleInspector = () => {
    if (isInspectorActive) {
      stopInspector();
    } else {
      startInspector();
    }
  };

  useEffect(() => {
    if (!isInspectorActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopInspector();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest('#global-ai-pane') ||
        target.closest('.workbench-ai-pane') ||
        target.closest('.ai-copilot-prompt-sidebar') ||
        target.closest('#ai-inspector-toast-banner') ||
        target.closest('.pane-resizer') ||
        target.closest('#ai-settings-modal')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const blockEl =
        target.closest('.ai-inspectable-block') ||
        target.closest('h1, h2, h3, h4, h5, h6, table, pre, code, blockquote, p, ul, ol, li, .notion-block, .card, .dict-term-card, .dict-term-row, section, article, .dash-card') ||
        target;

      const extracted = cleanseAndExtractText(blockEl as HTMLElement);
      if (extracted && extracted.trim()) {
        const snippetToInsert = extracted.trim();
        setInputText(prev => {
          if (!prev.trim()) return snippetToInsert;
          return `${prev.trim()}\n\n${snippetToInsert}`;
        });

        setInspectorFlash('Trecho capturado e anexado ao chat! ✨');
        setTimeout(() => setInspectorFlash(null), 2500);

        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isInspectorActive, stopInspector]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('ai-inspecting-mode');
    };
  }, []);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const textToSend = inputText.trim();
    setInputText('');

    if (isInspectorActive) {
      stopInspector();
    }

    const badge = dynamicContext?.badge || (activeFile ? `📄 ${activeFile}` : undefined);
    await sendMessage(textToSend, badge ? [badge] : []);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleApplyToDoc = (text: string) => {
    if (onApplyContent) {
      onApplyContent(text);
    } else {
      setFileContent(text);
    }
  };

  const currentContextLabel = dynamicContext?.badge || (activeFile ? `📄 ${activeFile}` : 'Nenhum documento selecionado');

  return (
    <>
      {/* 1. Header: Agent Pill Button, RAW, History & Close Control */}
      <div className="ai-pane-header">
        <div className="ai-copilot-agent-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <button
            className="ai-copilot-agent-btn"
            type="button"
            title="Configurar modelo e instruções do agente"
            onClick={onOpenPrompt}
          >
            <span className="material-symbols-outlined icon-xs ai-copilot-agent-icon">smart_toy</span>
            <span className="ai-copilot-agent-name">Antigravity Agent</span>
            <span className="material-symbols-outlined icon-xs ai-copilot-chevron">tune</span>
          </button>
        </div>

        <div className="ai-copilot-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            className="ai-copilot-raw-btn"
            title="Inspetor RAW (Ver Prompts, Memória e Payloads)"
            type="button"
            onClick={onOpenRaw}
          >
            RAW
          </button>
          <button
            className="btn-icon ai-copilot-history-btn"
            title="Linha de Raciocínio & Histórico de Sessões"
            type="button"
            onClick={onOpenHistory}
          >
            <span className="material-symbols-outlined icon-sm">history</span>
          </button>
          <button
            className="btn-icon ai-copilot-close-btn"
            title="Recolher Assistente"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      {/* 2. Scrollable Message History Stream */}
      <div className="ai-messages-scroll ai-copilot-messages-container">
        {/* Default Welcome Message */}
        <div className="chat-bubble ai">
          <div className="chat-bubble-sender">
            <span className="material-symbols-outlined icon-xs">smart_toy</span>
            <strong>Antigravity Agent</strong>
          </div>
          <div className="ai-reply-content">
            <p style={{ margin: 0 }}>
              Pareando com você no documento ativo. Pergunte, solicite refatorações ou use o alvo (🎯) para capturar trechos da tela!
            </p>
          </div>
        </div>

        {/* Dynamic Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
            <div className="chat-bubble-sender">
              <span className="material-symbols-outlined icon-xs">
                {msg.sender === 'user' ? 'account_circle' : 'smart_toy'}
              </span>
              <strong>{msg.sender === 'user' ? 'Você' : 'Antigravity Agent'}</strong>
              {msg.timestamp && (
                <span className="chat-bubble-time">{msg.timestamp}</span>
              )}
            </div>

            <div
              className={msg.sender === 'user' ? 'user-reply-content' : 'ai-reply-content'}
              dangerouslySetInnerHTML={{
                __html: marked.parse(msg.content) as string
              }}
            />

            {msg.sender === 'assistant' && (
              <div className="ai-bubble-actions" style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                  onClick={() => copyToClipboard(msg.content)}
                  title="Copiar resposta"
                >
                  📋 Copiar
                </button>
                {onInsertAtCursor && (
                  <button
                    className="btn btn-ghost btn-xs"
                    type="button"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                    onClick={() => onInsertAtCursor(msg.content)}
                    title="Inserir no cursor"
                  >
                    ✏️ Inserir
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                  onClick={() => handleApplyToDoc(msg.content)}
                  title="Substituir documento pelo conteúdo"
                >
                  ⚡ Substituir
                </button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="chat-bubble ai thinking">
            <div className="chat-bubble-sender">
              <span className="material-symbols-outlined icon-xs">smart_toy</span>
              <strong>Antigravity Agent</strong>
            </div>
            <div className="ai-reply-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="dot pulse"></span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Raciocinando na especificação...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Active Context Status Bar */}
      <div className="ai-active-context-bar" title="Contexto atualmente vinculado ao chat">
        <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--primary, #2563eb)' }}>attachment</span>
        <span className="ai-active-context-label">{currentContextLabel}</span>
      </div>

      {/* 4. Floating Inspector Banner (Active when picking elements) */}
      {isInspectorActive && (
        <div id="ai-inspector-toast-banner">
          <span className="material-symbols-outlined" style={{ color: '#60a5fa', fontSize: '18px' }}>ads_click</span>
          <span>Modo Alvo Ativo: Clique nos blocos da tela para adicionar ao chat</span>
          <span className="ai-kbd-badge" onClick={stopInspector} title="Finalizar modo de seleção">ESC</span>
        </div>
      )}

      {/* 5. Full-Width Prompt Container */}
      <form className="ai-copilot-input-container" onSubmit={handleSend}>
        {inspectorFlash && (
          <div className="ai-inspector-mini-toast">
            {inspectorFlash}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="ai-copilot-textarea"
          placeholder="Mensagem para o Agente... (Shift+Enter para nova linha)"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className="ai-input-bottom-bar">
          <button
            className={`ai-target-btn ${isInspectorActive ? 'active' : ''}`}
            type="button"
            onClick={toggleInspector}
            title={isInspectorActive ? 'Desativar seleção de blocos (ESC)' : 'Alvo: Selecionar trechos na tela para colar no chat'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>ads_click</span>
            <span className="ai-target-label">{isInspectorActive ? 'Alvo Ativo' : 'Capturar'}</span>
          </button>

          <div className="ai-input-actions-right">
            <span className="ai-input-hint">Enter ↵</span>
            <button
              className="ai-send-icon-btn"
              type="submit"
              disabled={!inputText.trim() || isThinking}
              title="Enviar mensagem (Enter)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_upward</span>
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { useAI } from '../../context/AIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PromptSidebar } from './PromptSidebar';
import { HistorySidebar } from './HistorySidebar';
import { RawInspectorSidebar } from './RawInspectorSidebar';

const DEFAULT_COPILOT_CHIPS = [
  { label: "💡 Sugerir Melhorias", prompt: "Analise o contexto deste documento e sugira melhorias técnicas, funcionais e de negócio." },
  { label: "🏛️ Diretrizes DDD", prompt: "Audite e recomende padrões de arquitetura DDD, limites de contexto e invariantes." },
  { label: "📊 Diagrama Mermaid", prompt: "Gere um diagrama Mermaid visual representando o fluxo ou arquitetura deste documento." },
  { label: "📋 Revisar Seções", prompt: "Revise a completude do documento e aponte possíveis inconsistências ou lacunas." },
];

interface AICopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyContent?: (content: string) => void;
  onInsertAtCursor?: (text: string) => void;
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  isOpen,
  onClose,
  onApplyContent,
  onInsertAtCursor
}) => {
  const { messages, isThinking, sendMessage, aiSettings, openSettingsModal } = useAI();
  const { activeFile, activeRepo, fileContent, setFileContent } = useWorkspace();
  const [inputText, setInputText] = useState('');

  // Sidebar states
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRawOpen, setIsRawOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [targetSnippet, setTargetSnippet] = useState<{ label: string; text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    let fullPrompt = inputText;
    if (targetSnippet) {
      fullPrompt = `[Alvo: ${targetSnippet.label}]\n"${targetSnippet.text}"\n\nInstrução: ${inputText}`;
      setTargetSnippet(null);
    }

    const textToSend = fullPrompt;
    setInputText('');
    await sendMessage(textToSend, activeFile ? [`📄 ${activeFile}`] : []);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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

  return (
    <>
      {/* 1. Header: Agent Pill Button, Memory Dot, RAW, History & Close Control */}
      <div className="ai-pane-header">
        <div className="ai-copilot-agent-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <button
            className="ai-copilot-agent-btn"
            type="button"
            title="Clique para configurar o modelo e editar o pré-prompt deste agente"
            onClick={() => setIsPromptOpen(true)}
          >
            <span className="material-symbols-outlined icon-xs ai-copilot-agent-icon">smart_toy</span>
            <span className="ai-copilot-agent-name">Antigravity Agent</span>
            <span className="material-symbols-outlined icon-xs ai-copilot-chevron">tune</span>
          </button>
        </div>

        <div className="ai-copilot-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            className="ai-copilot-raw-btn"
            title="Inspetor RAW (Ver Prompts, Memória e Payloads na Íntegra)"
            type="button"
            onClick={() => setIsRawOpen(true)}
          >
            RAW
          </button>
          <button
            className="btn-icon ai-copilot-history-btn"
            title="Linha de Raciocínio & Histórico de Sessões"
            type="button"
            onClick={() => setIsHistoryOpen(true)}
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
              Pareando com você no documento ativo. Como posso ajudar na modelagem, refinamento ou especificações?
            </p>
          </div>
        </div>

        {/* Dynamic Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
            <div className="chat-bubble-sender">
              <span className="material-symbols-outlined icon-xs">
                {msg.sender === 'user' ? 'person' : 'smart_toy'}
              </span>
              <strong>{msg.sender === 'user' ? 'Você' : 'Antigravity Agent'}</strong>
            </div>

            <div
              className="ai-reply-content"
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
                  title="Substituir todo o documento"
                >
                  📄 Substituir Doc
                </button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="chat-bubble ai">
            <div className="chat-bubble-sender">
              <span className="material-symbols-outlined icon-xs" style={{ animation: 'spin 1s linear infinite' }}>
                progress_activity
              </span>
              <strong>Antigravity Agent</strong>
            </div>
            <div className="ai-reply-content" style={{ color: 'var(--text-muted)' }}>
              Raciocinando & compilando contexto...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Suggestion Chips */}
      <div className="ai-chips-container ai-copilot-chips-container">
        {DEFAULT_COPILOT_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            className="chip-item"
            type="button"
            onClick={() => setInputText(chip.prompt)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 4. Targeted Section Context Pill (if active) */}
      {targetSnippet && (
        <div className="ai-copilot-target-context-pill">
          <div className="target-info">
            <span className="material-symbols-outlined icon-xs">ads_click</span>
            <span className="target-title">{targetSnippet.label}</span>
          </div>
          <button
            type="button"
            className="btn-remove-target"
            title="Remover foco da seção"
            onClick={() => setTargetSnippet(null)}
          >
            <span className="material-symbols-outlined icon-xs">close</span>
          </button>
        </div>
      )}

      {/* 5. Prompt Input Area */}
      <form className="ai-input-wrapper ai-copilot-input-wrapper" onSubmit={handleSend}>
        <button
          className="ai-copilot-inspect-btn"
          type="button"
          title="Selecionar elemento/seção na tela para direcionar ao Chat (Dev Mode Inspector)"
        >
          <span className="material-symbols-outlined icon-xs">ads_click</span>
        </button>
        <input
          type="text"
          className="ai-copilot-input-field"
          placeholder="Peça sugestões ou aponte uma seção..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn btn-primary btn-sm ai-copilot-send-btn"
          type="submit"
          disabled={!inputText.trim() || isThinking}
        >
          Enviar
        </button>
      </form>

      {/* Sidebars */}
      <PromptSidebar
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        systemPrompt={systemPrompt}
        defaultPrompt="Você é o Arquiteto de Software & Assistente do Spec-Driven Context OS."
        onSavePrompt={(p) => setSystemPrompt(p)}
        onResetPrompt={() => setSystemPrompt('')}
        onOpenAIModal={openSettingsModal}
        modelName={aiSettings?.active_model || 'gemini-3.5-flash'}
      />

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        repo={activeRepo?.name || 'default'}
        docPath={activeFile || 'index.md'}
        onRestoreSession={() => {}}
      />

      <RawInspectorSidebar
        isOpen={isRawOpen}
        onClose={() => setIsRawOpen(false)}
        rawPayload={{
          repo: activeRepo?.name,
          docPath: activeFile,
          contentLength: fileContent?.length || 0,
          model: aiSettings?.active_model
        }}
        rawResponse={messages[messages.length - 1] || null}
      />
    </>
  );
};

import React, { useState, useEffect } from 'react';

interface PromptSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  defaultPrompt: string;
  onSavePrompt: (prompt: string) => void;
  onResetPrompt: () => void;
  onOpenAIModal?: () => void;
  modelName?: string;
  agentName?: string;
}

export const PromptSidebar: React.FC<PromptSidebarProps> = ({
  isOpen,
  onClose,
  systemPrompt,
  defaultPrompt,
  onSavePrompt,
  onResetPrompt,
  onOpenAIModal,
  modelName = 'gemini-3.5-flash',
  agentName = 'Antigravity Agent'
}) => {
  const [editedPrompt, setEditedPrompt] = useState(systemPrompt || defaultPrompt);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setEditedPrompt(systemPrompt || defaultPrompt);
  }, [systemPrompt, defaultPrompt]);

  if (!isOpen) return null;

  const isCustom = Boolean(editedPrompt && editedPrompt !== defaultPrompt);

  const handleSave = () => {
    onSavePrompt(editedPrompt);
    setFeedback('Salvo com sucesso!');
    setTimeout(() => setFeedback(''), 2500);
  };

  const handleRestore = () => {
    setEditedPrompt(defaultPrompt);
    onResetPrompt();
    setFeedback('Prompt padrão restaurado!');
    setTimeout(() => setFeedback(''), 2500);
  };

  return (
    <aside className="ai-copilot-prompt-sidebar" style={{ display: 'flex' }}>
      <div className="ai-prompt-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
            tune
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-heading, #0f172a)', whiteSpace: 'nowrap' }}>
              Parâmetros & Pré-Prompt
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Context OS &bull; <span className="ai-copilot-prompt-agent-tag">{agentName}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            className="btn-icon ai-copilot-close-prompt-sidebar-btn"
            type="button"
            title="Fechar painel de parâmetros"
            onClick={onClose}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <div className="ai-prompt-sidebar-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', background: '#ffffff' }}>
        {/* Model Selection Block */}
        <div style={{ padding: '10px 12px', background: 'var(--bg-hover, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase' }}>
              Modelo de IA Ativo
            </div>
            <strong className="ai-copilot-model-name-label" style={{ fontSize: '12.5px', color: 'var(--primary, #2563eb)' }}>
              {modelName}
            </strong>
          </div>
          {onOpenAIModal && (
            <button
              className="btn btn-secondary btn-xs ai-copilot-open-ai-modal-btn"
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={onOpenAIModal}
            >
              <span className="material-symbols-outlined icon-xs">tune</span> Configurar
            </button>
          )}
        </div>

        {/* Prompt Description */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-heading, #0f172a)', margin: 0 }}>
              Instruções & Persona do Agente:
            </label>
            <span className={`ai-copilot-status-badge ${isCustom ? 'custom' : 'preset'}`} style={{ fontSize: '10px' }}>
              {isCustom ? 'CUSTOMIZADO' : 'PADRÃO'}
            </span>
          </div>
          <p className="ai-copilot-prompt-hint" style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: 1.4, flexShrink: 0 }}>
            Diretrizes mestras que este agente utiliza para raciocinar e interagir neste documento:
          </p>
          <textarea
            className="ai-copilot-prompt-textarea"
            style={{
              width: '100%',
              flex: '1 1 auto',
              minHeight: 0,
              height: '100%',
              padding: '12px',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '8px',
              fontSize: '12px',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono, monospace)',
              resize: 'none',
              boxSizing: 'border-box',
              background: '#f8fafc',
              outline: 'none'
            }}
            spellCheck="false"
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
          />
        </div>
      </div>

      <div className="ai-prompt-sidebar-footer" style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-hover, #f8fafc)' }}>
        <button
          className="ai-copilot-restore-btn btn-link-subtle"
          type="button"
          style={{ fontSize: '11.5px', background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}
          title="Restaurar prompt original recomendado pelo framework"
          onClick={handleRestore}
        >
          Restaurar Padrão
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {feedback && (
            <span className="ai-copilot-prompt-feedback" style={{ fontSize: '11px', color: 'var(--primary, #2563eb)' }}>
              {feedback}
            </span>
          )}
          <button
            className="btn btn-primary btn-xs ai-copilot-save-prompt-btn"
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={handleSave}
          >
            <span className="material-symbols-outlined icon-xs">save</span> Salvar no Projeto
          </button>
        </div>
      </div>
    </aside>
  );
};

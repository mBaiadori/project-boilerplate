import React from "react";

interface CopilotPromptsSectionProps {
  templatePrompt?: string | null;
  templateTitle?: string | null;
  isTemplatePromptEnabled: boolean;
  onToggleTemplatePrompt: () => void;
  docPrompt?: string | null;
  isDocPromptEnabled: boolean;
  onToggleDocPrompt: () => void;
  onOpenPrompt: () => void;
}

export const CopilotPromptsSection: React.FC<CopilotPromptsSectionProps> = ({
  templatePrompt,
  templateTitle,
  isTemplatePromptEnabled,
  onToggleTemplatePrompt,
  docPrompt,
  isDocPromptEnabled,
  onToggleDocPrompt,
  onOpenPrompt,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "10.5px",
          fontWeight: 600,
          color: "var(--color-on-surface-variant, #475569)",
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "14px",
            color: "var(--color-primary, #2563eb)",
          }}
        >
          tune
        </span>
        <span>Prompts:</span>
      </div>

      {templatePrompt ? (
        <button
          type="button"
          onClick={onToggleTemplatePrompt}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            borderRadius: "12px",
            border: "1px solid",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
            background: isTemplatePromptEnabled
              ? "var(--color-primary-container, #eff6ff)"
              : "var(--color-surface-container, #f1f5f9)",
            color: isTemplatePromptEnabled
              ? "var(--color-primary, #1d4ed8)"
              : "var(--text-muted, #64748b)",
            borderColor: isTemplatePromptEnabled
              ? "var(--color-primary, #3b82f6)"
              : "var(--color-outline-variant, #cbd5e1)",
            transition: "all 0.15s ease",
            maxWidth: "160px",
          }}
          title={
            isTemplatePromptEnabled
              ? `Prompt de Template Ativo: ${templateTitle || "Template"}. Clique para desativar.`
              : `Prompt de Template Desativado: ${templateTitle || "Template"}. Clique para ativar.`
          }
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "13px",
              color: isTemplatePromptEnabled ? "#10b981" : "#94a3b8",
              flexShrink: 0,
            }}
          >
            {isTemplatePromptEnabled
              ? "check_circle"
              : "radio_button_unchecked"}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Template: {templateTitle || "Ativo"}
          </span>
        </button>
      ) : null}

      {docPrompt ? (
        <button
          type="button"
          onClick={onToggleDocPrompt}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            borderRadius: "12px",
            border: "1px solid",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
            background: isDocPromptEnabled
              ? "var(--color-primary-container, #eff6ff)"
              : "var(--color-surface-container, #f1f5f9)",
            color: isDocPromptEnabled
              ? "var(--color-primary, #1d4ed8)"
              : "var(--text-muted, #64748b)",
            borderColor: isDocPromptEnabled
              ? "var(--color-primary, #3b82f6)"
              : "var(--color-outline-variant, #cbd5e1)",
            transition: "all 0.15s ease",
            maxWidth: "140px",
          }}
          title={
            isDocPromptEnabled
              ? "Prompt do Documento Ativo. Clique para desativar."
              : "Prompt do Documento Desativado. Clique para ativar."
          }
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "13px",
              color: isDocPromptEnabled ? "#10b981" : "#94a3b8",
              flexShrink: 0,
            }}
          >
            {isDocPromptEnabled ? "check_circle" : "radio_button_unchecked"}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Doc Prompt
          </span>
        </button>
      ) : null}

      {!templatePrompt && !docPrompt && (
        <span
          style={{
            fontSize: "10.5px",
            color: "var(--text-muted, #94a3b8)",
            fontStyle: "italic",
          }}
        >
          Padrão
        </span>
      )}

      <button
        type="button"
        onClick={onOpenPrompt}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-primary, #2563eb)",
          cursor: "pointer",
          fontSize: "10.5px",
          display: "inline-flex",
          alignItems: "center",
          gap: "2px",
          fontWeight: 600,
          padding: "1px 4px",
          borderRadius: "4px",
        }}
        title="Ver e ajustar prompts do documento e template"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "13px" }}
        >
          edit_note
        </span>
        Ajustar
      </button>
    </div>
  );
};

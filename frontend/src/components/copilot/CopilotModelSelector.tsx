import React, { useState, useRef, useEffect } from "react";

interface ModelItem {
  id: string;
  name: string;
  badge?: string;
}

interface ProviderGroup {
  provider: string;
  providerName: string;
  icon: string;
  models: ModelItem[];
}

interface CopilotModelSelectorProps {
  activeModel: string;
  activeProvider: string;
  onSelectModel: (provider: string, modelId: string) => void;
  onOpenSettings: () => void;
}

const DEFAULT_MODELS_BY_PROVIDER: ProviderGroup[] = [
  {
    provider: "gemini",
    providerName: "Google Gemini",
    icon: "smart_toy",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Recomendado" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "Raciocínio" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", badge: "Super Rápido" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", badge: "Leve" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", badge: "Contexto Longo" },
    ],
  },
  {
    provider: "openai",
    providerName: "OpenAI",
    icon: "psychology",
    models: [
      { id: "gpt-4o", name: "GPT-4o", badge: "Multimodal" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", badge: "Econômico" },
      { id: "o3-mini", name: "o3 Mini", badge: "Raciocínio" },
      { id: "o1", name: "o1 Preview", badge: "Avançado" },
    ],
  },
  {
    provider: "anthropic",
    providerName: "Anthropic Claude",
    icon: "auto_awesome",
    models: [
      { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", badge: "Híbrido" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", badge: "Código" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", badge: "Rápido" },
    ],
  },
  {
    provider: "ollama",
    providerName: "Ollama",
    icon: "terminal",
    models: [
      { id: "llama3.3", name: "Llama 3.3 70B", badge: "Local" },
      { id: "llama3.2", name: "Llama 3.2", badge: "Leve" },
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", badge: "Código" },
      { id: "deepseek-r1", name: "DeepSeek R1", badge: "Local R1" },
    ],
  },
];

export const CopilotModelSelector: React.FC<CopilotModelSelectorProps> = ({
  activeModel,
  activeProvider,
  onSelectModel,
  onOpenSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (provider: string, modelId: string) => {
    onSelectModel(provider, modelId);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className="ai-copilot-agent-wrapper"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: 0,
        position: "relative",
        overflow: "visible",
      }}
    >
      {/* Quick Model Selector Trigger */}
      <button
        className="ai-copilot-agent-btn"
        type="button"
        title="Clique para abrir e alternar a lista de modelos de IA"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "16px",
          background: isOpen
            ? "var(--color-primary, #2563eb)"
            : "var(--color-surface-container, #f1f5f9)",
          color: isOpen ? "#ffffff" : "var(--color-on-surface, #0f172a)",
          border: "1px solid var(--color-outline-variant, #cbd5e1)",
          cursor: "pointer",
          fontSize: "11.5px",
          fontWeight: 600,
          transition: "all 0.15s ease",
        }}
      >
        <span
          className="material-symbols-outlined icon-xs"
          style={{
            fontSize: "15px",
            color: isOpen ? "#ffffff" : "var(--color-primary, #2563eb)",
          }}
        >
          smart_toy
        </span>
        <span
          style={{
            maxWidth: "140px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeModel}
        </span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "14px",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        >
          expand_more
        </span>
      </button>

      {/* Quick Model Switcher Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1100,
            width: "290px",
            background: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-outline-variant, #cbd5e1)",
            borderRadius: "12px",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "380px",
            overflowY: "auto",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px 6px 8px",
              borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--color-on-surface-variant, #64748b)",
            }}
          >
            <span>Lista de Modelos de IA</span>
            <span
              style={{
                fontSize: "10px",
                background: "var(--color-primary-container, #dbeafe)",
                color: "var(--color-primary, #1d4ed8)",
                padding: "1px 6px",
                borderRadius: "4px",
                fontWeight: 700,
              }}
            >
              {activeProvider.toUpperCase()}
            </span>
          </div>

          {DEFAULT_MODELS_BY_PROVIDER.map((grp) => (
            <div
              key={grp.provider}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-muted, #94a3b8)",
                  padding: "4px 8px 2px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "12px" }}
                >
                  {grp.icon}
                </span>
                {grp.providerName}
              </div>
              {grp.models.map((m) => {
                const isSelected = activeModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(grp.provider, m.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: isSelected
                        ? "1px solid var(--color-primary, #2563eb)"
                        : "1px solid transparent",
                      background: isSelected
                        ? "var(--color-primary-container, #eff6ff)"
                        : "transparent",
                      color: isSelected
                        ? "var(--color-primary, #1d4ed8)"
                        : "var(--color-on-surface, #1e293b)",
                      cursor: "pointer",
                      fontSize: "11.5px",
                      textAlign: "left",
                      transition: "background 0.12s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "14px",
                          color: isSelected
                            ? "var(--color-primary, #2563eb)"
                            : "var(--text-muted, #94a3b8)",
                          flexShrink: 0,
                        }}
                      >
                        {isSelected
                          ? "check_circle"
                          : "radio_button_unchecked"}
                      </span>
                      <span
                        style={{
                          fontWeight: isSelected ? 600 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name}
                      </span>
                    </div>
                    {m.badge && (
                      <span
                        style={{
                          fontSize: "9.5px",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: isSelected
                            ? "var(--color-primary, #2563eb)"
                            : "#f1f5f9",
                          color: isSelected ? "#ffffff" : "#64748b",
                          flexShrink: 0,
                          fontWeight: 600,
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid var(--color-outline-variant, #e2e8f0)",
              paddingTop: "6px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "6px",
                borderRadius: "6px",
                border: "none",
                background: "var(--color-surface-container, #f8fafc)",
                color: "var(--color-primary, #2563eb)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "14px" }}
              >
                settings
              </span>
              Gerenciar Provedores & Chaves
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

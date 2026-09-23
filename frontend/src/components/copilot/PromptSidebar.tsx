// =============================================================================
// COMPONENT: PROMPT SIDEBAR (HIERARQUIA & PARÂMETROS DA IA)
// Exibe com clareza as camadas de instrução:
// - Modo Documento: Prompt do Documento e Template Vinculado.
// - Modo Template: Prompt Criador de Templates (ai_template_prompt) e Prompt deste Template.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";

interface PromptSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt?: string;
  defaultPrompt?: string;
  onSavePrompt?: (prompt: string) => void;
  onResetPrompt?: () => void;
  onOpenAIModal?: () => void;
  modelName?: string;
  agentName?: string;
}

export const PromptSidebar: React.FC<PromptSidebarProps> = ({
  isOpen,
  onClose,
  onOpenAIModal,
  modelName = "gemini-3.5-flash",
  agentName = "Agent",
}) => {
  const {
    projectTemplatePrompt,
    isTemplateEditorMode,
    templatePrompt,
    templateTitle,
    templateId,
    isTemplatePromptEnabled,
    toggleTemplatePrompt,
    docPrompt,
    isDocPromptEnabled,
    toggleDocPrompt,
  } = useAI();

  const { saveProjectConfig, projectConfig } = useWorkspace();

  // Mode specific tabs
  const [docTab, setDocTab] = useState<"doc_prompt" | "template_linked">(
    "doc_prompt",
  );
  const [templateTab, setTemplateTab] = useState<
    "creator_prompt" | "template_prompt"
  >("creator_prompt");

  const [editedTemplateCreatorPrompt, setEditedTemplateCreatorPrompt] =
    useState(projectTemplatePrompt || "");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedTemplateCreatorPrompt(projectTemplatePrompt || "");
  }, [projectTemplatePrompt]);

  if (!isOpen) return null;

  const handleSaveTemplateCreatorPrompt = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...(projectConfig || {}),
        ai_template_prompt: editedTemplateCreatorPrompt,
      };
      const res = await saveProjectConfig(updatedConfig);
      if (res.success) {
        setFeedback("Prompt do Arquiteto de Templates salvo no projeto!");
        setTimeout(() => setFeedback(""), 2500);
      } else {
        setFeedback(res.error || "Erro ao salvar.");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      setFeedback("Erro de conexão.");
      setTimeout(() => setFeedback(""), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside
      className="ai-copilot-prompt-sidebar"
      style={{ display: "flex", width: "340px", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="ai-prompt-sidebar-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: 0,
          }}
        >
          <span
            className="material-symbols-outlined icon-sm"
            style={{ color: "var(--primary, #2563eb)", flexShrink: 0 }}
          >
            tune
          </span>
          <div
            style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
          >
            <strong
              style={{
                fontSize: "13px",
                color: "var(--text-heading, #0f172a)",
                whiteSpace: "nowrap",
              }}
            >
              {isTemplateEditorMode
                ? "Prompts do Modo Template"
                : "Instruções do Copilot"}
            </strong>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted, #64748b)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isTemplateEditorMode
                ? "🛠️ Arquiteto & Template"
                : "📄 Documento & Template"}{" "}
              &bull;{" "}
              <span className="ai-copilot-prompt-agent-tag">{agentName}</span>
            </span>
          </div>
        </div>
        <button
          className="btn-icon ai-copilot-close-prompt-sidebar-btn"
          type="button"
          title="Fechar painel"
          onClick={onClose}
        >
          <span className="material-symbols-outlined icon-sm">close</span>
        </button>
      </div>

      <div
        className="ai-prompt-sidebar-body"
        style={{
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          background: "#ffffff",
        }}
      >
        {/* Model Selection Block */}
        <div
          style={{
            padding: "8px 12px",
            background: "var(--bg-hover, #f8fafc)",
            borderRadius: "8px",
            border: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-muted, #64748b)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Modelo Ativo
            </div>
            <strong
              className="ai-copilot-model-name-label"
              style={{ fontSize: "12px", color: "var(--primary, #2563eb)" }}
            >
              {modelName}
            </strong>
          </div>
          {onOpenAIModal && (
            <button
              className="btn btn-secondary btn-xs"
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
              }}
              onClick={onOpenAIModal}
            >
              <span className="material-symbols-outlined icon-xs">tune</span>{" "}
              Provedores
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CENÁRIO 1: MODO CRIADOR / EDITOR DE TEMPLATE                              */}
        {/* ========================================================================= */}
        {isTemplateEditorMode ? (
          <>
            {/* Tabs do Modo Template */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "var(--bg-hover, #f1f5f9)",
                padding: "3px",
                borderRadius: "8px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className={`notion-tab-btn ${templateTab === "creator_prompt" ? "active" : ""}`}
                onClick={() => setTemplateTab("creator_prompt")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: templateTab === "creator_prompt" ? 600 : 500,
                  background:
                    templateTab === "creator_prompt"
                      ? "#ffffff"
                      : "transparent",
                  color:
                    templateTab === "creator_prompt"
                      ? "var(--primary, #2563eb)"
                      : "var(--text-muted, #64748b)",
                  boxShadow:
                    templateTab === "creator_prompt"
                      ? "0 1px 2px rgba(0,0,0,0.08)"
                      : "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                🛠️ Arquiteto de Templates
              </button>
              <button
                type="button"
                className={`notion-tab-btn ${templateTab === "template_prompt" ? "active" : ""}`}
                onClick={() => setTemplateTab("template_prompt")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: templateTab === "template_prompt" ? 600 : 500,
                  background:
                    templateTab === "template_prompt"
                      ? "#ffffff"
                      : "transparent",
                  color:
                    templateTab === "template_prompt"
                      ? "var(--primary, #2563eb)"
                      : "var(--text-muted, #64748b)",
                  boxShadow:
                    templateTab === "template_prompt"
                      ? "0 1px 2px rgba(0,0,0,0.08)"
                      : "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                🤖 Prompt deste Template
              </button>
            </div>

            {/* Tab 1: Prompt do Arquiteto (ai_template_prompt) */}
            {templateTab === "creator_prompt" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "11.5px",
                      color: "var(--text-heading, #0f172a)",
                    }}
                  >
                    Prompt do Arquiteto (Mestre):
                  </strong>
                  <span
                    className="badge badge-success"
                    style={{ fontSize: "9.5px" }}
                  >
                    ● ATIVO NO COPILOT
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted, #64748b)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Instrução que o Copilot utiliza agora para ajudar a estruturar
                  este novo template:
                </p>
                <textarea
                  style={{
                    width: "100%",
                    flex: 1,
                    minHeight: "140px",
                    padding: "10px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    lineHeight: 1.4,
                    fontFamily: "var(--font-mono, monospace)",
                    background: "#f0fdf4",
                    resize: "none",
                    outline: "none",
                  }}
                  spellCheck="false"
                  value={editedTemplateCreatorPrompt}
                  onChange={(e) =>
                    setEditedTemplateCreatorPrompt(e.target.value)
                  }
                />
              </div>
            )}

            {/* Tab 2: Prompt do Template em Edição */}
            {templateTab === "template_prompt" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    background: "var(--bg-hover, #f8fafc)",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "12px",
                      color: "var(--text-heading, #0f172a)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Instrução que acompanhará este template:
                  </strong>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted, #64748b)",
                      margin: "0 0 8px 0",
                      lineHeight: 1.4,
                    }}
                  >
                    Quando usuários criarem documentos usando este template,
                    esta será a instrução especializada fornecida ao Copilot.
                  </p>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono, monospace)",
                      whiteSpace: "pre-wrap",
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                  >
                    {templatePrompt ||
                      "(Nenhum prompt definido ainda no editor)"}
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "10.5px",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    💡 Dica: Para editar este prompt, use a aba{" "}
                    <strong>Prompt do Copilot</strong> no editor principal.
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ========================================================================= */
          /* CENÁRIO 2: MODO DOCUMENTO REGULAR                                         */
          /* ========================================================================= */
          <>
            {/* Tabs do Modo Documento */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "var(--bg-hover, #f1f5f9)",
                padding: "3px",
                borderRadius: "8px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className={`notion-tab-btn ${docTab === "doc_prompt" ? "active" : ""}`}
                onClick={() => setDocTab("doc_prompt")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: docTab === "doc_prompt" ? 600 : 500,
                  background:
                    docTab === "doc_prompt" ? "#ffffff" : "transparent",
                  color:
                    docTab === "doc_prompt"
                      ? "var(--primary, #2563eb)"
                      : "var(--text-muted, #64748b)",
                  boxShadow:
                    docTab === "doc_prompt"
                      ? "0 1px 2px rgba(0,0,0,0.08)"
                      : "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📄 Prompt do Documento
              </button>
              <button
                type="button"
                className={`notion-tab-btn ${docTab === "template_linked" ? "active" : ""}`}
                onClick={() => setDocTab("template_linked")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: docTab === "template_linked" ? 600 : 500,
                  background:
                    docTab === "template_linked" ? "#ffffff" : "transparent",
                  color:
                    docTab === "template_linked"
                      ? "var(--primary, #2563eb)"
                      : "var(--text-muted, #64748b)",
                  boxShadow:
                    docTab === "template_linked"
                      ? "0 1px 2px rgba(0,0,0,0.08)"
                      : "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📋 Template Vinculado
              </button>
            </div>

            {/* Tab 1: Prompt do Documento */}
            {docTab === "doc_prompt" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    background: "var(--bg-hover, #f8fafc)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "var(--text-heading, #0f172a)",
                      }}
                    >
                      Instrução deste Documento:
                    </span>
                    {docPrompt ? (
                      <button
                        type="button"
                        onClick={toggleDocPrompt}
                        style={{
                          fontSize: "10.5px",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          border: "1px solid",
                          background: isDocPromptEnabled
                            ? "#2563eb"
                            : "#ffffff",
                          color: isDocPromptEnabled ? "#ffffff" : "var(--text-muted, #64748b)",
                          borderColor: isDocPromptEnabled
                            ? "#1d4ed8"
                            : "var(--border-color, #cbd5e1)",
                          cursor: "pointer",
                          fontWeight: 600,
                          boxShadow: isDocPromptEnabled
                            ? "0 1px 3px rgba(37, 99, 235, 0.3)"
                            : "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px" }}
                        >
                          {isDocPromptEnabled ? "check_circle" : "cancel"}
                        </span>
                        {isDocPromptEnabled ? "Ativo" : "Inativo"}
                      </button>
                    ) : (
                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: "9px" }}
                      >
                        Não definido
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono, monospace)",
                      whiteSpace: "pre-wrap",
                      maxHeight: "160px",
                      overflowY: "auto",
                    }}
                  >
                    {docPrompt
                      ? docPrompt
                      : "Nenhum prompt específico gravado neste documento."}
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "10.5px",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    💡 Dica: Para editar este prompt, use a aba{" "}
                    <strong>Prompt do Copilot</strong> no editor do documento.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Template Vinculado */}
            {docTab === "template_linked" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    background: "var(--bg-hover, #f8fafc)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "var(--text-heading, #0f172a)",
                        maxWidth: "170px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                      title={templateTitle || templateId || "Nenhum"}
                    >
                      Template: {templateTitle || templateId || "Nenhum"}
                    </span>
                    {templatePrompt && (
                      <button
                        type="button"
                        onClick={toggleTemplatePrompt}
                        style={{
                          fontSize: "10.5px",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          border: "1px solid",
                          background: isTemplatePromptEnabled
                            ? "#10b981"
                            : "#ffffff",
                          color: isTemplatePromptEnabled
                            ? "#ffffff"
                            : "var(--text-muted, #64748b)",
                          borderColor: isTemplatePromptEnabled
                            ? "#059669"
                            : "var(--border-color, #cbd5e1)",
                          cursor: "pointer",
                          fontWeight: 600,
                          boxShadow: isTemplatePromptEnabled
                            ? "0 1px 3px rgba(16, 185, 129, 0.3)"
                            : "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px" }}
                        >
                          {isTemplatePromptEnabled ? "check_circle" : "cancel"}
                        </span>
                        {isTemplatePromptEnabled ? "Ativo" : "Inativo"}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--border-color, #cbd5e1)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono, monospace)",
                      whiteSpace: "pre-wrap",
                      maxHeight: "160px",
                      overflowY: "auto",
                    }}
                  >
                    {templatePrompt
                      ? templatePrompt
                      : "Este documento não possui template vinculado ou o template não possui prompt customizado."}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer: Salvar Prompt do Arquiteto (apenas no modo de template na aba creator_prompt) */}
      {isTemplateEditorMode && templateTab === "creator_prompt" && (
        <div
          className="ai-prompt-sidebar-footer"
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-hover, #f8fafc)",
          }}
        >
          {feedback ? (
            <span
              style={{ fontSize: "11px", color: "var(--primary, #2563eb)" }}
            >
              {feedback}
            </span>
          ) : (
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--text-muted, #64748b)",
              }}
            >
              Salvo no .project.config.json
            </span>
          )}
          <button
            className="btn btn-primary btn-xs"
            type="button"
            disabled={isSaving}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
            onClick={handleSaveTemplateCreatorPrompt}
          >
            <span className="material-symbols-outlined icon-xs">
              {isSaving ? "sync" : "save"}
            </span>
            {isSaving ? "Salvando..." : "Salvar no Projeto"}
          </button>
        </div>
      )}
    </aside>
  );
};

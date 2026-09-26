import React, { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { SkillsHubModal } from "../modals/SkillsHubModal";
import { ContextSelectorModal } from "./ContextSelectorModal";
import { API } from "../../services/api";
import type { TreeNode } from "../../types";

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
  onInsertAtCursor,
}) => {
  const {
    messages,
    isThinking,
    sendMessage,
    templatePrompt,
    templateTitle,
    isTemplatePromptEnabled,
    toggleTemplatePrompt,
    docPrompt,
    isDocPromptEnabled,
    toggleDocPrompt,
    isTemplateEditorMode,
    activeSkillId,
    setActiveSkillId,
    isSkillsModalOpen,
    openSkillsModal,
    closeSkillsModal,
    isRawMode,
    setIsRawMode,
    aiSettings,
    openSettingsModal,
    quickSetModel,
    newChatSession,
    referencedDocs,
    isGlobalScope,
    removeReferencedDoc,
    setIsGlobalScope,
  } = useAI();
  const { activeRepo, setFileContent, tree } = useWorkspace();
  const [inputText, setInputText] = useState("");
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [inspectorFlash, setInspectorFlash] = useState<string | null>(null);

  // Model Switcher state
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Skills Popover & Selector state
  const [isSkillsDropdownOpen, setIsSkillsDropdownOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const skillsDropdownRef = useRef<HTMLDivElement>(null);

  // Context Selector Modal state
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);

  // Click outside listener for all popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
      if (
        skillsDropdownRef.current &&
        !skillsDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSkillsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load available skills from Hub & Project
  const loadSkills = useCallback(async () => {
    try {
      const [hubRes, projRes] = await Promise.all([
        API.getSkillsHub(),
        API.getSkillsProject(activeRepo?.name),
      ]);
      const hub = hubRes.ok && hubRes.data?.skills ? hubRes.data.skills : [];
      const proj =
        projRes.ok && projRes.data?.installed_skills
          ? projRes.data.installed_skills
          : [];

      const map = new Map<string, any>();
      for (const s of hub) {
        map.set(s.id, s);
      }
      for (const s of proj) {
        map.set(s.id, { ...map.get(s.id), ...s, isInstalled: true });
      }
      setAvailableSkills(Array.from(map.values()));
    } catch (err) {
      console.warn("[AICopilotPanel] Erro ao carregar skills:", err);
    }
  }, [activeRepo?.name]);

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen, loadSkills]);

  // Scroll state
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const isUserScrolledUp = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll on new messages or thinking state change, keeping scroll at latest position
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      const timer = setTimeout(() => {
        scrollToBottom("smooth");
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [messages, isThinking, scrollToBottom]);

  // Initial scroll to bottom on panel open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom("auto");
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, scrollToBottom]);

  const handleContainerScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceToBottom > 80;
    isUserScrolledUp.current = isUp;
    setShowScrollBottomBtn(isUp);
  };

  // Adjust textarea height dynamically up to 50% of the chat height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = Math.max(160, Math.floor(window.innerHeight * 0.45));
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 44), maxHeight);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [inputText]);

  // --- DOM Element & Section Picker (Dev / Target Mode Inspector) ---
  const markInspectableBlocks = useCallback(() => {
    const containers = document.querySelectorAll(
      "main, .dash-views-container, .dash-subview, #workbench-content, #editor-container, .notion-editor-surface, .wiki-article, .dictionary-view, .doc-editor-container",
    );

    const selector =
      "h1, h2, h3, h4, h5, h6, table, pre, code, blockquote, p, .notion-block, .dash-card, .spec-card, .card, .dict-term-card, .dict-term-row, article section, li";

    containers.forEach((container) => {
      if (
        container.closest("#global-ai-pane") ||
        container.closest(".workbench-ai-pane") ||
        container.closest(".ai-copilot-prompt-sidebar")
      ) {
        return;
      }

      const elements = container.querySelectorAll(selector);
      elements.forEach((el) => {
        if (
          el.closest("#global-ai-pane") ||
          el.closest(".workbench-ai-pane") ||
          el.closest(".ai-copilot-prompt-sidebar") ||
          el.closest(".pane-resizer") ||
          el.closest("#ai-settings-modal") ||
          el.closest("nav") ||
          el.closest(".sidebar") ||
          el.closest(".dash-header") ||
          el.closest("#top-header")
        ) {
          return;
        }

        if (
          el.tagName === "P" &&
          (el.closest("blockquote") ||
            el.closest("table") ||
            el.closest(".notion-block") ||
            el.closest(".dict-term-card"))
        ) {
          return;
        }

        const text = el.textContent?.trim();
        if (!text || text.length < 2) return;

        const tag = el.tagName.toUpperCase();
        let tagLabel = "Bloco";
        if (tag.startsWith("H")) tagLabel = "Título";
        else if (tag === "TABLE") tagLabel = "Tabela";
        else if (tag === "PRE" || tag === "CODE") tagLabel = "Código";
        else if (tag === "BLOCKQUOTE") tagLabel = "Citação";
        else if (tag === "P") tagLabel = "Parágrafo";
        else if (tag === "LI") tagLabel = "Item";
        else if (
          el.classList.contains("dict-term-card") ||
          el.classList.contains("dict-term-row")
        )
          tagLabel = "Termo";
        else if (
          el.classList.contains("card") ||
          el.classList.contains("dash-card")
        )
          tagLabel = "Card";

        el.classList.add("ai-inspectable-block");
        el.setAttribute("data-ai-block-tag", tagLabel);
      });
    });
  }, []);

  const cleanseAndExtractText = (el: HTMLElement): string => {
    const tag = el.tagName.toUpperCase();

    if (tag === "TABLE" || el.querySelector("table")) {
      const table =
        tag === "TABLE" ? (el as HTMLTableElement) : el.querySelector("table")!;
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length > 0) {
        const tableLines: string[] = [];
        rows.forEach((r, idx) => {
          const cells = Array.from(r.querySelectorAll("th, td")).map(
            (c) => c.textContent?.trim().replace(/\|/g, "\\|") || "",
          );
          tableLines.push(`| ${cells.join(" | ")} |`);
          if (idx === 0) {
            tableLines.push(`| ${cells.map(() => "---").join(" | ")} |`);
          }
        });
        return tableLines.join("\n");
      }
    }

    if (tag === "PRE" || tag === "CODE") {
      return `\`\`\`\n${el.textContent?.trim() || ""}\n\`\`\``;
    }

    if (tag === "H1") return `# ${el.textContent?.trim() || ""}`;
    if (tag === "H2") return `## ${el.textContent?.trim() || ""}`;
    if (tag === "H3") return `### ${el.textContent?.trim() || ""}`;
    if (tag === "H4") return `#### ${el.textContent?.trim() || ""}`;
    if (tag === "LI") return `- ${el.textContent?.trim() || ""}`;

    const text = el.innerText || el.textContent || "";
    const clean = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");

    return clean;
  };

  const stopInspector = useCallback(() => {
    setIsInspectorActive(false);
    document.body.classList.remove("ai-inspecting-mode");
    document.querySelectorAll(".ai-inspectable-block").forEach((el) => {
      el.classList.remove("ai-inspectable-block");
      el.removeAttribute("data-ai-block-tag");
    });
  }, []);

  const startInspector = useCallback(() => {
    setIsInspectorActive(true);
    document.body.classList.add("ai-inspecting-mode");
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
      if (e.key === "Escape") {
        e.preventDefault();
        stopInspector();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest("#global-ai-pane") ||
        target.closest(".workbench-ai-pane") ||
        target.closest(".ai-copilot-prompt-sidebar") ||
        target.closest("#ai-inspector-toast-banner") ||
        target.closest(".pane-resizer") ||
        target.closest("#ai-settings-modal")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const blockEl =
        target.closest(".ai-inspectable-block") ||
        target.closest(
          "h1, h2, h3, h4, h5, h6, table, pre, code, blockquote, p, ul, ol, li, .notion-block, .card, .dict-term-card, .dict-term-row, section, article, .dash-card",
        ) ||
        target;

      const extracted = cleanseAndExtractText(blockEl as HTMLElement);
      if (extracted && extracted.trim()) {
        const snippetToInsert = extracted.trim();
        setInputText((prev) => {
          if (!prev.trim()) return snippetToInsert;
          return `${prev.trim()}\n\n${snippetToInsert}`;
        });

        setInspectorFlash("Trecho capturado e anexado ao chat! ✨");
        setTimeout(() => setInspectorFlash(null), 2500);

        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isInspectorActive, stopInspector]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("ai-inspecting-mode");
    };
  }, []);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const textToSend = inputText.trim();
    setInputText("");

    if (isInspectorActive) {
      stopInspector();
    }

    isUserScrolledUp.current = false;
    await sendMessage(textToSend);
    setTimeout(() => scrollToBottom("smooth"), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

  const handleQuickModelSelect = async (provider: string, modelId: string) => {
    setIsModelDropdownOpen(false);
    await quickSetModel(provider, modelId);
  };

  const activeModelDisplay =
    aiSettings?.model || aiSettings?.active_model || "gemini-2.5-flash";
  const activeProviderDisplay = aiSettings?.provider || "gemini";

  const defaultModelsByProvider = [
    {
      provider: "gemini",
      providerName: "Google Gemini",
      icon: "smart_toy",
      models: [
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          badge: "Recomendado",
        },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", badge: "Raciocínio" },
        {
          id: "gemini-3.5-flash-lite",
          name: "Gemini 3.5 Flash Lite",
          badge: "Super Rápido",
        },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", badge: "Leve" },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          badge: "Contexto Longo",
        },
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
        {
          id: "claude-3-7-sonnet",
          name: "Claude 3.7 Sonnet",
          badge: "Híbrido",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          badge: "Código",
        },
        {
          id: "claude-3-5-haiku-20241022",
          name: "Claude 3.5 Haiku",
          badge: "Rápido",
        },
      ],
    },
    {
      provider: "ollama",
      providerName: "Ollama (Local)",
      icon: "terminal",
      models: [
        { id: "llama3.3", name: "Llama 3.3 70B", badge: "Local" },
        { id: "llama3.2", name: "Llama 3.2", badge: "Leve" },
        { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", badge: "Código" },
        { id: "deepseek-r1", name: "DeepSeek R1", badge: "Local R1" },
      ],
    },
  ];

  const activeSkillObj = availableSkills.find((s) => s.id === activeSkillId);
  const activeSkillTitle =
    activeSkillObj?.title || activeSkillObj?.name || activeSkillId;

  return (
    <>
      {/* 1. Header: Quick Model Switcher, Novo Chat, RAW, History & Close */}
      <div
        className="ai-pane-header"
        style={{ position: "relative", overflow: "visible", zIndex: 30 }}
      >
        <div
          ref={modelDropdownRef}
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
          {/* Quick Model Selector Dropdown Trigger */}
          <button
            className="ai-copilot-agent-btn"
            type="button"
            title="Clique para abrir e alternar a lista de modelos de IA"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "16px",
              background: isModelDropdownOpen
                ? "var(--color-primary, #2563eb)"
                : "var(--color-surface-container, #f1f5f9)",
              color: isModelDropdownOpen
                ? "#ffffff"
                : "var(--color-on-surface, #0f172a)",
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
                color: isModelDropdownOpen
                  ? "#ffffff"
                  : "var(--color-primary, #2563eb)",
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
              {activeModelDisplay}
            </span>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "14px",
                transition: "transform 0.2s ease",
                transform: isModelDropdownOpen ? "rotate(180deg)" : "none",
              }}
            >
              expand_more
            </span>
          </button>

          {/* Quick Model Switcher Dropdown Popover */}
          {isModelDropdownOpen && (
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
                  borderBottom:
                    "1px solid var(--color-outline-variant, #e2e8f0)",
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
                  {activeProviderDisplay.toUpperCase()}
                </span>
              </div>

              {defaultModelsByProvider.map((grp) => (
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
                    const isSelected = activeModelDisplay === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          handleQuickModelSelect(grp.provider, m.id)
                        }
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
                    setIsModelDropdownOpen(false);
                    openSettingsModal();
                  }}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "var(--color-surface-container-high, #f8fafc)",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
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
                  Gerenciar Chaves & Provedores
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Action Icons - Harmonized Alignment & Sizing */}
        <div
          className="ai-copilot-header-right"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
          }}
        >
          {/* New Chat Session Button */}
          <button
            className="ai-copilot-new-chat-btn"
            title="Iniciar nova conversa (arquiva a anterior no histórico)"
            type="button"
            onClick={() => {
              newChatSession();
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "14px" }}
            >
              add_comment
            </span>
            <span>Novo Chat</span>
          </button>

          <button
            className="ai-copilot-raw-btn"
            title="Inspetor RAW (Ver Prompts, Memória e Payloads)"
            type="button"
            onClick={onOpenRaw}
            style={{
              height: "28px",
              padding: "4px 8px",
              borderRadius: "6px",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            RAW
          </button>
          <button
            className="btn-icon ai-copilot-history-btn"
            title="Linha de Raciocínio & Histórico de Sessões"
            type="button"
            onClick={onOpenHistory}
            style={{
              height: "28px",
              width: "28px",
              padding: 0,
              borderRadius: "6px",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined icon-sm">history</span>
          </button>
          <button
            className="btn-icon ai-copilot-close-btn"
            title="Recolher Assistente"
            type="button"
            onClick={onClose}
            style={{
              height: "28px",
              width: "28px",
              padding: 0,
              borderRadius: "6px",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      {/* Mode & Skill Toolbar - Interactive Activation / Deactivation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "var(--color-surface-container-low, #f8f9fa)",
          borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
          fontSize: "11px",
          position: "relative",
          zIndex: 25,
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            position: "relative",
          }}
        >
          {/* Harness / RAW Toggle */}
          <button
            type="button"
            onClick={() => setIsRawMode(!isRawMode)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "10.5px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              background: isRawMode
                ? "var(--color-warning-container, #fef7e0)"
                : "var(--color-surface-container, #f1f3f4)",
              color: isRawMode
                ? "var(--color-warning, #b45309)"
                : "var(--text-muted, #64748b)",
              borderColor: isRawMode
                ? "var(--color-warning, #d97706)"
                : "var(--color-outline-variant, #cbd5e1)",
              transition: "all 0.15s ease",
            }}
            title={
              isRawMode
                ? "Modo RAW Ativo: Chamada direta sem ferramentas"
                : "Modo Agente Ativo: Com ferramentas e raciocínio multi-passos"
            }
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px" }}
            >
              {isRawMode ? "bolt" : "psychology"}
            </span>
            {isRawMode ? "RAW" : "Harness"}
          </button>

          {/* Skill Activator / Deactivator / Selector */}
          {!isRawMode && (
            <div ref={skillsDropdownRef} style={{ position: "relative" }}>
              {activeSkillId ? (
                /* Skill is ACTIVE: Pill with Dropdown trigger and instant [X] Deactivate button */
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "12px",
                    background: "var(--color-primary-container, #d2e3fc)",
                    border: "1px solid var(--color-primary, #1a73e8)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setIsSkillsDropdownOpen(!isSkillsDropdownOpen)
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 6px 3px 8px",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-on-primary-container, #041e49)",
                      fontSize: "10.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Skill ativa no Copilot. Clique para alternar ou gerenciar."
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "13px",
                        color: "var(--color-primary, #1a73e8)",
                      }}
                    >
                      auto_awesome
                    </span>
                    <span
                      style={{
                        maxWidth: "120px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeSkillTitle}
                    </span>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "12px", opacity: 0.7 }}
                    >
                      expand_more
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSkillId(null);
                    }}
                    title="Desativar esta Skill (Executar Copilot padrão sem Skill)"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2px 6px",
                      border: "none",
                      borderLeft: "1px solid rgba(26,115,232,0.3)",
                      background: "rgba(255,255,255,0.4)",
                      color: "var(--color-on-primary-container, #041e49)",
                      cursor: "pointer",
                      height: "100%",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(239,68,68,0.15)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.4)")
                    }
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "12px" }}
                    >
                      close
                    </span>
                  </button>
                </div>
              ) : (
                /* Skills are DEACTIVATED: Neutral Pill to Activate */
                <button
                  type="button"
                  onClick={() => setIsSkillsDropdownOpen(!isSkillsDropdownOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "12px",
                    fontSize: "10.5px",
                    fontWeight: 500,
                    cursor: "pointer",
                    background: "var(--color-surface-container, #f1f5f9)",
                    color: "var(--color-outline, #64748b)",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    transition: "all 0.15s ease",
                  }}
                  title="Nenhuma Skill ativa no momento. Clique para ativar uma Skill especializada."
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "13px", color: "#94a3b8" }}
                  >
                    do_not_disturb_on
                  </span>
                  <span>Skills: Desativadas</span>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "12px", opacity: 0.7 }}
                  >
                    expand_more
                  </span>
                </button>
              )}

              {/* Skills Popover Menu */}
              {isSkillsDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 1100,
                    width: "290px",
                    background: "var(--color-surface, #ffffff)",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    borderRadius: "10px",
                    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.18)",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "360px",
                    overflowY: "auto",
                    animation: "fadeIn 0.12s ease-out",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "3px 6px 6px 6px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    <span>Ativar / Desativar Skills</span>
                    <span
                      style={{
                        fontSize: "9.5px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: activeSkillId
                          ? "rgba(16,185,129,0.12)"
                          : "#f1f5f9",
                        color: activeSkillId ? "#059669" : "#64748b",
                        fontWeight: 700,
                      }}
                    >
                      {activeSkillId ? "ATIVA" : "DESATIVADA"}
                    </span>
                  </div>

                  {/* Option: Deactivate all skills */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSkillId(null);
                      setIsSkillsDropdownOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: !activeSkillId
                        ? "1px solid #94a3b8"
                        : "1px solid transparent",
                      background: !activeSkillId ? "#f8fafc" : "transparent",
                      color: !activeSkillId ? "#0f172a" : "#64748b",
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
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "14px",
                          color: !activeSkillId ? "#2563eb" : "#94a3b8",
                        }}
                      >
                        {!activeSkillId
                          ? "radio_button_checked"
                          : "radio_button_unchecked"}
                      </span>
                      <span style={{ fontWeight: !activeSkillId ? 600 : 400 }}>
                        Desativar Skills (Copilot Padrão)
                      </span>
                    </div>
                  </button>

                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      padding: "4px 6px 2px",
                    }}
                  >
                    Skills Disponíveis
                  </div>

                  {/* List of Skills */}
                  {availableSkills.map((skill) => {
                    const isSelected = activeSkillId === skill.id;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          setActiveSkillId(skill.id);
                          setIsSkillsDropdownOpen(false);
                        }}
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
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              overflow: "hidden",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: isSelected ? 600 : 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {skill.title || skill.name || skill.id}
                            </span>
                            {skill.description && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#64748b",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {skill.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsSkillsDropdownOpen(false);
                        openSkillsModal();
                      }}
                      style={{
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        background:
                          "var(--color-surface-container-high, #f8fafc)",
                        border:
                          "1px solid var(--color-outline-variant, #cbd5e1)",
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
                        hub
                      </span>
                      Explorar Hub de Skills...
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenPrompt}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-primary, #1a73e8)",
            cursor: "pointer",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
          }}
          title="Ver e ajustar prompts do documento e template"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px" }}
          >
            tune
          </span>
          Prompts
        </button>
      </div>

      {/* 2. Interactive Document References & Global Scope Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "5px",
          padding: "6px 12px",
          background: "var(--color-surface, #ffffff)",
          borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
          position: "relative",
        }}
      >
        {/* Context Attachment Clip Icon with Dynamic Status Color & Tooltip */}
        <button
          type="button"
          onClick={() => setIsContextModalOpen(true)}
          style={{
            background: "none",
            border: "none",
            padding: "2px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: "4px",
            transition: "all 0.15s ease",
          }}
          title={
            referencedDocs.length > 0 && !isGlobalScope
              ? `Contexto Ativo: ${referencedDocs.length} ${
                  referencedDocs.length === 1 ? "item" : "itens"
                } vinculado${
                  referencedDocs.length === 1 ? "" : "s"
                } ao Copilot. Clique para gerenciar.`
              : isTemplateEditorMode
                ? `Modo Template Ativo: ${templateTitle || "Novo"}`
                : "Nenhum contexto vinculado (Modo Global). Clique para anexar pastas ou arquivos."
          }
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "16px",
              color:
                (referencedDocs.length > 0 && !isGlobalScope) ||
                isTemplateEditorMode
                  ? "var(--color-primary, #2563eb)"
                  : "var(--text-muted, #94a3b8)",
              transition: "color 0.15s ease",
            }}
          >
            attachment
          </span>
        </button>

        {/* Global Scope Mode Badge */}
        {(isGlobalScope || referencedDocs.length === 0) &&
        !isTemplateEditorMode ? (
          <></>
        ) : isTemplateEditorMode ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "12px",
              background: "var(--color-tertiary-container, #fae8ff)",
              border: "1px solid var(--color-tertiary, #a855f7)",
              fontSize: "10.5px",
              color: "var(--color-on-tertiary-container, #581c87)",
              fontWeight: 600,
            }}
          >
            <span>🛠️ Modo Template: {templateTitle || "Novo"}</span>
          </div>
        ) : (
          /* Multi-Document & Folder Attached Chips */
          referencedDocs.map((docPath) => {
            // Check if this path represents a directory in tree
            const isDir = tree.some((n) => {
              const check = (node: TreeNode): boolean => {
                if (node.path === docPath)
                  return (
                    node.type === "dir" ||
                    node.type === "directory" ||
                    Boolean(node.is_directory)
                  );
                if (node.children) return node.children.some(check);
                return false;
              };
              return check(n);
            });
            const label = docPath.split("/").pop() || docPath;

            return (
              <div
                key={docPath}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px 2px 8px",
                  borderRadius: "12px",
                  background: isDir
                    ? "var(--color-tertiary-container, #f3e8ff)"
                    : "var(--color-primary-container, #eff6ff)",
                  border: isDir
                    ? "1px solid var(--color-tertiary, #c084fc)"
                    : "1px solid var(--color-primary, #3b82f6)",
                  fontSize: "10.5px",
                  color: isDir
                    ? "#6b21a8"
                    : "var(--color-on-primary-container, #1e40af)",
                  fontWeight: 500,
                  maxWidth: "180px",
                }}
                title={isDir ? `Pasta: ${docPath}` : `Arquivo: ${docPath}`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "12px",
                    color: isDir ? "#9333ea" : "var(--color-primary, #2563eb)",
                  }}
                >
                  {isDir ? "folder" : "description"}
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                  {isDir ? "/" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeReferencedDoc(docPath)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                    color: isDir ? "#6b21a8" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Remover referência deste item"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "12px" }}
                  >
                    close
                  </span>
                </button>
              </div>
            );
          })
        )}

        {/* Action: Open Advanced Context Selector Modal */}
        {!isTemplateEditorMode && (
          <button
            type="button"
            onClick={() => setIsContextModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 7px",
              borderRadius: "12px",
              background: "transparent",
              border: "1px dashed var(--color-outline-variant, #94a3b8)",
              color: "var(--color-primary, #2563eb)",
              fontSize: "10.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Abrir Seletor de Contexto (múltiplos arquivos ou pastas inteiras)"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px" }}
            >
              add
            </span>
            {referencedDocs.length === 0 ? "Anexar Contexto" : "Gerenciar"}
          </button>
        )}

        {/* Action: Switch to Global Scope Button if has references */}
        {referencedDocs.length > 0 && !isTemplateEditorMode && (
          <button
            type="button"
            onClick={() => setIsGlobalScope(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              padding: "2px 6px",
              borderRadius: "12px",
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #64748b)",
              fontSize: "10px",
              cursor: "pointer",
              marginLeft: "auto",
            }}
            title="Remover todas as referências e usar Modo Global"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "14px", color: "var(--danger-text)" }}
            >
              close
            </span>
          </button>
        )}
      </div>

      {/* 3. Scrollable Message History Stream with Robust Scroll Management */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        className="ai-messages-scroll ai-copilot-messages-container"
        style={{ position: "relative" }}
      >
        {/* Interactive Prompt Context Controls Bar */}
        {(templatePrompt || docPrompt) && !isTemplateEditorMode && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              marginBottom: "10px",
              borderRadius: "10px",
              background: "var(--color-surface-container)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "2px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--color-on-surface-variant)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "14px", color: "var(--color-primary)" }}
                >
                  tune
                </span>
                Prompts em Contexto:
              </span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                Ative ou desative para perguntas gerais
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {/* Template Prompt Toggle */}
              {templatePrompt && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <button
                    type="button"
                    onClick={toggleTemplatePrompt}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      borderRadius: "14px",
                      border: "1px solid",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: isTemplatePromptEnabled
                        ? "#10b981"
                        : "var(--bg-hover, #f1f5f9)",
                      color: isTemplatePromptEnabled
                        ? "#ffffff"
                        : "var(--text-muted, #64748b)",
                      borderColor: isTemplatePromptEnabled
                        ? "#059669"
                        : "var(--border-color, #cbd5e1)",
                      boxShadow: isTemplatePromptEnabled
                        ? "0 1px 4px rgba(16, 185, 129, 0.35)"
                        : "none",
                      maxWidth: "200px",
                      transition: "all 0.15s ease",
                    }}
                    title={
                      isTemplatePromptEnabled
                        ? `Template: ${templateTitle || "Template"} (Ativo no Copilot. Clique para desativar)`
                        : `Template: ${templateTitle || "Template"} (Desativado. Clique para ativar)`
                    }
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "14px", flexShrink: 0 }}
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
                        display: "inline-block",
                      }}
                    >
                      Template: {templateTitle || "Template"}
                    </span>
                  </button>
                </div>
              )}

              {/* Doc Prompt Toggle */}
              {docPrompt && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <button
                    type="button"
                    onClick={toggleDocPrompt}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      borderRadius: "14px",
                      border: "1px solid",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: isDocPromptEnabled
                        ? "#2563eb"
                        : "var(--bg-hover, #f1f5f9)",
                      color: isDocPromptEnabled
                        ? "#ffffff"
                        : "var(--text-muted, #64748b)",
                      borderColor: isDocPromptEnabled
                        ? "#1d4ed8"
                        : "var(--border-color, #cbd5e1)",
                      boxShadow: isDocPromptEnabled
                        ? "0 1px 4px rgba(37, 99, 235, 0.35)"
                        : "none",
                      maxWidth: "180px",
                      transition: "all 0.15s ease",
                    }}
                    title={
                      isDocPromptEnabled
                        ? "Prompt do Documento (Ativo no Copilot. Clique para desativar)"
                        : "Prompt do Documento (Desativado. Clique para ativar)"
                    }
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "14px", flexShrink: 0 }}
                    >
                      {isDocPromptEnabled
                        ? "check_circle"
                        : "radio_button_unchecked"}
                    </span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                    >
                      Prompt do Doc
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Default Welcome Message */}
        <div className="chat-bubble ai">
          <div className="chat-bubble-sender">
            <span className="material-symbols-outlined icon-xs">smart_toy</span>
            <strong>Agent</strong>
          </div>
          <div className="ai-reply-content">
            <p style={{ margin: 0 }}>
              {isTemplateEditorMode
                ? "🛠️ Modo Criador de Templates Ativo (ai_template_prompt). Posso sugerir seções, formatar placeholders {{CAMPO}} e redigir o prompt do Copilot para este template. Como posso ajudar?"
                : isGlobalScope || referencedDocs.length === 0
                  ? "🌐 Operando em Modo Global. Posso responder sobre todo o repositório, cruzar arquivos ou criar novas especificações. Para focar em um arquivo específico, anexe-o na barra acima!"
                  : `Pareando com você em ${referencedDocs.length > 1 ? `${referencedDocs.length} documentos` : referencedDocs[0]}. Pergunte, solicite refatorações ou use o alvo (🎯) para capturar trechos da tela!`}
            </p>
          </div>
        </div>

        {/* Dynamic Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender === "user" ? "user" : "ai"}`}
          >
            <div className="chat-bubble-sender">
              <span className="material-symbols-outlined icon-xs">
                {msg.sender === "user" ? "account_circle" : "smart_toy"}
              </span>
              <strong>{msg.sender === "user" ? "Você" : "Agent"}</strong>
              {msg.timestamp && (
                <span className="chat-bubble-time">{msg.timestamp}</span>
              )}
            </div>

            <div
              className={
                msg.sender === "user"
                  ? "user-reply-content"
                  : "ai-reply-content"
              }
              dangerouslySetInnerHTML={{
                __html: marked.parse(msg.content) as string,
              }}
            />

            {/* Tool Execution Timeline */}
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div
                style={{
                  margin: "8px 0",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "var(--color-surface-container-high, #0f172a)",
                  border: "1px solid var(--color-outline-variant, #334155)",
                  fontSize: "11px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    color: "#818cf8",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    build
                  </span>
                  Ações do Agente ({msg.tool_calls.length} ferramentas):
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {msg.tool_calls.map((tc, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "3px 6px",
                        background: "var(--color-surface-container, #020617)",
                        borderRadius: "4px",
                        border:
                          "1px solid var(--color-outline-variant, #1e293b)",
                        fontFamily: "monospace",
                        fontSize: "10px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--color-on-surface, #e2e8f0)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            color: tc.result?.success ? "#34d399" : "#f87171",
                          }}
                        >
                          ●
                        </span>
                        {tc.tool}
                      </span>
                      <span
                        style={{
                          color: tc.result?.success ? "#34d399" : "#f87171",
                        }}
                      >
                        {tc.result?.success ? "OK" : "Erro"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed Patch / Diff Review Card */}
            {msg.diff && msg.diff.new_content && (
              <div
                style={{
                  margin: "8px 0",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#a5b4fc",
                    fontWeight: 600,
                    fontSize: "12px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    difference
                  </span>
                  Proposta de Alteração: {msg.diff.path}
                </div>
                {msg.diff.rationale && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#cbd5e1",
                      fontStyle: "italic",
                      marginBottom: "8px",
                    }}
                  >
                    "{msg.diff.rationale}"
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  style={{
                    width: "100%",
                    padding: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "6px",
                  }}
                  onClick={() => handleApplyToDoc(msg.diff!.new_content)}
                >
                  ✅ Aceitar e Aplicar Alteração no Documento
                </button>
              </div>
            )}

            {msg.sender === "assistant" && (
              <div
                className="ai-bubble-actions"
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  style={{ fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => copyToClipboard(msg.content)}
                  title="Copiar resposta"
                >
                  📋 Copiar
                </button>
                {onInsertAtCursor && (
                  <button
                    className="btn btn-ghost btn-xs"
                    type="button"
                    style={{ fontSize: "11px", padding: "2px 6px" }}
                    onClick={() => onInsertAtCursor(msg.content)}
                    title="Inserir no cursor"
                  >
                    ✏️ Inserir
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  style={{ fontSize: "11px", padding: "2px 6px" }}
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
              <span className="material-symbols-outlined icon-xs">
                smart_toy
              </span>
              <strong>Agent</strong>
            </div>
            <div
              className="ai-reply-content"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span className="dot pulse"></span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Raciocinando na especificação...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={() => {
            isUserScrolledUp.current = false;
            scrollToBottom("smooth");
          }}
          style={{
            position: "absolute",
            bottom: "85px",
            right: "20px",
            zIndex: 40,
            background: "var(--color-primary, #2563eb)",
            color: "#ffffff",
            border: "none",
            borderRadius: "20px",
            padding: "5px 12px",
            fontSize: "11px",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "15px" }}
          >
            arrow_downward
          </span>
          Última mensagem
        </button>
      )}

      {/* 4. Floating Inspector Banner */}
      {isInspectorActive && (
        <div id="ai-inspector-toast-banner">
          <span
            className="material-symbols-outlined"
            style={{ color: "#60a5fa", fontSize: "18px" }}
          >
            ads_click
          </span>
          <span>
            Modo Alvo Ativo: Clique nos blocos da tela para adicionar ao chat
          </span>
          <span
            className="ai-kbd-badge"
            onClick={stopInspector}
            title="Finalizar modo de seleção"
          >
            ESC
          </span>
        </div>
      )}

      {/* 5. Full-Width Prompt Container */}
      <form className="ai-copilot-input-container" onSubmit={handleSend}>
        {inspectorFlash && (
          <div className="ai-inspector-mini-toast">{inspectorFlash}</div>
        )}

        <textarea
          ref={textareaRef}
          className="ai-copilot-textarea"
          placeholder="Mensagem para o Agente... (Shift+Enter para nova linha)"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className="ai-input-bottom-bar">
          <button
            className={`ai-target-btn ${isInspectorActive ? "active" : ""}`}
            type="button"
            onClick={toggleInspector}
            title={
              isInspectorActive
                ? "Desativar seleção de blocos (ESC)"
                : "Alvo: Selecionar trechos na tela para colar no chat"
            }
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "17px" }}
            >
              ads_click
            </span>
            <span className="ai-target-label">
              {isInspectorActive ? "Alvo Ativo" : "Capturar"}
            </span>
          </button>

          <div className="ai-input-actions-right">
            <span className="ai-input-hint">Enter ↵</span>
            <button
              className="ai-send-icon-btn"
              type="submit"
              disabled={!inputText.trim() || isThinking}
              title="Enviar mensagem (Enter)"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "18px" }}
              >
                arrow_upward
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Skills Hub Modal */}
      <SkillsHubModal
        isOpen={isSkillsModalOpen}
        onClose={closeSkillsModal}
        activeRepo={activeRepo?.name}
        onSkillSelect={(skill) => {
          setActiveSkillId(skill.id);
          closeSkillsModal();
        }}
      />

      {/* Context Selector Modal (Files & Folders Multi-Selection) */}
      <ContextSelectorModal
        isOpen={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
      />
    </>
  );
};

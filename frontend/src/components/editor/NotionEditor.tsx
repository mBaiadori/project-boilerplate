import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Plus, FolderTree } from "lucide-react";
import { parseFrontmatter, serializeFrontmatter } from "../../services/frontmatter";
import {
  NotionEditorEngine,
  type FragmentStatusInfo,
} from "./notion-editor-engine";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { VisualMarkdownDiff } from "./VisualMarkdownDiff";
import { DocumentHistoryDrawer } from "./DocumentHistoryDrawer";
import { DocConnectivityBar } from "./DocConnectivityBar";
import { InsertLinkModal } from "../modals/InsertLinkModal";
import type { GitCommitInfo, DocumentMetadataItem } from "../../types";

interface NotionEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  promptContent?: string;
  onPromptChange?: (newPrompt: string) => void;
  filePath: string | null;
  onNavigateFile?: (path: string) => void;
  onReload?: () => void;
  onOpenDiffModal?: () => void;
  onToggleCopilot?: () => void;
  onOpenScaffoldWizard?: () => void;
  onSendSelectionToCopilot?: (text: string) => void;
  isTemplateMode?: boolean;
  onCustomSave?: () => Promise<{ success: boolean; message?: string } | void>;
  customSaveStatus?: string;
  customTitle?: string;
  onCustomTitleChange?: (title: string) => void;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  content,
  onChange,
  promptContent,
  onPromptChange,
  filePath,
  onNavigateFile,
  onReload = () => {},
  onOpenDiffModal,
  onToggleCopilot: _onToggleCopilot,
  onOpenScaffoldWizard,
  onSendSelectionToCopilot,
  isTemplateMode = false,
  onCustomSave,
  customSaveStatus,
  customTitle,
  onCustomTitleChange,
}) => {
  const {
    originalContent,
    refreshPendingChanges,
    refreshGitStatus,
    activeRepo,
    saveStatus,
    saveCurrentFile,
    fileMetadata,
    updateDocumentTitle,
    updateFileMetadata,
  } = useWorkspace();
  const [editorTab, setEditorTab] = useState<"document" | "prompt">("document");
  const [isGeneratingPromptAI, setIsGeneratingPromptAI] = useState(false);
  const [promptAIFeedback, setPromptAIFeedback] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [titleValue, setTitleValue] = useState<string>("");

  // Git Mode, Visual Diff & Document History Drawer State
  const [isGitMode, setIsGitMode] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(
    null,
  );
  const [historicalContent, setHistoricalContent] = useState<string>("");
  const [blameData, setBlameData] = useState<any[]>([]);
  const [docMetadata, setDocMetadata] = useState<DocumentMetadataItem | null>(
    null,
  );
  const [editorToast, setEditorToast] = useState<{
    text: string;
    type: "info" | "success" | "warning";
  } | null>(null);
  const [fragmentAlert, setFragmentAlert] = useState<FragmentStatusInfo | null>(
    null,
  );
  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Link Insertion Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkModalInitialText, setLinkModalInitialText] = useState("");
  const [linkModalInitialUrl, setLinkModalInitialUrl] = useState("");
  const linkModalCallbackRef = useRef<
    ((url: string, text: string) => void) | null
  >(null);

  const handleOpenLinkModal = useCallback(
    (
      defaultText: string,
      callback: (url: string, text: string) => void,
      initialUrl: string = "",
    ) => {
      setLinkModalInitialText(defaultText || "");
      setLinkModalInitialUrl(initialUrl || "");
      linkModalCallbackRef.current = callback;
      setIsLinkModalOpen(true);
    },
    [],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NotionEditorEngine | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isInternalChangeRef = useRef(false);

  const parsed = parseFrontmatter(content || "");
  const docBody = parsed.body || content || "";
  const effectivePrompt =
    promptContent !== undefined
      ? promptContent
      : fileMetadata?.prompt || "";

  const editorTabRef = useRef(editorTab);
  editorTabRef.current = editorTab;

  const docBodyRef = useRef(docBody);
  docBodyRef.current = docBody;

  const effectivePromptRef = useRef(effectivePrompt);
  effectivePromptRef.current = effectivePrompt;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onPromptChangeRef = useRef(onPromptChange);
  onPromptChangeRef.current = onPromptChange;

  const updateFileMetadataRef = useRef(updateFileMetadata);
  updateFileMetadataRef.current = updateFileMetadata;

  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  const handleSwitchTab = (newTab: "document" | "prompt") => {
    if (newTab === editorTab) return;

    // Flush current editor content before switching
    if (engineRef.current) {
      const currentMd = engineRef.current.getMarkdown();
      if (editorTab === "document") {
        const newContent = parsedRef.current.hasFrontmatter
          ? serializeFrontmatter(parsedRef.current.metadata, currentMd)
          : currentMd;
        onChangeRef.current(newContent);
        docBodyRef.current = currentMd;
      } else {
        if (onPromptChangeRef.current) {
          onPromptChangeRef.current(currentMd);
        } else {
          updateFileMetadataRef.current({ prompt: currentMd });
        }
        effectivePromptRef.current = currentMd;
      }
    }

    setEditorTab(newTab);
    editorTabRef.current = newTab;
    const targetText = newTab === "document" ? docBodyRef.current : effectivePromptRef.current;
    if (engineRef.current) {
      isInternalChangeRef.current = true;
      engineRef.current.setMarkdown(targetText);
    }
  };

  const handleInsertPlaceholder = (token: string) => {
    if (engineRef.current) {
      const current = engineRef.current.getMarkdown();
      const addition = `\n- **Placeholder:** \`${token}\` — orientar o preenchimento detalhado deste campo.`;
      const updated = current ? `${current.trim()}${addition}` : addition.trim();
      isInternalChangeRef.current = true;
      engineRef.current.setMarkdown(updated);
      if (editorTabRef.current === "prompt") {
        if (onPromptChangeRef.current) onPromptChangeRef.current(updated);
        else updateFileMetadataRef.current({ prompt: updated });
        effectivePromptRef.current = updated;
      }
      setEditorToast({ text: `Tag ${token} adicionada ao prompt!`, type: "info" });
      setTimeout(() => setEditorToast(null), 2500);
    }
  };

  const handleOptimizePromptWithAI = async () => {
    setIsGeneratingPromptAI(true);
    setPromptAIFeedback("");
    try {
      const targetDocTitle = titleValue || fileMetadata?.title || filePath || "Documento";
      const res = await API.askAI({
        prompt: `Você é o Arquiteto de Software Líder. Escreva instruções ricas (system prompt) em Markdown para o Copilot auxiliar no desenvolvimento e refinamento do ${isTemplateMode ? "Template" : "Documento"}: "${targetDocTitle}".
Inclua:
## 🎯 Papel & Persona
## 📋 Regras de Validação & Boas Práticas
## 💡 Pontos de Atenção & Trade-offs
Mantenha um tom técnico, rigoroso e direto.`,
        history: [],
      });

      if (res.ok && res.data) {
        const raw = res.data.response || res.data.reply || res.data.content || "";
        if (raw && engineRef.current) {
          isInternalChangeRef.current = true;
          engineRef.current.setMarkdown(raw);
          if (onPromptChangeRef.current) onPromptChangeRef.current(raw);
          else updateFileMetadataRef.current({ prompt: raw });
          effectivePromptRef.current = raw;
          setPromptAIFeedback("Prompt gerado com sucesso!");
          setTimeout(() => setPromptAIFeedback(""), 3000);
        }
      }
    } catch (err) {
      console.error("[NotionEditor] Erro ao otimizar prompt:", err);
      setPromptAIFeedback("Erro ao gerar com IA.");
    } finally {
      setIsGeneratingPromptAI(false);
    }
  };

  // Auto-resize title textarea to fit content organically like a heading
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = "auto";
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [titleValue]);

  // Toast de alerta caso ocorra falha de salvamento
  useEffect(() => {
    if (saveStatus === "Erro") {
      setEditorToast({
        text: "Não foi possível gravar no disco. Rascunho temporário mantido na sessão.",
        type: "warning",
      });
      setTimeout(() => setEditorToast(null), 5000);
    }
  }, [saveStatus]);

  // Load document metadata and blame when file changes or git mode is opened
  useEffect(() => {
    if (!filePath) return;

    // Load metadata
    API.getProjectMetadata(activeRepo?.name)
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) {
          const found = res.data.find(
            (d) =>
              d.path === filePath ||
              d.path.replace(/^\/+/, "") === filePath.replace(/^\/+/, ""),
          );
          if (found) setDocMetadata(found);
        }
      })
      .catch(() => {});

    // Reset commit selection when switching file
    setSelectedCommit(null);
    setHistoricalContent("");
    setFragmentAlert(null);
  }, [filePath, activeRepo]);

  // Sincronizar o título local com os metadados do documento ou customTitle
  useEffect(() => {
    if (isTemplateMode) {
      if (customTitle !== undefined) {
        setTitleValue(customTitle);
      }
      return;
    }
    const metaTitle =
      fileMetadata?.title !== undefined
        ? fileMetadata.title
        : docMetadata?.title || "";
    setTitleValue(metaTitle);
  }, [fileMetadata?.title, docMetadata?.title, filePath, isTemplateMode, customTitle]);

  const handleTitleChange = (newVal: string) => {
    setTitleValue(newVal);
    if (isTemplateMode) {
      if (onCustomTitleChange) onCustomTitleChange(newVal);
      return;
    }
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current);
    }
    titleDebounceTimerRef.current = setTimeout(() => {
      updateDocumentTitle(newVal);
    }, 400);
  };

  // Load Blame info when entering Git / Audit Mode
  useEffect(() => {
    if (isGitMode && filePath) {
      API.getFileBlame(filePath)
        .then((res) => {
          if (res.ok && res.data?.blame) {
            setBlameData(res.data.blame);
          }
        })
        .catch(() => {});
    }
  }, [isGitMode, filePath]);

  // Load Historical Content when selecting a past commit
  useEffect(() => {
    if (!selectedCommit || !filePath) {
      setHistoricalContent("");
      return;
    }

    API.getFileVersion(filePath, selectedCommit.hash)
      .then((res) => {
        if (res.ok && res.data?.success) {
          setHistoricalContent(res.data.content);
        }
      })
      .catch((err) => {
        console.error("[NotionEditor] Erro ao carregar versão do commit:", err);
      });
  }, [selectedCommit, filePath]);

  // Manual save trigger (Ctrl+S ou clique) que faz o flush imediato
  const handleSave = useCallback(async () => {
    if (onCustomSave) {
      const res = await onCustomSave();
      if ((res as any)?.success !== false) {
        setEditorToast({
          text: (res as any)?.message || "Template salvo com sucesso!",
          type: "success",
        });
        setTimeout(() => setEditorToast(null), 2500);
      }
      return;
    }
    if (!filePath) return;
    const res = await saveCurrentFile();
    if (res?.success) {
      setEditorToast({
        text: "Alterações gravadas no disco!",
        type: "success",
      });
      setTimeout(() => setEditorToast(null), 2500);
    }
  }, [filePath, saveCurrentFile, onCustomSave]);

  // Initialize & Mount NotionEditorEngine
  useEffect(() => {
    if (!canvasRef.current || isGitMode) return;

    const engine = new NotionEditorEngine({
      canvasElement: canvasRef.current,
      filePath: filePath,
      onNavigateFile: onNavigateFile,
      onChange: () => {
        if (!engineRef.current) return;
        const currentMd = engineRef.current.getMarkdown();
        isInternalChangeRef.current = true;
        if (editorTabRef.current === "document") {
          docBodyRef.current = currentMd;
          const newContent = parsedRef.current.hasFrontmatter
            ? serializeFrontmatter(parsedRef.current.metadata, currentMd)
            : currentMd;
          onChangeRef.current(newContent);
        } else {
          effectivePromptRef.current = currentMd;
          if (onPromptChangeRef.current) {
            onPromptChangeRef.current(currentMd);
          } else {
            updateFileMetadataRef.current({ prompt: currentMd });
          }
        }
      },
      onSave: () => {
        handleSave();
      },
      onSendSelectionToCopilot: (text) => {
        if (onSendSelectionToCopilot) {
          onSendSelectionToCopilot(text);
        }
      },
      onToast: (msg, type) => {
        setEditorToast({ text: msg, type: type || "info" });
        setTimeout(() => setEditorToast(null), 3800);
      },
      onOpenLinkModal: handleOpenLinkModal,
      onFragmentStatus: (status) => {
        setFragmentAlert(status);
      },
    });

    engineRef.current = engine;
    const initialText = editorTab === "document" ? docBody : effectivePrompt;
    engine.setMarkdown(initialText);

    const hash = window.location.hash;
    if (hash && hash.includes(":~:text=")) {
      setTimeout(() => {
        engine.scrollToFragment(hash);
      }, 250);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [isGitMode]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.filePath = filePath;
      const targetText = editorTab === "document" ? docBody : effectivePrompt;
      isInternalChangeRef.current = false;
      engineRef.current.setMarkdown(targetText);
      const hash = window.location.hash;
      if (hash && hash.includes(":~:text=")) {
        setTimeout(() => {
          engineRef.current?.scrollToFragment(hash);
        }, 250);
      }
    }
  }, [filePath]);

  // Listeners para navegação e atualização de fragmentos de texto (Deep Linking)
  useEffect(() => {
    const handleFragmentNav = (e: any) => {
      const targetHash = e.detail?.hash || window.location.hash;
      if (
        targetHash &&
        (targetHash.includes(":~:text=") || targetHash.startsWith("#"))
      ) {
        setTimeout(() => {
          engineRef.current?.scrollToFragment(targetHash);
        }, 80);
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && (hash.includes(":~:text=") || hash.startsWith("#"))) {
        setTimeout(() => {
          engineRef.current?.scrollToFragment(hash);
        }, 80);
      }
    };

    window.addEventListener("workspace:navigate-fragment", handleFragmentNav);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener(
        "workspace:navigate-fragment",
        handleFragmentNav,
      );
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Sync external content changes into the editor canvas
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (engineRef.current) {
      const currentEngineMd = engineRef.current.getMarkdown();
      const targetText = editorTab === "document" ? docBody : effectivePrompt;
      if (currentEngineMd !== targetText) {
        engineRef.current.setMarkdown(targetText);
        const hash = window.location.hash;
        if (hash && (hash.includes(":~:text=") || hash.startsWith("#"))) {
          setTimeout(() => {
            engineRef.current?.scrollToFragment(hash);
          }, 120);
        }
      }
    }
  }, [docBody, effectivePrompt, editorTab]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Listener para erros de abertura de documentos inexistentes no workspace
  useEffect(() => {
    const handleFileLoadError = (e: any) => {
      const msg =
        e.detail?.message ||
        "Documento referenciado não foi encontrado no workspace.";
      setEditorToast({ text: msg, type: "warning" });
      setTimeout(() => setEditorToast(null), 4500);
    };
    window.addEventListener("workspace:file-load-error", handleFileLoadError);
    return () =>
      window.removeEventListener(
        "workspace:file-load-error",
        handleFileLoadError,
      );
  }, []);

  const handleCopyPath = () => {
    if (filePath) {
      navigator.clipboard.writeText(filePath);
    }
  };

  const handleRevealInTree = useCallback(() => {
    if (!filePath) return;
    window.dispatchEvent(
      new CustomEvent("spec:reveal-in-tree", { detail: { path: filePath } }),
    );
  }, [filePath]);

  const handleCopyFullDoc = () => {
    navigator.clipboard.writeText(content);
  };

  const handleExportMarkdown = () => {
    const filename = (filePath || "document").split("/").pop() || "document.md";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmPasteImport = () => {
    if (importText.trim()) {
      onChange(importText);
      setIsImportModalOpen(false);
      setImportText("");
    }
  };

  const handleRestoreHistoricalVersion = async () => {
    if (!historicalContent) return;
    if (
      window.confirm(
        `Deseja restaurar o documento para a Versão #${selectedCommit?.shortHash || selectedCommit?.hash.slice(0, 7) || "selecionada"} (${selectedCommit?.message || ""})?`,
      )
    ) {
      onChange(historicalContent);
      setIsGitMode(false);
      setSelectedCommit(null);
      await API.saveProjectFile({
        path: filePath!,
        content: historicalContent,
      });
      await refreshPendingChanges();
      await refreshGitStatus();
    }
  };

  const currentContent = editorTab === "document" ? docBody : effectivePrompt;
  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0;
  const lineCount = currentContent ? currentContent.split(/\r?\n/).length : 0;
  const originalBody =
    parseFrontmatter(originalContent || "").body || originalContent || "";
  const isDirty = (originalBody || "").trim() !== (docBody || "").trim();

  if (!filePath) {
    return (
      <div id="editor-empty-state" className="editor-empty-state">
        <div className="editor-empty-state-card">
          <div className="empty-icon-circle">
            <FileText size={32} color="var(--primary, #2563eb)" />
          </div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-heading, #0f172a)",
              margin: "14px 0 6px",
            }}
          >
            Nenhum Documento Selecionado
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted, #64748b)",
              margin: "0 0 22px",
              lineHeight: 1.5,
              maxWidth: "380px",
            }}
          >
            Selecione uma especificação na árvore lateral ou inicie a modelagem
            de um novo domínio de arquitetura.
          </p>
          <div
            className="empty-state-actions"
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            {onOpenScaffoldWizard && (
              <button
                id="btn-empty-new-spec"
                className="btn btn-primary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={onOpenScaffoldWizard}
              >
                <Plus size={15} />
                <span>Explorar Templates & Criar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const comparisonOldContent = selectedCommit
    ? historicalContent
    : originalContent || "";
  const comparisonOldTitle = selectedCommit
    ? `Versão #${selectedCommit.shortHash || selectedCommit.hash.slice(0, 7)} (${selectedCommit.author})`
    : "Versão Base Publicada";

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Center Main Editor / Git Visual Diff Canvas */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minWidth: 0,
        }}
      >
        {/* 1. Document Header & Toolbar */}
        <div className="editor-top-toolbar">
          <div className="doc-meta-left">
            <div className="doc-breadcrumbs">
              <input
                type="text"
                id="doc-path-input"
                className="doc-path-input"
                value={filePath || ""}
                readOnly
                placeholder="Selecione ou crie um documento..."
                spellCheck="false"
                title="Caminho do documento no workspace"
              />
              <button
                id="btn-copy-doc-path"
                className="btn-icon-subtle"
                type="button"
                title="Copiar caminho do arquivo"
                onClick={handleCopyPath}
              >
                <svg
                  width="12.5"
                  height="12.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button
                id="btn-reveal-in-tree"
                className="btn-icon-subtle"
                type="button"
                title="Expandir pastas e revelar na árvore de documentos"
                onClick={handleRevealInTree}
              >
                <FolderTree size={13} />
              </button>
            </div>
          </div>

          {/* Native Editor Mode Tabs: Documento vs Prompt do Copilot */}
          <div
            className="notion-editor-mode-tabs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              background: "var(--color-surface-container-high, #f1f5f9)",
              padding: "3px",
              borderRadius: "8px",
              marginLeft: "10px",
              flexShrink: 0,
            }}
          >
            <button
              id="tab-mode-document"
              type="button"
              className={`notion-tab-btn ${editorTab === "document" ? "active" : ""}`}
              onClick={() => handleSwitchTab("document")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: editorTab === "document" ? 600 : 500,
                cursor: "pointer",
                background:
                  editorTab === "document"
                    ? "var(--color-surface, #ffffff)"
                    : "transparent",
                color:
                  editorTab === "document"
                    ? "var(--color-primary, #2563eb)"
                    : "var(--color-outline, #64748b)",
                boxShadow:
                  editorTab === "document"
                    ? "0 1px 3px rgba(0,0,0,0.1)"
                    : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span
                className="material-symbols-outlined icon-xs"
                style={{ fontSize: "15px" }}
              >
                {isTemplateMode ? "view_quilt" : "description"}
              </span>
              <span>
                {isTemplateMode ? "Conteúdo do Template" : "Documento"}
              </span>
            </button>

            <button
              id="tab-mode-copilot-prompt"
              type="button"
              className={`notion-tab-btn ${editorTab === "prompt" ? "active" : ""}`}
              onClick={() => handleSwitchTab("prompt")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: editorTab === "prompt" ? 600 : 500,
                cursor: "pointer",
                background:
                  editorTab === "prompt"
                    ? "var(--color-surface, #ffffff)"
                    : "transparent",
                color:
                  editorTab === "prompt"
                    ? "var(--color-primary, #2563eb)"
                    : "var(--color-outline, #64748b)",
                boxShadow:
                  editorTab === "prompt"
                    ? "0 1px 3px rgba(0,0,0,0.1)"
                    : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span
                className="material-symbols-outlined icon-xs"
                style={{ fontSize: "15px" }}
              >
                smart_toy
              </span>
              <span>Prompt do Copilot</span>
            </button>
          </div>

          <div className="editor-actions-right">
            <div className="doc-icon-actions">
              <button
                id="btn-copy-doc-full"
                className="btn-icon-action"
                type="button"
                title="Copiar Markdown completo"
                onClick={handleCopyFullDoc}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button
                id="btn-export-md-file"
                className="btn-icon-action"
                type="button"
                title="Exportar arquivo .md"
                onClick={handleExportMarkdown}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button
                id="btn-import-doc"
                className="btn-icon-action"
                type="button"
                title="Importar documento (.md ou colar)"
                onClick={() => setIsImportModalOpen(true)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </button>
            </div>

            <div className="toolbar-divider"></div>

            {/* Alternador de Modo Comparativo & Versões ("Olhinho" / Diffs) */}
            <button
              id="btn-toggle-git-mode"
              className={`btn-icon-action ${isGitMode ? "active" : ""}`}
              type="button"
              title={
                isGitMode
                  ? "Voltar para Modo de Edição"
                  : "Modo Comparativo & Auditoria (Ver evolução do conteúdo, quem editou e versões)"
              }
              onClick={() => {
                const nextMode = !isGitMode;
                setIsGitMode(nextMode);
                if (nextMode) setIsHistoryDrawerOpen(true);
              }}
            >
              <span className="material-symbols-outlined icon-xs">
                visibility
              </span>
            </button>

            {/* Botão Gaveta de Histórico */}
            <button
              id="btn-toggle-history-drawer"
              className={`btn-icon-action ${isHistoryDrawerOpen ? "active" : ""}`}
              type="button"
              title="Linha do Tempo de Versões & Evolução deste documento"
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            >
              <span className="material-symbols-outlined icon-xs">history_edu</span>
            </button>

            {/* Botão Sincronizar / Salvar no Disco */}
            {!isGitMode && (
              <button
                id="btn-save-draft"
                className={`btn-icon-action ${saveStatus === "Salvando..." ? "is-saving" : saveStatus === "Salvo no disco" ? "saved-success" : saveStatus === "Erro" ? "has-error" : isDirty ? "has-unsaved" : ""}`}
                type="button"
                title={
                  saveStatus === "Salvando..."
                    ? "Gravando alterações no disco da máquina..."
                    : saveStatus === "Salvo no disco"
                      ? "Salvo no disco com sucesso!"
                      : saveStatus === "Erro"
                        ? "Erro ao gravar no disco. Rascunho preservado."
                        : isDirty
                          ? "Gravando automaticamente no disco (ou clique/Ctrl+S para forçar gravação imediata)"
                          : "Arquivo sincronizado no disco (Ctrl+S)"
                }
                onClick={handleSave}
                disabled={saveStatus === "Salvando..."}
              >
                {saveStatus === "Salvando..." ? (
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{
                      animation: "spin 1s linear infinite",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    progress_activity
                  </span>
                ) : saveStatus === "Salvo no disco" ? (
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#10b981" }}
                  >
                    check
                  </span>
                ) : saveStatus === "Erro" ? (
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#ef4444" }}
                  >
                    error
                  </span>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                )}
              </button>
            )}

            {/* Botão Central de Diffs & PR */}
            {onOpenDiffModal && (
              <button
                id="btn-review-diff-direct"
                className="btn-icon-action"
                type="button"
                title="Revisar alterações e propor PR Oficial"
                onClick={onOpenDiffModal}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                  <line x1="6" y1="9" x2="6" y2="21"></line>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Floating Toast Notification */}
        {editorToast && (
          <div
            className={`editor-floating-toast toast-${editorToast.type}`}
            style={{
              position: "absolute",
              top: "52px",
              right: "24px",
              zIndex: 999,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <span className="material-symbols-outlined icon-xs">
              {editorToast.type === "success"
                ? "check_circle"
                : editorToast.type === "warning"
                  ? "warning"
                  : "info"}
            </span>
            <span>{editorToast.text}</span>
          </div>
        )}

        {/* Top Context & Connectivity Bar */}
        {!isTemplateMode && (
          <DocConnectivityBar
            filePath={filePath}
            onNavigateFile={onNavigateFile || (() => {})}
          />
        )}

        {/* Fragment Not Found / Snippet Alert Banner */}
        {fragmentAlert && fragmentAlert.type === "not_found" && (
          <div
            className="fragment-not-found-banner"
            id="fragment-not-found-alert"
          >
            <div className="fragment-alert-header">
              <div className="fragment-alert-title-row">
                <span className="material-symbols-outlined fragment-alert-icon">
                  link_off
                </span>
                <span className="fragment-alert-title">
                  Trecho referenciado não encontrado
                </span>
              </div>
              <button
                className="fragment-alert-close-btn"
                title="Dispensar alerta"
                onClick={() => setFragmentAlert(null)}
              >
                <span className="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
            <p className="fragment-alert-description">
              O link apontava para um trecho específico que foi substancialmente
              modificado ou excluído deste documento.
            </p>
            <div className="fragment-alert-original-box">
              <div className="fragment-alert-box-label">
                <span>Texto que estava lá originalmente:</span>
                <button
                  type="button"
                  className="btn-copy-original-fragment"
                  title="Copiar texto original para a área de transferência"
                  onClick={() => {
                    navigator.clipboard.writeText(fragmentAlert.exact);
                    setEditorToast({
                      text: "Texto original copiado!",
                      type: "success",
                    });
                    setTimeout(() => setEditorToast(null), 3000);
                  }}
                >
                  <span className="material-symbols-outlined icon-xs">
                    content_copy
                  </span>
                  Copiar texto
                </button>
              </div>
              <div className="fragment-alert-box-quote">
                {fragmentAlert.prefix && (
                  <span className="fragment-quote-context">
                    ...{fragmentAlert.prefix}{" "}
                  </span>
                )}
                <span className="fragment-quote-exact">
                  {fragmentAlert.exact}
                </span>
                {fragmentAlert.suffix && (
                  <span className="fragment-quote-context">
                    {" "}
                    {fragmentAlert.suffix}...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Body: Either Visual Markdown Diff (Git Mode) or Notion Live Editor */}
        {isGitMode ? (
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <VisualMarkdownDiff
              oldContent={comparisonOldContent}
              newContent={docBody}
              oldTitle={comparisonOldTitle}
              newTitle="Rascunho Atual (Em Edição)"
              fileName={filePath || undefined}
              blameData={blameData}
              showAuthorship={true}
              onRestoreOldVersion={
                selectedCommit ? handleRestoreHistoricalVersion : undefined
              }
              onClose={() => setIsGitMode(false)}
            />
          </div>
        ) : (
          <div className="notion-editor-wrapper" id="notion-editor-wrapper">
            <div className="notion-editor-scroll-container">
              {/* Prompt do Copilot Helper & Tag Banner */}
              {editorTab === "prompt" && (
                <div
                  style={{
                    margin: "16px 24px 8px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "var(--color-surface-container-high, #f8fafc)",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
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
                          color: "var(--color-primary, #2563eb)",
                          fontSize: "18px",
                        }}
                      >
                        smart_toy
                      </span>
                      <strong
                        style={{
                          fontSize: "12px",
                          color: "var(--color-on-surface, #0f172a)",
                        }}
                      >
                        {isTemplateMode
                          ? "Prompt do Copilot para este Template"
                          : `Instruções Específicas do Copilot para: ${titleValue || "este Documento"}`}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={handleOptimizePromptWithAI}
                      disabled={isGeneratingPromptAI}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                      }}
                    >
                      <span className="material-symbols-outlined icon-xs">
                        {isGeneratingPromptAI ? "sync" : "auto_awesome"}
                      </span>
                      {isGeneratingPromptAI ? "Gerando..." : "Gerar / Otimizar com IA"}
                    </button>
                  </div>

                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted, #64748b)",
                      margin: 0,
                    }}
                  >
                    {isTemplateMode
                      ? "Defina a instrução em Markdown que o Copilot utilizará para guiar o usuário na criação e preenchimento de documentos com este template."
                      : "Defina o papel, critérios técnicos e regras de negócio para guiar o Copilot nas análises e refatorações deste documento."}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexWrap: "wrap",
                      marginTop: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10.5px",
                        color: "var(--text-muted, #64748b)",
                        marginRight: "4px",
                      }}
                    >
                      Inserir Tag:
                    </span>
                    {[
                      { label: "Título", token: "{{TITULO}}" },
                      { label: "Autor", token: "{{AUTOR}}" },
                      { label: "Data", token: "{{DATA}}" },
                      { label: "Escopo", token: "{{ESCOPO}}" },
                      { label: "Requisitos", token: "{{REQUISITOS}}" },
                      { label: "Arquitetura", token: "{{ARQUITETURA}}" },
                      { label: "Riscos", token: "{{RISCOS}}" },
                    ].map((p) => (
                      <button
                        key={p.token}
                        type="button"
                        onClick={() => handleInsertPlaceholder(p.token)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--color-outline-variant, #cbd5e1)",
                          background: "var(--color-surface, #ffffff)",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--color-primary, #2563eb)",
                          cursor: "pointer",
                        }}
                      >
                        +{p.label}
                      </button>
                    ))}
                  </div>

                  {promptAIFeedback && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-primary, #2563eb)",
                        fontWeight: 500,
                      }}
                    >
                      {promptAIFeedback}
                    </span>
                  )}
                </div>
              )}

              {/* Título H1 Separado do Markdown (apenas na aba Documento) */}
              {editorTab === "document" && (
                <>
                  <div
                    className="notion-doc-header-block"
                    id="notion-doc-header-block"
                    onClick={() => titleTextareaRef.current?.focus()}
                  >
                    <div className="notion-doc-title-row">
                      <textarea
                        ref={titleTextareaRef}
                        id="notion-doc-title-input"
                        className="notion-doc-title-input"
                        rows={1}
                        placeholder="Sem título..."
                        value={titleValue}
                        onChange={(e) => {
                          handleTitleChange(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canvasRef.current) {
                              const firstBlock = canvasRef.current.querySelector(
                                '[contenteditable="true"]',
                              ) as HTMLElement;
                              if (firstBlock) firstBlock.focus();
                            }
                          }
                        }}
                        title="Título principal do documento (.docs.metadata.json)"
                      />
                    </div>
                  </div>

                  {/* Divider separador entre o Título e o conteúdo .md */}
                  <div
                    className="notion-doc-title-divider"
                    id="notion-doc-title-divider"
                  />
                </>
              )}

              <div
                ref={canvasRef}
                id="notion-editor-canvas"
                className="notion-canvas"
              />
            </div>
          </div>
        )}

        {/* 3. Editor Status Footer */}
        <footer className="editor-bottom-bar">
          <div
            className="editor-status-left"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span
              id="save-draft-status"
              className="status-indicator"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              {isGitMode ? (
                <span>Modo Git & Auditoria Ativo</span>
              ) : isTemplateMode ? (
                <>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#10b981" }}
                  >
                    bookmark
                  </span>
                  <span style={{ color: "#10b981" }}>{customSaveStatus || "Editor de Template"}</span>
                </>
              ) : saveStatus === "Salvando..." ? (
                <>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{
                      animation: "spin 1s linear infinite",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    progress_activity
                  </span>
                  <span>Salvando no disco...</span>
                </>
              ) : saveStatus === "Salvo no disco" ? (
                <>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#10b981" }}
                  >
                    check_circle
                  </span>
                  <span style={{ color: "#10b981" }}>Salvo no disco</span>
                </>
              ) : saveStatus === "Erro" ? (
                <>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#ef4444" }}
                  >
                    error
                  </span>
                  <span style={{ color: "#ef4444" }}>Erro ao gravar</span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ color: "#10b981" }}
                  >
                    cloud_done
                  </span>
                  <span>Sincronizado</span>
                </>
              )}
            </span>
            <span className="status-divider">&bull;</span>
            <span id="doc-word-count">{wordCount} palavras</span>
            <span className="status-divider">&bull;</span>
            <span id="doc-line-count">{lineCount} linhas</span>
          </div>
          <div className="editor-status-right">
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              Atalho: <code>Ctrl+S</code> / <code>Cmd+S</code>
            </span>
            <button
              id="btn-reload-doc"
              className="btn-icon-subtle"
              title="Recarregar do disco"
              onClick={onReload}
            >
              <span className="material-symbols-outlined icon-xs">refresh</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Right Drawer: Document History Timeline & Governance */}
      <DocumentHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        filePath={filePath}
        selectedCommitHash={selectedCommit ? selectedCommit.hash : null}
        onSelectCommit={(commit) => {
          setSelectedCommit(commit);
          setIsGitMode(true);
        }}
        documentMeta={docMetadata}
      />

      {/* Insert / Edit Link Modal */}
      <InsertLinkModal
        isOpen={isLinkModalOpen}
        initialText={linkModalInitialText}
        initialUrl={linkModalInitialUrl}
        onClose={() => setIsLinkModalOpen(false)}
        onConfirm={(url, text) => {
          if (linkModalCallbackRef.current) {
            linkModalCallbackRef.current(url, text);
            // Salvar imediatamente no disco para atualizar dependências e metadados em tempo real
            setTimeout(() => {
              saveCurrentFile();
            }, 80);
          }
          setIsLinkModalOpen(false);
        }}
      />

      {/* Import Doc Modal */}
      {isImportModalOpen && (
        <div
          id="import-doc-modal"
          className="modal-backdrop"
          style={{ display: "flex" }}
        >
          <div className="modal-box" style={{ maxWidth: "580px" }}>
            <div className="modal-header">
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Importar Documento
                </h3>
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  Upload de arquivo .md ou colar texto
                </span>
              </div>
              <button
                id="btn-close-import-modal"
                className="btn-close"
                aria-label="Fechar"
                onClick={() => setIsImportModalOpen(false)}
              >
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
            <div
              className="modal-body"
              style={{ padding: "18px 22px", gap: "14px" }}
            >
              <div className="import-paste-box">
                <textarea
                  id="import-paste-textarea"
                  rows={8}
                  placeholder="Ou cole seu texto Markdown aqui diretamente..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmPasteImport}
                disabled={!importText.trim()}
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

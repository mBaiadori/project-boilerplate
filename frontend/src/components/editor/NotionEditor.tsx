import { FileText, FolderTree, Plus, Shield, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSecurity } from "../../context/SecurityContext";
import { API } from "../../services/api";
import {
  parseFrontmatter,
  serializeFrontmatter,
} from "../../services/frontmatter";
import type { DocumentMetadataItem, GitCommitInfo } from "../../types";
import { InsertLinkModal } from "../modals/InsertLinkModal";
import { AddDictionaryTermModal } from "../modals/AddDictionaryTermModal";
import { LinkSynonymModal } from "../modals/LinkSynonymModal";
import {
  DictionaryPopover,
  type DictionaryPopoverData,
} from "../dictionary/DictionaryPopover";
import { DocConnectivityBar } from "./DocConnectivityBar";
import { DocumentHistoryDrawer } from "./DocumentHistoryDrawer";
import {
  NotionEditorEngine,
  type FragmentStatusInfo,
} from "./notion-editor-engine";
import { VisualMarkdownDiff } from "./VisualMarkdownDiff";
import { LanguageSelectorDropdown } from "./LanguageSelectorDropdown";
import { TranslationBanner } from "./TranslationBanner";
import { SyncTranslationModal } from "../modals/SyncTranslationModal";
import type { SupportedLanguage, SyncToMainPreview } from "../../types";

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
  onOpenDiffModal: _onOpenDiffModal,
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
    dictionaryTerms,
  } = useWorkspace();
  const [editorTab, setEditorTab] = useState<"document" | "prompt">("document");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [titleValue, setTitleValue] = useState<string>("");
  const [dictionaryPopoverData, setDictionaryPopoverData] =
    useState<DictionaryPopoverData | null>(null);

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

  // Translation & SSOT State
  const [activeLanguage, setActiveLanguage] = useState<string>("pt-BR");
  const [defaultLanguage, setDefaultLanguage] = useState<string>("pt-BR");
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguage[]>([]);
  const [isTranslationOutdated, setIsTranslationOutdated] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncToMainPreview | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncingToMain, setIsSyncingToMain] = useState(false);

  // Security Level & Document Lock Gate State
  const { securityLevels, departments, isLevelUnlocked, canAccessDoc, unlockLevel } = useSecurity();
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const docSecLevel =
    fileMetadata?.level !== undefined && fileMetadata?.level !== null
      ? Number(fileMetadata.level)
      : fileMetadata?.security_level !== undefined && fileMetadata?.security_level !== null
      ? Number(fileMetadata.security_level)
      : 999;
  const docSecLevelId =
    fileMetadata?.security_level_id ||
    (docSecLevel === 999
      ? "public"
      : securityLevels.find((l) => l.rank === docSecLevel || l.level === docSecLevel)?.id || String(docSecLevel));

  const activeSecLevelObj =
    securityLevels.find(
      (l) =>
        (docSecLevelId && l.id === docSecLevelId) ||
        (docSecLevel !== undefined && (l.rank === Number(docSecLevel) || l.level === Number(docSecLevel)))
    ) ||
    securityLevels.find((l) => l.rank === 999 || l.level === 999) ||
    securityLevels.find((l) => l.id === "public");

  const activeDeptObj = departments.find((d) => d.id === fileMetadata?.department);

  const isDocumentConfidential =
    docSecLevel !== 999 &&
    docSecLevelId !== "public";

  const isAllowedByDept = canAccessDoc(fileMetadata || {});
  const isDocumentLocked =
    isDocumentConfidential &&
    (!isLevelUnlocked(docSecLevelId || docSecLevel) || !isAllowedByDept);

  const handleUnlockDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassphrase.trim() || isUnlocking) return;
    setIsUnlocking(true);
    setUnlockError("");
    try {
      const res = await unlockLevel(
        docSecLevelId || docSecLevel || "root",
        unlockPassphrase
      );
      if (res.success) {
        setUnlockPassphrase("");
        setEditorToast({
          text: `Nível ${activeSecLevelObj?.name || ""} desbloqueado com sucesso!`,
          type: "success",
        });
        setTimeout(() => setEditorToast(null), 3000);
      } else {
        setUnlockError(
          res.error || "Frase-chave incorreta para este documento."
        );
      }
    } catch (err: any) {
      setUnlockError(err.message || "Erro ao desbloquear documento.");
    } finally {
      setIsUnlocking(false);
    }
  };

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

  // Dictionary Term & Synonym Modal State
  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);
  const [addTermInitialText, setAddTermInitialText] = useState("");
  const [isLinkSynonymModalOpen, setIsLinkSynonymModalOpen] = useState(false);
  const [linkSynonymInitialText, setLinkSynonymInitialText] = useState("");

  const handleOpenAddTermModal = useCallback((text: string) => {
    setAddTermInitialText(text);
    setIsAddTermModalOpen(true);
  }, []);

  const handleOpenLinkSynonymModal = useCallback((text: string) => {
    setLinkSynonymInitialText(text);
    setIsLinkSynonymModalOpen(true);
  }, []);

  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NotionEditorEngine | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isInternalChangeRef = useRef(false);
  const lastEmittedMarkdownRef = useRef<string>("");

  const activeLanguageRef = useRef(activeLanguage);
  activeLanguageRef.current = activeLanguage;

  const defaultLanguageRef = useRef(defaultLanguage);
  defaultLanguageRef.current = defaultLanguage;

  const parsed = parseFrontmatter(content || "");
  const docBody = parsed.body || content || "";
  const effectivePrompt =
    promptContent !== undefined ? promptContent : fileMetadata?.prompt || "";

  // Armazena com segurança o conteúdo íntegro do Documento Oficial (SSOT)
  const officialContentRef = useRef(content || "");
  if (activeLanguage.toLowerCase() === defaultLanguage.toLowerCase()) {
    officialContentRef.current = content || "";
  }

  const editorTabRef = useRef(editorTab);
  editorTabRef.current = editorTab;

  const docBodyRef = useRef(docBody);
  if (activeLanguage.toLowerCase() === defaultLanguage.toLowerCase()) {
    docBodyRef.current = docBody;
  }

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
        docBodyRef.current = currentMd;
        // Se estiver no documento oficial, propaga a alteração para o buffer pai
        if (
          activeLanguageRef.current.toLowerCase() ===
          defaultLanguageRef.current.toLowerCase()
        ) {
          const newContent = parsedRef.current.hasFrontmatter
            ? serializeFrontmatter(parsedRef.current.metadata, currentMd)
            : currentMd;
          onChangeRef.current(newContent);
        }
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
    const targetText =
      newTab === "document" ? docBodyRef.current : effectivePromptRef.current;
    if (engineRef.current) {
      isInternalChangeRef.current = true;
      engineRef.current.setMarkdown(targetText);
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

  const [isUpdatingFromMain, setIsUpdatingFromMain] = useState(false);

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
  }, [
    fileMetadata?.title,
    docMetadata?.title,
    filePath,
    isTemplateMode,
    customTitle,
  ]);

  const handleTitleChange = (newVal: string) => {
    setTitleValue(newVal);
    if (isTemplateMode) {
      if (onCustomTitleChange) onCustomTitleChange(newVal);
      return;
    }
    // Metadados pertencem exclusivamente ao Documento Oficial.
    // Não altera metadados do documento oficial se estiver visualizando/editando uma tradução.
    if (activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase()) {
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

  // Carregar dados de tradução e idiomas suportados quando o arquivo ativo muda
  useEffect(() => {
    if (!filePath || isTemplateMode) return;
    API.listTranslations(filePath)
      .then((res) => {
        if (res.ok && res.data) {
          const defLang = res.data.defaultLanguage || "pt-BR";
          setDefaultLanguage(defLang);
          setActiveLanguage(defLang);
          setSupportedLanguages(res.data.supportedLanguages || []);
        }
      })
      .catch(() => {});
  }, [filePath, isTemplateMode]);

  // Alternar entre Documento Oficial e Versões Traduzidas
  const handleSelectLanguage = async (lang: string) => {
    if (!filePath) return;
    const isTargetMain =
      lang.toLowerCase() === defaultLanguageRef.current.toLowerCase();

    // Se estiver saindo de uma tradução, grava rascunho de tradução pendente no arquivo oculto
    if (
      activeLanguageRef.current.toLowerCase() !==
      defaultLanguageRef.current.toLowerCase()
    ) {
      const currentTransMd = engineRef.current
        ? engineRef.current.getMarkdown()
        : docBodyRef.current;
      if (currentTransMd && currentTransMd.trim()) {
        API.saveTranslation({
          path: filePath,
          lang: activeLanguageRef.current,
          content: currentTransMd.trim(),
        }).catch(() => {});
      }
    }

    if (isTargetMain) {
      setActiveLanguage(defaultLanguageRef.current);
      setIsTranslationOutdated(false);

      // Restaura o corpo e o título oficial no editor a partir do buffer oficial intacto
      const rawOfficial = officialContentRef.current || content || "";
      const mainParsed = parseFrontmatter(rawOfficial);
      const metaTitle =
        fileMetadata?.title !== undefined
          ? fileMetadata.title
          : docMetadata?.title || mainParsed.metadata?.title || "";
      setTitleValue(metaTitle);
      parsedRef.current = mainParsed;
      docBodyRef.current = mainParsed.body;

      if (engineRef.current) {
        isInternalChangeRef.current = true;
        engineRef.current.setMarkdown(mainParsed.body || "");
      }
      if (onReload) onReload();
      return;
    }

    try {
      const res = await API.getTranslationFile(filePath, lang);
      if (res.ok && res.data) {
        setActiveLanguage(lang);
        setIsTranslationOutdated(res.data.isOutdated);

        // Traduções são puro Markdown para leitura/edição na língua de preferência
        const parsedTrans = parseFrontmatter(res.data.content);
        const transBody = parsedTrans.body || res.data.content;
        docBodyRef.current = transBody;
        if (engineRef.current) {
          isInternalChangeRef.current = true;
          engineRef.current.setMarkdown(transBody);
        }
      }
    } catch (err: any) {
      setEditorToast({
        text:
          err?.message ||
          `Não foi possível carregar a tradução (${lang.toUpperCase()}).`,
        type: "warning",
      });
      setTimeout(() => setEditorToast(null), 3000);
    }
  };

  // Atualizar tradução existente que esteja desatualizada em relação ao documento oficial
  const handleUpdateFromMain = async () => {
    if (
      !filePath ||
      activeLanguageRef.current.toLowerCase() ===
        defaultLanguageRef.current.toLowerCase()
    )
      return;
    setIsUpdatingFromMain(true);
    try {
      const res = await API.translateDocument({
        path: filePath,
        targetLang: activeLanguageRef.current,
      });

      if (res.ok && res.data) {
        setIsTranslationOutdated(false);
        const parsedTrans = parseFrontmatter(res.data.content);
        const transBody = parsedTrans.body || res.data.content;
        docBodyRef.current = transBody;
        if (engineRef.current) {
          isInternalChangeRef.current = true;
          engineRef.current.setMarkdown(transBody);
        }
        setEditorToast({
          text: `Tradução (${activeLanguageRef.current.toUpperCase()}) atualizada com sucesso a partir do documento oficial!`,
          type: "success",
        });
        setTimeout(() => setEditorToast(null), 3000);
      } else {
        setEditorToast({
          text:
            (res.data as any)?.error ||
            "Erro ao atualizar tradução do documento oficial.",
          type: "warning",
        });
        setTimeout(() => setEditorToast(null), 3000);
      }
    } catch (err: any) {
      setEditorToast({
        text: err?.message || "Falha na comunicação ao atualizar tradução.",
        type: "warning",
      });
      setTimeout(() => setEditorToast(null), 3000);
    } finally {
      setIsUpdatingFromMain(false);
    }
  };

  // Preparar Sincronização Bidirecional da versão traduzida para o Documento Oficial
  const handleSyncToMain = async () => {
    if (!filePath) return;
    setIsSyncingToMain(true);
    try {
      const currentMd = engineRef.current
        ? engineRef.current.getMarkdown()
        : docBodyRef.current;

      const res = await API.syncTranslationToMain({
        path: filePath,
        translatedContent: currentMd,
        fromLang: activeLanguageRef.current,
      });

      if (res.ok && res.data) {
        setSyncPreview(res.data);
        setIsSyncModalOpen(true);
      } else {
        setEditorToast({
          text:
            (res.data as any)?.error ||
            "Erro ao preparar sincronização para o documento oficial.",
          type: "warning",
        });
        setTimeout(() => setEditorToast(null), 3000);
      }
    } catch (err: any) {
      setEditorToast({
        text: err?.message || "Falha na comunicação ao sincronizar tradução.",
        type: "warning",
      });
      setTimeout(() => setEditorToast(null), 3000);
    } finally {
      setIsSyncingToMain(false);
    }
  };

  // Confirmar Aplicação no Documento Oficial
  const handleConfirmApplyToMain = async (newMainContent: string) => {
    if (!filePath) return;
    const res = await API.applyTranslationToMain({
      path: filePath,
      content: newMainContent,
    });
    if (res.ok) {
      setEditorToast({
        text: "Documento oficial atualizado com sucesso a partir da tradução!",
        type: "success",
      });
      setTimeout(() => setEditorToast(null), 3500);

      // 1. Atualiza o buffer de conteúdo oficial para a nova versão consolidada
      officialContentRef.current = newMainContent;

      // 2. Alterna o estado ativo de volta para o idioma oficial
      setActiveLanguage(defaultLanguageRef.current);
      setIsTranslationOutdated(false);

      // 3. Extrai metadados e corpo do novo documento oficial
      const mainParsed = parseFrontmatter(newMainContent);
      const metaTitle =
        fileMetadata?.title !== undefined
          ? fileMetadata.title
          : docMetadata?.title || mainParsed.metadata?.title || "";
      setTitleValue(metaTitle);
      parsedRef.current = mainParsed;
      docBodyRef.current = mainParsed.body;

      // 4. Atualiza o canvas do NotionEditor imediatamente sem necessidade de refresh
      if (engineRef.current) {
        isInternalChangeRef.current = true;
        engineRef.current.setMarkdown(mainParsed.body);
      }

      // 5. Propaga o novo conteúdo oficial completo para o buffer do workspace pai
      onChangeRef.current(newMainContent);

      // 6. Recarrega árvores e referências
      if (onReload) onReload();
    } else {
      setEditorToast({
        text: (res.data as any)?.error || "Erro ao atualizar documento oficial.",
        type: "warning",
      });
      setTimeout(() => setEditorToast(null), 3000);
    }
  };

  // Manual save trigger (Ctrl+S ou clique) que faz o flush imediato
  const handleSave = useCallback(async () => {
    if (engineRef.current) {
      engineRef.current.applyDictionaryHighlights();
    }
    if (onCustomSave) {
      const res = await onCustomSave();
      if ((res as any)?.success !== false) {
        if (engineRef.current) {
          engineRef.current.applyDictionaryHighlights();
        }
        setEditorToast({
          text: (res as any)?.message || "Template salvo com sucesso!",
          type: "success",
        });
        setTimeout(() => setEditorToast(null), 2500);
      }
      return;
    }
    if (!filePath) return;

    // Se estiver em modo tradução, salva apenas o corpo traduzido no arquivo oculto de tradução
    if (
      activeLanguageRef.current.toLowerCase() !==
      defaultLanguageRef.current.toLowerCase()
    ) {
      const currentMd = engineRef.current
        ? engineRef.current.getMarkdown()
        : docBodyRef.current;

      const res = await API.saveTranslation({
        path: filePath,
        lang: activeLanguageRef.current,
        content: currentMd.trim(),
      });

      if (res.ok) {
        if (engineRef.current) {
          engineRef.current.applyDictionaryHighlights();
        }
        setEditorToast({
          text: `Tradução (${activeLanguageRef.current.toUpperCase()}) gravada no disco!`,
          type: "success",
        });
        setTimeout(() => setEditorToast(null), 2500);
      }
      return;
    }

    const res = await saveCurrentFile();
    if (res?.success) {
      if (engineRef.current) {
        engineRef.current.applyDictionaryHighlights();
      }
      setEditorToast({
        text: "Alterações gravadas no disco!",
        type: "success",
      });
      setTimeout(() => setEditorToast(null), 2500);
    }
  }, [filePath, saveCurrentFile, onCustomSave]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // Initialize & Mount NotionEditorEngine
  useEffect(() => {
    if (!canvasRef.current || isGitMode) return;

    const engine = new NotionEditorEngine({
      canvasElement: canvasRef.current,
      filePath: filePath,
      onNavigateFile: onNavigateFile,
      dictionaryTerms: dictionaryTerms,
      onShowDictionaryPopover: (data) => {
        setDictionaryPopoverData(data);
      },
      onChange: () => {
        if (!engineRef.current) return;
        const currentMd = engineRef.current.getMarkdown();
        lastEmittedMarkdownRef.current = currentMd;
        isInternalChangeRef.current = true;
        if (editorTabRef.current === "document") {
          docBodyRef.current = currentMd;
          // Se estiver em modo tradução, NUNCA muta o buffer do documento oficial!
          if (
            activeLanguageRef.current.toLowerCase() !==
            defaultLanguageRef.current.toLowerCase()
          ) {
            return;
          }
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
        if (handleSaveRef.current) {
          handleSaveRef.current();
        }
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
      onAddDictionaryTerm: handleOpenAddTermModal,
      onLinkSynonym: handleOpenLinkSynonymModal,
      onFragmentStatus: (status) => {
        setFragmentAlert(status);
      },
    });

    engineRef.current = engine;
    const initialText = editorTab === "document" ? docBody : effectivePrompt;
    engine.setMarkdown(initialText);

    const hash = window.location.hash;
    if (
      hash &&
      (hash.includes(":~:text=") || hash.startsWith("#")) &&
      initialText.trim()
    ) {
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
      engineRef.current.setDictionaryTerms(dictionaryTerms);
    }
  }, [dictionaryTerms]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.filePath = filePath;
      const targetText = editorTab === "document" ? docBody : effectivePrompt;
      isInternalChangeRef.current = false;
      engineRef.current.setMarkdown(targetText);
      setFragmentAlert(null);
      engineRef.current.clearFragmentHighlights();

      const hash = window.location.hash;
      if (
        hash &&
        (hash.includes(":~:text=") || hash.startsWith("#")) &&
        targetText.trim()
      ) {
        setTimeout(() => {
          engineRef.current?.scrollToFragment(hash);
        }, 150);
      }
    }
  }, [filePath]);

  // Listeners para navegação e atualização de fragmentos de texto (Deep Linking)
  useEffect(() => {
    const handleFragmentNav = (e: any) => {
      // Se o evento especificou um filePath de destino, só executa se corresponder a este editor
      if (e.detail?.filePath && e.detail.filePath !== filePath) {
        return;
      }
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
      if (!hash) {
        setFragmentAlert(null);
        engineRef.current?.clearFragmentHighlights();
        return;
      }
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
  }, [filePath]);

  // Sync external content changes into the editor canvas
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    // Se estiver em modo tradução, NÃO sobrescreve o canvas com o documento oficial externo!
    if (
      activeLanguageRef.current.toLowerCase() !==
      defaultLanguageRef.current.toLowerCase()
    ) {
      return;
    }
    if (engineRef.current) {
      const currentEngineMd = engineRef.current.getMarkdown();
      const targetText = editorTab === "document" ? docBody : effectivePrompt;

      const normEngine = (currentEngineMd || "").replace(/\r\n/g, "\n").trim();
      const normTarget = (targetText || "").replace(/\r\n/g, "\n").trim();
      const normLastEmitted = (lastEmittedMarkdownRef.current || "").replace(/\r\n/g, "\n").trim();

      // Só recarrega o DOM se a mudança for externa real e diferente do que foi digitado
      if (normEngine !== normTarget && normLastEmitted !== normTarget) {
        lastEmittedMarkdownRef.current = targetText;
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
        if (handleSaveRef.current) {
          handleSaveRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
  const wordCount = currentContent.trim()
    ? currentContent.trim().split(/\s+/).length
    : 0;
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
                  editorTab === "prompt" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
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
            {/* Seletor de Idiomas & SSOT */}
            {!isTemplateMode && filePath && (
              <LanguageSelectorDropdown
                filePath={filePath}
                activeLanguage={activeLanguage}
                onSelectLanguage={handleSelectLanguage}
                onTranslationCreated={(lang, transContent) => {
                  setActiveLanguage(lang);
                  const parsedTrans = parseFrontmatter(transContent);
                  const bodyContent = parsedTrans.body || transContent;
                  docBodyRef.current = bodyContent;
                  setTitleValue(parsedTrans.metadata?.title || "");
                  if (engineRef.current) {
                    isInternalChangeRef.current = true;
                    engineRef.current.setMarkdown(bodyContent);
                  }
                  setEditorToast({
                    text: `Tradução para ${lang.toUpperCase()} criada com sucesso!`,
                    type: "success",
                  });
                  setTimeout(() => setEditorToast(null), 2500);
                }}
              />
            )}

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
              <span className="material-symbols-outlined icon-xs">history</span>
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

        {/* Translation Mode Banner */}
        {!isTemplateMode && activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase() && (
          <TranslationBanner
            currentLanguage={activeLanguage}
            defaultLanguage={defaultLanguage}
            supportedLanguages={supportedLanguages}
            isOutdated={isTranslationOutdated}
            onSyncToMain={handleSyncToMain}
            onBackToMain={() => handleSelectLanguage(defaultLanguage)}
            onUpdateFromMain={handleUpdateFromMain}
            isSyncing={isSyncingToMain}
            isUpdating={isUpdatingFromMain}
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
                    setTimeout(() => setEditorToast(null), 2000);
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

        {/* 2. Body: Either Document Lock Gate, Visual Markdown Diff (Git Mode) or Notion Live Editor */}
        {isDocumentLocked ? (
          <div
            className="document-security-lock-gate"
            id="document-security-lock-gate"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 16px",
              background: "var(--color-surface, #ffffff)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                maxWidth: "460px",
                width: "100%",
                padding: "36px 32px",
                borderRadius: "16px",
                border: `1px solid ${activeSecLevelObj?.color || "#ef4444"}35`,
                background: "var(--color-surface-container-lowest, #ffffff)",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.07)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "18px",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: `${activeSecLevelObj?.color || "#ef4444"}15`,
                  color: activeSecLevelObj?.color || "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={30} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      backgroundColor: `${activeSecLevelObj?.color || "#ef4444"}15`,
                      border: `1px solid ${activeSecLevelObj?.color || "#ef4444"}40`,
                      color: activeSecLevelObj?.color || "#ef4444",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    <Shield size={12} />
                    {activeSecLevelObj?.name || `Nível ${docSecLevel}`} &bull; Level {activeSecLevelObj?.level ?? activeSecLevelObj?.rank ?? docSecLevel}
                  </div>

                  {activeDeptObj && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        backgroundColor: `${activeDeptObj.color}15`,
                        border: `1px solid ${activeDeptObj.color}40`,
                        color: activeDeptObj.color,
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                        {activeDeptObj.icon || "folder"}
                      </span>
                      {activeDeptObj.name}
                    </div>
                  )}
                </div>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--color-on-surface, #0f172a)",
                  }}
                >
                  Documento Protegido por Chave de Acesso
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--color-outline, #64748b)",
                    lineHeight: "1.5",
                  }}
                >
                  Este documento confidencial requer a frase-chave de acesso do nível{" "}
                  <strong style={{ color: activeSecLevelObj?.color || "#ef4444" }}>
                    {activeSecLevelObj?.name}
                  </strong>{" "}
                  ou a Chave-Mestra Root para ser visualizado e editado.
                </p>
              </div>

              <form
                onSubmit={handleUnlockDocument}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    type={showUnlockPass ? "text" : "password"}
                    placeholder="Digite a frase-chave do nível..."
                    value={unlockPassphrase}
                    onChange={(e) => setUnlockPassphrase(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 38px 10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-outline-variant, #cbd5e1)",
                      fontSize: "13px",
                      background: "#fff",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPass(!showUnlockPass)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title={showUnlockPass ? "Ocultar frase-chave" : "Exibir frase-chave"}
                  >
                    {showUnlockPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {unlockError && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#dc2626",
                      fontWeight: 500,
                      textAlign: "left",
                      background: "rgba(220, 38, 38, 0.08)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {unlockError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!unlockPassphrase.trim() || isUnlocking}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    backgroundColor: activeSecLevelObj?.color || "#2563eb",
                    borderColor: activeSecLevelObj?.color || "#2563eb",
                    color: "#ffffff",
                    cursor: !unlockPassphrase.trim() || isUnlocking ? "not-allowed" : "pointer",
                    opacity: !unlockPassphrase.trim() || isUnlocking ? 0.7 : 1,
                  }}
                >
                  <Unlock size={15} />
                  {isUnlocking ? "Desbloqueando..." : "Desbloquear Documento"}
                </button>
              </form>
            </div>
          </div>
        ) : isGitMode ? (
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
                        disabled={activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase()}
                        onChange={(e) => {
                          handleTitleChange(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canvasRef.current) {
                              const firstBlock =
                                canvasRef.current.querySelector(
                                  '[contenteditable="true"]',
                                ) as HTMLElement;
                              if (firstBlock) firstBlock.focus();
                            }
                          }
                        }}
                        title={
                          activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase()
                            ? `Título Oficial (${defaultLanguage.toUpperCase()}) - Metadados são editados no Documento Oficial`
                            : "Título principal do documento (.docs.metadata.json)"
                        }
                      />
                      {activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase() && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              background: "rgba(16, 185, 129, 0.12)",
                              color: "#059669",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Versão Traduzida ({activeLanguage.toUpperCase()})
                          </span>
                        </div>
                      )}
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
                  <span style={{ color: "#10b981" }}>
                    {customSaveStatus || "Editor de Template"}
                  </span>
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
      {/* Dictionary Modals */}
      <AddDictionaryTermModal
        isOpen={isAddTermModalOpen}
        initialTerm={addTermInitialText}
        onClose={() => setIsAddTermModalOpen(false)}
        onTermCreated={() => {
          if (engineRef.current) {
            engineRef.current.applyDictionaryHighlights();
          }
          setEditorToast({
            text: "Termo cadastrado com sucesso no Dicionário!",
            type: "success",
          });
          setTimeout(() => setEditorToast(null), 3000);
        }}
      />

      <LinkSynonymModal
        isOpen={isLinkSynonymModalOpen}
        synonymText={linkSynonymInitialText}
        onClose={() => setIsLinkSynonymModalOpen(false)}
        onSynonymLinked={() => {
          if (engineRef.current) {
            engineRef.current.applyDictionaryHighlights();
          }
          setEditorToast({
            text: "Sinônimo vinculado com sucesso!",
            type: "success",
          });
          setTimeout(() => setEditorToast(null), 3000);
        }}
      />

      <DictionaryPopover
        data={dictionaryPopoverData}
        onClose={() => setDictionaryPopoverData(null)}
      />

      {/* Sync Translation to Main Modal */}
      <SyncTranslationModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        preview={syncPreview}
        onConfirmApply={handleConfirmApplyToMain}
      />
    </div>
  );
};

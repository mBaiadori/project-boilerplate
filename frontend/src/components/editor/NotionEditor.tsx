import { FileText, FolderTree, Lock, Plus } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSecurity } from "../../context/SecurityContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import {
  parseFrontmatter,
  serializeFrontmatter,
} from "../../services/frontmatter";
import type {
  DocumentMetadataItem,
  GitCommitInfo,
  SupportedLanguage,
  SyncToMainPreview,
} from "../../types";
import {
  DictionaryPopover,
  type DictionaryPopoverData,
} from "../dictionary/DictionaryPopover";
import { AddDictionaryTermModal } from "../modals/AddDictionaryTermModal";
import { InsertLinkModal } from "../modals/InsertLinkModal";
import { LinkSynonymModal } from "../modals/LinkSynonymModal";
import { MergeConflictResolutionModal } from "../modals/MergeConflictResolutionModal";
import { SyncTranslationModal } from "../modals/SyncTranslationModal";
import { DocConnectivityBar } from "./DocConnectivityBar";
import { DocumentHistoryDrawer } from "./DocumentHistoryDrawer";
import { LanguageSelectorDropdown } from "./LanguageSelectorDropdown";
import {
  NotionEditorEngine,
  type FragmentStatusInfo,
} from "./notion-editor-engine";
import { TranslationBanner } from "./TranslationBanner";
import { VisualMarkdownDiff } from "./VisualMarkdownDiff";

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
  const titleValueRef = useRef(titleValue);
  titleValueRef.current = titleValue;
  const translationParsedRef = useRef<{
    hasFrontmatter: boolean;
    metadata: Record<string, any>;
    body: string;
  }>({
    hasFrontmatter: false,
    metadata: {},
    body: "",
  });
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
  const [supportedLanguages, setSupportedLanguages] = useState<
    SupportedLanguage[]
  >([]);
  const [isTranslationOutdated, setIsTranslationOutdated] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncToMainPreview | null>(
    null,
  );
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Collaborative PR Editing Mode State
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const prId = searchParams.get("pr");
  const prBaseSha = searchParams.get("base") || "";
  const [prHeadSha, setPrHeadSha] = useState<string>(prBaseSha);
  const isPREditing = !!prId;

  // Merge Conflict State
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictBundleText, setConflictBundleText] = useState<string>("");
  const hasMergeConflict = useMemo(() => {
    return (
      typeof content === "string" &&
      content.includes("<<<<<<< ") &&
      content.includes("=======") &&
      content.includes(">>>>>>> ")
    );
  }, [content]);
  const [isSyncingToMain, setIsSyncingToMain] = useState(false);

  // Load document content directly from PR branch when in PR editing mode
  useEffect(() => {
    if (!prId || !filePath) return;
    let isCancelled = false;
    API.getPRFile({ pr_id: prId, path: filePath, repo: activeRepo?.name })
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data) {
          if (res.data.head_sha) {
            setPrHeadSha(res.data.head_sha);
          }
          if (res.data.content !== undefined) {
            onChangeRef.current(res.data.content);
            if (engineRef.current) {
              engineRef.current.setMarkdown(res.data.content);
            }
          }
        }
      })
      .catch((err) => {
        console.warn(
          "[NotionEditor] Erro ao carregar arquivo da branch do PR:",
          err,
        );
      });
    return () => {
      isCancelled = true;
    };
  }, [prId, filePath, activeRepo?.name]);

  // Security & Document Access Gate State
  const { departments, canAccessDoc } = useSecurity();

  const activeDeptObj = departments.find(
    (d) =>
      d.id === fileMetadata?.department ||
      d.folder.toLowerCase() === fileMetadata?.department?.toLowerCase(),
  );

  const isAllowedByDept = canAccessDoc(fileMetadata || {});
  const isDocumentLocked = !isAllowedByDept;

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
  const docBody = parsed.hasFrontmatter ? parsed.body : (content || "");
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

  // Gravar tradução ativa no disco preservando frontmatter e título traduzido
  const saveActiveTranslation = async () => {
    if (
      !filePath ||
      activeLanguageRef.current.toLowerCase() ===
        defaultLanguageRef.current.toLowerCase()
    ) {
      return;
    }
    const currentMd = engineRef.current
      ? engineRef.current.getMarkdown()
      : docBodyRef.current;

    const meta = {
      ...(translationParsedRef.current?.metadata || {}),
      title: titleValueRef.current || translationParsedRef.current?.metadata?.title || "",
    };

    const fullTransContent = serializeFrontmatter(meta, currentMd ? currentMd.trim() : "");

    try {
      await API.saveTranslation({
        path: filePath,
        lang: activeLanguageRef.current,
        content: fullTransContent,
      });
    } catch (e) {
      console.warn("[NotionEditor] Falha ao salvar tradução:", e);
    }
  };

  // Sincronizar o título local com os metadados do documento ou customTitle
  useEffect(() => {
    if (isTemplateMode) {
      if (customTitle !== undefined) {
        setTitleValue(customTitle);
      }
      return;
    }
    // Se estiver em modo tradução, NÃO sobrescreve com o título do documento oficial!
    if (activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase()) {
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
    activeLanguage,
    defaultLanguage,
  ]);

  const handleTitleChange = (newVal: string) => {
    setTitleValue(newVal);
    if (isTemplateMode) {
      if (onCustomTitleChange) onCustomTitleChange(newVal);
      return;
    }
    // Se estiver visualizando/editando uma tradução, atualiza os metadados da tradução e persiste
    if (activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase()) {
      translationParsedRef.current.metadata = {
        ...translationParsedRef.current.metadata,
        title: newVal,
      };
      translationParsedRef.current.hasFrontmatter = true;
      if (titleDebounceTimerRef.current) {
        clearTimeout(titleDebounceTimerRef.current);
      }
      titleDebounceTimerRef.current = setTimeout(() => {
        saveActiveTranslation();
      }, 500);
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

    // Se estiver saindo de uma tradução, grava rascunho de tradução com metadados completos
    if (
      activeLanguageRef.current.toLowerCase() !==
      defaultLanguageRef.current.toLowerCase()
    ) {
      await saveActiveTranslation();
    }

    if (isTargetMain) {
      setActiveLanguage(defaultLanguageRef.current);
      setIsTranslationOutdated(false);

      // Restaura o corpo e o título oficial no editor a partir do buffer oficial intacto
      const rawOfficial = officialContentRef.current || content || "";
      const mainParsed = parseFrontmatter(rawOfficial);
      const metaTitle =
        mainParsed.metadata?.title !== undefined
          ? mainParsed.metadata.title
          : fileMetadata?.title !== undefined
          ? fileMetadata.title
          : docMetadata?.title || "";
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

        // Traduções carregam Frontmatter para metadados locais (title, etc.) e corpo traduzido
        const parsedTrans = parseFrontmatter(res.data.content);
        translationParsedRef.current = parsedTrans;
        const transBody = parsedTrans.hasFrontmatter
          ? parsedTrans.body
          : res.data.content || "";
        docBodyRef.current = transBody;

        const transTitle =
          parsedTrans.metadata?.title !== undefined
            ? parsedTrans.metadata.title
            : "";
        setTitleValue(transTitle);

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
        translationParsedRef.current = parsedTrans;
        const transBody = parsedTrans.hasFrontmatter
          ? parsedTrans.body
          : res.data.content || "";
        docBodyRef.current = transBody;

        const transTitle =
          parsedTrans.metadata?.title !== undefined
            ? parsedTrans.metadata.title
            : "";
        setTitleValue(transTitle);

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
        mainParsed.metadata?.title !== undefined
          ? mainParsed.metadata.title
          : fileMetadata?.title !== undefined
          ? fileMetadata.title
          : docMetadata?.title || "";
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

      // Se o título mudou nos metadados oficiais, propaga alteração
      if (metaTitle && metaTitle !== fileMetadata?.title) {
        updateFileMetadataRef.current({ title: metaTitle });
      }

      // 6. Recarrega árvores e referências
      if (onReload) onReload();
    } else {
      setEditorToast({
        text:
          (res.data as any)?.error || "Erro ao atualizar documento oficial.",
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

    // Se estiver em modo edição de PR, salva diretamente na branch isolada da proposta
    if (prId) {
      const currentMd = engineRef.current
        ? engineRef.current.getMarkdown()
        : docBodyRef.current;
      const fullContent = parsedRef.current.hasFrontmatter
        ? serializeFrontmatter(parsedRef.current.metadata, currentMd)
        : currentMd;

      try {
        const res = await API.editPRFile({
          id: prId,
          filePath: filePath || "",
          content: fullContent,
          expectedBaseSha: prHeadSha,
          author: user?.login,
          repo: activeRepo?.name,
        });

        if (res.ok && res.data) {
          if (res.data.conflict) {
            setEditorToast({
              text: "Conflito detectado com a versão remota da proposta.",
              type: "warning",
            });
            // Fetch 3-way conflict bundle
            const confRes = await API.getPRConflict({
              pr_id: prId,
              path: filePath,
              repo: activeRepo?.name,
            });
            if (confRes.ok && confRes.data?.merged) {
              setConflictBundleText(confRes.data.merged);
            } else {
              setConflictBundleText(fullContent);
            }
            setIsConflictModalOpen(true);
          } else {
            if (res.data.head_sha) {
              setPrHeadSha(res.data.head_sha);
            }
            if (engineRef.current) {
              engineRef.current.applyDictionaryHighlights();
            }
            setEditorToast({
              text: `Proposta #${prId} atualizada com sucesso na branch!`,
              type: "success",
            });
            setTimeout(() => setEditorToast(null), 2500);
          }
        } else {
          setEditorToast({
            text: res.data?.error || "Erro ao salvar alterações no PR.",
            type: "warning",
          });
        }
      } catch (err: any) {
        setEditorToast({
          text: err.message || "Erro de rede ao salvar no PR.",
          type: "warning",
        });
      }
      return;
    }

    // Se estiver em modo tradução, salva com frontmatter traduzido no arquivo oculto de tradução
    if (
      activeLanguageRef.current.toLowerCase() !==
      defaultLanguageRef.current.toLowerCase()
    ) {
      await saveActiveTranslation();
      if (engineRef.current) {
        engineRef.current.applyDictionaryHighlights();
      }
      setEditorToast({
        text: `Tradução (${activeLanguageRef.current.toUpperCase()}) gravada no disco!`,
        type: "success",
      });
      setTimeout(() => setEditorToast(null), 2500);
      return;
    }

    const currentMd = engineRef.current
      ? engineRef.current.getMarkdown()
      : docBodyRef.current;
    const metaToUse = {
      ...(parsedRef.current?.metadata || {}),
      ...(fileMetadata || {}),
    };
    const fullContent = parsedRef.current?.hasFrontmatter
      ? serializeFrontmatter(metaToUse, currentMd)
      : currentMd;

    const res = await saveCurrentFile(metaToUse, fullContent);
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
  }, [
    filePath,
    saveCurrentFile,
    onCustomSave,
    prId,
    prHeadSha,
    user?.login,
    activeRepo?.name,
    fileMetadata,
  ]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // Initialize & Mount NotionEditorEngine
  useLayoutEffect(() => {
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
          const metaToUse = {
            ...(parsedRef.current?.metadata || {}),
            ...(fileMetadata || {}),
          };
          const newContent = parsedRef.current?.hasFrontmatter
            ? serializeFrontmatter(metaToUse, currentMd)
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

  useLayoutEffect(() => {
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
    // Se o usuário estiver ativamente digitando ou com foco no editor, NUNCA sobrescreve com props defasadas
    if (engineRef.current?.isFocused()) {
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
      const normLastEmitted = (lastEmittedMarkdownRef.current || "")
        .replace(/\r\n/g, "\n")
        .trim();

      // Se o que veio de fora for idêntico ao que emitimos por último localmente, não é uma alteração externa nova
      if (normTarget === normLastEmitted) {
        return;
      }

      // Só recarrega o DOM se a mudança for externa real e diferente do que está no engine
      if (normEngine !== normTarget) {
        lastEmittedMarkdownRef.current = targetText;
        engineRef.current.setMarkdown(targetText, true);
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
  const parsedOriginal = parseFrontmatter(originalContent || "");
  const originalBody = parsedOriginal.hasFrontmatter
    ? parsedOriginal.body
    : originalContent || "";
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
            <div
              className="doc-breadcrumbs-container"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {/* Breadcrumb Path Input / Display */}
              <div
                className="doc-breadcrumbs"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <input
                  type="text"
                  id="doc-path-input"
                  className="doc-path-input"
                  value={
                    filePath
                      ? `${activeRepo?.name || "local"}/${filePath.replace(/^\/+/, "")}`
                      : ""
                  }
                  readOnly
                  placeholder="Selecione ou crie um documento..."
                  spellCheck="false"
                  title={`Caminho unificado: ${
                    filePath
                      ? `${activeRepo?.name || "local"}/${filePath.replace(/^\/+/, "")}`
                      : ""
                  }`}
                  style={{
                    width: "280px",
                    minWidth: "180px",
                  }}
                />

                {/* Action: Copiar Caminho Completo */}
                <button
                  id="btn-copy-doc-path"
                  className="btn-icon-subtle"
                  type="button"
                  title="Copiar caminho completo (repositório/pasta/arquivo). Segure Alt para copiar URL web completa."
                  onClick={(e) => {
                    const fullPath = filePath
                      ? `${activeRepo?.name || "local"}/${filePath.replace(/^\/+/, "")}`
                      : "";
                    if (e.altKey && filePath) {
                      const currentUrl = window.location.href;
                      navigator.clipboard.writeText(currentUrl);
                      setEditorToast({
                        text: `URL completa copiada: ${currentUrl}`,
                        type: "info",
                      });
                    } else if (fullPath) {
                      navigator.clipboard.writeText(fullPath);
                      setEditorToast({
                        text: `Caminho completo copiado: ${fullPath}`,
                        type: "info",
                      });
                    }
                    setTimeout(() => setEditorToast(null), 2500);
                  }}
                  disabled={!filePath}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>

                {/* Action: Revelar na Árvore */}
                <button
                  id="btn-reveal-in-tree"
                  className="btn-icon-subtle"
                  type="button"
                  title="Expandir pastas e revelar na árvore de documentos"
                  onClick={handleRevealInTree}
                  disabled={!filePath}
                >
                  <FolderTree size={14} />
                </button>
              </div>
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
                  translationParsedRef.current = parsedTrans;
                  const bodyContent = parsedTrans.hasFrontmatter
                    ? parsedTrans.body
                    : transContent || "";
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
            onCopyDoc={handleCopyFullDoc}
            onExportDoc={handleExportMarkdown}
            onImportDoc={() => setIsImportModalOpen(true)}
            isGitMode={isGitMode}
            onToggleGitMode={() => {
              const nextMode = !isGitMode;
              setIsGitMode(nextMode);
              if (nextMode) setIsHistoryDrawerOpen(true);
            }}
            isHistoryDrawerOpen={isHistoryDrawerOpen}
            onToggleHistoryDrawer={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            onSave={handleSave}
            saveStatus={saveStatus}
            isDirty={isDirty}
          />
        )}

        {/* Collaborative PR Editing Banner */}
        {isPREditing && (
          <div
            style={{
              margin: "12px 24px 0",
              padding: "10px 16px",
              borderRadius: "var(--radius-md, 8px)",
              background: "var(--md-sys-color-primary-container, #e0f2fe)",
              border: "1px solid var(--md-sys-color-primary, #0284c7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--md-sys-color-on-primary-container, #0369a1)",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  color: "var(--md-sys-color-primary, #0284c7)",
                  fontSize: "22px",
                }}
              >
                rate_review
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>
                  Modo de Edição na Proposta #{prId}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--md-sys-color-on-surface-variant, #334155)",
                  }}
                >
                  As alterações são gravadas na branch da proposta. O seu
                  workspace e branch ativa permanecem intactos.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="ui-btn ui-btn--tonal ui-btn--sm"
                onClick={() =>
                  navigate(
                    `/repo/${encodeURIComponent(activeRepo?.name || "local")}/revisoes`,
                  )
                }
                style={{
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  arrow_back
                </span>
                Voltar para Revisões
              </button>
            </div>
          </div>
        )}

        {/* Translation Mode Banner */}
        {!isTemplateMode &&
          activeLanguage.toLowerCase() !== defaultLanguage.toLowerCase() && (
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

        {/* Merge Conflict Banner */}
        {hasMergeConflict && (
          <div
            style={{
              margin: "12px 24px 0",
              padding: "12px 16px",
              borderRadius: "var(--radius-md, 8px)",
              background: "rgba(234, 179, 8, 0.12)",
              border: "1px solid rgba(234, 179, 8, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--color-on-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className="material-symbols-outlined"
                style={{ color: "#eab308", fontSize: "22px" }}
              >
                merge_type
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>
                  Conflito de Merge Detectado
                </div>
                <div
                  style={{ fontSize: "12px", color: "var(--color-outline)" }}
                >
                  Este documento possui alterações conflitantes entre sua versão
                  local e o repositório Git.
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsConflictModalOpen(true)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                background: "#eab308",
                color: "#000",
                fontWeight: 600,
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px" }}
              >
                splitscreen
              </span>
              Resolver Conflito Visualmente
            </button>
          </div>
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
                border: `1px solid ${activeDeptObj?.color || "#ef4444"}35`,
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
                  backgroundColor: `${activeDeptObj?.color || "#ef4444"}15`,
                  color: activeDeptObj?.color || "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={30} />
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  {activeDeptObj && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "16px",
                        backgroundColor: `${activeDeptObj.color}18`,
                        border: `1px solid ${activeDeptObj.color}45`,
                        color: activeDeptObj.color,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "15px" }}
                      >
                        {activeDeptObj.icon || "folder"}
                      </span>
                      Departamento: {activeDeptObj.name}
                    </div>
                  )}
                </div>

                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "var(--color-on-surface, #0f172a)",
                  }}
                >
                  Documento Restrito por Governança de Acesso
                </h3>
                <p
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "13px",
                    color: "var(--color-outline, #64748b)",
                    lineHeight: "1.6",
                  }}
                >
                  Este documento pertence à pasta restrita{" "}
                  <strong style={{ color: activeDeptObj?.color || "#6366f1" }}>
                    {activeDeptObj?.name ||
                      fileMetadata?.department ||
                      "Restrita"}
                  </strong>{" "}
                  e seu usuário não possui autorização de leitura para este
                  departamento ou rota no projeto.
                </p>

                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.05)",
                    border: "1px solid rgba(99, 102, 241, 0.15)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    fontSize: "12px",
                    color: "var(--color-outline, #64748b)",
                    textAlign: "left",
                    marginBottom: "16px",
                    lineHeight: "1.5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 700,
                      color: "#6366f1",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "16px" }}
                    >
                      lock
                    </span>
                    Como obter acesso a este documento:
                  </div>
                  <div>
                    1. Solicite permissão para o departamento{" "}
                    <strong>
                      {activeDeptObj?.name || fileMetadata?.department}
                    </strong>{" "}
                    ao Administrador do repositório.
                    <br />
                    2. O Administrador pode liberar seu acesso no menu{" "}
                    <strong>
                      Governança & Equipe &rarr; Departamentos & Pastas
                    </strong>
                    .<br />
                    3. As permissões são aplicadas automaticamente com base no
                    seu perfil.
                  </div>
                </div>
              </div>
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
                        disabled={
                          activeLanguage.toLowerCase() !==
                          defaultLanguage.toLowerCase()
                        }
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
                          activeLanguage.toLowerCase() !==
                          defaultLanguage.toLowerCase()
                            ? `Título Oficial (${defaultLanguage.toUpperCase()}) - Metadados são editados no Documento Oficial`
                            : "Título principal do documento (.docs.metadata.json)"
                        }
                      />
                      {activeLanguage.toLowerCase() !==
                        defaultLanguage.toLowerCase() && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginLeft: "12px",
                          }}
                        >
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

      {/* Merge Conflict Resolution Modal */}
      <MergeConflictResolutionModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        filePath={filePath || "documento.md"}
        content={conflictBundleText || content}
        onSaveResolved={async (resolvedContent) => {
          if (prId && filePath) {
            try {
              const res = await API.resolvePRConflict({
                pr_id: prId,
                filePath,
                resolvedContent,
                repo: activeRepo?.name,
              });
              if (res.ok) {
                if (res.data?.commitHash) {
                  setPrHeadSha(res.data.commitHash);
                }
                onChange(resolvedContent);
                if (engineRef.current) {
                  engineRef.current.setMarkdown(resolvedContent);
                  engineRef.current.applyDictionaryHighlights();
                }
                setIsConflictModalOpen(false);
                setEditorToast({
                  text: "Conflito resolvido e gravado na branch do PR!",
                  type: "success",
                });
                setTimeout(() => setEditorToast(null), 3000);
              } else {
                alert(res.data?.error || "Erro ao resolver conflito no PR.");
              }
            } catch (err: any) {
              alert(err.message || "Erro ao resolver conflito no PR.");
            }
          } else {
            onChange(resolvedContent);
            if (engineRef.current) {
              engineRef.current.setMarkdown(resolvedContent);
              engineRef.current.applyDictionaryHighlights();
            }
            setIsConflictModalOpen(false);
            setEditorToast({
              text: "Conflito resolvido com sucesso!",
              type: "success",
            });
            setTimeout(() => setEditorToast(null), 3000);
          }
        }}
      />
    </div>
  );
};

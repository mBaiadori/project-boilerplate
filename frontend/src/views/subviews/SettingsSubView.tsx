import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import {
  SelectDropdown,
  type SelectOption,
} from "../../components/common/SelectDropdown";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  FormField,
  Input,
  Badge,
  AlertBanner,
  Modal,
  PageContainer,
  PageHeader,
  PageBody,
  Stack,
  Row,
  Divider,
} from "../../components/ui";
import { TaxonomyChipEditor } from "../../components/common/TaxonomyChipEditor";
import { RAINBOW_28_HUES } from "../../components/common/ColorDotPicker";
import { useNavigate } from "react-router-dom";
import {
  Cpu,
  RefreshCw,
  Trash2,
  Save,
  LogOut,
  Layers,
  AlertTriangle,
  FileText,
  ExternalLink,
  Terminal,
  Zap,
  Sparkles,
  Copy,
  Globe,
} from "lucide-react";
import { FirstRunWizard } from "../../components/onboarding/FirstRunWizard";
import type {
  TaxonomyItem,
  DocumentMetadataItem,
  SupportedLanguage,
} from "../../types";

export const ENGINE_CATALOG_LANGUAGES: SupportedLanguage[] = [
  { code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
  { code: "pt", label: "Português (Portugal)", flag: "🇵🇹" },
  { code: "en", label: "Inglês (English)", flag: "🇺🇸" },
  { code: "es", label: "Espanhol (Español)", flag: "🇪🇸" },
  { code: "fr", label: "Francês (Français)", flag: "🇫🇷" },
  { code: "de", label: "Alemão (Deutsch)", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "zh-CN", label: "Chinês Simplificado (简体中文)", flag: "🇨🇳" },
  { code: "zh-TW", label: "Chinês Tradicional (繁體中文)", flag: "🇹🇼" },
  { code: "ja", label: "Japonês (日本語)", flag: "🇯🇵" },
  { code: "ko", label: "Coreano (한국어)", flag: "🇰🇷" },
  { code: "ru", label: "Russo (Русский)", flag: "🇷🇺" },
  { code: "nl", label: "Holandês (Nederlands)", flag: "🇳🇱" },
  { code: "pl", label: "Polonês (Polski)", flag: "🇵🇱" },
  { code: "sv", label: "Sueco (Svenska)", flag: "🇸🇪" },
  { code: "da", label: "Dinamarquês (Dansk)", flag: "🇩🇰" },
  { code: "no", label: "Norueguês (Norsk)", flag: "🇳🇴" },
  { code: "fi", label: "Finlandês (Suomi)", flag: "🇫🇮" },
  { code: "cs", label: "Tcheco (Čeština)", flag: "🇨🇿" },
  { code: "el", label: "Grego (Ελληνικά)", flag: "🇬🇷" },
  { code: "he", label: "Hebraico (עברית)", flag: "🇮🇱" },
  { code: "ar", label: "Árabe (العربية)", flag: "🇸🇦" },
  { code: "hi", label: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { code: "tr", label: "Turco (Türkçe)", flag: "🇹🇷" },
  { code: "id", label: "Indonésio (Bahasa Indonesia)", flag: "🇮🇩" },
  { code: "vi", label: "Vietnamita (Tiếng Việt)", flag: "🇻🇳" },
  { code: "th", label: "Tailandês (ไทย)", flag: "🇹🇭" },
  { code: "uk", label: "Ucraniano (Українська)", flag: "🇺🇦" },
  { code: "ro", label: "Romeno (Română)", flag: "🇷🇴" },
  { code: "hu", label: "Húngaro (Magyar)", flag: "🇭🇺" },
  { code: "bg", label: "Búlgaro (Български)", flag: "🇧🇬" },
  { code: "sk", label: "Eslovaco (Slovenčina)", flag: "🇸🇰" },
  { code: "hr", label: "Croata (Hrvatski)", flag: "🇭🇷" },
  { code: "ca", label: "Catalão (Català)", flag: "🇪🇸" },
  { code: "ms", label: "Malaio (Bahasa Melayu)", flag: "🇲🇾" },
  { code: "tl", label: "Filipino / Tagalog", flag: "🇵🇭" },
  { code: "bn", label: "Bengali (বাংলা)", flag: "🇧🇩" },
  { code: "fa", label: "Persa / Farsi (فارسی)", flag: "🇮🇷" },
];

export const ALL_28_COLORS = RAINBOW_28_HUES.flatMap((h) => h.colors);

// Helper para normalizar nome de status com hífen e minúsculas
function formatStatusName(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export const SettingsSubView: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { aiSettings, saveAISettings } = useAI();
  const { activeRepo, loadProjectConfig, saveProjectConfig } = useWorkspace();

  // AI Provider State
  const [provider, setProvider] = useState<string>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("http://localhost:11434/v1");
  const [modelsList, setModelsList] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Categories State
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatColor, setNewCatColor] = useState<string>("#3b82f6");
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState<string>("");
  const [editCatColor, setEditCatColor] = useState<string>("#3b82f6");

  // Badges (Tipos de Documento) State
  const [badges, setBadges] = useState<TaxonomyItem[]>([]);
  const [isAddingBadge, setIsAddingBadge] = useState<boolean>(false);
  const [newBadgeName, setNewBadgeName] = useState<string>("");
  const [newBadgeColor, setNewBadgeColor] = useState<string>("#3b82f6");
  const [editingBadgeIndex, setEditingBadgeIndex] = useState<number | null>(
    null,
  );
  const [editBadgeName, setEditBadgeName] = useState<string>("");
  const [editBadgeColor, setEditBadgeColor] = useState<string>("#3b82f6");

  // Tags State
  const [tags, setTags] = useState<TaxonomyItem[]>([]);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [newTagName, setNewTagName] = useState<string>("");
  const [newTagColor, setNewTagColor] = useState<string>("#6366f1");
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState<string>("");
  const [editTagColor, setEditTagColor] = useState<string>("#6366f1");

  // Statuses State (agora com { name, color })
  const [statuses, setStatuses] = useState<TaxonomyItem[]>([]);
  const [isAddingStatus, setIsAddingStatus] = useState<boolean>(false);
  const [newStatusName, setNewStatusName] = useState<string>("");
  const [newStatusColor, setNewStatusColor] = useState<string>("#22c55e");
  const [editingStatusIndex, setEditingStatusIndex] = useState<number | null>(
    null,
  );
  const [editStatusName, setEditStatusName] = useState<string>("");
  const [editStatusColor, setEditStatusColor] = useState<string>("#22c55e");

  // Documentos no workspace para verificar referências
  const [docMetadataList, setDocMetadataList] = useState<
    DocumentMetadataItem[]
  >([]);

  // Estado de confirmação de exclusão com alerta de referências
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    type: "status" | "category" | "tag" | "badge";
    nameOrKey: string;
    label: string;
    referencingDocs: DocumentMetadataItem[];
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    type: "status",
    nameOrKey: "",
    label: "",
    referencingDocs: [],
    onConfirm: async () => {},
  });

  // AI Template Prompt State
  const [projectTemplatePrompt, setProjectTemplatePrompt] =
    useState<string>("");
  const [minApprovals, setMinApprovals] = useState<number>(1);

  // Language & SSOT Translation Governance State
  const [defaultLanguage, setDefaultLanguage] = useState<string>("pt-BR");
  const [supportedLanguages, setSupportedLanguages] = useState<
    SupportedLanguage[]
  >([
    { code: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "es", label: "Español", flag: "🇪🇸" },
  ]);
  const [translationEngine, setTranslationEngine] =
    useState<string>("lightweight-local");
  const [languageChangeDialog, setLanguageChangeDialog] = useState<{
    isOpen: boolean;
    targetLang: string;
  }>({ isOpen: false, targetLang: "" });

  // Modal para adicionar novo idioma a partir do catálogo do motor
  const [isAddLanguageModalOpen, setIsAddLanguageModalOpen] = useState(false);
  const [languageSearchFilter, setLanguageSearchFilter] = useState("");

  // Connected Agent Harness State (Antigravity CLI / Claude Code / Direct API)
  const [harnessProvider, setHarnessProvider] = useState<string>("antigravity");
  const [antigravityCliPath, setAntigravityCliPath] = useState<string>("");
  const [claudeCliPath, setClaudeCliPath] = useState<string>("");
  const [agentEffort, setAgentEffort] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [agentModelOverride, setAgentModelOverride] = useState<string>("");
  const [detectedProviders, setDetectedProviders] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      mode: string;
      isAvailable: boolean;
      isAuthenticated: boolean;
      statusMessage?: string;
    }>
  >([]);
  const [isCheckingHarness, setIsCheckingHarness] = useState<boolean>(false);
  const [harnessCheckFeedback, setHarnessCheckFeedback] = useState<
    string | null
  >(null);

  const checkHarnessProviders = useCallback(async () => {
    setIsCheckingHarness(true);
    try {
      const res = await API.getAIProviders();
      if (res.ok && res.data?.providers) {
        setDetectedProviders(res.data.providers);
        setHarnessCheckFeedback(
          "Conectividade e status dos agentes atualizados!",
        );
      }
    } catch (err) {
      console.error(
        "[SettingsSubView] Erro ao checar provedores de agentes:",
        err,
      );
      setHarnessCheckFeedback("Erro ao verificar conectividade dos agentes.");
    } finally {
      setIsCheckingHarness(false);
      setTimeout(() => setHarnessCheckFeedback(null), 3500);
    }
  }, []);

  // Status feedback
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] =
    useState<boolean>(false);
  const [diagnosticsFeedback, setDiagnosticsFeedback] = useState<string | null>(
    null,
  );

  const handleCopyDiagnostics = async () => {
    try {
      const res = await API.getDiagnostics();
      if (res.ok && res.data) {
        const json = JSON.stringify(res.data, null, 2);
        await navigator.clipboard.writeText(json);
        setDiagnosticsFeedback(
          "Diagnóstico sanitizado copiado para a área de transferência!",
        );
        setTimeout(() => setDiagnosticsFeedback(null), 4000);
      }
    } catch {
      setDiagnosticsFeedback("Falha ao coletar diagnóstico do sistema.");
      setTimeout(() => setDiagnosticsFeedback(null), 4000);
    }
  };

  const fetchModelsForProvider = useCallback(
    async (provId: string, customKey?: string, customEp?: string) => {
      setIsLoadingModels(true);
      try {
        const res = await API.getAIModels({
          provider: provId,
          api_key: customKey || apiKey || undefined,
          custom_endpoint: customEp || endpoint || undefined,
        });

        if (res.ok && res.data) {
          let items: Array<{ id: string; name: string; description?: string }> =
            [];
          if (res.data.detailedModels && res.data.detailedModels.length > 0) {
            items = res.data.detailedModels;
          } else if (res.data.models && res.data.models.length > 0) {
            items = res.data.models.map((m: any) =>
              typeof m === "string" ? { id: m, name: m } : m,
            );
          }

          if (items.length > 0) {
            setModelsList(items);
          } else {
            setModelsList([]);
          }
        } else {
          setModelsList([]);
        }
      } catch (err) {
        console.error(
          "[SettingsSubView] Erro ao buscar lista de modelos:",
          err,
        );
        setModelsList([]);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [apiKey, endpoint],
  );

  useEffect(() => {
    if (aiSettings) {
      const activeProv =
        aiSettings.active_provider || aiSettings.provider || "gemini";
      setProvider(activeProv);
      setModel(
        aiSettings.active_model ||
          aiSettings.model ||
          (activeProv === "gemini" ? "gemini-2.5-flash" : "gpt-4o"),
      );
      setEndpoint(aiSettings.custom_endpoint || "http://localhost:11434/v1");
      if (aiSettings.default_provider) {
        setHarnessProvider(aiSettings.default_provider);
      }
      if (aiSettings.antigravity_cli_path) {
        setAntigravityCliPath(aiSettings.antigravity_cli_path);
      }
      if (aiSettings.claude_cli_path) {
        setClaudeCliPath(aiSettings.claude_cli_path);
      }
      if (aiSettings.agent_effort) {
        setAgentEffort(aiSettings.agent_effort);
      }
      if (aiSettings.agent_model) {
        setAgentModelOverride(aiSettings.agent_model);
      }
      fetchModelsForProvider(activeProv, undefined, aiSettings.custom_endpoint);
    }
    checkHarnessProviders();
  }, [aiSettings, fetchModelsForProvider, checkHarnessProviders]);

  const selectOptions: SelectOption[] = useMemo(() => {
    if (modelsList.length === 0) {
      return [
        { value: model, label: model, description: "Modelo ativo selecionado" },
        {
          value: "gemini-2.5-flash",
          label: "Gemini 2.5 Flash",
          description: "Alta velocidade e capacidades multimodais",
          badge: "Flash",
          badgeType: "success",
        },
        {
          value: "gemini-2.5-pro",
          label: "Gemini 2.5 Pro",
          description: "Raciocínio complexo e codificação profunda",
          badge: "Pro",
          badgeType: "warning",
        },
        {
          value: "gemini-1.5-flash",
          label: "Gemini 1.5 Flash",
          description: "Modelo versátil",
          badge: "Flash",
          badgeType: "info",
        },
      ];
    }

    return modelsList.map((m) => {
      let badge: string | undefined;
      let badgeType: "primary" | "success" | "warning" | "neutral" | "info" =
        "primary";

      if (m.id.includes("pro")) {
        badge = "Pro";
        badgeType = "warning";
      } else if (m.id.includes("flash")) {
        badge = "Flash";
        badgeType = "success";
      } else if (m.id.includes("reason") || m.id.includes("r1")) {
        badge = "Reasoner";
        badgeType = "info";
      }

      return {
        value: m.id,
        label: m.name !== m.id ? m.name : m.id,
        description: m.description || m.id,
        icon: "smart_toy",
        badge,
        badgeType,
      };
    });
  }, [modelsList, model]);

  // Carregar Configurações e Documentos
  const loadAllSettings = useCallback(async () => {
    try {
      // 1. Carregar .project.config.json
      const pCfg = await loadProjectConfig();
      if (pCfg) {
        if (Array.isArray(pCfg.categories)) {
          const parsedCats: TaxonomyItem[] = pCfg.categories.map(
            (c: any, idx: number) => {
              if (typeof c === "string") {
                return {
                  name: c,
                  color: ALL_28_COLORS[idx % ALL_28_COLORS.length],
                };
              }
              return {
                name: String(c.name || ""),
                color: String(
                  c.color || ALL_28_COLORS[idx % ALL_28_COLORS.length],
                ),
              };
            },
          );
          setCategories(parsedCats);
        }

        if (Array.isArray(pCfg.badges)) {
          const defaultBadgeColors: Record<string, string> = {
            RFC: "#3b82f6",
            ADR: "#8b5cf6",
            PRD: "#10b981",
            DOC: "#64748b",
            API: "#f59e0b",
            SPEC: "#06b6d4",
            GUIDE: "#ec4899",
            TEST: "#14b8a6",
          };
          const parsedBadges: TaxonomyItem[] = pCfg.badges.map(
            (b: any, idx: number) => {
              if (typeof b === "string") {
                const name = b.trim().toUpperCase();
                return {
                  name,
                  color:
                    defaultBadgeColors[name] ||
                    ALL_28_COLORS[(idx * 2) % ALL_28_COLORS.length],
                };
              }
              const name = String(b.name || "")
                .trim()
                .toUpperCase();
              const color = String(
                b.color ||
                  defaultBadgeColors[name] ||
                  ALL_28_COLORS[(idx * 2) % ALL_28_COLORS.length],
              );
              return { name, color };
            },
          );
          setBadges(parsedBadges);
        }

        if (Array.isArray(pCfg.tags)) {
          const parsedTags: TaxonomyItem[] = pCfg.tags.map(
            (t: any, idx: number) => {
              if (typeof t === "string") {
                return {
                  name: t,
                  color: ALL_28_COLORS[(idx + 4) % ALL_28_COLORS.length],
                };
              }
              return {
                name: String(t.name || ""),
                color: String(
                  t.color || ALL_28_COLORS[(idx + 4) % ALL_28_COLORS.length],
                ),
              };
            },
          );
          setTags(parsedTags);
        }

        if (Array.isArray(pCfg.statuses)) {
          const defaultColors: Record<string, string> = {
            draft: "#fdba74",
            review: "#67e8f9",
            "in-review": "#67e8f9",
            proposed: "#fde047",
            approved: "#86efac",
            superseded: "#d8b4fe",
            deprecated: "#fca5a5",
          };
          const parsedStatuses: TaxonomyItem[] = pCfg.statuses.map(
            (s: any, idx: number) => {
              if (typeof s === "string") {
                const name = formatStatusName(s);
                return {
                  name,
                  color: ALL_28_COLORS[(idx * 3) % ALL_28_COLORS.length],
                };
              }
              const name = formatStatusName(
                String(s.name || s.key || s.label || `status-${idx + 1}`),
              );
              const color = String(
                s.color ||
                  defaultColors[name] ||
                  ALL_28_COLORS[(idx * 3) % ALL_28_COLORS.length],
              );
              return { name, color };
            },
          );
          setStatuses(parsedStatuses);
        }

        if (pCfg.ai_template_prompt) {
          setProjectTemplatePrompt(pCfg.ai_template_prompt);
        }

        if (pCfg.governance_rules?.min_approvals_default !== undefined) {
          setMinApprovals(pCfg.governance_rules.min_approvals_default);
        }

        if (pCfg.default_language) {
          setDefaultLanguage(pCfg.default_language);
        }

        if (
          Array.isArray(pCfg.supported_languages) &&
          pCfg.supported_languages.length > 0
        ) {
          setSupportedLanguages(pCfg.supported_languages);
        }

        if (pCfg.translation_engine) {
          setTranslationEngine(pCfg.translation_engine);
        }
      }

      // 2. Carregar metadados dos documentos para checar referências
      const metaRes = await API.getProjectMetadata(activeRepo?.name);
      if (metaRes.ok && Array.isArray(metaRes.data)) {
        setDocMetadataList(metaRes.data);
      }
    } catch (err) {
      console.error("[SettingsSubView] Erro ao carregar configurações:", err);
    }
  }, [loadProjectConfig, activeRepo?.name]);

  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  // Propagação de renomeação de categoria em documentos
  const propagateCategoryRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const affectedDocs = docMetadataList.filter(
      (d) => d.categories === oldName || d.category === oldName,
    );
    for (const doc of affectedDocs) {
      try {
        await API.updateDocumentMetadataItem({
          path: doc.path,
          meta: { categories: newName },
          repo: activeRepo?.name,
        });
      } catch (err) {
        console.warn(
          `Erro ao atualizar categoria no documento ${doc.path}:`,
          err,
        );
      }
    }
  };

  // Propagação de renomeação de badge (tipo) em documentos
  const propagateBadgeRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const affectedDocs = docMetadataList.filter(
      (d) =>
        (d.badge && d.badge.toUpperCase() === oldName.toUpperCase()) ||
        (d.type && d.type.toUpperCase() === oldName.toUpperCase()),
    );
    for (const doc of affectedDocs) {
      try {
        await API.updateDocumentMetadataItem({
          path: doc.path,
          meta: { badge: newName },
          repo: activeRepo?.name,
        });
      } catch (err) {
        console.warn(`Erro ao atualizar badge no documento ${doc.path}:`, err);
      }
    }
  };

  // Propagação de renomeação de tag em documentos
  const propagateTagRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const affectedDocs = docMetadataList.filter(
      (d) => Array.isArray(d.tags) && d.tags.includes(oldName),
    );
    for (const doc of affectedDocs) {
      const updatedTags = doc.tags.map((t) => (t === oldName ? newName : t));
      try {
        await API.updateDocumentMetadataItem({
          path: doc.path,
          meta: { tags: updatedTags },
          repo: activeRepo?.name,
        });
      } catch (err) {
        console.warn(`Erro ao atualizar tag no documento ${doc.path}:`, err);
      }
    }
  };

  // Propagação de renomeação de status em documentos
  const propagateStatusRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const affectedDocs = docMetadataList.filter((d) => d.status === oldName);
    for (const doc of affectedDocs) {
      try {
        await API.updateDocumentMetadataItem({
          path: doc.path,
          meta: { status: newName },
          repo: activeRepo?.name,
        });
      } catch (err) {
        console.warn(`Erro ao atualizar status no documento ${doc.path}:`, err);
      }
    }
  };

  // Handlers para Categorias
  const handleAddCategory = () => {
    const trimmed = newCatName.trim().toLowerCase();
    if (!trimmed || categories.some((c) => c.name.toLowerCase() === trimmed))
      return;
    setCategories([...categories, { name: trimmed, color: newCatColor }]);
    setNewCatName("");
    setIsAddingCategory(false);
  };

  const handleRequestRemoveCategory = (index: number) => {
    const target = categories[index];
    if (!target) return;
    const referencing = docMetadataList.filter(
      (d) => d.categories === target.name || d.category === target.name,
    );

    if (referencing.length > 0) {
      setDeleteDialog({
        isOpen: true,
        type: "category",
        nameOrKey: target.name,
        label: target.name.toUpperCase(),
        referencingDocs: referencing,
        onConfirm: async () => {
          // Desvincular nos documentos
          for (const doc of referencing) {
            try {
              await API.updateDocumentMetadataItem({
                path: doc.path,
                meta: { categories: "" },
                repo: activeRepo?.name,
              });
            } catch {}
          }
          setCategories((prev) => prev.filter((_, i) => i !== index));
          setDeleteDialog((d) => ({ ...d, isOpen: false }));
        },
      });
    } else {
      setCategories(categories.filter((_, i) => i !== index));
      if (editingCatIndex === index) setEditingCatIndex(null);
    }
  };

  const handleStartEditCategory = (index: number) => {
    setEditingCatIndex(index);
    setEditCatName(categories[index].name);
    setEditCatColor(categories[index].color);
  };

  const handleSaveEditCategory = async () => {
    if (editingCatIndex === null) return;
    const oldName = categories[editingCatIndex].name;
    const trimmed = editCatName.trim().toLowerCase();
    if (!trimmed) return;

    const updated = [...categories];
    updated[editingCatIndex] = { name: trimmed, color: editCatColor };
    setCategories(updated);
    setEditingCatIndex(null);

    if (oldName !== trimmed) {
      await propagateCategoryRename(oldName, trimmed);
    }
  };

  // Handlers para Badges (Tipos de Documento)
  const handleAddBadge = () => {
    const trimmed = newBadgeName.trim().toUpperCase();
    if (!trimmed || badges.some((b) => b.name.toUpperCase() === trimmed))
      return;
    setBadges([...badges, { name: trimmed, color: newBadgeColor }]);
    setNewBadgeName("");
    setIsAddingBadge(false);
  };

  const handleRequestRemoveBadge = (index: number) => {
    const target = badges[index];
    if (!target) return;
    const referencing = docMetadataList.filter(
      (d) =>
        (d.badge && d.badge.toUpperCase() === target.name.toUpperCase()) ||
        (d.type && d.type.toUpperCase() === target.name.toUpperCase()),
    );

    if (referencing.length > 0) {
      setDeleteDialog({
        isOpen: true,
        type: "badge",
        nameOrKey: target.name,
        label: target.name.toUpperCase(),
        referencingDocs: referencing,
        onConfirm: async () => {
          for (const doc of referencing) {
            try {
              await API.updateDocumentMetadataItem({
                path: doc.path,
                meta: { badge: "" },
                repo: activeRepo?.name,
              });
            } catch {}
          }
          setBadges((prev) => prev.filter((_, i) => i !== index));
          setDeleteDialog((d) => ({ ...d, isOpen: false }));
        },
      });
    } else {
      setBadges(badges.filter((_, i) => i !== index));
      if (editingBadgeIndex === index) setEditingBadgeIndex(null);
    }
  };

  const handleStartEditBadge = (index: number) => {
    setEditingBadgeIndex(index);
    setEditBadgeName(badges[index].name);
    setEditBadgeColor(badges[index].color || "#3b82f6");
  };

  const handleSaveEditBadge = async () => {
    if (editingBadgeIndex === null) return;
    const oldName = badges[editingBadgeIndex].name;
    const trimmed = editBadgeName.trim().toUpperCase();
    if (!trimmed) return;

    const updated = [...badges];
    updated[editingBadgeIndex] = {
      name: trimmed,
      color: editBadgeColor,
    };
    setBadges(updated);
    setEditingBadgeIndex(null);

    if (oldName !== trimmed) {
      await propagateBadgeRename(oldName, trimmed);
    }
  };

  // Handlers para Tags
  const handleAddTag = () => {
    const trimmed = newTagName.trim().toLowerCase();
    if (!trimmed || tags.some((t) => t.name.toLowerCase() === trimmed)) return;
    setTags([...tags, { name: trimmed, color: newTagColor }]);
    setNewTagName("");
    setIsAddingTag(false);
  };

  const handleRequestRemoveTag = (index: number) => {
    const target = tags[index];
    if (!target) return;
    const referencing = docMetadataList.filter(
      (d) => Array.isArray(d.tags) && d.tags.includes(target.name),
    );

    if (referencing.length > 0) {
      setDeleteDialog({
        isOpen: true,
        type: "tag",
        nameOrKey: target.name,
        label: `#${target.name}`,
        referencingDocs: referencing,
        onConfirm: async () => {
          for (const doc of referencing) {
            const cleanTags = doc.tags.filter((t) => t !== target.name);
            try {
              await API.updateDocumentMetadataItem({
                path: doc.path,
                meta: { tags: cleanTags },
                repo: activeRepo?.name,
              });
            } catch {}
          }
          setTags((prev) => prev.filter((_, i) => i !== index));
          setDeleteDialog((d) => ({ ...d, isOpen: false }));
        },
      });
    } else {
      setTags(tags.filter((_, i) => i !== index));
      if (editingTagIndex === index) setEditingTagIndex(null);
    }
  };

  const handleStartEditTag = (index: number) => {
    setEditingTagIndex(index);
    setEditTagName(tags[index].name);
    setEditTagColor(tags[index].color);
  };

  const handleSaveEditTag = async () => {
    if (editingTagIndex === null) return;
    const oldName = tags[editingTagIndex].name;
    const trimmed = editTagName.trim().toLowerCase();
    if (!trimmed) return;

    const updated = [...tags];
    updated[editingTagIndex] = { name: trimmed, color: editTagColor };
    setTags(updated);
    setEditingTagIndex(null);

    if (oldName !== trimmed) {
      await propagateTagRename(oldName, trimmed);
    }
  };

  // Handlers para Statuses (com formatação hífen/minúscula e Cores)
  const handleAddStatus = () => {
    const formatted = formatStatusName(newStatusName);
    if (!formatted || statuses.some((s) => s.name === formatted)) return;

    setStatuses([...statuses, { name: formatted, color: newStatusColor }]);
    setNewStatusName("");
    setIsAddingStatus(false);
  };

  const handleRequestRemoveStatus = (index: number) => {
    const target = statuses[index];
    if (!target) return;
    const referencing = docMetadataList.filter((d) => d.status === target.name);

    if (referencing.length > 0) {
      setDeleteDialog({
        isOpen: true,
        type: "status",
        nameOrKey: target.name,
        label: target.name.toUpperCase(),
        referencingDocs: referencing,
        onConfirm: async () => {
          for (const doc of referencing) {
            try {
              await API.updateDocumentMetadataItem({
                path: doc.path,
                meta: { status: "" },
                repo: activeRepo?.name,
              });
            } catch {}
          }
          setStatuses((prev) => prev.filter((_, i) => i !== index));
          setDeleteDialog((d) => ({ ...d, isOpen: false }));
        },
      });
    } else {
      setStatuses(statuses.filter((_, i) => i !== index));
      if (editingStatusIndex === index) setEditingStatusIndex(null);
    }
  };

  const handleStartEditStatus = (index: number) => {
    setEditingStatusIndex(index);
    setEditStatusName(statuses[index].name);
    setEditStatusColor(statuses[index].color || "#22c55e");
  };

  const handleSaveEditStatus = async () => {
    if (editingStatusIndex === null) return;
    const oldName = statuses[editingStatusIndex].name;
    const formatted = formatStatusName(editStatusName);
    if (!formatted) return;

    const updated = [...statuses];
    updated[editingStatusIndex] = {
      name: formatted,
      color: editStatusColor,
    };
    setStatuses(updated);
    setEditingStatusIndex(null);

    if (oldName !== formatted) {
      await propagateStatusRename(oldName, formatted);
    }
  };

  const handleSaveAISettings = async () => {
    try {
      await saveAISettings(provider, model, apiKey, endpoint, {
        default_provider: harnessProvider,
        antigravity_cli_path: antigravityCliPath,
        claude_cli_path: claudeCliPath,
        agent_effort: agentEffort,
        agent_model: agentModelOverride,
      });
      await checkHarnessProviders();
      setSaveStatus("Configurações de IA e Agentes CLI salvas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("[SettingsSubView] Erro ao salvar IA:", err);
      setSaveStatus("Erro ao salvar configurações de IA.");
    }
  };

  const handleSaveAllSettings = async () => {
    setIsSavingAll(true);
    try {
      await saveAISettings(provider, model, apiKey, endpoint, {
        default_provider: harnessProvider,
        antigravity_cli_path: antigravityCliPath,
        claude_cli_path: claudeCliPath,
        agent_effort: agentEffort,
        agent_model: agentModelOverride,
      });
      await saveProjectConfig({
        categories,
        badges,
        tags,
        statuses,
        ai_template_prompt: projectTemplatePrompt,
        governance_rules: {
          min_approvals_default: minApprovals,
        },
        default_language: defaultLanguage,
        supported_languages: supportedLanguages,
        translation_engine: translationEngine,
      });
      await checkHarnessProviders();

      setSaveStatus("Todas as configurações foram salvas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("[SettingsSubView] Erro ao salvar tudo:", err);
      setSaveStatus("Erro ao salvar configurações gerais.");
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <PageContainer className="settings-subview-container">
      {/* Cabeçalho */}
      <PageHeader
        title="Configurações"
        badge={
          <Badge variant="primary" size="sm">
            {activeRepo?.name || "local"}
          </Badge>
        }
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button
              id="btn-reopen-onboarding"
              variant="subtle"
              size="sm"
              leftIcon={<Sparkles size={13} />}
              onClick={() => setShowOnboardingModal(true)}
            >
              Assistente / Tour
            </Button>
            <Button
              id="btn-copy-diagnostics"
              variant="subtle"
              size="sm"
              leftIcon={<Copy size={13} />}
              onClick={handleCopyDiagnostics}
            >
              Diagnóstico Suporte
            </Button>
            <Button
              id="btn-save-top-all-settings"
              variant="primary"
              size="sm"
              leftIcon={<Save size={13} />}
              onClick={handleSaveAllSettings}
              disabled={isSavingAll}
            >
              {isSavingAll ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      />

      {/* Conteúdo Principal */}
      <PageBody>
        <div
          style={{
            maxWidth: "960px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {saveStatus && (
            <AlertBanner
              type={saveStatus.includes("Erro") ? "error" : "success"}
              title={saveStatus}
              onClose={() => setSaveStatus(null)}
            />
          )}

          {diagnosticsFeedback && (
            <AlertBanner
              type={diagnosticsFeedback.includes("Falha") ? "error" : "success"}
              title={diagnosticsFeedback}
              onClose={() => setDiagnosticsFeedback(null)}
            />
          )}

          {/* 1. SEÇÃO: CATEGORIAS, TAGS & STATUS */}
          <section id="categories-tags" style={{ scrollMarginTop: "72px" }}>
            <Card variant="elevated">
              <CardHeader
                title="Taxonomia & Governança"
                subtitle="Personalize categorias, tags, badges e status com cores integradas do sistema."
              />
              <CardContent>
                <Stack gap="md">
                  {/* 1.1 Categorias */}
                  <Stack gap="xs">
                    <span className="ui-text-subtitle ui-text-bold">
                      Categorias
                    </span>
                    <TaxonomyChipEditor
                      items={categories}
                      editingIndex={editingCatIndex}
                      editName={editCatName}
                      editColor={editCatColor}
                      onStartEdit={handleStartEditCategory}
                      onEditNameChange={setEditCatName}
                      onEditColorChange={setEditCatColor}
                      onSaveEdit={handleSaveEditCategory}
                      onCancelEdit={() => setEditingCatIndex(null)}
                      onRequestRemove={handleRequestRemoveCategory}
                      isAdding={isAddingCategory}
                      newName={newCatName}
                      newColor={newCatColor}
                      onStartAdd={() => setIsAddingCategory(true)}
                      onNewNameChange={setNewCatName}
                      onNewColorChange={setNewCatColor}
                      onSaveAdd={handleAddCategory}
                      onCancelAdd={() => {
                        setIsAddingCategory(false);
                        setNewCatName("");
                      }}
                      placeholder="categoria..."
                      addTooltip="Adicionar Categoria"
                    />
                  </Stack>

                  <Divider />

                  {/* 1.2 Tipos de Documento / Badges */}
                  <Stack gap="xs">
                    <Row align="center" justify="between">
                      <span className="ui-text-subtitle ui-text-bold">
                        Tipos de Documento (Badges)
                      </span>
                    </Row>
                    <TaxonomyChipEditor
                      items={badges}
                      editingIndex={editingBadgeIndex}
                      editName={editBadgeName}
                      editColor={editBadgeColor}
                      onStartEdit={handleStartEditBadge}
                      onEditNameChange={setEditBadgeName}
                      onEditColorChange={setEditBadgeColor}
                      onSaveEdit={handleSaveEditBadge}
                      onCancelEdit={() => setEditingBadgeIndex(null)}
                      onRequestRemove={handleRequestRemoveBadge}
                      isAdding={isAddingBadge}
                      newName={newBadgeName}
                      newColor={newBadgeColor}
                      onStartAdd={() => setIsAddingBadge(true)}
                      onNewNameChange={setNewBadgeName}
                      onNewColorChange={setNewBadgeColor}
                      onSaveAdd={handleAddBadge}
                      onCancelAdd={() => {
                        setIsAddingBadge(false);
                        setNewBadgeName("");
                      }}
                      placeholder="tipo..."
                      addTooltip="Adicionar Tipo de Documento / Badge"
                    />
                  </Stack>

                  <Divider />

                  {/* 1.3 Tags */}
                  <Stack gap="xs">
                    <span className="ui-text-subtitle ui-text-bold">Tags</span>
                    <TaxonomyChipEditor
                      items={tags}
                      editingIndex={editingTagIndex}
                      editName={editTagName}
                      editColor={editTagColor}
                      onStartEdit={handleStartEditTag}
                      onEditNameChange={setEditTagName}
                      onEditColorChange={setEditTagColor}
                      onSaveEdit={handleSaveEditTag}
                      onCancelEdit={() => setEditingTagIndex(null)}
                      onRequestRemove={handleRequestRemoveTag}
                      isAdding={isAddingTag}
                      newName={newTagName}
                      newColor={newTagColor}
                      onStartAdd={() => setIsAddingTag(true)}
                      onNewNameChange={setNewTagName}
                      onNewColorChange={setNewTagColor}
                      onSaveAdd={handleAddTag}
                      onCancelAdd={() => {
                        setIsAddingTag(false);
                        setNewTagName("");
                      }}
                      placeholder="tag..."
                      addTooltip="Adicionar Tag"
                    />
                  </Stack>

                  <Divider />

                  {/* 1.4 Status */}
                  <Stack gap="xs">
                    <span className="ui-text-subtitle ui-text-bold">
                      Status de Documento
                    </span>
                    <TaxonomyChipEditor
                      items={statuses}
                      editingIndex={editingStatusIndex}
                      editName={editStatusName}
                      editColor={editStatusColor}
                      onStartEdit={handleStartEditStatus}
                      onEditNameChange={setEditStatusName}
                      onEditColorChange={setEditStatusColor}
                      onSaveEdit={handleSaveEditStatus}
                      onCancelEdit={() => setEditingStatusIndex(null)}
                      onRequestRemove={handleRequestRemoveStatus}
                      isAdding={isAddingStatus}
                      newName={newStatusName}
                      newColor={newStatusColor}
                      onStartAdd={() => setIsAddingStatus(true)}
                      onNewNameChange={setNewStatusName}
                      onNewColorChange={setNewStatusColor}
                      onSaveAdd={handleAddStatus}
                      onCancelAdd={() => {
                        setIsAddingStatus(false);
                        setNewStatusName("");
                      }}
                      placeholder="status..."
                      addTooltip="Adicionar Status"
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </section>

          {/* 1.5 SEÇÃO: GOVERNANÇA LINGUÍSTICA & IDIOMAS DO PROJETO */}
          <section
            id="languages-governance"
            style={{ scrollMarginTop: "72px" }}
          >
            <Card variant="elevated">
              <CardHeader
                title={
                  <div className="ui-row ui-row--align-center ui-row--sm">
                    <Globe size={17} style={{ color: "#0ea5e9" }} />
                    <span>Governança Linguística & Idiomas do Projeto</span>
                  </div>
                }
                subtitle="Configure o idioma oficial do projeto, os idiomas disponíveis para tradução sob demanda e o motor de tradução."
                actions={
                  <Badge variant="primary">
                    OFICIAL: {defaultLanguage.toUpperCase()}
                  </Badge>
                }
              />

              <CardContent>
                <Stack gap="lg">
                  {/* Linha 1: Idioma Oficial - Seleciona apenas entre os idiomas suportados habilitados */}
                  <Stack gap="xs">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span className="ui-text-subtitle ui-text-bold">
                          Idioma Oficial do Projeto
                        </span>
                        <div className="ui-text-body-sm ui-text-muted">
                          Este é o idioma oficial aceito na documentação do
                          projeto. Apenas os idiomas habilitados abaixo aparecem
                          nesta lista.
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "8px",
                        marginTop: "6px",
                      }}
                    >
                      {supportedLanguages.map((lang) => {
                        const isSelected =
                          defaultLanguage.toLowerCase() ===
                          lang.code.toLowerCase();
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => {
                              if (lang.code === defaultLanguage) return;
                              if (docMetadataList.length > 0) {
                                setLanguageChangeDialog({
                                  isOpen: true,
                                  targetLang: lang.code,
                                });
                              } else {
                                setDefaultLanguage(lang.code);
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: isSelected
                                ? "2px solid #0ea5e9"
                                : "1px solid var(--color-outline-variant, #e2e8f0)",
                              background: isSelected
                                ? "rgba(14, 165, 233, 0.08)"
                                : "var(--color-surface, #ffffff)",
                              color: "var(--color-on-surface, #1e293b)",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ fontSize: "18px" }}>
                                {lang.flag}
                              </span>
                              <div>
                                <div
                                  style={{
                                    fontSize: "12.5px",
                                    fontWeight: isSelected ? 700 : 500,
                                  }}
                                >
                                  {lang.label}
                                </div>
                                <div
                                  style={{
                                    fontSize: "10.5px",
                                    color: "var(--color-outline, #64748b)",
                                  }}
                                >
                                  {lang.code.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Badge variant="primary" size="sm">
                                OFICIAL
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Stack>

                  <Divider />

                  {/* Linha 2: Idiomas Habilitados para Tradução Sob Demanda */}
                  <Stack gap="xs">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span className="ui-text-subtitle ui-text-bold">
                          Idiomas Habilitados para Tradução Sob Demanda
                        </span>
                        <div className="ui-text-body-sm ui-text-muted">
                          Idiomas disponíveis para os membros da equipe
                          traduzirem documentos no editor.
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "6px",
                      }}
                    >
                      {supportedLanguages.map((lang) => {
                        const isDefault =
                          lang.code.toLowerCase() ===
                          defaultLanguage.toLowerCase();

                        return (
                          <div
                            key={lang.code}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "6px 12px",
                              borderRadius: "20px",
                              border: isDefault
                                ? "1.5px solid #0ea5e9"
                                : "1px solid var(--color-outline-variant, #cbd5e1)",
                              background: isDefault
                                ? "rgba(14, 165, 233, 0.08)"
                                : "var(--color-surface-container-low, #f8fafc)",
                              color: "var(--color-on-surface, #1e293b)",
                              fontSize: "12.5px",
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ fontSize: "15px" }}>
                              {lang.flag}
                            </span>
                            <span>
                              {lang.label} ({lang.code.toUpperCase()})
                            </span>

                            {isDefault ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background: "#0ea5e9",
                                  color: "#ffffff",
                                  fontWeight: 600,
                                }}
                              >
                                OFICIAL
                              </span>
                            ) : (
                              <button
                                type="button"
                                title={`Desabilitar e remover ${lang.label} do projeto`}
                                onClick={() => {
                                  const updated = supportedLanguages.filter(
                                    (l) =>
                                      l.code.toLowerCase() !==
                                      lang.code.toLowerCase(),
                                  );
                                  setSupportedLanguages(updated);
                                  if (
                                    defaultLanguage.toLowerCase() ===
                                      lang.code.toLowerCase() &&
                                    updated.length > 0
                                  ) {
                                    setDefaultLanguage(updated[0].code);
                                  }
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "transparent",
                                  border: "none",
                                  padding: "2px",
                                  cursor: "pointer",
                                  color: "var(--color-outline, #64748b)",
                                  borderRadius: "50%",
                                  transition: "color 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.color = "#ef4444")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.color =
                                    "var(--color-outline, #64748b)")
                                }
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  close
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Botão + inline para adicionar idioma aceito pelo motor */}
                      <button
                        type="button"
                        id="btn-add-language-inline"
                        onClick={() => {
                          setLanguageSearchFilter("");
                          setIsAddLanguageModalOpen(true);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "20px",
                          border: "1.5px dashed var(--primary, #0ea5e9)",
                          background: "rgba(14, 165, 233, 0.05)",
                          color: "var(--primary, #0ea5e9)",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(14, 165, 233, 0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(14, 165, 233, 0.05)";
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px" }}
                        >
                          add
                        </span>
                        <span>Adicionar Idioma</span>
                      </button>
                    </div>
                  </Stack>

                  <Divider />

                  {/* Linha 3: Motor de Tradução Padrão */}
                  <Stack gap="xs">
                    <div>
                      <span className="ui-text-subtitle ui-text-bold">
                        Motor de Tradução Padrão
                      </span>
                      <div className="ui-text-body-sm ui-text-muted">
                        Escolha o motor utilizado por padrão ao solicitar
                        traduções sob demanda.
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        marginTop: "6px",
                      }}
                    >
                      <div
                        onClick={() =>
                          setTranslationEngine("lightweight-local")
                        }
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          border:
                            translationEngine === "lightweight-local"
                              ? "2px solid #0ea5e9"
                              : "1px solid var(--color-outline-variant, #e2e8f0)",
                          background:
                            translationEngine === "lightweight-local"
                              ? "rgba(14, 165, 233, 0.08)"
                              : "var(--color-surface, #ffffff)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <Zap size={16} style={{ color: "#0ea5e9" }} />
                          <strong style={{ fontSize: "13px" }}>
                            Motor Leve de Servidor
                          </strong>
                        </div>
                        <p
                          style={{
                            fontSize: "11.5px",
                            color: "var(--color-outline, #64748b)",
                            margin: 0,
                          }}
                        >
                          Execução rápida no servidor. Não consome tokens de IA
                          e mantém diagramas e frontmatter preservados.
                        </p>
                      </div>

                      <div
                        onClick={() => setTranslationEngine("ai-contextual")}
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          border:
                            translationEngine === "ai-contextual"
                              ? "2px solid #8b5cf6"
                              : "1px solid var(--color-outline-variant, #e2e8f0)",
                          background:
                            translationEngine === "ai-contextual"
                              ? "rgba(139, 92, 246, 0.08)"
                              : "var(--color-surface, #ffffff)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <Sparkles size={16} style={{ color: "#8b5cf6" }} />
                          <strong style={{ fontSize: "13px" }}>
                            IA Contextual & Semântica (LLM)
                          </strong>
                        </div>
                        <p
                          style={{
                            fontSize: "11.5px",
                            color: "var(--color-outline, #64748b)",
                            margin: 0,
                          }}
                        >
                          Tradução adaptada ao contexto do projeto com
                          alinhamento terminológico fino do Dicionário.
                        </p>
                      </div>
                    </div>
                  </Stack>
                </Stack>
              </CardContent>

              <CardFooter>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save size={13} />}
                  onClick={async () => {
                    try {
                      await saveProjectConfig({
                        categories,
                        badges,
                        tags,
                        statuses,
                        ai_template_prompt: projectTemplatePrompt,
                        governance_rules: {
                          min_approvals_default: minApprovals,
                        },
                        default_language: defaultLanguage,
                        supported_languages: supportedLanguages,
                        translation_engine: translationEngine,
                      });
                      setSaveStatus(
                        "Configurações de Idiomas & Governança salvas com sucesso!",
                      );
                      setTimeout(() => setSaveStatus(null), 3500);
                    } catch {
                      setSaveStatus("Erro ao salvar configurações de idiomas.");
                    }
                  }}
                >
                  Salvar Idiomas & Governança
                </Button>
              </CardFooter>
            </Card>
          </section>

          {/* 2. SEÇÃO: MOTOR DE IA E HARNESS DE AGENTES */}
          <section
            id="ai-engine"
            className="ui-stack ui-stack--md"
            style={{ scrollMarginTop: "72px" }}
          >
            {/* CARD 1: AGENTES CONECTADOS & CLI HARNESS */}
            <Card variant="elevated">
              <CardHeader
                title={
                  <div className="ui-row ui-row--align-center ui-row--sm">
                    <Terminal size={17} className="ui-text-primary" />
                    <span>Agentes Conectados & CLI Harness (Proxy)</span>
                  </div>
                }
                subtitle="Execução de alto desempenho conectada aos agentes e CLIs autenticados no computador."
                actions={
                  <Badge
                    variant={
                      harnessProvider === "antigravity"
                        ? "primary"
                        : harnessProvider === "claude-code"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {harnessProvider.toUpperCase()}
                  </Badge>
                }
              />

              <CardContent>
                <Stack gap="md">
                  {/* Seleção de Harness */}
                  <div className="ui-grid-cards">
                    {[
                      {
                        id: "antigravity",
                        name: "Google Antigravity Agent",
                        cliName: "agy",
                        sub: "Agente multi-ferramenta com streaming SSE e raciocínio contextual",
                        icon: <Zap size={15} className="ui-text-primary" />,
                        detected:
                          detectedProviders.find((p) => p.id === "antigravity")
                            ?.isAvailable ?? true,
                        statusMsg:
                          detectedProviders.find((p) => p.id === "antigravity")
                            ?.statusMessage || "Detectado em ~/.local/bin/agy",
                      },
                      {
                        id: "claude-code",
                        name: "Claude Code CLI",
                        cliName: "claude",
                        sub: "Harness conectado ao agente oficial Claude Code CLI",
                        icon: (
                          <Sparkles size={15} className="ui-text-warning" />
                        ),
                        detected:
                          detectedProviders.find((p) => p.id === "claude-code")
                            ?.isAvailable ?? true,
                        statusMsg:
                          detectedProviders.find((p) => p.id === "claude-code")
                            ?.statusMessage ||
                          "Detectado em ~/.local/bin/claude",
                      },
                      {
                        id: "direct-api",
                        name: "Direct API Fallback",
                        cliName: "RAW / SDK",
                        sub: "Chamadas diretas de modelo via SDK e chaves de API em nuvem",
                        icon: <Cpu size={15} className="ui-text-success" />,
                        detected: true,
                        statusMsg: "Sempre disponível com chaves de API",
                      },
                    ].map((item) => {
                      const isSelected = harnessProvider === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setHarnessProvider(item.id)}
                          className={`ui-select-tile ${isSelected ? "ui-select-tile--selected" : ""}`}
                        >
                          <div className="ui-select-tile__header">
                            <div className="ui-row ui-row--align-center ui-row--xs">
                              {item.icon}
                              <strong className="ui-text-title">
                                {item.name}
                              </strong>
                            </div>
                            <Badge
                              variant={item.detected ? "success" : "danger"}
                              size="sm"
                              dot
                            >
                              {item.detected ? "Detectado" : "Não Localizado"}
                            </Badge>
                          </div>
                          <p className="ui-select-tile__sub">{item.sub}</p>
                          <span
                            className={`ui-text-caption ${item.detected ? "ui-text-success" : "ui-text-danger"}`}
                          >
                            {item.statusMsg}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Parâmetros do Agente: Nível de Raciocínio (Effort) & Teste */}
                  <div className="ui-grid-2cols">
                    <FormField label="Raciocínio do Agente:">
                      <div className="ui-segmented-group">
                        {[
                          { id: "low", label: "⚡ Rápido", sub: "" },
                          { id: "medium", label: "⚖️ Equilibrado", sub: "" },
                          { id: "high", label: "🧠 Profundo", sub: "" },
                        ].map((eff) => {
                          const isEffSelected = agentEffort === eff.id;
                          return (
                            <button
                              key={eff.id}
                              type="button"
                              onClick={() => setAgentEffort(eff.id as any)}
                              className={`ui-segmented-btn ${isEffSelected ? "ui-segmented-btn--active" : ""}`}
                            >
                              <div>{eff.label}</div>
                              <div className="ui-text-caption ui-text-muted">
                                {eff.sub}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </FormField>

                    <div className="ui-stack ui-stack--xs">
                      <label className="ui-text-subtitle ui-text-bold">
                        Status da Conexão CLI:
                      </label>
                      <div className="ui-row ui-row--align-center ui-row--sm">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={
                            <RefreshCw
                              size={13}
                              className={isCheckingHarness ? "spinning" : ""}
                            />
                          }
                          onClick={checkHarnessProviders}
                          disabled={isCheckingHarness}
                        >
                          {isCheckingHarness
                            ? "Verificando..."
                            : "Testar Detecção de CLIs"}
                        </Button>
                        {harnessCheckFeedback && (
                          <span className="ui-text-caption ui-text-success ui-text-bold">
                            {harnessCheckFeedback}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Caminhos customizados para portabilidade */}
                  <div className="ui-grid-2cols">
                    <FormField label="Caminho Customizado Antigravity CLI (Opcional):">
                      <Input
                        placeholder="Ex: ~/.local/bin/agy ou /usr/local/bin/agy"
                        value={antigravityCliPath}
                        onChange={(e) => setAntigravityCliPath(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Caminho Customizado Claude Code CLI (Opcional):">
                      <Input
                        placeholder="Ex: ~/.local/bin/claude ou /usr/local/bin/claude"
                        value={claudeCliPath}
                        onChange={(e) => setClaudeCliPath(e.target.value)}
                      />
                    </FormField>
                  </div>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader
                title={
                  <div className="ui-row ui-row--align-center ui-row--sm">
                    <Cpu size={17} className="ui-text-success" />
                    <span>Motor de Inteligência Artificial</span>
                  </div>
                }
                subtitle="Provedor e modelo para assistência e copiloto."
                actions={
                  <Badge variant="success">{provider.toUpperCase()}</Badge>
                }
              />

              <CardContent>
                <Stack gap="md">
                  <div className="ui-grid-cards ui-grid-cards--sm">
                    {[
                      {
                        id: "gemini",
                        name: "Google Gemini",
                        sub: "Flash 2.5 & Pro",
                      },
                      { id: "openai", name: "OpenAI", sub: "GPT-4o & o3-mini" },
                      {
                        id: "anthropic",
                        name: "Anthropic",
                        sub: "Claude 3.7 & 3.5",
                      },
                      { id: "deepseek", name: "DeepSeek", sub: "V3 & R1" },
                      { id: "local", name: "Ollama Local", sub: "Localhost" },
                    ].map((p) => {
                      const isSelected = provider === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setProvider(p.id);
                            fetchModelsForProvider(p.id, apiKey, endpoint);
                          }}
                          className={`ui-select-tile ${isSelected ? "ui-select-tile--success-selected" : ""}`}
                        >
                          <strong className="ui-text-title">{p.name}</strong>
                          <span className="ui-select-tile__sub">{p.sub}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ui-grid-2cols">
                    <FormField label="Modelo Selecionado:">
                      <div
                        className="ui-row ui-row--align-center ui-row--xs"
                        style={{ width: "100%" }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SelectDropdown
                            value={model}
                            options={selectOptions}
                            onChange={(val) => setModel(val)}
                            placeholder="Selecione o modelo..."
                            searchable={selectOptions.length > 5}
                            searchPlaceholder="Filtrar..."
                            leadingIcon="smart_toy"
                          />
                        </div>
                        <IconButton
                          size="sm"
                          bordered
                          tooltip="Recarregar modelos do provedor"
                          onClick={() =>
                            fetchModelsForProvider(provider, apiKey, endpoint)
                          }
                          disabled={isLoadingModels}
                        >
                          <RefreshCw
                            size={13}
                            className={isLoadingModels ? "spinning" : ""}
                          />
                        </IconButton>
                      </div>
                    </FormField>

                    <FormField label="Chave de API (API Key):">
                      <Input
                        type="password"
                        placeholder="Cole sua chave aqui..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onBlur={() =>
                          apiKey.trim() &&
                          fetchModelsForProvider(provider, apiKey, endpoint)
                        }
                      />
                    </FormField>
                  </div>

                  {provider === "local" && (
                    <FormField label="Endpoint Local (Ollama):">
                      <Input
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                      />
                    </FormField>
                  )}
                </Stack>
              </CardContent>

              <CardFooter>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save size={13} />}
                  onClick={handleSaveAISettings}
                >
                  Salvar Motor de IA
                </Button>
              </CardFooter>
            </Card>
          </section>

          {/* 3. SEÇÃO: CRIADOR DE TEMPLATES */}
          <section id="template-prompt" style={{ scrollMarginTop: "72px" }}>
            <Card variant="elevated">
              <CardHeader
                title={
                  <div className="ui-row ui-row--align-center ui-row--sm">
                    <Layers size={17} style={{ color: "#8b5cf6" }} />
                    <span>Criador de Templates</span>
                  </div>
                }
                subtitle="Crie, customize e gerencie templates de documentação viva no editor dedicado."
                actions={<Badge variant="purple">Template Studio</Badge>}
              />

              <CardContent>
                <div className="ui-panel ui-panel--subtle ui-row ui-row--align-center ui-row--justify-between ui-row--wrap ui-row--md">
                  <div
                    className="ui-stack ui-stack--xs"
                    style={{ flex: 1, minWidth: "260px" }}
                  >
                    <strong className="ui-text-title">
                      Editor & Estúdio de Templates
                    </strong>
                    <span className="ui-text-body-sm ui-text-muted">
                      Acesse o editor rico para criar novos templates, importar
                      modelos da comunidade e editar o conteúdo em Markdown.
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    leftIcon={<ExternalLink size={14} />}
                    onClick={() =>
                      navigate(
                        `/projects/${activeRepo?.name || "default"}/templates`,
                      )
                    }
                  >
                    Abrir Editor de Templates
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 4. SEÇÃO: SESSÃO & GITHUB */}
          <section id="user-session" style={{ scrollMarginTop: "72px" }}>
            <div className="ui-panel ui-row ui-row--align-center ui-row--justify-between">
              <div className="ui-row ui-row--align-center ui-row--sm">
                <img
                  src={
                    user?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=2563eb&color=fff`
                  }
                  alt="Avatar"
                  className="ui-avatar"
                  style={{ width: 34, height: 34, borderRadius: "50%" }}
                />
                <div className="ui-stack ui-stack--xs">
                  <strong className="ui-text-title">
                    {user?.name || "Usuário Autenticado"}
                  </strong>
                  <span className="ui-text-caption ui-text-muted">
                    @{user?.login || "github"}
                  </span>
                </div>
              </div>

              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut size={13} />}
                onClick={logout}
              >
                Desconectar
              </Button>
            </div>
          </section>
        </div>
      </PageBody>

      {/* Modal de Alerta de Referências na Exclusão */}
      <Modal
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((d) => ({ ...d, isOpen: false }))}
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#b91c1c",
            }}
          >
            <AlertTriangle size={18} />
            <span>
              Remover{" "}
              {deleteDialog.type === "status"
                ? "Status"
                : deleteDialog.type === "category"
                  ? "Categoria"
                  : deleteDialog.type === "badge"
                    ? "Tipo / Badge"
                    : "Tag"}{" "}
              em Uso
            </span>
          </div>
        }
        size="md"
        footer={
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteDialog((d) => ({ ...d, isOpen: false }))}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={13} />}
              onClick={deleteDialog.onConfirm}
            >
              Desvincular e Remover
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#334155",
              lineHeight: 1.5,
            }}
          >
            O item <strong>{deleteDialog.label}</strong> está atualmente
            vinculado a{" "}
            <strong>{deleteDialog.referencingDocs.length} documento(s)</strong>{" "}
            no projeto.
          </p>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {deleteDialog.referencingDocs.map((doc) => (
              <div
                key={doc.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11.5px",
                  color: "#475569",
                }}
              >
                <FileText size={12} style={{ color: "#94a3b8" }} />
                <span style={{ fontWeight: 500 }}>{doc.title || doc.name}</span>
                <span
                  style={{
                    fontSize: "10.5px",
                    color: "#94a3b8",
                    fontFamily: "monospace",
                  }}
                >
                  ({doc.path})
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: "11.5px", color: "#dc2626" }}>
            Ao confirmar, este item será removido das opções e os documentos
            acima serão atualizados automaticamente.
          </span>
        </div>
      </Modal>

      {/* Modal de Governança: Alerta de Alteração de Idioma Oficial */}
      <Modal
        isOpen={languageChangeDialog.isOpen}
        onClose={() =>
          setLanguageChangeDialog({ isOpen: false, targetLang: "" })
        }
        title="Alerta de Governança: Alteração de Idioma Oficial"
        icon={<AlertTriangle size={18} style={{ color: "#f59e0b" }} />}
        size="md"
        footer={
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setLanguageChangeDialog({ isOpen: false, targetLang: "" })
              }
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const target = languageChangeDialog.targetLang;
                if (target) {
                  setDefaultLanguage(target);
                }
                setLanguageChangeDialog({ isOpen: false, targetLang: "" });
              }}
            >
              Confirmar Alteração de Idioma
            </Button>
          </div>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-on-surface, #1e293b)",
              lineHeight: "1.5",
            }}
          >
            Você está alterando o <strong>Idioma Oficial do Projeto</strong> de{" "}
            <span style={{ fontWeight: 700, color: "#0ea5e9" }}>
              {supportedLanguages.find((l) => l.code === defaultLanguage)
                ?.label || defaultLanguage}
            </span>{" "}
            para{" "}
            <span style={{ fontWeight: 700, color: "#10b981" }}>
              {supportedLanguages.find(
                (l) => l.code === languageChangeDialog.targetLang,
              )?.label || languageChangeDialog.targetLang}
            </span>
            .
          </p>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#92400e",
              fontSize: "12px",
              lineHeight: "1.4",
            }}
          >
            <strong>Impacto nos Documentos Existentes:</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              <li>
                Os arquivos existentes na árvore principal passam a ser
                considerados a verdade oficial no novo idioma padrão.
              </li>
              <li>
                Traduções já geradas continuarão armazenadas e acessíveis na
                pasta oculta <code>.translations/</code>.
              </li>
              <li>
                Novas solicitações de tradução passarão a utilizar o novo idioma
                selecionado como origem.
              </li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Modal para Adicionar Idioma do Catálogo do Motor */}
      <Modal
        isOpen={isAddLanguageModalOpen}
        onClose={() => setIsAddLanguageModalOpen(false)}
        title="Adicionar Idioma ao Projeto"
        icon={<Globe size={18} style={{ color: "#0ea5e9" }} />}
        size="md"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddLanguageModalOpen(false)}
          >
            Fechar
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField label="Buscar idioma:">
            <Input
              placeholder="Digite o nome do idioma ou código (ex: Inglês, Espanhol, Alemão, ja, it...)"
              value={languageSearchFilter}
              onChange={(e) => setLanguageSearchFilter(e.target.value)}
              autoFocus
            />
          </FormField>

          {/* Grid de idiomas disponíveis no catálogo */}
          <div
            style={{
              maxHeight: "320px",
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              paddingRight: "4px",
            }}
          >
            {ENGINE_CATALOG_LANGUAGES.filter(
              (lang) =>
                !supportedLanguages.some(
                  (l) => l.code.toLowerCase() === lang.code.toLowerCase(),
                ) &&
                (lang.label
                  .toLowerCase()
                  .includes(languageSearchFilter.toLowerCase()) ||
                  lang.code
                    .toLowerCase()
                    .includes(languageSearchFilter.toLowerCase())),
            ).map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setSupportedLanguages([...supportedLanguages, lang]);
                  setIsAddLanguageModalOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  background: "var(--color-surface, #ffffff)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#0ea5e9";
                  e.currentTarget.style.background = "rgba(14, 165, 233, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--color-outline-variant, #e2e8f0)";
                  e.currentTarget.style.background =
                    "var(--color-surface, #ffffff)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontSize: "20px", flexShrink: 0 }}>
                    {lang.flag}
                  </span>
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: "var(--color-on-surface, #1e293b)",
                      }}
                    >
                      {lang.label}
                    </div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "var(--color-outline, #64748b)",
                      }}
                    >
                      {lang.code.toUpperCase()}
                    </div>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px", color: "#0ea5e9", flexShrink: 0 }}
                >
                  add_circle
                </span>
              </button>
            ))}
          </div>

          {ENGINE_CATALOG_LANGUAGES.filter(
            (lang) =>
              !supportedLanguages.some(
                (l) => l.code.toLowerCase() === lang.code.toLowerCase(),
              ) &&
              (lang.label
                .toLowerCase()
                .includes(languageSearchFilter.toLowerCase()) ||
                lang.code
                  .toLowerCase()
                  .includes(languageSearchFilter.toLowerCase())),
          ).length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                color: "var(--color-outline, #64748b)",
                fontSize: "12.5px",
              }}
            >
              Nenhum idioma pendente encontrado para a busca.
            </div>
          )}
        </div>
      </Modal>

      <FirstRunWizard
        isOpen={showOnboardingModal}
        onCancel={() => setShowOnboardingModal(false)}
        onComplete={async (repoName) => {
          setShowOnboardingModal(false);
          await loadProjectConfig();
          navigate(`/repo/${encodeURIComponent(repoName)}/editor`);
        }}
      />
    </PageContainer>
  );
};

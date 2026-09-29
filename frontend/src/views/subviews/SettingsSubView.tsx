import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
} from "../../components/ui";
import { useNavigate } from "react-router-dom";
import {
  Cpu,
  RefreshCw,
  Edit2,
  Plus,
  Trash2,
  Save,
  LogOut,
  Check,
  Layers,
  X,
  AlertTriangle,
  FileText,
  ExternalLink,
  Terminal,
  Zap,
  Sparkles,
} from "lucide-react";
import type { TaxonomyItem, DocumentMetadataItem } from "../../types";

// 32 Cores Harmonizadas (8 Matizes x 4 Variações Verticais com o Centro na cor Base 500)
// Linha 0 (Topo): Tom Suave / Claro (250/300)
// Linha 1 (Centro): Cor Base Central (500)
// Linha 2 (Médio): Tom Vigoroso / Contraste (600)
// Linha 3 (Base): Tom Profundo / Escuro (800)
export const RAINBOW_28_HUES = [
  { name: "Vermelho", colors: ["#fca5a5", "#ef4444", "#dc2626", "#991b1b"] },
  { name: "Laranja", colors: ["#fed7aa", "#f97316", "#ea580c", "#9a3412"] },
  {
    name: "Âmbar/Amarelo",
    colors: ["#fef08a", "#eab308", "#ca8a04", "#854d0e"],
  },
  { name: "Verde", colors: ["#bbf7d0", "#22c55e", "#16a34a", "#14532d"] },
  { name: "Ciano/Teal", colors: ["#a5f3fc", "#06b6d4", "#0891b2", "#164e63"] },
  { name: "Azul", colors: ["#bfdbfe", "#3b82f6", "#2563eb", "#1e3a8a"] },
  {
    name: "Violeta/Roxo",
    colors: ["#e9d5ff", "#a855f7", "#9333ea", "#581c87"],
  },
  {
    name: "Rosa/Magenta",
    colors: ["#fbcfe8", "#ec4899", "#db2777", "#831843"],
  },
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

// Componente Popover de Seleção de Cor Discreto (Círculo)
const ColorDotPicker: React.FC<{
  color: string;
  onChange: (newColor: string) => void;
  size?: number;
}> = ({ color, onChange, size = 18 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Cor: ${color}. Clique para escolher.`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          border: "2px solid #ffffff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      />

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow:
              "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            minWidth: "155px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
            }}
          >
            {RAINBOW_28_HUES.map((hueGroup) => (
              <div
                key={hueGroup.name}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {hueGroup.colors.map((hex) => {
                  const isSelected = color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        onChange(hex);
                        setIsOpen(false);
                      }}
                      title={`${hueGroup.name}: ${hex}`}
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: hex,
                        border: isSelected
                          ? "2px solid #000"
                          : "1px solid rgba(0,0,0,0.08)",
                        boxShadow: isSelected
                          ? "0 0 0 2px rgba(37,99,235,0.5)"
                          : "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <Check
                          size={9}
                          style={{
                            color: [
                              "#fca5a5",
                              "#fdba74",
                              "#fde047",
                              "#86efac",
                              "#67e8f9",
                              "#93c5fd",
                              "#d8b4fe",
                            ].includes(hex)
                              ? "#000"
                              : "#fff",
                            strokeWidth: 3,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
    <div
      className="settings-subview-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflowY: "auto",
        background: "#f8fafc",
      }}
    >
      {/* Cabeçalho */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}
            >
              Configurações
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#2563eb",
                background: "#eff6ff",
                padding: "1px 7px",
                borderRadius: "10px",
                border: "1px solid #dbeafe",
              }}
            >
              {activeRepo?.name || "local"}
            </span>
          </div>

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
      </header>

      {/* Conteúdo Principal */}
      <main
        style={{
          maxWidth: "960px",
          width: "100%",
          margin: "0 auto",
          padding: "24px 32px 64px 32px",
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

        {/* 1. SEÇÃO: CATEGORIAS, TAGS & STATUS */}
        <section id="categories-tags" style={{ scrollMarginTop: "72px" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "12px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "14.5px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Taxonomia & Governança
              </h3>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                Personalize categorias, tags e status com cores hexadecimais
                integradas.
              </p>
            </div>

            {/* 1.1 Categorias */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <span
                style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}
              >
                Categorias
              </span>

              {/* Lista de Chips com Edição Inline no Próprio Chip */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {categories.map((cat, idx) => {
                  const isEditing = editingCatIndex === idx;

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 6px 3px 8px",
                          borderRadius: "14px",
                          backgroundColor: `${editCatColor}16`,
                          border: `1.5px solid ${editCatColor}`,
                          fontSize: "12px",
                          fontWeight: 600,
                          color: editCatColor,
                        }}
                      >
                        <ColorDotPicker
                          color={editCatColor}
                          onChange={setEditCatColor}
                          size={14}
                        />
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditCategory();
                            if (e.key === "Escape") setEditingCatIndex(null);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            width: `${Math.max(editCatName.length, 6)}ch`,
                            color: editCatColor,
                            padding: 0,
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditCategory}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: editCatColor,
                            opacity: 0.8,
                          }}
                          title="Salvar (Enter)"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatIndex(null)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "#94a3b8",
                          }}
                          title="Cancelar (Esc)"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px 3px 10px",
                        borderRadius: "14px",
                        backgroundColor: `${cat.color}14`,
                        border: `1px solid ${cat.color}40`,
                        fontSize: "12px",
                        fontWeight: 600,
                        color: cat.color,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: cat.color,
                        }}
                      />
                      <span
                        onClick={() => handleStartEditCategory(idx)}
                        style={{ cursor: "pointer" }}
                        title="Clique para editar"
                      >
                        {cat.name.toUpperCase()}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: cat.color,
                            opacity: 0.6,
                          }}
                          title="Editar"
                        >
                          <Edit2 size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveCategory(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: cat.color,
                            opacity: 0.6,
                          }}
                          title="Remover"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Botão + ou Chip de Adicionar Categoria */}
                {isAddingCategory ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 6px 3px 8px",
                      borderRadius: "14px",
                      backgroundColor: `${newCatColor}16`,
                      border: `1.5px solid ${newCatColor}`,
                      fontSize: "12px",
                      fontWeight: 600,
                      color: newCatColor,
                    }}
                  >
                    <ColorDotPicker
                      color={newCatColor}
                      onChange={setNewCatColor}
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="categoria..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory();
                        if (e.key === "Escape") {
                          setIsAddingCategory(false);
                          setNewCatName("");
                        }
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: "12px",
                        fontWeight: 600,
                        width: `${Math.max(newCatName.length, 10)}ch`,
                        color: newCatColor,
                        padding: 0,
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={!newCatName.trim()}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: newCatName.trim() ? "pointer" : "default",
                        padding: 0,
                        color: newCatColor,
                        opacity: newCatName.trim() ? 0.9 : 0.4,
                      }}
                      title="Criar (Enter)"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCatName("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#94a3b8",
                      }}
                      title="Cancelar (Esc)"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      border: "1px dashed #cbd5e1",
                      background: "#ffffff",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.12s ease",
                    }}
                    title="Adicionar Categoria"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* 1.2 Tipos de Documento / Badges */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderTop: "1px solid #f8fafc",
                paddingTop: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Tipos de Documento (Badges)
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Tipologia estrutural única por documento (ex: RFC, ADR, PRD,
                  DOC)
                </span>
              </div>

              {/* Lista de Chips de Badges com Edição Inline */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {badges.map((bdg, idx) => {
                  const isEditing = editingBadgeIndex === idx;
                  const bdgColor = bdg.color || "#3b82f6";

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 6px 2px 8px",
                          borderRadius: "12px",
                          backgroundColor: `${editBadgeColor}16`,
                          border: `1.5px solid ${editBadgeColor}`,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: editBadgeColor,
                          letterSpacing: "0.04em",
                        }}
                      >
                        <ColorDotPicker
                          color={editBadgeColor}
                          onChange={setEditBadgeColor}
                          size={14}
                        />
                        <input
                          type="text"
                          value={editBadgeName}
                          onChange={(e) =>
                            setEditBadgeName(e.target.value.toUpperCase())
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditBadge();
                            if (e.key === "Escape") setEditingBadgeIndex(null);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            width: `${Math.max(editBadgeName.length, 4)}ch`,
                            color: editBadgeColor,
                            padding: 0,
                            textTransform: "uppercase",
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditBadge}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: editBadgeColor,
                            opacity: 0.85,
                          }}
                          title="Salvar (Enter)"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBadgeIndex(null)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "#94a3b8",
                          }}
                          title="Cancelar (Esc)"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "2px 6px 2px 8px",
                        borderRadius: "12px",
                        backgroundColor: `${bdgColor}14`,
                        border: `1px solid ${bdgColor}45`,
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        color: bdgColor,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: bdgColor,
                        }}
                      />
                      <span
                        onClick={() => handleStartEditBadge(idx)}
                        style={{ cursor: "pointer" }}
                        title="Clique para editar tipo"
                      >
                        {bdg.name.toUpperCase()}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartEditBadge(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: bdgColor,
                            opacity: 0.6,
                          }}
                          title="Editar"
                        >
                          <Edit2 size={9} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveBadge(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: bdgColor,
                            opacity: 0.6,
                          }}
                          title="Remover"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Botão + ou Chip de Adicionar Badge */}
                {isAddingBadge ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "2px 6px 2px 8px",
                      borderRadius: "12px",
                      backgroundColor: `${newBadgeColor}16`,
                      border: `1.5px solid ${newBadgeColor}`,
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: newBadgeColor,
                    }}
                  >
                    <ColorDotPicker
                      color={newBadgeColor}
                      onChange={setNewBadgeColor}
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="TIPO..."
                      value={newBadgeName}
                      onChange={(e) =>
                        setNewBadgeName(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddBadge();
                        if (e.key === "Escape") {
                          setIsAddingBadge(false);
                          setNewBadgeName("");
                        }
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        width: `${Math.max(newBadgeName.length, 6)}ch`,
                        color: newBadgeColor,
                        padding: 0,
                        textTransform: "uppercase",
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddBadge}
                      disabled={!newBadgeName.trim()}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: newBadgeName.trim() ? "pointer" : "default",
                        padding: 0,
                        color: newBadgeColor,
                        opacity: newBadgeName.trim() ? 0.9 : 0.4,
                      }}
                      title="Criar (Enter)"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBadge(false);
                        setNewBadgeName("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#94a3b8",
                      }}
                      title="Cancelar (Esc)"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingBadge(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      border: "1px dashed #cbd5e1",
                      background: "#ffffff",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.12s ease",
                    }}
                    title="Adicionar Tipo de Documento / Badge"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 1.3 Tags */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderTop: "1px solid #f8fafc",
                paddingTop: "14px",
              }}
            >
              <span
                style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}
              >
                Tags
              </span>

              {/* Lista de Chips de Tags com Edição Inline */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {tags.map((tag, idx) => {
                  const isEditing = editingTagIndex === idx;

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "2px 6px 2px 8px",
                          borderRadius: "12px",
                          backgroundColor: `${editTagColor}16`,
                          border: `1.5px solid ${editTagColor}`,
                          fontSize: "11.5px",
                          fontWeight: 500,
                          color: editTagColor,
                        }}
                      >
                        <ColorDotPicker
                          color={editTagColor}
                          onChange={setEditTagColor}
                          size={14}
                        />
                        <span style={{ opacity: 0.7 }}>#</span>
                        <input
                          type="text"
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditTag();
                            if (e.key === "Escape") setEditingTagIndex(null);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: "11.5px",
                            fontWeight: 500,
                            width: `${Math.max(editTagName.length, 5)}ch`,
                            color: editTagColor,
                            padding: 0,
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditTag}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: editTagColor,
                            opacity: 0.8,
                          }}
                          title="Salvar (Enter)"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagIndex(null)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "#94a3b8",
                          }}
                          title="Cancelar (Esc)"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 6px 2px 8px",
                        borderRadius: "12px",
                        backgroundColor: `${tag.color}12`,
                        border: `1px solid ${tag.color}35`,
                        fontSize: "11.5px",
                        fontWeight: 500,
                        color: tag.color,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <span
                        onClick={() => handleStartEditTag(idx)}
                        style={{ cursor: "pointer" }}
                        title="Clique para editar tag"
                      >
                        #{tag.name}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartEditTag(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: tag.color,
                            opacity: 0.6,
                          }}
                          title="Editar"
                        >
                          <Edit2 size={9} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveTag(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: tag.color,
                            opacity: 0.6,
                          }}
                          title="Remover"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Botão + ou Chip de Adicionar Tag */}
                {isAddingTag ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "2px 6px 2px 8px",
                      borderRadius: "12px",
                      backgroundColor: `${newTagColor}16`,
                      border: `1.5px solid ${newTagColor}`,
                      fontSize: "11.5px",
                      fontWeight: 500,
                      color: newTagColor,
                    }}
                  >
                    <ColorDotPicker
                      color={newTagColor}
                      onChange={setNewTagColor}
                      size={14}
                    />
                    <span style={{ opacity: 0.7 }}>#</span>
                    <input
                      type="text"
                      placeholder="tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTag();
                        if (e.key === "Escape") {
                          setIsAddingTag(false);
                          setNewTagName("");
                        }
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: "11.5px",
                        fontWeight: 500,
                        width: `${Math.max(newTagName.length, 6)}ch`,
                        color: newTagColor,
                        padding: 0,
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!newTagName.trim()}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: newTagName.trim() ? "pointer" : "default",
                        padding: 0,
                        color: newTagColor,
                        opacity: newTagName.trim() ? 0.9 : 0.4,
                      }}
                      title="Criar (Enter)"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagName("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#94a3b8",
                      }}
                      title="Cancelar (Esc)"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      border: "1px dashed #cbd5e1",
                      background: "#ffffff",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.12s ease",
                    }}
                    title="Adicionar Tag"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 1.3 Statuses (Com Cores Rainbow e Formatação Automática) */}
            <div
              style={{
                borderTop: "1px solid #f8fafc",
                paddingTop: "14px",
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
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Status de Governança
                </span>
              </div>

              {/* Chips de Status com Edição Inline */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {statuses.map((st, idx) => {
                  const isEditing = editingStatusIndex === idx;
                  const stColor = st.color || "#22c55e";

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 6px 3px 8px",
                          borderRadius: "14px",
                          backgroundColor: `${editStatusColor}16`,
                          border: `1.5px solid ${editStatusColor}`,
                          fontSize: "12px",
                          fontWeight: 600,
                          color: editStatusColor,
                        }}
                      >
                        <ColorDotPicker
                          color={editStatusColor}
                          onChange={setEditStatusColor}
                          size={14}
                        />
                        <input
                          type="text"
                          value={editStatusName}
                          onChange={(e) => setEditStatusName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEditStatus();
                            if (e.key === "Escape") setEditingStatusIndex(null);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            width: `${Math.max(editStatusName.length, 6)}ch`,
                            color: editStatusColor,
                            padding: 0,
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditStatus}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: editStatusColor,
                            opacity: 0.85,
                          }}
                          title="Salvar (Enter)"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStatusIndex(null)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "#94a3b8",
                          }}
                          title="Cancelar (Esc)"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px 3px 10px",
                        borderRadius: "14px",
                        backgroundColor: `${stColor}14`,
                        border: `1px solid ${stColor}40`,
                        fontSize: "12px",
                        fontWeight: 600,
                        color: stColor,
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: stColor,
                        }}
                      />
                      <span
                        onClick={() => handleStartEditStatus(idx)}
                        style={{ cursor: "pointer" }}
                        title="Clique para editar status"
                      >
                        {st.name.toUpperCase()}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartEditStatus(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: stColor,
                            opacity: 0.6,
                          }}
                          title="Editar"
                        >
                          <Edit2 size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveStatus(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            color: stColor,
                            opacity: 0.6,
                          }}
                          title="Remover"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Botão + ou Chip de Adicionar Status */}
                {isAddingStatus ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 6px 3px 8px",
                      borderRadius: "14px",
                      backgroundColor: `${newStatusColor}16`,
                      border: `1.5px solid ${newStatusColor}`,
                      fontSize: "12px",
                      fontWeight: 600,
                      color: newStatusColor,
                    }}
                  >
                    <ColorDotPicker
                      color={newStatusColor}
                      onChange={setNewStatusColor}
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="status..."
                      value={newStatusName}
                      onChange={(e) => setNewStatusName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddStatus();
                        if (e.key === "Escape") {
                          setIsAddingStatus(false);
                          setNewStatusName("");
                        }
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        fontSize: "12px",
                        fontWeight: 600,
                        width: `${Math.max(newStatusName.length, 8)}ch`,
                        color: newStatusColor,
                        padding: 0,
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddStatus}
                      disabled={!newStatusName.trim()}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: newStatusName.trim() ? "pointer" : "default",
                        padding: 0,
                        color: newStatusColor,
                        opacity: newStatusName.trim() ? 0.9 : 0.4,
                      }}
                      title="Criar (Enter)"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingStatus(false);
                        setNewStatusName("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "#94a3b8",
                      }}
                      title="Cancelar (Esc)"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingStatus(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      border: "1px dashed #cbd5e1",
                      background: "#ffffff",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.12s ease",
                    }}
                    title="Adicionar Status"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. SEÇÃO: MOTOR DE IA E HARNESS DE AGENTES */}
        <section
          id="ai-engine"
          style={{
            scrollMarginTop: "72px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* CARD 1: AGENTES CONECTADOS & CLI HARNESS */}
          <Card variant="elevated">
            <CardHeader
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Terminal size={17} style={{ color: "#2563eb" }} />
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

            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Seleção de Harness */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  {
                    id: "antigravity",
                    name: "Google Antigravity Agent",
                    cliName: "agy",
                    sub: "Agente multi-ferramenta com streaming SSE e raciocínio contextual",
                    icon: <Zap size={15} style={{ color: "#2563eb" }} />,
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
                    icon: <Sparkles size={15} style={{ color: "#d97706" }} />,
                    detected:
                      detectedProviders.find((p) => p.id === "claude-code")
                        ?.isAvailable ?? true,
                    statusMsg:
                      detectedProviders.find((p) => p.id === "claude-code")
                        ?.statusMessage || "Detectado em ~/.local/bin/claude",
                  },
                  {
                    id: "direct-api",
                    name: "Direct API Fallback",
                    cliName: "RAW / SDK",
                    sub: "Chamadas diretas de modelo via SDK e chaves de API em nuvem",
                    icon: <Cpu size={15} style={{ color: "#10b981" }} />,
                    detected: true,
                    statusMsg: "Sempre disponível com chaves de API",
                  },
                ].map((item) => {
                  const isSelected = harnessProvider === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setHarnessProvider(item.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: isSelected
                          ? "2px solid #2563eb"
                          : "1px solid #e2e8f0",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "all 0.15s ease",
                        boxShadow: isSelected
                          ? "0 2px 8px rgba(37,99,235,0.12)"
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {item.icon}
                          <strong
                            style={{
                              fontSize: "13px",
                              color: isSelected ? "#1d4ed8" : "#0f172a",
                            }}
                          >
                            {item.name}
                          </strong>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "12px",
                            background: item.detected ? "#dcfce7" : "#fee2e2",
                            color: item.detected ? "#15803d" : "#b91c1c",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: item.detected ? "#16a34a" : "#dc2626",
                            }}
                          />
                          {item.detected ? "Detectado" : "Não Localizado"}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "11.5px",
                          color: "#64748b",
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.sub}
                      </p>
                      <span
                        style={{
                          fontSize: "10px",
                          color: item.detected ? "#059669" : "#dc2626",
                          fontWeight: 500,
                        }}
                      >
                        {item.statusMsg}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Parâmetros do Agente: Nível de Raciocínio (Effort) & Teste */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <FormField label="Raciocínio do Agente:">
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { id: "low", label: "⚡ Rápido", sub: "" },
                      {
                        id: "medium",
                        label: "⚖️ Equilibrado",
                        sub: "",
                      },
                      {
                        id: "high",
                        label: "🧠 Profundo",
                        sub: "",
                      },
                    ].map((eff) => {
                      const isEffSelected = agentEffort === eff.id;
                      return (
                        <button
                          key={eff.id}
                          type="button"
                          onClick={() => setAgentEffort(eff.id as any)}
                          style={{
                            flex: 1,
                            padding: "8px 6px",
                            borderRadius: "6px",
                            border: isEffSelected
                              ? "1.5px solid #2563eb"
                              : "1px solid #cbd5e1",
                            background: isEffSelected ? "#eff6ff" : "#ffffff",
                            color: isEffSelected ? "#1d4ed8" : "#475569",
                            fontSize: "12px",
                            fontWeight: isEffSelected ? 600 : 500,
                            cursor: "pointer",
                            transition: "all 0.12s ease",
                            textAlign: "center",
                          }}
                        >
                          <div>{eff.label}</div>
                          <div style={{ fontSize: "9.5px", color: "#64748b" }}>
                            {eff.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </FormField>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Status da Conexão CLI:
                  </label>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
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
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#16a34a",
                          fontWeight: 500,
                        }}
                      >
                        {harnessCheckFeedback}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Caminhos customizados para portabilidade */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
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
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardHeader
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Cpu size={17} style={{ color: "#10b981" }} />
                  <span>Motor de Inteligência Artificial</span>
                </div>
              }
              subtitle="Provedor e modelo para assistência e copiloto."
              actions={
                <Badge variant="success">{provider.toUpperCase()}</Badge>
              }
            />

            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                }}
              >
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
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: isSelected
                          ? "1.5px solid #10b981"
                          : "1px solid #e2e8f0",
                        background: isSelected ? "#f0fdf4" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "12px",
                          color: isSelected ? "#047857" : "#1e293b",
                          display: "block",
                        }}
                      >
                        {p.name}
                      </strong>
                      <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                        {p.sub}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <FormField label="Modelo Selecionado:">
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <div style={{ flex: 1 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Layers size={17} style={{ color: "#8b5cf6" }} />
                  <span>Criador de Templates</span>
                </div>
              }
              subtitle="Crie, customize e gerencie templates de documentação viva no editor dedicado."
              actions={<Badge variant="purple">Template Studio</Badge>}
            />

            <CardContent>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                    Editor & Estúdio de Templates
                  </strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Acesse o editor rico para criar novos templates, importar
                    modelos da comunidade e editar o conteúdo em Markdown.
                  </span>
                </div>

                <Button
                  variant="primary"
                  onClick={() =>
                    navigate(
                      `/projects/${activeRepo?.name || "default"}/templates`,
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    flexShrink: 0,
                  }}
                >
                  <ExternalLink size={14} />
                  Abrir Editor de Templates
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. SEÇÃO: SESSÃO & GITHUB */}
        <section id="user-session" style={{ scrollMarginTop: "72px" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={
                  user?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=2563eb&color=fff`
                }
                alt="Avatar"
                style={{ width: 34, height: 34, borderRadius: "50%" }}
              />
              <div>
                <strong
                  style={{
                    fontSize: "13px",
                    color: "#0f172a",
                    display: "block",
                  }}
                >
                  {user?.name || "Usuário Autenticado"}
                </strong>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
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
      </main>

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
    </div>
  );
};

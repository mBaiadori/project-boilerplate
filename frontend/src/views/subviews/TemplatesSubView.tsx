// =============================================================================
// SUBVIEW: GERENCIADOR & EDITOR DE TEMPLATES
// CRUD visual de templates + Edição rica com NotionEditor + Copilot Prompt Unificado
// =============================================================================

import React, { useState, useEffect, useMemo } from "react";
import type { TemplateItem, SkillItem } from "../../types";
import { API } from "../../services/api";
import { useTemplate, useTemplateStore } from "../../hooks/useTemplate";
import { useAI } from "../../context/AIContext";
import { NotionEditor } from "../../components/editor/NotionEditor";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  SelectDropdown,
  type SelectOption,
} from "../../components/common/SelectDropdown";
import {
  Button,
  IconButton,
  Badge,
  Tabs,
  SearchInput,
  FormField,
  Input,
  AlertBanner,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  EmptyState,
  Spinner,
  FilterChips,
} from "../../components/ui";
import {
  Layers,
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  Download,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  Save,
  Globe,
  Folder,
  Tag,
  MinusCircle,
  X,
  Lock,
  FileText,
  Type,
} from "lucide-react";

interface TemplatesSubViewProps {
  onApplyTemplate?: (filePath: string) => void;
}

type Tab = "projeto" | "comunidade";
type ViewMode = "grid" | "editor";

const DEFAULT_CATEGORY_OPTIONS: SelectOption[] = [
  {
    value: "geral",
    label: "Geral",
    description: "Diretrizes e documentação padrão",
    icon: "folder",
  },
  {
    value: "engenharia",
    label: "Engenharia",
    description: "Arquitetura de software e código",
    icon: "terminal",
  },
  {
    value: "arquitetura",
    label: "Arquitetura",
    description: "Decisões técnicas e ADRs",
    icon: "account_tree",
  },
  {
    value: "requisitos",
    label: "Requisitos",
    description: "Especificações funcionais e RFCs",
    icon: "fact_check",
  },
  {
    value: "api",
    label: "API & Contratos",
    description: "Endpoints, REST e GraphQL",
    icon: "api",
  },
  {
    value: "produto",
    label: "Produto",
    description: "PRDs, visão e roadmap",
    icon: "inventory_2",
  },
  {
    value: "design",
    label: "Design & UX",
    description: "Design system e interfaces",
    icon: "palette",
  },
  {
    value: "devops",
    label: "DevOps",
    description: "CI/CD, infraestrutura e cloud",
    icon: "cloud_sync",
  },
  {
    value: "seguranca",
    label: "Segurança",
    description: "Governança e conformidade",
    icon: "security",
  },
];

const DEFAULT_BADGE_PRESETS: Array<{
  name: string;
  color?: string;
  description?: string;
}> = [
  { name: "RFC", color: "#a855f7", description: "Request for Comments" },
  {
    name: "ADR",
    color: "#3b82f6",
    description: "Architecture Decision Record",
  },
  {
    name: "PRD",
    color: "#f97316",
    description: "Product Requirements Document",
  },
  { name: "DOC", color: "#22c55e", description: "Documentação Técnica" },
  { name: "API", color: "#06b6d4", description: "Especificação de API" },
  {
    name: "SPEC",
    color: "#6366f1",
    description: "Especificação de Funcionalidade",
  },
  { name: "GUIDE", color: "#ec4899", description: "Guia e Manual" },
  { name: "TEST", color: "#eab308", description: "Plano de Testes" },
];

export const TemplatesSubView: React.FC<TemplatesSubViewProps> = () => {
  const { projectMetaOptions, projectConfig } = useWorkspace();
  const {
    templates,
    communityTemplates,
    loading,
    importingId,
    fetchTemplates,
    fetchCommunityTemplates,
    createTemplate,
    updateTemplate,
    importFromCommunity,
    deleteTemplate,
  } = useTemplate();

  const setActiveEditingTemplate = useTemplateStore(
    (s) => s.setActiveEditingTemplate,
  );
  const updateActiveEditingTemplate = useTemplateStore(
    (s) => s.updateActiveEditingTemplate,
  );
  const { setIsTemplateEditorMode, setDynamicContext, setActiveSkillId } =
    useAI();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<Tab>("projeto");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Template State (for rich editor)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  const [tplId, setTplId] = useState("");
  const [tplTemplateName, setTplTemplateName] = useState("");
  const [tplTitle, setTplTitle] = useState("");
  const [tplCategory, setTplCategory] = useState("");
  const [tplBadge, setTplBadge] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplTags, setTplTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [tplPrompt, setTplPrompt] = useState("");
  const [tplSkills, setTplSkills] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);

  // Import feedback
  const [importFeedback, setImportFeedback] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});

  useEffect(() => {
    fetchTemplates();
    fetchCommunityTemplates();
    loadAvailableSkills();
  }, [fetchTemplates, fetchCommunityTemplates]);

  const loadAvailableSkills = async () => {
    try {
      const [hubRes, projRes] = await Promise.all([
        API.getSkillsHub(),
        API.getSkillsProject(),
      ]);
      const hubList =
        hubRes.ok && hubRes.data?.skills ? hubRes.data.skills : [];
      const projList =
        projRes.ok && projRes.data?.installed_skills
          ? projRes.data.installed_skills
          : [];
      // Combine unique by ID
      const map = new Map<string, SkillItem>();
      [...hubList, ...projList].forEach((s) => map.set(s.id, s));
      setAvailableSkills(Array.from(map.values()));
    } catch (e) {
      console.error("Erro ao carregar skills para templates:", e);
    }
  };

  // Sync AI Context template editor mode & dynamic template content for Copilot
  useEffect(() => {
    if (viewMode === "editor") {
      setIsTemplateEditorMode(true);
      if (tplSkills.length > 0) {
        setActiveSkillId(tplSkills[0]);
      }
      setDynamicContext({
        filePath: tplTemplateName
          ? `templates/${tplTemplateName}.md`
          : `templates/${tplId || "novo-template"}.md`,
        content: tplContent,
        badge: `🛠️ Template: ${tplTitle || tplId || "Novo"}`,
      });
    } else {
      setIsTemplateEditorMode(false);
      setActiveEditingTemplate(null);
      setDynamicContext(null);
    }
    return () => {
      setIsTemplateEditorMode(false);
      setActiveEditingTemplate(null);
      setDynamicContext(null);
    };
  }, [
    viewMode,
    tplContent,
    tplTitle,
    tplId,
    tplTemplateName,
    tplSkills,
    setIsTemplateEditorMode,
    setDynamicContext,
    setActiveEditingTemplate,
    setActiveSkillId,
  ]);

  // Derived list
  const activeList =
    activeTab === "comunidade" ? communityTemplates : templates;
  const allCategories = Array.from(
    new Set(activeList.map((t) => t.category).filter(Boolean)),
  ).sort();

  const filteredTemplates = activeList.filter((tpl) => {
    const matchesCat =
      activeCategory === "all" ||
      tpl.category?.toLowerCase() === activeCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      tpl.title.toLowerCase().includes(q) ||
      (tpl.templateName || "").toLowerCase().includes(q) ||
      (tpl.description || "").toLowerCase().includes(q) ||
      (tpl.tags || []).some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Dynamic Badge Presets from .project.config.json or Defaults
  const badgePresets = useMemo<
    Array<{ name: string; color?: string; description?: string }>
  >(() => {
    const raw = projectMetaOptions?.badges || projectConfig?.badges;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((b: any) =>
          typeof b === "string"
            ? { name: b.toUpperCase() }
            : {
                name: String(b.name || "").toUpperCase(),
                color: b.color,
                description: b.description,
              },
        )
        .filter((b) => Boolean(b.name));
    }
    return DEFAULT_BADGE_PRESETS;
  }, [projectMetaOptions?.badges, projectConfig?.badges]);

  // Options for Category SelectDropdown from .project.config.json or Defaults
  const categoryDropdownOptions: SelectOption[] = useMemo(() => {
    const rawProjectCats =
      projectMetaOptions?.categories || projectConfig?.categories;
    let baseList: SelectOption[] = [];

    if (Array.isArray(rawProjectCats) && rawProjectCats.length > 0) {
      baseList = rawProjectCats.map((cat: any) => {
        const name = typeof cat === "string" ? cat : cat.name;
        const lower = String(name || "").toLowerCase();
        const defaultMatch = DEFAULT_CATEGORY_OPTIONS.find(
          (d) => d.value.toLowerCase() === lower,
        );
        return {
          value: lower,
          label: defaultMatch
            ? defaultMatch.label
            : name.charAt(0).toUpperCase() + name.slice(1),
          description:
            defaultMatch?.description || `Categoria do projeto (${name})`,
          icon: defaultMatch?.icon || "folder",
        };
      });
    } else {
      baseList = [...DEFAULT_CATEGORY_OPTIONS];
    }

    if (
      tplCategory &&
      !baseList.some(
        (o) => o.value.toLowerCase() === tplCategory.toLowerCase().trim(),
      )
    ) {
      baseList.push({
        value: tplCategory,
        label: tplCategory.charAt(0).toUpperCase() + tplCategory.slice(1),
        description: "Categoria personalizada",
        icon: "label",
      });
    }
    return baseList;
  }, [projectMetaOptions?.categories, projectConfig?.categories, tplCategory]);

  // Options for Skills SelectDropdown
  const skillDropdownOptions: SelectOption[] = useMemo(() => {
    return availableSkills.map((s) => {
      const isSelected = tplSkills.includes(s.id);
      return {
        value: s.id,
        label: s.title || s.name || s.id,
        description: s.description
          ? s.description.length > 75
            ? `${s.description.slice(0, 75)}...`
            : s.description
          : `Skill padrão ECC (${s.id})`,
        icon: "auto_awesome",
        badge: isSelected ? "Vinculada" : undefined,
        badgeType: isSelected ? "primary" : undefined,
      };
    });
  }, [availableSkills, tplSkills]);

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setTplId("");
    setTplTemplateName("");
    setTplTitle("Novo Template");
    setTplCategory("engenharia");
    setTplBadge("DOC");
    setTplDesc("");
    setTplTags([]);
    setTagInputValue("");
    setTplContent(
      "# Novo Documento Técnico\n\n## 1. Visão Geral\nDescreva aqui o propósito.",
    );
    setTplPrompt(
      "Atue como um Arquiteto de Software sênior guiando o usuário no preenchimento desta especificação.",
    );
    setTplSkills([]);
    setSaveError("");
    setSaveSuccessMsg("");
    setShowConfigDrawer(false);

    setActiveEditingTemplate({
      id: "novo-template",
      title: "Novo Template",
      category: "engenharia",
      description: "",
      prompt: "Atue como um Arquiteto de Software sênior.",
      skills: [],
    });

    setViewMode("editor");
  };

  const handleOpenEdit = (tpl: TemplateItem) => {
    setIsEditMode(true);
    setTplId(tpl.id);
    setTplTemplateName(tpl.templateName || tpl.id);
    setTplTitle(tpl.title);
    setTplCategory(tpl.category || "geral");
    setTplBadge(tpl.badge || "");
    setTplDesc(tpl.description || "");
    setTplTags(tpl.tags || []);
    setTagInputValue("");
    setTplContent(tpl.content || "");
    setTplPrompt(tpl.prompt || "");
    setTplSkills(tpl.skills || []);
    setSaveError("");
    setSaveSuccessMsg("");
    setShowConfigDrawer(false);

    setActiveEditingTemplate({
      id: tpl.id,
      templateName: tpl.templateName || tpl.id,
      title: tpl.title,
      category: tpl.category || "geral",
      badge: tpl.badge,
      description: tpl.description,
      tags: tpl.tags,
      prompt: tpl.prompt,
      skills: tpl.skills || [],
    });

    setViewMode("editor");
  };

  const handleAddTag = (tag: string) => {
    const clean = tag.trim().replace(/^#/, "");
    if (clean && !tplTags.includes(clean)) {
      const updated = [...tplTags, clean];
      setTplTags(updated);
      updateActiveEditingTemplate({ tags: updated });
    }
    setTagInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tplTags.filter((t) => t !== tagToRemove);
    setTplTags(updated);
    updateActiveEditingTemplate({ tags: updated });
  };

  const handleSkillSelect = (selectedId: string) => {
    if (!selectedId) return;
    if (!tplSkills.includes(selectedId)) {
      const updated = [...tplSkills, selectedId];
      setTplSkills(updated);
      setActiveSkillId(selectedId);
      updateActiveEditingTemplate({ skills: updated });
    }
  };

  const handleRemoveSkill = (skillId: string) => {
    const updated = tplSkills.filter((id) => id !== skillId);
    setTplSkills(updated);
    if (updated.length > 0) {
      setActiveSkillId(updated[0]);
    }
    updateActiveEditingTemplate({ skills: updated });
  };

  const handleSaveTemplate = async () => {
    if (!tplTitle.trim()) {
      setSaveError("O título do template é obrigatório.");
      return;
    }
    const finalId =
      tplId.trim() || tplTitle.toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (!finalId) {
      setSaveError("Slug/Identificador inválido.");
      return;
    }

    const tagsArray = tplTags.map((t) => t.trim()).filter(Boolean);

    const templateData: Partial<TemplateItem> = {
      id: finalId,
      templateName: finalId,
      title: tplTitle.trim(),
      category: tplCategory.trim() || "geral",
      badge: tplBadge.trim() || undefined,
      description: tplDesc.trim() || undefined,
      tags: tagsArray,
      content: tplContent,
      prompt: tplPrompt.trim() || undefined,
      skills: tplSkills,
    };

    setIsSaving(true);
    setSaveError("");
    setSaveSuccessMsg("");

    try {
      if (isEditMode) {
        await updateTemplate(tplId, templateData);
        setSaveSuccessMsg("Template atualizado com sucesso!");
      } else {
        await createTemplate(templateData as any);
        setIsEditMode(true);
        setTplId(finalId);
        setSaveSuccessMsg("Template criado com sucesso!");
      }

      updateActiveEditingTemplate({
        id: finalId,
        templateName: finalId,
        title: tplTitle.trim(),
        category: tplCategory.trim(),
        badge: tplBadge.trim() || undefined,
        description: tplDesc.trim() || undefined,
        tags: tagsArray,
        prompt: tplPrompt.trim() || undefined,
        skills: tplSkills,
      });

      setTimeout(() => setSaveSuccessMsg(""), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Erro ao salvar template.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tpl: TemplateItem, isCommunity: boolean) => {
    if (
      window.confirm(
        `Tem certeza que deseja remover o template "${tpl.title}"?`,
      )
    ) {
      try {
        await deleteTemplate(tpl.id, isCommunity);
      } catch (err: any) {
        alert(`Erro: ${err.message}`);
      }
    }
  };

  const handleImport = async (tpl: TemplateItem) => {
    try {
      await importFromCommunity(tpl.id);
      setImportFeedback((prev) => ({
        ...prev,
        [tpl.id]: { ok: true, msg: "Importado para o projeto!" },
      }));
      setTimeout(() => {
        setImportFeedback((prev) => {
          const next = { ...prev };
          delete next[tpl.id];
          return next;
        });
      }, 3500);
    } catch (err: any) {
      setImportFeedback((prev) => ({
        ...prev,
        [tpl.id]: { ok: false, msg: err.message || "Falha ao importar." },
      }));
    }
  };

  const handleContentChange = (newContent: string) => {
    setTplContent(newContent);
  };

  const handlePromptChange = (newPrompt: string) => {
    setTplPrompt(newPrompt);
    updateActiveEditingTemplate({ prompt: newPrompt });
  };

  const handleTitleChange = (newTitle: string) => {
    setTplTitle(newTitle);
    updateActiveEditingTemplate({ title: newTitle });
    if (!isEditMode && !tplId) {
      const generatedSlug = newTitle
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setTplId(generatedSlug);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER 1: MODO EDITOR RICO DE TEMPLATES
  // ═════════════════════════════════════════════════════════════════════════════
  if (viewMode === "editor") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
          background: "var(--color-surface)",
        }}
      >
        {/* Top Bar Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            borderBottom: "1px solid var(--color-outline-variant)",
            background: "var(--color-surface-container-low)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setViewMode("grid");
                fetchTemplates();
              }}
              icon={<ChevronLeft size={14} />}
            >
              Voltar ao Catálogo
            </Button>

            <Badge variant="primary" size="md">
              {isEditMode ? "Modo Edição" : "Novo Template"}
            </Badge>

            <span
              style={{
                fontSize: "13px",
                color: "var(--color-outline)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              templates/{tplTemplateName || tplId || "novo-template"}.md
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button
              variant={showConfigDrawer ? "primary" : "secondary"}
              size="sm"
              onClick={() => setShowConfigDrawer((v) => !v)}
              icon={<SlidersHorizontal size={14} />}
            >
              Propriedades
              {tplSkills.length > 0 && (
                <span
                  style={{
                    marginLeft: "6px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    background: showConfigDrawer
                      ? "rgba(255,255,255,0.25)"
                      : "var(--color-primary-container)",
                    color: showConfigDrawer
                      ? "#ffffff"
                      : "var(--color-primary)",
                  }}
                >
                  {tplSkills.length}{" "}
                  {tplSkills.length === 1 ? "skill" : "skills"}
                </span>
              )}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              icon={
                isSaving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )
              }
            >
              {isSaving ? "Salvando..." : "Salvar Template"}
            </Button>
          </div>
        </div>

        {/* Feedback Banner */}
        {saveError && (
          <AlertBanner
            variant="error"
            title={saveError}
            onClose={() => setSaveError("")}
          />
        )}
        {saveSuccessMsg && (
          <AlertBanner
            variant="success"
            title={saveSuccessMsg}
            onClose={() => setSaveSuccessMsg("")}
          />
        )}

        {/* Painel de Propriedades do Template */}
        {showConfigDrawer && (
          <div
            id="template-properties-panel"
            style={{
              background: "var(--color-surface-container)",
              borderBottom: "1px solid var(--color-outline-variant)",
              padding: "16px 24px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              flexShrink: 0,
              boxShadow: "0 4px 18px rgba(0, 0, 0, 0.08)",
            }}
          >
            {/* Header do Painel */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--color-outline-variant)",
                paddingBottom: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <SlidersHorizontal
                  size={16}
                  style={{ color: "var(--color-primary)" }}
                />
                <div>
                  <span
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 700,
                      color: "var(--color-on-surface)",
                    }}
                  >
                    Propriedades do Template
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--color-on-surface-variant)",
                      marginLeft: "8px",
                    }}
                  >
                    Identificação, metadados de catálogo e skills recomendadas
                  </span>
                </div>
              </div>

              <IconButton
                variant="ghost"
                size="sm"
                onClick={() => setShowConfigDrawer(false)}
                tooltip="Fechar propriedades"
                icon={<X size={15} />}
              />
            </div>

            {/* Linha 1: Título, Slug, Categoria e Badge */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.1fr 0.9fr",
                gap: "14px",
                alignItems: "flex-start",
              }}
            >
              {/* Título */}
              <FormField
                label="Título do Template"
                required
                helperText="Nome de exibição principal"
              >
                <Input
                  id="tpl-prop-title"
                  placeholder="ex: Especificação de Microsserviço"
                  value={tplTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  startIcon={
                    <Type size={14} style={{ color: "var(--color-outline)" }} />
                  }
                />
              </FormField>

              {/* Slug / Arquivo */}
              <FormField
                label={`Slug / Arquivo ${!isEditMode ? "*" : ""}`}
                helperText={
                  isEditMode
                    ? "Identificador fixo após criação"
                    : `templates/${tplId || "slug"}.md`
                }
              >
                <Input
                  id="tpl-prop-slug"
                  placeholder="ex: microservice-spec"
                  value={tplId}
                  disabled={isEditMode}
                  onChange={(e) =>
                    setTplId(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
                    )
                  }
                  startIcon={
                    isEditMode ? (
                      <Lock
                        size={13}
                        style={{ color: "var(--color-outline)" }}
                      />
                    ) : (
                      <FileText
                        size={13}
                        style={{ color: "var(--color-outline)" }}
                      />
                    )
                  }
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "12.5px",
                  }}
                />
              </FormField>

              {/* Categoria com SelectDropdown */}
              <FormField label="Categoria" helperText="Agrupamento no catálogo">
                <SelectDropdown
                  id="tpl-prop-category"
                  value={tplCategory}
                  options={categoryDropdownOptions}
                  onChange={(val) => {
                    setTplCategory(val);
                    updateActiveEditingTemplate({ category: val });
                  }}
                  placeholder="Selecione uma categoria..."
                  searchable={true}
                  searchPlaceholder="Filtrar categorias..."
                  variant="form"
                  leadingIcon="folder"
                />
              </FormField>

              {/* Badge com Presets */}
              <FormField
                label="Badge / Tipo"
                helperText="Etiqueta curta de classificação"
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <Input
                    id="tpl-prop-badge"
                    placeholder="ex: RFC, ADR, PRD"
                    value={tplBadge}
                    maxLength={10}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setTplBadge(val);
                      updateActiveEditingTemplate({ badge: val });
                    }}
                    style={{
                      textTransform: "uppercase",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                    }}
                    rightIcon={
                      tplBadge ? (
                        <Badge
                          size="sm"
                          style={
                            badgePresets.find((b) => b.name === tplBadge)?.color
                              ? {
                                  background: `${badgePresets.find((b) => b.name === tplBadge)?.color}25`,
                                  color: badgePresets.find(
                                    (b) => b.name === tplBadge,
                                  )?.color,
                                  borderColor: badgePresets.find(
                                    (b) => b.name === tplBadge,
                                  )?.color,
                                }
                              : undefined
                          }
                          variant="primary"
                        >
                          {tplBadge}
                        </Badge>
                      ) : undefined
                    }
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    {badgePresets.map((preset) => {
                      const isSelected = tplBadge === preset.name;
                      const presetColor =
                        preset.color || "var(--color-primary)";
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setTplBadge(preset.name);
                            updateActiveEditingTemplate({ badge: preset.name });
                          }}
                          title={preset.description || preset.name}
                          style={{
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            border: isSelected
                              ? `1px solid ${presetColor}`
                              : "1px solid var(--color-outline-variant)",
                            background: isSelected
                              ? preset.color
                                ? `${preset.color}25`
                                : "var(--color-primary-container)"
                              : "var(--color-surface-container-high)",
                            color: isSelected
                              ? presetColor
                              : "var(--color-on-surface-variant)",
                            cursor: "pointer",
                            fontWeight: 600,
                            transition: "all 0.12s ease",
                          }}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FormField>
            </div>

            {/* Linha 2: Descrição e Tags de Busca */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr",
                gap: "14px",
                alignItems: "flex-start",
              }}
            >
              {/* Descrição */}
              <FormField
                label="Descrição da Finalidade"
                helperText="Orientação sobre quando e por que adotar este documento"
              >
                <Input
                  id="tpl-prop-desc"
                  placeholder="ex: Modelo para especificação e contratos de microsserviços..."
                  value={tplDesc}
                  onChange={(e) => {
                    setTplDesc(e.target.value);
                    updateActiveEditingTemplate({
                      description: e.target.value,
                    });
                  }}
                />
              </FormField>

              {/* Tags Interativas */}
              <FormField
                label="Tags de Busca & Indexação"
                helperText="Pressione Enter ou vírgula para adicionar tags"
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    background: "var(--color-surface-container-high)",
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-md, 6px)",
                    minHeight: "38px",
                    boxSizing: "border-box",
                  }}
                >
                  {tplTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background: "var(--color-surface)",
                        color: "var(--color-on-surface)",
                        border: "1px solid var(--color-outline-variant)",
                        fontWeight: 500,
                      }}
                    >
                      <Tag
                        size={10}
                        style={{ color: "var(--color-primary)" }}
                      />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          color: "var(--color-outline)",
                        }}
                        title={`Remover tag ${tag}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}

                  <input
                    id="tpl-new-tag-input"
                    type="text"
                    placeholder={
                      tplTags.length === 0
                        ? "Adicionar tag (ex: backend, rest)..."
                        : "+ tag..."
                    }
                    value={tagInputValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(",")) {
                        val.split(",").forEach((part) => handleAddTag(part));
                      } else {
                        setTagInputValue(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddTag(tagInputValue);
                      } else if (
                        e.key === "Backspace" &&
                        !tagInputValue &&
                        tplTags.length > 0
                      ) {
                        handleRemoveTag(tplTags[tplTags.length - 1]);
                      }
                    }}
                    onBlur={() => {
                      if (tagInputValue.trim()) {
                        handleAddTag(tagInputValue);
                      }
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      fontSize: "12px",
                      color: "var(--color-on-surface)",
                      flex: 1,
                      minWidth: "110px",
                    }}
                  />
                </div>
              </FormField>
            </div>

            {/* Linha 3: Skills com SelectDropdown e visualização de chips */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "var(--color-surface-container-low)",
                padding: "12px 14px",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-outline-variant)",
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
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--color-on-surface)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Sparkles
                      size={13}
                      style={{ color: "var(--color-primary)" }}
                    />
                    Skills
                  </div>
                  <div
                    style={{
                      fontSize: "11.5px",
                      color: "var(--color-on-surface-variant)",
                      marginTop: "2px",
                    }}
                  >
                    Vincule diretrizes técnicas para o Copilot carregar
                    automaticamente durante a edição deste modelo.
                  </div>
                </div>

                {/* Dropdown com busca para seleção de skills */}
                <div style={{ minWidth: "280px", maxWidth: "420px", flex: 1 }}>
                  <SelectDropdown
                    id="tpl-skill-picker"
                    value=""
                    options={skillDropdownOptions}
                    onChange={handleSkillSelect}
                    placeholder="+ Vincular skill do catálogo..."
                    searchable={true}
                    searchPlaceholder="Buscar skill por nome ou descrição..."
                    leadingIcon="psychology"
                    variant="compact"
                  />
                </div>
              </div>

              {/* Lista de Skills Selecionadas */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "4px",
                }}
              >
                {tplSkills.length === 0 ? (
                  <span
                    style={{
                      fontSize: "11.5px",
                      color: "var(--color-outline)",
                      fontStyle: "italic",
                      padding: "4px 2px",
                    }}
                  >
                    Nenhuma skill vinculada. Escolha uma skill acima para
                    conectar regras especializadas de IA.
                  </span>
                ) : (
                  tplSkills.map((skillId) => {
                    const skillInfo = availableSkills.find(
                      (s) => s.id === skillId,
                    );
                    const skillLabel =
                      skillInfo?.title || skillInfo?.name || skillId;
                    return (
                      <span
                        key={skillId}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          background: "var(--color-primary-container)",
                          color: "var(--color-primary)",
                          border: "1px solid var(--color-primary)",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Sparkles size={12} />
                        <span>{skillLabel}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skillId)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--color-primary)",
                            opacity: 0.85,
                          }}
                          title={`Desvincular ${skillLabel}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Embedded Notion Document Editor */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <NotionEditor
            content={tplContent}
            onChange={handleContentChange}
            promptContent={tplPrompt}
            onPromptChange={handlePromptChange}
            filePath={
              tplTemplateName
                ? `templates/${tplTemplateName}.md`
                : `templates/${tplId || "novo-template"}.md`
            }
            isTemplateMode={true}
            customTitle={tplTitle}
            onCustomTitleChange={handleTitleChange}
            onCustomSave={handleSaveTemplate}
            customSaveStatus={
              isSaving ? "Salvando template..." : "Template Pronto"
            }
          />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER 2: MODO GRID DE TEMPLATES (PROJETO & COMUNIDADE)
  // ═════════════════════════════════════════════════════════════════════════════
  const tabList = [
    {
      id: "projeto",
      label: "Projeto",
      badge: templates.length,
      icon: <Folder size={14} />,
    },
    {
      id: "comunidade",
      label: "Comunidade Global",
      badge: communityTemplates.length,
      icon: <Globe size={14} />,
    },
  ];

  return (
    <div
      id="subview-templates"
      style={{
        padding: "24px 32px",
        maxWidth: "1400px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--color-on-surface)",
                letterSpacing: "-0.02em",
              }}
            >
              Gerenciador de Templates
            </h1>
            <Badge variant="primary" size="md">
              {templates.length} {templates.length === 1 ? "modelo" : "modelos"}
            </Badge>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            id="btn-refresh-templates"
            variant="secondary"
            size="md"
            onClick={() => {
              fetchTemplates();
              fetchCommunityTemplates();
            }}
            icon={<RefreshCw size={15} />}
          >
            Sincronizar
          </Button>

          <Button
            id="btn-open-new-template"
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            icon={<Plus size={16} />}
          >
            Novo Template
          </Button>
        </div>
      </div>

      {/* Tabs & Search & Category Bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <Tabs
            tabs={tabList}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as any)}
            variant="pills"
          />

          <div style={{ width: "320px" }}>
            <SearchInput
              id="tpl-search-input"
              placeholder="Buscar template por título, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
            />
          </div>
        </div>

        {/* Categories Chips */}
        <FilterChips
          items={[
            { id: "all", label: `Todos (${activeList.length})` },
            ...allCategories.map((c) => ({ id: c!, label: c! })),
          ]}
          activeId={activeCategory}
          onChange={(cat) => setActiveCategory(cat)}
          size="sm"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div
          style={{
            padding: "60px 0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Spinner size="lg" message="Carregando templates..." />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Layers size={48} />}
          title={
            activeTab === "projeto"
              ? "Nenhum template no projeto"
              : "Nenhum template na comunidade"
          }
          description={
            searchQuery
              ? `Nenhum resultado encontrado para "${searchQuery}".`
              : activeTab === "projeto"
                ? "Crie modelos estruturados de RFCs, ADRs e especificações técnicas."
                : "Explore e importe modelos da comunidade global."
          }
          actionLabel={
            activeTab === "projeto" ? "Criar Primeiro Template" : undefined
          }
          onAction={activeTab === "projeto" ? handleOpenCreate : undefined}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredTemplates.map((tpl) => {
            const fb = importFeedback[tpl.id];
            const alreadyImported =
              activeTab === "comunidade" &&
              templates.some((t) => t.id === tpl.id);

            return (
              <Card
                key={tpl.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <CardHeader
                  title={tpl.title}
                  subtitle={tpl.templateName || tpl.id}
                  action={
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Badge variant="primary" size="sm">
                        {tpl.category || "Geral"}
                      </Badge>
                      {tpl.badge && (
                        <Badge variant="success" size="sm">
                          {tpl.badge}
                        </Badge>
                      )}
                      {tpl.source === "community" && (
                        <Badge variant="purple" size="sm">
                          Comunidade
                        </Badge>
                      )}
                    </div>
                  }
                />

                <CardContent
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12.5px",
                      color: "var(--color-on-surface-variant)",
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    {tpl.description ||
                      (tpl.prompt
                        ? `Prompt: ${tpl.prompt.slice(0, 90)}...`
                        : "Sem descrição adicional.")}
                  </p>

                  {(tpl.tags || []).length > 0 && (
                    <div
                      style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
                    >
                      {(tpl.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "10.5px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "var(--color-surface-container-high)",
                            color: "var(--color-outline)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {(tpl.skills || []).length > 0 && (
                    <div
                      style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
                    >
                      {(tpl.skills || []).map((skillId: string) => (
                        <span
                          key={skillId}
                          style={{
                            fontSize: "10.5px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "var(--color-primary-container)",
                            color: "var(--color-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontWeight: 600,
                          }}
                        >
                          <Sparkles size={10} />
                          {skillId}
                        </span>
                      ))}
                    </div>
                  )}

                  {fb && (
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: fb.ok
                          ? "var(--color-success)"
                          : "var(--color-error)",
                        fontWeight: 600,
                      }}
                    >
                      {fb.ok ? "✓" : "✗"} {fb.msg}
                    </div>
                  )}
                </CardContent>

                <CardFooter
                  style={{
                    borderTop: "1px solid var(--color-outline-variant)",
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  {activeTab === "projeto" ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => handleOpenEdit(tpl)}
                        icon={<Edit3 size={14} />}
                      >
                        Editar Template
                      </Button>
                      <IconButton
                        id={`btn-delete-tpl-${tpl.id}`}
                        variant="ghost"
                        size="sm"
                        tooltip="Remover template"
                        onClick={() => handleDelete(tpl, false)}
                        icon={
                          <Trash2
                            size={15}
                            style={{ color: "var(--color-error)" }}
                          />
                        }
                      />
                    </>
                  ) : alreadyImported ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        width: "100%",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: "12px",
                          color: "var(--color-success)",
                          background: "var(--color-surface-container-high)",
                          padding: "6px 10px",
                          borderRadius: "var(--radius-md, 6px)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          fontWeight: 600,
                        }}
                      >
                        <Check size={14} /> Importado no Projeto
                      </span>
                      <Button
                        id={`btn-unimport-community-${tpl.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(tpl, false)}
                        icon={
                          <MinusCircle
                            size={14}
                            style={{ color: "var(--color-warning)" }}
                          />
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <Button
                      id={`btn-import-community-${tpl.id}`}
                      variant="primary"
                      size="sm"
                      fullWidth
                      disabled={importingId === tpl.id}
                      onClick={() => handleImport(tpl)}
                      icon={<Download size={14} />}
                    >
                      {importingId === tpl.id
                        ? "Importando..."
                        : "Importar para o Projeto"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

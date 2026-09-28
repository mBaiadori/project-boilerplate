// =============================================================================
// SUBVIEW: GERENCIADOR & EDITOR DE TEMPLATES
// CRUD visual de templates + Edição rica com NotionEditor + Copilot Prompt Unificado
// =============================================================================

import React, { useState, useEffect } from "react";
import type { TemplateItem, SkillItem } from "../../types";
import { API } from "../../services/api";
import { useTemplate, useTemplateStore } from "../../hooks/useTemplate";
import { useAI } from "../../context/AIContext";
import { NotionEditor } from "../../components/editor/NotionEditor";
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
  CheckCircle2,
  MinusCircle,
} from "lucide-react";

interface TemplatesSubViewProps {
  onApplyTemplate?: (filePath: string) => void;
}

type Tab = "projeto" | "comunidade";
type ViewMode = "grid" | "editor";

const CATEGORY_SUGGESTIONS = [
  "geral",
  "engenharia",
  "arquitetura",
  "requisitos",
  "api",
  "produto",
  "design",
];

export const TemplatesSubView: React.FC<TemplatesSubViewProps> = () => {
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
  const [tplTags, setTplTags] = useState("");
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

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setTplId("");
    setTplTemplateName("");
    setTplTitle("Novo Template");
    setTplCategory("engenharia");
    setTplBadge("DOC");
    setTplDesc("");
    setTplTags("");
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
    setTplTags((tpl.tags || []).join(", "));
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

    const tagsArray = tplTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

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
              {showConfigDrawer ? "Ocultar Metadados" : "Metadados & Skills"}
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

        {/* Metadados Dropdown Drawer */}
        {showConfigDrawer && (
          <div
            style={{
              background: "var(--color-surface-container)",
              borderBottom: "1px solid var(--color-outline-variant)",
              padding: "14px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr",
                gap: "12px",
              }}
            >
              <FormField label="Título do Template" required>
                <Input
                  placeholder="ex: Especificação de Microsserviço"
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                />
              </FormField>

              <FormField
                label={`Identificador / Slug ${!isEditMode ? "*" : ""}`}
              >
                <Input
                  placeholder="ex: microservice-spec"
                  value={tplId}
                  disabled={isEditMode}
                  onChange={(e) =>
                    setTplId(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
                    )
                  }
                />
              </FormField>

              <FormField label="Categoria">
                <Input
                  list="tpl-cat-suggestions"
                  placeholder="ex: engenharia"
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                />
                <datalist id="tpl-cat-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </FormField>

              <FormField label="Badge / Etiqueta Curta">
                <Input
                  placeholder="ex: RFC, ADR, PRD"
                  value={tplBadge}
                  onChange={(e) => setTplBadge(e.target.value.toUpperCase())}
                />
              </FormField>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "12px",
              }}
            >
              <FormField label="Descrição Curta (Finalidade do Template)">
                <Input
                  placeholder="Descreva quando e por que utilizar este modelo..."
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                />
              </FormField>

              <FormField label="Tags / Palavras-chave">
                <Input
                  placeholder="ex: backend, rest, auth (separados por vírgula)"
                  value={tplTags}
                  onChange={(e) => setTplTags(e.target.value)}
                />
              </FormField>
            </div>

            {/* Skills selection */}
            <div>
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "var(--color-outline)",
                  marginBottom: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={13} style={{ color: "var(--color-primary)" }} />
                Skills Recomendadas / Vinculadas ao Template (Padrão ECC):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {availableSkills.length === 0 ? (
                  <span
                    style={{ fontSize: "12px", color: "var(--color-outline)" }}
                  >
                    Carregando catálogo de skills...
                  </span>
                ) : (
                  availableSkills.map((skill) => {
                    const isSelected = tplSkills.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setTplSkills(
                              tplSkills.filter((id) => id !== skill.id),
                            );
                          } else {
                            setTplSkills([...tplSkills, skill.id]);
                          }
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          border: isSelected
                            ? "1px solid var(--color-primary)"
                            : "1px solid var(--color-outline-variant)",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--color-primary-container)"
                            : "var(--color-surface-container-high)",
                          color: isSelected
                            ? "var(--color-primary)"
                            : "var(--color-on-surface-variant)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSelected ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Plus size={13} />
                        )}
                        {skill.title || skill.name}
                      </button>
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
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "13.5px",
              color: "var(--color-on-surface-variant)",
            }}
          >
            Central de modelos técnicos padronizados com Prompt de Copilot
            integrado (
            <code
              style={{
                fontFamily: "var(--font-mono, monospace)",
                background: "var(--color-surface-container-high)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              .templates.json
            </code>
            ).
          </p>
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

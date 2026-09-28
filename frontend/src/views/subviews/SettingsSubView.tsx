import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import { SelectDropdown, type SelectOption } from "../../components/common/SelectDropdown";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  FormField,
  Input,
  Textarea,
  Switch,
  Badge,
  AlertBanner,
  StatCard,
} from "../../components/ui";
import {
  FolderGit2,
  Cpu,
  Sparkles,
  GitBranch,
  ShieldCheck,
  RefreshCw,
  Edit2,
  Plus,
  X,
  Save,
  LogOut,
} from "lucide-react";

export const SettingsSubView: React.FC = () => {
  const { user, logout } = useAuth();
  const { aiSettings, saveAISettings } = useAI();
  const {
    activeRepo,
    gitStatus,
    gitLog,
    loadProjectConfig,
    saveProjectConfig,
  } = useWorkspace();
  const [gitDiagnostic, setGitDiagnostic] = useState<{
    version: string;
    installed: boolean;
  } | null>(null);

  // AI Provider State
  const [provider, setProvider] = useState<string>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("http://localhost:11434/v1");
  const [modelsList, setModelsList] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [isDynamicList, setIsDynamicList] = useState<boolean>(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState<boolean>(false);

  // Prompts State
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  const [tplCreatorPrompt, setTplCreatorPrompt] = useState<string>("");
  const [autoPROn, setAutoPROn] = useState<boolean>(true);

  // Project Config State (.project.config.json)
  const [projectName, setProjectName] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [projectVersion, setProjectVersion] = useState<string>("1.0.0");
  const [projectLead, setProjectLead] = useState<string>("@usuario");
  const [projectArchPattern, setProjectArchPattern] =
    useState<string>("Documentação Viva & Git");
  const [projectRepoUrl, setProjectRepoUrl] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [statuses, setStatuses] = useState<
    Array<{ key: string; label: string; badge?: string }>
  >([]);
  const [newStatusKey, setNewStatusKey] = useState<string>("");
  const [newStatusLabel, setNewStatusLabel] = useState<string>("");
  const [newStatusBadge, setNewStatusBadge] = useState<string>("badge-neutral");
  const [projectTemplatePrompt, setProjectTemplatePrompt] =
    useState<string>("");
  const [minApprovals, setMinApprovals] = useState<number>(1);

  // Status feedback
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchModelsForProvider = useCallback(async (provId: string, customKey?: string, customEp?: string) => {
    setIsLoadingModels(true);
    try {
      const res = await API.getAIModels({
        provider: provId,
        api_key: customKey || apiKey || undefined,
        custom_endpoint: customEp || endpoint || undefined,
      });

      if (res.ok && res.data) {
        let items: Array<{ id: string; name: string; description?: string }> = [];
        if (res.data.detailedModels && res.data.detailedModels.length > 0) {
          items = res.data.detailedModels;
        } else if (res.data.models && res.data.models.length > 0) {
          items = res.data.models.map((m: any) => typeof m === "string" ? { id: m, name: m } : m);
        }

        if (items.length > 0) {
          setModelsList(items);
          setIsDynamicList(true);
        } else {
          setModelsList([]);
          setIsDynamicList(false);
        }
      } else {
        setModelsList([]);
        setIsDynamicList(false);
      }
    } catch (err) {
      console.error("[SettingsSubView] Erro ao buscar lista de modelos:", err);
      setModelsList([]);
      setIsDynamicList(false);
    } finally {
      setIsLoadingModels(false);
    }
  }, [apiKey, endpoint]);

  useEffect(() => {
    if (aiSettings) {
      const activeProv = aiSettings.active_provider || aiSettings.provider || "gemini";
      setProvider(activeProv);
      setModel(aiSettings.active_model || aiSettings.model || (activeProv === "gemini" ? "gemini-2.5-flash" : "gpt-4o"));
      setEndpoint(aiSettings.custom_endpoint || "http://localhost:11434/v1");
      fetchModelsForProvider(activeProv, undefined, aiSettings.custom_endpoint);
    }
  }, [aiSettings, fetchModelsForProvider]);

  const selectOptions: SelectOption[] = useMemo(() => {
    if (modelsList.length === 0) {
      return [
        { value: model, label: model, description: "Modelo ativo selecionado" },
        { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Alta velocidade e capacidades multimodais", badge: "Flash", badgeType: "success" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Raciocínio complexo e codificação profunda", badge: "Pro", badgeType: "warning" },
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Modelo versátil", badge: "Flash", badgeType: "info" },
      ];
    }

    return modelsList.map((m) => {
      let badge: string | undefined;
      let badgeType: "primary" | "success" | "warning" | "neutral" | "info" = "primary";

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

  const loadAllSettings = useCallback(async () => {
    try {
      // 1. Carregar configurações gerais do sistema
      const res = await API.getSettings();
      if (res) {
        if (res.system_prompts?.global) {
          setGlobalPrompt(res.system_prompts.global);
        }
        if (res.system_prompts?.template_creator) {
          setTplCreatorPrompt(res.system_prompts.template_creator);
        }
        if (res.governance?.auto_pr !== undefined) {
          setAutoPROn(res.governance.auto_pr);
        }
      }

      // 2. Carregar configurações customizadas do projeto (.project.config.json)
      const pCfg = await loadProjectConfig();
      if (pCfg) {
        if (pCfg.project) {
          setProjectName(pCfg.project.name || "");
          setProjectDescription(pCfg.project.description || "");
          setProjectVersion(pCfg.project.version || "1.0.0");
          setProjectLead(pCfg.project.lead || "@usuario");
          setProjectArchPattern(
            pCfg.project.architecture_pattern || "Documentação Viva & Git",
          );
          setProjectRepoUrl(pCfg.project.repository_url || "");
        }
        if (Array.isArray(pCfg.categories)) {
          setCategories(pCfg.categories);
        }
        if (Array.isArray(pCfg.tags)) {
          setTags(pCfg.tags);
        }
        if (Array.isArray(pCfg.statuses)) {
          setStatuses(pCfg.statuses);
        }
        if (pCfg.ai_template_prompt) {
          setProjectTemplatePrompt(pCfg.ai_template_prompt);
        }
        if (pCfg.governance_rules?.min_approvals_default !== undefined) {
          setMinApprovals(pCfg.governance_rules.min_approvals_default);
        }
      }

      // 3. Diagnóstico do Git
      const diag = await API.getGitDiagnostic();
      if (diag.ok && diag.data) {
        setGitDiagnostic(diag.data);
      }
    } catch (err) {
      console.error("[SettingsSubView] Erro ao carregar configurações:", err);
    }
  }, [loadProjectConfig]);

  useEffect(() => {
    loadAllSettings();
  }, [loadAllSettings]);

  // Handlers para Categorias
  const handleAddCategory = () => {
    const trimmed = newCatInput.trim().toLowerCase();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories([...categories, trimmed]);
    setNewCatInput("");
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter((c) => c !== catToRemove));
  };

  // Handlers para Tags
  const handleAddTag = () => {
    const trimmed = newTagInput.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Handlers para Status
  const handleAddStatus = () => {
    const keyTrimmed = newStatusKey.trim().toLowerCase();
    const labelTrimmed = newStatusLabel.trim();
    if (
      !keyTrimmed ||
      !labelTrimmed ||
      statuses.some((s) => s.key === keyTrimmed)
    )
      return;
    setStatuses([
      ...statuses,
      { key: keyTrimmed, label: labelTrimmed, badge: newStatusBadge },
    ]);
    setNewStatusKey("");
    setNewStatusLabel("");
    setNewStatusBadge("badge-neutral");
  };

  const handleRemoveStatus = (keyToRemove: string) => {
    setStatuses(statuses.filter((s) => s.key !== keyToRemove));
  };

  const handleUpdateStatusLabel = (key: string, newLabel: string) => {
    setStatuses(
      statuses.map((s) => (s.key === key ? { ...s, label: newLabel } : s)),
    );
  };

  const handleUpdateStatusBadge = (key: string, newBadge: string) => {
    setStatuses(
      statuses.map((s) => (s.key === key ? { ...s, badge: newBadge } : s)),
    );
  };

  const handleSaveAISettings = async () => {
    try {
      await saveAISettings(provider, model, apiKey, endpoint);
      setSaveStatus("Configurações do Motor de IA salvas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("[SettingsSubView] Erro ao salvar IA:", err);
      setSaveStatus("Erro ao salvar configurações de IA.");
    }
  };

  const handleSaveAllSettings = async () => {
    try {
      // 1. Salvar IA
      await saveAISettings(provider, model, apiKey, endpoint);

      // 2. Salvar Prompts & Governança Geral
      await API.saveSettings({
        system_prompts: {
          global: globalPrompt,
          template_creator: tplCreatorPrompt,
        },
        governance: {
          auto_pr: autoPROn,
        },
      });

      // 3. Salvar .project.config.json customizado do repositório
      await saveProjectConfig({
        project: {
          name: projectName,
          description: projectDescription,
          version: projectVersion,
          lead: projectLead,
          architecture_pattern: projectArchPattern,
          repository_url: projectRepoUrl,
        },
        categories,
        tags,
        statuses,
        ai_template_prompt: projectTemplatePrompt,
        governance_rules: {
          min_approvals_default: minApprovals,
        },
      });

      setSaveStatus("Todas as configurações foram salvas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("[SettingsSubView] Erro ao salvar tudo:", err);
      setSaveStatus("Erro ao salvar configurações gerais.");
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
        background: "var(--md-sys-color-surface-container-low, #f8f9fa)",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          width: "100%",
          margin: "0 auto",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Cabeçalho da Página */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--md-sys-color-on-surface, #202124)" }}>
              Configurações & Governança do Projeto
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--md-sys-color-on-surface-variant, #5f6368)" }}>
              Personalize o repositório ativo, motores de IA, prompts e regras de governança.
            </p>
          </div>
          <Button
            id="btn-save-system-settings"
            variant="primary"
            size="md"
            leftIcon={<Save size={16} />}
            onClick={handleSaveAllSettings}
          >
            Salvar Tudo
          </Button>
        </div>

        {saveStatus && (
          <AlertBanner
            type={saveStatus.includes("Erro") ? "error" : "success"}
            title={saveStatus}
            onClose={() => setSaveStatus(null)}
          />
        )}

        {/* SEÇÃO 1: CONFIGURAÇÕES DO PROJETO ATIVO (.project.config.json) */}
        <Card id="card-project-custom-config" variant="elevated">
          <CardHeader
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderGit2 size={20} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
                <span>Configurações do Projeto (.project.config.json)</span>
              </div>
            }
            subtitle={`Customizações de metadados, categorias, tags e status do repositório ${activeRepo?.name || "ativo"}.`}
            actions={
              <Badge variant="primary">
                {activeRepo?.name || "local"}
              </Badge>
            }
          />

          <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Grid de Informações Básicas do Projeto */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <FormField label="Nome do Projeto:">
                <Input
                  id="cfg-proj-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Condominiums..."
                />
              </FormField>

              <FormField label="Versão Semântica:">
                <Input
                  id="cfg-proj-version"
                  value={projectVersion}
                  onChange={(e) => setProjectVersion(e.target.value)}
                  placeholder="1.0.0"
                />
              </FormField>

              <FormField label="Líder / Tech Lead:">
                <Input
                  id="cfg-proj-lead"
                  value={projectLead}
                  onChange={(e) => setProjectLead(e.target.value)}
                  placeholder="@usuario"
                />
              </FormField>

              <FormField label="Padrão de Arquitetura:">
                <Input
                  id="cfg-proj-pattern"
                  value={projectArchPattern}
                  onChange={(e) => setProjectArchPattern(e.target.value)}
                  placeholder="Documentação Viva / Markdown Docs"
                />
              </FormField>
            </div>

            <FormField label="URL do Repositório (Git):">
              <Input
                id="cfg-proj-repo-url"
                value={projectRepoUrl}
                onChange={(e) => setProjectRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo.git"
              />
            </FormField>

            <FormField label="Descrição do Projeto:">
              <Textarea
                id="cfg-proj-desc"
                rows={2}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Descreva o propósito e o domínio do projeto..."
              />
            </FormField>

            {/* Categorias Oficiais */}
            <div style={{ borderTop: "1px solid var(--md-sys-color-outline-variant, #dadce0)", paddingTop: 14 }}>
              <FormField
                label="Categorias Oficiais de Especificação (categories):"
                helperText="Opções disponíveis nos seletores de metadados do documento (.docs.metadata.json)."
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  {categories.map((cat) => (
                    <Badge key={cat} variant="primary" size="md">
                      {cat}
                      <IconButton
                        size="sm"
                        tooltip={`Remover categoria ${cat}`}
                        style={{ width: 18, height: 18, marginLeft: 4 }}
                        onClick={() => handleRemoveCategory(cat)}
                      >
                        <X size={12} />
                      </IconButton>
                    </Badge>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, maxWidth: 400 }}>
                  <Input
                    placeholder="Nova categoria (ex: financeiro, auth)..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={handleAddCategory}
                    disabled={!newCatInput.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              </FormField>
            </div>

            {/* Tags de Taxonomia */}
            <div style={{ borderTop: "1px solid var(--md-sys-color-outline-variant, #dadce0)", paddingTop: 14 }}>
              <FormField
                label="Tags de Taxonomia do Projeto (tags):"
                helperText="Tags canônicas para categorização rápida de requisitos e especificações."
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  {tags.map((tag) => (
                    <Badge key={tag} variant="success" size="md">
                      #{tag}
                      <IconButton
                        size="sm"
                        tooltip={`Remover tag ${tag}`}
                        style={{ width: 18, height: 18, marginLeft: 4 }}
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X size={12} />
                      </IconButton>
                    </Badge>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, maxWidth: 400 }}>
                  <Input
                    placeholder="Nova tag (ex: database, mobile)..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={handleAddTag}
                    disabled={!newTagInput.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              </FormField>
            </div>

            {/* Status do Ciclo de Vida */}
            <div style={{ borderTop: "1px solid var(--md-sys-color-outline-variant, #dadce0)", paddingTop: 14 }}>
              <FormField
                label="Ciclo de Vida & Status Permitidos (statuses):"
                helperText="Estados de governança suportados pelo projeto no editor e no fluxo de aprovação."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {statuses.map((st) => (
                    <div
                      key={st.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--md-sys-color-surface, #ffffff)",
                        border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                        <code style={{ fontSize: "12px", color: "var(--md-sys-color-primary, #1a73e8)", minWidth: 90 }}>
                          {st.key}
                        </code>
                        <Input
                          value={st.label}
                          style={{ height: 32, fontSize: "12.5px" }}
                          onChange={(e) => handleUpdateStatusLabel(st.key, e.target.value)}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <select
                          className="ui-input"
                          style={{ height: 32, fontSize: "12px", width: 140 }}
                          value={st.badge || "badge-neutral"}
                          onChange={(e) => handleUpdateStatusBadge(st.key, e.target.value)}
                        >
                          <option value="badge-neutral">Neutro (Cinza)</option>
                          <option value="badge-primary">Primário (Azul)</option>
                          <option value="badge-success">Sucesso (Verde)</option>
                          <option value="badge-warning">Alerta (Amarelo)</option>
                          <option value="badge-danger">Perigo (Vermelho)</option>
                          <option value="badge-purple">Especial (Roxo)</option>
                        </select>
                        <IconButton
                          size="sm"
                          tooltip="Remover status"
                          onClick={() => handleRemoveStatus(st.key)}
                        >
                          <X size={14} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
                  <Input
                    placeholder="Chave (ex: in_review)..."
                    value={newStatusKey}
                    onChange={(e) => setNewStatusKey(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Input
                    placeholder="Rótulo (ex: Em Revisão)..."
                    value={newStatusLabel}
                    onChange={(e) => setNewStatusLabel(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={handleAddStatus}
                    disabled={!newStatusKey.trim() || !newStatusLabel.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* SEÇÃO 2: MOTOR DE INTELIGÊNCIA ARTIFICIAL */}
        <Card id="card-ai-engine-settings" variant="elevated">
          <CardHeader
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={20} style={{ color: "#10b981" }} />
                <span>Motor de Inteligência Artificial & Provedor</span>
              </div>
            }
            subtitle="Conecte seu modelo LLM preferido para geração de documentos, agentes e copiloto."
            actions={
              <Badge variant="success" hasDot>
                {provider.toUpperCase()}
              </Badge>
            }
          />

          <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Seletor de Provedor em Cartões */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { id: "gemini", name: "Google Gemini", sub: "Flash 2.5 & Pro" },
                { id: "openai", name: "OpenAI", sub: "GPT-4o & o3-mini" },
                { id: "anthropic", name: "Anthropic", sub: "Claude 3.7 & 3.5" },
                { id: "deepseek", name: "DeepSeek", sub: "V3 & R1 Reasoner" },
                { id: "local", name: "Ollama Local", sub: "Offline / Localhost" },
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
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: isSelected ? "2px solid #10b981" : "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--md-sys-color-surface, #ffffff)",
                      cursor: "pointer",
                      transition: "all 0.16s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: "13.5px", color: isSelected ? "#059669" : "inherit" }}>
                        {p.name}
                      </strong>
                      <input
                        type="radio"
                        name="settings-ai-provider"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ accentColor: "#10b981" }}
                      />
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--md-sys-color-on-surface-variant, #5f6368)", marginTop: 2, display: "block" }}>
                      {p.sub}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Model & API Key Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField
                label="Modelo Selecionado:"
                helperText={isDynamicList ? "Lista obtida diretamente da API do provedor." : undefined}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    {isCustomModelInput ? (
                      <Input
                        id="settings-ai-model-input"
                        placeholder="Ex: gemini-2.5-flash, gpt-4o"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      />
                    ) : (
                      <SelectDropdown
                        id="settings-ai-model-input"
                        value={model}
                        options={selectOptions}
                        onChange={(val) => setModel(val)}
                        placeholder="Selecione o modelo de IA..."
                        searchable={selectOptions.length > 5}
                        searchPlaceholder="Filtrar modelos..."
                        leadingIcon="smart_toy"
                      />
                    )}
                  </div>
                  <IconButton
                    size="sm"
                    bordered
                    tooltip="Buscar modelos do provedor"
                    onClick={() => fetchModelsForProvider(provider, apiKey, endpoint)}
                    disabled={isLoadingModels}
                  >
                    <RefreshCw size={14} className={isLoadingModels ? "spinning" : ""} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    bordered
                    tooltip={isCustomModelInput ? "Usar lista" : "Digitar modelo customizado"}
                    onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                  >
                    <Edit2 size={14} />
                  </IconButton>
                </div>
              </FormField>

              <FormField label="Chave de API (API Key):">
                <Input
                  type="password"
                  id="settings-ai-key-input"
                  placeholder="Cole sua chave aqui..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => {
                    if (apiKey.trim()) {
                      fetchModelsForProvider(provider, apiKey, endpoint);
                    }
                  }}
                />
              </FormField>
            </div>

            {provider === "local" && (
              <FormField label="Endpoint Local (Ollama / vLLM):">
                <Input
                  id="settings-ai-endpoint-input"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </FormField>
            )}
          </CardContent>

          <CardFooter>
            <Button
              id="btn-save-ai-settings-direct"
              variant="primary"
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={handleSaveAISettings}
            >
              Salvar Motor de IA
            </Button>
          </CardFooter>
        </Card>

        {/* SEÇÃO 3: PROMPTS MESTRE DO SISTEMA */}
        <Card variant="elevated">
          <CardHeader
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={20} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
                <span>Prompts Mestre do Sistema</span>
              </div>
            }
            subtitle="Defina as diretrizes oficiais injetadas nos assistentes e geradores."
            actions={<Badge variant="info">System Prompts</Badge>}
          />

          <CardContent style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FormField
              label="Prompt Global do Agent (Chat no Workspace):"
              helperText="Instrução base injetada em todas as conversas do Agentic Chat."
            >
              <Textarea
                id="sys-global-system-prompt"
                rows={4}
                style={{ fontFamily: "var(--md-sys-typescale-font-code, monospace)", fontSize: "12.5px" }}
                value={globalPrompt}
                onChange={(e) => setGlobalPrompt(e.target.value)}
                placeholder="Você é o Arquiteto e Assistente Oficial de Especificações..."
              />
            </FormField>

            <FormField
              label="Prompt do Criador de Templates:"
              helperText="Meta-prompt que orienta a IA na geração de novos templates estruturados."
            >
              <Textarea
                id="sys-template-creator-prompt"
                rows={3}
                style={{ fontFamily: "var(--md-sys-typescale-font-code, monospace)", fontSize: "12.5px" }}
                value={tplCreatorPrompt}
                onChange={(e) => setTplCreatorPrompt(e.target.value)}
                placeholder="Gere templates no padrão oficial de governança com frontmatter estruturado..."
              />
            </FormField>
          </CardContent>
        </Card>

        {/* SEÇÃO 4: GOVERNANÇA DE VERSÕES & REPOSITÓRIO */}
        <Card variant="elevated">
          <CardHeader
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GitBranch size={20} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
                <span>Governança de Versões & Repositório</span>
              </div>
            }
            subtitle="Status do controle de versões, trilhas ativas e fluxo de aprovação de propostas."
            actions={
              <Badge variant={gitDiagnostic?.installed ? "success" : "warning"} hasDot>
                {gitDiagnostic?.installed ? "Controle de Versões Ativo" : "Modo Offline"}
              </Badge>
            }
          />

          <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <StatCard
                title="Repositório Ativo"
                value={activeRepo?.name || "local"}
                icon={<FolderGit2 size={20} />}
              />
              <StatCard
                title="Motor de Versionamento"
                value={gitDiagnostic?.version || "Git"}
                icon={<GitBranch size={20} />}
              />
              <StatCard
                title="Trilha Ativa"
                value={gitStatus?.branch || "main"}
                icon={<GitBranch size={20} />}
              />
              <StatCard
                title="Versões Registradas"
                value={`${gitLog.length} ${gitLog.length === 1 ? "versão" : "versões"}`}
                icon={<ShieldCheck size={20} />}
              />
            </div>

            <Switch
              id="sys-auto-pr-check"
              checked={autoPROn}
              onChange={setAutoPROn}
              label="Modo Ágil (Acúmulo de Alterações)"
              description="Permite edição contínua no workspace acumulando alterações em 1 única proposta unificada"
            />
          </CardContent>
        </Card>

        {/* SEÇÃO 5: CONTA GITHUB & CONEXÃO */}
        <Card variant="elevated">
          <CardHeader
            title="Conexão GitHub & Sessão"
            subtitle="Credenciais e conta vinculada ao framework."
          />

          <CardContent>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                background: "var(--md-sys-color-surface, #ffffff)",
                borderRadius: 8,
                border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  id="settings-user-avatar"
                  src={
                    user?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=1a73e8&color=fff`
                  }
                  alt="Avatar"
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                />
                <div>
                  <strong id="settings-user-name" style={{ fontSize: "14px", display: "block" }}>
                    {user?.name || "Usuário Autenticado"}
                  </strong>
                  <span id="settings-user-login" style={{ fontSize: "12px", color: "var(--md-sys-color-on-surface-variant, #5f6368)" }}>
                    @{user?.login || "github"}
                  </span>
                </div>
              </div>

              <Button
                id="btn-settings-logout"
                variant="danger"
                size="sm"
                leftIcon={<LogOut size={14} />}
                onClick={logout}
              >
                Desconectar Conta
              </Button>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              id="btn-save-system-settings"
              variant="primary"
              size="md"
              leftIcon={<Save size={16} />}
              onClick={handleSaveAllSettings}
            >
              Salvar Todas as Configurações
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

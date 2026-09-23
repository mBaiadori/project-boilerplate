import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";

export const SettingsSubView: React.FC = () => {
  const { user, logout } = useAuth();
  const { aiSettings, saveSettings: saveAISettings } = useAI();
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
  const [model, setModel] = useState<string>("gemini-3.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("http://localhost:11434/v1");

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
    useState<string>("Modular Specs");
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

  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.active_provider || "gemini");
      setModel(aiSettings.active_model || "gemini-3.5-flash");
      setEndpoint(aiSettings.custom_endpoint || "http://localhost:11434/v1");
    }
  }, [aiSettings]);

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
            pCfg.project.architecture_pattern || "Modular Specs",
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

  // Salvamento das configurações de IA
  const handleSaveAISettings = async () => {
    setSaveStatus("Salvando configurações de IA...");
    try {
      await saveAISettings({
        active_provider: provider,
        active_model: model,
        api_keys: apiKey ? { [provider]: apiKey } : undefined,
        custom_endpoint: provider === "local" ? endpoint : undefined,
      });
      setSaveStatus("Configurações de IA salvas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Erro ao salvar IA:", err);
      setSaveStatus("Erro ao salvar IA.");
    }
  };

  // Salvamento das configurações específicas do projeto (.project.config.json)
  const handleSaveProjectConfig = async () => {
    setSaveStatus(
      "Salvando configurações do projeto (.project.config.json)...",
    );
    const projectConfigPayload = {
      project: {
        name: projectName,
        description: projectDescription,
        version: projectVersion,
        architecture_pattern: projectArchPattern,
        repository_url: projectRepoUrl,
        lead: projectLead,
      },
      categories: categories,
      tags: tags,
      statuses: statuses,
      governance_rules: {
        min_approvals_default: minApprovals,
      },
      reviewers: [],
      ai_template_prompt: projectTemplatePrompt,
    };

    const res = await saveProjectConfig(projectConfigPayload);
    if (res.success) {
      setSaveStatus(
        "Configurações do .project.config.json salvas com sucesso!",
      );
      setTimeout(() => setSaveStatus(null), 3500);
    } else {
      setSaveStatus(
        `Erro ao salvar projeto: ${res.error || "Falha ao gravar"}`,
      );
    }
  };

  // Salvamento unificado de todas as configurações
  const handleSaveAllSettings = async () => {
    setSaveStatus("Salvando todas as configurações...");
    try {
      await handleSaveAISettings();
      await handleSaveProjectConfig();
      await API.saveSettings({
        system_prompts: {
          global: globalPrompt,
          template_creator: tplCreatorPrompt,
        },
        governance: {
          auto_pr: autoPROn,
        },
      });
      setSaveStatus("Todas as configurações foram sincronizadas com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      setSaveStatus("Erro ao salvar configurações.");
    }
  };

  return (
    <div
      id="subview-settings"
      className="dash-subview"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div className="settings-view-wrapper">
        <div style={{ marginBottom: "24px" }}>
          <h2>Configurações & Governança</h2>
          <p className="subtitle">
            Gerencie as configurações do projeto ativo (.project.config.json),
            motor de Inteligência Artificial, prompts mestre e regras de
            governança.
          </p>
        </div>

        {saveStatus && (
          <div
            style={{
              padding: "10px 16px",
              background: "var(--bg-subtle, #eff6ff)",
              border: "1px solid var(--primary, #3b82f6)",
              borderRadius: "8px",
              color: "var(--primary, #2563eb)",
              marginBottom: "16px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {saveStatus}
          </div>
        )}

        {/* SEÇÃO 1: CONFIGURAÇÕES DO PROJETO ATIVO (.project.config.json) */}
        <div
          className="gov-card"
          style={{ marginBottom: "24px" }}
          id="card-project-custom-config"
        >
          <div className="gov-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="material-symbols-outlined icon-lg"
                style={{ color: "var(--primary, #2563eb)" }}
              >
                folder_managed
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px" }}>
                  Configurações do Projeto (.project.config.json)
                </h3>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: "2px 0 0 0",
                  }}
                >
                  Customizações de metadados, categorias, tags e status do
                  repositório <strong>{activeRepo?.name || "ativo"}</strong>.
                </p>
              </div>
            </div>
            <span
              className="badge badge-primary-subtle"
              style={{ fontSize: "11px" }}
            >
              {activeRepo?.name || "local"}
            </span>
          </div>

          {/* Grid de Informações Básicas do Projeto */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              marginTop: "16px",
            }}
          >
            <div className="form-group">
              <label htmlFor="cfg-proj-name">Nome do Projeto:</label>
              <input
                type="text"
                id="cfg-proj-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: Condominiums..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="cfg-proj-version">Versão Semântica:</label>
              <input
                type="text"
                id="cfg-proj-version"
                value={projectVersion}
                onChange={(e) => setProjectVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cfg-proj-lead">Líder / Tech Lead:</label>
              <input
                type="text"
                id="cfg-proj-lead"
                value={projectLead}
                onChange={(e) => setProjectLead(e.target.value)}
                placeholder="@usuario"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cfg-proj-pattern">Padrão de Arquitetura:</label>
              <input
                type="text"
                id="cfg-proj-pattern"
                value={projectArchPattern}
                onChange={(e) => setProjectArchPattern(e.target.value)}
                placeholder="Modular Specs / Clean Arch"
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "14px",
              marginTop: "10px",
            }}
          >
            <div className="form-group">
              <label htmlFor="cfg-proj-repo-url">
                URL do Repositório (Git):
              </label>
              <input
                type="text"
                id="cfg-proj-repo-url"
                value={projectRepoUrl}
                onChange={(e) => setProjectRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo.git"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cfg-proj-desc">Descrição do Projeto:</label>
              <textarea
                id="cfg-proj-desc"
                rows={2}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Descreva o propósito e o domínio do projeto..."
              />
            </div>
          </div>

          {/* Categorias Oficiais do Projeto */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Categorias Oficiais de Especificação (<code>categories</code>):
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "0 0 10px 0",
              }}
            >
              Opções disponíveis nos seletores de metadados do documento
              (.docs.metadata.json).
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "10px",
                alignItems: "center",
              }}
            >
              {categories.map((cat) => (
                <span
                  key={cat}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11.5px",
                    padding: "3px 9px",
                    borderRadius: "14px",
                    background: "rgba(37,99,235,0.1)",
                    color: "#2563eb",
                    fontWeight: 600,
                  }}
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      color: "#94a3b8",
                    }}
                    title={`Remover categoria ${cat}`}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "13px" }}
                    >
                      close
                    </span>
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", maxWidth: "380px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nova categoria (ex: financeiro, auth)..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                style={{ fontSize: "12px" }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddCategory}
                disabled={!newCatInput.trim()}
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Tags de Taxonomia do Projeto */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Tags de Taxonomia do Projeto (<code>tags</code>):
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "0 0 10px 0",
              }}
            >
              Tags canônicas para categorização rápida de requisitos e
              especificações.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "10px",
                alignItems: "center",
              }}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11.5px",
                    padding: "3px 9px",
                    borderRadius: "14px",
                    background: "rgba(16,185,129,0.1)",
                    color: "#059669",
                    fontWeight: 600,
                  }}
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      color: "#94a3b8",
                    }}
                    title={`Remover tag ${tag}`}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "13px" }}
                    >
                      close
                    </span>
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", maxWidth: "380px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nova tag (ex: database, mobile)..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                style={{ fontSize: "12px" }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddTag}
                disabled={!newTagInput.trim()}
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Ciclo de Vida de Status */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <label
              style={{
                fontSize: "13px",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Ciclo de Vida & Status Permitidos (<code>statuses</code>):
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "0 0 10px 0",
              }}
            >
              Estados de governança suportados pelo projeto no editor e no fluxo
              de aprovação.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              {statuses.map((st) => (
                <div
                  key={st.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flex: 1,
                    }}
                  >
                    <code
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        minWidth: "90px",
                      }}
                    >
                      {st.key}
                    </code>
                    <input
                      type="text"
                      className="form-input"
                      value={st.label}
                      onChange={(e) =>
                        handleUpdateStatusLabel(st.key, e.target.value)
                      }
                      style={{ fontSize: "12px", padding: "4px 8px", flex: 1 }}
                      placeholder="Rótulo descritivo..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStatus(st.key)}
                    className="btn-icon-subtle"
                    title={`Remover status ${st.key}`}
                    style={{ color: "#ef4444" }}
                  >
                    <span className="material-symbols-outlined icon-xs">
                      delete
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {/* Inserção de Novo Status */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Chave (ex: in_qa)"
                value={newStatusKey}
                onChange={(e) => setNewStatusKey(e.target.value)}
                style={{ fontSize: "12px", width: "130px" }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Rótulo (ex: Em Testes QA)"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                style={{ fontSize: "12px", flex: 1, minWidth: "160px" }}
              />
              <select
                className="form-select"
                value={newStatusBadge}
                onChange={(e) => setNewStatusBadge(e.target.value)}
                style={{ fontSize: "12px", width: "140px" }}
              >
                <option value="badge-neutral">badge-neutral</option>
                <option value="badge-warning">badge-warning</option>
                <option value="badge-info">badge-info</option>
                <option value="badge-success">badge-success</option>
                <option value="badge-secondary">badge-secondary</option>
                <option value="badge-danger">badge-danger</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddStatus}
                disabled={!newStatusKey.trim() || !newStatusLabel.trim()}
              >
                + Adicionar Status
              </button>
            </div>
          </div>

          {/* Prompt Especializado do Criador de Templates (.project.config.json) */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <label
              htmlFor="cfg-proj-tpl-prompt"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Prompt Especializado do Criador de Templates (
              <code>ai_template_prompt</code>):
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "0 0 6px 0",
              }}
            >
              Instrução ativada automaticamente no Copilot ao criar ou editar
              templates neste repositório.
            </p>
            <textarea
              id="cfg-proj-tpl-prompt"
              rows={3}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
              value={projectTemplatePrompt}
              onChange={(e) => setProjectTemplatePrompt(e.target.value)}
              placeholder="Você é o Arquiteto de Templates do projeto..."
            />
          </div>

          {/* Quórum de Aprovações */}
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <label
              htmlFor="cfg-proj-min-approvals"
              style={{
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--text-normal)",
              }}
            >
              Quórum Mínimo de Aprovações (PRs):
            </label>
            <input
              type="number"
              id="cfg-proj-min-approvals"
              min={1}
              max={10}
              value={minApprovals}
              onChange={(e) =>
                setMinApprovals(parseInt(e.target.value, 10) || 1)
              }
              style={{ width: "70px", padding: "4px 8px", fontSize: "12px" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "18px",
            }}
          >
            <button
              id="btn-save-project-config-direct"
              className="btn btn-primary btn-sm"
              type="button"
              onClick={handleSaveProjectConfig}
            >
              Salvar Configurações do Projeto (.project.config.json)
            </button>
          </div>
        </div>

        {/* SEÇÃO 2: MOTOR DE INTELIGÊNCIA ARTIFICIAL (IA) */}
        <div className="gov-card" style={{ marginBottom: "24px" }}>
          <div className="gov-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="material-symbols-outlined icon-lg"
                style={{ color: "var(--md-sys-color-primary, #2563eb)" }}
              >
                smart_toy
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px" }}>
                  Provedor de Inteligência Artificial & Modelos
                </h3>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: "2px 0 0 0",
                  }}
                >
                  Escolha o provedor de LLM utilizado pelo assistente em tempo
                  real e geradores.
                </p>
              </div>
            </div>
            <span className="pill-dot success" id="settings-ai-status-pill">
              <span className="dot"></span> Ativo
            </span>
          </div>

          {/* Provider Selection Cards Grid */}
          <div
            className="provider-cards-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "12px",
              margin: "16px 0",
            }}
          >
            <div
              className={`provider-card-option ${provider === "gemini" ? "selected" : ""}`}
              data-provider="gemini"
              onClick={() => {
                setProvider("gemini");
                setModel("gemini-3.5-flash");
              }}
              style={{
                padding: "12px",
                border: provider === "gemini" ? "1.5px solid #10b981" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                background: provider === "gemini" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                boxShadow: provider === "gemini" ? "0 0 0 1px #10b981" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: provider === "gemini" ? "#059669" : "inherit" }}>Google Gemini</strong>
                <input
                  type="radio"
                  name="settings-ai-provider"
                  value="gemini"
                  checked={provider === "gemini"}
                  onChange={() => {}}
                  style={{ accentColor: "#10b981" }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginTop: "4px",
                }}
              >
                Flash 3.5 & Pro
              </span>
            </div>

            <div
              className={`provider-card-option ${provider === "openai" ? "selected" : ""}`}
              data-provider="openai"
              onClick={() => {
                setProvider("openai");
                setModel("gpt-4o");
              }}
              style={{
                padding: "12px",
                border: provider === "openai" ? "1.5px solid #10b981" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                background: provider === "openai" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                boxShadow: provider === "openai" ? "0 0 0 1px #10b981" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: provider === "openai" ? "#059669" : "inherit" }}>OpenAI</strong>
                <input
                  type="radio"
                  name="settings-ai-provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={() => {}}
                  style={{ accentColor: "#10b981" }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginTop: "4px",
                }}
              >
                GPT-4o & o3-mini
              </span>
            </div>

            <div
              className={`provider-card-option ${provider === "anthropic" ? "selected" : ""}`}
              data-provider="anthropic"
              onClick={() => {
                setProvider("anthropic");
                setModel("claude-3-5-sonnet-20241022");
              }}
              style={{
                padding: "12px",
                border: provider === "anthropic" ? "1.5px solid #10b981" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                background: provider === "anthropic" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                boxShadow: provider === "anthropic" ? "0 0 0 1px #10b981" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: provider === "anthropic" ? "#059669" : "inherit" }}>Anthropic</strong>
                <input
                  type="radio"
                  name="settings-ai-provider"
                  value="anthropic"
                  checked={provider === "anthropic"}
                  onChange={() => {}}
                  style={{ accentColor: "#10b981" }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginTop: "4px",
                }}
              >
                Claude 3.5 Sonnet
              </span>
            </div>

            <div
              className={`provider-card-option ${provider === "deepseek" ? "selected" : ""}`}
              data-provider="deepseek"
              onClick={() => {
                setProvider("deepseek");
                setModel("deepseek-chat");
              }}
              style={{
                padding: "12px",
                border: provider === "deepseek" ? "1.5px solid #10b981" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                background: provider === "deepseek" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                boxShadow: provider === "deepseek" ? "0 0 0 1px #10b981" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: provider === "deepseek" ? "#059669" : "inherit" }}>DeepSeek</strong>
                <input
                  type="radio"
                  name="settings-ai-provider"
                  value="deepseek"
                  checked={provider === "deepseek"}
                  onChange={() => {}}
                  style={{ accentColor: "#10b981" }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginTop: "4px",
                }}
              >
                V3 & R1 Reasoner
              </span>
            </div>

            <div
              className={`provider-card-option ${provider === "local" ? "selected" : ""}`}
              data-provider="local"
              onClick={() => {
                setProvider("local");
                setModel("llama3.2");
              }}
              style={{
                padding: "12px",
                border: provider === "local" ? "1.5px solid #10b981" : "1.5px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                background: provider === "local" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                boxShadow: provider === "local" ? "0 0 0 1px #10b981" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ color: provider === "local" ? "#059669" : "inherit" }}>Ollama Local</strong>
                <input
                  type="radio"
                  name="settings-ai-provider"
                  value="local"
                  checked={provider === "local"}
                  onChange={() => {}}
                  style={{ accentColor: "#10b981" }}
                />
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                  marginTop: "4px",
                }}
              >
                Offline / Localhost
              </span>
            </div>
          </div>

          {/* Model & API Key Inputs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginTop: "10px",
            }}
          >
            <div className="form-group">
              <label htmlFor="settings-ai-model-input">
                Modelo Selecionado:
              </label>
              <input
                type="text"
                id="settings-ai-model-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <span
                id="settings-ai-model-hint"
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "3px",
                }}
              >
                Modelos recomendados: gemini-3.5-flash, gemini-3-flash-preview,
                gpt-4o
              </span>
            </div>

            <div className="form-group" id="settings-ai-key-group">
              <label htmlFor="settings-ai-key-input">
                Chave de API (API Key):
              </label>
              <input
                type="password"
                id="settings-ai-key-input"
                placeholder="Cole sua chave aqui..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>

          {provider === "local" && (
            <div
              className="form-group"
              id="settings-ai-endpoint-group"
              style={{ marginTop: "10px" }}
            >
              <label htmlFor="settings-ai-endpoint-input">
                Endpoint Local (Ollama / vLLM):
              </label>
              <input
                type="text"
                id="settings-ai-endpoint-input"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "14px",
            }}
          >
            <button
              id="btn-save-ai-settings-direct"
              className="btn btn-primary btn-sm"
              type="button"
              onClick={handleSaveAISettings}
            >
              Salvar Motor de IA
            </button>
          </div>
        </div>

        {/* SEÇÃO 3: PROMPTS MESTRE DO SISTEMA */}
        <div className="gov-card" style={{ marginBottom: "24px" }}>
          <div className="gov-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "15px" }}>
                Prompts Mestre do Sistema
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  margin: "2px 0 0 0",
                }}
              >
                Defina as diretrizes oficiais injetadas nos assistentes e
                geradores.
              </p>
            </div>
            <span className="pill-dot info">
              <span className="dot"></span> System Prompts
            </span>
          </div>

          <div className="form-group" style={{ marginTop: "14px" }}>
            <label htmlFor="sys-global-system-prompt">
              <strong>Prompt Global do Agent (Chat no Workspace):</strong>
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "2px 0 6px 0",
              }}
            >
              Instrução base injetada em todas as conversas do Agentic Chat.
            </p>
            <textarea
              id="sys-global-system-prompt"
              rows={4}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
              placeholder="Você é o Arquiteto e Assistente Oficial de Especificações..."
            />
          </div>

          <div className="form-group" style={{ marginTop: "14px" }}>
            <label htmlFor="sys-template-creator-prompt">
              <strong>Prompt do Criador de Templates:</strong>
            </label>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                margin: "2px 0 6px 0",
              }}
            >
              Meta-prompt que orienta a IA na geração de novos templates
              estruturados.
            </p>
            <textarea
              id="sys-template-creator-prompt"
              rows={3}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
              value={tplCreatorPrompt}
              onChange={(e) => setTplCreatorPrompt(e.target.value)}
              placeholder="Gere templates no padrão oficial de governança com frontmatter estruturado..."
            />
          </div>
        </div>

        {/* SEÇÃO 4: REGRAS DE GOVERNANÇA & GIT */}
        <div className="gov-card" style={{ marginBottom: "24px" }}>
          <div className="gov-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="material-symbols-outlined icon-lg"
                style={{ color: "var(--md-sys-color-primary, #3b82f6)" }}
              >
                alt_route
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px" }}>
                  Governança de Pull Requests & Git
                </h3>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: "2px 0 0 0",
                  }}
                >
                  Status da integração local de Git, branches e fluxo de
                  aprovação de PRs.
                </p>
              </div>
            </div>
            <span
              className={`pill-dot ${gitDiagnostic?.installed ? "success" : "warning"}`}
            >
              <span className="dot"></span>{" "}
              {gitDiagnostic?.installed ? "Git Conectado" : "Git Offline"}
            </span>
          </div>

          {/* Git Stats Panel */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "14px",
            }}
          >
            <div
              style={{
                padding: "12px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                }}
              >
                Repositório Ativo
              </span>
              <strong
                style={{ fontSize: "13px", fontFamily: "var(--font-mono)" }}
              >
                {activeRepo?.name || "local"}
              </strong>
            </div>

            <div
              style={{
                padding: "12px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                }}
              >
                CLI do Git
              </span>
              <strong
                style={{ fontSize: "13px", fontFamily: "var(--font-mono)" }}
              >
                {gitDiagnostic?.version || "Verificando..."}
              </strong>
            </div>

            <div
              style={{
                padding: "12px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                }}
              >
                Branch Ativa
              </span>
              <strong
                style={{ fontSize: "13px", fontFamily: "var(--font-mono)" }}
              >
                {gitStatus?.branch || "main"}
              </strong>
            </div>

            <div
              style={{
                padding: "12px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                }}
              >
                Remote Origin
              </span>
              <strong
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  wordBreak: "break-all",
                }}
              >
                {gitStatus?.remoteUrl || "Local (Sem remote)"}
              </strong>
            </div>

            <div
              style={{
                padding: "12px",
                background: "var(--bg-surface)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "block",
                }}
              >
                Commits Registrados
              </span>
              <strong style={{ fontSize: "13px" }}>
                {gitLog.length} commits
              </strong>
            </div>
          </div>

          <div className="form-group-checkbox" style={{ marginTop: "16px" }}>
            <label>
              <input
                type="checkbox"
                id="sys-auto-pr-check"
                checked={autoPROn}
                onChange={(e) => setAutoPROn(e.target.checked)}
              />
              <span>
                <strong>Modo Ágil:</strong> Permitir edição contínua no
                workspace acumulando alterações em 1 único PR unificado
              </span>
            </label>
          </div>
        </div>

        {/* SEÇÃO 5: CONTA GITHUB & CONEXÃO */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "15px" }}>
                Conexão GitHub & Sessão
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  margin: "2px 0 0 0",
                }}
              >
                Credenciais e conta vinculada ao framework.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "14px",
              padding: "12px",
              background: "var(--bg-surface)",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img
                id="settings-user-avatar"
                src={
                  user?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=6366f1&color=fff`
                }
                alt="Avatar"
                style={{ width: "38px", height: "38px", borderRadius: "50%" }}
              />
              <div>
                <strong
                  id="settings-user-name"
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-normal)",
                    display: "block",
                  }}
                >
                  {user?.name || "Usuário Autenticado"}
                </strong>
                <span
                  id="settings-user-login"
                  style={{ fontSize: "11.5px", color: "var(--text-muted)" }}
                >
                  @{user?.login || "github"}
                </span>
              </div>
            </div>

            <button
              id="btn-settings-logout"
              className="btn btn-secondary btn-sm"
              type="button"
              style={{ color: "#ef4444" }}
              onClick={logout}
            >
              Desconectar Conta
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "18px",
            }}
          >
            <button
              id="btn-save-system-settings"
              className="btn btn-primary"
              type="button"
              onClick={handleSaveAllSettings}
            >
              Salvar Todas as Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

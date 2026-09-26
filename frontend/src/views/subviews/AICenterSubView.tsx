// =============================================================================
// SUBVIEW: CENTRAL DE IA & AGENTES (AI CENTER)
// Gestão unificada de Skills (ECC), Personas/Agentes, Tools Nativas e Conectores MCP
// Totalmente integrado ao Design System e Tokens de Tema da aplicação
// =============================================================================

import React, { useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAI } from "../../context/AIContext";
import { API } from "../../services/api";
import type { SkillItem, AgentDefinition, MCPServerDefinition, ToolItem } from "../../types";

type MainTab = "skills" | "agents" | "tools" | "mcp";
type SkillSubTab = "installed" | "hub";
type AgentSubTab = "installed" | "hub";

const CATEGORY_CHIPS = [
  { id: "all", label: "Todas" },
  { id: "governance", label: "Governança" },
  { id: "architecture", label: "Arquitetura" },
  { id: "quality", label: "Qualidade" },
  { id: "engineering", label: "Engenharia" },
  { id: "memory", label: "Memória" },
];

export const AICenterSubView: React.FC = () => {
  const { activeRepo } = useWorkspace();
  const { activeSkillId, setActiveSkillId } = useAI();

  const [activeMainTab, setActiveMainTab] = useState<MainTab>("skills");
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // 1. Skills State
  const [skillSubTab, setSkillSubTab] = useState<SkillSubTab>("installed");
  const [hubSkills, setHubSkills] = useState<SkillItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<SkillItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  // 2. Agents State
  const [agentSubTab, setAgentSubTab] = useState<AgentSubTab>("hub");
  const [hubAgents, setHubAgents] = useState<AgentDefinition[]>([]);
  const [installedAgents, setInstalledAgents] = useState<AgentDefinition[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);

  // 3. Tools State
  const [toolsList, setToolsList] = useState<ToolItem[]>([]);
  const [testingTool, setTestingTool] = useState<ToolItem | null>(null);
  const [toolArgsInput, setToolArgsInput] = useState("{}");
  const [toolTestResult, setToolTestResult] = useState<any>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  // 4. MCP State
  const [mcpTemplates, setMcpTemplates] = useState<MCPServerDefinition[]>([]);
  const [projectMcpServers, setProjectMcpServers] = useState<MCPServerDefinition[]>([]);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpType, setNewMcpType] = useState<"stdio" | "sse">("stdio");
  const [newMcpCommand, setNewMcpCommand] = useState("");
  const [newMcpEndpoint, setNewMcpEndpoint] = useState("");
  const [newMcpDesc, setNewMcpDesc] = useState("");

  useEffect(() => {
    loadAllData();
  }, [activeRepo]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const repo = activeRepo?.name;
      const [hubSkillsRes, projSkillsRes, hubAgentsRes, projAgentsRes, toolsRes, mcpTemplatesRes, projMcpRes] = await Promise.all([
        API.getSkillsHub(),
        API.getSkillsProject(repo),
        API.getAgentsHub(),
        API.getAgentsProject(repo),
        API.getTools(),
        API.getMcpTemplates(),
        API.getMcpProject(repo),
      ]);

      if (hubSkillsRes.ok && hubSkillsRes.data) setHubSkills(hubSkillsRes.data.skills || []);
      if (projSkillsRes.ok && projSkillsRes.data) {
        const inst = projSkillsRes.data.installed_skills || [];
        setInstalledSkills(inst);
        if (inst.length === 0 && skillSubTab === "installed") setSkillSubTab("hub");
      }

      if (hubAgentsRes.ok && hubAgentsRes.data) setHubAgents(hubAgentsRes.data.agents || []);
      if (projAgentsRes.ok && projAgentsRes.data) setInstalledAgents(projAgentsRes.data.agents || []);

      if (toolsRes.ok && toolsRes.data) setToolsList(toolsRes.data.tools || []);
      if (mcpTemplatesRes.ok && mcpTemplatesRes.data) setMcpTemplates(mcpTemplatesRes.data.templates || []);
      if (projMcpRes.ok && projMcpRes.data) setProjectMcpServers(projMcpRes.data.servers || []);
    } catch (err) {
      console.error("Erro ao carregar dados do AI Center:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Skills Handlers ---
  const handleInstallSkill = async (skill: SkillItem) => {
    try {
      setActionFeedback({ ok: true, msg: `Instalando skill '${skill.title || skill.name}'...` });
      const res = await API.installSkill(skill.id, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: `Skill '${skill.title || skill.name}' instalada com sucesso!` });
        await loadAllData();
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        setActionFeedback({ ok: false, msg: (res.data as any)?.message || "Falha ao instalar skill." });
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  const handleUninstallSkill = async (skillId: string) => {
    const ok = window.confirm("Deseja remover esta skill do projeto?");
    if (!ok) return;
    try {
      setActionFeedback({ ok: true, msg: "Removendo skill..." });
      const res = await API.uninstallSkill(skillId, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: "Skill removida do projeto." });
        await loadAllData();
        if (selectedSkill?.id === skillId) setSelectedSkill(null);
        if (activeSkillId === skillId) setActiveSkillId("living-docs-governance");
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  // --- Agents Handlers ---
  const handleInstallAgent = async (agent: AgentDefinition) => {
    try {
      setActionFeedback({ ok: true, msg: `Instalando persona '${agent.title}' no projeto...` });
      const res = await API.installAgent(agent.id, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: `Persona '${agent.title}' pronta no projeto!` });
        await loadAllData();
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  const handleUninstallAgent = async (agentId: string) => {
    const ok = window.confirm("Deseja remover este agente do projeto?");
    if (!ok) return;
    try {
      const res = await API.uninstallAgent(agentId, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: "Agente removido." });
        await loadAllData();
        if (selectedAgent?.id === agentId) setSelectedAgent(null);
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  // --- Tools Test Handler ---
  const handleExecuteToolTest = async () => {
    if (!testingTool) return;
    setIsExecutingTool(true);
    setToolTestResult(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsInput || "{}");
      } catch (e) {
        setToolTestResult({ success: false, error: "JSON de argumentos inválido." });
        setIsExecutingTool(false);
        return;
      }

      const res = await API.executeToolTest(testingTool.name, parsedArgs, activeRepo?.name);
      if (res.ok) {
        setToolTestResult(res.data);
      } else {
        setToolTestResult({ success: false, error: (res.data as any)?.error || "Erro na execução da tool." });
      }
    } catch (err: any) {
      setToolTestResult({ success: false, error: err.message });
    } finally {
      setIsExecutingTool(false);
    }
  };

  // --- MCP Handlers ---
  const handleSaveMcpFromTemplate = async (tpl: MCPServerDefinition) => {
    try {
      setActionFeedback({ ok: true, msg: `Adicionando conector MCP '${tpl.name}'...` });
      const res = await API.saveMcpServer({ ...tpl, enabled: true }, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: `Conector MCP '${tpl.name}' adicionado!` });
        await loadAllData();
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro ao salvar MCP." });
    }
  };

  const handleSaveCustomMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName.trim()) return;
    try {
      const serverDef: MCPServerDefinition = {
        id: newMcpName.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        name: newMcpName.trim(),
        description: newMcpDesc.trim() || "Servidor MCP customizado.",
        type: newMcpType,
        command: newMcpType === "stdio" ? newMcpCommand.trim() : undefined,
        endpoint: newMcpType === "sse" ? newMcpEndpoint.trim() : undefined,
        enabled: true,
      };

      const res = await API.saveMcpServer(serverDef, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: `MCP '${newMcpName}' cadastrado!` });
        setIsAddingMcp(false);
        setNewMcpName("");
        setNewMcpCommand("");
        setNewMcpEndpoint("");
        setNewMcpDesc("");
        await loadAllData();
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro ao cadastrar MCP." });
    }
  };

  const handleRemoveMcp = async (id: string) => {
    const ok = window.confirm("Deseja remover este conector MCP?");
    if (!ok) return;
    try {
      const res = await API.removeMcpServer(id, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: "Conector MCP removido." });
        await loadAllData();
        setTimeout(() => setActionFeedback(null), 3500);
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro ao remover." });
    }
  };

  const isSkillInstalled = (id: string) => installedSkills.some((s) => s.id === id);
  const isAgentInstalled = (id: string) => installedAgents.some((a) => a.id === id);
  const isMcpInstalled = (id: string) => projectMcpServers.some((s) => s.id === id);

  const displayedSkills = skillSubTab === "installed" ? installedSkills : hubSkills;
  const filteredSkills = displayedSkills.filter((s) => {
    const matchesCat = selectedCategory === "all" || s.category?.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.title && s.title.toLowerCase().includes(q)) ||
      s.description.toLowerCase().includes(q) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)));
    return matchesCat && matchesSearch;
  });

  const displayedAgents = agentSubTab === "installed" ? installedAgents : hubAgents;

  return (
    <div
      id="subview-aicenter"
      className="dash-subview"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        background: "var(--color-surface, #ffffff)",
      }}
    >
      <div className="templates-view-wrapper" style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* ── 1. Page Header ── */}
        <div className="template-store-header" style={{ marginBottom: "16px" }}>
          <div className="templates-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "var(--color-on-surface, var(--text-main))" }}>
                  AI Center • Central de Inteligência
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "var(--color-primary-container, #d2e3fc)",
                    color: "var(--color-on-primary-container, #041e49)",
                    border: "1px solid var(--color-primary, #1a73e8)",
                  }}
                >
                  Context OS & ECC
                </span>
              </div>
              <p className="subtitle" style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", marginBottom: 0 }}>
                Gestão integrada de Skills, Personas Autônomas, Ferramentas Nativas e Servidores MCP ({activeRepo ? `projects/${activeRepo.name}` : "Workspace"}).
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                id="btn-refresh-aicenter"
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={loadAllData}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span className="material-symbols-outlined icon-xs">refresh</span>
                Sincronizar
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div style={{ padding: "6px 12px", marginBottom: "12px", borderRadius: "6px", fontSize: "11px", background: "var(--color-surface-container-low, #f8f9fa)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined icon-xs">sync</span>
              Carregando dados do AI Center...
            </div>
          )}

          {/* Feedback Alert */}
          {actionFeedback && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: actionFeedback.ok
                  ? "var(--color-primary-container, rgba(26, 115, 232, 0.12))"
                  : "var(--color-error-container, rgba(217, 48, 37, 0.12))",
                color: actionFeedback.ok
                  ? "var(--color-on-primary-container, #1a73e8)"
                  : "var(--color-on-error-container, #d93025)",
                border: "1px solid var(--color-outline-variant, #e2e8f0)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {actionFeedback.ok ? "check_circle" : "error"}
              </span>
              {actionFeedback.msg}
            </div>
          )}

          {/* ── 2. Top-Level Main Tabs ── */}
          <div className="template-store-tabs" role="tablist" style={{ borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)", marginBottom: "16px" }}>
            <button
              className={`store-tab-btn ${activeMainTab === "skills" ? "active" : ""}`}
              onClick={() => setActiveMainTab("skills")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                auto_awesome
              </span>
              Skills & Regras ({installedSkills.length}/{hubSkills.length})
            </button>

            <button
              className={`store-tab-btn ${activeMainTab === "agents" ? "active" : ""}`}
              onClick={() => setActiveMainTab("agents")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                psychology
              </span>
              Personas & Agentes ({installedAgents.length}/{hubAgents.length})
            </button>

            <button
              className={`store-tab-btn ${activeMainTab === "tools" ? "active" : ""}`}
              onClick={() => setActiveMainTab("tools")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                build
              </span>
              Tools Nativas ({toolsList.length})
            </button>

            <button
              className={`store-tab-btn ${activeMainTab === "mcp" ? "active" : ""}`}
              onClick={() => setActiveMainTab("mcp")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                cable
              </span>
              Conectores MCP ({projectMcpServers.length})
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SKILLS & REGRAS (ECC PATTERN)                                      */}
        {/* ========================================================================= */}
        {activeMainTab === "skills" && (
          <div>
            {/* Sub-tabs: Instaladas vs Hub */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setSkillSubTab("installed")}
                  className={`store-filter-chip ${skillSubTab === "installed" ? "active" : ""}`}
                >
                  📁 Instaladas no Projeto ({installedSkills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSkillSubTab("hub")}
                  className={`store-filter-chip ${skillSubTab === "hub" ? "active" : ""}`}
                >
                  🌐 Catálogo Global ECC ({hubSkills.length})
                </button>
              </div>

              {/* Category chips & Search */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div className="store-filter-bar">
                  {CATEGORY_CHIPS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={`store-filter-chip ${selectedCategory === c.id ? "active" : ""}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Filtrar skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    fontSize: "12px",
                    padding: "5px 12px",
                    borderRadius: "16px",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    background: "var(--color-surface, #ffffff)",
                    color: "var(--color-on-surface, #202124)",
                    width: "180px",
                  }}
                />
              </div>
            </div>

            {/* Skills Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {filteredSkills.map((skill) => {
                const installed = isSkillInstalled(skill.id);
                const isActive = activeSkillId === skill.id;

                return (
                  <div
                    key={skill.id}
                    className="template-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--color-surface-container-low, #f8f9fa)",
                      border: isActive
                        ? "1px solid var(--color-primary, #1a73e8)"
                        : "1px solid var(--color-outline-variant, #e2e8f0)",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span className="badge badge-primary-subtle" style={{ fontSize: "10.5px", textTransform: "capitalize" }}>
                        {skill.category}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {installed && (
                          <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                            Instalada
                          </span>
                        )}
                        <span style={{ fontSize: "10.5px", fontFamily: "monospace", color: "var(--text-muted)" }}>v{skill.version}</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 6px 0", color: "var(--color-on-surface)" }}>
                      {skill.title || skill.name}
                    </h3>

                    <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4", flex: 1, margin: "0 0 12px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {skill.description}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                      {skill.tools?.slice(0, 3).map((t) => (
                        <span key={t} style={{ fontSize: "10px", fontFamily: "monospace", padding: "2px 6px", borderRadius: "4px", background: "var(--color-surface-container, #f1f3f4)", color: "var(--color-on-surface)" }}>
                          {t}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedSkill(skill)}
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        <span className="material-symbols-outlined icon-xs">visibility</span>
                        Instruções
                      </button>

                      <div style={{ display: "flex", gap: "6px" }}>
                        {installed ? (
                          <>
                            <button
                              type="button"
                              className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                              onClick={() => {
                                setActiveSkillId(skill.id);
                                setActionFeedback({ ok: true, msg: `Skill '${skill.title || skill.name}' ativa no Copilot!` });
                                setTimeout(() => setActionFeedback(null), 3000);
                              }}
                              style={{ fontSize: "11px", padding: "4px 10px" }}
                            >
                              {isActive ? "Ativa no Copilot" : "Usar no Chat"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleUninstallSkill(skill.id)}
                              style={{ color: "var(--color-error, #d93025)", padding: "4px 6px" }}
                              title="Desinstalar"
                            >
                              <span className="material-symbols-outlined icon-xs">delete</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleInstallSkill(skill)}
                            style={{ fontSize: "11px", padding: "4px 10px" }}
                          >
                            <span className="material-symbols-outlined icon-xs">download</span>
                            Instalar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PERSONAS & AGENTES                                                 */}
        {/* ========================================================================= */}
        {activeMainTab === "agents" && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setAgentSubTab("hub")}
                className={`store-filter-chip ${agentSubTab === "hub" ? "active" : ""}`}
              >
                🌐 Catálogo Global de Personas ({hubAgents.length})
              </button>
              <button
                type="button"
                onClick={() => setAgentSubTab("installed")}
                className={`store-filter-chip ${agentSubTab === "installed" ? "active" : ""}`}
              >
                📁 Instalados no Projeto ({installedAgents.length})
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {displayedAgents.map((agent) => {
                const installed = isAgentInstalled(agent.id);

                return (
                  <div
                    key={agent.id}
                    className="template-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--color-surface-container-low, #f8f9fa)",
                      border: "1px solid var(--color-outline-variant, #e2e8f0)",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "24px",
                          color: "var(--color-primary, #1a73e8)",
                          background: "var(--color-primary-container, #d2e3fc)",
                          padding: "8px",
                          borderRadius: "8px",
                        }}
                      >
                        {agent.icon || "psychology"}
                      </span>
                      <div>
                        <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--color-on-surface)" }}>
                          {agent.title}
                        </h3>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{agent.role}</span>
                      </div>
                    </div>

                    <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4", flex: 1, margin: "0 0 12px 0" }}>
                      {agent.description}
                    </p>

                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--text-muted)" }}>Skills Integradas:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        {agent.skills.map((s) => (
                          <span key={s} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(26, 115, 232, 0.1)", color: "var(--color-primary, #1a73e8)" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedAgent(agent)}
                        style={{ fontSize: "11px" }}
                      >
                        Ver Persona
                      </button>

                      {installed ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleUninstallAgent(agent.id)}
                          style={{ color: "var(--color-error, #d93025)", fontSize: "11px" }}
                        >
                          Desinstalar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleInstallAgent(agent)}
                          style={{ fontSize: "11px" }}
                        >
                          <span className="material-symbols-outlined icon-xs">download</span>
                          Instalar Persona
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TOOLS NATIVAS DO REPOSITÓRIO & PLAYGROUND                          */}
        {/* ========================================================================= */}
        {activeMainTab === "tools" && (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Ferramentas executadas com segurança no servidor Node.js. O Agente e o Copilot utilizam essas tools para inspecionar e atualizar a documentação.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {toolsList.map((tool) => (
                <div
                  key={tool.name}
                  className="template-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--color-surface-container-low, #f8f9fa)",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: "var(--color-primary, #1a73e8)" }}>
                      {tool.name}
                    </span>
                    <span className="badge badge-success-subtle" style={{ fontSize: "10px" }}>
                      Ativa
                    </span>
                  </div>

                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4", flex: 1, margin: "0 0 12px 0" }}>
                    {tool.description}
                  </p>

                  <div style={{ paddingTop: "10px", borderTop: "1px solid var(--color-outline-variant, #e2e8f0)", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setTestingTool(tool);
                        setToolArgsInput(JSON.stringify(tool.parameters?.properties ? Object.keys(tool.parameters.properties).reduce((acc: any, k) => { acc[k] = ""; return acc; }, {}) : {}, null, 2));
                        setToolTestResult(null);
                      }}
                      style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <span className="material-symbols-outlined icon-xs">play_arrow</span>
                      Testar Tool
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CONECTORES MCP (MODEL CONTEXT PROTOCOL)                             */}
        {/* ========================================================================= */}
        {activeMainTab === "mcp" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Conecte servidores externos usando o padrão MCP (GitHub, PostgreSQL, Fetch Web, SQLite).
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsAddingMcp(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Novo Servidor MCP
              </button>
            </div>

            {/* Configured MCP Servers */}
            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--color-on-surface)" }}>
              Servidores MCP Ativos no Projeto ({projectMcpServers.length})
            </h4>

            {projectMcpServers.length === 0 ? (
              <div style={{ padding: "24px", background: "var(--color-surface-container-low, #f8f9fa)", borderRadius: "10px", border: "1px dashed var(--color-outline-variant, #e2e8f0)", textAlign: "center", marginBottom: "24px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "var(--text-muted)", opacity: 0.5 }}>
                  cable
                </span>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "6px 0 0 0" }}>
                  Nenhum servidor MCP configurado no `.mcp.json`. Adicione um template abaixo ou cadastre um customizado.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginBottom: "28px" }}>
                {projectMcpServers.map((s) => (
                  <div key={s.id} className="template-card" style={{ padding: "16px", borderRadius: "12px", background: "var(--color-surface-container-low, #f8f9fa)", border: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>{s.name}</h4>
                      <span className="badge badge-success-subtle" style={{ fontSize: "10px" }}>Ativo</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px 0" }}>{s.description}</p>
                    <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-muted)", background: "var(--color-surface, #fff)", padding: "6px", borderRadius: "6px", marginBottom: "10px" }}>
                      {s.type === "stdio" ? `cmd: ${s.command} ${(s.args || []).join(" ")}` : `sse: ${s.endpoint}`}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveMcp(s.id)}
                        style={{ color: "var(--color-error, #d93025)", fontSize: "11px" }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Templates Store MCP */}
            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--color-on-surface)" }}>
              Catálogo de Conectores MCP Pré-configurados
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {mcpTemplates.map((tpl) => {
                const installed = isMcpInstalled(tpl.id);
                return (
                  <div key={tpl.id} className="template-card" style={{ padding: "16px", borderRadius: "12px", background: "var(--color-surface-container-low, #f8f9fa)", border: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>{tpl.name}</h4>
                      <span className="badge badge-primary-subtle" style={{ fontSize: "10px" }}>Template</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px 0" }}>{tpl.description}</p>
                    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px", borderTop: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                      {installed ? (
                        <span style={{ fontSize: "11px", color: "var(--color-success, #1e8e3e)", fontWeight: 600 }}>Conectado</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveMcpFromTemplate(tpl)}
                          style={{ fontSize: "11px" }}
                        >
                          <span className="material-symbols-outlined icon-xs">download</span>
                          Instalar Conector
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Modal: Test Tool Playground ── */}
        {testingTool && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ width: "100%", maxWidth: "600px", background: "var(--color-surface, #fff)", borderRadius: "12px", border: "1px solid var(--color-outline-variant, #e2e8f0)", padding: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, fontFamily: "monospace", color: "var(--color-primary, #1a73e8)" }}>
                  Playground: {testingTool.name}
                </h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTestingTool(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>{testingTool.description}</p>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Argumentos de Entrada (JSON):</label>
                <textarea
                  rows={4}
                  value={toolArgsInput}
                  onChange={(e) => setToolArgsInput(e.target.value)}
                  style={{ width: "100%", fontSize: "12px", fontFamily: "monospace", padding: "8px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)", background: "var(--color-surface-container-low, #f8f9fa)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "14px" }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleExecuteToolTest} disabled={isExecutingTool}>
                  {isExecutingTool ? "Executando..." : "Executar Tool Agora"}
                </button>
              </div>

              {toolTestResult && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Resultado do Servidor:</label>
                  <pre style={{ fontSize: "11.5px", fontFamily: "monospace", padding: "10px", borderRadius: "6px", background: "var(--color-surface-container-lowest, #f1f5f9)", border: "1px solid var(--color-outline-variant, #cbd5e1)", maxHeight: "200px", overflowY: "auto", margin: 0 }}>
                    {JSON.stringify(toolTestResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modal: Add Custom MCP Server ── */}
        {isAddingMcp && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <form onSubmit={handleSaveCustomMcp} style={{ width: "100%", maxWidth: "520px", background: "var(--color-surface, #fff)", borderRadius: "12px", border: "1px solid var(--color-outline-variant, #e2e8f0)", padding: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Cadastrar Servidor MCP</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAddingMcp(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Nome do Servidor</label>
                  <input type="text" required placeholder="ex: Linear MCP" value={newMcpName} onChange={(e) => setNewMcpName(e.target.value)} style={{ width: "100%", fontSize: "12px", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Tipo de Conexão</label>
                  <select value={newMcpType} onChange={(e) => setNewMcpType(e.target.value as any)} style={{ width: "100%", fontSize: "12px", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }}>
                    <option value="stdio">stdio (Comando CLI)</option>
                    <option value="sse">sse (Endpoint HTTP/SSE)</option>
                  </select>
                </div>
                {newMcpType === "stdio" ? (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Comando de Execução</label>
                    <input type="text" placeholder="ex: npx -y @modelcontextprotocol/server-postgres" value={newMcpCommand} onChange={(e) => setNewMcpCommand(e.target.value)} style={{ width: "100%", fontSize: "12px", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }} />
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>URL do Endpoint SSE</label>
                    <input type="url" placeholder="ex: http://localhost:8000/sse" value={newMcpEndpoint} onChange={(e) => setNewMcpEndpoint(e.target.value)} style={{ width: "100%", fontSize: "12px", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "2px" }}>Descrição (opcional)</label>
                  <input type="text" placeholder="Propósito deste servidor MCP" value={newMcpDesc} onChange={(e) => setNewMcpDesc(e.target.value)} style={{ width: "100%", fontSize: "12px", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsAddingMcp(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm">Salvar no .mcp.json</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Drawer: Skill Detail View ── */}
        {selectedSkill && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={() => setSelectedSkill(null)}>
            <div style={{ width: "100%", maxWidth: "580px", height: "100%", background: "var(--color-surface, #ffffff)", color: "var(--color-on-surface, #202124)", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>{selectedSkill.title || selectedSkill.name}</h3>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>id: {selectedSkill.id} • v{selectedSkill.version}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedSkill(null)} style={{ padding: "4px" }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>Descrição</h4>
                <p style={{ fontSize: "13px", lineHeight: "1.5", margin: "0 0 16px 0" }}>{selectedSkill.description}</p>
                {selectedSkill.content && (
                  <div>
                    <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>Instruções do Agente (SKILL.md)</h4>
                    <pre style={{ fontSize: "11.5px", lineHeight: "1.45", fontFamily: "var(--font-mono, monospace)", padding: "12px", borderRadius: "8px", background: "var(--color-surface-container-low, #f8f9fa)", border: "1px solid var(--color-outline-variant, #e2e8f0)", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: "300px" }}>
                      {selectedSkill.content}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

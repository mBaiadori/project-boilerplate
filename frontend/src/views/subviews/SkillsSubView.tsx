// =============================================================================
// SUBVIEW: GERENCIADOR DE SKILLS DO AGENTE (PADRÃO ECC)
// Visualização e gestão completa de habilidades, ferramentas e regras para o Harness
// Totalmente integrado ao Design System e Tokens de Tema da aplicação
// =============================================================================

import React, { useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAI } from "../../context/AIContext";
import { API } from "../../services/api";
import type { SkillItem } from "../../types";

type Tab = "installed" | "hub";

const CATEGORY_CHIPS = [
  { id: "all", label: "Todas" },
  { id: "governance", label: "Governança" },
  { id: "architecture", label: "Arquitetura" },
  { id: "quality", label: "Qualidade" },
  { id: "engineering", label: "Engenharia" },
  { id: "memory", label: "Memória" },
];

export const SkillsSubView: React.FC = () => {
  const { activeRepo } = useWorkspace();
  const { activeSkillId, setActiveSkillId } = useAI();

  const [activeTab, setActiveTab] = useState<Tab>("installed");
  const [hubSkills, setHubSkills] = useState<SkillItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    loadSkills();
  }, [activeRepo]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const [hubRes, projRes] = await Promise.all([
        API.getSkillsHub(),
        API.getSkillsProject(activeRepo?.name),
      ]);

      if (hubRes.ok && hubRes.data) {
        setHubSkills(hubRes.data.skills || []);
      }
      if (projRes.ok && projRes.data) {
        const installed = projRes.data.installed_skills || [];
        setInstalledSkills(installed);
        if (installed.length === 0 && activeTab === "installed") {
          setActiveTab("hub");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar skills:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (skill: SkillItem) => {
    try {
      setActionFeedback({ ok: true, msg: `Instalando '${skill.title || skill.name}' no projeto...` });
      const res = await API.installSkill(skill.id, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: `Skill '${skill.title || skill.name}' instalada com sucesso!` });
        await loadSkills();
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        setActionFeedback({ ok: false, msg: (res.data as any)?.message || "Falha ao instalar skill." });
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  const handleUninstall = async (skillId: string) => {
    const ok = window.confirm("Deseja remover esta skill do projeto? (O catálogo global continuará disponível no Hub)");
    if (!ok) return;

    try {
      setActionFeedback({ ok: true, msg: "Desinstalando skill..." });
      const res = await API.uninstallSkill(skillId, activeRepo?.name);
      if (res.ok) {
        setActionFeedback({ ok: true, msg: "Skill desinstalada do projeto." });
        await loadSkills();
        if (selectedSkill?.id === skillId) {
          setSelectedSkill(null);
        }
        if (activeSkillId === skillId) {
          setActiveSkillId("living-docs-governance");
        }
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        setActionFeedback({ ok: false, msg: (res.data as any)?.message || "Falha ao desinstalar skill." });
      }
    } catch (err: any) {
      setActionFeedback({ ok: false, msg: err.message || "Erro de conexão." });
    }
  };

  const isInstalled = (id: string) => installedSkills.some((s) => s.id === id);

  const displayedList = activeTab === "installed" ? installedSkills : hubSkills;
  const filteredSkills = displayedList.filter((s) => {
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

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case "governance":
        return "verified_user";
      case "architecture":
        return "account_tree";
      case "quality":
        return "auto_awesome";
      case "engineering":
        return "terminal";
      case "memory":
        return "psychology";
      default:
        return "extension";
    }
  };

  return (
    <div
      id="subview-skills"
      className="dash-subview"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        background: "var(--color-surface)",
      }}
    >
      <div className="templates-view-wrapper" style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* ── 1. Page Header ── */}
        <div className="template-store-header" style={{ marginBottom: "20px" }}>
          <div className="templates-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "var(--color-on-surface, var(--text-main))" }}>
                  Central de Skills do Agente
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "var(--color-primary-container, rgba(99, 102, 241, 0.12))",
                    color: "var(--color-primary, #6366f1)",
                    border: "1px solid var(--color-outline-variant, rgba(99, 102, 241, 0.25))",
                  }}
                >
                  Padrão ECC
                </span>
              </div>
              <p className="subtitle" style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", marginBottom: 0 }}>
                Habilidades, ferramentas nativas e instruções autônomas ({activeRepo ? `projects/${activeRepo.name}` : "Workspace"}).
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                id="btn-refresh-skills"
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={loadSkills}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span className="material-symbols-outlined icon-xs">refresh</span>
                Sincronizar
              </button>
            </div>
          </div>

          {/* Feedback Alert */}
          {actionFeedback && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: actionFeedback.ok
                  ? "var(--color-primary-container, rgba(99, 102, 241, 0.12))"
                  : "var(--color-error-container, rgba(239, 68, 68, 0.12))",
                color: actionFeedback.ok
                  ? "var(--color-on-primary-container, #4338ca)"
                  : "var(--color-on-error-container, #b91c1c)",
                border: "1px solid var(--color-outline-variant, rgba(0,0,0,0.1))",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {actionFeedback.ok ? "check_circle" : "error"}
              </span>
              {actionFeedback.msg}
            </div>
          )}

          {/* ── 2. Tabs: Instaladas vs Catálogo Global ── */}
          <div className="template-store-tabs" role="tablist">
            <button
              className={`store-tab-btn ${activeTab === "installed" ? "active" : ""}`}
              id="tab-skills-installed"
              type="button"
              role="tab"
              aria-selected={activeTab === "installed"}
              onClick={() => setActiveTab("installed")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                check_circle
              </span>
              Instaladas no Projeto ({installedSkills.length})
            </button>

            <button
              className={`store-tab-btn ${activeTab === "hub" ? "active" : ""}`}
              id="tab-skills-hub"
              type="button"
              role="tab"
              aria-selected={activeTab === "hub"}
              onClick={() => setActiveTab("hub")}
            >
              <span className="material-symbols-outlined icon-xs" style={{ marginRight: "6px" }}>
                public
              </span>
              Catálogo Global ECC ({hubSkills.length})
            </button>
          </div>

          {/* ── 3. Filters & Search Bar ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            <div className="store-filter-bar" id="skills-category-filters">
              {CATEGORY_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  className={`store-filter-chip ${selectedCategory === chip.id ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedCategory(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div style={{ minWidth: "240px", flex: 1, maxWidth: "340px" }}>
              <div style={{ position: "relative" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "16px",
                    color: "var(--text-muted)",
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  id="skills-search-input"
                  placeholder="Buscar skills por título, tags ou ferramentas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    fontSize: "12px",
                    padding: "7px 12px 7px 32px",
                    width: "100%",
                    border: "1px solid var(--color-outline-variant, var(--border))",
                    borderRadius: "20px",
                    background: "var(--color-surface-container-low, var(--bg-surface))",
                    color: "var(--color-on-surface, var(--text-main))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Main Content: Skills Grid ── */}
        <div className="templates-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {loading ? (
            <div className="loading-state" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              Carregando catálogo de skills...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "48px 24px",
                background: "var(--color-surface-container-lowest, rgba(0,0,0,0.02))",
                borderRadius: "12px",
                border: "1px dashed var(--color-outline-variant, var(--border))",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "44px", color: "var(--text-muted)", opacity: 0.5, marginBottom: "8px", display: "block" }}
              >
                extension_off
              </span>
              <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)", margin: "0 0 6px 0" }}>
                {activeTab === "installed" ? "Nenhuma skill instalada neste projeto" : "Nenhuma skill encontrada"}
              </h4>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px auto" }}>
                {activeTab === "installed"
                  ? "Explore o Catálogo Global ECC para habilitar guardrails de governança, validação de termos e diagramação viva."
                  : "Tente mudar os termos de busca ou filtros de categoria."}
              </p>
              {activeTab === "installed" && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab("hub")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <span className="material-symbols-outlined icon-xs">explore</span>
                  Explorar Catálogo Global ECC
                </button>
              )}
            </div>
          ) : (
            filteredSkills.map((skill) => {
              const installed = isInstalled(skill.id);
              const isActiveInCopilot = activeSkillId === skill.id;

              return (
                <div
                  key={skill.id}
                  className="template-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--color-surface-container-low, var(--bg-surface))",
                    border: isActiveInCopilot
                      ? "1px solid var(--color-primary, #6366f1)"
                      : "1px solid var(--color-outline-variant, var(--border))",
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: isActiveInCopilot
                      ? "0 0 0 1px var(--color-primary, #6366f1), 0 2px 8px rgba(99, 102, 241, 0.15)"
                      : "none",
                    position: "relative",
                  }}
                >
                  {/* Top Badges */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "18px",
                          color: "var(--color-primary, #6366f1)",
                        }}
                      >
                        {getCategoryIcon(skill.category)}
                      </span>
                      <span
                        className="badge badge-primary-subtle"
                        style={{ fontSize: "10.5px", textTransform: "capitalize" }}
                      >
                        {skill.category || "Geral"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {installed && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                          }}
                        >
                          Instalada
                        </span>
                      )}
                      <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        v{skill.version}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--color-on-surface, var(--text-main))",
                      margin: "0 0 6px 0",
                    }}
                  >
                    {skill.title || skill.name}
                  </h3>

                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      lineHeight: "1.4",
                      flex: 1,
                      margin: "0 0 12px 0",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {skill.description}
                  </p>

                  {/* Tools list */}
                  {skill.tools && skill.tools.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                          build
                        </span>
                        Ferramentas Nativas:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {skill.tools.slice(0, 3).map((tool) => (
                          <span
                            key={tool}
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "var(--color-surface-container-highest, rgba(0,0,0,0.05))",
                              color: "var(--color-on-surface-variant, var(--text-main))",
                              border: "1px solid var(--color-outline-variant, var(--border))",
                            }}
                          >
                            {tool}
                          </span>
                        ))}
                        {skill.tools.length > 3 && (
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", alignSelf: "center" }}>
                            +{skill.tools.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Actions Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--color-outline-variant, var(--border))",
                      gap: "6px",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedSkill(skill)}
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      title="Ver detalhes e instruções da skill"
                    >
                      <span className="material-symbols-outlined icon-xs">visibility</span>
                      Detalhes
                    </button>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {installed ? (
                        <>
                          <button
                            type="button"
                            className={`btn btn-sm ${isActiveInCopilot ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => {
                              setActiveSkillId(skill.id);
                              setActionFeedback({ ok: true, msg: `Skill '${skill.title || skill.name}' ativada no Copilot!` });
                              setTimeout(() => setActionFeedback(null), 3000);
                            }}
                            style={{ fontSize: "11px", padding: "4px 10px" }}
                            title="Ativar esta skill no chat do Copilot"
                          >
                            <span className="material-symbols-outlined icon-xs">
                              {isActiveInCopilot ? "check" : "play_arrow"}
                            </span>
                            {isActiveInCopilot ? "Ativa no Copilot" : "Usar no Chat"}
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleUninstall(skill.id)}
                            style={{
                              fontSize: "11px",
                              padding: "4px 6px",
                              color: "var(--color-error, #ef4444)",
                            }}
                            title="Desinstalar do projeto"
                          >
                            <span className="material-symbols-outlined icon-xs">delete</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleInstall(skill)}
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
            })
          )}
        </div>

        {/* ── 5. Skill Detail Drawer / Modal (Fully Themed) ── */}
        {selectedSkill && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
              display: "flex",
              justifyContent: "flex-end",
            }}
            onClick={() => setSelectedSkill(null)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "580px",
                height: "100%",
                background: "var(--color-surface, #ffffff)",
                color: "var(--color-on-surface, var(--text-main))",
                boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--color-outline-variant, var(--border))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--color-surface-container-low, var(--bg-surface))",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--color-primary, #6366f1)" }}>
                    {getCategoryIcon(selectedSkill.category)}
                  </span>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                      {selectedSkill.title || selectedSkill.name}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      id: {selectedSkill.id} • v{selectedSkill.version}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedSkill(null)}
                  style={{ padding: "4px" }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {/* Description */}
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>
                    Descrição
                  </h4>
                  <p style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--text-main)", margin: 0 }}>
                    {selectedSkill.description}
                  </p>
                </div>

                {/* Tools */}
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      build
                    </span>
                    Ferramentas Autônomas Vinculadas
                  </h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {selectedSkill.tools && selectedSkill.tools.length > 0 ? (
                      selectedSkill.tools.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: "11px",
                            fontFamily: "monospace",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "var(--color-surface-container-highest, rgba(0,0,0,0.05))",
                            color: "var(--color-primary, #6366f1)",
                            border: "1px solid var(--color-outline-variant, var(--border))",
                          }}
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nenhuma ferramenta especial necessária.</span>
                    )}
                  </div>
                </div>

                {/* Templates Recomendados */}
                {selectedSkill.suggested_templates && selectedSkill.suggested_templates.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        auto_stories
                      </span>
                      Templates Recomendados
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {selectedSkill.suggested_templates.map((tpl) => (
                        <span
                          key={tpl}
                          style={{
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#10b981",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                          }}
                        >
                          {tpl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions / SKILL.md */}
                {selectedSkill.content && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px" }}>
                      Instruções do Agente (SKILL.md)
                    </h4>
                    <pre
                      style={{
                        fontSize: "11.5px",
                        lineHeight: "1.45",
                        fontFamily: "var(--font-mono, monospace)",
                        padding: "14px",
                        borderRadius: "8px",
                        background: "var(--color-surface-container-lowest, rgba(0,0,0,0.03))",
                        border: "1px solid var(--color-outline-variant, var(--border))",
                        color: "var(--color-on-surface, var(--text-main))",
                        whiteSpace: "pre-wrap",
                        overflowX: "auto",
                        maxHeight: "260px",
                      }}
                    >
                      {selectedSkill.content}
                    </pre>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--color-outline-variant, var(--border))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--color-surface-container-low, var(--bg-surface))",
                }}
              >
                {isInstalled(selectedSkill.id) ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleUninstall(selectedSkill.id)}
                      style={{ color: "var(--color-error, #ef4444)" }}
                    >
                      <span className="material-symbols-outlined icon-xs">delete</span>
                      Desinstalar do Projeto
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setActiveSkillId(selectedSkill.id);
                        setSelectedSkill(null);
                        setActionFeedback({ ok: true, msg: `Skill '${selectedSkill.title || selectedSkill.name}' ativada!` });
                      }}
                    >
                      <span className="material-symbols-outlined icon-xs">play_arrow</span>
                      Ativar no Copilot Agora
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Origem: Catálogo Global ECC</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        handleInstall(selectedSkill);
                        setSelectedSkill(null);
                      }}
                    >
                      <span className="material-symbols-outlined icon-xs">download</span>
                      Instalar no Projeto
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

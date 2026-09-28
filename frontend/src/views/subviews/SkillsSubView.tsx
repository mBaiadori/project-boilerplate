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
import {
  Button,
  Badge,
  Tabs,
  SearchInput,
  AlertBanner,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Modal,
  EmptyState,
  Spinner,
  FilterChips,
} from "../../components/ui";
import {
  Sparkles,
  ShieldCheck,
  Layers,
  Terminal,
  Brain,
  Download,
  Trash2,
  Play,
  RefreshCw,
  FileCode2,
  Wrench,
  BookOpen,
  Folder,
  Settings,
  Globe,
  CheckCircle2,
  Eye,
} from "lucide-react";

export type ScopeFilter = "installed" | "system" | "community";

const CATEGORY_CHIPS = [
  { id: "all", label: "Todas as Categorias" },
  { id: "governance", label: "Governança" },
  { id: "architecture", label: "Arquitetura" },
  { id: "quality", label: "Qualidade" },
  { id: "engineering", label: "Engenharia" },
  { id: "memory", label: "Memória" },
];

export const SkillsSubView: React.FC = () => {
  const { activeRepo } = useWorkspace();
  const { activeSkillId, setActiveSkillId } = useAI();

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("installed");
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

  const systemSkills = hubSkills.filter((s) => s.source === "system");
  const communitySkills = hubSkills.filter(
    (s) => s.source === "community" || (!s.source && s.source !== "system"),
  );

  const displayedList =
    scopeFilter === "installed"
      ? installedSkills
      : scopeFilter === "system"
        ? systemSkills
        : communitySkills;

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

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case "governance":
        return <ShieldCheck size={16} style={{ color: "var(--color-success)" }} />;
      case "architecture":
        return <FileCode2 size={16} style={{ color: "var(--color-primary)" }} />;
      case "quality":
        return <Sparkles size={16} style={{ color: "var(--color-warning)" }} />;
      case "engineering":
        return <Terminal size={16} style={{ color: "#a855f7" }} />;
      case "memory":
        return <Brain size={16} style={{ color: "#ec4899" }} />;
      default:
        return <Layers size={16} style={{ color: "var(--color-outline)" }} />;
    }
  };

  const tabList = [
    { id: "installed", label: "Instaladas no Projeto", badge: installedSkills.length, icon: <Folder size={14} /> },
    { id: "system", label: "Sistema (Oficiais)", badge: systemSkills.length, icon: <Settings size={14} /> },
    { id: "community", label: "Comunidade", badge: communitySkills.length, icon: <Globe size={14} /> },
  ];

  return (
    <div id="subview-skills" style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--color-on-surface)", letterSpacing: "-0.02em" }}>
              Harness & Skills do Agente
            </h1>
            <Badge variant="purple" size="md">
              Padrão ECC
            </Badge>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "13.5px", color: "var(--color-on-surface-variant)" }}>
            Habilidades operacionais, guardrails de governança e ferramentas injetadas no contexto do Copilot e agentes autônomos.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            id="btn-refresh-skills"
            variant="secondary"
            size="md"
            onClick={loadSkills}
            icon={<RefreshCw size={15} />}
          >
            Atualizar Catálogo
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div style={{ marginBottom: "16px" }}>
          <AlertBanner
            variant={actionFeedback.ok ? "success" : "error"}
            title={actionFeedback.msg}
            onClose={() => setActionFeedback(null)}
          />
        </div>
      )}

      {/* Controls: Tabs & Search */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <Tabs
            tabs={tabList}
            activeTab={scopeFilter}
            onChange={(tab) => setScopeFilter(tab as any)}
            variant="pills"
          />

          <div style={{ width: "320px" }}>
            <SearchInput
              id="skills-search-input"
              placeholder="Buscar skills por título, tags ou ferramentas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
            />
          </div>
        </div>

        {/* Categories Chips */}
        <FilterChips
          items={CATEGORY_CHIPS}
          activeId={selectedCategory}
          onChange={(cat) => setSelectedCategory(cat)}
          size="sm"
        />
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div style={{ padding: "60px 0", display: "flex", justifyContent: "center" }}>
          <Spinner size="lg" message="Carregando catálogo de skills..." />
        </div>
      ) : filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title={
            scopeFilter === "installed"
              ? "Nenhuma skill instalada neste projeto"
              : "Nenhuma skill encontrada"
          }
          description={
            scopeFilter === "installed"
              ? "Explore as abas 'Sistema' ou 'Comunidade' para habilitar guardrails de governança, validação de termos e diagramação viva."
              : "Tente mudar os termos de busca ou o filtro de categoria acima."
          }
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredSkills.map((skill) => {
            const installed = isInstalled(skill.id);
            const isActiveInCopilot = activeSkillId === skill.id;
            const isSystem = skill.source === "system";
            const isProject = skill.source === "project";

            return (
              <Card
                key={skill.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  border: isActiveInCopilot
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-outline-variant)",
                }}
              >
                <CardHeader
                  title={skill.title || skill.name}
                  subtitle={`v${skill.version} • ${skill.id}`}
                  action={
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <Badge variant="primary" size="sm">
                        {skill.category || "Geral"}
                      </Badge>
                      {isSystem ? (
                        <Badge variant="info" size="sm">Sistema</Badge>
                      ) : isProject ? (
                        <Badge variant="success" size="sm">Projeto</Badge>
                      ) : (
                        <Badge variant="purple" size="sm">Comunidade</Badge>
                      )}
                      {installed && (
                        <Badge variant="success" size="sm" dot>Ativa</Badge>
                      )}
                    </div>
                  }
                />

                <CardContent style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "var(--color-on-surface-variant)", lineHeight: 1.5, flex: 1 }}>
                    {skill.description}
                  </p>

                  {/* Tools */}
                  {skill.tools && skill.tools.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {skill.tools.slice(0, 3).map((tool) => (
                        <span
                          key={tool}
                          style={{
                            fontSize: "10.5px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "var(--color-surface-container-high)",
                            color: "var(--color-on-surface-variant)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            border: "1px solid var(--color-outline-variant)",
                          }}
                        >
                          <Wrench size={10} style={{ color: "var(--color-primary)" }} />
                          {tool}
                        </span>
                      ))}
                      {skill.tools.length > 3 && (
                        <span style={{ fontSize: "10px", color: "var(--color-outline)" }}>
                          +{skill.tools.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter style={{ borderTop: "1px solid var(--color-outline-variant)", display: "flex", gap: "8px", alignItems: "center" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedSkill(skill)}
                    icon={<Eye size={14} />}
                  >
                    Detalhes
                  </Button>

                  {installed ? (
                    <Button
                      variant={isActiveInCopilot ? "primary" : "secondary"}
                      size="sm"
                      fullWidth
                      onClick={() => {
                        setActiveSkillId(skill.id);
                        setActionFeedback({ ok: true, msg: `Skill '${skill.title || skill.name}' ativada no Copilot!` });
                        setTimeout(() => setActionFeedback(null), 3000);
                      }}
                      icon={isActiveInCopilot ? <CheckCircle2 size={14} /> : <Play size={14} />}
                    >
                      {isActiveInCopilot ? "Ativa no Copilot" : "Ativar no Copilot"}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => handleInstall(skill)}
                      icon={<Download size={14} />}
                    >
                      Instalar no Projeto
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Detalhes da Skill */}
      {selectedSkill && (
        <Modal
          isOpen={!!selectedSkill}
          onClose={() => setSelectedSkill(null)}
          title={selectedSkill.title || selectedSkill.name}
          subtitle={`id: ${selectedSkill.id} • v${selectedSkill.version} • categoria: ${selectedSkill.category}`}
          icon={getCategoryIcon(selectedSkill.category)}
          size="lg"
          footer={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              {isInstalled(selectedSkill.id) ? (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleUninstall(selectedSkill.id)}
                    icon={<Trash2 size={14} />}
                  >
                    Desinstalar do Projeto
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setActiveSkillId(selectedSkill.id);
                      setSelectedSkill(null);
                      setActionFeedback({ ok: true, msg: `Skill '${selectedSkill.title || selectedSkill.name}' ativada!` });
                      setTimeout(() => setActionFeedback(null), 3000);
                    }}
                    icon={<Play size={14} />}
                  >
                    Ativar no Copilot Agora
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedSkill(null)}>
                    Fechar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleInstall(selectedSkill);
                      setSelectedSkill(null);
                    }}
                    icon={<Download size={14} />}
                  >
                    Instalar no Projeto
                  </Button>
                </>
              )}
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Description */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-outline)", marginBottom: "4px" }}>
                Descrição
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-on-surface)", lineHeight: 1.5 }}>
                {selectedSkill.description}
              </p>
            </div>

            {/* Tools */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-outline)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Wrench size={13} style={{ color: "var(--color-primary)" }} />
                Ferramentas Autônomas Vinculadas
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedSkill.tools && selectedSkill.tools.length > 0 ? (
                  selectedSkill.tools.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: "11.5px",
                        fontFamily: "var(--font-mono, monospace)",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: "var(--color-surface-container-high)",
                        color: "var(--color-primary)",
                        border: "1px solid var(--color-outline-variant)",
                      }}
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--color-outline)" }}>Nenhuma ferramenta especial necessária.</span>
                )}
              </div>
            </div>

            {/* Suggested Templates */}
            {selectedSkill.suggested_templates && selectedSkill.suggested_templates.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-outline)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <BookOpen size={13} style={{ color: "var(--color-success)" }} />
                  Templates Recomendados
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {selectedSkill.suggested_templates.map((tpl) => (
                    <Badge key={tpl} variant="success" size="sm">
                      {tpl}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions / SKILL.md */}
            {selectedSkill.content && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-outline)", marginBottom: "6px" }}>
                  Instruções do Agente (SKILL.md)
                </div>
                <pre
                  style={{
                    fontSize: "11.5px",
                    lineHeight: "1.45",
                    fontFamily: "var(--font-mono, monospace)",
                    padding: "12px",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "var(--color-surface-container-lowest)",
                    border: "1px solid var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    maxHeight: "240px",
                    margin: 0,
                  }}
                >
                  {selectedSkill.content}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

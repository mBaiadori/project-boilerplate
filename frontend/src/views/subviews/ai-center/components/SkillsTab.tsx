import React from "react";
import { FilterChips, SearchInput } from "../../../../components/ui";
import { CATEGORY_CHIPS, type ScopeFilter } from "../types";
import { renderOriginBadge } from "../utils/renderOriginBadge";
import type { SkillItem } from "../../../../types";

interface SkillsTabProps {
  skillScope: ScopeFilter;
  setSkillScope: (val: ScopeFilter) => void;
  installedSkillsCount: number;
  systemSkillsCount: number;
  communitySkillsCount: number;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  filteredSkills: SkillItem[];
  isSkillInstalled: (id: string) => boolean;
  activeSkillId: string | null;
  setActiveSkillId: (id: string | null) => void;
  setSelectedSkill: (skill: SkillItem | null) => void;
  handleInstallSkill: (skill: SkillItem) => Promise<void>;
  handleUninstallSkill: (id: string) => Promise<void>;
  setActionFeedback: (val: { ok: boolean; msg: string } | null) => void;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({
  skillScope,
  setSkillScope,
  installedSkillsCount,
  systemSkillsCount,
  communitySkillsCount,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  filteredSkills,
  isSkillInstalled,
  activeSkillId,
  setActiveSkillId,
  setSelectedSkill,
  handleInstallSkill,
  handleUninstallSkill,
  setActionFeedback,
}) => {
  return (
    <div>
      {/* Sub-tabs: Instaladas vs Hub & Search */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <FilterChips
            items={[
              { id: "installed", label: "Instaladas", count: installedSkillsCount },
              { id: "system", label: "Sistema", count: systemSkillsCount },
              { id: "community", label: "Comunidade", count: communitySkillsCount },
            ]}
            activeId={skillScope}
            onChange={(s) => setSkillScope(s as ScopeFilter)}
            size="sm"
          />

          <div style={{ width: "220px" }}>
            <SearchInput
              placeholder="Filtrar skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
            />
          </div>
        </div>

        {/* Category chips */}
        <FilterChips
          items={CATEGORY_CHIPS}
          activeId={selectedCategory}
          onChange={(c) => setSelectedCategory(c)}
          size="sm"
        />
      </div>

      {/* Skills Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredSkills.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "48px 24px",
              background: "var(--color-surface-container-low, #f8f9fa)",
              borderRadius: "12px",
              border: "1px dashed var(--color-outline-variant, #e2e8f0)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "40px",
                color: "var(--text-muted)",
                opacity: 0.6,
                marginBottom: "8px",
                display: "block",
              }}
            >
              extension_off
            </span>
            <h4
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-on-surface)",
                margin: "0 0 6px 0",
              }}
            >
              {skillScope === "installed"
                ? "Nenhuma skill instalada no projeto"
                : skillScope === "system"
                  ? "Nenhuma skill do sistema encontrada"
                  : "Nenhuma skill da comunidade encontrada"}
            </h4>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            >
              {skillScope === "installed"
                ? "Selecione as abas 'Sistema' ou 'Comunidade' para instalar novas capacidades neste projeto."
                : "Tente ajustar o termo de busca ou o filtro de categoria acima."}
            </p>
          </div>
        ) : (
          filteredSkills.map((skill) => {
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="badge badge-primary-subtle"
                      style={{
                        fontSize: "10.5px",
                        textTransform: "capitalize",
                      }}
                    >
                      {skill.category}
                    </span>
                    {renderOriginBadge(skill.source)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {installed && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.12)",
                          color: "#10b981",
                        }}
                      >
                        Instalada
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                      }}
                    >
                      v{skill.version}
                    </span>
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: "0 0 6px 0",
                    color: "var(--color-on-surface)",
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
                    margin: "0 0 8px 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {skill.description}
                </p>

                {skill.source !== "system" && skill.source !== "project" && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      marginBottom: "10px",
                      opacity: 0.8,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "12px" }}
                    >
                      info
                    </span>
                    <span>Licença MIT • Catálogo da Comunidade</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    marginBottom: "12px",
                  }}
                >
                  {skill.tools?.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: "10px",
                        fontFamily: "monospace",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "var(--color-surface-container, #f1f3f4)",
                        color: "var(--color-on-surface)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--color-outline-variant, #e2e8f0)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedSkill(skill)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <span className="material-symbols-outlined icon-xs">
                      visibility
                    </span>
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
                            setActionFeedback({
                              ok: true,
                              msg: `Skill '${skill.title || skill.name}' ativa no Copilot!`,
                            });
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
                          style={{
                            color: "var(--color-error, #d93025)",
                            padding: "4px 6px",
                          }}
                          title="Desinstalar"
                        >
                          <span className="material-symbols-outlined icon-xs">
                            delete
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleInstallSkill(skill)}
                        style={{ fontSize: "11px", padding: "4px 10px" }}
                      >
                        <span className="material-symbols-outlined icon-xs">
                          download
                        </span>
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
    </div>
  );
};

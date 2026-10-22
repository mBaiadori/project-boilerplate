import React from "react";
import { FilterChips } from "../../../../components/ui";
import { type ScopeFilter } from "../types";
import { renderOriginBadge } from "../utils/renderOriginBadge";
import type { AgentDefinition } from "../../../../types";

interface AgentsTabProps {
  agentScope: ScopeFilter;
  setAgentScope: (val: ScopeFilter) => void;
  installedAgentsCount: number;
  systemAgentsCount: number;
  communityAgentsCount: number;
  displayedAgents: AgentDefinition[];
  isAgentInstalled: (id: string) => boolean;
  setSelectedAgent: (agent: AgentDefinition | null) => void;
  handleInstallAgent: (agent: AgentDefinition) => Promise<void>;
  handleUninstallAgent: (agentId: string) => Promise<void>;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({
  agentScope,
  setAgentScope,
  installedAgentsCount,
  systemAgentsCount,
  communityAgentsCount,
  displayedAgents,
  isAgentInstalled,
  setSelectedAgent,
  handleInstallAgent,
  handleUninstallAgent,
}) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <FilterChips
          items={[
            { id: "installed", label: "Instaladas", count: installedAgentsCount },
            { id: "system", label: "Sistema", count: systemAgentsCount },
            { id: "community", label: "Comunidade", count: communityAgentsCount },
          ]}
          activeId={agentScope}
          onChange={(s) => setAgentScope(s as ScopeFilter)}
          size="sm"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {displayedAgents.length === 0 ? (
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
              psychology_alt
            </span>
            <h4
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-on-surface)",
                margin: "0 0 6px 0",
              }}
            >
              {agentScope === "installed"
                ? "Nenhuma persona instalada no projeto"
                : agentScope === "system"
                  ? "Nenhuma persona do sistema encontrada"
                  : "Nenhuma persona da comunidade encontrada"}
            </h4>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            >
              {agentScope === "installed"
                ? "Selecione as abas 'Sistema' ou 'Comunidade' para instalar novas personas no projeto."
                : "Explore outros filtros para encontrar novas personas."}
            </p>
          </div>
        ) : (
          displayedAgents.map((agent) => {
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "24px",
                        color: "var(--color-primary, #1a73e8)",
                        background:
                          "var(--color-primary-container, #d2e3fc)",
                        padding: "8px",
                        borderRadius: "8px",
                      }}
                    >
                      {agent.icon || "psychology"}
                    </span>
                    <div>
                      <h3
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          margin: 0,
                          color: "var(--color-on-surface)",
                        }}
                      >
                        {agent.title}
                      </h3>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {agent.role}
                      </span>
                    </div>
                  </div>
                  {renderOriginBadge(agent.source)}
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    lineHeight: "1.4",
                    flex: 1,
                    margin: "0 0 8px 0",
                  }}
                >
                  {agent.description}
                </p>

                {agent.source !== "system" && agent.source !== "project" && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      marginBottom: "8px",
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

                <div style={{ marginBottom: "10px" }}>
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  >
                    Skills Integradas:
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      marginTop: "4px",
                    }}
                  >
                    {agent.skills.map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(26, 115, 232, 0.1)",
                          color: "var(--color-primary, #1a73e8)",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
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
                      style={{
                        color: "var(--color-error, #d93025)",
                        fontSize: "11px",
                      }}
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
                      <span className="material-symbols-outlined icon-xs">
                        download
                      </span>
                      Instalar Persona
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

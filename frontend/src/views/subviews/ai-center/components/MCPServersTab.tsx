import React from "react";
import type { MCPServerDefinition } from "../../../../types";

interface MCPServersTabProps {
  setIsAddingMcp: (val: boolean) => void;
  projectMcpServers: MCPServerDefinition[];
  mcpTemplates: MCPServerDefinition[];
  isMcpInstalled: (id: string) => boolean;
  handleRemoveMcp: (id: string) => Promise<void>;
  handleSaveMcpFromTemplate: (tpl: MCPServerDefinition) => Promise<void>;
}

export const MCPServersTab: React.FC<MCPServersTabProps> = ({
  setIsAddingMcp,
  projectMcpServers,
  mcpTemplates,
  isMcpInstalled,
  handleRemoveMcp,
  handleSaveMcpFromTemplate,
}) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Conecte servidores externos usando o padrão MCP (GitHub,
          PostgreSQL, Fetch Web, SQLite).
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setIsAddingMcp(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span className="material-symbols-outlined icon-xs">add</span>
          Novo Servidor MCP
        </button>
      </div>

      {/* Configured MCP Servers */}
      <h4
        style={{
          fontSize: "14px",
          fontWeight: 700,
          margin: "0 0 12px 0",
          color: "var(--color-on-surface)",
        }}
      >
        Servidores MCP Ativos no Projeto ({projectMcpServers.length})
      </h4>

      {projectMcpServers.length === 0 ? (
        <div
          style={{
            padding: "24px",
            background: "var(--color-surface-container-low, #f8f9fa)",
            borderRadius: "10px",
            border: "1px dashed var(--color-outline-variant, #e2e8f0)",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "32px",
              color: "var(--text-muted)",
              opacity: 0.5,
            }}
          >
            cable
          </span>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              margin: "6px 0 0 0",
            }}
          >
            Nenhum servidor MCP configurado no `.mcp.json`. Adicione um
            template abaixo ou cadastre um customizado.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          {projectMcpServers.map((s) => (
            <div
              key={s.id}
              className="template-card"
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "var(--color-surface-container-low, #f8f9fa)",
                border: "1px solid var(--color-outline-variant, #e2e8f0)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <h4 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {s.name}
                </h4>
                <span
                  className="badge badge-success-subtle"
                  style={{ fontSize: "10px" }}
                >
                  Ativo
                </span>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  margin: "0 0 8px 0",
                }}
              >
                {s.description}
              </p>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                  background: "var(--color-surface, #fff)",
                  padding: "6px",
                  borderRadius: "6px",
                  marginBottom: "10px",
                }}
              >
                {s.type === "stdio"
                  ? `cmd: ${s.command} ${(s.args || []).join(" ")}`
                  : `sse: ${s.endpoint}`}
              </div>
              <div
                style={{ display: "flex", justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemoveMcp(s.id)}
                  style={{
                    color: "var(--color-error, #d93025)",
                    fontSize: "11px",
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Store MCP */}
      <h4
        style={{
          fontSize: "14px",
          fontWeight: 700,
          margin: "0 0 12px 0",
          color: "var(--color-on-surface)",
        }}
      >
        Catálogo de Conectores MCP Pré-configurados
      </h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {mcpTemplates.map((tpl) => {
          const installed = isMcpInstalled(tpl.id);
          return (
            <div
              key={tpl.id}
              className="template-card"
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "var(--color-surface-container-low, #f8f9fa)",
                border: "1px solid var(--color-outline-variant, #e2e8f0)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <h4 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {tpl.name}
                </h4>
                <span
                  className="badge badge-primary-subtle"
                  style={{ fontSize: "10px" }}
                >
                  Template
                </span>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  margin: "0 0 8px 0",
                }}
              >
                {tpl.description}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--color-outline-variant, #e2e8f0)",
                }}
              >
                {installed ? (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--color-success, #1e8e3e)",
                      fontWeight: 600,
                    }}
                  >
                    Conectado
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSaveMcpFromTemplate(tpl)}
                    style={{ fontSize: "11px" }}
                  >
                    <span className="material-symbols-outlined icon-xs">
                      download
                    </span>
                    Instalar Conector
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

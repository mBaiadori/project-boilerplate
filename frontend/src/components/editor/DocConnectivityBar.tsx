import React, { useState, useEffect } from "react";
import { API } from "../../services/api";

interface DocConnectivityBarProps {
  filePath: string;
  onNavigateFile: (path: string) => void;
}

export const DocConnectivityBar: React.FC<DocConnectivityBarProps> = ({
  filePath,
  onNavigateFile,
}) => {
  const [contextData, setContextData] = useState<any>(null);
  const [showConsumers, setShowConsumers] = useState(false);
  const [showDeps, setShowDeps] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadContext();
    }
  }, [filePath]);

  const loadContext = async () => {
    try {
      const data = await API.getDocumentContext(filePath);
      setContextData(data);
    } catch (err) {
      console.warn("[DocConnectivityBar] Erro ao carregar contexto:", err);
    }
  };

  const segments = filePath.split("/").filter(Boolean);
  const consumers = contextData?.consumers || [];
  const dependencies = contextData?.dependencies || [];
  const layer = contextData?.layer || "";
  const status = contextData?.status || "s";

  return (
    <div
      className="doc-connectivity-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 16px",
        background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        fontSize: "12px",
        position: "relative",
      }}
    >
      {/* Left: Layer + Status + Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          className="badge badge-primary-subtle"
          style={{ fontSize: "10px" }}
        >
          {layer}
        </span>
        <span
          className="badge badge-success-subtle"
          style={{ fontSize: "10px" }}
        >
          {status.toUpperCase()}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--color-outline)",
          }}
        >
          {segments.map((seg, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              <span
                style={{
                  fontWeight: idx === segments.length - 1 ? 600 : 400,
                  color:
                    idx === segments.length - 1
                      ? "var(--color-on-surface)"
                      : "var(--color-outline)",
                }}
              >
                {seg}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Backlinks, Dependencies & Lifecycle */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Consumers (Backlinks) */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowConsumers(!showConsumers)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
            }}
          >
            <span className="material-symbols-outlined icon-xs">
              call_received
            </span>
            Consumidores ({consumers.length})
          </button>

          {showConsumers && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "var(--color-surface)",
                border: "1px solid var(--color-outline-variant)",
                borderRadius: "6px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                padding: "8px",
                minWidth: "220px",
                zIndex: 50,
              }}
            >
              <strong
                style={{
                  fontSize: "11px",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Documentos Dependentes:
              </strong>
              {consumers.length === 0 ? (
                <span
                  style={{ fontSize: "11px", color: "var(--color-outline)" }}
                >
                  Nenhum documento depende deste.
                </span>
              ) : (
                consumers.map((c: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => {
                      onNavigateFile(c.path || c);
                      setShowConsumers(false);
                    }}
                    style={{
                      padding: "4px 6px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                    className="dropdown-item-hover"
                  >
                    {c.title || c.path || c}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dependencies */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowDeps(!showDeps)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
            }}
          >
            <span className="material-symbols-outlined icon-xs">call_made</span>
            Dependências ({dependencies.length})
          </button>

          {showDeps && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "var(--color-surface)",
                border: "1px solid var(--color-outline-variant)",
                borderRadius: "6px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                padding: "8px",
                minWidth: "220px",
                zIndex: 50,
              }}
            >
              <strong
                style={{
                  fontSize: "11px",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Contratos Requeridos:
              </strong>
              {dependencies.length === 0 ? (
                <span
                  style={{ fontSize: "11px", color: "var(--color-outline)" }}
                >
                  Nenhuma dependência direta.
                </span>
              ) : (
                dependencies.map((d: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => {
                      onNavigateFile(d.path || d);
                      setShowDeps(false);
                    }}
                    style={{
                      padding: "4px 6px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                    className="dropdown-item-hover"
                  >
                    {d.title || d.path || d}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

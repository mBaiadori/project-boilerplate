import React, { useState, useEffect, useRef } from "react";
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
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filePath) {
      loadContext();
    }
  }, [filePath]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowConsumers(false);
        setShowDeps(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const loadContext = async () => {
    try {
      const data = await API.getDocumentContext(filePath);
      setContextData(data);
    } catch (err) {
      console.warn("[DocConnectivityBar] Erro ao carregar contexto:", err);
    }
  };

  const cleanPath = filePath.split('#')[0];
  const segments = cleanPath.split("/").filter(Boolean);
  const consumers = contextData?.consumers || [];
  const dependencies = contextData?.dependencies || [];
  const layer = contextData?.layer || "";
  const status = contextData?.status || "draft";

  return (
    <div
      ref={barRef}
      className="doc-connectivity-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 16px",
        background: "var(--color-surface-container-lowest, #ffffff)",
        borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
        fontSize: "12px",
        position: "relative",
      }}
    >
      {/* Left: Layer + Status + Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {layer && (
          <span
            className="badge badge-primary-subtle"
            style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
          >
            {layer}
          </span>
        )}
        <span
          className={`badge ${status === 'approved' ? 'badge-success-subtle' : 'badge-neutral-subtle'}`}
          style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}
        >
          {status.toUpperCase()}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--color-outline, #64748b)",
          }}
        >
          {segments.map((seg, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ opacity: 0.5 }}>/</span>}
              <span
                style={{
                  fontWeight: idx === segments.length - 1 ? 600 : 400,
                  color:
                    idx === segments.length - 1
                      ? "var(--color-on-surface, #0f172a)"
                      : "var(--color-outline, #64748b)",
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
            onClick={() => {
              setShowConsumers(!showConsumers);
              setShowDeps(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              background: showConsumers ? "var(--color-surface-container, #f1f5f9)" : "transparent",
            }}
          >
            <span className="material-symbols-outlined icon-xs" style={{ color: "#2563eb" }}>
              call_received
            </span>
            <span>Consumidores</span>
            <span style={{ 
              fontWeight: 700, 
              background: consumers.length > 0 ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.06)",
              color: consumers.length > 0 ? "#2563eb" : "inherit",
              padding: "1px 5px",
              borderRadius: "10px",
              fontSize: "10px"
            }}>
              {consumers.length}
            </span>
          </button>

          {showConsumers && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                padding: "8px",
                minWidth: "260px",
                maxWidth: "320px",
                zIndex: 100,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                <strong style={{ fontSize: "11px", color: "var(--color-on-surface, #0f172a)" }}>
                  Documentos Dependentes (Backlinks):
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{consumers.length}</span>
              </div>
              {consumers.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--color-outline, #64748b)", padding: "8px 4px", textAlign: "center" }}>
                  Nenhum outro documento aponta para este.
                </div>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {consumers.map((c: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        onNavigateFile(c.path || c);
                        setShowConsumers(false);
                      }}
                      style={{
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontSize: "11.5px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.15s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                        <span className="material-symbols-outlined icon-xs" style={{ color: "#64748b" }}>
                          description
                        </span>
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.title || c.path || c}
                        </span>
                      </div>
                      {c.layer && (
                        <span style={{ fontSize: "9.5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.06)", color: "#64748b", flexShrink: 0 }}>
                          {c.layer}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dependencies */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setShowDeps(!showDeps);
              setShowConsumers(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              background: showDeps ? "var(--color-surface-container, #f1f5f9)" : "transparent",
            }}
          >
            <span className="material-symbols-outlined icon-xs" style={{ color: "#16a34a" }}>
              call_made
            </span>
            <span>Dependências</span>
            <span style={{ 
              fontWeight: 700, 
              background: dependencies.length > 0 ? "rgba(22,163,74,0.12)" : "rgba(0,0,0,0.06)",
              color: dependencies.length > 0 ? "#16a34a" : "inherit",
              padding: "1px 5px",
              borderRadius: "10px",
              fontSize: "10px"
            }}>
              {dependencies.length}
            </span>
          </button>

          {showDeps && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                padding: "8px",
                minWidth: "260px",
                maxWidth: "320px",
                zIndex: 100,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                <strong style={{ fontSize: "11px", color: "var(--color-on-surface, #0f172a)" }}>
                  Contratos Requeridos (Links de Saída):
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{dependencies.length}</span>
              </div>
              {dependencies.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--color-outline, #64748b)", padding: "8px 4px", textAlign: "center" }}>
                  Nenhum link ou dependência referenciada.
                </div>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {dependencies.map((d: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        onNavigateFile(d.path || d.filePath || d);
                        setShowDeps(false);
                      }}
                      style={{
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontSize: "11.5px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.15s"
                      }}
                      className="dropdown-item-hover"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                        <span className="material-symbols-outlined icon-xs" style={{ color: d.hash ? "#2563eb" : "#64748b" }}>
                          {d.hash ? "share_location" : "description"}
                        </span>
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title || d.path || d}
                        </span>
                      </div>
                      {d.layer && (
                        <span style={{ fontSize: "9.5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.06)", color: "#64748b", flexShrink: 0 }}>
                          {d.layer}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

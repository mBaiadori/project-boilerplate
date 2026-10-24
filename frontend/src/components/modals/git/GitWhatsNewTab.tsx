import React from "react";

export type WhatsNewFilterType = "all" | "new" | "modified" | "proposals";

export interface GitWhatsNewTabProps {
  whatsNewSummary: any;
  whatsNewFilter: WhatsNewFilterType;
  onWhatsNewFilterChange: (filter: WhatsNewFilterType) => void;
  whatsNewFiles: any[];
  whatsNewProposals: any[];
  whatsNewCommits: any[];
  newFilesCount: number;
  modFilesCount: number;
  filteredWhatsNewFiles: any[];
  isSyncing: boolean;
  onSync: () => void;
  onMarkAsSeen: () => void;
  expandedFiles: Record<string, boolean>;
  getFileDiffInfo: (path: string) => { diffText: string };
  onToggleFileExpand: (path: string) => void;
  onOpenFile: (path: string) => void;
  renderDiffViewer: (diffText: string, path: string) => React.ReactNode;
}

export const GitWhatsNewTab: React.FC<GitWhatsNewTabProps> = ({
  whatsNewSummary,
  whatsNewFilter,
  onWhatsNewFilterChange,
  whatsNewFiles,
  whatsNewProposals,
  whatsNewCommits,
  newFilesCount,
  modFilesCount,
  filteredWhatsNewFiles,
  isSyncing,
  onSync,
  onMarkAsSeen,
  expandedFiles,
  getFileDiffInfo,
  onToggleFileExpand,
  onOpenFile,
  renderDiffViewer,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header Banner with summary and Mark As Read Button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-surface-secondary, #f8fafc)",
          padding: "14px 18px",
          borderRadius: "10px",
          border: "1px solid var(--border-color)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(34, 197, 94, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#16a34a",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "22px" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "14.5px",
                fontWeight: 700,
                color: "var(--text-heading)",
              }}
            >
              Novidades
            </h4>
            <span
              style={{
                fontSize: "12.5px",
                color: "var(--text-muted)",
                marginTop: "2px",
                display: "block",
              }}
            >
              {whatsNewSummary?.summaryMessage ||
                "Nenhuma atualização recente."}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onSync}
            disabled={isSyncing}
            title="Buscar e baixar as últimas novidades"
          >
            <span className="material-symbols-outlined icon-xs">
              cloud_sync
            </span>
            {isSyncing ? "Buscando..." : "Buscar Novidades"}
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={onMarkAsSeen}
            title="Marcar todas as novidades como vistas"
            style={{
              backgroundColor: "#16a34a",
              color: "#ffffff",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span className="material-symbols-outlined icon-xs">
              done_all
            </span>
            Marcar como visto
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginRight: "4px",
          }}
        >
          Filtrar por:
        </span>

        <button
          type="button"
          onClick={() => onWhatsNewFilterChange("all")}
          style={{
            padding: "5px 12px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            border:
              whatsNewFilter === "all"
                ? "1px solid var(--primary, #3b82f6)"
                : "1px solid var(--border-color)",
            background:
              whatsNewFilter === "all"
                ? "rgba(59, 130, 246, 0.12)"
                : "transparent",
            color:
              whatsNewFilter === "all"
                ? "var(--primary, #3b82f6)"
                : "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          Todos ({whatsNewFiles.length})
        </button>

        <button
          type="button"
          onClick={() => onWhatsNewFilterChange("new")}
          style={{
            padding: "5px 12px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            border:
              whatsNewFilter === "new"
                ? "1px solid #22c55e"
                : "1px solid var(--border-color)",
            background:
              whatsNewFilter === "new"
                ? "rgba(34, 197, 94, 0.12)"
                : "transparent",
            color:
              whatsNewFilter === "new"
                ? "#16a34a"
                : "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          ✨ Novos Documentos ({newFilesCount})
        </button>

        <button
          type="button"
          onClick={() => onWhatsNewFilterChange("modified")}
          style={{
            padding: "5px 12px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            border:
              whatsNewFilter === "modified"
                ? "1px solid #f59e0b"
                : "1px solid var(--border-color)",
            background:
              whatsNewFilter === "modified"
                ? "rgba(245, 158, 11, 0.12)"
                : "transparent",
            color:
              whatsNewFilter === "modified"
                ? "#d97706"
                : "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          📝 Documentos Alterados ({modFilesCount})
        </button>

        {whatsNewProposals.length > 0 && (
          <button
            type="button"
            onClick={() => onWhatsNewFilterChange("proposals")}
            style={{
              padding: "5px 12px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border:
                whatsNewFilter === "proposals"
                  ? "1px solid #8b5cf6"
                  : "1px solid var(--border-color)",
              background:
                whatsNewFilter === "proposals"
                  ? "rgba(139, 92, 246, 0.12)"
                  : "transparent",
              color:
                whatsNewFilter === "proposals"
                  ? "#7c3aed"
                  : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            🔀 Propostas Integradas ({whatsNewProposals.length})
          </button>
        )}
      </div>

      {/* Integrated Proposals Section */}
      {(whatsNewFilter === "all" || whatsNewFilter === "proposals") &&
        whatsNewProposals.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              overflow: "hidden",
              background: "var(--bg-surface)",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(139, 92, 246, 0.08)",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "18px", color: "#8b5cf6" }}
              >
                verified
              </span>
              <strong
                style={{
                  fontSize: "13px",
                  color: "var(--text-heading)",
                }}
              >
                Propostas de Especificação Aprovadas e Integradas
              </strong>
            </div>

            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {whatsNewProposals.map((pr, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background: "var(--bg-surface-secondary, #f8fafc)",
                    border: "1px solid var(--border-color-subtle, #f1f5f9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      className="badge badge-primary"
                      style={{ fontWeight: 700 }}
                    >
                      Proposta #{pr.id}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-heading)",
                      }}
                    >
                      {pr.title}
                    </span>
                  </div>
                  {pr.author && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      Autor: <strong>{pr.author}</strong>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Files List in What's New */}
      {whatsNewFilter !== "proposals" && (
        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg-surface-secondary, #f8fafc)",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "13px" }}>
              Documentos Recebidos ({filteredWhatsNewFiles.length})
            </span>
          </div>

          {filteredWhatsNewFiles.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              <span
                className="material-symbols-outlined icon-md"
                style={{
                  color: "var(--text-dim)",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                check_circle
              </span>
              Nenhum documento com este filtro nesta atualização.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredWhatsNewFiles.map((file, idx) => {
                if (!file?.path) return null;
                const isExpanded = !!expandedFiles[file.path];
                const { diffText } = getFileDiffInfo(file.path);

                return (
                  <div
                    key={file.path || idx}
                    style={{
                      borderBottom:
                        "1px solid var(--border-color-subtle, #f1f5f9)",
                      background: isExpanded
                        ? "var(--bg-surface)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        cursor: "pointer",
                        userSelect: "none",
                        background: isExpanded
                          ? "var(--bg-surface-secondary, #f8fafc)"
                          : "transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Left side: Icon, Path and Status */}
                      <div
                        onClick={() => onToggleFileExpand(file.path)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minWidth: 0,
                          flex: 1,
                          paddingRight: "12px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "18px",
                            color: isExpanded
                              ? "var(--primary, #3b82f6)"
                              : "var(--text-dim)",
                            transition: "transform 0.2s ease",
                            transform: isExpanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          chevron_right
                        </span>

                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "18px",
                            color:
                              file.status === "M"
                                ? "#d97706"
                                : file.status === "A"
                                  ? "#16a34a"
                                  : file.status === "D"
                                    ? "#dc2626"
                                    : "var(--text-muted)",
                          }}
                        >
                          {file.status === "D"
                            ? "delete_outline"
                            : file.status === "A"
                              ? "note_add"
                              : "description"}
                        </span>

                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "12.5px",
                            fontWeight: isExpanded ? 600 : 500,
                            color: "var(--text-heading, #1e293b)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={file.path}
                        >
                          {file.path}
                        </span>

                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            flexShrink: 0,
                            background:
                              file.status === "M"
                                ? "#fef3c7"
                                : file.status === "A"
                                  ? "#dcfce7"
                                  : file.status === "D"
                                    ? "#fee2e2"
                                    : "#e0e7ff",
                            color:
                              file.status === "M"
                                ? "#b45309"
                                : file.status === "A"
                                  ? "#15803d"
                                  : file.status === "D"
                                    ? "#b91c1c"
                                    : "#4338ca",
                          }}
                        >
                          {file.statusLabel ||
                            (file.status === "A"
                              ? "Novo Documento"
                              : file.status === "D"
                                ? "Documento Removido"
                                : "Documento Atualizado")}
                        </span>
                      </div>

                      {/* Right side: Additions/Deletions and Action Buttons */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexShrink: 0,
                        }}
                      >
                        {(file.additions > 0 || file.deletions > 0) && (
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              fontSize: "11.5px",
                              fontFamily: "var(--font-mono)",
                              marginRight: "6px",
                            }}
                          >
                            {file.additions > 0 && (
                              <span
                                style={{
                                  color: "#16a34a",
                                  fontWeight: 600,
                                }}
                              >
                                +{file.additions}
                              </span>
                            )}
                            {file.deletions > 0 && (
                              <span
                                style={{
                                  color: "#dc2626",
                                  fontWeight: 600,
                                }}
                              >
                                -{file.deletions}
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenFile(file.path);
                          }}
                          title="Abrir este documento no editor"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "3px 8px",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "14px" }}
                          >
                            open_in_new
                          </span>
                          Abrir Documento
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => onToggleFileExpand(file.path)}
                          style={{ fontSize: "11px", padding: "3px 8px" }}
                        >
                          {isExpanded ? "Ocultar mudanças" : "Ver mudanças"}
                        </button>
                      </div>
                    </div>

                    {/* Accordion Diff View */}
                    {isExpanded && renderDiffViewer(diffText, file.path)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Commits List Received */}
      {whatsNewCommits.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "14px",
            background: "var(--bg-surface)",
          }}
        >
          <h4
            style={{
              margin: "0 0 10px 0",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-heading)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", color: "var(--text-muted)" }}
            >
              history
            </span>
            Publicações e Marcos Trazidos pela Atualização (
            {whatsNewCommits.length})
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {whatsNewCommits.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--bg-surface-secondary, #f8fafc)",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    className="badge badge-neutral"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                    }}
                  >
                    #{item?.shortHash || item?.hash?.slice(0, 7) || "v-atual"}
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      color: "var(--text-heading)",
                    }}
                  >
                    {item?.message || "Atualização de documentação"}
                  </span>
                </div>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "11.5px",
                  }}
                >
                  {item?.author || "Equipe"} &bull; {item?.date || ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

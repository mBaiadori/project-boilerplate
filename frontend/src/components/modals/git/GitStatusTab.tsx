import React from "react";

export interface GitStatusTabProps {
  isClean: boolean;
  changedFiles: any[];
  gitStatus: any;
  onRefreshAll: () => void;
  onSync: () => void;
  isSyncing: boolean;
  allAreExpanded: boolean;
  onToggleAllExpanded: () => void;
  expandedFiles: Record<string, boolean>;
  getFileDiffInfo: (path: string) => { diffText: string; additions: number; deletions: number };
  onToggleFileExpand: (path: string) => void;
  onOpenFile: (path: string) => void;
  renderDiffViewer: (diffText: string, path: string) => React.ReactNode;
  currentBranch: string;
  commitMsg: string;
  onCommitMsgChange: (msg: string) => void;
  isCommitting: boolean;
  onCommit: (e: React.FormEvent) => void;
}

export const GitStatusTab: React.FC<GitStatusTabProps> = ({
  isClean,
  changedFiles,
  gitStatus,
  onRefreshAll,
  onSync,
  isSyncing,
  allAreExpanded,
  onToggleAllExpanded,
  expandedFiles,
  getFileDiffInfo,
  onToggleFileExpand,
  onOpenFile,
  renderDiffViewer,
  currentBranch,
  commitMsg,
  onCommitMsgChange,
  isCommitting,
  onCommit,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Quick Actions Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-surface-secondary, #f8fafc)",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`pill-dot ${isClean ? "success" : "warning"}`}>
            <span className="dot"></span>{" "}
            {isClean
              ? "Documentação consolidada e sincronizada"
              : `${changedFiles.length} documento(s) com rascunhos pendentes`}
          </span>
          {gitStatus?.ahead ? (
            <span className="badge badge-primary-subtle">
              {gitStatus.ahead} marco(s) pendentes de envio
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefreshAll}
            title="Atualizar status e comparativo"
          >
            <span className="material-symbols-outlined icon-xs">sync</span>
            Atualizar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSync}
            disabled={isSyncing}
            title="Sincronizar com (baixar novidades e enviar contribuições)"
          >
            <span className="material-symbols-outlined icon-xs">
              cloud_sync
            </span>
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Changed Files List with Accordions */}
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
            Documentos em Edição Local &bull; Comparativo de Mudanças
          </span>
          {changedFiles.length > 0 && (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onToggleAllExpanded}
                style={{
                  fontSize: "11.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span className="material-symbols-outlined icon-xs">
                  {allAreExpanded ? "unfold_less" : "unfold_more"}
                </span>
                {allAreExpanded ? "Recolher Todos" : "Expandir Todos"}
              </button>
            </div>
          )}
        </div>

        {changedFiles.length === 0 ? (
          <div
            style={{
              padding: "28px",
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
            Nenhum rascunho pendente no momento. Todos os seus documentos estão
            consolidados.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {changedFiles.map((file, idx) => {
              if (!file?.path) return null;
              const isExpanded = !!expandedFiles[file.path];
              const { diffText, additions, deletions } = getFileDiffInfo(
                file.path,
              );

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
                  {/* File Accordion Header */}
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
                              : file.status === "A" || file.status === "??"
                                ? "#16a34a"
                                : file.status === "D"
                                  ? "#dc2626"
                                  : "var(--text-muted)",
                        }}
                      >
                        {file.status === "D"
                          ? "delete_outline"
                          : file.status === "A" || file.status === "??"
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
                              : file.status === "A" || file.status === "??"
                                ? "#dcfce7"
                                : file.status === "D"
                                  ? "#fee2e2"
                                  : "#e0e7ff",
                          color:
                            file.status === "M"
                              ? "#b45309"
                              : file.status === "A" || file.status === "??"
                                ? "#15803d"
                                : file.status === "D"
                                  ? "#b91c1c"
                                  : "#4338ca",
                        }}
                      >
                        {file.status === "??"
                          ? "NOVO"
                          : file.status === "M"
                            ? "ALTERADO"
                            : file.status === "A"
                              ? "ADICIONADO"
                              : file.status === "D"
                                ? "REMOVIDO"
                                : file.status}
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
                      {(additions > 0 || deletions > 0) && (
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            fontSize: "11.5px",
                            fontFamily: "var(--font-mono)",
                            marginRight: "6px",
                          }}
                        >
                          {additions > 0 && (
                            <span
                              style={{
                                color: "#16a34a",
                                fontWeight: 600,
                              }}
                            >
                              +{additions}
                            </span>
                          )}
                          {deletions > 0 && (
                            <span
                              style={{
                                color: "#dc2626",
                                fontWeight: 600,
                              }}
                            >
                              -{deletions}
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

      {/* Versioning & Save actions */}
      <form
        onSubmit={onCommit}
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
          background: "var(--bg-surface)",
        }}
      >
        <h4
          style={{
            margin: "0 0 10px 0",
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "18px", color: "var(--primary)" }}
          >
            bookmark_add
          </span>
          Salvar Marco de Versão Oficial na Trilha <code>{currentBranch}</code>
        </h4>
        <div className="form-group" style={{ marginBottom: "12px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Descreva as atualizações realizadas (ex: Atualização das políticas e regras de negócio)..."
            value={commitMsg}
            onChange={(e) => onCommitMsgChange(e.target.value)}
            disabled={isCommitting || isClean}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isCommitting || isClean || !commitMsg.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              className="material-symbols-outlined icon-xs"
              style={
                isCommitting ? { animation: "spin 1s linear infinite" } : {}
              }
            >
              {isCommitting ? "progress_activity" : "check"}
            </span>
            {isCommitting ? "Salvando marco..." : "Salvar Versão Oficial"}
          </button>
        </div>
      </form>
    </div>
  );
};

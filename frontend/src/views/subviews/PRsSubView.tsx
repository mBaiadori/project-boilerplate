import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { PR } from "../../types";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { VisualMarkdownDiff } from "../../components/editor/VisualMarkdownDiff";

interface PRsSubViewProps {
  onOpenDiffModal: () => void;
}

export const PRsSubView: React.FC<PRsSubViewProps> = ({ onOpenDiffModal }) => {
  const { activeRepo } = useWorkspace();
  const repoName = activeRepo?.name || "local";

  const [prs, setPrs] = useState<PR[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<
    "all" | "open" | "merged" | "closed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPRs, setExpandedPRs] = useState<
    Record<number | string, boolean>
  >({});
  const [prViewModes, setPrViewModes] = useState<
    Record<string, "visual" | "raw">
  >({});
  const [fileDiffsCache, setFileDiffsCache] = useState<Record<string, string>>(
    {},
  );
  const [loadingDiffs, setLoadingDiffs] = useState<Record<string, boolean>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    id: number | string;
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<{
    id: number | string;
    action: "approve" | "merge" | "reject";
  } | null>(null);

  const loadPRs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getPRs(repoName);
      if (res && Array.isArray(res.prs)) {
        setPrs(res.prs);
      } else {
        setPrs([]);
      }
    } catch (err) {
      console.error(
        `[PRsSubView] Erro ao carregar propostas do repositório ${repoName}:`,
        err,
      );
    } finally {
      setIsLoading(false);
    }
  }, [repoName]);

  useEffect(() => {
    loadPRs();
  }, [loadPRs]);

  const toggleExpand = async (id: number | string, pr: PR) => {
    const nextState = !expandedPRs[id];
    setExpandedPRs((prev) => ({ ...prev, [id]: nextState }));

    // If expanding a commit revision that has files without diff_text, auto-load diffs
    if (
      nextState &&
      pr.is_direct_commit &&
      pr.commit_hash &&
      Array.isArray(pr.files)
    ) {
      for (const file of pr.files) {
        const fileKey = `${pr.id}-${file.path}`;
        if (
          !file.diff_text &&
          !fileDiffsCache[fileKey] &&
          !loadingDiffs[fileKey]
        ) {
          setLoadingDiffs((prev) => ({ ...prev, [fileKey]: true }));
          try {
            const diffRes = await API.getPRFileDiff({
              path: file.path,
              commit: pr.commit_hash,
              repo: repoName,
            });
            if (diffRes.ok && diffRes.data?.diff) {
              setFileDiffsCache((prev) => ({
                ...prev,
                [fileKey]: diffRes.data.diff,
              }));
            }
          } catch (e) {
            console.warn(`[PRsSubView] Erro ao obter diff de ${file.path}:`, e);
          } finally {
            setLoadingDiffs((prev) => ({ ...prev, [fileKey]: false }));
          }
        }
      }
    }
  };

  const handleApprove = async (id: number | string) => {
    setActionLoading({ id, action: "approve" });
    setActionFeedback(null);
    try {
      const res = await API.approvePR(id);
      if (res.ok) {
        setActionFeedback({
          id,
          message: res.data?.message || "Aprovação registrada com sucesso!",
          type: "success",
        });
        await loadPRs();
      } else {
        setActionFeedback({
          id,
          message: res.data?.error || "Erro ao aprovar proposta.",
          type: "error",
        });
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        message: err.message || "Erro ao aprovar proposta.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMerge = async (id: number | string) => {
    setActionLoading({ id, action: "merge" });
    setActionFeedback(null);
    try {
      const res = await API.mergePR(id);
      if (res.ok) {
        setActionFeedback({
          id,
          message:
            res.data?.message ||
            "Proposta publicada na versão oficial com sucesso!",
          type: "success",
        });
        await loadPRs();
      } else {
        setActionFeedback({
          id,
          message: res.data?.error || "Erro ao publicar versão.",
          type: "error",
        });
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        message: err.message || "Erro ao publicar versão.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number | string) => {
    const reason = window.prompt(
      "Informe o motivo da rejeição da proposta (opcional):",
    );
    if (reason === null) return;

    setActionLoading({ id, action: "reject" });
    setActionFeedback(null);
    try {
      const res = await API.rejectPR(id, reason || "Rejeitado pelo revisor");
      if (res.ok) {
        setActionFeedback({
          id,
          message: "Proposta rejeitada e arquivada.",
          type: "success",
        });
        await loadPRs();
      } else {
        setActionFeedback({
          id,
          message: res.data?.error || "Erro ao rejeitar proposta.",
          type: "error",
        });
      }
    } catch (err: any) {
      setActionFeedback({
        id,
        message: err.message || "Erro ao rejeitar proposta.",
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const countAll = prs.length;
  const countOpen = prs.filter((p) => {
    const s = (p.status || "").toLowerCase();
    return s === "open" || s === "in_review";
  }).length;
  const countMerged = prs.filter(
    (p) => (p.status || "").toLowerCase() === "merged",
  ).length;
  const countClosed = prs.filter(
    (p) => (p.status || "").toLowerCase() === "closed",
  ).length;

  const filteredPRs = useMemo(() => {
    return prs.filter((pr) => {
      const statusLower = (pr.status || "").toLowerCase();
      const matchesStatus =
        activeStatus === "all" ||
        (activeStatus === "open" &&
          (statusLower === "open" || statusLower === "in_review")) ||
        (activeStatus === "merged" && statusLower === "merged") ||
        (activeStatus === "closed" && statusLower === "closed");

      const matchesSearch =
        pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pr.author &&
          pr.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pr.branch &&
          pr.branch.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pr.description &&
          pr.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(pr.id).includes(searchQuery);

      return matchesStatus && matchesSearch;
    });
  }, [prs, activeStatus, searchQuery]);

  return (
    <div
      id="subview-prs"
      className="dash-subview"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div className="prs-view-wrapper">
        <div className="template-store-header">
          <div className="templates-header" style={{ marginBottom: 0 }}>
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "26px", color: "var(--primary, #3b82f6)" }}
                >
                  rate_review
                </span>
                <h2 style={{ margin: 0 }}>
                  Central de Revisão & Propostas de Evolução (PRs)
                </h2>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="badge badge-primary"
                  style={{
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    folder
                  </span>
                  Repositório: <strong>{repoName}</strong>
                </span>
                {activeRepo?.full_name && !activeRepo?.is_local && (
                  <span
                    className="badge badge-neutral"
                    style={{
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "13px" }}
                    >
                      cloud_sync
                    </span>
                    GitHub: {activeRepo.full_name}
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Todas as revisões e commits na <code>main</code> de{" "}
                  <strong>{repoName}</strong>.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                id="btn-refresh-prs"
                className="btn btn-secondary btn-sm"
                title={`Recarregar revisões de ${repoName}`}
                type="button"
                onClick={() => loadPRs()}
              >
                <span className="material-symbols-outlined icon-xs">
                  refresh
                </span>
                Atualizar
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={onOpenDiffModal}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Nova Proposta de Evolução
              </button>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <div className="store-filter-bar" id="prs-status-filters">
              <button
                className={`store-filter-chip ${activeStatus === "all" ? "active" : ""}`}
                data-status="all"
                type="button"
                onClick={() => setActiveStatus("all")}
              >
                Todas (<span id="count-prs-all">{countAll}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "open" ? "active" : ""}`}
                data-status="open"
                type="button"
                onClick={() => setActiveStatus("open")}
              >
                Em Revisão (<span id="count-prs-open">{countOpen}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "merged" ? "active" : ""}`}
                data-status="merged"
                type="button"
                onClick={() => setActiveStatus("merged")}
              >
                Publicadas / Commits na Main (
                <span id="count-prs-merged">{countMerged}</span>)
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "closed" ? "active" : ""}`}
                data-status="closed"
                type="button"
                onClick={() => setActiveStatus("closed")}
              >
                Arquivadas / Rejeitadas (
                <span id="count-prs-closed">{countClosed}</span>)
              </button>
            </div>

            <div className="store-search-box">
              <input
                type="text"
                id="prs-search-input"
                placeholder={`Buscar propostas ou revisões em ${repoName}...`}
                spellCheck="false"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* PRs List Grid */}
        <div
          id="prs-full-list"
          className="prs-full-grid"
          style={{
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {isLoading ? (
            <div
              className="loading-state"
              style={{ padding: "32px", textAlign: "center" }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  animation: "spin 1s linear infinite",
                  fontSize: "28px",
                  color: "var(--primary)",
                }}
              >
                progress_activity
              </span>
              <div style={{ marginTop: "8px" }}>
                Carregando propostas de {repoName}...
              </div>
            </div>
          ) : filteredPRs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 24px",
                color: "var(--text-muted)",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px",
                background: "var(--bg-surface)",
              }}
            >
              <span
                className="material-symbols-outlined icon-lg"
                style={{
                  color: "var(--text-dim)",
                  marginBottom: "8px",
                  fontSize: "36px",
                }}
              >
                inbox
              </span>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "var(--text-heading)",
                }}
              >
                Nenhuma Proposta ou Revisão em "{repoName}"
              </div>
              <p
                style={{
                  fontSize: "13px",
                  margin: "6px 0 16px 0",
                  maxWidth: "500px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Faça alterações nos documentos de <strong>{repoName}</strong> e
                clique em "Nova Proposta de Evolução" para abrir uma revisão com
                diff visual.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenDiffModal}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Criar Nova Proposta em {repoName}
              </button>
            </div>
          ) : (
            filteredPRs.map((pr) => {
              const statusLower = (pr.status || "").toLowerCase();
              const isMerged = statusLower === "merged";
              const isClosed = statusLower === "closed";
              const isOpen = !isMerged && !isClosed;
              const isExpanded = !!expandedPRs[pr.id];
              const approvals = Array.isArray(pr.approvals) ? pr.approvals : [];
              const prFiles = Array.isArray(pr.files) ? pr.files : [];
              const isDirectCommit = !!pr.is_direct_commit;

              const statusText =
                isDirectCommit || isMerged
                  ? "PUBLICADA"
                  : isClosed
                    ? "ARQUIVADA"
                    : "EM REVISÃO";

              return (
                <div
                  key={pr.id}
                  className="pr-card"
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "16px",
                    background: "var(--bg-surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
                  }}
                >
                  {/* Top Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: isDirectCommit
                            ? "var(--primary, #3b82f6)"
                            : isMerged
                              ? "var(--primary, #3b82f6)"
                              : isClosed
                                ? "var(--danger, #ef4444)"
                                : "var(--success, #16a34a)",
                          fontSize: "24px",
                          marginTop: "2px",
                        }}
                      >
                        {isDirectCommit
                          ? "commit"
                          : isMerged
                            ? "check_circle"
                            : isClosed
                              ? "cancel"
                              : "rate_review"}
                      </span>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong
                            style={{
                              fontSize: "15.5px",
                              color: "var(--text-heading)",
                            }}
                          >
                            {isDirectCommit
                              ? `Commit #${pr.short_id || pr.id}: `
                              : `#${pr.id} `}
                            {pr.title}
                          </strong>
                          {isDirectCommit && (
                            <span
                              className="badge badge-success"
                              style={{
                                fontSize: "11px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                              title="Revisão comitada na branch principal (main)"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "12px" }}
                              >
                                history_edu
                              </span>
                              Revisão Oficial (main)
                            </span>
                          )}
                          {pr.github_number && (
                            <span
                              className="badge"
                              style={{
                                fontSize: "11px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                background: "#24292f",
                                color: "#fff",
                              }}
                              title="Sincronizado com o GitHub"
                            >
                              GitHub #{pr.github_number}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            marginTop: "3px",
                          }}
                        >
                          {isDirectCommit ? "Comitado por " : "Proposto por "}
                          <strong>{pr.author}</strong> em {pr.created_at} &bull;
                          Trilha/Branch: <code>{pr.branch}</code>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        className={`pill-dot ${isMerged || isDirectCommit ? "info" : isClosed ? "danger" : "success"}`}
                      >
                        <span className="dot"></span> {statusText}
                      </span>
                    </div>
                  </div>

                  {/* PR Description */}
                  {pr.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "var(--text-normal)",
                        lineHeight: "1.5",
                        background: "var(--bg-surface-secondary, #f8fafc)",
                        padding: "10px 12px",
                        borderRadius: "6px",
                      }}
                    >
                      {pr.description}
                    </p>
                  )}

                  {/* Approvals & Reviewers */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      fontSize: "12px",
                    }}
                  >
                    <span
                      style={{ color: "var(--text-muted)", fontWeight: 600 }}
                    >
                      Governança & Status:
                    </span>
                    {isDirectCommit ? (
                      <span
                        className="badge badge-neutral"
                        style={{
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px" }}
                        >
                          verified
                        </span>
                        Integrado diretamente na main
                      </span>
                    ) : approvals.length === 0 ? (
                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: "11px" }}
                      >
                        Aguardando revisores
                      </span>
                    ) : (
                      approvals.map((app, idx) => (
                        <span
                          key={idx}
                          className="badge badge-success"
                          style={{
                            fontSize: "11px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "12px" }}
                          >
                            check
                          </span>
                          {app}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Feedback Message */}
                  {actionFeedback && actionFeedback.id === pr.id && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "12.5px",
                        background:
                          actionFeedback.type === "success"
                            ? "#f0fdf4"
                            : "#fef2f2",
                        color:
                          actionFeedback.type === "success"
                            ? "#166534"
                            : "#991b1b",
                        border: `1px solid ${actionFeedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                      }}
                    >
                      {actionFeedback.message}
                    </div>
                  )}

                  {/* Files & Diffs Toggle */}
                  {prFiles.length > 0 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border-color)",
                        paddingTop: "10px",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleExpand(pr.id, pr)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                        }}
                      >
                        <span className="material-symbols-outlined icon-xs">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                        {isExpanded
                          ? "Ocultar alterações dos documentos"
                          : `Ver ${prFiles.length} documento(s) alterados`}
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {prFiles.map((f: any, fIdx: number) => {
                            const fileKey = `${pr.id}-${f.path || fIdx}`;
                            const isVisual = prViewModes[fileKey] !== "raw";
                            const fileDiff =
                              f.diff_text || fileDiffsCache[fileKey] || "";
                            const isLoadingDiff = loadingDiffs[fileKey];

                            return (
                              <div
                                key={fIdx}
                                style={{
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "6px",
                                  overflow: "hidden",
                                  fontSize: "12px",
                                  background: "var(--bg-surface)",
                                }}
                              >
                                <div
                                  style={{
                                    padding: "8px 12px",
                                    background:
                                      "var(--bg-surface-secondary, #f8fafc)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontFamily: "var(--font-mono)",
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
                                      className="material-symbols-outlined icon-xs"
                                      style={{ color: "var(--primary)" }}
                                    >
                                      description
                                    </span>
                                    <strong>{f.path}</strong>
                                    {(f.additions > 0 || f.deletions > 0) && (
                                      <>
                                        <span
                                          style={{
                                            color:
                                              "var(--color-success, #16a34a)",
                                            fontWeight: 600,
                                          }}
                                        >
                                          +{f.additions || 0}
                                        </span>
                                        <span
                                          style={{
                                            color:
                                              "var(--color-error, #dc2626)",
                                            fontWeight: 600,
                                          }}
                                        >
                                          -{f.deletions || 0}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      display: "inline-flex",
                                      background: "#e2e8f0",
                                      padding: "2px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPrViewModes((prev) => ({
                                          ...prev,
                                          [fileKey]: "visual",
                                        }))
                                      }
                                      style={{
                                        padding: "2px 6px",
                                        border: "none",
                                        borderRadius: "3px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: isVisual
                                          ? "#ffffff"
                                          : "transparent",
                                        color: isVisual
                                          ? "var(--primary, #2563eb)"
                                          : "#64748b",
                                      }}
                                    >
                                      Visual (Doc)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPrViewModes((prev) => ({
                                          ...prev,
                                          [fileKey]: "raw",
                                        }))
                                      }
                                      style={{
                                        padding: "2px 6px",
                                        border: "none",
                                        borderRadius: "3px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: !isVisual
                                          ? "#ffffff"
                                          : "transparent",
                                        color: !isVisual
                                          ? "var(--primary, #2563eb)"
                                          : "#64748b",
                                      }}
                                    >
                                      Patch Técnico
                                    </button>
                                  </div>
                                </div>

                                {isLoadingDiff ? (
                                  <div
                                    style={{
                                      padding: "12px",
                                      textAlign: "center",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Carregando diff do commit...
                                  </div>
                                ) : isVisual &&
                                  (f.old_content || f.new_content) ? (
                                  <div
                                    style={{
                                      maxHeight: "350px",
                                      overflowY: "auto",
                                    }}
                                  >
                                    <VisualMarkdownDiff
                                      oldContent={f.old_content || ""}
                                      newContent={f.new_content || ""}
                                      fileName={f.path}
                                    />
                                  </div>
                                ) : (
                                  fileDiff && (
                                    <pre
                                      style={{
                                        margin: 0,
                                        padding: "8px 10px",
                                        fontSize: "11.5px",
                                        background: "#0d1117",
                                        color: "#f8fafc",
                                        overflowX: "auto",
                                        fontFamily: "var(--font-mono)",
                                      }}
                                    >
                                      {fileDiff}
                                    </pre>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "10px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      {pr.html_url ? (
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "12px",
                            color: "var(--primary, #3b82f6)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isDirectCommit
                            ? "Ver Commit no GitHub"
                            : "Ver PR no GitHub"}{" "}
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "13px" }}
                          >
                            open_in_new
                          </span>
                        </a>
                      ) : (
                        <span
                          style={{ fontSize: "12px", color: "var(--text-dim)" }}
                        >
                          {isDirectCommit
                            ? "Revisão Oficial no Git"
                            : "Governança Local"}
                        </span>
                      )}
                    </div>

                    {isOpen && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => handleReject(pr.id)}
                          disabled={actionLoading?.id === pr.id}
                          style={{
                            color: "var(--danger, #ef4444)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="Rejeitar e arquivar esta proposta de evolução"
                        >
                          <span
                            className="material-symbols-outlined icon-xs"
                            style={
                              actionLoading?.id === pr.id &&
                              actionLoading.action === "reject"
                                ? { animation: "spin 1s linear infinite" }
                                : {}
                            }
                          >
                            {actionLoading?.id === pr.id &&
                            actionLoading.action === "reject"
                              ? "progress_activity"
                              : "close"}
                          </span>
                          {actionLoading?.id === pr.id &&
                          actionLoading.action === "reject"
                            ? "Rejeitando..."
                            : "Rejeitar"}
                        </button>

                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => handleApprove(pr.id)}
                          disabled={actionLoading?.id === pr.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="Aprovar proposta como revisor"
                        >
                          <span
                            className="material-symbols-outlined icon-xs"
                            style={
                              actionLoading?.id === pr.id &&
                              actionLoading.action === "approve"
                                ? { animation: "spin 1s linear infinite" }
                                : {}
                            }
                          >
                            {actionLoading?.id === pr.id &&
                            actionLoading.action === "approve"
                              ? "progress_activity"
                              : "thumb_up"}
                          </span>
                          {actionLoading?.id === pr.id &&
                          actionLoading.action === "approve"
                            ? "Aprovando..."
                            : `Aprovar Proposta ${approvals.length > 0 ? `(${approvals.length})` : ""}`}
                        </button>

                        <button
                          className="btn btn-primary btn-xs"
                          type="button"
                          onClick={() => handleMerge(pr.id)}
                          disabled={actionLoading?.id === pr.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          title="Publicar alterações na versão oficial da documentação"
                        >
                          <span
                            className="material-symbols-outlined icon-xs"
                            style={
                              actionLoading?.id === pr.id &&
                              actionLoading.action === "merge"
                                ? { animation: "spin 1s linear infinite" }
                                : {}
                            }
                          >
                            {actionLoading?.id === pr.id &&
                            actionLoading.action === "merge"
                              ? "progress_activity"
                              : "publish"}
                          </span>
                          {actionLoading?.id === pr.id &&
                          actionLoading.action === "merge"
                            ? "Publicando versão oficial..."
                            : "Publicar na Versão Oficial"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

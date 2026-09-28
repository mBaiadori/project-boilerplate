import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { PR } from "../../types";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { VisualMarkdownDiff } from "../../components/editor/VisualMarkdownDiff";

interface PRsSubViewProps {
  onOpenDiffModal?: () => void;
}

export const PRsSubView: React.FC<PRsSubViewProps> = () => {
  const { activeRepo, refreshGitStatus, refreshPendingChanges } = useWorkspace();
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
    action: "approve" | "merge" | "reject" | "rollback";
  } | null>(null);

  // Rollback modal state
  const [rollbackTarget, setRollbackTarget] = useState<PR | null>(null);

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
        `[PRsSubView] Erro ao carregar revisões do repositório ${repoName}:`,
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

    // If expanding a revision that has files without diff_text, auto-load diffs
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
        refreshGitStatus?.();
        refreshPendingChanges?.();
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
            "Versão publicada e integrada com sucesso!",
          type: "success",
        });
        await loadPRs();
        refreshGitStatus?.();
        refreshPendingChanges?.();
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
      "Informe o motivo da rejeição (opcional):",
    );
    if (reason === null) return;

    setActionLoading({ id, action: "reject" });
    setActionFeedback(null);
    try {
      const res = await API.rejectPR(id, reason || "Rejeitado pelo revisor");
      if (res.ok) {
        setActionFeedback({
          id,
          message: "Proposta arquivada e rejeitada.",
          type: "success",
        });
        await loadPRs();
        refreshGitStatus?.();
        refreshPendingChanges?.();
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

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    const target = rollbackTarget;
    setActionLoading({ id: target.id, action: "rollback" });
    setActionFeedback(null);

    try {
      const res = await API.rollbackVersion({
        id: target.id,
        commit_hash: target.commit_hash,
        repo: repoName,
      });

      if (res.ok) {
        setActionFeedback({
          id: target.id,
          message:
            res.data?.message ||
            `Versão #${target.short_id || target.id} restaurada como a versão atual! O histórico foi preservado.`,
          type: "success",
        });
        setRollbackTarget(null);
        await loadPRs();
        refreshGitStatus?.();
        refreshPendingChanges?.();
      } else {
        setActionFeedback({
          id: target.id,
          message: res.data?.error || "Erro ao restaurar versão.",
          type: "error",
        });
      }
    } catch (err: any) {
      setActionFeedback({
        id: target.id,
        message: err.message || "Erro ao restaurar versão.",
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
      <div className="prs-view-wrapper" style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}>
        {/* Header */}
        <div className="template-store-header" style={{ marginBottom: "20px" }}>
          <div
            className="templates-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: 0,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "28px", color: "var(--primary, #3b82f6)" }}
                >
                  history_edu
                </span>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--text-heading)" }}>
                  Revisões & Versões
                </h2>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
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
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Acompanhe aprovações, revisões ativas e histórico com capacidade de restauração segura.
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
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span className="material-symbols-outlined icon-xs">
                  refresh
                </span>
                Atualizar
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
              gap: "12px",
              marginTop: "16px",
            }}
          >
            <div className="store-filter-bar" id="prs-status-filters" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                className={`store-filter-chip ${activeStatus === "all" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveStatus("all")}
              >
                Todas ({countAll})
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "open" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveStatus("open")}
              >
                Em Aberto / Revisão ({countOpen})
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "merged" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveStatus("merged")}
              >
                Publicadas ({countMerged})
              </button>
              <button
                className={`store-filter-chip ${activeStatus === "closed" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveStatus("closed")}
              >
                Arquivadas ({countClosed})
              </button>
            </div>

            <div className="store-search-box" style={{ minWidth: "260px" }}>
              <input
                type="text"
                id="prs-search-input"
                placeholder="Buscar revisões ou autores..."
                spellCheck="false"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-surface)",
                  color: "var(--text-main)",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>
        </div>

        {/* Revisions List */}
        <div
          id="prs-full-list"
          className="prs-full-grid"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {isLoading ? (
            <div
              className="loading-state"
              style={{ padding: "40px", textAlign: "center" }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  animation: "spin 1s linear infinite",
                  fontSize: "30px",
                  color: "var(--primary)",
                }}
              >
                progress_activity
              </span>
              <div style={{ marginTop: "10px", fontSize: "14px", color: "var(--text-muted)" }}>
                Carregando histórico de revisões de {repoName}...
              </div>
            </div>
          ) : filteredPRs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "var(--text-muted)",
                border: "1px dashed var(--border-color)",
                borderRadius: "10px",
                background: "var(--bg-surface)",
              }}
            >
              <span
                className="material-symbols-outlined icon-lg"
                style={{
                  color: "var(--text-dim)",
                  marginBottom: "10px",
                  fontSize: "40px",
                }}
              >
                inbox
              </span>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "var(--text-heading)",
                }}
              >
                Nenhuma Revisão Encontrada em "{repoName}"
              </div>
              <p
                style={{
                  fontSize: "13px",
                  margin: "8px auto 0 auto",
                  maxWidth: "460px",
                  lineHeight: "1.5",
                  color: "var(--text-muted)",
                }}
              >
                As revisões e propostas são geradas automaticamente conforme os documentos e especificações são editados e versionados.
              </p>
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

              const statusBadgeText =
                isDirectCommit || isMerged
                  ? "VERSÃO PUBLICADA"
                  : isClosed
                    ? "ARQUIVADA"
                    : "EM REVISÃO";

              const revisionId = pr.short_id || (pr.commit_hash ? pr.commit_hash.slice(0, 7) : pr.id);

              return (
                <div
                  key={pr.id}
                  className="pr-card"
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "10px",
                    padding: "18px",
                    background: "var(--bg-surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  {/* Top Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: isDirectCommit || isMerged
                            ? "var(--primary, #3b82f6)"
                            : isClosed
                              ? "var(--danger, #ef4444)"
                              : "var(--success, #16a34a)",
                          fontSize: "26px",
                          marginTop: "2px",
                        }}
                      >
                        {isDirectCommit || isMerged
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
                              fontSize: "16px",
                              color: "var(--text-heading)",
                              fontWeight: 600,
                            }}
                          >
                            Revisão #{revisionId}: {pr.title}
                          </strong>
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
                              title="Sincronizado remotamente"
                            >
                              GitHub #{pr.github_number}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "12.5px",
                            color: "var(--text-muted)",
                            marginTop: "4px",
                          }}
                        >
                          Autor: <strong>{pr.author}</strong> &bull; Data: {pr.created_at}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className={`pill-dot ${isMerged || isDirectCommit ? "info" : isClosed ? "danger" : "success"}`}
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: "12px",
                        }}
                      >
                        <span className="dot"></span> {statusBadgeText}
                      </span>
                    </div>
                  </div>

                  {/* PR Description */}
                  {pr.description && (
                    <div
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "var(--text-normal)",
                        lineHeight: "1.5",
                        background: "var(--bg-surface-secondary, #f8fafc)",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-light, #e2e8f0)",
                      }}
                    >
                      {pr.description}
                    </div>
                  )}

                  {/* Approvals Section (Quem Aprovou) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      fontSize: "12.5px",
                      background: "var(--bg-surface-tertiary, #f1f5f9)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-heading)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px", color: "var(--primary)" }}
                      >
                        verified_user
                      </span>
                      Aprovações:
                    </span>

                    {approvals.length > 0 ? (
                      approvals.map((app, idx) => (
                        <span
                          key={idx}
                          className="badge badge-success"
                          style={{
                            fontSize: "11.5px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "13px" }}
                          >
                            check_circle
                          </span>
                          Aprovado por: <strong>{app}</strong>
                        </span>
                      ))
                    ) : isMerged || isDirectCommit ? (
                      <span
                        className="badge badge-success"
                        style={{
                          fontSize: "11.5px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "13px" }}
                        >
                          verified
                        </span>
                        Aprovado e publicado na versão oficial
                      </span>
                    ) : (
                      <span
                        className="badge badge-neutral"
                        style={{
                          fontSize: "11.5px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "13px" }}
                        >
                          hourglass_top
                        </span>
                        Aguardando aprovação de revisor
                      </span>
                    )}
                  </div>

                  {/* Feedback Message */}
                  {actionFeedback && actionFeedback.id === pr.id && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        fontSize: "13px",
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

                  {/* Files & Diffs Accordion */}
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
                          gap: "6px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "var(--text-main)",
                          padding: "4px 8px",
                        }}
                      >
                        <span className="material-symbols-outlined icon-xs">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                        {isExpanded
                          ? "Ocultar alterações dos documentos"
                          : `Visualizar ${prFiles.length} documento(s) alterados`}
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
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
                                  borderRadius: "8px",
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
                                        padding: "2px 8px",
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
                                      Visualização Formatada
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
                                        padding: "2px 8px",
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
                                      Código (Diff)
                                    </button>
                                  </div>
                                </div>

                                {isLoadingDiff ? (
                                  <div
                                    style={{
                                      padding: "14px",
                                      textAlign: "center",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Carregando diferenças da versão...
                                  </div>
                                ) : isVisual &&
                                  (f.old_content || f.new_content) ? (
                                  <div
                                    style={{
                                      maxHeight: "380px",
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
                                        padding: "10px 12px",
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
                      paddingTop: "12px",
                      flexWrap: "wrap",
                      gap: "10px",
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
                          Ver no GitHub
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
                          Versão Canônica Registrada
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {/* Rollback button on Merged/Published versions */}
                      {(isMerged || isDirectCommit) && (
                        <button
                          className="btn btn-secondary btn-xs"
                          type="button"
                          onClick={() => setRollbackTarget(pr)}
                          disabled={actionLoading?.id === pr.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "var(--text-main)",
                          }}
                          title="Restaurar o estado desta revisão como a versão ativa atual (Rollback seguro)"
                        >
                          <span className="material-symbols-outlined icon-xs">
                            history
                          </span>
                          Restaurar esta Versão (Rollback)
                        </button>
                      )}

                      {/* Open PR actions: Reject, Approve, Merge */}
                      {isOpen && (
                        <>
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
                            title="Rejeitar e arquivar esta proposta"
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
                            title="Registrar aprovação nesta revisão"
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
                              : `Aprovar Revisão ${approvals.length > 0 ? `(${approvals.length})` : ""}`}
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
                            title="Publicar alterações e integrar na versão ativa"
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
                              ? "Publicando..."
                              : "Publicar Versão Oficial"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackTarget && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !actionLoading && setRollbackTarget(null)}
        >
          <div
            className="modal-container"
            style={{
              background: "var(--bg-surface, #ffffff)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "28px",
                  color: "var(--primary, #3b82f6)",
                }}
              >
                history
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "var(--text-heading)",
                  fontWeight: 700,
                }}
              >
                Restaurar Versão (Rollback Seguro)
              </h3>
            </div>

            <p
              style={{
                fontSize: "14px",
                color: "var(--text-normal)",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              Você está prestes a restaurar o projeto para o estado da revisão:
              <br />
              <strong style={{ color: "var(--text-heading)", display: "block", marginTop: "6px" }}>
                #{rollbackTarget.short_id || rollbackTarget.id} &bull; {rollbackTarget.title}
              </strong>
            </p>

            <div
              style={{
                background: "var(--bg-surface-secondary, #f8fafc)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "var(--text-muted)",
                lineHeight: "1.5",
                marginBottom: "20px",
              }}
            >
              <strong style={{ color: "var(--text-heading)" }}>
                💡 Como funciona a restauração segura:
              </strong>
              <div style={{ marginTop: "4px" }}>
                O estado desta versão será promovido como a nova versão ativa. <strong>Todo o histórico de revisões anteriores é preservado integralmente</strong>, permitindo avançar ou recuar no tempo com total segurança.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRollbackTarget(null)}
                disabled={actionLoading?.action === "rollback"}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRollback}
                disabled={actionLoading?.action === "rollback"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {actionLoading?.action === "rollback" ? (
                  <>
                    <span
                      className="material-symbols-outlined icon-xs"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      progress_activity
                    </span>
                    Restaurando Versão...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined icon-xs">
                      restore
                    </span>
                    Confirmar Restauração
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

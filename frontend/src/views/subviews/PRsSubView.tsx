import { FolderGit2, GitPullRequest, RefreshCw } from "lucide-react";
import { marked } from "marked";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VisualMarkdownDiff } from "../../components/editor/VisualMarkdownDiff";
import {
  Badge,
  Button,
  Card,
  FilterChips,
  PageBody,
  PageContainer,
  PageHeader,
  Row,
  SearchInput,
} from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import type { PR } from "../../types";

interface PRsSubViewProps {
  onOpenDiffModal?: () => void;
}

const formatPRDate = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

const renderMarkdownDescription = (text: string) => {
  try {
    const html = marked.parse(text, { breaks: true, gfm: true }) as string;
    return (
      <div
        className="ui-markdown-rendered-desc"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return (
      <div
        className="ui-markdown-rendered-desc"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {text}
      </div>
    );
  }
};

export const PRsSubView: React.FC<PRsSubViewProps> = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    activeRepo,
    refreshGitStatus,
    refreshPendingChanges,
    createOrSwitchBranch,
    projectConfig,
  } = useWorkspace();
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

  // Approval modal state
  const [approvalModalPR, setApprovalModalPR] = useState<PR | null>(null);
  const [approvalRole, setApprovalRole] = useState("Tech Lead");
  const [approvalComment, setApprovalComment] = useState("");

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

  const handleOpenApproveModal = (pr: PR) => {
    setApprovalModalPR(pr);
    setApprovalComment("");
    setApprovalRole("Tech Lead");
  };

  const handleApproveSubmit = async () => {
    if (!approvalModalPR) return;
    const id = approvalModalPR.id;
    setActionLoading({ id, action: "approve" });
    setActionFeedback(null);
    try {
      const res = await API.approvePR(id, {
        approver: user?.login ? `@${user.login}` : undefined,
        role: approvalRole,
        comment: approvalComment,
      });
      if (res.ok) {
        setActionFeedback({
          id,
          message: res.data?.message || "Aprovação registrada com sucesso!",
          type: "success",
        });
        setApprovalModalPR(null);
        setApprovalComment("");
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

  const handleEditDocumentInPR = async (pr: PR, filePath: string) => {
    if (pr.branch) {
      try {
        await createOrSwitchBranch(pr.branch);
      } catch (e) {
        console.warn("[PRsSubView] Aviso ao alternar para branch do PR:", e);
      }
    }
    navigate(
      `/repo/${encodeURIComponent(repoName)}/editor?file=${encodeURIComponent(filePath)}`,
    );
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
            res.data?.message || "Versão publicada e integrada com sucesso!",
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
    const reason = window.prompt("Informe o motivo da rejeição (opcional):");
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
            `Versão #${target.short_id || target.id} restaurada como a versão atual!`,
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
    <PageContainer id="subview-prs">
      {/* Header Toolbar */}
      <PageHeader
        title="Revisões & Versões"
        subtitle={
          <Row gap="xs" align="center" style={{ marginTop: "2px" }}>
            <Badge variant="primary" size="sm">
              <FolderGit2 size={12} style={{ marginRight: 3 }} />
              Repositório: <strong>{repoName}</strong>
            </Badge>
            <span className="ui-text-muted" style={{ fontSize: "12.5px" }}>
              Acompanhe aprovações, revisões ativas e histórico com restauração
              segura.
            </span>
          </Row>
        }
        icon={
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "var(--md-sys-color-primary-container, #e8f0fe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--md-sys-color-primary, #1a73e8)",
            }}
          >
            <GitPullRequest size={22} />
          </div>
        }
        actions={
          <Row gap="xs">
            <Button
              id="btn-toggle-all-prs"
              variant="ghost"
              size="sm"
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  {filteredPRs.length > 0 &&
                  filteredPRs.every((p) => !!expandedPRs[p.id])
                    ? "unfold_less"
                    : "unfold_more"}
                </span>
              }
              onClick={() => {
                const areAllExpanded =
                  filteredPRs.length > 0 &&
                  filteredPRs.every((p) => !!expandedPRs[p.id]);
                const nextState = !areAllExpanded;
                const nextMap: Record<number | string, boolean> = {};
                filteredPRs.forEach((p) => {
                  nextMap[p.id] = nextState;
                });
                setExpandedPRs(nextMap);
              }}
              title="Expandir ou recolher todas as revisões da lista"
            >
              {filteredPRs.length > 0 &&
              filteredPRs.every((p) => !!expandedPRs[p.id])
                ? "Recolher Todos"
                : "Expandir Todos"}
            </Button>

            <Button
              id="btn-refresh-prs"
              variant="secondary"
              size="sm"
              title={`Recarregar revisões de ${repoName}`}
              icon={<RefreshCw size={14} />}
              onClick={() => loadPRs()}
            >
              Atualizar
            </Button>
          </Row>
        }
      >
        {/* Filter Bar & Search */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            width: "100%",
          }}
        >
          <FilterChips
            items={[
              { id: "all", label: "Todas", count: countAll },
              { id: "open", label: "Em Aberto / Revisão", count: countOpen },
              { id: "merged", label: "Publicadas", count: countMerged },
              { id: "closed", label: "Arquivadas", count: countClosed },
            ]}
            activeId={activeStatus}
            onChange={(status) => setActiveStatus(status as any)}
            size="sm"
          />

          <div style={{ width: 280 }}>
            <SearchInput
              id="prs-search-input"
              placeholder="Buscar revisões ou autores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
            />
          </div>
        </div>
      </PageHeader>

      {/* Revisions List */}
      <PageBody>
        <div
          style={{
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {isLoading ? (
            <div className="ui-empty-state" style={{ padding: "40px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  animation: "spin 1s linear infinite",
                  fontSize: "30px",
                  color: "var(--md-sys-color-primary, #1a73e8)",
                }}
              >
                progress_activity
              </span>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "14px",
                  color: "var(--md-sys-color-on-surface-variant)",
                }}
              >
                Carregando histórico de revisões de {repoName}...
              </div>
            </div>
          ) : filteredPRs.length === 0 ? (
            <Card
              variant="elevated"
              style={{ padding: "48px 24px", textAlign: "center" }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  color: "var(--md-sys-color-outline)",
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
                  color: "var(--color-text-primary, #0f172a)",
                }}
              >
                Nenhuma Revisão Encontrada em "{repoName}"
              </div>
              <p
                className="ui-text-muted"
                style={{
                  fontSize: "13px",
                  margin: "8px auto 0 auto",
                  maxWidth: "460px",
                  lineHeight: "1.5",
                }}
              >
                As revisões e propostas são geradas automaticamente conforme os
                documentos e especificações são editados e versionados.
              </p>
            </Card>
          ) : (
            filteredPRs.map((pr) => {
              const statusLower = (pr.status || "").toLowerCase();
              const isMerged = statusLower === "merged";
              const isClosed = statusLower === "closed";
              const isOpen = !isMerged && !isClosed;
              const isExpanded = !!expandedPRs[pr.id];
              const prFiles = Array.isArray(pr.files) ? pr.files : [];
              const isDirectCommit = !!pr.is_direct_commit;

              const statusBadgeText =
                isDirectCommit || isMerged
                  ? "VERSÃO PUBLICADA"
                  : isClosed
                    ? "ARQUIVADA"
                    : "EM REVISÃO";

              const revisionId =
                pr.short_id ||
                (pr.commit_hash ? pr.commit_hash.slice(0, 7) : pr.id);

              const currentUserHandle = user?.login
                ? `@${user.login}`
                : "@tech-lead";
              const isAuthor =
                (pr.author || "").replace(/^@/, "").toLowerCase() ===
                currentUserHandle.replace(/^@/, "").toLowerCase();
              const isSolo =
                pr.is_solo_mode !== undefined
                  ? pr.is_solo_mode
                  : (projectConfig?.governance_rules?.is_solo ?? true);
              const minApprovals = isSolo
                ? 1
                : pr.min_approvals ||
                  (projectConfig?.governance_rules?.min_approvals_default ?? 1);
              const approvalsList = Array.isArray(pr.approvals)
                ? pr.approvals
                : [];
              const validApprovals = approvalsList.filter((app: any) => {
                const u = typeof app === "string" ? app : app.user;
                return (
                  isSolo ||
                  (u || "").replace(/^@/, "").toLowerCase() !==
                    (pr.author || "").replace(/^@/, "").toLowerCase()
                );
              });
              const hasCurrentUserApproved = approvalsList.some((app: any) => {
                const u = typeof app === "string" ? app : app.user;
                return (
                  (u || "").replace(/^@/, "").toLowerCase() ===
                  currentUserHandle.replace(/^@/, "").toLowerCase()
                );
              });
              const quorumMet = isSolo
                ? approvalsList.length >= 1
                : validApprovals.length >= minApprovals;

              return (
                <Card
                  key={pr.id}
                  variant="elevated"
                  padding="none"
                  style={{
                    overflow: "hidden",
                    border: isExpanded
                      ? "1px solid var(--md-sys-color-primary, #3b82f6)"
                      : "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  {/* Collapsed / Summary Header (Always Visible & Interactive) */}
                  <div
                    onClick={() => toggleExpand(pr.id, pr)}
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                      cursor: "pointer",
                      userSelect: "none",
                      background: isExpanded
                        ? "var(--md-sys-color-surface-container-low, #f8f9fa)"
                        : "transparent",
                      borderBottom: isExpanded
                        ? "1px solid var(--md-sys-color-outline-variant, #dadce0)"
                        : "none",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {/* Status Icon */}
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            isDirectCommit || isMerged
                              ? "var(--color-primary-subtle, #e0f2fe)"
                              : isClosed
                                ? "var(--color-danger-subtle, #fef2f2)"
                                : "var(--color-success-subtle, #f0fdf4)",
                          color:
                            isDirectCommit || isMerged
                              ? "var(--md-sys-color-primary, #0284c7)"
                              : isClosed
                                ? "var(--color-danger, #ef4444)"
                                : "var(--color-success, #16a34a)",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "22px" }}
                        >
                          {isDirectCommit || isMerged
                            ? "check_circle"
                            : isClosed
                              ? "cancel"
                              : "rate_review"}
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <div style={{ minWidth: 0, flex: 1 }}>
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
                              fontSize: "15px",
                              fontWeight: 600,
                              color: "var(--color-text-primary, #0f172a)",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            Revisão #{revisionId}: {pr.title}
                          </span>
                          {pr.github_number && (
                            <Badge
                              variant="neutral"
                              size="sm"
                              title="Sincronizado com GitHub"
                            >
                              GitHub #{pr.github_number}
                            </Badge>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginTop: "4px",
                            fontSize: "12.5px",
                            color:
                              "var(--md-sys-color-on-surface-variant, #64748b)",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>
                            Autor:{" "}
                            <strong
                              style={{
                                color:
                                  "var(--md-sys-color-on-surface, #0f172a)",
                              }}
                            >
                              {pr.author || "Equipe"}
                            </strong>
                          </span>
                          <span>&bull;</span>
                          <span>{formatPRDate(pr.created_at)}</span>
                          <span>&bull;</span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px" }}
                            >
                              description
                            </span>
                            {prFiles.length}{" "}
                            {prFiles.length === 1 ? "arquivo" : "arquivos"}
                          </span>

                          {/* Quorum indicator only for active/open reviews */}
                          {isOpen && (
                            <>
                              <span>&bull;</span>
                              <Badge
                                variant={quorumMet ? "success" : "warning"}
                                size="sm"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: "13px",
                                    marginRight: "3px",
                                  }}
                                >
                                  {quorumMet ? "verified" : "pending_actions"}
                                </span>
                                {quorumMet
                                  ? `Quórum Atingido (${validApprovals.length}/${minApprovals})`
                                  : `Aprovações (${validApprovals.length}/${minApprovals})`}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Status Badge & Chevron / Details Button */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexShrink: 0,
                      }}
                    >
                      <Badge
                        variant={
                          isMerged || isDirectCommit
                            ? "info"
                            : isClosed
                              ? "danger"
                              : "success"
                        }
                        size="md"
                      >
                        {statusBadgeText}
                      </Badge>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(pr.id, pr);
                        }}
                        icon={
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "18px",
                              transition: "transform 0.2s ease",
                              transform: isExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            }}
                          >
                            expand_more
                          </span>
                        }
                      >
                        {isExpanded ? "Recolher" : "Detalhes"}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details Body */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {/* PR Description with Rich Markdown Rendering */}
                      {pr.description && (
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--color-text-secondary, #475569)",
                              marginBottom: "6px",
                            }}
                          >
                            Descrição da Proposta:
                          </div>
                          <div
                            style={{
                              background:
                                "var(--md-sys-color-surface-container-low, #f8f9fa)",
                              padding: "14px 16px",
                              borderRadius: "10px",
                              border:
                                "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                            }}
                          >
                            {renderMarkdownDescription(pr.description)}
                          </div>
                        </div>
                      )}

                      {/* Quorum & Approvals Section */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          background:
                            "var(--md-sys-color-surface-container-lowest, #f8f9fa)",
                          padding: "12px 14px",
                          borderRadius: "8px",
                          border:
                            "1px solid var(--md-sys-color-outline-variant, #e8eaed)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              color: "var(--md-sys-color-on-surface, #0f172a)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "13px",
                            }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "17px",
                                color: "var(--md-sys-color-primary, #1a73e8)",
                              }}
                            >
                              verified_user
                            </span>
                            Trilha de Auditoria & Pareceres:
                          </span>

                          {isOpen && (
                            <Badge
                              variant={quorumMet ? "success" : "warning"}
                              size="sm"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", marginRight: "3px" }}
                              >
                                {quorumMet ? "verified" : "pending_actions"}
                              </span>
                              {quorumMet
                                ? `✓ Quórum Atingido (${validApprovals.length}/${minApprovals}) • Liberado para Publicação`
                                : `Quórum Pendente (${validApprovals.length}/${minApprovals} aprovações necessárias)`}
                            </Badge>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {approvalsList.length > 0 ? (
                            approvalsList.map((app: any, idx: number) => {
                              const appUser =
                                typeof app === "string" ? app : app.user;
                              const appRole =
                                typeof app === "object" ? app.role : null;
                              const appHash =
                                typeof app === "object" && app.commit_hash
                                  ? app.commit_hash.slice(0, 7)
                                  : null;
                              const appDate =
                                typeof app === "object" && app.timestamp
                                  ? formatPRDate(app.timestamp)
                                  : null;
                              const appComment =
                                typeof app === "object" ? app.comment : null;

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    background:
                                      "var(--color-success-subtle, #f0fdf4)",
                                    border:
                                      "1px solid var(--color-border-subtle, #bbf7d0)",
                                    color: "var(--color-success, #166534)",
                                    fontSize: "12px",
                                  }}
                                  title={
                                    appComment
                                      ? `Comentário de Auditoria: "${appComment}"`
                                      : undefined
                                  }
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize: "15px",
                                      color: "var(--color-success, #16a34a)",
                                    }}
                                  >
                                    check_circle
                                  </span>
                                  <strong>{appUser}</strong>
                                  {appRole && (
                                    <span
                                      style={{
                                        opacity: 0.85,
                                        fontSize: "11px",
                                      }}
                                    >
                                      ({appRole})
                                    </span>
                                  )}
                                  {appHash && (
                                    <span
                                      style={{
                                        fontFamily: "var(--font-family-mono)",
                                        fontSize: "10.5px",
                                        background: "rgba(0,0,0,0.06)",
                                        padding: "1px 4px",
                                        borderRadius: "3px",
                                      }}
                                    >
                                      #{appHash}
                                    </span>
                                  )}
                                  {appDate && (
                                    <span
                                      style={{
                                        opacity: 0.7,
                                        fontSize: "10.5px",
                                      }}
                                    >
                                      &bull; {appDate}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : isMerged || isDirectCommit ? (
                            <Badge variant="success" size="sm">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", marginRight: "3px" }}
                              >
                                verified
                              </span>
                              Aprovado e integrado na versão oficial
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px", marginRight: "3px" }}
                              >
                                hourglass_top
                              </span>
                              Aguardando aprovação de revisores (0/
                              {minApprovals})
                            </Badge>
                          )}
                        </div>
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
                                ? "var(--color-success-subtle, #f0fdf4)"
                                : "var(--color-danger-subtle, #fef2f2)",
                            color:
                              actionFeedback.type === "success"
                                ? "var(--color-success, #166534)"
                                : "var(--color-danger, #991b1b)",
                            border: `1px solid ${actionFeedback.type === "success" ? "var(--color-border-subtle, #bbf7d0)" : "var(--color-border-subtle, #fecaca)"}`,
                          }}
                        >
                          {actionFeedback.message}
                        </div>
                      )}

                      {/* Files & Diffs */}
                      {prFiles.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--color-text-primary, #0f172a)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "16px",
                                color: "var(--md-sys-color-primary, #1a73e8)",
                              }}
                            >
                              difference
                            </span>
                            Documentos Alterados ({prFiles.length}):
                          </div>

                          <div
                            style={{
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
                                <Card
                                  key={fIdx}
                                  variant="flat"
                                  style={{
                                    padding: 0,
                                    overflow: "hidden",
                                    border:
                                      "1px solid var(--color-border-subtle, #e2e8f0)",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: "8px 12px",
                                      background:
                                        "var(--color-surface-subtle, #f8fafc)",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontFamily: "var(--font-family-mono)",
                                      flexWrap: "wrap",
                                      gap: "8px",
                                    }}
                                  >
                                    <div className="ui-row ui-row--align-center ui-row--xs">
                                      <span
                                        className="material-symbols-outlined icon-xs"
                                        style={{
                                          color:
                                            "var(--md-sys-color-primary, #1a73e8)",
                                        }}
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
                                                "var(--color-danger, #dc2626)",
                                              fontWeight: 600,
                                            }}
                                          >
                                            -{f.deletions || 0}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    <div className="ui-row ui-row--align-center ui-row--xs">
                                      {isOpen && (
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant="tonal"
                                          onClick={() =>
                                            handleEditDocumentInPR(pr, f.path)
                                          }
                                          title={`Abrir e editar "${f.path}" diretamente na branch deste PR (${pr.branch})`}
                                          icon={
                                            <span
                                              className="material-symbols-outlined"
                                              style={{ fontSize: "14px" }}
                                            >
                                              edit_note
                                            </span>
                                          }
                                        >
                                          Editar Documento
                                        </Button>
                                      )}

                                      <div
                                        className="ui-btn-group"
                                        style={{
                                          background:
                                            "var(--color-border-subtle, #e2e8f0)",
                                          padding: "2px",
                                          borderRadius: "6px",
                                        }}
                                      >
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant={
                                            isVisual ? "secondary" : "ghost"
                                          }
                                          onClick={() =>
                                            setPrViewModes((prev) => ({
                                              ...prev,
                                              [fileKey]: "visual",
                                            }))
                                          }
                                        >
                                          Visualização Formatada
                                        </Button>
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant={
                                            !isVisual ? "secondary" : "ghost"
                                          }
                                          onClick={() =>
                                            setPrViewModes((prev) => ({
                                              ...prev,
                                              [fileKey]: "raw",
                                            }))
                                          }
                                        >
                                          Modo RAW (Diff)
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {isLoadingDiff ? (
                                    <div
                                      style={{
                                        padding: "14px",
                                        textAlign: "center",
                                        color: "var(--color-text-muted)",
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
                                          fontFamily: "var(--font-family-mono)",
                                        }}
                                      >
                                        {fileDiff}
                                      </pre>
                                    )
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions Footer */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderTop:
                            "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                          paddingTop: "14px",
                          marginTop: "4px",
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
                                fontSize: "12.5px",
                                fontWeight: 500,
                                color: "var(--md-sys-color-primary, #1a73e8)",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              Ver no GitHub
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px" }}
                              >
                                open_in_new
                              </span>
                            </a>
                          ) : (
                            <span
                              className="ui-text-muted"
                              style={{ fontSize: "12.5px" }}
                            >
                              Versão Canônica Registrada
                            </span>
                          )}
                        </div>

                        <div className="ui-row ui-row--align-center ui-row--xs">
                          {/* Rollback button on Merged/Published versions */}
                          {(isMerged || isDirectCommit) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setRollbackTarget(pr)}
                              disabled={actionLoading?.id === pr.id}
                              icon={
                                <span className="material-symbols-outlined icon-xs">
                                  history
                                </span>
                              }
                              title="Restaurar o estado desta revisão como a versão ativa atual"
                            >
                              Restaurar esta Versão (Rollback)
                            </Button>
                          )}

                          {/* Open PR actions */}
                          {isOpen && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                style={{
                                  color: "var(--color-danger, #ef4444)",
                                }}
                                onClick={() => handleReject(pr.id)}
                                disabled={actionLoading?.id === pr.id}
                                icon={
                                  <span className="material-symbols-outlined icon-xs">
                                    {actionLoading?.id === pr.id &&
                                    actionLoading.action === "reject"
                                      ? "progress_activity"
                                      : "close"}
                                  </span>
                                }
                                title="Rejeitar e arquivar esta proposta"
                              >
                                {actionLoading?.id === pr.id &&
                                actionLoading.action === "reject"
                                  ? "Rejeitando..."
                                  : "Rejeitar"}
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenApproveModal(pr)}
                                disabled={
                                  actionLoading?.id === pr.id ||
                                  (!isSolo && isAuthor)
                                }
                                icon={
                                  <span className="material-symbols-outlined icon-xs">
                                    {actionLoading?.id === pr.id &&
                                    actionLoading.action === "approve"
                                      ? "progress_activity"
                                      : hasCurrentUserApproved
                                        ? "verified"
                                        : "thumb_up"}
                                  </span>
                                }
                                title={
                                  !isSolo && isAuthor
                                    ? "O autor da proposta não pode aprovar o seu próprio PR no Modo Equipe."
                                    : hasCurrentUserApproved
                                      ? "Você já registrou aprovação nesta proposta. Clique para atualizar seu comentário ou papel."
                                      : isSolo
                                        ? "Registrar aprovação nesta revisão (Modo Solo ativo)"
                                        : "Registrar parecer e aprovação oficial nesta revisão"
                                }
                              >
                                {actionLoading?.id === pr.id &&
                                actionLoading.action === "approve"
                                  ? "Aprovando..."
                                  : hasCurrentUserApproved
                                    ? `✓ Aprovado por você (${validApprovals.length}/${minApprovals})`
                                    : `Aprovar Revisão (${validApprovals.length}/${minApprovals})`}
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleMerge(pr.id)}
                                disabled={
                                  actionLoading?.id === pr.id || !quorumMet
                                }
                                icon={
                                  <span className="material-symbols-outlined icon-xs">
                                    {actionLoading?.id === pr.id &&
                                    actionLoading.action === "merge"
                                      ? "progress_activity"
                                      : "publish"}
                                  </span>
                                }
                                title={
                                  !quorumMet
                                    ? isSolo
                                      ? "Aprovação pendente: registre a aprovação antes de publicar a versão."
                                      : `Quórum pendente: requer pelo menos ${minApprovals} aprovações válidas de revisores independentes antes de realizar o merge (atual: ${validApprovals.length}).`
                                    : "Quórum atingido! Integrar e publicar alterações na versão oficial."
                                }
                              >
                                {actionLoading?.id === pr.id &&
                                actionLoading.action === "merge"
                                  ? "Publicando..."
                                  : quorumMet
                                    ? "Publicar Versão Oficial"
                                    : `Publicar (${validApprovals.length}/${minApprovals})`}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </PageBody>

      {/* Approval Modal with Audit Metadata */}
      {approvalModalPR && (
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
          onClick={() => !actionLoading && setApprovalModalPR(null)}
        >
          <div
            className="modal-container"
            style={{
              background: "var(--color-surface, #ffffff)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--color-border-subtle, #e2e8f0)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "var(--color-success-subtle, #f0fdf4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-success, #16a34a)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px" }}
                >
                  verified_user
                </span>
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--color-text-primary, #0f172a)",
                  }}
                >
                  Aprovar Proposta de Revisão #
                  {approvalModalPR.short_id || approvalModalPR.id}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--color-text-muted, #64748b)",
                  }}
                >
                  {approvalModalPR.title} &bull; Autor: {approvalModalPR.author}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginTop: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--color-text-primary, #0f172a)",
                    marginBottom: "6px",
                  }}
                >
                  Papel / Cargo do Revisor:
                </label>
                <select
                  value={approvalRole}
                  onChange={(e) => setApprovalRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-subtle, #cbd5e1)",
                    fontSize: "13px",
                    background: "var(--color-surface, #ffffff)",
                    color: "var(--color-text-primary, #0f172a)",
                  }}
                >
                  <option value="Tech Lead">Tech Lead</option>
                  <option value="Arquiteto de Software">
                    Arquiteto de Software
                  </option>
                  <option value="Engenheiro Revisor">Engenheiro Revisor</option>
                  <option value="Product Owner / Domain Lead">
                    Product Owner / Domain Lead
                  </option>
                  <option value="Security / Compliance Auditor">
                    Security / Compliance Auditor
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--color-text-primary, #0f172a)",
                    marginBottom: "6px",
                  }}
                >
                  Parecer / Comentário de Auditoria (Opcional):
                </label>
                <textarea
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Ex: Revisado e aprovado em conformidade com as diretrizes e padrões de arquitetura."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-subtle, #cbd5e1)",
                    fontSize: "13px",
                    resize: "vertical",
                    fontFamily: "inherit",
                    color: "var(--color-text-primary, #0f172a)",
                    background: "var(--color-surface, #ffffff)",
                  }}
                />
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  background:
                    "var(--md-sys-color-surface-container-lowest, #f8f9fa)",
                  border: "1px solid var(--color-border-subtle, #e2e8f0)",
                  fontSize: "12px",
                  color: "var(--color-text-muted, #64748b)",
                  lineHeight: "1.5",
                }}
              >
                🔒 <strong>Registro Imutável:</strong> Sua aprovação será
                carimbada com o usuário{" "}
                <strong>{user?.login ? `@${user.login}` : "@tech-lead"}</strong>
                , data/hora e o hash da revisão atual para conformidade e
                rastreabilidade no Git.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setApprovalModalPR(null)}
                disabled={actionLoading?.id === approvalModalPR.id}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveSubmit}
                disabled={actionLoading?.id === approvalModalPR.id}
                icon={
                  <span className="material-symbols-outlined icon-xs">
                    {actionLoading?.id === approvalModalPR.id
                      ? "progress_activity"
                      : "verified"}
                  </span>
                }
              >
                {actionLoading?.id === approvalModalPR.id
                  ? "Registrando Aprovação..."
                  : "Confirmar Aprovação"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
              background: "var(--color-surface, #ffffff)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--color-border-subtle, #e2e8f0)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="ui-row ui-row--align-center ui-row--sm"
              style={{ marginBottom: "16px" }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "28px",
                  color: "var(--color-primary, #3b82f6)",
                }}
              >
                history
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "var(--color-text-primary, #0f172a)",
                  fontWeight: 700,
                }}
              >
                Restaurar Versão (Rollback Seguro)
              </h3>
            </div>

            <p
              style={{
                fontSize: "14px",
                color: "var(--color-text-secondary, #334155)",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              Você está prestes a restaurar o projeto para o estado da revisão:
              <br />
              <strong
                style={{
                  color: "var(--color-text-primary, #0f172a)",
                  display: "block",
                  marginTop: "6px",
                }}
              >
                #{rollbackTarget.short_id || rollbackTarget.id} &bull;{" "}
                {rollbackTarget.title}
              </strong>
            </p>

            <div
              style={{
                background: "var(--color-surface-subtle, #f8fafc)",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "var(--color-text-muted, #64748b)",
                lineHeight: "1.5",
                marginBottom: "20px",
              }}
            >
              <strong style={{ color: "var(--color-text-primary, #0f172a)" }}>
                💡 Como funciona a restauração segura:
              </strong>
              <div style={{ marginTop: "4px" }}>
                O estado desta versão será promovido como a nova versão ativa.{" "}
                <strong>
                  Todo o histórico de revisões anteriores é preservado
                  integralmente
                </strong>
                .
              </div>
            </div>

            <div
              className="ui-row ui-row--align-center ui-row--sm"
              style={{ justifyContent: "flex-end" }}
            >
              <Button
                variant="secondary"
                onClick={() => setRollbackTarget(null)}
                disabled={actionLoading?.action === "rollback"}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleRollback}
                disabled={actionLoading?.action === "rollback"}
                isLoading={actionLoading?.action === "rollback"}
                icon={
                  <span className="material-symbols-outlined icon-xs">
                    restore
                  </span>
                }
              >
                Confirmar Restauração
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

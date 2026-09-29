import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { PR } from "../../types";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { VisualMarkdownDiff } from "../../components/editor/VisualMarkdownDiff";
import {
  Button,
  Badge,
  Card,
  SearchInput,
  FilterChips,
  PageContainer,
  PageHeader,
  PageBody,
  Row,
} from "../../components/ui";
import {
  GitPullRequest,
  RefreshCw,
  FolderGit2,
} from "lucide-react";
import { marked } from "marked";

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
    return <div className="ui-markdown-rendered-desc" style={{ whiteSpace: "pre-wrap" }}>{text}</div>;
  }
};

export const PRsSubView: React.FC<PRsSubViewProps> = () => {
  const { activeRepo, refreshGitStatus, refreshPendingChanges } = useWorkspace();
  const repoName = activeRepo?.name || "local";

  const [prs, setPrs] = useState<PR[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<
    "all" | "open" | "merged" | "closed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPRs, setExpandedPRs] = useState<Record<number | string, boolean>>({});
  const [prViewModes, setPrViewModes] = useState<Record<string, "visual" | "raw">>({});
  const [fileDiffsCache, setFileDiffsCache] = useState<Record<string, string>>({});
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
              Acompanhe aprovações, revisões ativas e histórico com restauração segura.
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
        }
      >
        {/* Filter Bar & Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", width: "100%" }}>
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
        <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
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
              <div style={{ marginTop: "10px", fontSize: "14px", color: "var(--md-sys-color-on-surface-variant)" }}>
                Carregando histórico de revisões de {repoName}...
              </div>
            </div>
          ) : filteredPRs.length === 0 ? (
            <Card variant="elevated" style={{ padding: "48px 24px", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-outline)", marginBottom: "10px", fontSize: "40px" }}>
                inbox
              </span>
              <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--color-text-primary, #0f172a)" }}>
                Nenhuma Revisão Encontrada em "{repoName}"
              </div>
              <p className="ui-text-muted" style={{ fontSize: "13px", margin: "8px auto 0 auto", maxWidth: "460px", lineHeight: "1.5" }}>
                As revisões e propostas são geradas automaticamente conforme os documentos e especificações são editados e versionados.
              </p>
            </Card>
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
                <Card key={pr.id} variant="elevated" padding="lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Top Bar */}
                  <div className="ui-row ui-row--between ui-row--align-start" style={{ gap: "12px" }}>
                    <div className="ui-row ui-row--align-start ui-row--md">
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: isDirectCommit || isMerged
                            ? "var(--md-sys-color-primary, #3b82f6)"
                            : isClosed
                              ? "var(--color-danger, #ef4444)"
                              : "var(--color-success, #16a34a)",
                          fontSize: "26px",
                          marginTop: "2px",
                        }}
                      >
                        {isDirectCommit || isMerged ? "check_circle" : isClosed ? "cancel" : "rate_review"}
                      </span>
                      <div>
                        <div className="ui-row ui-row--align-center ui-row--xs" style={{ flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "16px", color: "var(--color-text-primary, #0f172a)", fontWeight: 600 }}>
                            Revisão #{revisionId}: {pr.title}
                          </strong>
                          {pr.github_number && (
                            <Badge variant="neutral" size="sm" title="Sincronizado remotamente">
                              GitHub #{pr.github_number}
                            </Badge>
                          )}
                        </div>
                        <div className="ui-text-muted" style={{ fontSize: "12.5px", marginTop: "4px" }}>
                          Autor: <strong style={{ color: "var(--md-sys-color-on-surface, #0f172a)" }}>{pr.author}</strong> &bull; Data: {formatPRDate(pr.created_at)}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant={isMerged || isDirectCommit ? "info" : isClosed ? "danger" : "success"}
                      size="md"
                    >
                      {statusBadgeText}
                    </Badge>
                  </div>

                  {/* PR Description with Rich Markdown Rendering */}
                  {pr.description && (
                    <div
                      style={{
                        margin: 0,
                        background: "var(--md-sys-color-surface-container-low, #f8f9fa)",
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                      }}
                    >
                      {renderMarkdownDescription(pr.description)}
                    </div>
                  )}

                  {/* Approvals Section */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                      fontSize: "13px",
                      background: "var(--md-sys-color-surface-container-lowest, #f8f9fa)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--md-sys-color-outline-variant, #e8eaed)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--md-sys-color-on-surface, #0f172a)",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "var(--md-sys-color-primary, #1a73e8)" }}>
                        verified_user
                      </span>
                      Aprovações:
                    </span>

                    {approvals.length > 0 ? (
                      approvals.map((app, idx) => (
                        <Badge key={idx} variant="success" size="sm">
                          <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "3px" }}>
                            check_circle
                          </span>
                          Aprovado por: <strong>{app}</strong>
                        </Badge>
                      ))
                    ) : isMerged || isDirectCommit ? (
                      <Badge variant="success" size="sm">
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "3px" }}>
                          verified
                        </span>
                        Aprovado e publicado na versão oficial
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "3px" }}>
                          hourglass_top
                        </span>
                        Aguardando aprovação de revisor
                      </Badge>
                    )}
                  </div>

                  {/* Feedback Message */}
                  {actionFeedback && actionFeedback.id === pr.id && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        fontSize: "13px",
                        background: actionFeedback.type === "success" ? "var(--color-success-subtle, #f0fdf4)" : "var(--color-danger-subtle, #fef2f2)",
                        color: actionFeedback.type === "success" ? "var(--color-success, #166534)" : "var(--color-danger, #991b1b)",
                        border: `1px solid ${actionFeedback.type === "success" ? "var(--color-border-subtle, #bbf7d0)" : "var(--color-border-subtle, #fecaca)"}`,
                      }}
                    >
                      {actionFeedback.message}
                    </div>
                  )}

                  {/* Files & Diffs Accordion */}
                  {prFiles.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--color-border-subtle, #e2e8f0)", paddingTop: "10px" }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(pr.id, pr)}
                        icon={
                          <span className="material-symbols-outlined icon-xs">
                            {isExpanded ? "expand_less" : "expand_more"}
                          </span>
                        }
                      >
                        {isExpanded ? "Ocultar alterações dos documentos" : `Visualizar ${prFiles.length} documento(s) alterados`}
                      </Button>

                      {isExpanded && (
                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          {prFiles.map((f: any, fIdx: number) => {
                            const fileKey = `${pr.id}-${f.path || fIdx}`;
                            const isVisual = prViewModes[fileKey] !== "raw";
                            const fileDiff = f.diff_text || fileDiffsCache[fileKey] || "";
                            const isLoadingDiff = loadingDiffs[fileKey];

                            return (
                              <Card key={fIdx} variant="flat" style={{ padding: 0, overflow: "hidden" }}>
                                <div
                                  style={{
                                    padding: "8px 12px",
                                    background: "var(--color-surface-subtle, #f8fafc)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontFamily: "var(--font-family-mono)",
                                  }}
                                >
                                  <div className="ui-row ui-row--align-center ui-row--xs">
                                    <span className="material-symbols-outlined icon-xs" style={{ color: "var(--md-sys-color-primary, #1a73e8)" }}>
                                      description
                                    </span>
                                    <strong>{f.path}</strong>
                                    {(f.additions > 0 || f.deletions > 0) && (
                                      <>
                                        <span style={{ color: "var(--color-success, #16a34a)", fontWeight: 600 }}>
                                          +{f.additions || 0}
                                        </span>
                                        <span style={{ color: "var(--color-danger, #dc2626)", fontWeight: 600 }}>
                                          -{f.deletions || 0}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div className="ui-btn-group" style={{ background: "var(--color-border-subtle, #e2e8f0)", padding: "2px", borderRadius: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => setPrViewModes((prev) => ({ ...prev, [fileKey]: "visual" }))}
                                      style={{
                                        padding: "2px 8px",
                                        border: "none",
                                        borderRadius: "3px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: isVisual ? "var(--color-surface, #ffffff)" : "transparent",
                                        color: isVisual ? "var(--color-primary, #2563eb)" : "var(--color-text-muted, #64748b)",
                                      }}
                                    >
                                      Visualização Formatada
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPrViewModes((prev) => ({ ...prev, [fileKey]: "raw" }))}
                                      style={{
                                        padding: "2px 8px",
                                        border: "none",
                                        borderRadius: "3px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        background: !isVisual ? "var(--color-surface, #ffffff)" : "transparent",
                                        color: !isVisual ? "var(--color-primary, #2563eb)" : "var(--color-text-muted, #64748b)",
                                      }}
                                    >
                                      Código (Diff)
                                    </button>
                                  </div>
                                </div>

                                {isLoadingDiff ? (
                                  <div style={{ padding: "14px", textAlign: "center", color: "var(--color-text-muted)" }}>
                                    Carregando diferenças da versão...
                                  </div>
                                ) : isVisual && (f.old_content || f.new_content) ? (
                                  <div style={{ maxHeight: "380px", overflowY: "auto" }}>
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
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                      paddingTop: "12px",
                      marginTop: "2px",
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
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            open_in_new
                          </span>
                        </a>
                      ) : (
                        <span className="ui-text-muted" style={{ fontSize: "12.5px" }}>
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
                          icon={<span className="material-symbols-outlined icon-xs">history</span>}
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
                            style={{ color: "var(--color-danger, #ef4444)" }}
                            onClick={() => handleReject(pr.id)}
                            disabled={actionLoading?.id === pr.id}
                            icon={
                              <span className="material-symbols-outlined icon-xs">
                                {actionLoading?.id === pr.id && actionLoading.action === "reject" ? "progress_activity" : "close"}
                              </span>
                            }
                            title="Rejeitar e arquivar esta proposta"
                          >
                            {actionLoading?.id === pr.id && actionLoading.action === "reject" ? "Rejeitando..." : "Rejeitar"}
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleApprove(pr.id)}
                            disabled={actionLoading?.id === pr.id}
                            icon={
                              <span className="material-symbols-outlined icon-xs">
                                {actionLoading?.id === pr.id && actionLoading.action === "approve" ? "progress_activity" : "thumb_up"}
                              </span>
                            }
                            title="Registrar aprovação nesta revisão"
                          >
                            {actionLoading?.id === pr.id && actionLoading.action === "approve"
                              ? "Aprovando..."
                              : `Aprovar Revisão ${approvals.length > 0 ? `(${approvals.length})` : ""}`}
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleMerge(pr.id)}
                            disabled={actionLoading?.id === pr.id}
                            icon={
                              <span className="material-symbols-outlined icon-xs">
                                {actionLoading?.id === pr.id && actionLoading.action === "merge" ? "progress_activity" : "publish"}
                              </span>
                            }
                            title="Publicar alterações e integrar na versão ativa"
                          >
                            {actionLoading?.id === pr.id && actionLoading.action === "merge" ? "Publicando..." : "Publicar Versão Oficial"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </PageBody>

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
            <div className="ui-row ui-row--align-center ui-row--sm" style={{ marginBottom: "16px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "var(--color-primary, #3b82f6)" }}>
                history
              </span>
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--color-text-primary, #0f172a)", fontWeight: 700 }}>
                Restaurar Versão (Rollback Seguro)
              </h3>
            </div>

            <p style={{ fontSize: "14px", color: "var(--color-text-secondary, #334155)", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              Você está prestes a restaurar o projeto para o estado da revisão:
              <br />
              <strong style={{ color: "var(--color-text-primary, #0f172a)", display: "block", marginTop: "6px" }}>
                #{rollbackTarget.short_id || rollbackTarget.id} &bull; {rollbackTarget.title}
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
                O estado desta versão será promovido como a nova versão ativa. <strong>Todo o histórico de revisões anteriores é preservado integralmente</strong>.
              </div>
            </div>

            <div className="ui-row ui-row--align-center ui-row--sm" style={{ justifyContent: "flex-end" }}>
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
                icon={<span className="material-symbols-outlined icon-xs">restore</span>}
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

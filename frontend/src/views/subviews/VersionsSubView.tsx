import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import {
  isPathHidden,
  getSystemFileFriendlyName,
} from "../../utils/hidden-files";
import {
  Button,
  AlertBanner,
  Tabs,
  Badge,
  Card,
  FormField,
  Input,
  Textarea,
  PageContainer,
  PageHeader,
  PageBody,
  Row,
  FilterChips,
} from "../../components/ui";
import { DiffViewer } from "../../components/common";
import {
  Sparkles,
  FileEdit,
  Settings,
  RefreshCw,
  CloudUpload,
} from "lucide-react";

interface VersionsSubViewProps {
  onOpenFile?: (path: string) => void;
  onOpenDiffModal?: () => void;
}

type TabType = "whats-new" | "drafts" | "system";
type WhatsNewFilterType = "all" | "new" | "modified" | "proposals";

export const VersionsSubView: React.FC<VersionsSubViewProps> = ({
  onOpenFile,
}) => {
  const {
    activeRepo,
    gitStatus,
    pendingChanges = [],
    systemPendingChanges = [],
    whatsNewSummary,
    hasUnreadWhatsNew,
    refreshGitStatus,
    refreshPendingChanges,
    refreshWhatsNew,
    markWhatsNewAsSeen,
    syncGit,
    discardChanges,
    loadFile,
  } = useWorkspace();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as TabType | null;

  const activeTab: TabType = useMemo(() => {
    if (tabParam && ["whats-new", "drafts", "system"].includes(tabParam)) {
      return tabParam;
    }
    return hasUnreadWhatsNew ? "whats-new" : "drafts";
  }, [tabParam, hasUnreadWhatsNew]);

  // Synchronize URL search params
  useEffect(() => {
    if (!tabParam || !["whats-new", "drafts", "system"].includes(tabParam)) {
      const defaultTab = hasUnreadWhatsNew ? "whats-new" : "drafts";
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", defaultTab);
          return next;
        },
        { replace: true },
      );
    }
  }, [tabParam, hasUnreadWhatsNew, setSearchParams]);

  const handleTabChange = (newTab: TabType) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", newTab);
        return next;
      },
      { replace: true },
    );
  };

  const [whatsNewFilter, setWhatsNewFilter] =
    useState<WhatsNewFilterType>("all");
  const [prTitle, setPrTitle] = useState("");
  const [prDescription, setPrDescription] = useState("");
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [createdPRUrl, setCreatedPRUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // File diff state: team diffs vs local diffs vs system diffs
  const [expandedWhatsNewFiles, setExpandedWhatsNewFiles] = useState<
    Record<string, boolean>
  >({});
  const [whatsNewDiffs, setWhatsNewDiffs] = useState<Record<string, string>>(
    {},
  );
  const [loadingWhatsNewDiffs, setLoadingWhatsNewDiffs] = useState<
    Record<string, boolean>
  >({});

  const [expandedDraftFiles, setExpandedDraftFiles] = useState<
    Record<string, boolean>
  >({});
  const [draftDiffs, setDraftDiffs] = useState<Record<string, string>>({});
  const [loadingDraftDiffs, setLoadingDraftDiffs] = useState<
    Record<string, boolean>
  >({});

  const [expandedSystemFiles, setExpandedSystemFiles] = useState<
    Record<string, boolean>
  >({});
  const [systemDiffs, setSystemDiffs] = useState<Record<string, string>>({});
  const [loadingSystemDiffs, setLoadingSystemDiffs] = useState<
    Record<string, boolean>
  >({});

  // Collapsible cards state
  const [isWhatsNewProposalsExpanded, setIsWhatsNewProposalsExpanded] = useState(true);
  const [isWhatsNewCommitsExpanded, setIsWhatsNewCommitsExpanded] = useState(false);

  // Reset local state when active repo changes
  useEffect(() => {
    setExpandedDraftFiles({});
    setExpandedWhatsNewFiles({});
    setExpandedSystemFiles({});
    setDraftDiffs({});
    setWhatsNewDiffs({});
    setSystemDiffs({});
    setPrTitle("");
    setPrDescription("");
    setCreatedPRUrl(null);
    setFeedback(null);
  }, [activeRepo?.name]);

  const filteredPendingChanges = useMemo(() => {
    return (pendingChanges || []).filter(
      (c) => c?.path && !isPathHidden(c.path),
    );
  }, [pendingChanges]);

  const allDraftFiles = useMemo(() => {
    const map = new Map<
      string,
      { path: string; status?: string; type?: string }
    >();

    for (const f of gitStatus?.files || []) {
      if (f?.path && !isPathHidden(f.path)) {
        const cleanPath = f.path.replace(/^\/+/, "");
        map.set(cleanPath, {
          path: cleanPath,
          status: f.status,
          type:
            f.status === "??" || f.status === "A"
              ? "ADDED"
              : f.status === "D"
                ? "DELETED"
                : "MODIFIED",
        });
      }
    }

    for (const c of filteredPendingChanges || []) {
      if (c?.path && !isPathHidden(c.path)) {
        const cleanPath = c.path.replace(/^\/+/, "");
        const existing = map.get(cleanPath);
        map.set(cleanPath, {
          path: cleanPath,
          status: existing?.status || (c.type === "ADDED" ? "??" : "M"),
          type: c.type || existing?.type || "MODIFIED",
        });
      }
    }

    return Array.from(map.values());
  }, [gitStatus?.files, filteredPendingChanges]);

  const allSystemDraftFiles = useMemo(() => {
    const map = new Map<
      string,
      { path: string; status?: string; type?: string; friendlyName: string }
    >();

    for (const f of gitStatus?.systemFiles || []) {
      if (f?.path) {
        const cleanPath = f.path.replace(/^\/+/, "");
        map.set(cleanPath, {
          path: cleanPath,
          status: f.status,
          type:
            f.status === "??" || f.status === "A"
              ? "ADDED"
              : f.status === "D"
                ? "DELETED"
                : "MODIFIED",
          friendlyName: getSystemFileFriendlyName(cleanPath),
        });
      }
    }

    for (const c of systemPendingChanges || []) {
      if (c?.path) {
        const cleanPath = c.path.replace(/^\/+/, "");
        const existing = map.get(cleanPath);
        map.set(cleanPath, {
          path: cleanPath,
          status: existing?.status || (c.type === "ADDED" ? "??" : "M"),
          type: c.type || existing?.type || "MODIFIED",
          friendlyName: getSystemFileFriendlyName(cleanPath),
        });
      }
    }

    return Array.from(map.values());
  }, [gitStatus?.systemFiles, systemPendingChanges]);

  const changedFiles = allDraftFiles;
  const isClean = allDraftFiles.length === 0;

  useEffect(() => {
    if (refreshGitStatus) refreshGitStatus();
    if (refreshPendingChanges) refreshPendingChanges();
    if (refreshWhatsNew) refreshWhatsNew();
  }, [refreshGitStatus, refreshPendingChanges, refreshWhatsNew]);

  const fetchWhatsNewDiff = useCallback(
    async (filePath: string) => {
      if (!filePath || whatsNewDiffs[filePath]) return;
      setLoadingWhatsNewDiffs((prev) => ({ ...prev, [filePath]: true }));
      try {
        const res = await API.getWhatsNewFileDiff(
          filePath,
          whatsNewSummary?.lastSeenHash,
        );
        if (res?.ok && res?.data?.diff) {
          setWhatsNewDiffs((prev) => ({ ...prev, [filePath]: res.data.diff }));
        }
      } catch (err) {
        console.error(
          `[VersionsSubView] Erro ao buscar comparativo de novidades de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingWhatsNewDiffs((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [whatsNewDiffs, whatsNewSummary?.lastSeenHash],
  );

  const fetchDraftDiff = useCallback(
    async (filePath: string) => {
      if (!filePath || draftDiffs[filePath]) return;
      setLoadingDraftDiffs((prev) => ({ ...prev, [filePath]: true }));
      try {
        const res = await API.getGitDiff(filePath);
        if (res?.ok && res?.data?.diff) {
          setDraftDiffs((prev) => ({ ...prev, [filePath]: res.data.diff }));
        }
      } catch (err) {
        console.error(
          `[VersionsSubView] Erro ao buscar diff de rascunho de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingDraftDiffs((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [draftDiffs],
  );

  const fetchSystemDiff = useCallback(
    async (filePath: string) => {
      if (!filePath || systemDiffs[filePath]) return;
      setLoadingSystemDiffs((prev) => ({ ...prev, [filePath]: true }));
      try {
        const res = await API.getGitDiff(filePath);
        if (res?.ok && res?.data?.diff) {
          setSystemDiffs((prev) => ({ ...prev, [filePath]: res.data.diff }));
        }
      } catch (err) {
        console.error(
          `[VersionsSubView] Erro ao buscar diff de sistema de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingSystemDiffs((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [systemDiffs],
  );

  const toggleWhatsNewFile = (filePath: string) => {
    const isNowExpanded = !expandedWhatsNewFiles[filePath];
    setExpandedWhatsNewFiles((prev) => ({
      ...prev,
      [filePath]: isNowExpanded,
    }));
    if (isNowExpanded) {
      fetchWhatsNewDiff(filePath);
    }
  };

  const toggleDraftFile = (filePath: string) => {
    const isNowExpanded = !expandedDraftFiles[filePath];
    setExpandedDraftFiles((prev) => ({ ...prev, [filePath]: isNowExpanded }));
    if (isNowExpanded) {
      fetchDraftDiff(filePath);
    }
  };

  const toggleSystemFile = (filePath: string) => {
    const isNowExpanded = !expandedSystemFiles[filePath];
    setExpandedSystemFiles((prev) => ({ ...prev, [filePath]: isNowExpanded }));
    if (isNowExpanded) {
      fetchSystemDiff(filePath);
    }
  };

  const toggleAllWhatsNewFiles = () => {
    const areAllExpanded =
      filteredWhatsNewFiles.length > 0 &&
      filteredWhatsNewFiles.every((f) => !!expandedWhatsNewFiles[f.path]);
    const nextState = !areAllExpanded;
    const nextMap: Record<string, boolean> = {};
    filteredWhatsNewFiles.forEach((f) => {
      nextMap[f.path] = nextState;
      if (nextState) fetchWhatsNewDiff(f.path);
    });
    setExpandedWhatsNewFiles(nextMap);
  };

  const toggleAllDraftFiles = () => {
    const areAllExpanded =
      allDraftFiles.length > 0 &&
      allDraftFiles.every((f) => !!expandedDraftFiles[f.path]);
    const nextState = !areAllExpanded;
    const nextMap: Record<string, boolean> = {};
    allDraftFiles.forEach((f) => {
      nextMap[f.path] = nextState;
      if (nextState) fetchDraftDiff(f.path);
    });
    setExpandedDraftFiles(nextMap);
  };

  const toggleAllSystemFiles = () => {
    const areAllExpanded =
      allSystemDraftFiles.length > 0 &&
      allSystemDraftFiles.every((f) => !!expandedSystemFiles[f.path]);
    const nextState = !areAllExpanded;
    const nextMap: Record<string, boolean> = {};
    allSystemDraftFiles.forEach((f) => {
      nextMap[f.path] = nextState;
      if (nextState) fetchSystemDiff(f.path);
    });
    setExpandedSystemFiles(nextMap);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      if (syncGit) {
        await syncGit();
        if (refreshGitStatus) await refreshGitStatus();
        if (refreshPendingChanges) await refreshPendingChanges();
        if (refreshWhatsNew) await refreshWhatsNew();
        setFeedback({
          type: "success",
          message: "Sincronização com o repositório concluída com sucesso.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err.message || "Erro durante a sincronização com o repositório.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMarkAsSeen = async () => {
    if (markWhatsNewAsSeen) {
      await markWhatsNewAsSeen();
      setFeedback({
        type: "success",
        message: "Todas as novidades foram marcadas como lidas.",
      });
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prTitle.trim()) return;

    setIsCreatingPR(true);
    setFeedback(null);
    try {
      const res = await API.createUnifiedPR({
        title: prTitle,
        description: prDescription,
        repo: activeRepo?.name,
      });

      if (res.ok && res.data) {
        setCreatedPRUrl(res.data.html_url || res.data.url || "#");
        setFeedback({
          type: "success",
          message: "Proposta de versão enviada com sucesso!",
        });
        setPrTitle("");
        setPrDescription("");
        if (refreshGitStatus) await refreshGitStatus();
        if (refreshPendingChanges) await refreshPendingChanges();
      } else {
        setFeedback({
          type: "error",
          message: res.data?.error || "Erro ao criar proposta de versão.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Falha na comunicação com o servidor.",
      });
    } finally {
      setIsCreatingPR(false);
    }
  };

  const handleGenerateSummaryAI = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await API.generatePRSummaryAI(activeRepo?.name);

      if (res.ok && res.data) {
        if (res.data.title) setPrTitle(res.data.title);
        if (res.data.description) setPrDescription(res.data.description);
      }
    } catch (err) {
      console.error("[VersionsSubView] Erro ao gerar resumo IA:", err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleOpenFileClick = (filePath: string) => {
    if (onOpenFile) {
      onOpenFile(filePath);
    } else if (loadFile) {
      loadFile(filePath);
    }
  };

  const handleDiscard = async (filePath: string) => {
    if (
      window.confirm(
        `Deseja descartar as alterações locais do arquivo "${filePath}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      if (discardChanges) {
        await discardChanges(filePath);
        setExpandedDraftFiles((prev) => {
          const next = { ...prev };
          delete next[filePath];
          return next;
        });
        setDraftDiffs((prev) => {
          const next = { ...prev };
          delete next[filePath];
          return next;
        });
        if (refreshPendingChanges) await refreshPendingChanges();
        if (refreshGitStatus) await refreshGitStatus();
        setFeedback({
          type: "success",
          message: `Rascunho de "${filePath}" foi descartado com sucesso.`,
        });
      }
    }
  };

  const getDraftDiffInfo = (filePath: string) => {
    if (!filePath) return { diffText: "", additions: 0, deletions: 0 };
    const cleanPath = filePath.replace(/^\/+/, "");
    const wsChange = (filteredPendingChanges || []).find(
      (c) => c?.path === filePath || c?.path?.replace(/^\/+/, "") === cleanPath,
    );
    const diffText =
      wsChange?.diff_text || wsChange?.diff || draftDiffs[filePath] || "";
    let adds = wsChange?.additions;
    let dels = wsChange?.deletions;

    if (adds === undefined || dels === undefined) {
      if (diffText) {
        const lines = diffText.split("\n");
        adds = lines.filter(
          (l) => l.startsWith("+") && !l.startsWith("+++"),
        ).length;
        dels = lines.filter(
          (l) => l.startsWith("-") && !l.startsWith("---"),
        ).length;
      } else {
        adds = 0;
        dels = 0;
      }
    }
    return { diffText, additions: adds, deletions: dels, type: wsChange?.type };
  };

  const whatsNewFiles = useMemo(() => {
    return (whatsNewSummary?.files || []).filter(
      (f) => f?.path && !isPathHidden(f.path),
    );
  }, [whatsNewSummary?.files]);
  const whatsNewProposals = whatsNewSummary?.proposals || [];
  const whatsNewCommits = whatsNewSummary?.commits || [];

  const newFilesCount = whatsNewFiles.filter((f) => f?.status === "A").length;
  const modFilesCount = whatsNewFiles.filter((f) => f?.status === "M").length;

  const filteredWhatsNewFiles = useMemo(() => {
    if (whatsNewFilter === "new")
      return whatsNewFiles.filter((f) => f?.status === "A");
    if (whatsNewFilter === "modified")
      return whatsNewFiles.filter((f) => f?.status === "M");
    if (whatsNewFilter === "proposals") return [];
    return whatsNewFiles;
  }, [whatsNewFiles, whatsNewFilter]);

  return (
    <PageContainer id="versions-subview">
      {/* Pinned Top Header & Tab Navigation Bar */}
      <PageHeader
        title="Central de Edições"
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
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "24px" }}
            >
              history_edu
            </span>
          </div>
        }
        actions={
          <Row gap="xs">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={() => {
                if (refreshGitStatus) refreshGitStatus();
                if (refreshPendingChanges) refreshPendingChanges();
                if (refreshWhatsNew) refreshWhatsNew();
              }}
              title="Atualizar dados e status"
            >
              Atualizar
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<CloudUpload size={15} />}
              onClick={handleSync}
              isLoading={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar com GitHub"}
            </Button>
          </Row>
        }
      >
        <Tabs<TabType>
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underline"
          tabs={[
            {
              id: "whats-new",
              label: "Novidades da Equipe",
              icon: <Sparkles size={16} />,
              count:
                whatsNewFiles.length > 0 ? whatsNewFiles.length : undefined,
              badgeVariant: "success",
            },
            {
              id: "drafts",
              label: "Minhas Edições",
              icon: <FileEdit size={16} />,
              count: changedFiles.length > 0 ? changedFiles.length : undefined,
              badgeVariant: "warning",
            },
            {
              id: "system",
              label: "Sistema",
              icon: <Settings size={16} />,
              count:
                allSystemDraftFiles.length > 0
                  ? allSystemDraftFiles.length
                  : undefined,
              badgeVariant: "info",
            },
          ]}
        />
      </PageHeader>

      {/* Main Content Area */}
      <PageBody>
        <div
          style={{
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Feedback Alert */}
          {feedback && (
            <AlertBanner
              type={feedback.type === "success" ? "success" : "error"}
              message={feedback.message}
              onClose={() => setFeedback(null)}
            />
          )}

          {/* TAB 1: NOVIDADES DA EQUIPE */}
          {activeTab === "whats-new" && (
            <div className="ui-stack ui-stack--lg">
              {/* Top Summary Banner */}
              <Card variant="elevated" padding="lg">
                <Row
                  justify="between"
                  align="center"
                  style={{ width: "100%", flexWrap: "wrap", gap: "16px" }}
                >
                  <div className="ui-row ui-row--align-center ui-row--md">
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "12px",
                        background: "var(--color-success-subtle, #dcfce7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-success, #16a34a)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "26px" }}
                      >
                        auto_awesome
                      </span>
                    </div>
                    <div>
                      <h3 className="ui-heading-3" style={{ margin: 0 }}>
                        Novidades
                      </h3>
                      <span
                        className="ui-text-muted"
                        style={{
                          fontSize: "13px",
                          marginTop: "3px",
                          display: "block",
                        }}
                      >
                        {whatsNewSummary?.summaryMessage ||
                          "Nenhuma atualização recente."}
                      </span>
                    </div>
                  </div>

                  <div className="ui-row ui-row--align-center ui-row--sm">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      icon={
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px" }}
                        >
                          cloud_sync
                        </span>
                      }
                    >
                      {isSyncing ? "Buscando..." : "Buscar Novidades"}
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleMarkAsSeen}
                      icon={
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px" }}
                        >
                          done_all
                        </span>
                      }
                    >
                      Marcar tudo como visto
                    </Button>
                  </div>
                </Row>
              </Card>

              {/* Filter Chips Bar */}
              <div
                className="ui-row ui-row--align-center ui-row--sm"
                style={{ flexWrap: "wrap" }}
              >
                <span
                  className="ui-text-muted"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    marginRight: "4px",
                  }}
                >
                  Filtrar por:
                </span>

                <FilterChips<WhatsNewFilterType>
                  activeId={whatsNewFilter}
                  onChange={(id) => setWhatsNewFilter(id)}
                  size="sm"
                  items={[
                    { id: "all", label: `Todos (${whatsNewFiles.length})` },
                    { id: "new", label: `Novos Documentos (${newFilesCount})` },
                    {
                      id: "modified",
                      label: `Documentos Alterados (${modFilesCount})`,
                    },
                    ...(whatsNewProposals.length > 0
                      ? [
                          {
                            id: "proposals" as WhatsNewFilterType,
                            label: `Propostas Integradas (${whatsNewProposals.length})`,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>

              {/* Integrated Proposals Section */}
              {(whatsNewFilter === "all" || whatsNewFilter === "proposals") &&
                whatsNewProposals.length > 0 && (
                  <Card variant="elevated" padding="none" style={{ overflow: "hidden" }}>
                    <div
                      className="ui-card__header"
                      onClick={() => setIsWhatsNewProposalsExpanded(!isWhatsNewProposalsExpanded)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 18px",
                        userSelect: "none",
                        background: isWhatsNewProposalsExpanded ? "var(--color-surface-subtle, #f8fafc)" : "transparent",
                      }}
                    >
                      <div className="ui-row ui-row--align-center ui-row--xs">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "20px", color: "#7c3aed" }}
                        >
                          verified
                        </span>
                        <strong
                          style={{
                            fontSize: "14px",
                            color: "var(--color-text-primary, #0f172a)",
                          }}
                        >
                          Propostas Aprovadas e Integradas ({whatsNewProposals.length})
                        </strong>
                      </div>

                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsWhatsNewProposalsExpanded(!isWhatsNewProposalsExpanded);
                        }}
                        icon={
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "18px",
                              transition: "transform 0.2s ease",
                              transform: isWhatsNewProposalsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                          >
                            expand_more
                          </span>
                        }
                      >
                        {isWhatsNewProposalsExpanded ? "Recolher" : "Ver Propostas"}
                      </Button>
                    </div>

                    {isWhatsNewProposalsExpanded && (
                      <div
                        className="ui-card__content"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          padding: "14px 18px",
                        }}
                      >
                        {whatsNewProposals.map((pr, idx) => (
                          <div
                            key={idx}
                            className="ui-card ui-card--flat"
                            style={{
                              padding: "12px 16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div className="ui-row ui-row--align-center ui-row--sm">
                              <Badge variant="primary" size="sm">
                                Proposta #{pr.id}
                              </Badge>
                              <span
                                style={{
                                  fontSize: "13.5px",
                                  fontWeight: 600,
                                  color: "var(--color-text-primary, #1e293b)",
                                }}
                              >
                                {pr.title}
                              </span>
                            </div>
                            {pr.author && (
                              <span
                                className="ui-text-muted"
                                style={{ fontSize: "12.5px" }}
                              >
                                Autor:{" "}
                                <strong
                                  style={{
                                    color: "var(--color-text-primary, #1e293b)",
                                  }}
                                >
                                  {pr.author}
                                </strong>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

              {/* Changed Files Received from Team */}
              {whatsNewFilter !== "proposals" && (
                <Card variant="elevated" padding="none">
                  <div
                    className="ui-card__header"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
                    }}
                  >
                    <div className="ui-row ui-row--align-center ui-row--xs">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "20px", color: "var(--color-primary, #3b82f6)" }}
                      >
                        difference
                      </span>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "var(--color-text-primary, #0f172a)",
                        }}
                      >
                        Documentos Atualizados da Equipe ({filteredWhatsNewFiles.length})
                      </strong>
                    </div>

                    {filteredWhatsNewFiles.length > 0 && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={toggleAllWhatsNewFiles}
                        icon={
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {filteredWhatsNewFiles.every((f) => !!expandedWhatsNewFiles[f.path])
                              ? "unfold_less"
                              : "unfold_more"}
                          </span>
                        }
                      >
                        {filteredWhatsNewFiles.every((f) => !!expandedWhatsNewFiles[f.path])
                          ? "Recolher Todos"
                          : "Expandir Todos"}
                      </Button>
                    )}
                  </div>

                  {filteredWhatsNewFiles.length === 0 ? (
                    <div className="ui-empty-state" style={{ padding: "40px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "32px",
                          color: "var(--color-success, #16a34a)",
                          display: "block",
                          marginBottom: "8px",
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
                        const isExpanded = !!expandedWhatsNewFiles[file.path];
                        const diffText = whatsNewDiffs[file.path] || "";
                        const isLoadingDiff = !!loadingWhatsNewDiffs[file.path];

                        return (
                          <div
                            key={file.path || idx}
                            style={{
                              borderBottom:
                                "1px solid var(--color-border-subtle, #e2e8f0)",
                              background: isExpanded
                                ? "var(--color-surface-subtle, #f8fafc)"
                                : "transparent",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "14px 20px",
                                cursor: "pointer",
                                userSelect: "none",
                                background: isExpanded
                                  ? "var(--color-primary-subtle, #f1f5f9)"
                                  : "transparent",
                                transition: "background 0.15s ease",
                              }}
                            >
                              <div
                                onClick={() => toggleWhatsNewFile(file.path)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  minWidth: 0,
                                  flex: 1,
                                  paddingRight: "16px",
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: "20px",
                                    color: isExpanded
                                      ? "var(--color-primary, #1a73e8)"
                                      : "var(--color-text-muted, #94a3b8)",
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
                                    fontSize: "20px",
                                    color:
                                      file.status === "M"
                                        ? "var(--color-warning, #d97706)"
                                        : file.status === "A"
                                          ? "var(--color-success, #16a34a)"
                                          : file.status === "D"
                                            ? "var(--color-danger, #dc2626)"
                                            : "var(--color-text-muted, #64748b)",
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
                                    fontFamily: "var(--font-family-mono)",
                                    fontSize: "13px",
                                    fontWeight: isExpanded ? 600 : 500,
                                    color: "var(--color-text-primary, #0f172a)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={file.path}
                                >
                                  {file.path}
                                </span>

                                <Badge
                                  variant={
                                    file.status === "M"
                                      ? "warning"
                                      : file.status === "A"
                                        ? "success"
                                        : file.status === "D"
                                          ? "danger"
                                          : "neutral"
                                  }
                                  size="sm"
                                >
                                  {file.statusLabel ||
                                    (file.status === "A"
                                      ? "Novo Documento"
                                      : file.status === "D"
                                        ? "Documento Removido"
                                        : "Documento Atualizado")}
                                </Badge>
                              </div>

                              <div
                                className="ui-row ui-row--align-center ui-row--sm"
                                style={{ flexShrink: 0 }}
                              >
                                {(file.additions > 0 || file.deletions > 0) && (
                                  <div
                                    className="ui-row ui-row--xs"
                                    style={{
                                      fontFamily: "var(--font-family-mono)",
                                      fontSize: "12px",
                                      marginRight: "8px",
                                    }}
                                  >
                                    {file.additions > 0 && (
                                      <span
                                        style={{
                                          color:
                                            "var(--color-success, #16a34a)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        +{file.additions}
                                      </span>
                                    )}
                                    {file.deletions > 0 && (
                                      <span
                                        style={{
                                          color: "var(--color-danger, #dc2626)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        -{file.deletions}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFileClick(file.path);
                                  }}
                                  title="Abrir este documento no editor"
                                  icon={
                                    <span
                                      className="material-symbols-outlined"
                                      style={{ fontSize: "15px" }}
                                    >
                                      open_in_new
                                    </span>
                                  }
                                >
                                  Abrir Documento
                                </Button>

                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => toggleWhatsNewFile(file.path)}
                                >
                                  {isExpanded
                                    ? "Ocultar mudanças"
                                    : "Ver mudanças"}
                                </Button>
                              </div>
                            </div>

                            {/* Accordion Diff View */}
                            {isExpanded && (
                              <DiffViewer
                                diffText={diffText}
                                isLoading={isLoadingDiff}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}

              {/* Commits List */}
              {whatsNewCommits.length > 0 && (
                <Card variant="elevated" padding="none" style={{ overflow: "hidden" }}>
                  <div
                    className="ui-card__header"
                    onClick={() => setIsWhatsNewCommitsExpanded(!isWhatsNewCommitsExpanded)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      userSelect: "none",
                      background: isWhatsNewCommitsExpanded ? "var(--color-surface-subtle, #f8fafc)" : "transparent",
                    }}
                  >
                    <div className="ui-row ui-row--align-center ui-row--xs">
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "18px",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        history
                      </span>
                      <strong style={{ fontSize: "14px", color: "var(--color-text-primary, #0f172a)" }}>
                        Publicações e Marcos Trazidos pela Atualização ({whatsNewCommits.length})
                      </strong>
                    </div>

                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsWhatsNewCommitsExpanded(!isWhatsNewCommitsExpanded);
                      }}
                      icon={
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "18px",
                            transition: "transform 0.2s ease",
                            transform: isWhatsNewCommitsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        >
                          expand_more
                        </span>
                      }
                    >
                      {isWhatsNewCommitsExpanded ? "Recolher" : "Ver Marcos"}
                    </Button>
                  </div>

                  {isWhatsNewCommitsExpanded && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "14px 18px",
                      }}
                    >
                      {whatsNewCommits.map((item, idx) => (
                        <div
                          key={idx}
                          className="ui-card ui-card--flat"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            fontSize: "13px",
                          }}
                        >
                          <div className="ui-row ui-row--align-center ui-row--xs">
                            <span
                              style={{
                                fontFamily: "var(--font-family-mono)",
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background:
                                  "var(--color-surface-subtle, #e2e8f0)",
                                color: "var(--color-text-secondary, #334155)",
                              }}
                            >
                              #
                              {item?.shortHash ||
                                item?.hash?.slice(0, 7) ||
                                "v-atual"}
                            </span>
                            <span
                              style={{
                                fontWeight: 500,
                                color: "var(--color-text-primary, #1e293b)",
                              }}
                            >
                              {item?.message || "Atualização de documentação"}
                            </span>
                          </div>
                          <span
                            className="ui-text-muted"
                            style={{ fontSize: "12px" }}
                          >
                            {item?.author || "Equipe"} &bull; {item?.date || ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: MINHAS EDIÇÕES & RASCUNHOS */}
          {activeTab === "drafts" && (
            <div className="ui-stack ui-stack--lg">
              {/* Changed Files List */}
              <Card variant="elevated" padding="none">
                <div
                  className="ui-card__header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                  }}
                >
                  <div className="ui-row ui-row--align-center ui-row--xs">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "var(--color-primary, #3b82f6)" }}
                    >
                      edit_note
                    </span>
                    <strong
                      style={{
                        fontSize: "14px",
                        color: "var(--color-text-primary, #0f172a)",
                      }}
                    >
                      Meus Documentos em Edição Local ({allDraftFiles.length})
                    </strong>
                  </div>

                  {allDraftFiles.length > 0 && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={toggleAllDraftFiles}
                      icon={
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          {allDraftFiles.every((f) => !!expandedDraftFiles[f.path])
                            ? "unfold_less"
                            : "unfold_more"}
                        </span>
                      }
                    >
                      {allDraftFiles.every((f) => !!expandedDraftFiles[f.path])
                        ? "Recolher Todos"
                        : "Expandir Todos"}
                    </Button>
                  )}
                </div>

                {allDraftFiles.length === 0 ? (
                  <div className="ui-empty-state" style={{ padding: "40px" }}>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "32px",
                        color: "var(--color-success, #16a34a)",
                        display: "block",
                        marginBottom: "8px",
                      }}
                    >
                      check_circle
                    </span>
                    Todos os seus documentos estão consolidados e salvos no
                    disco.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {allDraftFiles.map((file, idx) => {
                      if (!file?.path) return null;
                      const isExpanded = !!expandedDraftFiles[file.path];
                      const { diffText, additions, deletions } =
                        getDraftDiffInfo(file.path);
                      const isLoadingDiff = !!loadingDraftDiffs[file.path];

                      return (
                        <div
                          key={file.path || idx}
                          style={{
                            borderBottom:
                              "1px solid var(--color-border-subtle, #e2e8f0)",
                            background: isExpanded
                              ? "var(--color-surface-subtle, #f8fafc)"
                              : "transparent",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 20px",
                              cursor: "pointer",
                              userSelect: "none",
                              background: isExpanded
                                ? "var(--color-primary-subtle, #f1f5f9)"
                                : "transparent",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <div
                              onClick={() => toggleDraftFile(file.path)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                minWidth: 0,
                                flex: 1,
                                paddingRight: "16px",
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: "20px",
                                  color: isExpanded
                                    ? "var(--color-primary, #1a73e8)"
                                    : "var(--color-text-muted, #94a3b8)",
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
                                  fontSize: "20px",
                                  color:
                                    file.status === "M"
                                      ? "var(--color-warning, #d97706)"
                                      : file.status === "A" ||
                                          file.status === "??"
                                        ? "var(--color-success, #16a34a)"
                                        : file.status === "D"
                                          ? "var(--color-danger, #dc2626)"
                                          : "var(--color-text-muted, #64748b)",
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
                                  fontFamily: "var(--font-family-mono)",
                                  fontSize: "13px",
                                  fontWeight: isExpanded ? 600 : 500,
                                  color: "var(--color-text-primary, #0f172a)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={file.path}
                              >
                                {file.path}
                              </span>

                              <Badge
                                variant={
                                  file.status === "M"
                                    ? "warning"
                                    : file.status === "A" ||
                                        file.status === "??"
                                      ? "success"
                                      : file.status === "D"
                                        ? "danger"
                                        : "neutral"
                                }
                                size="sm"
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
                              </Badge>
                            </div>

                            <div
                              className="ui-row ui-row--align-center ui-row--sm"
                              style={{ flexShrink: 0 }}
                            >
                              {(additions > 0 || deletions > 0) && (
                                <div
                                  className="ui-row ui-row--xs"
                                  style={{
                                    fontFamily: "var(--font-family-mono)",
                                    fontSize: "12px",
                                    marginRight: "8px",
                                  }}
                                >
                                  {additions > 0 && (
                                    <span
                                      style={{
                                        color: "var(--color-success, #16a34a)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      +{additions}
                                    </span>
                                  )}
                                  {deletions > 0 && (
                                    <span
                                      style={{
                                        color: "var(--color-danger, #dc2626)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      -{deletions}
                                    </span>
                                  )}
                                </div>
                              )}

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFileClick(file.path);
                                }}
                                title="Abrir este documento no editor"
                                icon={
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "15px" }}
                                  >
                                    open_in_new
                                  </span>
                                }
                              >
                                Abrir Documento
                              </Button>

                              <Button
                                type="button"
                                size="xs"
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDiscard(file.path);
                                }}
                                title="Descartar modificações deste documento"
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>

                          {/* Accordion Diff View */}
                          {isExpanded && (
                            <DiffViewer
                              diffText={diffText}
                              isLoading={isLoadingDiff}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Version Milestone Proposal Form */}
              <Card variant="elevated" className="ui-card--p-lg">
                <form
                  onSubmit={handleCreateProposal}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <Row
                    justify="between"
                    align="center"
                    style={{ width: "100%", marginBottom: "4px" }}
                  >
                    <div className="ui-row ui-row--align-center ui-row--xs">
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "20px",
                          color: "var(--color-primary, #1a73e8)",
                        }}
                      >
                        alt_route
                      </span>
                      <h3 className="ui-card__title" style={{ margin: 0 }}>
                        Propor Atualização de Versão
                      </h3>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleGenerateSummaryAI}
                      disabled={isGeneratingAI || isClean}
                      icon={
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "15px",
                            animation: isGeneratingAI
                              ? "spin 1s linear infinite"
                              : "none",
                          }}
                        >
                          {isGeneratingAI
                            ? "progress_activity"
                            : "auto_fix_high"}
                        </span>
                      }
                      title="Preencher título e descrição automaticamente a partir dos arquivos alterados"
                    >
                      {isGeneratingAI
                        ? "Gerando resumo..."
                        : "Gerar Resumo Automático"}
                    </Button>
                  </Row>

                  <FormField
                    label="Título da Proposta"
                    required
                    helperText="Resumo objetivo das alterações para o registro de versão"
                  >
                    <Input
                      id="draft-pr-title"
                      placeholder="Ex: docs: atualização de especificações e termos de governança"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      disabled={isCreatingPR || isClean}
                    />
                  </FormField>

                  <FormField
                    label="Descrição & Justificativa"
                    helperText="Opcional: detalhe os motivos das alterações, impactos e itens adicionados"
                  >
                    <Textarea
                      id="draft-pr-description"
                      rows={3}
                      placeholder="Detalhe os motivos das alterações, impactos e itens adicionados..."
                      value={prDescription}
                      onChange={(e) => setPrDescription(e.target.value)}
                      disabled={isCreatingPR || isClean}
                    />
                  </FormField>

                  {createdPRUrl && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "var(--color-success-subtle, #f0fdf4)",
                        border: "1px solid var(--color-border-subtle, #bbf7d0)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--color-success, #166534)",
                          fontWeight: 500,
                        }}
                      >
                        🎉 Proposta criada com sucesso!
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "4px",
                    }}
                  >
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isCreatingPR || isClean || !prTitle.trim()}
                      isLoading={isCreatingPR}
                      icon={
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px" }}
                        >
                          call_split
                        </span>
                      }
                    >
                      {isCreatingPR
                        ? "Criando Proposta..."
                        : "Propor Alteração"}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* TAB 3: SISTEMA & TEMPLATES */}
          {activeTab === "system" && (
            <div className="ui-stack ui-stack--lg">
              {allSystemDraftFiles.length === 0 ? (
                <Card
                  variant="elevated"
                  padding="xl"
                  style={{ textAlign: "center" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "44px",
                      color: "var(--color-success, #16a34a)",
                      marginBottom: "12px",
                    }}
                  >
                    check_circle
                  </span>
                  <h4 className="ui-heading-3" style={{ margin: 0 }}>
                    Nenhuma Alteração de Sistema Pendente
                  </h4>
                  <p
                    className="ui-text-muted"
                    style={{
                      margin: "8px auto 0 auto",
                      fontSize: "13.5px",
                      maxWidth: "480px",
                      lineHeight: "1.5",
                    }}
                  >
                    Todos os templates (<code>.templates.json</code>), termos do
                    dicionário (<code>.dictionary.json</code>) e arquivos de
                    configuração do projeto estão sincronizados.
                  </p>
                </Card>
              ) : (
                <>
                  {/* System Files List */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 4px",
                      marginBottom: "-4px",
                    }}
                  >
                    <strong style={{ fontSize: "14px", color: "var(--color-text-primary, #0f172a)" }}>
                      Arquivos de Configuração & Sistema ({allSystemDraftFiles.length})
                    </strong>

                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={toggleAllSystemFiles}
                      icon={
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          {allSystemDraftFiles.every((f) => !!expandedSystemFiles[f.path])
                            ? "unfold_less"
                            : "unfold_more"}
                        </span>
                      }
                    >
                      {allSystemDraftFiles.every((f) => !!expandedSystemFiles[f.path])
                        ? "Recolher Todos"
                        : "Expandir Todos"}
                    </Button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {allSystemDraftFiles.map((f) => {
                      const isExpanded = !!expandedSystemFiles[f.path];
                      const diffText = systemDiffs[f.path] || "";
                      const isLoading = !!loadingSystemDiffs[f.path];

                      return (
                        <Card key={f.path} variant="elevated" padding="none">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 20px",
                              background:
                                "var(--color-surface-subtle, #f8fafc)",
                              borderBottom: isExpanded
                                ? "1px solid var(--color-border-subtle, #e2e8f0)"
                                : "none",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div className="ui-row ui-row--align-center ui-row--sm">
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: "22px",
                                  color: "var(--color-primary, #3b82f6)",
                                }}
                              >
                                {f.path.includes("template")
                                  ? "dashboard_customize"
                                  : f.path.includes("dictionary")
                                    ? "book"
                                    : f.path.includes("metadata")
                                      ? "tune"
                                      : "settings"}
                              </span>
                              <div>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "var(--color-text-primary, #0f172a)",
                                  }}
                                >
                                  {f.friendlyName}
                                </div>
                                <div
                                  className="ui-text-muted"
                                  style={{
                                    fontSize: "12px",
                                    fontFamily:
                                      "var(--font-family-mono, monospace)",
                                  }}
                                >
                                  {f.path}
                                </div>
                              </div>
                            </div>

                            <div className="ui-row ui-row--align-center ui-row--xs">
                              <Badge
                                variant={
                                  f.type === "ADDED"
                                    ? "success"
                                    : f.type === "DELETED"
                                      ? "danger"
                                      : "info"
                                }
                                size="sm"
                              >
                                {f.type === "ADDED"
                                  ? "NOVO"
                                  : f.type === "DELETED"
                                    ? "REMOVIDO"
                                    : "MODIFICADO"}
                              </Badge>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => toggleSystemFile(f.path)}
                                icon={
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "16px" }}
                                  >
                                    {isExpanded ? "expand_less" : "expand_more"}
                                  </span>
                                }
                              >
                                {isExpanded
                                  ? "Ocultar Diferenças"
                                  : "Ver Diferenças (Diff)"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                style={{
                                  color: "var(--color-danger, #dc2626)",
                                }}
                                onClick={() => handleDiscard(f.path)}
                                title="Descartar alterações neste arquivo de sistema"
                                icon={
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "15px" }}
                                  >
                                    delete
                                  </span>
                                }
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>

                          {/* Diff Viewer Body */}
                          {isExpanded && (
                            <DiffViewer
                              diffText={diffText}
                              isLoading={isLoading}
                            />
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  {/* Proposal Form for System changes */}
                  <Card variant="elevated" className="ui-card--p-lg">
                    <form
                      onSubmit={handleCreateProposal}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <Row
                        justify="between"
                        align="center"
                        style={{ width: "100%", marginBottom: "4px" }}
                      >
                        <div className="ui-row ui-row--align-center ui-row--xs">
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "20px",
                              color: "var(--color-primary, #1a73e8)",
                            }}
                          >
                            alt_route
                          </span>
                          <h3 className="ui-card__title" style={{ margin: 0 }}>
                            Publicar ou Propor Atualização de Sistema
                          </h3>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleGenerateSummaryAI}
                          disabled={
                            isGeneratingAI || allSystemDraftFiles.length === 0
                          }
                          icon={
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "15px",
                                animation: isGeneratingAI
                                  ? "spin 1s linear infinite"
                                  : "none",
                              }}
                            >
                              {isGeneratingAI
                                ? "progress_activity"
                                : "auto_fix_high"}
                            </span>
                          }
                        >
                          {isGeneratingAI
                            ? "Gerando resumo..."
                            : "Gerar Resumo com IA"}
                        </Button>
                      </Row>

                      <p
                        className="ui-text-muted"
                        style={{ fontSize: "12.5px", margin: 0 }}
                      >
                        Ao criar a proposta, uma revisão será aberta para que os
                        novos templates e configurações sejam compartilhados e
                        replicados para toda a equipe.
                      </p>

                      <FormField
                        label="Título da Proposta de Sistema"
                        required
                        helperText="Ex: chore(templates): atualizar modelos canônicos de especificação"
                      >
                        <Input
                          id="system-pr-title"
                          placeholder="Ex: chore(templates): atualizar modelos canônicos de especificação"
                          value={prTitle}
                          onChange={(e) => setPrTitle(e.target.value)}
                          disabled={isCreatingPR}
                        />
                      </FormField>

                      <FormField
                        label="Descrição das Modificações"
                        helperText="Opcional: detalhe o que foi alterado nos templates ou configurações"
                      >
                        <Textarea
                          id="system-pr-description"
                          rows={3}
                          placeholder="Detalhe o que foi alterado nos templates ou configurações..."
                          value={prDescription}
                          onChange={(e) => setPrDescription(e.target.value)}
                          disabled={isCreatingPR}
                        />
                      </FormField>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: "4px",
                        }}
                      >
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          disabled={isCreatingPR || !prTitle.trim()}
                          isLoading={isCreatingPR}
                          icon={
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "18px" }}
                            >
                              publish
                            </span>
                          }
                        >
                          {isCreatingPR
                            ? "Criando Proposta..."
                            : "Criar Proposta de Evolução"}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </PageBody>
    </PageContainer>
  );
};

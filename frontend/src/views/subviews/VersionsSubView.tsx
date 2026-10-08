import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
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
  Modal,
} from "../../components/ui";
import { RepoSelectorDropdown } from "../../components/layout/RepoSelectorDropdown";
import { DiffViewer } from "../../components/common";
import {
  Sparkles,
  FileEdit,
  Settings,
  RefreshCw,
  CloudUpload,
  FolderGit2,
  Send,
  Trash2,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

interface VersionsSubViewProps {
  onOpenFile?: (path: string) => void;
  onOpenDiffModal?: () => void;
}

type TabType = "whats-new" | "drafts" | "system";
type WhatsNewFilterType = "all" | "new" | "modified" | "proposals";

interface DraftItem {
  path: string;
  repoName: string;
  status?: string;
  type?: string;
  additions?: number;
  deletions?: number;
  diff_text?: string;
}

export const VersionsSubView: React.FC<VersionsSubViewProps> = ({
  onOpenFile,
  onOpenDiffModal: _onOpenDiffModal,
}) => {
  const { provider } = useAuth();
  const providerLabel = provider === "github" ? "GitHub" : "Modo Local";
  const {
    activeRepo,
    repos,
    gitStatus,
    pendingChanges = [],
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

  // Repository selection state
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("all");
  const [repoEditsCounts, setRepoEditsCounts] = useState<Record<string, number>>({});
  const [allReposDrafts, setAllReposDrafts] = useState<DraftItem[]>([]);
  const [allReposSystemDrafts, setAllReposSystemDrafts] = useState<DraftItem[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);

  // Proposal modal state
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [modalTargetRepo, setModalTargetRepo] = useState<string>(
    activeRepo?.name || (repos && repos[0]?.name) || "local"
  );

  const [whatsNewFilter, setWhatsNewFilter] = useState<WhatsNewFilterType>("all");
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
  const [expandedWhatsNewFiles, setExpandedWhatsNewFiles] = useState<Record<string, boolean>>({});
  const [whatsNewDiffs, setWhatsNewDiffs] = useState<Record<string, string>>({});
  const [loadingWhatsNewDiffs, setLoadingWhatsNewDiffs] = useState<Record<string, boolean>>({});

  const [expandedDraftFiles, setExpandedDraftFiles] = useState<Record<string, boolean>>({});
  const [draftDiffs, setDraftDiffs] = useState<Record<string, string>>({});
  const [loadingDraftDiffs, setLoadingDraftDiffs] = useState<Record<string, boolean>>({});

  const [expandedSystemFiles, setExpandedSystemFiles] = useState<Record<string, boolean>>({});
  const [systemDiffs, setSystemDiffs] = useState<Record<string, string>>({});
  const [loadingSystemDiffs, setLoadingSystemDiffs] = useState<Record<string, boolean>>({});

  // Collapsible cards state
  const [isWhatsNewProposalsExpanded, setIsWhatsNewProposalsExpanded] = useState(true);
  const [isWhatsNewCommitsExpanded, setIsWhatsNewCommitsExpanded] = useState(false);

  // Load changes for all repos or active repos
  const loadAllEdits = useCallback(async (targetRepo?: string) => {
    const filter = targetRepo !== undefined ? targetRepo : selectedRepoFilter;
    setIsLoadingChanges(true);

    try {
      const targetRepoList = repos && repos.length > 0 ? repos : [{ name: activeRepo?.name || "local" }];
      const counts: Record<string, number> = {};
      const drafts: DraftItem[] = [];
      const systemDrafts: DraftItem[] = [];

      await Promise.all(
        targetRepoList.map(async (r) => {
          try {
            const data = await API.getWorkspaceChanges(r.name);
            const rChanges = data?.changes || [];
            const rSystem = data?.system_changes || [];

            const visibleChanges = rChanges.filter((c: any) => c?.path && !isPathHidden(c.path));
            counts[r.name] = visibleChanges.length;

            if (filter === "all" || filter === r.name) {
              for (const c of visibleChanges) {
                drafts.push({
                  path: c.path.replace(/^\/+/, ""),
                  repoName: r.name,
                  status: c.type === "ADDED" ? "??" : c.type === "DELETED" ? "D" : "M",
                  type: c.type || "MODIFIED",
                  additions: c.additions,
                  deletions: c.deletions,
                  diff_text: c.diff_text || c.diff,
                });
              }

              for (const s of rSystem) {
                if (s?.path) {
                  systemDrafts.push({
                    path: s.path.replace(/^\/+/, ""),
                    repoName: r.name,
                    status: s.type === "ADDED" ? "??" : s.type === "DELETED" ? "D" : "M",
                    type: s.type || "MODIFIED",
                    additions: s.additions,
                    deletions: s.deletions,
                    diff_text: s.diff_text || s.diff,
                  });
                }
              }
            }
          } catch (err) {
            console.warn(`[VersionsSubView] Erro ao carregar edições de ${r.name}:`, err);
          }
        })
      );

      setRepoEditsCounts(counts);
      setAllReposDrafts(drafts);
      setAllReposSystemDrafts(systemDrafts);
    } catch (err) {
      console.error("[VersionsSubView] Erro ao carregar alterações de trabalho:", err);
    } finally {
      setIsLoadingChanges(false);
    }
  }, [selectedRepoFilter, repos, activeRepo?.name]);

  useEffect(() => {
    loadAllEdits();
  }, [loadAllEdits, gitStatus, pendingChanges]);

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
  }, [activeRepo?.name, selectedRepoFilter]);

  const allDraftFiles = allReposDrafts;
  const allSystemDraftFiles = allReposSystemDrafts;
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
    async (filePath: string, targetRepo?: string) => {
      const key = `${targetRepo || "local"}:${filePath}`;
      if (!filePath || draftDiffs[key]) return;
      setLoadingDraftDiffs((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await API.getGitDiff(filePath, targetRepo);
        if (res?.ok && res?.data?.diff) {
          setDraftDiffs((prev) => ({ ...prev, [key]: res.data.diff }));
        }
      } catch (err) {
        console.error(
          `[VersionsSubView] Erro ao buscar diff de rascunho de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingDraftDiffs((prev) => ({ ...prev, [key]: false }));
      }
    },
    [draftDiffs],
  );

  const fetchSystemDiff = useCallback(
    async (filePath: string, targetRepo?: string) => {
      const key = `${targetRepo || "local"}:${filePath}`;
      if (!filePath || systemDiffs[key]) return;
      setLoadingSystemDiffs((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await API.getGitDiff(filePath, targetRepo);
        if (res?.ok && res?.data?.diff) {
          setSystemDiffs((prev) => ({ ...prev, [key]: res.data.diff }));
        }
      } catch (err) {
        console.error(
          `[VersionsSubView] Erro ao buscar diff de sistema de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingSystemDiffs((prev) => ({ ...prev, [key]: false }));
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

  const toggleDraftFile = (filePath: string, repoName?: string) => {
    const key = `${repoName || "local"}:${filePath}`;
    const isNowExpanded = !expandedDraftFiles[key];
    setExpandedDraftFiles((prev) => ({ ...prev, [key]: isNowExpanded }));
    if (isNowExpanded) {
      fetchDraftDiff(filePath, repoName);
    }
  };

  const toggleSystemFile = (filePath: string, repoName?: string) => {
    const key = `${repoName || "local"}:${filePath}`;
    const isNowExpanded = !expandedSystemFiles[key];
    setExpandedSystemFiles((prev) => ({ ...prev, [key]: isNowExpanded }));
    if (isNowExpanded) {
      fetchSystemDiff(filePath, repoName);
    }
  };

  const toggleAllWhatsNewFiles = () => {
    const areAllExpanded =
      filteredWhatsNewFiles.length > 0 &&
      filteredWhatsNewFiles.every((f) => !expandedWhatsNewFiles[f.path]);
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
      allDraftFiles.every((f) => !expandedDraftFiles[`${f.repoName}:${f.path}`]);
    const nextState = !areAllExpanded;
    const nextMap: Record<string, boolean> = {};
    allDraftFiles.forEach((f) => {
      const key = `${f.repoName}:${f.path}`;
      nextMap[key] = nextState;
      if (nextState) fetchDraftDiff(f.path, f.repoName);
    });
    setExpandedDraftFiles(nextMap);
  };

  const toggleAllSystemFiles = () => {
    const areAllExpanded =
      allSystemDraftFiles.length > 0 &&
      allSystemDraftFiles.every((f) => !expandedSystemFiles[`${f.repoName}:${f.path}`]);
    const nextState = !areAllExpanded;
    const nextMap: Record<string, boolean> = {};
    allSystemDraftFiles.forEach((f) => {
      const key = `${f.repoName}:${f.path}`;
      nextMap[key] = nextState;
      if (nextState) fetchSystemDiff(f.path, f.repoName);
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
        await loadAllEdits();
        setFeedback({
          type: "success",
          message: "Sincronização com o repositório concluída com sucesso.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Erro durante a sincronização com o repositório.",
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

  const handleCreateProposal = async (targetRepoName?: string) => {
    const targetRepo = targetRepoName || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepo?.name || "local");
    const repoEdits = allDraftFiles.filter((f) => f.repoName === targetRepo);

    if (repoEdits.length === 0) {
      setFeedback({
        type: "error",
        message: `Nenhuma alteração pendente detectada no repositório "${targetRepo}". Modifique arquivos no editor e salve (Ctrl+S) antes de propor uma versão.`,
      });
      return;
    }
    if (!prTitle.trim()) {
      setFeedback({
        type: "error",
        message: "Por favor, informe o título da proposta ou clique em 'Gerar Resumo Automático'.",
      });
      return;
    }

    setIsCreatingPR(true);
    setFeedback(null);
    try {
      const res = await API.createUnifiedPR({
        title: prTitle.trim(),
        description: prDescription.trim(),
        repo: targetRepo,
      });

      if (res.ok && res.data) {
        setCreatedPRUrl(res.data.html_url || res.data.url || "#");
        setFeedback({
          type: "success",
          message: res.data.message || "Proposta de versão enviada com sucesso!",
        });
        setPrTitle("");
        setPrDescription("");
        setIsProposalModalOpen(false);
        if (refreshGitStatus) await refreshGitStatus(targetRepo);
        if (refreshPendingChanges) await refreshPendingChanges(targetRepo);
        await loadAllEdits();
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

  const handleGenerateSummaryAI = async (targetRepoName?: string) => {
    const targetRepo = targetRepoName || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepo?.name || "local");
    setIsGeneratingAI(true);
    try {
      const res = await API.generatePRSummaryAI(targetRepo);
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

  const handleDiscard = async (filePath: string, targetRepo?: string) => {
    const repoName = targetRepo || activeRepo?.name || "local";
    if (
      window.confirm(
        `Deseja descartar as alterações locais do arquivo "${filePath}" no repositório "${repoName}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      if (discardChanges) {
        const key = `${repoName}:${filePath}`;
        await discardChanges(filePath, repoName);
        setExpandedDraftFiles((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setDraftDiffs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        await loadAllEdits();
        setFeedback({
          type: "success",
          message: `Alterações em "${filePath}" foram descartadas com sucesso.`,
        });
      }
    }
  };

  const handleDiscardAll = async (targetRepo?: string) => {
    const repoName = targetRepo || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepo?.name || "local");
    if (
      window.confirm(
        `Tem certeza que deseja descartar TODAS as alterações pendentes no repositório "${repoName}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      if (discardChanges) {
        await discardChanges(undefined, repoName);
        setExpandedDraftFiles({});
        setDraftDiffs({});
        await loadAllEdits();
        setFeedback({
          type: "success",
          message: `Todas as edições do repositório "${repoName}" foram descartadas.`,
        });
      }
    }
  };

  const getDraftDiffInfo = (filePath: string, targetRepo?: string) => {
    if (!filePath) return { diffText: "", additions: 0, deletions: 0 };
    const cleanPath = filePath.replace(/^\/+/, "");
    const item = allDraftFiles.find(
      (c) => c.path === cleanPath && (!targetRepo || c.repoName === targetRepo)
    );
    const key = `${targetRepo || item?.repoName || "local"}:${cleanPath}`;
    const diffText = item?.diff_text || draftDiffs[key] || "";
    let adds = item?.additions;
    let dels = item?.deletions;

    if (adds === undefined || dels === undefined) {
      if (diffText) {
        const lines = diffText.split("\n");
        adds = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
        dels = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
      } else {
        adds = 0;
        dels = 0;
      }
    }
    return { diffText, additions: adds, deletions: dels, type: item?.type };
  };

  const whatsNewFiles = useMemo(() => {
    return (whatsNewSummary?.files || []).filter((f) => f?.path && !isPathHidden(f.path));
  }, [whatsNewSummary?.files]);
  const whatsNewProposals = whatsNewSummary?.proposals || [];
  const whatsNewCommits = whatsNewSummary?.commits || [];

  const newFilesCount = whatsNewFiles.filter((f) => f?.status === "A").length;
  const modFilesCount = whatsNewFiles.filter((f) => f?.status === "M").length;

  const filteredWhatsNewFiles = useMemo(() => {
    if (whatsNewFilter === "new") return whatsNewFiles.filter((f) => f?.status === "A");
    if (whatsNewFilter === "modified") return whatsNewFiles.filter((f) => f?.status === "M");
    if (whatsNewFilter === "proposals") return [];
    return whatsNewFiles;
  }, [whatsNewFiles, whatsNewFilter]);

  // Modal target files
  const modalDraftFiles = useMemo(() => {
    return allDraftFiles.filter((f) => f.repoName === modalTargetRepo);
  }, [allDraftFiles, modalTargetRepo]);

  const openProposalModalWithRepo = (targetRepo?: string) => {
    const repoToUse = targetRepo || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepo?.name || (repos && repos[0]?.name) || "local");
    setModalTargetRepo(repoToUse);
    setIsProposalModalOpen(true);
  };

  return (
    <PageContainer id="versions-subview">
      {/* Pinned Top Header & Tab Navigation Bar */}
      <PageHeader
        title="Central de Edições"
        subtitle={
          <Row gap="sm" align="center" style={{ marginTop: "4px", flexWrap: "wrap" }}>
            <RepoSelectorDropdown
              value={selectedRepoFilter}
              onChange={(val) => {
                setSelectedRepoFilter(val);
                loadAllEdits(val);
              }}
              repoOpenCounts={repoEditsCounts}
              allowAll={true}
            />

            <span className="ui-text-muted" style={{ fontSize: "12.5px" }}>
              Revise alterações locais em tempo real, descarte edições ou submeta propostas de evolução.
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
              id="btn-open-proposal-modal"
              type="button"
              variant="primary"
              size="sm"
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  alt_route
                </span>
              }
              onClick={() => openProposalModalWithRepo()}
              title="Abrir modal para selecionar repositório e criar proposta de versão"
            >
              Propor Alterações
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isLoadingChanges ? "spin" : ""} />}
              onClick={() => {
                if (refreshGitStatus) refreshGitStatus();
                if (refreshPendingChanges) refreshPendingChanges();
                if (refreshWhatsNew) refreshWhatsNew();
                loadAllEdits();
              }}
              title="Atualizar dados e status"
            >
              Atualizar
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<CloudUpload size={15} />}
              onClick={handleSync}
              isLoading={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : `Sincronizar com ${providerLabel}`}
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
              count: whatsNewFiles.length > 0 ? whatsNewFiles.length : undefined,
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
              count: allSystemDraftFiles.length > 0 ? allSystemDraftFiles.length : undefined,
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
                        {whatsNewSummary?.summaryMessage || "Nenhuma atualização recente."}
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
                            label: `Propostas (${whatsNewProposals.length})`,
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
                          style={{ fontSize: "20px", color: "var(--color-primary, #4f46e5)" }}
                        >
                          verified
                        </span>
                        <strong
                          style={{
                            fontSize: "14px",
                            color: "var(--color-text-primary, #0f172a)",
                          }}
                        >
                          Propostas de Alteração & Versões ({whatsNewProposals.length})
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
                        {whatsNewProposals.map((pr, idx) => {
                          const statusLower = (pr.status || "merged").toLowerCase();
                          const isMerged = statusLower === "merged";
                          const isClosed = statusLower === "closed";
                          const repo = pr.repo_name || pr.repoName || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepo?.name || "local");

                          const statusLabel = isMerged
                            ? "INTEGRADA"
                            : isClosed
                              ? "ARQUIVADA"
                              : "EM REVISÃO";

                          const statusVariant = isMerged
                            ? "success"
                            : isClosed
                              ? "danger"
                              : "warning";

                          return (
                            <div
                              key={idx}
                              className="ui-card ui-card--flat"
                              style={{
                                padding: "12px 16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <div className="ui-row ui-row--align-center ui-row--sm" style={{ flexWrap: "wrap" }}>
                                <Badge variant="primary" size="sm">
                                  Proposta #{pr.id}
                                </Badge>

                                <Badge variant={statusVariant} size="xs">
                                  {statusLabel}
                                </Badge>

                                {repo && (
                                  <Badge
                                    variant="neutral"
                                    size="xs"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      backgroundColor: "var(--md-sys-color-surface-container-high, #e8eaed)",
                                      color: "var(--md-sys-color-on-surface, #202124)",
                                      borderColor: "var(--md-sys-color-outline-variant, #dadce0)",
                                    }}
                                  >
                                    <FolderGit2 size={11} style={{ flexShrink: 0 }} />
                                    {repo}
                                  </Badge>
                                )}

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
                          );
                        })}
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
                    flexWrap: "wrap",
                    gap: "10px",
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
                    {selectedRepoFilter !== "all" && (
                      <Badge variant="neutral" size="sm">
                        {selectedRepoFilter}
                      </Badge>
                    )}
                  </div>

                  <div className="ui-row ui-row--align-center ui-row--xs">
                    {allDraftFiles.length > 0 && (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDiscardAll()}
                          style={{ color: "var(--color-danger, #dc2626)" }}
                          title="Descartar todas as alterações"
                          icon={<Trash2 size={13} />}
                        >
                          Descartar Todas
                        </Button>

                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={toggleAllDraftFiles}
                          icon={
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                              {allDraftFiles.every((f) => !!expandedDraftFiles[`${f.repoName}:${f.path}`])
                                ? "unfold_less"
                                : "unfold_more"}
                            </span>
                          }
                        >
                          {allDraftFiles.every((f) => !!expandedDraftFiles[`${f.repoName}:${f.path}`])
                            ? "Recolher Todos"
                            : "Expandir Todos"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {allDraftFiles.length === 0 ? (
                  <div className="ui-empty-state" style={{ padding: "40px", textAlign: "center" }}>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "36px",
                        color: "var(--color-success, #16a34a)",
                        display: "block",
                        marginBottom: "8px",
                      }}
                    >
                      check_circle
                    </span>
                    <strong style={{ display: "block", fontSize: "14px", color: "var(--color-text-primary)" }}>
                      Nenhuma alteração pendente detectada
                    </strong>
                    <span className="ui-text-muted" style={{ fontSize: "13px", marginTop: "4px", display: "block" }}>
                      Todos os seus documentos estão consolidados e sincronizados com o repositório.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {allDraftFiles.map((file, idx) => {
                      if (!file?.path) return null;
                      const fileKey = `${file.repoName}:${file.path}`;
                      const isExpanded = !!expandedDraftFiles[fileKey];
                      const { diffText, additions, deletions } = getDraftDiffInfo(file.path, file.repoName);
                      const isLoadingDiff = !!loadingDraftDiffs[fileKey];

                      return (
                        <div
                          key={fileKey || idx}
                          style={{
                            borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
                            background: isExpanded ? "var(--color-surface-subtle, #f8fafc)" : "transparent",
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
                              background: isExpanded ? "var(--color-primary-subtle, #f1f5f9)" : "transparent",
                              transition: "background 0.15s ease",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div
                              onClick={() => toggleDraftFile(file.path, file.repoName)}
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
                                  color: isExpanded ? "var(--color-primary, #1a73e8)" : "var(--color-text-muted, #94a3b8)",
                                  transition: "transform 0.2s ease",
                                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
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
                                      : file.status === "A" || file.status === "??"
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

                              {selectedRepoFilter === "all" && file.repoName && (
                                <Badge variant="neutral" size="sm">
                                  {file.repoName}
                                </Badge>
                              )}

                              <Badge
                                variant={
                                  file.status === "M"
                                    ? "warning"
                                    : file.status === "A" || file.status === "??"
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
                                variant="ghost"
                                onClick={() => toggleDraftFile(file.path, file.repoName)}
                              >
                                {isExpanded ? "Ocultar mudanças" : "Ver mudanças"}
                              </Button>

                              <Button
                                type="button"
                                size="xs"
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDiscard(file.path, file.repoName);
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
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateProposal();
                  }}
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
                      {selectedRepoFilter !== "all" && (
                        <Badge variant="primary" size="sm">
                          {selectedRepoFilter}
                        </Badge>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateSummaryAI()}
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
                          {isGeneratingAI ? "progress_activity" : "auto_fix_high"}
                        </span>
                      }
                      title="Preencher título e descrição automaticamente a partir dos arquivos alterados"
                    >
                      {isGeneratingAI ? "Gerando resumo..." : "Gerar Resumo com IA"}
                    </Button>
                  </Row>

                  {isClean && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "var(--color-surface-container-low, #f8fafc)",
                        border: "1px dashed var(--color-outline-variant, #cbd5e1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "12.5px",
                        color: "var(--color-on-surface-variant, #64748b)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "18px", color: "var(--color-primary, #2563eb)", flexShrink: 0 }}
                      >
                        info
                      </span>
                      <span>
                        Nenhum arquivo modificado detectado no momento. Edite ou crie documentos no editor e salve suas alterações (Ctrl+S) para propor uma nova versão.
                      </span>
                    </div>
                  )}

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
                      disabled={isCreatingPR}
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
                      disabled={isCreatingPR}
                    />
                  </FormField>

                  {feedback && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background:
                          feedback.type === "success"
                            ? "var(--color-success-subtle, #f0fdf4)"
                            : "var(--color-danger-subtle, #fef2f2)",
                        border: `1px solid ${
                          feedback.type === "success"
                            ? "var(--color-border-subtle, #bbf7d0)"
                            : "var(--color-border-danger, #fecaca)"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "18px",
                          color:
                            feedback.type === "success"
                              ? "var(--color-success, #16a34a)"
                              : "var(--color-danger, #dc2626)",
                          flexShrink: 0,
                        }}
                      >
                        {feedback.type === "success" ? "check_circle" : "error"}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            color:
                              feedback.type === "success"
                                ? "var(--color-success, #166534)"
                                : "var(--color-danger, #991b1b)",
                            fontWeight: 500,
                          }}
                        >
                          {feedback.message}
                        </span>
                        {feedback.type === "success" && createdPRUrl && createdPRUrl !== "#" && (
                          <a
                            href={createdPRUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: "12px",
                              color: "var(--color-primary, #2563eb)",
                              textDecoration: "underline",
                              fontWeight: 600,
                            }}
                          >
                            Abrir Pull Request no Provedor Git ↗
                          </a>
                        )}
                      </div>
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
                      disabled={isCreatingPR}
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
                      {isCreatingPR ? "Criando Proposta..." : "Propor Alteração"}
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
                          {allSystemDraftFiles.every((f) => !!expandedSystemFiles[`${f.repoName}:${f.path}`])
                            ? "unfold_less"
                            : "unfold_more"}
                        </span>
                      }
                    >
                      {allSystemDraftFiles.every((f) => !!expandedSystemFiles[`${f.repoName}:${f.path}`])
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
                      const fKey = `${f.repoName}:${f.path}`;
                      const isExpanded = !!expandedSystemFiles[fKey];
                      const diffText = systemDiffs[fKey] || "";
                      const isLoading = !!loadingSystemDiffs[fKey];

                      return (
                        <Card key={fKey} variant="elevated" padding="none">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 20px",
                              background: "var(--color-surface-subtle, #f8fafc)",
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
                                  {getSystemFileFriendlyName(f.path)}
                                </div>
                                <div
                                  className="ui-text-muted"
                                  style={{
                                    fontSize: "12px",
                                    fontFamily: "var(--font-family-mono, monospace)",
                                  }}
                                >
                                  {f.path} {f.repoName && `(${f.repoName})`}
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
                                onClick={() => toggleSystemFile(f.path, f.repoName)}
                                icon={
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "16px" }}
                                  >
                                    {isExpanded ? "expand_less" : "expand_more"}
                                  </span>
                                }
                              >
                                {isExpanded ? "Ocultar Diferenças" : "Ver Diferenças (Diff)"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                style={{ color: "var(--color-danger, #dc2626)" }}
                                onClick={() => handleDiscard(f.path, f.repoName)}
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
                </>
              )}
            </div>
          )}
        </div>
      </PageBody>

      {/* Modal: Propor Alterações & Seleção de Repositório */}
      {isProposalModalOpen && (
        <Modal
          isOpen={isProposalModalOpen}
          onClose={() => setIsProposalModalOpen(false)}
          size="xl"
          title={
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "22px", color: "var(--color-primary, #2563eb)" }}
              >
                alt_route
              </span>
              <span>Proposta de Nova Versão & Edições</span>
            </div>
          }
          subtitle="Escolha o repositório para revisar as alterações pendentes e enviar para aprovação."
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              {modalDraftFiles.length > 0 ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDiscardAll(modalTargetRepo)}
                  icon={<Trash2 size={14} />}
                >
                  Descartar Todas ({modalDraftFiles.length})
                </Button>
              ) : (
                <div />
              )}

              <Row gap="sm">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsProposalModalOpen(false)}
                >
                  Cancelar
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={modalDraftFiles.length === 0 || isCreatingPR || !prTitle.trim()}
                  isLoading={isCreatingPR}
                  onClick={() => handleCreateProposal(modalTargetRepo)}
                  icon={<Send size={14} />}
                >
                  {isCreatingPR ? "Enviando..." : "Submeter Proposta"}
                </Button>
              </Row>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Repo Selector within Modal */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "10px",
                background: "var(--md-sys-color-surface-container-low, #f8fafc)",
                border: "1px solid var(--md-sys-color-outline-variant, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FolderGit2 size={18} color="var(--md-sys-color-primary, #1a73e8)" />
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                    Repositório da Proposta
                  </span>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {modalTargetRepo}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--color-text-muted)" }}>Alternar:</span>
                <select
                  value={modalTargetRepo}
                  onChange={(e) => {
                    setModalTargetRepo(e.target.value);
                    setPrTitle("");
                    setPrDescription("");
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-subtle, #cbd5e1)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    background: "var(--color-surface, #ffffff)",
                    color: "var(--color-text-primary, #0f172a)",
                    cursor: "pointer",
                  }}
                >
                  {(repos && repos.length > 0 ? repos : [{ name: activeRepo?.name || "local" }]).map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name} ({repoEditsCounts[r.name] || 0} alterações)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of files modified in this repo */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <strong style={{ fontSize: "13.5px", color: "var(--color-text-primary)" }}>
                  Arquivos alterados em {modalTargetRepo} ({modalDraftFiles.length})
                </strong>
                {modalDraftFiles.length > 0 && (
                  <span className="ui-text-muted" style={{ fontSize: "12px" }}>
                    Clique no arquivo para expandir a comparação
                  </span>
                )}
              </div>

              {modalDraftFiles.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    borderRadius: "8px",
                    background: "var(--color-surface-subtle, #f8fafc)",
                    border: "1px dashed var(--color-border-subtle, #cbd5e1)",
                  }}
                >
                  <CheckCircle size={28} color="var(--color-success, #16a34a)" style={{ margin: "0 auto 8px auto" }} />
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Nenhum arquivo modificado neste repositório.
                  </div>
                  <div className="ui-text-muted" style={{ fontSize: "12px", marginTop: "4px" }}>
                    Edite ou crie arquivos no editor e salve (Ctrl+S) para incluir nesta proposta.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "260px",
                    overflowY: "auto",
                    border: "1px solid var(--color-border-subtle, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "6px",
                  }}
                >
                  {modalDraftFiles.map((file) => {
                    const fileKey = `${file.repoName}:${file.path}`;
                    const isExpanded = !!expandedDraftFiles[fileKey];
                    const { diffText } = getDraftDiffInfo(file.path, file.repoName);
                    const isLoading = !!loadingDraftDiffs[fileKey];

                    return (
                      <div
                        key={fileKey}
                        style={{
                          borderRadius: "6px",
                          border: "1px solid var(--color-border-subtle, #e2e8f0)",
                          background: isExpanded ? "var(--color-surface-subtle, #f8fafc)" : "var(--color-surface, #ffffff)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: "12.5px",
                          }}
                          onClick={() => toggleDraftFile(file.path, file.repoName)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                            <ChevronRight
                              size={15}
                              style={{
                                transform: isExpanded ? "rotate(90deg)" : "none",
                                transition: "transform 0.15s ease",
                                color: "var(--color-text-muted)",
                              }}
                            />
                            <span
                              style={{
                                fontFamily: "var(--font-family-mono)",
                                fontWeight: 600,
                                color: "var(--color-text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {file.path}
                            </span>
                            <Badge
                              variant={
                                file.status === "M"
                                  ? "warning"
                                  : file.status === "A" || file.status === "??"
                                    ? "success"
                                    : "danger"
                              }
                              size="sm"
                            >
                              {file.status === "??" ? "NOVO" : file.status === "M" ? "MODIFICADO" : "REMOVIDO"}
                            </Badge>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <Button
                              type="button"
                              size="xs"
                              variant="danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDiscard(file.path, file.repoName);
                              }}
                              title="Descartar este arquivo"
                            >
                              Descartar
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                            <DiffViewer diffText={diffText} isLoading={isLoading} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Proposal Form Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                  Detalhes da Proposta
                </strong>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => handleGenerateSummaryAI(modalTargetRepo)}
                  disabled={isGeneratingAI || modalDraftFiles.length === 0}
                  icon={
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "14px",
                        animation: isGeneratingAI ? "spin 1s linear infinite" : "none",
                      }}
                    >
                      {isGeneratingAI ? "progress_activity" : "auto_fix_high"}
                    </span>
                  }
                >
                  {isGeneratingAI ? "Gerando..." : "Gerar com IA"}
                </Button>
              </div>

              <FormField
                label="Título da Proposta"
                required
                helperText="Resumo claro das alterações para a esteira de revisão"
              >
                <Input
                  placeholder="Ex: docs: atualização dos termos e documentações canônicas"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  disabled={isCreatingPR}
                />
              </FormField>

              <FormField
                label="Descrição & Justificativa"
                helperText="Opcional: contexto adicional para os aprovadores"
              >
                <Textarea
                  rows={3}
                  placeholder="Explique detalhadamente as mudanças e o motivo desta versão..."
                  value={prDescription}
                  onChange={(e) => setPrDescription(e.target.value)}
                  disabled={isCreatingPR}
                />
              </FormField>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};

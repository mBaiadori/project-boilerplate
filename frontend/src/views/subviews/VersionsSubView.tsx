import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import {
  isPathHidden,
  getSystemFileFriendlyName,
} from "../../utils/hidden-files";
import { Button, AlertBanner, Tabs } from "../../components/ui";
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

  // Synchronize URL search params so the active tab is always explicitly in the URL
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

  // Reset local state when active repo changes so repos are strictly isolated
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

    // 1. Files from gitStatus (tracked modified, untracked ??, etc.)
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

    // 2. Files from in-memory / workspace changes
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

    // 1. Files from gitStatus (systemFiles)
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

    // 2. Files from in-memory / workspace system changes
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

  // Load status and fresh data on mount
  useEffect(() => {
    if (refreshGitStatus) refreshGitStatus();
    if (refreshPendingChanges) refreshPendingChanges();
    if (refreshWhatsNew) refreshWhatsNew();
  }, [refreshGitStatus, refreshPendingChanges, refreshWhatsNew]);

  // Fetch Team Diff specifically for What's New (isolated from local edits!)
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
    [whatsNewDiffs, whatsNewSummary],
  );

  // Fetch Local Diff specifically for Local Drafts (isolated from team commits!)
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
          `[VersionsSubView] Erro ao buscar comparativo de rascunho de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingDraftDiffs((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [draftDiffs],
  );

  // Toggle accordions
  const toggleWhatsNewFile = (filePath: string) => {
    if (!filePath) return;
    const nextState = !expandedWhatsNewFiles[filePath];
    setExpandedWhatsNewFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState) {
      fetchWhatsNewDiff(filePath);
    }
  };

  const toggleDraftFile = (filePath: string) => {
    if (!filePath) return;
    const nextState = !expandedDraftFiles[filePath];
    setExpandedDraftFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState) {
      fetchDraftDiff(filePath);
    }
  };

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
          `[VersionsSubView] Erro ao buscar comparativo de sistema de ${filePath}:`,
          err,
        );
      } finally {
        setLoadingSystemDiffs((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [systemDiffs],
  );

  const toggleSystemFile = (filePath: string) => {
    if (!filePath) return;
    const nextState = !expandedSystemFiles[filePath];
    setExpandedSystemFiles((prev) => ({ ...prev, [filePath]: nextState }));
    if (nextState) {
      fetchSystemDiff(filePath);
    }
  };

  const handleOpenFileClick = async (filePath: string) => {
    if (!filePath) return;
    try {
      if (loadFile) await loadFile(filePath);
      if (onOpenFile) onOpenFile(filePath);
    } catch (err) {
      console.error("[VersionsSubView] Erro ao abrir documento:", err);
    }
  };

  const handleMarkAsSeen = () => {
    if (markWhatsNewAsSeen) markWhatsNewAsSeen();
    setFeedback({
      type: "success",
      message:
        "Todas as novidades d foram marcadas como visualizadas com sucesso!",
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncGit();
      if (res?.success) {
        setFeedback({
          type: "success",
          message: `Sincronização com  concluída: ${res.message || "Atualizado"}`,
        });
        if (refreshPendingChanges) await refreshPendingChanges();
        if (refreshWhatsNew) await refreshWhatsNew();
        if (hasUnreadWhatsNew) {
          handleTabChange("whats-new");
        }
      } else {
        setFeedback({
          type: "error",
          message: `Aviso de sincronização: ${res?.message || "Falha ao sincronizar"}`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Erro ao sincronizar com o servidor d.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateSummaryAI = async () => {
    setIsGeneratingAI(true);
    setFeedback(null);
    try {
      const res = await API.generatePRSummaryAI(activeRepo?.name);
      if (res.ok && res.data) {
        if (res.data.title) setPrTitle(res.data.title);
        if (res.data.description) setPrDescription(res.data.description);
        setFeedback({
          type: "success",
          message:
            "Resumo gerado com sucesso a partir das alterações do repositório!",
        });
      } else {
        setFeedback({
          type: "error",
          message:
            "Não foi possível gerar o resumo. Verifique se há alterações pendentes.",
        });
      }
    } catch (err: any) {
      console.error("[VersionsSubView] Erro ao gerar resumo automático:", err);
      setFeedback({
        type: "error",
        message: err.message || "Erro ao gerar resumo automático.",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = prTitle.trim();
    if (!title) return;

    setIsCreatingPR(true);
    setFeedback(null);
    setCreatedPRUrl(null);
    try {
      const res = await API.createUnifiedPR({
        title,
        description: prDescription.trim(),
        repo: activeRepo?.name,
      });

      if (res?.ok) {
        const prNumber =
          res.data?.pr?.github_number || res.data?.pr?.id || res.data?.id;
        const prUrl = res.data?.pr?.html_url || res.data?.html_url;
        setCreatedPRUrl(prUrl || null);
        setFeedback({
          type: "success",
          message: `Proposta de Evolução #${prNumber || ""} criada com sucesso via Pull Request!`,
        });
        setPrTitle("");
        setPrDescription("");
        if (refreshPendingChanges) await refreshPendingChanges();
        if (refreshGitStatus) await refreshGitStatus();
      } else {
        setFeedback({
          type: "error",
          message:
            res?.data?.error || "Falha ao criar proposta de evolução / PR.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Erro ao conectar e abrir Pull Request.",
      });
    } finally {
      setIsCreatingPR(false);
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

  // Helper to extract diff lines for local drafts
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

  // Render Clean Light Diff Box
  const renderDiffViewer = (diffText: string, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div
          style={{
            padding: "20px",
            color: "#64748b",
            fontSize: "13px",
            background: "#f8fafc",
            textAlign: "center",
            borderRadius: "0 0 8px 8px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              animation: "spin 1s linear infinite",
              verticalAlign: "middle",
              marginRight: "8px",
              fontSize: "18px",
              color: "#1a73e8",
            }}
          >
            progress_activity
          </span>
          Carregando comparativo detalhado de mudanças...
        </div>
      );
    }

    if (!diffText || !diffText.trim()) {
      return (
        <div
          style={{
            padding: "16px 20px",
            color: "#64748b",
            fontSize: "12.5px",
            fontStyle: "italic",
            background: "#f8fafc",
            borderRadius: "0 0 8px 8px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          Nenhuma alteração de texto detectada neste arquivo (ou arquivo
          binário).
        </div>
      );
    }

    const lines = diffText.split("\n");

    return (
      <pre
        style={{
          margin: 0,
          padding: "12px 0",
          fontSize: "12.5px",
          lineHeight: "1.55",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          background: "#f8fafc",
          color: "#1e293b",
          overflowX: "auto",
          maxHeight: "380px",
          borderRadius: "0 0 8px 8px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        {lines.map((line, idx) => {
          let bg = "transparent";
          let color = "#1e293b";
          let fontWeight = "normal";

          if (line.startsWith("+") && !line.startsWith("+++")) {
            bg = "rgba(34, 197, 94, 0.12)";
            color = "#15803d";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            bg = "rgba(239, 68, 68, 0.12)";
            color = "#b91c1c";
          } else if (line.startsWith("@@")) {
            bg = "rgba(26, 115, 232, 0.1)";
            color = "#1a73e8";
            fontWeight = "600";
          } else if (
            line.startsWith("diff ") ||
            line.startsWith("index ") ||
            line.startsWith("--- ") ||
            line.startsWith("+++ ")
          ) {
            color = "#64748b";
            fontWeight = "600";
          }

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                padding: "1px 16px",
                backgroundColor: bg,
                color: color,
                fontWeight: fontWeight,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "36px",
                  userSelect: "none",
                  color: "#94a3b8",
                  textAlign: "right",
                  marginRight: "14px",
                  fontSize: "11px",
                }}
              >
                {idx + 1}
              </span>
              <span style={{ flex: 1 }}>{line || " "}</span>
            </div>
          );
        })}
      </pre>
    );
  };

  // Whats New computed list
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
    <div
      id="versions-subview"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#f8fafc",
        color: "#1e293b",
        overflow: "hidden",
      }}
    >
      {/* Pinned Top Header & Tab Navigation Bar */}
      <div
        style={{
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          zIndex: 10,
        }}
      >
        {/* Top Banner & Header - Clean Light */}
        <div
          style={{
            padding: "20px 36px 16px 36px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "#e8f0fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1a73e8",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "26px" }}
                >
                  history_edu
                </span>
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Central de Edições
                </h1>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Repositório:{" "}
                    <strong style={{ color: "#1e293b" }}>
                      {activeRepo?.name || "Local"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
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
              leftIcon={<CloudUpload size={15} />}
              onClick={handleSync}
              isLoading={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar com GitHub"}
            </Button>
          </div>
        </div>

        {/* Navigation Tab Bar - Design System Tabs */}
        <div style={{ padding: "0 36px" }}>
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
                count:
                  changedFiles.length > 0 ? changedFiles.length : undefined,
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
        </div>
      </div>

      {/* Main Content Area (Scrollable independently) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 36px 48px 36px",
        }}
      >
        <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
          {/* Feedback Alert */}
          {feedback && (
            <AlertBanner
              type={feedback.type === "success" ? "success" : "error"}
              message={feedback.message}
              onClose={() => setFeedback(null)}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: NOVIDADES D (Sincronização & O que veio de novo)
            ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "whats-new" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* Top Summary Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  padding: "18px 24px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "14px" }}
                >
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "12px",
                      background: "#dcfce7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#16a34a",
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
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      Novidades
                    </h3>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        marginTop: "3px",
                        display: "block",
                      }}
                    >
                      {whatsNewSummary?.summaryMessage ||
                        "Nenhuma atualização recente d."}
                    </span>
                  </div>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "16px" }}
                    >
                      cloud_sync
                    </span>
                    {isSyncing ? "Buscando..." : "Buscar Novidades"}
                  </button>

                  <button
                    type="button"
                    onClick={handleMarkAsSeen}
                    style={{
                      backgroundColor: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 1px 3px rgba(22, 163, 74, 0.3)",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "18px" }}
                    >
                      done_all
                    </span>
                    Marcar tudo como visto
                  </button>
                </div>
              </div>

              {/* Filter Chips Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#64748b",
                    marginRight: "4px",
                  }}
                >
                  Filtrar por:
                </span>

                <button
                  type="button"
                  onClick={() => setWhatsNewFilter("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border:
                      whatsNewFilter === "all"
                        ? "1px solid #1a73e8"
                        : "1px solid #e2e8f0",
                    background:
                      whatsNewFilter === "all" ? "#e8f0fe" : "#ffffff",
                    color: whatsNewFilter === "all" ? "#1a73e8" : "#64748b",
                    transition: "all 0.15s ease",
                  }}
                >
                  Todos ({whatsNewFiles.length})
                </button>

                <button
                  type="button"
                  onClick={() => setWhatsNewFilter("new")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border:
                      whatsNewFilter === "new"
                        ? "1px solid #16a34a"
                        : "1px solid #e2e8f0",
                    background:
                      whatsNewFilter === "new" ? "#dcfce7" : "#ffffff",
                    color: whatsNewFilter === "new" ? "#16a34a" : "#64748b",
                    transition: "all 0.15s ease",
                  }}
                >
                  ✨ Novos Documentos ({newFilesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setWhatsNewFilter("modified")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border:
                      whatsNewFilter === "modified"
                        ? "1px solid #d97706"
                        : "1px solid #e2e8f0",
                    background:
                      whatsNewFilter === "modified" ? "#fef3c7" : "#ffffff",
                    color:
                      whatsNewFilter === "modified" ? "#b45309" : "#64748b",
                    transition: "all 0.15s ease",
                  }}
                >
                  📝 Documentos Alterados ({modFilesCount})
                </button>

                {whatsNewProposals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWhatsNewFilter("proposals")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border:
                        whatsNewFilter === "proposals"
                          ? "1px solid #7c3aed"
                          : "1px solid #e2e8f0",
                      background:
                        whatsNewFilter === "proposals" ? "#f3e8ff" : "#ffffff",
                      color:
                        whatsNewFilter === "proposals" ? "#7c3aed" : "#64748b",
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
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 18px",
                        background: "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "20px", color: "#7c3aed" }}
                      >
                        verified
                      </span>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                        Propostas de Especificação Aprovadas e Integradas
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {whatsNewProposals.map((pr, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                background: "#e8f0fe",
                                color: "#1a73e8",
                              }}
                            >
                              Proposta #{pr.id}
                            </span>
                            <span
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 600,
                                color: "#1e293b",
                              }}
                            >
                              {pr.title}
                            </span>
                          </div>
                          {pr.author && (
                            <span
                              style={{ fontSize: "12.5px", color: "#64748b" }}
                            >
                              Autor:{" "}
                              <strong style={{ color: "#1e293b" }}>
                                {pr.author}
                              </strong>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Changed Files Received from Team */}
              {whatsNewFilter !== "proposals" && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {filteredWhatsNewFiles.length === 0 ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#64748b",
                        fontSize: "13.5px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "32px",
                          color: "#16a34a",
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
                              borderBottom: "1px solid #e2e8f0",
                              background: isExpanded
                                ? "#f8fafc"
                                : "transparent",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 18px",
                                cursor: "pointer",
                                userSelect: "none",
                                background: isExpanded
                                  ? "#f1f5f9"
                                  : "transparent",
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* Left side: Icon, Path and Status */}
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
                                    color: isExpanded ? "#1a73e8" : "#94a3b8",
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
                                        ? "#d97706"
                                        : file.status === "A"
                                          ? "#16a34a"
                                          : file.status === "D"
                                            ? "#dc2626"
                                            : "#64748b",
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
                                    fontSize: "13px",
                                    fontWeight: isExpanded ? 600 : 500,
                                    color: "#0f172a",
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
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
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
                                  gap: "10px",
                                  flexShrink: 0,
                                }}
                              >
                                {(file.additions > 0 || file.deletions > 0) && (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      fontSize: "12px",
                                      fontFamily: "var(--font-mono)",
                                      marginRight: "8px",
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFileClick(file.path);
                                  }}
                                  title="Abrir este documento no editor"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "12px",
                                    padding: "5px 12px",
                                    borderRadius: "6px",
                                    background: "#ffffff",
                                    border: "1px solid #cbd5e1",
                                    color: "#334155",
                                    cursor: "pointer",
                                    fontWeight: 500,
                                  }}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "15px" }}
                                  >
                                    open_in_new
                                  </span>
                                  Abrir Documento
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleWhatsNewFile(file.path)}
                                  style={{
                                    fontSize: "12px",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    background: "transparent",
                                    border: "none",
                                    color: "#1a73e8",
                                    cursor: "pointer",
                                    fontWeight: 500,
                                  }}
                                >
                                  {isExpanded
                                    ? "Ocultar mudanças"
                                    : "Ver mudanças d"}
                                </button>
                              </div>
                            </div>

                            {/* Accordion Diff View */}
                            {isExpanded &&
                              renderDiffViewer(diffText, isLoadingDiff)}
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
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "18px 20px",
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 14px 0",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "18px", color: "#64748b" }}
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
                      gap: "8px",
                    }}
                  >
                    {whatsNewCommits.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: "13px",
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
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#e2e8f0",
                              color: "#334155",
                            }}
                          >
                            #
                            {item?.shortHash ||
                              item?.hash?.slice(0, 7) ||
                              "v-atual"}
                          </span>
                          <span style={{ fontWeight: 500, color: "#1e293b" }}>
                            {item?.message || "Atualização de documentação"}
                          </span>
                        </div>
                        <span style={{ color: "#64748b", fontSize: "12px" }}>
                          {item?.author || "Equipe"} &bull; {item?.date || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: MEUS RASCUNHOS & MODIFICAÇÕES LOCAIS (Isolado d!)
            ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "drafts" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* Changed Files List */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    padding: "12px 18px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "#0f172a",
                    }}
                  >
                    Meus Documentos em Edição Local ({allDraftFiles.length})
                  </span>
                </div>

                {allDraftFiles.length === 0 ? (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "13.5px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "32px",
                        color: "#16a34a",
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
                            borderBottom: "1px solid #e2e8f0",
                            background: isExpanded ? "#f8fafc" : "transparent",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 18px",
                              cursor: "pointer",
                              userSelect: "none",
                              background: isExpanded
                                ? "#f1f5f9"
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
                                  color: isExpanded ? "#1a73e8" : "#94a3b8",
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
                                      ? "#d97706"
                                      : file.status === "A" ||
                                          file.status === "??"
                                        ? "#16a34a"
                                        : file.status === "D"
                                          ? "#dc2626"
                                          : "#64748b",
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
                                  fontSize: "13px",
                                  fontWeight: isExpanded ? 600 : 500,
                                  color: "#0f172a",
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
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  background:
                                    file.status === "M"
                                      ? "#fef3c7"
                                      : file.status === "A" ||
                                          file.status === "??"
                                        ? "#dcfce7"
                                        : file.status === "D"
                                          ? "#fee2e2"
                                          : "#e0e7ff",
                                  color:
                                    file.status === "M"
                                      ? "#b45309"
                                      : file.status === "A" ||
                                          file.status === "??"
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

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                flexShrink: 0,
                              }}
                            >
                              {(additions > 0 || deletions > 0) && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    fontSize: "12px",
                                    fontFamily: "var(--font-mono)",
                                    marginRight: "8px",
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFileClick(file.path);
                                }}
                                title="Abrir este documento no editor"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "12px",
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  background: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  color: "#334155",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  open_in_new
                                </span>
                                Abrir Documento
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDiscard(file.path);
                                }}
                                title="Descartar modificações deste documento"
                                style={{
                                  color: "#dc2626",
                                  fontSize: "12px",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                Descartar
                              </button>
                            </div>
                          </div>

                          {/* Accordion Diff View */}
                          {isExpanded &&
                            renderDiffViewer(diffText, isLoadingDiff)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Version Milestone Proposal Form (Pull Request) */}
              <form
                onSubmit={handleCreateProposal}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "20px",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#0f172a",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "#1a73e8" }}
                    >
                      alt_route
                    </span>
                    Propor Atualização de Versão
                  </h3>

                  <button
                    type="button"
                    onClick={handleGenerateSummaryAI}
                    disabled={isGeneratingAI || isClean}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "6px",
                      background: "linear-gradient(135deg, #eef2ff, #ede9fe)",
                      color: "#4f46e5",
                      border: "1px solid #c7d2fe",
                      cursor:
                        isGeneratingAI || isClean ? "not-allowed" : "pointer",
                      opacity: isClean ? 0.6 : 1,
                      transition: "all 0.15s ease",
                    }}
                    title="Preencher título e descrição automaticamente a partir dos arquivos alterados"
                  >
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
                    {isGeneratingAI
                      ? "Gerando resumo..."
                      : "Gerar Resumo Automático"}
                  </button>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    Título da Proposta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: docs: atualização de especificações e termos de governança"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    disabled={isCreatingPR || isClean}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "13.5px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      background: "#ffffff",
                      color: "#1e293b",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    Descrição & Justificativa (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detalhe os motivos das alterações, impactos e itens adicionados..."
                    value={prDescription}
                    onChange={(e) => setPrDescription(e.target.value)}
                    disabled={isCreatingPR || isClean}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "13px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      background: "#ffffff",
                      color: "#1e293b",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                {createdPRUrl && (
                  <div
                    style={{
                      marginBottom: "14px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#166534",
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
                    gap: "10px",
                  }}
                >
                  <button
                    type="submit"
                    disabled={isCreatingPR || isClean || !prTitle.trim()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "9px 20px",
                      fontWeight: 600,
                      fontSize: "13.5px",
                      borderRadius: "8px",
                      background:
                        isCreatingPR || isClean || !prTitle.trim()
                          ? "#e2e8f0"
                          : "#1a73e8",
                      color:
                        isCreatingPR || isClean || !prTitle.trim()
                          ? "#94a3b8"
                          : "#ffffff",
                      border: "none",
                      cursor:
                        isCreatingPR || isClean || !prTitle.trim()
                          ? "not-allowed"
                          : "pointer",
                      boxShadow:
                        isCreatingPR || isClean || !prTitle.trim()
                          ? "none"
                          : "0 2px 6px rgba(26, 115, 232, 0.25)",
                      transition: "all 0.16s ease",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "18px",
                        animation: isCreatingPR
                          ? "spin 1s linear infinite"
                          : "none",
                      }}
                    >
                      {isCreatingPR ? "progress_activity" : "call_split"}
                    </span>
                    {isCreatingPR ? "Criando Proposta..." : "Propor Alteração"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: SISTEMA & TEMPLATES (Configurações, Dicionário e Modelos)
            ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "system" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {allSystemDraftFiles.length === 0 ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    padding: "48px 24px",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "44px",
                      color: "#16a34a",
                      marginBottom: "12px",
                    }}
                  >
                    check_circle
                  </span>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Nenhuma Alteração de Sistema Pendente
                  </h4>
                  <p
                    style={{
                      margin: "8px auto 0 auto",
                      fontSize: "13.5px",
                      color: "#64748b",
                      maxWidth: "480px",
                      lineHeight: "1.5",
                    }}
                  >
                    Todos os templates (<code>.templates.json</code>), termos do
                    dicionário (<code>.dictionary.json</code>) e arquivos de
                    configuração do projeto estão sincronizados com a versão
                    oficial.
                  </p>
                </div>
              ) : (
                <>
                  {/* System Files List */}
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
                        <div
                          key={f.path}
                          style={{
                            background: "#ffffff",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            overflow: "hidden",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 18px",
                              background: "#f8fafc",
                              borderBottom: isExpanded
                                ? "1px solid #e2e8f0"
                                : "none",
                              flexWrap: "wrap",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "22px", color: "#3b82f6" }}
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
                                    color: "#0f172a",
                                  }}
                                >
                                  {f.friendlyName}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontFamily: "var(--font-mono, monospace)",
                                    color: "#64748b",
                                  }}
                                >
                                  {f.path}
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
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  background:
                                    f.type === "ADDED"
                                      ? "#dcfce7"
                                      : f.type === "DELETED"
                                        ? "#fee2e2"
                                        : "#e0f2fe",
                                  color:
                                    f.type === "ADDED"
                                      ? "#16a34a"
                                      : f.type === "DELETED"
                                        ? "#dc2626"
                                        : "#0284c7",
                                }}
                              >
                                {f.type === "ADDED"
                                  ? "NOVO"
                                  : f.type === "DELETED"
                                    ? "REMOVIDO"
                                    : "MODIFICADO"}
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleSystemFile(f.path)}
                                style={{
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "16px" }}
                                >
                                  {isExpanded ? "expand_less" : "expand_more"}
                                </span>
                                {isExpanded
                                  ? "Ocultar Diferenças"
                                  : "Ver Diferenças (Diff)"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDiscard(f.path)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #fca5a5",
                                  background: "#fff",
                                  color: "#dc2626",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Descartar alterações neste arquivo de sistema"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: "15px" }}
                                >
                                  delete
                                </span>
                                Descartar
                              </button>
                            </div>
                          </div>

                          {/* Diff Viewer Body */}
                          {isExpanded && renderDiffViewer(diffText, isLoading)}
                        </div>
                      );
                    })}
                  </div>

                  {/* Proposal Form for System changes */}
                  <form
                    onSubmit={handleCreateProposal}
                    style={{
                      background: "#ffffff",
                      padding: "24px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#0f172a",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "20px", color: "#1a73e8" }}
                        >
                          alt_route
                        </span>
                        Publicar ou Propor Atualização de Sistema
                      </h3>

                      <button
                        type="button"
                        onClick={handleGenerateSummaryAI}
                        disabled={
                          isGeneratingAI || allSystemDraftFiles.length === 0
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background:
                            "linear-gradient(135deg, #eef2ff, #ede9fe)",
                          color: "#4f46e5",
                          border: "1px solid #c7d2fe",
                          cursor: isGeneratingAI ? "not-allowed" : "pointer",
                        }}
                      >
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
                        {isGeneratingAI
                          ? "Gerando resumo..."
                          : "Gerar Resumo com IA"}
                      </button>
                    </div>

                    <p
                      style={{
                        fontSize: "12.5px",
                        color: "#64748b",
                        margin: "0 0 14px 0",
                      }}
                    >
                      Ao criar a proposta, uma revisão será aberta para que os
                      novos templates e configurações sejam compartilhados e
                      replicados para toda a equipe.
                    </p>

                    <div style={{ marginBottom: "12px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "4px",
                        }}
                      >
                        Título da Proposta de Sistema *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: chore(templates): atualizar modelos canônicos de especificação"
                        value={prTitle}
                        onChange={(e) => setPrTitle(e.target.value)}
                        disabled={isCreatingPR}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          fontSize: "13.5px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          background: "#ffffff",
                          color: "#1e293b",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "4px",
                        }}
                      >
                        Descrição das Modificações (Opcional)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detalhe o que foi alterado nos templates ou configurações..."
                        value={prDescription}
                        onChange={(e) => setPrDescription(e.target.value)}
                        disabled={isCreatingPR}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          fontSize: "13px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          background: "#ffffff",
                          color: "#1e293b",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <button
                        type="submit"
                        disabled={isCreatingPR || !prTitle.trim()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "9px 20px",
                          fontWeight: 600,
                          fontSize: "13.5px",
                          borderRadius: "8px",
                          background:
                            isCreatingPR || !prTitle.trim()
                              ? "#e2e8f0"
                              : "#1a73e8",
                          color:
                            isCreatingPR || !prTitle.trim()
                              ? "#94a3b8"
                              : "#ffffff",
                          border: "none",
                          cursor:
                            isCreatingPR || !prTitle.trim()
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px" }}
                        >
                          {isCreatingPR ? "progress_activity" : "publish"}
                        </span>
                        {isCreatingPR
                          ? "Criando Proposta..."
                          : "Criar Proposta de Evolução"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

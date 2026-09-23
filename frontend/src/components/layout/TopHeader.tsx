import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";

interface TopHeaderProps {
  onBackToRepos: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenGitModal?: () => void;
  onOpenTour?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onBackToRepos,
  onOpenDiffModal,
  onToggleCopilot,
  onOpenGitModal = () => {},
  onOpenTour = () => {},
}) => {
  const { activeRepo, pendingChanges, gitStatus, isLoadingWorkspace } = useWorkspace();

  const currentBranch =
    gitStatus?.branch || (activeRepo?.is_local ? "local" : "main");
  const isGitClean = gitStatus?.isClean ?? true;
  const gitFilesCount = gitStatus?.files?.length || 0;

  return (
    <header className="dashboard-navbar" style={{ position: 'relative' }}>
      {isLoadingWorkspace && (
        <div className="repos-linear-progress-track" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2.5px', zIndex: 10 }}>
          <div className="repos-linear-progress-bar"></div>
        </div>
      )}
      <div className="dash-brand">
        <button
          id="btn-back-to-repos"
          className="btn-dash-back"
          type="button"
          title="Voltar para a lista de Repositórios"
          onClick={onBackToRepos}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "20px" }}
          >
            arrow_back
          </span>
        </button>
        <div className="dash-brand-divider"></div>
        <div className="dash-title-wrap">
          <div className="dash-title-row">
            <h1 id="dash-repo-title">{activeRepo?.name || "Projeto"}</h1>
            {isLoadingWorkspace && (
              <span
                className="material-symbols-outlined spinning"
                style={{ fontSize: "16px", color: "var(--md-sys-color-primary, #1a73e8)" }}
                title="Carregando workspace..."
              >
                progress_activity
              </span>
            )}

            {/* Git Branch & Status Pill */}
            <button
              id="btn-open-git-status-header"
              className="btn btn-ghost btn-xs"
              type="button"
              title="Abrir Painel Git (Branch, Status, Histórico e Sync)"
              onClick={onOpenGitModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 8px",
                borderRadius: "12px",
                background: isGitClean
                  ? "var(--bg-surface, rgba(255,255,255,0.06))"
                  : "rgba(234, 179, 8, 0.15)",
                border: `1px solid ${isGitClean ? "var(--border-color, rgba(255,255,255,0.12))" : "rgba(234, 179, 8, 0.4)"}`,
                cursor: "pointer",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "14px",
                  color: isGitClean ? "var(--primary, #3b82f6)" : "#eab308",
                }}
              >
                alt_route
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-normal)",
                }}
              >
                {currentBranch}
              </span>
              <span
                className={`pill-dot ${isGitClean ? "success" : "warning"}`}
                style={{ margin: 0, padding: 0 }}
              >
                <span
                  className="dot"
                  style={{ width: "6px", height: "6px" }}
                ></span>
              </span>
            </button>
          </div>
          <span className="dash-meta">
            {activeRepo?.full_name && !activeRepo.is_local ? (
              <a
                id="dash-repo-link"
                href={`https://github.com/${activeRepo.full_name}`}
                target="_blank"
                rel="noreferrer"
              >
                GitHub: {activeRepo.full_name} ↗
              </a>
            ) : (
              <span id="dash-repo-link">Git Local Ativo</span>
            )}
          </span>
        </div>
      </div>

      <div className="dash-nav-right">
        {/* Quick Git Control Button */}
        <button
          id="btn-quick-git-control"
          className="btn btn-secondary btn-sm"
          type="button"
          title="Abrir Painel de Controle Git"
          onClick={onOpenGitModal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "12px",
          }}
        >
          <span
            className="material-symbols-outlined icon-xs"
            style={{ color: isGitClean ? "inherit" : "#eab308" }}
          >
            commit
          </span>
          <span>Git</span>
          {gitFilesCount > 0 && (
            <span
              className="badge badge-warning"
              style={{ fontSize: "10px", padding: "1px 5px" }}
            >
              {gitFilesCount}
            </span>
          )}
        </button>

        <button
          id="btn-open-workspace-diff"
          className="btn btn-warning btn-sm"
          style={{
            display: pendingChanges.length > 0 ? "inline-flex" : "none",
          }}
          onClick={onOpenDiffModal}
        >
          <span className="dot warning-dot"></span>
          <span id="pending-changes-badge-text">
            {pendingChanges.length} alterações
          </span>{" "}
          &bull; Revisar PR
        </button>

        <button
          id="btn-open-onboarding-tour"
          className="btn-dash-tour"
          type="button"
          title="Guia Rápido & Funcionalidades do Sistema"
          onClick={onOpenTour}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "17px", color: "var(--primary, #3b82f6)" }}
          >
            explore
          </span>
        </button>

        <button
          id="btn-global-ai-copilot"
          className="btn-dash-ai-copilot"
          type="button"
          title="Abrir Assistente & Copilot IA em Qualquer Tela"
          onClick={onToggleCopilot}
        >
          <span className="material-symbols-outlined ai-sparkle-icon">
            auto_awesome
          </span>
          <span className="ai-copilot-label">Copilot IA</span>
        </button>
      </div>
    </header>
  );
};

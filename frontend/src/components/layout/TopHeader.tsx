import React, { useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { isPathHidden } from "../../utils/hidden-files";

interface TopHeaderProps {
  onBackToRepos: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenGitModal?: () => void;
  onNavigateToEdits?: (tab?: 'drafts' | 'whats-new') => void;
  onOpenTour?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onBackToRepos,
  onOpenDiffModal,
  onToggleCopilot,
  onOpenGitModal = () => {},
  onNavigateToEdits,
  onOpenTour = () => {},
}) => {
  const { activeRepo, pendingChanges, isLoadingWorkspace } =
    useWorkspace();

  const filteredPendingChanges = useMemo(() => {
    return (pendingChanges || []).filter(
      (c) => c?.path && !isPathHidden(c.path)
    );
  }, [pendingChanges]);

  const handleGoToEdits = (tab?: 'drafts' | 'whats-new') => {
    if (onNavigateToEdits) {
      onNavigateToEdits(tab);
    } else if (tab === 'drafts' && onOpenDiffModal) {
      onOpenDiffModal();
    } else {
      onOpenGitModal();
    }
  };

  return (
    <header className="dashboard-navbar" style={{ position: "relative" }}>
      {isLoadingWorkspace && (
        <div
          className="repos-linear-progress-track"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2.5px",
            zIndex: 10,
          }}
        >
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
            {activeRepo?.full_name && !activeRepo.is_local && (
              <a
                id="dash-repo-github-link"
                href={`https://github.com/${activeRepo.full_name}`}
                target="_blank"
                rel="noreferrer"
                className="dash-repo-github-icon-btn"
                title={`Abrir no GitHub (${activeRepo.full_name})`}
                aria-label={`Abrir repositório ${activeRepo.full_name} no GitHub`}
              >
                <svg
                  height="18"
                  width="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{ display: "block" }}
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            )}
            {isLoadingWorkspace && (
              <span
                className="material-symbols-outlined spinning"
                style={{
                  fontSize: "16px",
                  color: "var(--md-sys-color-primary, #1a73e8)",
                }}
                title="Carregando workspace..."
              >
                progress_activity
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dash-nav-right">
        {filteredPendingChanges.length > 0 && (
          <button
            id="btn-open-workspace-diff"
            className="btn btn-warning btn-sm"
            onClick={() => handleGoToEdits('drafts')}
            title="Ver minhas alterações e rascunhos na Central de Edições"
          >
            <span className="dot warning-dot"></span>
            <span id="pending-changes-badge-text">
              {filteredPendingChanges.length} {filteredPendingChanges.length === 1 ? 'alteração' : 'alterações'}
            </span>
          </button>
        )}

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

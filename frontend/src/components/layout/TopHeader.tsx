import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";

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
  const { activeRepo, pendingChanges, isLoadingWorkspace, hasUnreadWhatsNew } =
    useWorkspace();

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
          <span className="dash-meta">
            {activeRepo?.full_name && !activeRepo.is_local ? (
              <a
                id="dash-repo-link"
                href={`https://github.com/${activeRepo.full_name}`}
                target="_blank"
                rel="noreferrer"
              >
                Documentação: {activeRepo.full_name} ↗
              </a>
            ) : (
              <span id="dash-repo-link">Documentação Local</span>
            )}
          </span>
        </div>
      </div>

      <div className="dash-nav-right">
        {/* Quick Edições Button */}
        <button
          id="btn-quick-git-control"
          className="btn btn-secondary btn-sm"
          type="button"
          title="Central de Edições"
          onClick={() => handleGoToEdits(hasUnreadWhatsNew ? 'whats-new' : 'drafts')}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            position: "relative"
          }}
        >
          <span
            className="material-symbols-outlined icon-xs"
          >
            history_edu
          </span>
          <span>Edições</span>

          {hasUnreadWhatsNew && (
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
                display: "inline-block",
                marginLeft: "2px",
              }}
              title="Novidades disponíveis!"
            />
          )}
        </button>

        <button
          id="btn-open-workspace-diff"
          className="btn btn-warning btn-sm"
          style={{
            display: pendingChanges.length > 0 ? "inline-flex" : "none",
          }}
          onClick={() => handleGoToEdits('drafts')}
          title="Ver minhas alterações e rascunhos na Central de Edições"
        >
          <span className="dot warning-dot"></span>
          <span id="pending-changes-badge-text">
            {pendingChanges.length} alterações
          </span>
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

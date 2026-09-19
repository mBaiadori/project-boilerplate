import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface TopHeaderProps {
  onBackToRepos: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenTour?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onBackToRepos,
  onOpenDiffModal,
  onToggleCopilot,
  onOpenTour = () => {}
}) => {
  const { activeRepo, pendingChanges } = useWorkspace();

  return (
    <header className="dashboard-navbar">
      <div className="dash-brand">
        <button
          id="btn-back-to-repos"
          className="btn-dash-back"
          type="button"
          title="Voltar para a lista de Repositórios"
          onClick={onBackToRepos}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            arrow_back
          </span>
        </button>
        <div className="dash-brand-divider"></div>
        <div className="dash-title-wrap">
          <div className="dash-title-row">
            <h1 id="dash-repo-title">{activeRepo?.name || 'Projeto'}</h1>
            <span className="pill-dot protected">
              <span className="dot"></span> {activeRepo?.is_local ? 'local' : 'main'}
            </span>
          </div>
          <span className="dash-meta">
            {activeRepo?.full_name && !activeRepo.is_local ? (
              <a
                id="dash-repo-link"
                href={`https://github.com/${activeRepo.full_name}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver no GitHub ↗
              </a>
            ) : (
              <span id="dash-repo-link">Modo Local / Offline</span>
            )}
          </span>
        </div>
      </div>

      <div className="dash-nav-right">
        <button
          id="btn-open-onboarding-tour"
          className="btn-dash-tour"
          type="button"
          title="Guia Interativo & Tour do Projeto"
          onClick={onOpenTour}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            explore
          </span>
        </button>

        <button
          id="btn-open-workspace-diff"
          className="btn btn-warning btn-sm"
          style={{ display: pendingChanges.length > 0 ? 'inline-flex' : 'none' }}
          onClick={onOpenDiffModal}
        >
          <span className="dot warning-dot"></span>
          <span id="pending-changes-badge-text">{pendingChanges.length} alterações</span> &bull; Revisar PR
        </button>

        <button
          id="btn-global-ai-copilot"
          className="btn-dash-ai-copilot"
          type="button"
          title="Abrir Assistente & Copilot IA em Qualquer Tela"
          onClick={onToggleCopilot}
        >
          <span className="material-symbols-outlined ai-sparkle-icon">auto_awesome</span>
          <span className="ai-copilot-label">Copilot IA</span>
        </button>
      </div>
    </header>
  );
};

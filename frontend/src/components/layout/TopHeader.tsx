import React, { useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import { isPathHidden } from "../../utils/hidden-files";
import { IconButton, Button, Badge, Spinner } from "../ui";
import {
  ArrowLeft,
  Sparkles,
  HelpCircle,
  ExternalLink,
  User,
} from "lucide-react";
import { OrgSelectorDropdown } from "./OrgSelectorDropdown";

interface TopHeaderProps {
  onBackToRepos: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenGitModal?: () => void;
  onNavigateToEdits?: (tab?: "drafts" | "whats-new") => void;
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
  const { activeRepo, pendingChanges, isLoadingWorkspace } = useWorkspace();
  const { user, provider } = useAuth();
  const providerLabel = provider === "github" ? "GitHub" : "Modo Local";

  const getRepoWebUrl = () => {
    if (activeRepo?.html_url) return activeRepo.html_url;
    return `https://github.com/${activeRepo?.full_name}`;
  };

  const filteredPendingChanges = useMemo(() => {
    return (pendingChanges || []).filter(
      (c) => c?.path && !isPathHidden(c.path),
    );
  }, [pendingChanges]);

  const handleGoToEdits = (tab?: "drafts" | "whats-new") => {
    if (onNavigateToEdits) {
      onNavigateToEdits(tab);
    } else if (tab === "drafts" && onOpenDiffModal) {
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
        <IconButton
          id="btn-back-to-repos"
          bordered
          size="md"
          tooltip="Voltar para a lista de Repositórios"
          onClick={onBackToRepos}
        >
          <ArrowLeft size={18} />
        </IconButton>

        {user?.avatar_url ? (
          <img
            id="dash-user-avatar"
            src={user.avatar_url}
            alt={user.name || user.login || "Usuário"}
            title={user.name || user.login || "Usuário"}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              display: "block",
            }}
          />
        ) : (
          <div
            id="dash-user-avatar"
            title={user?.name || user?.login || "Usuário"}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-container, #d2e3fc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary, #1a73e8)",
              flexShrink: 0,
            }}
          >
            <User size={15} />
          </div>
        )}

        <div className="dash-brand-divider"></div>
        <div className="dash-title-wrap">
          <div className="dash-title-row">
            <h1 id="dash-repo-title">{activeRepo?.name || "Projeto"}</h1>
            {activeRepo?.full_name && !activeRepo.is_local && (
              <a
                id="dash-repo-github-link"
                href={getRepoWebUrl()}
                target="_blank"
                rel="noreferrer"
                className="dash-repo-github-icon-btn"
                title={`Abrir no ${providerLabel} (${activeRepo.full_name})`}
                aria-label={`Abrir repositório ${activeRepo.full_name} no ${providerLabel}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <ExternalLink size={14} />
              </a>
            )}
            {isLoadingWorkspace && (
              <Spinner size="sm" style={{ marginLeft: 4 }} />
            )}
          </div>
        </div>
      </div>

      <div className="dash-nav-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <OrgSelectorDropdown />

        {filteredPendingChanges.length > 0 && (
          <Button
            id="btn-open-workspace-diff"
            variant="subtle"
            size="sm"
            onClick={() => handleGoToEdits("drafts")}
            title="Ver minhas alterações e rascunhos na Central de Edições"
            leftIcon={<Badge variant="warning" size="sm" hasDot>{filteredPendingChanges.length}</Badge>}
          >
            <span id="pending-changes-badge-text">
              {filteredPendingChanges.length === 1
                ? "alteração"
                : "alterações"}
            </span>
          </Button>
        )}

        <IconButton
          id="btn-open-onboarding-tour"
          size="md"
          tooltip="Guia Rápido & Funcionalidades do Sistema"
          onClick={onOpenTour}
        >
          <HelpCircle size={18} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
        </IconButton>

        <Button
          id="btn-global-ai-copilot"
          variant="primary"
          size="sm"
          leftIcon={<Sparkles size={16} />}
          onClick={onToggleCopilot}
          title="Abrir Assistente & Copilot IA em Qualquer Tela"
        >
          Copilot IA
        </Button>
      </div>
    </header>
  );
};

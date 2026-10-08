import React, { useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import { isPathHidden } from "../../utils/hidden-files";
import { IconButton, Button, Badge } from "../ui";
import {
  Sparkles,
  HelpCircle,
  User,
  Shield,
  CloudDownload,
} from "lucide-react";
import { OrgSelectorDropdown } from "./OrgSelectorDropdown";

interface TopHeaderProps {
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenGitModal?: () => void;
  onNavigateToEdits?: (tab?: "drafts" | "whats-new") => void;
  onOpenTour?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = React.memo(
  ({
    onOpenDiffModal,
    onToggleCopilot,
    onOpenGitModal = () => {},
    onNavigateToEdits,
    onOpenTour = () => {},
  }) => {
    const {
      activeRepo,
      pendingChanges,
      effectivePermission,
      isLoadingPermission,
      hasRemoteUpdates,
      syncGit,
    } = useWorkspace();
    const { user } = useAuth();

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
        <div className="dash-brand">
          {user?.avatar_url ? (
            <img
              id="dash-user-avatar"
              src={user.avatar_url}
              alt={user.name || user.login || "Usuário"}
              title={user.name || user.login || "Usuário"}
              loading="eager"
              decoding="async"
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
          {isLoadingPermission || !effectivePermission ? (
            <div
              id="dash-user-perm-skeleton"
              title="Carregando permissões do GitHub..."
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "84px",
                height: "20px",
                borderRadius: "9999px",
                backgroundColor:
                  "var(--md-sys-color-surface-container-high, #e8eaed)",
                opacity: 0.7,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ) : (
            <span
              id="dash-user-perm-badge"
              title={`Seu papel efetivo: ${effectivePermission.roleName} (Permissão: ${effectivePermission.repoPermission})`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "9999px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                backgroundColor:
                  effectivePermission.isOrgOwner ||
                  effectivePermission.allowedActions.canAdmin
                    ? "rgba(236, 72, 153, 0.12)"
                    : effectivePermission.allowedActions.canMaintain
                      ? "rgba(139, 92, 246, 0.12)"
                      : effectivePermission.allowedActions.canWrite
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(2, 132, 199, 0.12)",
                color:
                  effectivePermission.isOrgOwner ||
                  effectivePermission.allowedActions.canAdmin
                    ? "#ec4899"
                    : effectivePermission.allowedActions.canMaintain
                      ? "#8b5cf6"
                      : effectivePermission.allowedActions.canWrite
                        ? "#10b981"
                        : "#0284c7",
                border: `1px solid ${
                  effectivePermission.isOrgOwner ||
                  effectivePermission.allowedActions.canAdmin
                    ? "rgba(236, 72, 153, 0.3)"
                    : effectivePermission.allowedActions.canMaintain
                      ? "rgba(139, 92, 246, 0.3)"
                      : effectivePermission.allowedActions.canWrite
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(2, 132, 199, 0.3)"
                }`,
              }}
            >
              <Shield size={11} />
              {effectivePermission.roleName}
            </span>
          )}
        </div>

        {/* Centro absoluto da barra de navegação: SOMENTE o nome do repositório e atualização remota */}
        <div
          className="dash-header-center"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            pointerEvents: "auto",
            maxWidth: "calc(100% - 460px)",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <h1
            id="dash-repo-title"
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 700,
              color: "var(--text-heading)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeRepo?.name || "Projeto"}
          </h1>

          {hasRemoteUpdates && (
            <button
              id="dash-repo-remote-update-badge"
              type="button"
              onClick={() => syncGit()}
              title="Existem novos commits no GitHub. Clique para puxar atualizações sem perder rascunhos."
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: "9999px",
                backgroundColor: "rgba(37, 99, 235, 0.12)",
                color: "var(--color-primary, #2563eb)",
                border: "1px solid rgba(37, 99, 235, 0.3)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <CloudDownload size={13} />
              Atualização remota disponível
            </button>
          )}
        </div>

        <div
          className="dash-nav-right"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minHeight: "36px",
          }}
        >
          <OrgSelectorDropdown />

          {filteredPendingChanges.length > 0 && (
            <Button
              id="btn-open-workspace-diff"
              variant="subtle"
              size="sm"
              onClick={() => handleGoToEdits("drafts")}
              title="Ver minhas alterações e rascunhos na Central de Edições"
              leftIcon={
                <Badge variant="warning" size="sm" hasDot>
                  {filteredPendingChanges.length}
                </Badge>
              }
              style={{
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
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
            <HelpCircle
              size={18}
              style={{ color: "var(--md-sys-color-primary, #1a73e8)" }}
            />
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
  },
);

TopHeader.displayName = "TopHeader";

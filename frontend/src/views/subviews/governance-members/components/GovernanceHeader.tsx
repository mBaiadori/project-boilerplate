import React from "react";
import { FolderGit2, Plus, Shield, UserPlus } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import type { GovernanceTab } from "../types";

interface GovernanceHeaderProps {
  isSoloMode: boolean;
  collaboratorsCount: number;
  orgLogin: string;
  repoName: string;
  activeTab: GovernanceTab;
  isAdmin: boolean;
  onOpenInviteModal: () => void;
  onOpenCreateTeamModal: () => void;
}

export const GovernanceHeader: React.FC<GovernanceHeaderProps> = ({
  isSoloMode,
  collaboratorsCount,
  orgLogin,
  repoName,
  activeTab,
  isAdmin,
  onOpenInviteModal,
  onOpenCreateTeamModal,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "rgba(99, 102, 241, 0.15)",
            color: "var(--color-primary, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Shield size={24} />
        </div>
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              margin: 0,
              color: "var(--color-on-surface, #ffffff)",
            }}
          >
            Governança de Acesso & Repositório
          </h1>
          <p
            style={{
              fontSize: "13px",
              margin: "4px 0 0",
              color: "var(--color-outline, #a6adc8)",
            }}
          >
            Gerencie colaboradores, equipes da organização, proteção de
            branches e validações CI/CD integradas ao GitHub.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
          }}
        >
          <Badge variant={isSoloMode ? "neutral" : "success"} size="md">
            {isSoloMode
              ? "Modo Solo (1 Membro)"
              : `Modo Equipe (${collaboratorsCount} Membros)`}
          </Badge>

          <Badge
            variant="primary"
            size="xs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontWeight: 600,
            }}
          >
            <FolderGit2 size={11} style={{ flexShrink: 0 }} />
            @{orgLogin}/{repoName || "repositório"}
          </Badge>
        </div>

        {activeTab === "members" && isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenInviteModal}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <UserPlus size={15} />
            <span>Convidar Membro</span>
          </Button>
        )}

        {activeTab === "teams" && isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenCreateTeamModal}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={15} />
            <span>Nova Equipe</span>
          </Button>
        )}
      </div>
    </div>
  );
};

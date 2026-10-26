import React from "react";
import { Bell, GitBranch, Layers, Users } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import type { GovernanceTab } from "../types";

interface GovernanceTabsProps {
  activeTab: GovernanceTab;
  onSelectTab: (tab: GovernanceTab) => void;
  collaboratorsCount: number;
  teamsCount: number;
  isWorkflowInstalled?: boolean;
}

export const GovernanceTabs: React.FC<GovernanceTabsProps> = ({
  activeTab,
  onSelectTab,
  collaboratorsCount,
  teamsCount,
  isWorkflowInstalled,
}) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        borderBottom:
          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
        marginBottom: "24px",
        overflowX: "auto",
      }}
    >
      <button
        onClick={() => onSelectTab("members")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          background: "none",
          border: "none",
          borderBottom:
            activeTab === "members"
              ? "2px solid var(--color-primary, #6366f1)"
              : "2px solid transparent",
          color:
            activeTab === "members"
              ? "var(--color-primary, #6366f1)"
              : "var(--color-outline, #a6adc8)",
          fontWeight: activeTab === "members" ? 600 : 500,
          cursor: "pointer",
          fontSize: "14px",
          whiteSpace: "nowrap",
        }}
      >
        <Users size={16} />
        <span>Membros & Colaboradores ({collaboratorsCount})</span>
      </button>

      <button
        onClick={() => onSelectTab("teams")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          background: "none",
          border: "none",
          borderBottom:
            activeTab === "teams"
              ? "2px solid var(--color-primary, #6366f1)"
              : "2px solid transparent",
          color:
            activeTab === "teams"
              ? "var(--color-primary, #6366f1)"
              : "var(--color-outline, #a6adc8)",
          fontWeight: activeTab === "teams" ? 600 : 500,
          cursor: "pointer",
          fontSize: "14px",
          whiteSpace: "nowrap",
        }}
      >
        <Layers size={16} />
        <span>Equipes da Org ({teamsCount})</span>
      </button>

      <button
        onClick={() => onSelectTab("protection")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          background: "none",
          border: "none",
          borderBottom:
            activeTab === "protection"
              ? "2px solid var(--color-primary, #6366f1)"
              : "2px solid transparent",
          color:
            activeTab === "protection"
              ? "var(--color-primary, #6366f1)"
              : "var(--color-outline, #a6adc8)",
          fontWeight: activeTab === "protection" ? 600 : 500,
          cursor: "pointer",
          fontSize: "14px",
          whiteSpace: "nowrap",
        }}
      >
        <GitBranch size={16} />
        <span>Proteção & Actions CI/CD</span>
        {isWorkflowInstalled && (
          <Badge variant="success" size="xs">
            Actions Ativo
          </Badge>
        )}
      </button>

      <button
        onClick={() => onSelectTab("notifications")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          background: "none",
          border: "none",
          borderBottom:
            activeTab === "notifications"
              ? "2px solid var(--color-primary, #6366f1)"
              : "2px solid transparent",
          color:
            activeTab === "notifications"
              ? "var(--color-primary, #6366f1)"
              : "var(--color-outline, #a6adc8)",
          fontWeight: activeTab === "notifications" ? 600 : 500,
          cursor: "pointer",
          fontSize: "14px",
          whiteSpace: "nowrap",
        }}
      >
        <Bell size={16} />
        <span>Notificações & Alertas</span>
      </button>
    </div>
  );
};

import React from "react";
import { Layers, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import type { OrganizationTeamInfo } from "../../../../types";

interface TeamsTabProps {
  orgLogin: string;
  isAdmin: boolean;
  onOpenCreateTeamModal: () => void;
  isLoadingTeams: boolean;
  teams: OrganizationTeamInfo[];
  onDeleteTeam: (teamSlug: string) => void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  orgLogin,
  isAdmin,
  onOpenCreateTeamModal,
  isLoadingTeams,
  teams,
  onDeleteTeam,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "10px",
          backgroundColor:
            "var(--color-surface-container, rgba(255, 255, 255, 0.03))",
          border:
            "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(99, 102, 241, 0.12)",
              color: "var(--color-primary, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 2px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-on-surface, #ffffff)",
              }}
            >
              Gestão de Equipes (GitHub Teams)
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--color-outline, #a6adc8)",
                lineHeight: 1.4,
              }}
            >
              Crie e organize squads da organização{" "}
              <strong>@{orgLogin}</strong> para conceder permissões em lote a
              múltiplos repositórios.
            </p>
          </div>
        </div>

        {isAdmin && (
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

      {isLoadingTeams ? (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            color: "var(--color-outline, #a6adc8)",
          }}
        >
          Carregando equipes da organização...
        </div>
      ) : teams.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "14px",
          }}
        >
          {teams.map((team) => (
            <Card
              key={team.slug || team.id}
              variant="flat"
              padding="md"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--color-on-surface, #ffffff)",
                      }}
                    >
                      {team.name}
                    </span>
                    <Badge variant="primary" size="xs">
                      @{orgLogin}/{team.slug}
                    </Badge>
                  </div>
                  {team.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "var(--color-outline, #a6adc8)",
                        lineHeight: 1.4,
                      }}
                    >
                      {team.description}
                    </p>
                  )}
                </div>
                {team.permission && (
                  <Badge
                    variant={team.permission === "admin" ? "danger" : "success"}
                    size="xs"
                  >
                    {team.permission.toUpperCase()}
                  </Badge>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  fontSize: "12px",
                  color: "var(--color-outline, #a6adc8)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Users size={14} /> {team.members_count || 0} membros
                </span>
              </div>

              {isAdmin && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    borderTop:
                      "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                    paddingTop: "8px",
                    marginTop: "4px",
                  }}
                >
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onDeleteTeam(team.slug)}
                    style={{ color: "#ef4444", fontSize: "11px" }}
                  >
                    <Trash2 size={12} style={{ marginRight: "4px" }} /> Excluir
                    Time
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            borderRadius: "10px",
            border:
              "1px dashed var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
            color: "var(--color-outline, #a6adc8)",
            fontSize: "13px",
          }}
        >
          <Layers
            size={32}
            style={{ margin: "0 auto 12px", opacity: 0.4 }}
          />
          <div>Nenhuma equipe criada nesta organização ainda.</div>
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            Clique em <strong>Nova Equipe</strong> para criar seu primeiro time
            ou squad.
          </div>
        </div>
      )}
    </div>
  );
};

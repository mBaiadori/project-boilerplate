import React from "react";
import { AlertTriangle, Edit2, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import type { CollaboratorInfo } from "../../../../types";
import { PERMISSION_CONFIG } from "../types";

interface MembersTabProps {
  githubAuthError: string | null;
  isLoadingCollabs: boolean;
  onRefreshCollaborators: () => void;
  collaborators: CollaboratorInfo[];
  isAdmin: boolean;
  onEditCollab: (collab: CollaboratorInfo) => void;
  onRemoveCollaborator: (username: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  githubAuthError,
  isLoadingCollabs,
  onRefreshCollaborators,
  collaborators,
  isAdmin,
  onEditCollab,
  onRemoveCollaborator,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {githubAuthError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(234, 179, 8, 0.1)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            color: "#fde047",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "#eab308", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>{githubAuthError}</div>
          <Button
            variant="outline"
            size="xs"
            onClick={onRefreshCollaborators}
            disabled={isLoadingCollabs}
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          margin: "4px 0",
        }}
      >
        <Button
          variant="outline"
          size="xs"
          onClick={onRefreshCollaborators}
          disabled={isLoadingCollabs}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw
            size={13}
            className={isLoadingCollabs ? "animate-spin" : ""}
          />
          <span>Sincronizar Git</span>
        </Button>
      </div>

      {/* Tabela de Colaboradores */}
      <Card variant="flat" padding="none" style={{ overflow: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--color-surface-container-high, #1e1e2e)",
                borderBottom:
                  "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                fontSize: "12px",
                color: "var(--color-outline, #a6adc8)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <th style={{ padding: "12px 16px" }}>Colaborador</th>
              <th style={{ padding: "12px 16px" }}>Tipo de Vínculo</th>
              <th style={{ padding: "12px 16px" }}>
                Permissão no Repositório
              </th>
              {isAdmin && (
                <th style={{ padding: "12px 16px", textAlign: "right" }}>
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {collaborators.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  style={{
                    padding: "28px",
                    textAlign: "center",
                    color: "var(--color-outline, #a6adc8)",
                  }}
                >
                  Nenhum colaborador encontrado para este repositório.
                </td>
              </tr>
            ) : (
              collaborators.map((collab) => {
                const permMeta =
                  PERMISSION_CONFIG[collab.permission] ||
                  PERMISSION_CONFIG.push;

                return (
                  <tr
                    key={collab.login}
                    style={{
                      borderBottom:
                        "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                      fontSize: "13px",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <img
                          src={collab.avatar_url}
                          alt={collab.login}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: "#313244",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--color-on-surface, #cdd6f4)",
                            }}
                          >
                            @{collab.login}
                          </div>
                          {collab.is_owner && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--color-primary, #6366f1)",
                                fontWeight: 500,
                              }}
                            >
                              Proprietário do Repositório
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {collab.is_owner ? (
                        <Badge variant="primary" size="xs">
                          Owner
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="xs">
                          Colaborador do Repositório
                        </Badge>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          backgroundColor: permMeta.bg,
                          color: permMeta.color,
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: permMeta.color,
                          }}
                        />
                        {permMeta.label}
                      </span>
                    </td>

                    {isAdmin && (
                      <td
                        style={{ padding: "12px 16px", textAlign: "right" }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => onEditCollab(collab)}
                            style={{ padding: "6px 10px" }}
                            title="Alterar nível de permissão"
                          >
                            <Edit2
                              size={13}
                              style={{ marginRight: "4px" }}
                            />
                            <span>Alterar Permissão</span>
                          </Button>
                          {!collab.is_owner && (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => onRemoveCollaborator(collab.login)}
                              style={{ padding: "6px 10px" }}
                              title="Remover colaborador do repositório"
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

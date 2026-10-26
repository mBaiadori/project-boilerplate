import React, { useMemo } from "react";
import { Building2, User, Check, ArrowRight } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../ui";

interface SelectOrgModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const SelectOrgModal: React.FC<SelectOrgModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { orgs, activeOrg, selectOrg } = useWorkspace();
  const { user } = useAuth();

  const displayOrgs = useMemo(() => {
    const list = [...(orgs || [])];
    if (
      user?.login &&
      !list.some((o) => o.login.toLowerCase() === user.login.toLowerCase())
    ) {
      list.unshift({
        login: user.login,
        full_name: `${user.name || user.login} (Pessoal)`,
        avatar_url: user.avatar_url,
        is_personal: true,
      });
    }
    return list;
  }, [orgs, user?.login, user?.name, user?.avatar_url]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose ? onClose : () => {}}
      title="Selecione seu Espaço de Trabalho"
    >
      <div style={{ padding: "8px 0 16px 0" }}>
        <p
          style={{
            margin: "0 0 18px 0",
            fontSize: "14px",
            color: "var(--md-sys-color-on-surface-variant, #5f6368)",
            lineHeight: 1.5,
          }}
        >
          Escolha uma organização ou seu perfil pessoal para carregar os projetos e repositórios correspondentes:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {displayOrgs.map((o) => {
            const isSelected = activeOrg?.login?.toLowerCase() === o.login.toLowerCase();
            const isPersonal = Boolean(
              o.is_personal ||
              o.login.toLowerCase() === (user?.login || "").toLowerCase()
            );

            return (
              <div
                key={o.login}
                role="button"
                tabIndex={0}
                onClick={async () => {
                  await selectOrg(o.login);
                  if (onClose) onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    selectOrg(o.login);
                    if (onClose) onClose();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: isSelected
                    ? "2px solid var(--md-sys-color-primary, #1a73e8)"
                    : "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                  backgroundColor: isSelected
                    ? "var(--md-sys-color-primary-container, #d2e3fc)"
                    : "var(--md-sys-color-surface-container-low, #f8f9fa)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "var(--md-sys-color-surface-container-high, #e8eaed)";
                    e.currentTarget.style.borderColor = "var(--md-sys-color-primary, #1a73e8)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "var(--md-sys-color-surface-container-low, #f8f9fa)";
                    e.currentTarget.style.borderColor = "var(--md-sys-color-outline-variant, #dadce0)";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: isSelected
                        ? "var(--md-sys-color-primary, #1a73e8)"
                        : "var(--md-sys-color-surface-container-highest, #e2e8f0)",
                      color: isSelected ? "#ffffff" : "var(--md-sys-color-on-surface, #1e293b)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isPersonal ? <User size={18} /> : <Building2 size={18} />}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--md-sys-color-on-surface, #202124)",
                      }}
                    >
                      {o.full_name || o.login}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                      }}
                    >
                      @{o.login} {isPersonal ? "• Perfil Pessoal" : "• Organização"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isSelected ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--md-sys-color-primary, #1a73e8)",
                      }}
                    >
                      <Check size={16} /> Ativo
                    </span>
                  ) : (
                    <ArrowRight size={16} color="var(--md-sys-color-on-surface-variant, #5f6368)" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

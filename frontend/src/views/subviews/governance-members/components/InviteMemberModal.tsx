import React from "react";
import { Button } from "../../../../components/ui/Button";
import { FormField } from "../../../../components/ui/FormField";
import { Modal } from "../../../../components/ui/Modal";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUsername: string;
  setInviteUsername: (val: string) => void;
  invitePermission: string;
  setInvitePermission: (val: string) => void;
  isInviting: boolean;
  inviteFeedback: { type: "success" | "error"; message: string } | null;
  onSendInvite: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  inviteUsername,
  setInviteUsername,
  invitePermission,
  setInvitePermission,
  isInviting,
  inviteFeedback,
  onSendInvite,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convidar Colaborador para o Repositório"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "8px 0",
        }}
      >
        <FormField label="Nome de Usuário no GitHub" required>
          <input
            type="text"
            placeholder="Ex: octocat"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "var(--color-surface-container-high, #1e1e2e)",
              color: "var(--color-on-surface, #cdd6f4)",
              border:
                "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
              fontSize: "13px",
            }}
          />
        </FormField>

        <FormField label="Permissão Git no Repositório" required>
          <select
            value={invitePermission}
            onChange={(e) => setInvitePermission(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              background: "var(--color-surface-container-high, #1e1e2e)",
              color: "var(--color-on-surface, #cdd6f4)",
              border:
                "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
              fontSize: "13px",
            }}
          >
            <option value="push">
              Escrita (Push / Criar branches & PRs)
            </option>
            <option value="triage">
              Triagem (Triage / Gerenciar issues)
            </option>
            <option value="pull">Leitura (Pull / Clone & leitura)</option>
            <option value="maintain">
              Mantenedor (Maintain / Merge & branches)
            </option>
            <option value="admin">
              Administrador (Admin / Acesso total)
            </option>
          </select>
        </FormField>

        {inviteFeedback && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background:
                inviteFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                inviteFeedback.type === "success" ? "#10b981" : "#ef4444",
              fontSize: "13px",
            }}
          >
            {inviteFeedback.message}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSendInvite}
            disabled={isInviting || !inviteUsername.trim()}
          >
            {isInviting ? "Enviando..." : "Enviar Convite"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

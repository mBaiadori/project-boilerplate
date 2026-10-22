import React from "react";
import { Button } from "../../../../components/ui/Button";
import { FormField } from "../../../../components/ui/FormField";
import { Modal } from "../../../../components/ui/Modal";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgLogin: string;
  newTeamName: string;
  setNewTeamName: (val: string) => void;
  newTeamDesc: string;
  setNewTeamDesc: (val: string) => void;
  newTeamPrivacy: "closed" | "secret";
  setNewTeamPrivacy: (val: "closed" | "secret") => void;
  onCreateTeam: () => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  orgLogin,
  newTeamName,
  setNewTeamName,
  newTeamDesc,
  setNewTeamDesc,
  newTeamPrivacy,
  setNewTeamPrivacy,
  onCreateTeam,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Nova Equipe (GitHub Team)"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "8px 0",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--color-outline, #a6adc8)",
            lineHeight: 1.5,
          }}
        >
          Equipes facilitam o gerenciamento de acesso a múltiplos repositórios e
          squads na organização <strong>@{orgLogin}</strong>.
        </p>

        <FormField label="Nome da Equipe" required>
          <input
            type="text"
            placeholder="Ex: Core Architecture, Squad Checkout"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
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

        <FormField label="Descrição">
          <input
            type="text"
            placeholder="Ex: Responsável pelos microsserviços e pipelines"
            value={newTeamDesc}
            onChange={(e) => setNewTeamDesc(e.target.value)}
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

        <FormField label="Visibilidade da Equipe">
          <select
            value={newTeamPrivacy}
            onChange={(e) => setNewTeamPrivacy(e.target.value as "closed" | "secret")}
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
            <option value="closed">Visível para a Org (Closed)</option>
            <option value="secret">Secreto / Privado (Secret)</option>
          </select>
        </FormField>

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
            disabled={!newTeamName.trim()}
            onClick={onCreateTeam}
          >
            Criar Equipe
          </Button>
        </div>
      </div>
    </Modal>
  );
};

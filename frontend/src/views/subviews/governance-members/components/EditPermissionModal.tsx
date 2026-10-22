import React from "react";
import { Button } from "../../../../components/ui/Button";
import { FormField } from "../../../../components/ui/FormField";
import { Modal } from "../../../../components/ui/Modal";
import type { CollaboratorInfo } from "../../../../types";

interface EditPermissionModalProps {
  editingCollab: CollaboratorInfo | null;
  onClose: () => void;
  editPermission: string;
  setEditPermission: (val: string) => void;
  isSavingEdit: boolean;
  editFeedback: { type: "success" | "error"; message: string } | null;
  onSaveEditCollab: () => void;
}

export const EditPermissionModal: React.FC<EditPermissionModalProps> = ({
  editingCollab,
  onClose,
  editPermission,
  setEditPermission,
  isSavingEdit,
  editFeedback,
  onSaveEditCollab,
}) => {
  if (!editingCollab) return null;

  return (
    <Modal
      isOpen={Boolean(editingCollab)}
      onClose={onClose}
      title={`Editar Permissão de @${editingCollab.login}`}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "8px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            borderRadius: "8px",
            background: "var(--color-surface-container-high, #1e1e2e)",
            border:
              "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          }}
        >
          <img
            src={editingCollab.avatar_url}
            alt={editingCollab.login}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#313244",
            }}
          />
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--color-on-surface, #cdd6f4)",
                fontSize: "14px",
              }}
            >
              @{editingCollab.login}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-outline, #a6adc8)",
              }}
            >
              {editingCollab.is_owner
                ? "Proprietário do Repositório"
                : "Colaborador"}
            </div>
          </div>
        </div>

        <FormField label="Permissão Git no Repositório">
          <select
            value={editPermission}
            onChange={(e) => setEditPermission(e.target.value)}
            disabled={editingCollab.is_owner}
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
            <option value="pull">Leitura (Pull)</option>
            <option value="triage">Triagem (Triage)</option>
            <option value="push">Escrita (Push)</option>
            <option value="maintain">Mantenedor (Maintain)</option>
            <option value="admin">Administrador (Admin)</option>
          </select>
        </FormField>

        {editFeedback && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background:
                editFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                editFeedback.type === "success" ? "#10b981" : "#ef4444",
              fontSize: "13px",
            }}
          >
            {editFeedback.message}
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
            onClick={onSaveEditCollab}
            disabled={isSavingEdit || editingCollab.is_owner}
          >
            {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

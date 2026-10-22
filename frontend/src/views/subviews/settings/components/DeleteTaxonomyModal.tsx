import React from "react";
import { AlertTriangle, Trash2, FileText } from "lucide-react";
import { Modal, Button } from "../../../../components/ui";
import type { DeleteDialogState } from "../types";

interface DeleteTaxonomyModalProps {
  deleteDialog: DeleteDialogState;
  onClose: () => void;
}

export const DeleteTaxonomyModal: React.FC<DeleteTaxonomyModalProps> = ({
  deleteDialog,
  onClose,
}) => {
  return (
    <Modal
      isOpen={deleteDialog.isOpen}
      onClose={onClose}
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#b91c1c",
          }}
        >
          <AlertTriangle size={18} />
          <span>
            Remover{" "}
            {deleteDialog.type === "status"
              ? "Status"
              : deleteDialog.type === "category"
                ? "Categoria"
                : deleteDialog.type === "badge"
                  ? "Tipo / Badge"
                  : "Tag"}{" "}
            em Uso
          </span>
        </div>
      }
      size="md"
      footer={
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={13} />}
            onClick={deleteDialog.onConfirm}
          >
            Desvincular e Remover
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#334155",
            lineHeight: 1.5,
          }}
        >
          O item <strong>{deleteDialog.label}</strong> está atualmente
          vinculado a{" "}
          <strong>{deleteDialog.referencingDocs.length} documento(s)</strong>{" "}
          no projeto.
        </p>
        <div
          style={{
            maxHeight: "150px",
            overflowY: "auto",
            padding: "8px 12px",
            borderRadius: "6px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {deleteDialog.referencingDocs.map((doc) => (
            <div
              key={doc.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11.5px",
                color: "#475569",
              }}
            >
              <FileText size={12} style={{ color: "#94a3b8" }} />
              <span style={{ fontWeight: 500 }}>{doc.title || doc.name}</span>
              <span
                style={{
                  fontSize: "10.5px",
                  color: "#94a3b8",
                  fontFamily: "monospace",
                }}
              >
                ({doc.path})
              </span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: "11.5px", color: "#dc2626" }}>
          Ao confirmar, este item será removido das opções e os documentos
          acima serão atualizados automaticamente.
        </span>
      </div>
    </Modal>
  );
};

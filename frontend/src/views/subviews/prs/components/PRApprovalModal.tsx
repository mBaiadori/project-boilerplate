import React from "react";
import { Button } from "../../../../components/ui";
import type { PR } from "../../../../types";
import type { ActionLoadingState } from "../types";

interface PRApprovalModalProps {
  approvalModalPR: PR | null;
  onClose: () => void;
  approvalRole: string;
  setApprovalRole: (val: string) => void;
  approvalComment: string;
  setApprovalComment: (val: string) => void;
  handleApproveSubmit: () => void;
  actionLoading: ActionLoadingState | null;
  user: any;
}

export const PRApprovalModal: React.FC<PRApprovalModalProps> = ({
  approvalModalPR,
  onClose,
  approvalRole,
  setApprovalRole,
  approvalComment,
  setApprovalComment,
  handleApproveSubmit,
  actionLoading,
  user,
}) => {
  if (!approvalModalPR) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={() =>
        actionLoading?.id !== approvalModalPR.id && onClose()
      }
    >
      <div
        className="modal-container"
        style={{
          background: "var(--color-surface, #ffffff)",
          borderRadius: "12px",
          padding: "24px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          border: "1px solid var(--color-border-subtle, #e2e8f0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="ui-row ui-row--align-center ui-row--sm"
          style={{ marginBottom: "16px" }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "28px",
              color: "var(--color-primary, #3b82f6)",
            }}
          >
            rate_review
          </span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                color: "var(--color-text-primary, #0f172a)",
                fontWeight: 700,
              }}
            >
              Aprovar Proposta #{approvalModalPR.id}
            </h3>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "12px",
                color: "var(--color-text-muted, #64748b)",
              }}
            >
              {approvalModalPR.title} &bull; Autor: {approvalModalPR.author}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "16px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--color-text-primary, #0f172a)",
                marginBottom: "6px",
              }}
            >
              Papel / Cargo do Revisor:
            </label>
            <select
              value={approvalRole}
              onChange={(e) => setApprovalRole(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border-subtle, #cbd5e1)",
                fontSize: "13px",
                background: "var(--color-surface, #ffffff)",
                color: "var(--color-text-primary, #0f172a)",
              }}
            >
              <option value="Tech Lead">Tech Lead</option>
              <option value="Arquiteto de Software">
                Arquiteto de Software
              </option>
              <option value="Engenheiro Revisor">Engenheiro Revisor</option>
              <option value="Product Owner / Domain Lead">
                Product Owner / Domain Lead
              </option>
              <option value="Security / Compliance Auditor">
                Security / Compliance Auditor
              </option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--color-text-primary, #0f172a)",
                marginBottom: "6px",
              }}
            >
              Parecer / Comentário de Auditoria (Opcional):
            </label>
            <textarea
              rows={3}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder="Ex: Revisado e aprovado em conformidade com as diretrizes e padrões de arquitetura."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border-subtle, #cbd5e1)",
                fontSize: "13px",
                resize: "vertical",
                fontFamily: "inherit",
                color: "var(--color-text-primary, #0f172a)",
                background: "var(--color-surface, #ffffff)",
              }}
            />
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              background:
                "var(--md-sys-color-surface-container-lowest, #f8f9fa)",
              border: "1px solid var(--color-border-subtle, #e2e8f0)",
              fontSize: "12px",
              color: "var(--color-text-muted, #64748b)",
              lineHeight: "1.5",
            }}
          >
            🔒 <strong>Registro Imutável:</strong> Sua aprovação será
            carimbada com o usuário{" "}
            <strong>{user?.login ? `@${user.login}` : "@tech-lead"}</strong>
            , data/hora e o hash da revisão atual para conformidade e
            rastreabilidade no Git.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={actionLoading?.id === approvalModalPR.id}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApproveSubmit}
            disabled={actionLoading?.id === approvalModalPR.id}
            icon={
              <span className="material-symbols-outlined icon-xs">
                {actionLoading?.id === approvalModalPR.id
                  ? "progress_activity"
                  : "verified"}
              </span>
            }
          >
            {actionLoading?.id === approvalModalPR.id
              ? "Registrando Aprovação..."
              : "Confirmar Aprovação"}
          </Button>
        </div>
      </div>
    </div>
  );
};

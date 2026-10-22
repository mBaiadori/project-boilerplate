import React, { memo } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import type { Repo, Organization } from "../../types";
import type { DeleteItemTarget } from "./types";
import { Modal, Button } from "../ui";
import { LockedRepoModal } from "../modals/LockedRepoModal";
import { CreateRepoModal } from "../modals/CreateRepoModal";
import { DeleteRepoModal } from "../modals/DeleteRepoModal";
import { RepoGovernanceModal } from "../modals/RepoGovernanceModal";

interface FileTreeModalsProps {
  lockedRepoTarget: Repo | null;
  onCloseLockedRepo: () => void;
  activeOrg: Organization | null;
  createRepoModalOpen: boolean;
  onCloseCreateRepo: () => void;
  onRepoCreated: (newRepo: Repo) => Promise<void>;
  deleteRepoTarget: Repo | null;
  onCloseDeleteRepo: () => void;
  onRepoDeleted: () => Promise<void>;
  deleteItemTarget: DeleteItemTarget | null;
  isDeletingItem: boolean;
  onCloseDeleteItem: () => void;
  onConfirmDeleteItem: () => Promise<void>;
  governanceRepoTarget: Repo | null;
  onCloseGovernance: () => void;
}

export const FileTreeModals: React.FC<FileTreeModalsProps> = memo(({
  lockedRepoTarget,
  onCloseLockedRepo,
  activeOrg,
  createRepoModalOpen,
  onCloseCreateRepo,
  onRepoCreated,
  deleteRepoTarget,
  onCloseDeleteRepo,
  onRepoDeleted,
  deleteItemTarget,
  isDeletingItem,
  onCloseDeleteItem,
  onConfirmDeleteItem,
  governanceRepoTarget,
  onCloseGovernance,
}) => {
  return (
    <>
      {/* Modal de Repositório Bloqueado */}
      <LockedRepoModal
        isOpen={Boolean(lockedRepoTarget)}
        onClose={onCloseLockedRepo}
        repo={lockedRepoTarget}
        orgName={activeOrg?.login}
      />

      {/* Modal de Criação de Pasta Raiz (Repositório) */}
      <CreateRepoModal
        isOpen={createRepoModalOpen}
        onClose={onCloseCreateRepo}
        defaultOwner={activeOrg?.login}
        onCreated={onRepoCreated}
      />

      {/* Modal de Exclusão de Repositório Raiz */}
      <DeleteRepoModal
        isOpen={Boolean(deleteRepoTarget)}
        onClose={onCloseDeleteRepo}
        repo={deleteRepoTarget}
        onDeleted={onRepoDeleted}
      />

      {/* Modal de Confirmação de Exclusão de Arquivo / Pasta */}
      <Modal
        isOpen={Boolean(deleteItemTarget)}
        onClose={() => !isDeletingItem && onCloseDeleteItem()}
        title={deleteItemTarget?.isFolder ? "Excluir Pasta" : "Excluir Arquivo"}
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md, 8px)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <AlertTriangle
              size={20}
              style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}
            />
            <div
              style={{
                fontSize: "13px",
                lineHeight: "1.5",
                color: "var(--text-primary)",
              }}
            >
              Tem certeza que deseja excluir{" "}
              {deleteItemTarget?.isFolder ? "a pasta" : "o arquivo"}{" "}
              <strong>"{deleteItemTarget?.name}"</strong>?
              {deleteItemTarget?.isFolder && (
                <div
                  style={{
                    fontSize: "11.5px",
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  Todos os arquivos e subpastas internos também serão excluídos.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 6,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onCloseDeleteItem}
              disabled={isDeletingItem}
            >
              Cancelar
            </Button>
            <Button
              id="btn-confirm-delete-tree-item"
              variant="danger"
              size="sm"
              isLoading={isDeletingItem}
              icon={<Trash2 size={14} />}
              onClick={onConfirmDeleteItem}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Governança & Acessos do Repositório */}
      {governanceRepoTarget && (
        <RepoGovernanceModal
          isOpen={Boolean(governanceRepoTarget)}
          onClose={onCloseGovernance}
          orgLogin={governanceRepoTarget.owner || activeOrg?.login || "local"}
          repoName={governanceRepoTarget.name}
        />
      )}
    </>
  );
});

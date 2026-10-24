import React from "react";
import type { SyncToMainPreview } from "../../types";
import {
  DictionaryPopover,
  type DictionaryPopoverData,
} from "../dictionary/DictionaryPopover";
import { AddDictionaryTermModal } from "../modals/AddDictionaryTermModal";
import { InsertLinkModal } from "../modals/InsertLinkModal";
import { LinkSynonymModal } from "../modals/LinkSynonymModal";
import { MergeConflictResolutionModal } from "../modals/MergeConflictResolutionModal";
import { SyncTranslationModal } from "../modals/SyncTranslationModal";

export interface EditorModalsContainerProps {
  // Link Modal
  isLinkModalOpen: boolean;
  linkModalInitialText: string;
  linkModalInitialUrl: string;
  onCloseLinkModal: () => void;
  onConfirmLinkModal: (url: string, text: string) => void;

  // Import Modal
  isImportModalOpen: boolean;
  importText: string;
  onImportTextChange: (text: string) => void;
  onCloseImportModal: () => void;
  onConfirmPasteImport: () => void;

  // Dictionary Modals
  isAddTermModalOpen: boolean;
  addTermInitialText: string;
  onCloseAddTermModal: () => void;
  onTermCreated: () => void;

  isLinkSynonymModalOpen: boolean;
  linkSynonymInitialText: string;
  onCloseLinkSynonymModal: () => void;
  onSynonymLinked: () => void;

  dictionaryPopoverData: DictionaryPopoverData | null;
  onCloseDictionaryPopover: () => void;

  // Sync Translation Modal
  isSyncModalOpen: boolean;
  onCloseSyncModal: () => void;
  syncPreview: SyncToMainPreview | null;
  onConfirmApplyToMain: (newMainContent: string) => Promise<void>;

  // Conflict Modal
  isConflictModalOpen: boolean;
  onCloseConflictModal: () => void;
  filePath: string | null;
  conflictContent: string;
  onSaveResolvedConflict: (resolvedContent: string) => Promise<void>;
}

export const EditorModalsContainer: React.FC<EditorModalsContainerProps> = ({
  isLinkModalOpen,
  linkModalInitialText,
  linkModalInitialUrl,
  onCloseLinkModal,
  onConfirmLinkModal,

  isImportModalOpen,
  importText,
  onImportTextChange,
  onCloseImportModal,
  onConfirmPasteImport,

  isAddTermModalOpen,
  addTermInitialText,
  onCloseAddTermModal,
  onTermCreated,

  isLinkSynonymModalOpen,
  linkSynonymInitialText,
  onCloseLinkSynonymModal,
  onSynonymLinked,

  dictionaryPopoverData,
  onCloseDictionaryPopover,

  isSyncModalOpen,
  onCloseSyncModal,
  syncPreview,
  onConfirmApplyToMain,

  isConflictModalOpen,
  onCloseConflictModal,
  filePath,
  conflictContent,
  onSaveResolvedConflict,
}) => {
  return (
    <>
      {/* Insert / Edit Link Modal */}
      <InsertLinkModal
        isOpen={isLinkModalOpen}
        initialText={linkModalInitialText}
        initialUrl={linkModalInitialUrl}
        onClose={onCloseLinkModal}
        onConfirm={onConfirmLinkModal}
      />

      {/* Import Doc Modal */}
      {isImportModalOpen && (
        <div
          id="import-doc-modal"
          className="modal-backdrop"
          style={{ display: "flex" }}
        >
          <div className="modal-box" style={{ maxWidth: "580px" }}>
            <div className="modal-header">
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Importar Documento
                </h3>
                <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                  Upload de arquivo .md ou colar texto
                </span>
              </div>
              <button
                id="btn-close-import-modal"
                className="btn-close"
                aria-label="Fechar"
                onClick={onCloseImportModal}
              >
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
            <div
              className="modal-body"
              style={{ padding: "18px 22px", gap: "14px" }}
            >
              <div className="import-paste-box">
                <textarea
                  id="import-paste-textarea"
                  rows={8}
                  placeholder="Ou cole seu texto Markdown aqui diretamente..."
                  value={importText}
                  onChange={(e) => onImportTextChange(e.target.value)}
                  style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={onCloseImportModal}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={onConfirmPasteImport}
                disabled={!importText.trim()}
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dictionary Modals */}
      <AddDictionaryTermModal
        isOpen={isAddTermModalOpen}
        initialTerm={addTermInitialText}
        onClose={onCloseAddTermModal}
        onTermCreated={onTermCreated}
      />

      <LinkSynonymModal
        isOpen={isLinkSynonymModalOpen}
        synonymText={linkSynonymInitialText}
        onClose={onCloseLinkSynonymModal}
        onSynonymLinked={onSynonymLinked}
      />

      <DictionaryPopover
        data={dictionaryPopoverData}
        onClose={onCloseDictionaryPopover}
      />

      {/* Sync Translation to Main Modal */}
      <SyncTranslationModal
        isOpen={isSyncModalOpen}
        onClose={onCloseSyncModal}
        preview={syncPreview}
        onConfirmApply={onConfirmApplyToMain}
      />

      {/* Merge Conflict Resolution Modal */}
      <MergeConflictResolutionModal
        isOpen={isConflictModalOpen}
        onClose={onCloseConflictModal}
        filePath={filePath || "documento.md"}
        content={conflictContent}
        onSaveResolved={onSaveResolvedConflict}
      />
    </>
  );
};

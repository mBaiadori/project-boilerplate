import React, { useState, useMemo } from "react";
import { Modal, Button } from "../ui";
import { VisualMarkdownDiff } from "../editor/VisualMarkdownDiff";
import { parseFrontmatter } from "../../services/frontmatter";
import type { SyncToMainPreview } from "../../types";

interface SyncTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: SyncToMainPreview | null;
  onConfirmApply: (newMainContent: string) => Promise<void>;
}

export const SyncTranslationModal: React.FC<SyncTranslationModalProps> = ({
  isOpen,
  onClose,
  preview,
  onConfirmApply,
}) => {
  const [isApplying, setIsApplying] = useState(false);

  // Extrai com precisão o corpo de cada versão, isolando completamente o bloco de frontmatter YAML
  const { cleanOldBody, cleanNewBody } = useMemo(() => {
    if (!preview) return { cleanOldBody: "", cleanNewBody: "" };
    const oldParsed = parseFrontmatter(preview.originalMainContent || "");
    const newParsed = parseFrontmatter(preview.translatedToMainContent || "");
    return {
      cleanOldBody: (oldParsed.hasFrontmatter ? oldParsed.body : preview.originalMainContent || "").trim(),
      cleanNewBody: (newParsed.hasFrontmatter ? newParsed.body : preview.translatedToMainContent || "").trim(),
    };
  }, [preview]);

  if (!preview) return null;

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onConfirmApply(preview.translatedToMainContent);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronização para o Documento Oficial"
      icon={<span className="material-symbols-outlined" style={{ color: "var(--primary, #2563eb)" }}>sync_alt</span>}
      size="xl"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--color-outline, #64748b)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#16a34a" }}>
              verified_user
            </span>
            <span>Metadados oficiais (tags, categorias, status) serão mantidos intactos.</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={isApplying}
              icon={
                isApplying ? (
                  <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "15px" }}>
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                    check
                  </span>
                )
              }
            >
              {isApplying ? "Gravando no Oficial..." : "Confirmar e Gravar no Documento Oficial"}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", height: "70vh", gap: "10px" }}>
        {/* Banner Explicativo */}
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(37, 99, 235, 0.07)",
            borderRadius: "8px",
            border: "1px solid rgba(37, 99, 235, 0.18)",
            fontSize: "12.5px",
            color: "var(--color-on-surface, #1e293b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <strong>Revisão de Alterações:</strong> As edições feitas em <strong>{preview.sourceLang.toUpperCase()}</strong> foram traduzidas para a língua oficial <strong>{preview.targetLang.toUpperCase()}</strong>.
            <span style={{ color: "var(--color-outline, #64748b)", display: "block", marginTop: "2px", fontSize: "11.5px" }}>
              {preview.summary}
            </span>
          </div>
          <div
            style={{
              padding: "4px 8px",
              background: "#ffffff",
              border: "1px solid rgba(37, 99, 235, 0.25)",
              borderRadius: "6px",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--primary, #2563eb)",
              whiteSpace: "nowrap",
            }}
          >
            {preview.sourceLang.toUpperCase()} ➔ {preview.targetLang.toUpperCase()} [OFICIAL]
          </div>
        </div>

        {/* Diff Visual Container */}
        <div style={{ flex: 1, minHeight: 0, border: "1px solid var(--color-outline-variant, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
          <VisualMarkdownDiff
            oldContent={cleanOldBody}
            newContent={cleanNewBody}
            oldTitle={`Documento Oficial Atual (${preview.targetLang.toUpperCase()})`}
            newTitle={`Nova Versão Traduzida (${preview.targetLang.toUpperCase()})`}
            fileName={preview.filePath}
            initialViewMode="split"
          />
        </div>
      </div>
    </Modal>
  );
};


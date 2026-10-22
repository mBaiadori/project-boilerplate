import React from "react";
import { BookA, Check, Copy, Download, Plus, Upload } from "lucide-react";
import { Button } from "../../../../components/ui";

interface DictionaryHeaderProps {
  termsCount: number;
  copiedGeneral: string | null;
  onCopyJson: () => void;
  onExportMarkdown: () => void;
  onOpenImport: () => void;
  onOpenNewTerm: () => void;
}

export const DictionaryHeader: React.FC<DictionaryHeaderProps> = ({
  termsCount,
  copiedGeneral,
  onCopyJson,
  onExportMarkdown,
  onOpenImport,
  onOpenNewTerm,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "var(--color-surface-container, #f1f5f9)",
            color: "var(--color-primary, #1a73e8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BookA size={20} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--color-on-surface, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              Dicionário Ubíquo
            </h1>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-on-surface-variant, #64748b)",
                background: "var(--color-surface-container, #f1f5f9)",
                padding: "2px 8px",
                borderRadius: "12px",
              }}
            >
              {termsCount} {termsCount === 1 ? "termo" : "termos"}
            </span>
          </div>
          <p
            style={{
              margin: "2px 0 0 0",
              fontSize: "12.5px",
              color: "var(--color-on-surface-variant, #64748b)",
            }}
          >
            Vocabulário canônico consumido pelo Copilot, editores e agentes em tempo real.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <Button
          id="btn-copy-dict-json"
          variant="secondary"
          size="sm"
          onClick={onCopyJson}
          icon={
            copiedGeneral === "json" ? (
              <Check
                size={14}
                style={{ color: "var(--color-success, #16a34a)" }}
              />
            ) : (
              <Copy size={14} />
            )
          }
        >
          {copiedGeneral === "json" ? "Copiado!" : "Copiar JSON"}
        </Button>

        <Button
          id="btn-export-markdown"
          variant="secondary"
          size="sm"
          onClick={onExportMarkdown}
          icon={<Download size={14} />}
          title="Baixar dicionário formatado em Markdown"
        >
          Exportar MD
        </Button>

        <Button
          id="btn-import-json"
          variant="secondary"
          size="sm"
          onClick={onOpenImport}
          icon={<Upload size={14} />}
        >
          Importar
        </Button>

        <Button
          id="btn-open-new-term"
          variant="primary"
          size="sm"
          onClick={onOpenNewTerm}
          icon={<Plus size={15} />}
        >
          Novo Termo
        </Button>
      </div>
    </div>
  );
};

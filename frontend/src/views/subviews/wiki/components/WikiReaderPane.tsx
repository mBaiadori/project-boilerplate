import React from "react";
import { Check, Copy, Edit3, Trash2 } from "lucide-react";
import { Badge, Button, IconButton } from "../../../../components/ui";
import { sanitizeHtml } from "../../../../utils/sanitize";
import { CATEGORY_META, type WikiEntry } from "../types";

interface WikiReaderPaneProps {
  activeEntry: WikiEntry;
  onStartEdit: () => void;
  onCopyMarkdown: () => void;
  copied: boolean;
  onDeleteEntry: () => void;
  onArticleMouseMove: (e: React.MouseEvent) => void;
  renderedHtml: string;
}

export const WikiReaderPane: React.FC<WikiReaderPaneProps> = ({
  activeEntry,
  onStartEdit,
  onCopyMarkdown,
  copied,
  onDeleteEntry,
  onArticleMouseMove,
  renderedHtml,
}) => {
  return (
    <div style={{ maxWidth: "850px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-outline-variant)",
          paddingBottom: "16px",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Badge
            variant={CATEGORY_META[activeEntry.category]?.badgeVariant || "primary"}
            size="md"
          >
            {CATEGORY_META[activeEntry.category]?.badge || "WIKI"}
          </Badge>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--color-on-surface)",
            }}
          >
            {activeEntry.title}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onStartEdit}
            icon={<Edit3 size={14} />}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCopyMarkdown}
            icon={copied ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
          >
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onDeleteEntry}
            tooltip="Excluir Nota"
            icon={<Trash2 size={15} style={{ color: "var(--color-error)" }} />}
          />
        </div>
      </div>

      <article
        className="markdown-body"
        onMouseMove={onArticleMouseMove}
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(renderedHtml),
        }}
        style={{ fontSize: "14.5px", lineHeight: 1.7 }}
      />
    </div>
  );
};

import React, { useState, useMemo } from "react";
import { generateSideBySideMarkdownHtml } from "../../utils/rich-diff";
import {
  parseFrontmatter,
  type DocumentMetadata,
} from "../../services/frontmatter";

interface VisualMarkdownDiffProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
  fileName?: string;
  hideHeader?: boolean;
  initialViewMode?: "split" | "lines" | "inline";
  blameData?: Array<{
    line: number;
    author: string;
    date: string;
    commit: string;
    content: string;
  }>;
  showAuthorship?: boolean;
  onRestoreOldVersion?: () => void;
  onClose?: () => void;
}

export const VisualMarkdownDiff: React.FC<VisualMarkdownDiffProps> = ({
  oldContent,
  newContent,
  oldTitle = "Versão Base",
  newTitle = "Rascunho Atual",
  fileName,
  hideHeader = true,
  blameData,
  showAuthorship = false,
  onRestoreOldVersion,
  onClose,
}) => {
  const [showMetadata, setShowMetadata] = useState(false);

  // Parse frontmatter metadata and extract the pure document body for both versions
  const oldParsed = useMemo(
    () => parseFrontmatter(oldContent || ""),
    [oldContent],
  );
  const newParsed = useMemo(
    () => parseFrontmatter(newContent || ""),
    [newContent],
  );

  const hasMetadata = oldParsed.hasFrontmatter || newParsed.hasFrontmatter;

  const sideBySideHtml = useMemo(() => {
    const oldBody = oldParsed.hasFrontmatter
      ? oldParsed.body
      : oldContent || "";
    const newBody = newParsed.hasFrontmatter
      ? newParsed.body
      : newContent || "";
    return generateSideBySideMarkdownHtml(oldBody, newBody);
  }, [oldParsed, newParsed, oldContent, newContent]);

  // Render stylized metadata chips for frontmatter
  const renderMetadataPills = (
    currentMeta: DocumentMetadata,
    otherMeta: DocumentMetadata,
    side: "old" | "new",
  ) => {
    const keys = Array.from(
      new Set([
        ...Object.keys(currentMeta || {}),
        ...Object.keys(otherMeta || {}),
      ]),
    ).filter((k) => k !== "extra");

    if (keys.length === 0) {
      return (
        <span
          style={{
            color: "var(--color-outline, #64748b)",
            fontStyle: "italic",
            fontSize: "11px",
          }}
        >
          Sem metadados adicionais.
        </span>
      );
    }

    return keys.map((key) => {
      const curVal = (currentMeta as any)?.[key];
      const otherVal = (otherMeta as any)?.[key];
      const curStr =
        curVal !== undefined && curVal !== null
          ? typeof curVal === "object"
            ? JSON.stringify(curVal)
            : String(curVal)
          : "";
      const otherStr =
        otherVal !== undefined && otherVal !== null
          ? typeof otherVal === "object"
            ? JSON.stringify(otherVal)
            : String(otherVal)
          : "";
      const isDiff = curStr !== otherStr;

      const bg = isDiff
        ? side === "old"
          ? "rgba(239, 68, 68, 0.15)"
          : "rgba(34, 197, 94, 0.15)"
        : "var(--color-surface-container, #e2e8f0)";

      const color = isDiff
        ? side === "old"
          ? "#991b1b"
          : "#166534"
        : "var(--color-on-surface, #1e293b)";

      return (
        <div
          key={key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: bg,
            color: color,
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          <span style={{ opacity: 0.7, fontWeight: 600 }}>{key}:</span>
          <span>{curStr || "<vazio>"}</span>
        </div>
      );
    });
  };

  return (
    <div
      className="visual-markdown-diff-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-surface, #ffffff)",
        overflow: "hidden",
      }}
    >
      {/* Action Bar (rendered when standalone or explicit actions exist) */}
      {((!hideHeader && fileName) || onRestoreOldVersion || onClose) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
            background: "var(--color-surface-container-low, #f8fafc)",
            gap: "12px",
          }}
        >
          {fileName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "18px",
                  color: "var(--color-primary, #2563eb)",
                }}
              >
                description
              </span>
              <span>{fileName}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "auto",
            }}
          >
            {onRestoreOldVersion && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={onRestoreOldVersion}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span className="material-symbols-outlined icon-xs">
                  history_toggle_off
                </span>
                Restaurar
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={onClose}
                title="Fechar visualização"
              >
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Metadata Bar (Frontmatter) */}
      {hasMetadata && (
        <div
          style={{
            padding: "6px 16px",
            background: "var(--color-surface-container-lowest, #ffffff)",
            borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowMetadata((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "transparent",
              border: "none",
              padding: "2px 0",
              cursor: "pointer",
              color: "var(--color-primary, #2563eb)",
              fontSize: "11.5px",
              fontWeight: 600,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              {showMetadata ? "expand_less" : "expand_more"}
            </span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "14px" }}
            >
              tune
            </span>
            <span>
              {showMetadata ? "Ocultar Metadados" : "Mostrar Metadados"}
            </span>
          </button>

          {showMetadata && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginTop: "8px",
                paddingTop: "6px",
                borderTop: "1px dashed var(--color-border-subtle, #e2e8f0)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {renderMetadataPills(
                  oldParsed.metadata,
                  newParsed.metadata,
                  "old",
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {renderMetadataPills(
                  newParsed.metadata,
                  oldParsed.metadata,
                  "new",
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Diff Render Canvas - Pure Side-by-Side Unified View */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            minHeight: "320px",
          }}
        >
          {/* Left Column: Old Version (Base) */}
          <div
            style={{
              border: "1px solid var(--color-border-subtle, #e2e8f0)",
              borderRadius: "8px",
              overflow: "hidden",
              background: "var(--color-surface, #ffffff)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                background: "var(--color-surface-container-low, #f8fafc)",
                borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
                color: "var(--color-on-surface-variant, #475569)",
                fontWeight: 600,
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "15px" }}
                >
                  history
                </span>
                <span>{oldTitle}</span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--color-outline, #64748b)",
                }}
              >
                Base
              </span>
            </div>
            <div
              className="prose markdown-rendered"
              style={{
                padding: "16px",
                overflowY: "auto",
                flex: 1,
                fontSize: "13.5px",
                lineHeight: 1.6,
                color: "var(--color-on-surface, #1e293b)",
              }}
              dangerouslySetInnerHTML={{
                __html: sideBySideHtml.oldHtml,
              }}
            />
          </div>

          {/* Right Column: New Version (Draft) */}
          <div
            style={{
              border: "1px solid var(--color-border-subtle, #e2e8f0)",
              borderRadius: "8px",
              overflow: "hidden",
              background: "var(--color-surface, #ffffff)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                background: "var(--color-surface-container-low, #f8fafc)",
                borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
                color: "var(--color-on-surface-variant, #475569)",
                fontWeight: 600,
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "15px", color: "#16a34a" }}
                >
                  edit_note
                </span>
                <span>{newTitle}</span>
              </div>
              <span
                style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}
              >
                Rascunho
              </span>
            </div>
            <div
              className="prose markdown-rendered"
              style={{
                padding: "16px",
                overflowY: "auto",
                flex: 1,
                fontSize: "13.5px",
                lineHeight: 1.6,
                color: "var(--color-on-surface, #1e293b)",
              }}
              dangerouslySetInnerHTML={{
                __html: sideBySideHtml.newHtml,
              }}
            />
          </div>
        </div>

        {/* Authorship & Contributors Overlay (if enabled) */}
        {showAuthorship && blameData && blameData.length > 0 && (
          <div
            style={{
              marginTop: "24px",
              borderTop: "1px solid var(--color-border-subtle, #e2e8f0)",
              paddingTop: "12px",
            }}
          >
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-on-surface)",
              }}
            >
              Anotações de Autoria & Contribuidores
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                maxHeight: "180px",
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
              }}
            >
              {blameData.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "var(--color-surface-container-low, #f8fafc)",
                  }}
                >
                  <span
                    style={{ color: "var(--color-outline)", width: "32px" }}
                  >
                    L{b.line}
                  </span>
                  <span
                    className="badge badge-neutral"
                    style={{ fontSize: "10.5px" }}
                  >
                    #{b.commit.slice(0, 7)}
                  </span>
                  <strong
                    style={{
                      color: "var(--color-on-surface)",
                      minWidth: "110px",
                    }}
                  >
                    {b.author}
                  </strong>
                  <span
                    style={{
                      color: "var(--color-outline)",
                      fontSize: "11px",
                      minWidth: "70px",
                    }}
                  >
                    {b.date}
                  </span>
                  <span
                    style={{
                      color: "var(--color-on-surface-variant)",
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

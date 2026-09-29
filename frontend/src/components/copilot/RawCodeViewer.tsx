import React from "react";
import { Copy, Check } from "lucide-react";

export interface RawCodeViewerProps {
  title: React.ReactNode;
  badge?: React.ReactNode;
  content: string | object | null | undefined;
  copyKey?: string;
  copiedKey?: string | null;
  onCopy?: (text: string, key: string) => void;
  maxHeight?: string;
  isJson?: boolean;
  className?: string;
}

export const RawCodeViewer: React.FC<RawCodeViewerProps> = ({
  title,
  badge,
  content,
  copyKey,
  copiedKey,
  onCopy,
  maxHeight = "240px",
  isJson = false,
  className = "",
}) => {
  const textContent =
    typeof content === "object"
      ? JSON.stringify(content, null, 2)
      : content || "";

  const isCopied = copyKey && copiedKey === copyKey;

  return (
    <div className={`ui-code-viewer ${className}`.trim()}>
      <div className="ui-code-viewer__header">
        <div className="ui-row ui-row--align-center ui-row--xs">
          <span>{title}</span>
          {badge}
        </div>
        {onCopy && copyKey && (
          <button
            type="button"
            className="ui-taxonomy-chip__action-btn ui-text-muted"
            onClick={() => onCopy(textContent, copyKey)}
            title={isCopied ? "Copiado!" : "Copiar conteúdo"}
          >
            <div className="ui-row ui-row--align-center ui-row--xs">
              {isCopied ? <Check size={12} className="ui-text-success" /> : <Copy size={12} />}
              <span className="ui-text-caption">{isCopied ? "Copiado" : "Copiar"}</span>
            </div>
          </button>
        )}
      </div>
      <pre
        className="ui-code-viewer__body"
        style={{ maxHeight: maxHeight, overflowY: "auto" }}
      >
        {textContent || (isJson ? "{}" : "Nenhum conteúdo registrado")}
      </pre>
    </div>
  );
};

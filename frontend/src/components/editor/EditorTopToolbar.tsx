import React from "react";
import { FolderTree } from "lucide-react";
import { LanguageSelectorDropdown } from "./LanguageSelectorDropdown";

export interface EditorTopToolbarProps {
  filePath: string | null;
  repoName?: string;
  onRevealInTree: () => void;
  onShowToast: (text: string, type: "success" | "warning" | "info") => void;
  editorTab: "document" | "prompt";
  onSwitchTab: (tab: "document" | "prompt") => void;
  isTemplateMode?: boolean;
  activeLanguage: string;
  onSelectLanguage: (lang: string) => void;
  onTranslationCreated: (lang: string, transContent: string) => void;
}

export const EditorTopToolbar: React.FC<EditorTopToolbarProps> = ({
  filePath,
  repoName,
  onRevealInTree,
  onShowToast,
  editorTab,
  onSwitchTab,
  isTemplateMode = false,
  activeLanguage,
  onSelectLanguage,
  onTranslationCreated,
}) => {
  const displayPath = filePath
    ? `${repoName || "local"}/${filePath.replace(/^\/+/, "")}`
    : "";

  return (
    <div className="editor-top-toolbar">
      <div className="doc-meta-left">
        <div
          className="doc-breadcrumbs-container"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {/* Breadcrumb Path Input / Display */}
          <div
            className="doc-breadcrumbs"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <input
              type="text"
              id="doc-path-input"
              className="doc-path-input"
              value={displayPath}
              readOnly
              placeholder="Selecione ou crie um documento..."
              spellCheck="false"
              title={`Caminho unificado: ${displayPath}`}
              style={{
                width: "280px",
                minWidth: "180px",
              }}
            />

            {/* Action: Copiar Caminho Completo */}
            <button
              id="btn-copy-doc-path"
              className="btn-icon-subtle"
              type="button"
              title="Copiar caminho completo (repositório/pasta/arquivo). Segure Alt para copiar URL web completa."
              onClick={(e) => {
                if (e.altKey && filePath) {
                  const currentUrl = window.location.href;
                  navigator.clipboard.writeText(currentUrl);
                  onShowToast(`URL completa copiada: ${currentUrl}`, "info");
                } else if (displayPath) {
                  navigator.clipboard.writeText(displayPath);
                  onShowToast(`Caminho completo copiado: ${displayPath}`, "info");
                }
              }}
              disabled={!filePath}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  ry="2"
                ></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>

            {/* Action: Revelar na Árvore */}
            <button
              id="btn-reveal-in-tree"
              className="btn-icon-subtle"
              type="button"
              title="Expandir pastas e revelar na árvore de documentos"
              onClick={onRevealInTree}
              disabled={!filePath}
            >
              <FolderTree size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Native Editor Mode Tabs: Documento vs Prompt do Copilot */}
      <div
        className="notion-editor-mode-tabs"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          background: "var(--color-surface-container-high, #f1f5f9)",
          padding: "3px",
          borderRadius: "8px",
          marginLeft: "10px",
          flexShrink: 0,
        }}
      >
        <button
          id="tab-mode-document"
          type="button"
          className={`notion-tab-btn ${editorTab === "document" ? "active" : ""}`}
          onClick={() => onSwitchTab("document")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "none",
            fontSize: "12px",
            fontWeight: editorTab === "document" ? 600 : 500,
            cursor: "pointer",
            background:
              editorTab === "document"
                ? "var(--color-surface, #ffffff)"
                : "transparent",
            color:
              editorTab === "document"
                ? "var(--color-primary, #2563eb)"
                : "var(--color-outline, #64748b)",
            boxShadow:
              editorTab === "document"
                ? "0 1px 3px rgba(0,0,0,0.1)"
                : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span
            className="material-symbols-outlined icon-xs"
            style={{ fontSize: "15px" }}
          >
            {isTemplateMode ? "view_quilt" : "description"}
          </span>
          <span>
            {isTemplateMode ? "Conteúdo do Template" : "Documento"}
          </span>
        </button>

        <button
          id="tab-mode-copilot-prompt"
          type="button"
          className={`notion-tab-btn ${editorTab === "prompt" ? "active" : ""}`}
          onClick={() => onSwitchTab("prompt")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "none",
            fontSize: "12px",
            fontWeight: editorTab === "prompt" ? 600 : 500,
            cursor: "pointer",
            background:
              editorTab === "prompt"
                ? "var(--color-surface, #ffffff)"
                : "transparent",
            color:
              editorTab === "prompt"
                ? "var(--color-primary, #2563eb)"
                : "var(--color-outline, #64748b)",
            boxShadow:
              editorTab === "prompt" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span
            className="material-symbols-outlined icon-xs"
            style={{ fontSize: "15px" }}
          >
            smart_toy
          </span>
          <span>Prompt do Copilot</span>
        </button>
      </div>

      <div className="editor-actions-right">
        {/* Seletor de Idiomas & SSOT */}
        {!isTemplateMode && filePath && (
          <LanguageSelectorDropdown
            filePath={filePath}
            activeLanguage={activeLanguage}
            onSelectLanguage={onSelectLanguage}
            onTranslationCreated={onTranslationCreated}
          />
        )}
      </div>
    </div>
  );
};

import React, { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { NotionEditor } from "./NotionEditor";
import { getFileCategory } from "../../utils/file-types";
import { FilePlus } from "lucide-react";
import { Button } from "../ui";

// Lazy loaded viewers for optimum performance
const CodeMirrorEditor = lazy(() => import("./viewers/CodeMirrorEditor"));
const CsvEditor = lazy(() => import("./viewers/CsvEditor"));
const ExcelViewer = lazy(() => import("./viewers/ExcelViewer"));
const DocxViewer = lazy(() => import("./viewers/DocxViewer"));
const PdfViewer = lazy(() => import("./viewers/PdfViewer"));
const ImageViewer = lazy(() => import("./viewers/ImageViewer"));
const GenericFileViewer = lazy(() => import("./viewers/GenericFileViewer"));

interface WorkbenchCanvasProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
  onNavigateFile?: (path: string) => void;
  onReload?: () => void;
  onOpenDiffModal?: () => void;
  onToggleCopilot?: () => void;
  onOpenScaffoldWizard?: () => void;
  onSendSelectionToCopilot?: (text: string) => void;
}

export const WorkbenchCanvas: React.FC<WorkbenchCanvasProps> = ({
  filePath,
  content,
  onChange,
  onNavigateFile,
  onReload,
  onOpenDiffModal,
  onToggleCopilot,
  onOpenScaffoldWizard,
  onSendSelectionToCopilot,
}) => {
  const [searchParams] = useSearchParams();
  const hasEmptyFileParam =
    searchParams.has("file") && !searchParams.get("file")?.trim();

  if (!filePath || !filePath.trim()) {
    return (
      <div
        className="workbench-empty-reference-state"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          padding: "32px 24px",
          textAlign: "center",
          background: "var(--md-sys-color-surface, #ffffff)",
          color: "var(--md-sys-color-on-surface, #1f2937)",
          fontFamily:
            'var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: hasEmptyFileParam
              ? "var(--md-sys-color-error-container, #ffdad6)"
              : "var(--md-sys-color-surface-container-high, #f1f5f9)",
            marginBottom: 20,
            color: hasEmptyFileParam
              ? "var(--md-sys-color-on-error-container, #410002)"
              : "var(--md-sys-color-primary, #005ac1)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            {hasEmptyFileParam ? "find_in_page" : "description"}
          </span>
        </div>

        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--md-sys-color-on-surface, #1e293b)",
          }}
        >
          {hasEmptyFileParam
            ? "Referência de arquivo não informada"
            : "Nenhum arquivo selecionado"}
        </h3>

        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "14px",
            lineHeight: 1.5,
            maxWidth: 440,
            color: "var(--md-sys-color-on-surface-variant, #64748b)",
          }}
        >
          {hasEmptyFileParam
            ? "Não temos a referência de um arquivo válido para exibição no editor. Selecione um documento na árvore à esquerda ou crie um novo documento em branco."
            : "Selecione um arquivo na árvore à esquerda para visualizar e editar, ou crie um novo documento em branco."}
        </p>

        {onOpenScaffoldWizard && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              variant="primary"
              size="md"
              onClick={onOpenScaffoldWizard}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FilePlus size={16} />
              <span>Criar Documento</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const category = getFileCategory(filePath);

  // 1. Markdown documents use the rich Notion Editor
  if (category === "markdown") {
    return (
      <NotionEditor
        content={content}
        onChange={onChange}
        filePath={filePath}
        onNavigateFile={onNavigateFile}
        onReload={onReload}
        onOpenDiffModal={onOpenDiffModal}
        onToggleCopilot={onToggleCopilot}
        onOpenScaffoldWizard={onOpenScaffoldWizard}
        onSendSelectionToCopilot={onSendSelectionToCopilot}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "#ffffff",
            color: "#64748b",
          }}
        >
          Carregando visualizador...
        </div>
      }
    >
      {category === "code" && (
        <CodeMirrorEditor
          filePath={filePath}
          content={content}
          onChange={onChange}
          onOpenDiffModal={onOpenDiffModal}
        />
      )}

      {category === "csv" && (
        <CsvEditor filePath={filePath} content={content} onChange={onChange} />
      )}

      {category === "excel" && <ExcelViewer filePath={filePath} />}

      {category === "word" && <DocxViewer filePath={filePath} />}

      {category === "pdf" && <PdfViewer filePath={filePath} />}

      {category === "image" && <ImageViewer filePath={filePath} />}

      {category === "generic" && <GenericFileViewer filePath={filePath} />}
    </Suspense>
  );
};
export default WorkbenchCanvas;

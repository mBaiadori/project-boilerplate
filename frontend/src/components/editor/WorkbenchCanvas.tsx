import React, { Suspense, lazy } from 'react';
import { NotionEditor } from './NotionEditor';
import { getFileCategory } from '../../utils/file-types';

// Lazy loaded viewers for optimum performance
const CodeMirrorEditor = lazy(() => import('./viewers/CodeMirrorEditor'));
const CsvEditor = lazy(() => import('./viewers/CsvEditor'));
const ExcelViewer = lazy(() => import('./viewers/ExcelViewer'));
const DocxViewer = lazy(() => import('./viewers/DocxViewer'));
const PdfViewer = lazy(() => import('./viewers/PdfViewer'));
const ImageViewer = lazy(() => import('./viewers/ImageViewer'));
const GenericFileViewer = lazy(() => import('./viewers/GenericFileViewer'));

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
  if (!filePath) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-outline, #64748b)',
          fontFamily: 'var(--font-sans, system-ui)',
          background: '#ffffff',
        }}
      >
        Selecione um arquivo na árvore à esquerda para visualizar ou editar.
      </div>
    );
  }

  const category = getFileCategory(filePath);

  // 1. Markdown documents use the rich Notion Editor
  if (category === 'markdown') {
    return (
      <NotionEditor
        key={filePath}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: '#ffffff',
            color: '#64748b',
          }}
        >
          Carregando visualizador...
        </div>
      }
    >
      {category === 'code' && (
        <CodeMirrorEditor
          filePath={filePath}
          content={content}
          onChange={onChange}
          onOpenDiffModal={onOpenDiffModal}
        />
      )}

      {category === 'csv' && (
        <CsvEditor
          filePath={filePath}
          content={content}
          onChange={onChange}
        />
      )}

      {category === 'excel' && (
        <ExcelViewer filePath={filePath} />
      )}

      {category === 'word' && (
        <DocxViewer filePath={filePath} />
      )}

      {category === 'pdf' && (
        <PdfViewer filePath={filePath} />
      )}

      {category === 'image' && (
        <ImageViewer filePath={filePath} />
      )}

      {category === 'generic' && (
        <GenericFileViewer filePath={filePath} />
      )}
    </Suspense>
  );
};
export default WorkbenchCanvas;

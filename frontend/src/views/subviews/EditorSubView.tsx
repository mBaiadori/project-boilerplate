import React, { useState, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAI } from '../../context/AIContext';
import { FileTree } from '../../components/explorer/FileTree';
import { NotionEditor } from '../../components/editor/NotionEditor';

const TREE_WIDTH_STORAGE_KEY = 'spec_tree_width';
const DEFAULT_TREE_WIDTH = 260;

interface EditorSubViewProps {
  onOpenScaffoldWizard: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
}

export const EditorSubView: React.FC<EditorSubViewProps> = ({
  onOpenScaffoldWizard,
  onOpenDiffModal,
  onToggleCopilot
}) => {
  const { activeFile, fileContent, setFileContent, loadFile, isLoadingFile } = useWorkspace();
  const { sendMessage } = useAI();
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  const [treeWidth, setTreeWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TREE_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 150 && parsed <= 700) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_TREE_WIDTH;
  });

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_TREE_WIDTH);

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = treeWidth;

    document.body.classList.add('is-resizing');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(150, Math.min(700, startWidthRef.current + deltaX));
      setTreeWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.classList.remove('is-resizing');

      const deltaX = upEvent.clientX - startXRef.current;
      const finalWidth = Math.max(150, Math.min(700, startWidthRef.current + deltaX));
      setTreeWidth(finalWidth);
      try {
        localStorage.setItem(TREE_WIDTH_STORAGE_KEY, String(finalWidth));
      } catch (e) {}

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSendSelectionToCopilot = (text: string) => {
    sendMessage(`Analise a seguinte seção selecionada no documento:\n\n${text}`);
  };

  return (
    <div id="subview-editor" className="dash-subview" style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div className="workbench-layout">
        {/* PANEL 1: DOCUMENT TREE EXPLORER (DOCKABLE / RESIZABLE) */}
        <FileTree
          onOpenFile={(path) => loadFile(path)}
          isCollapsed={isTreeCollapsed}
          onToggleCollapse={() => setIsTreeCollapsed(!isTreeCollapsed)}
          width={treeWidth}
        />

        {/* Resizer Divider between Tree and Editor */}
        {!isTreeCollapsed && (
          <div
            id="resizer-tree"
            className="pane-resizer"
            onMouseDown={handleStartResize}
            title="Arrastar para redimensionar árvore de documentos"
          />
        )}

        {/* PANEL 2: EDITOR & LIVE PREVIEW CANVAS */}
        <section className="workbench-editor-pane">
          {isLoadingFile ? (
            <div className="loading-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Carregando documento...
            </div>
          ) : (
            <NotionEditor
              content={fileContent}
              onChange={setFileContent}
              filePath={activeFile}
              onNavigateFile={(path) => loadFile(path)}
              onReload={() => activeFile && loadFile(activeFile)}
              onOpenDiffModal={onOpenDiffModal}
              onToggleCopilot={onToggleCopilot}
              onOpenScaffoldWizard={onOpenScaffoldWizard}
              onSendSelectionToCopilot={handleSendSelectionToCopilot}
            />
          )}
        </section>
      </div>
    </div>
  );
};

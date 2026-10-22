import React from 'react';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useAI } from '../../../context/AIContext';
import { FileTree } from '../../../components/explorer/FileTree';
import { WorkbenchCanvas } from '../../../components/editor/WorkbenchCanvas';
import type { EditorSubViewProps } from './types';
import { useEditorLayout } from './hooks/useEditorLayout';
import { EditorLoadingBar } from './components/EditorLoadingBar';

export const EditorSubView: React.FC<EditorSubViewProps> = ({
  onOpenScaffoldWizard,
  onOpenDiffModal,
  onToggleCopilot,
  onOpenFile,
}) => {
  const { activeFile, fileContent, setFileContent, loadFile, isLoadingFile } = useWorkspace();
  const { sendMessage } = useAI();
  const {
    isTreeCollapsed,
    handleToggleTreeCollapse,
    treeWidth,
    handleStartResize,
  } = useEditorLayout();

  const handleSendSelectionToCopilot = (text: string) => {
    sendMessage(`Analise a seguinte seção selecionada no documento:\n\n${text}`);
  };

  return (
    <div id="subview-editor" className="dash-subview" style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div className="workbench-layout">
        {/* PANEL 1: DOCUMENT TREE EXPLORER (DOCKABLE / RESIZABLE) */}
        <FileTree
          onOpenFile={(path) => {
            loadFile(path);
            onOpenFile?.(path);
          }}
          isCollapsed={isTreeCollapsed}
          onToggleCollapse={handleToggleTreeCollapse}
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
        <section className="workbench-editor-pane" style={{ position: 'relative' }}>
          {isLoadingFile && <EditorLoadingBar />}
          {isLoadingFile && !activeFile ? (
            <div className="loading-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Carregando documento...
            </div>
          ) : (
            <WorkbenchCanvas
              filePath={activeFile}
              content={fileContent}
              onChange={setFileContent}
              onNavigateFile={(path) => {
                loadFile(path);
                onOpenFile?.(path);
              }}
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

export default EditorSubView;

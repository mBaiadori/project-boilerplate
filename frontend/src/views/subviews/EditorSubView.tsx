import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAI } from '../../context/AIContext';
import { FileTree } from '../../components/explorer/FileTree';
import { NotionEditor } from '../../components/editor/NotionEditor';

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
        />

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

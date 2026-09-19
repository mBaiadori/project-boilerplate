import React, { useState } from 'react';
import { TopHeader } from '../components/layout/TopHeader';
import { SidebarNav, type SubViewType } from '../components/layout/SidebarNav';
import { AICopilotPanel } from '../components/copilot/AICopilotPanel';
import { PromptSidebar } from '../components/copilot/PromptSidebar';
import { HistorySidebar } from '../components/copilot/HistorySidebar';
import { RawInspectorSidebar } from '../components/copilot/RawInspectorSidebar';
import { DiffModal } from '../components/modals/DiffModal';
import { ScaffoldModal } from '../components/modals/ScaffoldModal';
import { AISettingsModal } from '../components/modals/AISettingsModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAI } from '../context/AIContext';

// Subviews
import { EditorSubView } from './subviews/EditorSubView';
import { WikiSubView } from './subviews/WikiSubView';
import { DictionarySubView } from './subviews/DictionarySubView';
import { PRsSubView } from './subviews/PRsSubView';
import { TemplatesSubView } from './subviews/TemplatesSubView';
import { TutorialsSubView } from './subviews/TutorialsSubView';
import { SettingsSubView } from './subviews/SettingsSubView';

interface DashboardViewProps {
  onBackToRepos: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onBackToRepos }) => {
  const [activeSubView, setActiveSubView] = useState<SubViewType>('editor');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [activeCopilotSidebar, setActiveCopilotSidebar] = useState<'prompt' | 'history' | 'raw' | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isScaffoldModalOpen, setIsScaffoldModalOpen] = useState(false);

  const { activeFile, activeRepo, fileContent } = useWorkspace();
  const { messages, aiSettings, openSettingsModal } = useAI();
  const [systemPrompt, setSystemPrompt] = useState('');

  const toggleCopilot = () => {
    if (isCopilotOpen) {
      setIsCopilotOpen(false);
      setActiveCopilotSidebar(null);
    } else {
      setIsCopilotOpen(true);
    }
  };

  return (
    <div id="view-dashboard" className="screen-view" style={{ display: 'flex' }}>
      {/* Top Global Header */}
      <TopHeader
        onBackToRepos={onBackToRepos}
        onOpenDiffModal={() => setIsDiffModalOpen(true)}
        onToggleCopilot={toggleCopilot}
      />

      {/* Main Workspace Layout */}
      <div className="dashboard-layout">
        {/* Primary Global Left Sidebar */}
        <SidebarNav
          activeView={activeSubView}
          onSelectView={(view) => setActiveSubView(view)}
        />

        {/* Vertical Resizer: Sidebar <-> Views Container */}
        <div id="resizer-sidebar" className="pane-resizer" title="Arrastar para redimensionar menu lateral"></div>

        {/* Main Views Container */}
        <main className="dash-views-container">
          {activeSubView === 'editor' && (
            <EditorSubView
              onOpenScaffoldWizard={() => setIsScaffoldModalOpen(true)}
              onOpenDiffModal={() => setIsDiffModalOpen(true)}
              onToggleCopilot={toggleCopilot}
            />
          )}

          {activeSubView === 'dictionary' && (
            <DictionarySubView />
          )}

          {activeSubView === 'wiki' && (
            <WikiSubView />
          )}

          {activeSubView === 'templates' && (
            <TemplatesSubView onApplyTemplate={() => setActiveSubView('editor')} />
          )}

          {activeSubView === 'prs' && (
            <PRsSubView onOpenDiffModal={() => setIsDiffModalOpen(true)} />
          )}

          {activeSubView === 'settings' && (
            <SettingsSubView />
          )}

          {activeSubView === 'tutorials' && (
            <TutorialsSubView onOpenEditor={() => setActiveSubView('editor')} />
          )}
        </main>

        {/* Dedicated Full-Height Sidebars Docked to the LEFT of the AI Chat Pane */}
        {isCopilotOpen && activeCopilotSidebar === 'prompt' && (
          <PromptSidebar
            isOpen={true}
            onClose={() => setActiveCopilotSidebar(null)}
            systemPrompt={systemPrompt}
            defaultPrompt="Você é o Arquiteto de Software & Assistente do Spec-Driven Context OS."
            onSavePrompt={(p) => setSystemPrompt(p)}
            onResetPrompt={() => setSystemPrompt('')}
            onOpenAIModal={openSettingsModal}
            modelName={aiSettings?.active_model || 'gemini-3.5-flash'}
          />
        )}

        {isCopilotOpen && activeCopilotSidebar === 'history' && (
          <HistorySidebar
            isOpen={true}
            onClose={() => setActiveCopilotSidebar(null)}
            repo={activeRepo?.name || 'default'}
            docPath={activeFile || 'index.md'}
            onRestoreSession={() => {}}
          />
        )}

        {isCopilotOpen && activeCopilotSidebar === 'raw' && (
          <RawInspectorSidebar
            isOpen={true}
            onClose={() => setActiveCopilotSidebar(null)}
            docPath={activeFile || 'index.md'}
            rawPayload={{
              repo: activeRepo?.name,
              docPath: activeFile,
              contentLength: fileContent?.length || 0,
              model: aiSettings?.active_model
            }}
            rawResponse={messages[messages.length - 1] || null}
          />
        )}

        {/* Vertical Resizer: Workspace Content <-> Global AI Copilot */}
        <div
          id="resizer-global-ai"
          className={`pane-resizer ${isCopilotOpen ? '' : 'collapsed'}`}
          title="Arrastar para redimensionar chat de IA"
          style={{ display: isCopilotOpen ? 'block' : 'none' }}
        ></div>

        {/* Docked Right Global Context-Aware AI Copilot Sidebar */}
        <aside
          id="global-ai-pane"
          className={`workbench-ai-pane ${isCopilotOpen ? '' : 'collapsed'}`}
          style={{ display: isCopilotOpen ? 'flex' : 'none' }}
        >
          <AICopilotPanel
            isOpen={isCopilotOpen}
            onClose={() => {
              setIsCopilotOpen(false);
              setActiveCopilotSidebar(null);
            }}
            onOpenPrompt={() => setActiveCopilotSidebar(activeCopilotSidebar === 'prompt' ? null : 'prompt')}
            onOpenHistory={() => setActiveCopilotSidebar(activeCopilotSidebar === 'history' ? null : 'history')}
            onOpenRaw={() => setActiveCopilotSidebar(activeCopilotSidebar === 'raw' ? null : 'raw')}
          />
        </aside>
      </div>

      {/* Global Modals */}
      <AISettingsModal />

      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        onPROpened={() => setActiveSubView('prs')}
      />

      <ScaffoldModal
        isOpen={isScaffoldModalOpen}
        onClose={() => setIsScaffoldModalOpen(false)}
        onCreated={() => setActiveSubView('editor')}
      />
    </div>
  );
};

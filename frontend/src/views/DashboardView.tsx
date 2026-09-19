import React, { useState } from 'react';
import { TopHeader } from '../components/layout/TopHeader';
import { SidebarNav, type SubViewType } from '../components/layout/SidebarNav';
import { AICopilotPanel } from '../components/copilot/AICopilotPanel';
import { DiffModal } from '../components/modals/DiffModal';
import { ScaffoldModal } from '../components/modals/ScaffoldModal';
import { AISettingsModal } from '../components/modals/AISettingsModal';

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
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isScaffoldModalOpen, setIsScaffoldModalOpen] = useState(false);

  return (
    <div id="view-dashboard" className="screen-view" style={{ display: 'flex' }}>
      {/* Top Global Header */}
      <TopHeader
        onBackToRepos={onBackToRepos}
        onOpenDiffModal={() => setIsDiffModalOpen(true)}
        onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
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
              onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
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
            onClose={() => setIsCopilotOpen(false)}
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

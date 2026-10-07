import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TopHeader } from '../components/layout/TopHeader';
import { SidebarNav, type SubViewType } from '../components/layout/SidebarNav';
import { AICopilotPanel } from '../components/copilot/AICopilotPanel';
import { PromptSidebar } from '../components/copilot/PromptSidebar';
import { HistorySidebar } from '../components/copilot/HistorySidebar';
import { RawInspectorSidebar } from '../components/copilot/RawInspectorSidebar';
import { ContextSidebar } from '../components/copilot/ContextSidebar';
import { SkillsSidebar } from '../components/copilot/SkillsSidebar';
import { DiffModal } from '../components/modals/DiffModal';
import { ScaffoldModal } from '../components/modals/ScaffoldModal';
import { AISettingsModal } from '../components/modals/AISettingsModal';
import { OnboardingModal } from '../components/modals/OnboardingModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAI } from '../context/AIContext';

import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { EditorSubView } from './subviews/EditorSubView';
import { VersionsSubView } from './subviews/VersionsSubView';
import { WikiSubView } from './subviews/WikiSubView';
import { DictionarySubView } from './subviews/DictionarySubView';
import { PRsSubView } from './subviews/PRsSubView';
import { TemplatesSubView } from './subviews/TemplatesSubView';
import { AICenterSubView } from './subviews/AICenterSubView';
import { GovernanceMembersSubView } from './subviews/GovernanceMembersSubView';
import { SettingsSubView } from './subviews/SettingsSubView';

interface DashboardViewProps {
  onBackToRepos?: () => void;
}

const AI_WIDTH_STORAGE_KEY = 'spec_ai_pane_width';
const DEFAULT_AI_WIDTH = 360;

const VALID_SUBVIEWS: SubViewType[] = ['editor', 'edits', 'versions', 'dictionary', 'wiki', 'templates', 'skills', 'aicenter', 'prs', 'governance', 'settings'];

export const DashboardView: React.FC<DashboardViewProps> = ({ onBackToRepos }) => {
  const { org, repoName, subview } = useParams<{ org?: string; repoName: string; subview?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeSubView: SubViewType = (subview && VALID_SUBVIEWS.includes(subview as SubViewType))
    ? (subview as SubViewType)
    : 'editor';

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [activeCopilotSidebar, setActiveCopilotSidebar] = useState<'prompt' | 'history' | 'raw' | 'context' | 'skills' | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isScaffoldModalOpen, setIsScaffoldModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const { activeFile, activeRepo, fileContent, selectRepoByName, loadFile, hasUnreadWhatsNew, activeOrg, selectOrg } = useWorkspace();
  const { messages, aiSettings, openSettingsModal } = useAI();
  const [systemPrompt, setSystemPrompt] = useState('');
  const fileParam = searchParams.get('file');

  // Sync Org from URL parameter if present
  useEffect(() => {
    if (org && (!activeOrg || activeOrg.login.toLowerCase() !== org.toLowerCase())) {
      selectOrg(org).catch(() => {});
    }
  }, [org, activeOrg?.login, selectOrg]);

  // Sync Repo from URL parameter with double-invocation protection
  const lastSyncedRepoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!repoName) return;
    const currentActive = activeRepo?.name?.toLowerCase();
    const target = repoName.toLowerCase();

    if (currentActive === target) {
      lastSyncedRepoRef.current = target;
      return;
    }

    if (lastSyncedRepoRef.current === target) {
      return;
    }

    lastSyncedRepoRef.current = target;
    selectRepoByName(repoName, fileParam || undefined);
  }, [repoName, activeRepo?.name, selectRepoByName, fileParam]);

  // Sync File from search parameter ?file=...
  useEffect(() => {
    if (fileParam && fileParam !== activeFile && activeRepo) {
      const currentHash = window.location.hash || '';
      loadFile(`${fileParam}${currentHash}`);
    }
  }, [fileParam, activeFile, activeRepo?.name, loadFile]);

  const [aiWidth, setAiWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(AI_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 240 && parsed <= 750) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_AI_WIDTH;
  });

  const isAiDraggingRef = useRef(false);
  const startAiXRef = useRef(0);
  const startAiWidthRef = useRef(DEFAULT_AI_WIDTH);

  const handleAiResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isAiDraggingRef.current = true;
    startAiXRef.current = e.clientX;
    startAiWidthRef.current = aiWidth;

    document.body.classList.add('is-resizing');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isAiDraggingRef.current) return;
      const deltaX = moveEvent.clientX - startAiXRef.current;
      const newWidth = Math.max(240, Math.min(750, startAiWidthRef.current - deltaX));
      setAiWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      if (!isAiDraggingRef.current) return;
      isAiDraggingRef.current = false;
      document.body.classList.remove('is-resizing');

      const deltaX = upEvent.clientX - startAiXRef.current;
      const finalWidth = Math.max(240, Math.min(750, startAiWidthRef.current - deltaX));
      setAiWidth(finalWidth);
      try {
        localStorage.setItem(AI_WIDTH_STORAGE_KEY, String(finalWidth));
      } catch (e) {}

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const toggleCopilot = useCallback(() => {
    setIsCopilotOpen((prev) => {
      if (prev) {
        setActiveCopilotSidebar(null);
        return false;
      }
      return true;
    });
  }, []);

  const buildRepoBaseUrl = useCallback((view: SubViewType) => {
    const currentRepoName = repoName || activeRepo?.name || 'default';
    const effectiveOrg = org || (activeRepo?.owner && activeRepo.owner !== 'local' && !activeRepo.is_local ? activeRepo.owner : (activeOrg?.login && activeOrg.login !== 'local' && !activeRepo?.is_local ? activeOrg.login : null));
    if (effectiveOrg) {
      return `/org/${encodeURIComponent(effectiveOrg)}/repo/${encodeURIComponent(currentRepoName)}/${view}`;
    }
    return `/repo/${encodeURIComponent(currentRepoName)}/${view}`;
  }, [org, repoName, activeRepo, activeOrg?.login]);

  const handleSelectView = (view: SubViewType) => {
    const base = buildRepoBaseUrl(view);
    if (view === 'editor' && activeFile) {
      navigate(`${base}?file=${encodeURIComponent(activeFile)}`);
    } else if (view === 'edits' || view === 'versions') {
      const defaultTab = hasUnreadWhatsNew ? 'whats-new' : 'drafts';
      navigate(`${buildRepoBaseUrl('edits')}?tab=${defaultTab}`);
    } else {
      navigate(base);
    }
  };

  const handleNavigateToEdits = useCallback((tab?: 'drafts' | 'whats-new') => {
    const base = buildRepoBaseUrl('edits');
    const targetTab = tab || (hasUnreadWhatsNew ? 'whats-new' : 'drafts');
    navigate(`${base}?tab=${targetTab}`);
  }, [buildRepoBaseUrl, hasUnreadWhatsNew, navigate]);

  const handleBackToRepos = useCallback(() => {
    if (onBackToRepos) {
      onBackToRepos();
    } else {
      navigate('/repos');
    }
  }, [onBackToRepos, navigate]);

  const handleOpenDiffModal = useCallback(() => {
    handleNavigateToEdits('drafts');
  }, [handleNavigateToEdits]);

  const handleOpenGitModal = useCallback(() => {
    handleNavigateToEdits();
  }, [handleNavigateToEdits]);

  const handleOpenTour = useCallback(() => {
    setIsOnboardingOpen(true);
  }, []);

  const handleOpenFile = (rawPath: string) => {
    const hashIndex = rawPath.indexOf('#');
    const cleanPath = hashIndex !== -1 ? rawPath.slice(0, hashIndex) : rawPath;
    const hash = hashIndex !== -1 ? rawPath.slice(hashIndex) : '';

    const base = buildRepoBaseUrl('editor');
    navigate(`${base}?file=${encodeURIComponent(cleanPath)}${hash}`);
  };

  return (
    <div id="view-dashboard" className="screen-view" style={{ display: 'flex' }}>
      {/* Top Global Header */}
      <TopHeader
        onBackToRepos={handleBackToRepos}
        onOpenDiffModal={handleOpenDiffModal}
        onToggleCopilot={toggleCopilot}
        onOpenGitModal={handleOpenGitModal}
        onNavigateToEdits={handleNavigateToEdits}
        onOpenTour={handleOpenTour}
      />

      {/* Main Workspace Layout */}
      <div className="dashboard-layout">
        {/* Primary Global Left Sidebar */}
        <SidebarNav
          activeView={activeSubView}
          onSelectView={handleSelectView}
          hasUnreadWhatsNew={hasUnreadWhatsNew}
        />

        {/* Main Views Container */}
        <main className="dash-views-container">
          {activeSubView === 'editor' && (
            <EditorSubView
              onOpenScaffoldWizard={() => setIsScaffoldModalOpen(true)}
              onOpenDiffModal={() => handleNavigateToEdits('drafts')}
              onToggleCopilot={toggleCopilot}
              onOpenFile={handleOpenFile}
            />
          )}

          {(activeSubView === 'edits' || activeSubView === 'versions') && (
            <VersionsSubView
              onOpenFile={(path) => {
                handleOpenFile(path);
                handleSelectView('editor');
              }}
              onOpenDiffModal={() => handleNavigateToEdits('drafts')}
            />
          )}

          {activeSubView === 'dictionary' && (
            <DictionarySubView />
          )}

          {activeSubView === 'wiki' && (
            <WikiSubView />
          )}

          {activeSubView === 'templates' && (
            <TemplatesSubView onApplyTemplate={() => handleSelectView('editor')} />
          )}

          {(activeSubView === 'aicenter' || activeSubView === 'skills') && (
            <AICenterSubView />
          )}

          {activeSubView === 'prs' && (
            <PRsSubView onOpenDiffModal={() => setIsDiffModalOpen(true)} />
          )}

          {activeSubView === 'governance' && (
            <GovernanceMembersSubView />
          )}

          {activeSubView === 'settings' && (
            <SettingsSubView />
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

        {isCopilotOpen && activeCopilotSidebar === 'context' && (
          <ContextSidebar
            isOpen={true}
            onClose={() => setActiveCopilotSidebar(null)}
          />
        )}

        {isCopilotOpen && activeCopilotSidebar === 'skills' && (
          <SkillsSidebar
            isOpen={true}
            onClose={() => setActiveCopilotSidebar(null)}
          />
        )}

        {/* Vertical Resizer: Workspace Content <-> Global AI Copilot */}
        {isCopilotOpen && (
          <div
            id="resizer-global-ai"
            className="pane-resizer"
            title="Arrastar para redimensionar chat de IA"
            onMouseDown={handleAiResizeStart}
          />
        )}

        {/* Docked Right Global Context-Aware AI Copilot Sidebar */}
        <aside
          id="global-ai-pane"
          className="workbench-ai-pane"
          style={{
            display: isCopilotOpen ? 'flex' : 'none',
            width: `${aiWidth}px`
          }}
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
            onOpenContext={() => setActiveCopilotSidebar(activeCopilotSidebar === 'context' ? null : 'context')}
            onOpenSkills={() => setActiveCopilotSidebar(activeCopilotSidebar === 'skills' ? null : 'skills')}
          />
        </aside>
      </div>

      {/* Global Modals */}
      <AISettingsModal />

      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        onPROpened={() => handleSelectView('prs')}
      />

      <ScaffoldModal
        isOpen={isScaffoldModalOpen}
        onClose={() => setIsScaffoldModalOpen(false)}
        onCreated={() => handleSelectView('editor')}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onNavigateView={handleSelectView}
        onToggleCopilot={toggleCopilot}
        onOpenGitModal={() => handleNavigateToEdits()}
      />
    </div>
  );
};

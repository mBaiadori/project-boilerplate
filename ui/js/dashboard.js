// =============================================================================
// DASHBOARD ORCHESTRATOR & SUBVIEW ROUTER (CLEAN & MODULAR)
// =============================================================================
import { API } from './api.js';
import { Router } from './router.js';
import { initAIModal } from './components/ai-modal.js';
import { initDiffModal } from './components/diff-modal.js';
import { initPanelResizers } from './components/panel-resizer.js';
import { initOnboardingModal } from './components/onboarding-modal.js';
import { initProjectView } from './views/project.js';
import { initEditorChatView } from './views/editor-chat.js';
import { initTreeView } from './views/tree.js';
import { initEngineeringView } from './views/engineering.js';
import { initTemplatesView } from './views/templates.js';
import { initSettingsView } from './views/settings.js';
import { initGovernanceView } from './views/governance.js';
import { initPRsView } from './views/prs.js';
import { initTutorialsView } from './views/tutorials.js';
import { initGraphView } from './views/graph.js';
import { initAuditView } from './views/audit.js';
import { initDictionaryView } from './views/dictionary.js';
import { initWikiDecisionsView } from './views/wiki-decisions.js';
import { initScaffoldModal } from './components/scaffold-modal.js';

export function initDashboardView({ onBackToRepos }) {
  // Top Navbar
  const btnBackToRepos = document.getElementById('btn-back-to-repos');
  const btnQuickScaffold = document.getElementById('btn-quick-scaffold');
  const btnOpenTour = document.getElementById('btn-open-onboarding-tour');
  const dashRepoTitle = document.getElementById('dash-repo-title');
  const dashRepoLink = document.getElementById('dash-repo-link');
  const chatStatusBadge = document.getElementById('chat-status-badge');

  // Tree & Workbench Elements for View Segmentation
  const treePane = document.getElementById('workbench-tree-pane');
  const resizerTree = document.getElementById('resizer-tree');
  const btnExpandTree = document.getElementById('btn-expand-tree-pane');

  // Sidebar Nav Items & Subviews
  const navItems = document.querySelectorAll('.dash-nav-item');
  const subviews = {
    project: document.getElementById('subview-project'),
    editor: document.getElementById('subview-editor'),
    dictionary: document.getElementById('subview-dictionary'),
    engineering: document.getElementById('subview-engineering'),
    wiki: document.getElementById('subview-wiki'),
    graph: document.getElementById('subview-graph'),
    audit: document.getElementById('subview-audit'),
    templates: document.getElementById('subview-templates'),
    settings: document.getElementById('subview-settings'),
    governance: document.getElementById('subview-governance'),
    prs: document.getElementById('subview-prs'),
    tutorials: document.getElementById('subview-tutorials')
  };

  let activeRepo = null;

  // 1. Initialize Components & Subviews
  initPanelResizers();
  const aiModal = initAIModal();
  const onboardingModal = initOnboardingModal();

  if (btnOpenTour) {
    btnOpenTour.addEventListener('click', () => {
      onboardingModal.open(activeRepo?.name, true);
    });
  }

  const scaffoldModal = initScaffoldModal({
    onScaffoldSuccess: async (primaryFile) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: primaryFile });
      } else {
        switchSubview('editor', { file: primaryFile });
      }
      await treeView.loadDocumentTree();
      await editorChatView.loadDocument(primaryFile);
      diffModal.updateBadgeStatus();
    }
  });

  if (btnQuickScaffold) {
    btnQuickScaffold.addEventListener('click', () => scaffoldModal.open('feature'));
  }

  const diffModal = initDiffModal({
    onPROpened: (pr) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/prs`);
      } else {
        switchSubview('prs');
      }
      prsView.loadAllPRs();
    },
    onDiscardChanges: () => {
      editorChatView.loadDocument('index.md');
      treeView.loadDocumentTree();
    }
  });

  const projectView = initProjectView({
    onConfigSaved: async () => {
      await diffModal.updateBadgeStatus();
      if (editorChatView.loadProjectTaxonomy) {
        await editorChatView.loadProjectTaxonomy();
      }
    },
    onNotify: (msg) => {
      console.log(`[Project Hub] ${msg}`);
    }
  });

  const editorChatView = initEditorChatView({
    getActiveRepo: () => activeRepo,
    onWorkspaceChanged: () => {
      diffModal.updateBadgeStatus();
    }
  });

  const treeView = initTreeView({
    onOpenFile: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
    },
    onWorkspaceChanged: () => {
      diffModal.updateBadgeStatus();
    }
  });

  const engineeringView = initEngineeringView({
    onOpenInEditor: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
      diffModal.updateBadgeStatus();
    }
  });

  const templatesView = initTemplatesView({
    onUseTemplateInEditor: async (path, assistantPrompt) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
      await editorChatView.loadDocument(path, assistantPrompt);
      diffModal.updateBadgeStatus();
    }
  });

  const tutorialsView = initTutorialsView({
    onOpenInEditor: ({ content, filename, title }) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: filename });
      } else {
        switchSubview('editor', { file: filename });
      }
      editorChatView.setContent(content, filename, `Você está praticando o tutorial: ${title}`);
    }
  });

  const graphView = initGraphView({
    onOpenDocument: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
    }
  });

  const auditView = initAuditView({
    onOpenDocument: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
    }
  });

  const settingsView = initSettingsView({
    onLogout: () => onBackToRepos()
  });
  const governanceView = initGovernanceView();
  const prsView = initPRsView();

  const dictionaryView = initDictionaryView({
    onOpenDocument: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
    }
  });

  const wikiDecisionsView = initWikiDecisionsView({
    getActiveRepo: () => activeRepo
  });

  // 2. Navigation Routing
  btnBackToRepos.addEventListener('click', () => onBackToRepos());

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.dataset.view;
      switchSubview(targetView);
    });
  });

  function switchSubview(viewKey, queryParams = {}, isFromRouter = false) {
    if (!subviews[viewKey]) {
      viewKey = 'project';
    }

    if (!isFromRouter && activeRepo) {
      Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/${viewKey}`, queryParams);
    }

    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewKey);
    });

    // Oculta qualquer menu flutuante órfão do editor ao trocar de tela
    document.querySelectorAll('.notion-side-handle, .notion-block-menu, .notion-drop-indicator, .bubble-menu-popover, .slash-menu-popover, .bubble-color-picker').forEach(el => {
      el.style.display = 'none';
    });

    Object.keys(subviews).forEach(k => {
      if (subviews[k]) {
        subviews[k].style.display = (k === viewKey) ? 'flex' : 'none';
      }
    });

    if (viewKey === 'project') {
      projectView.loadProjectConfig();
    } else if (viewKey === 'editor') {
      // View Documentos: Árvore completa de domains/ visível
      if (treePane) treePane.style.display = 'flex';
      if (resizerTree) resizerTree.style.display = 'block';
      treeView.loadDocumentTree();
      const fileToLoad = queryParams.file || (editorChatView.getCurrentPath ? editorChatView.getCurrentPath() : 'index.md');
      if (fileToLoad) {
        editorChatView.loadDocument(fileToLoad);
      }
    } else if (viewKey === 'dictionary') {
      dictionaryView.loadDictionary();
    } else if (viewKey === 'engineering') {
      engineeringView.loadEngineeringFiles();
    } else if (viewKey === 'wiki') {
      wikiDecisionsView.loadWiki();
    } else if (viewKey === 'graph') {
      graphView.load();
    } else if (viewKey === 'audit') {
      auditView.load();
    } else if (viewKey === 'templates') {
      templatesView.loadTemplatesCatalog();
    } else if (viewKey === 'tutorials') {
      tutorialsView.loadTutorials(queryParams.id || queryParams.tutorial);
    } else if (viewKey === 'settings') {
      settingsView.loadSystemSettings();
    } else if (viewKey === 'governance') {
      governanceView.loadGovernanceData();
    } else if (viewKey === 'prs') {
      prsView.loadAllPRs();
    }
  }

  async function open(repo, targetSubview = 'project', queryParams = {}) {
    activeRepo = repo;
    dashRepoTitle.textContent = repo.name;
    dashRepoLink.href = repo.html_url || `https://github.com/${repo.full_name}`;

    // Verificar se o projeto é novo/não-configurado diretamente no repositório
    let initialSubview = targetSubview;
    try {
      const { ok, data: statusData } = await API.getProjectStatus();
      if (ok && statusData && statusData.is_configured === false) {
        initialSubview = 'project';
      }
    } catch (e) {
      console.warn('Erro ao verificar status do projeto:', e);
    }

    switchSubview(initialSubview, queryParams, true);
    await diffModal.updateBadgeStatus();
    try {
      const st = await API.getStatus();
      if (st.ai_settings) {
        aiModal.selectProvider(st.ai_settings.provider || 'gemini');
        if (st.ai_settings.model) aiModal.setModel(st.ai_settings.model);
        if (chatStatusBadge && st.ai_settings.model) {
          chatStatusBadge.innerHTML = `<span class="material-symbols-outlined icon-xs">bolt</span> ${st.ai_settings.model}`;
        }
      }
    } catch (e) {}
  }

  return {
    open,
    switchSubview,
    getActiveRepo: () => activeRepo,
    editorChatView
  };
}

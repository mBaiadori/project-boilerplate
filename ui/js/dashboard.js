// =============================================================================
// DASHBOARD ORCHESTRATOR & SUBVIEW ROUTER (CLEAN & MODULAR)
// =============================================================================
import { API } from './api.js';
import { Router } from './router.js';
import { initAIModal } from './components/ai-modal.js';
import { initDiffModal } from './components/diff-modal.js';
import { initPanelResizers } from './components/panel-resizer.js';
import { initOnboardingModal } from './components/onboarding-modal.js';
import { AIChatCopilot } from './components/ai-chat-copilot.js';
import { initEditorChatView } from './views/editor-chat.js';
import { initTreeView } from './views/tree.js';
import { initTemplatesView } from './views/templates.js';
import { initSettingsView } from './views/settings.js';
import { initPRsView } from './views/prs.js';
import { initTutorialsView } from './views/tutorials.js';
import { initDictionaryView } from './views/dictionary.js';
import { initWikiDecisionsView } from './views/wiki-decisions.js';
import { initScaffoldModal } from './components/scaffold-modal.js';

export function initDashboardView({ onBackToRepos }) {
  // Top Navbar
  const btnBackToRepos = document.getElementById('btn-back-to-repos');
  const btnQuickScaffold = document.getElementById('btn-quick-scaffold');
  const btnOpenTour = document.getElementById('btn-open-onboarding-tour');
  const btnGlobalAiCopilot = document.getElementById('btn-global-ai-copilot');
  const dashRepoTitle = document.getElementById('dash-repo-title');
  const dashRepoLink = document.getElementById('dash-repo-link');
  const chatStatusBadge = document.getElementById('chat-status-badge');

  // Tree & Workbench Elements for View Segmentation
  const treePane = document.getElementById('workbench-tree-pane');
  const resizerTree = document.getElementById('resizer-tree');
  const btnExpandTree = document.getElementById('btn-expand-tree-pane');

  // Global AI Copilot Elements & State
  const globalAiPane = document.getElementById('global-ai-pane');
  const resizerGlobalAi = document.getElementById('resizer-global-ai');
  const STORAGE_KEY_GLOBAL_AI_OPEN = 'governance_global_ai_chat_open';
  let globalCopilot = null;

  // Sidebar Nav Items & Subviews
  const navItems = document.querySelectorAll('.dash-nav-item');
  const subviews = {
    editor: document.getElementById('subview-editor'),
    dictionary: document.getElementById('subview-dictionary'),
    wiki: document.getElementById('subview-wiki'),
    templates: document.getElementById('subview-templates'),
    settings: document.getElementById('subview-settings'),
    prs: document.getElementById('subview-prs'),
    tutorials: document.getElementById('subview-tutorials')
  };

  let activeRepo = null;
  let currentActiveSubview = 'editor';

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
      const cur = editorChatView.getCurrentPath ? editorChatView.getCurrentPath() : '';
      if (cur) {
        editorChatView.loadDocument(cur, '', true);
      } else if (editorChatView.showEmptyState) {
        editorChatView.showEmptyState();
      }
      treeView.loadDocumentTree();
    }
  });

  const editorChatView = initEditorChatView({
    getActiveRepo: () => activeRepo,
    onWorkspaceChanged: () => {
      diffModal.updateBadgeStatus();
    },
    onDocumentLoaded: (docData) => {
      if (currentActiveSubview === 'editor') {
        updateGlobalCopilotContext('editor', { file: docData.path, assistantPrompt: docData.assistantPrompt });
      }
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
      if (editorChatView.setEditorMarkdown) {
        editorChatView.setEditorMarkdown(content);
      }
      diffModal.updateBadgeStatus();
    }
  });

  const prsView = initPRsView();
  const dictionaryView = initDictionaryView();
  const wikiDecisionsView = initWikiDecisionsView({
    onOpenInEditor: async (path) => {
      if (activeRepo) {
        Router.navigate(`/workspace/${encodeURIComponent(activeRepo.name)}/editor`, { file: path });
      } else {
        switchSubview('editor', { file: path });
      }
      diffModal.updateBadgeStatus();
    }
  });
  const settingsView = initSettingsView();

  function setGlobalAiVisibility(shouldOpen) {
    if (!globalAiPane) return;
    globalAiPane.style.display = shouldOpen ? 'flex' : 'none';
    if (resizerGlobalAi) resizerGlobalAi.style.display = shouldOpen ? 'block' : 'none';
    if (btnGlobalAiCopilot) {
      btnGlobalAiCopilot.classList.toggle('active', shouldOpen);
    }
    localStorage.setItem(STORAGE_KEY_GLOBAL_AI_OPEN, shouldOpen ? 'true' : 'false');
  }

  function toggleGlobalAi() {
    const isCurrentlyOpen = globalAiPane && globalAiPane.style.display !== 'none';
    setGlobalAiVisibility(!isCurrentlyOpen);
  }

  if (globalAiPane) {
    globalCopilot = new AIChatCopilot({
      containerEl: globalAiPane,
      scopeType: 'global',
      contextPath: 'wiki/index.md',
      agentName: 'Antigravity Agent',
      agentIcon: 'smart_toy',
      storageKeyPrefix: 'governance_global_chat_history',
      getContent: () => '',
      chips: [
        { label: "✨ Propor Especificação", prompt: "Proponha a estrutura para uma nova especificação técnica baseada nas necessidades do sistema." },
        { label: "🔍 Auditar Coerência", prompt: "Audite a consistência entre as especificações e regras de negócio do repositório." }
      ],
      welcomeMessage: 'Olá! Sou o assistente de governança e especificação. Como posso ajudar com a arquitetura ou documentos do projeto?',
      onClose: () => {
        setGlobalAiVisibility(false);
      }
    });

    const savedGlobalAiState = localStorage.getItem(STORAGE_KEY_GLOBAL_AI_OPEN);
    const initialGlobalAiOpen = savedGlobalAiState !== null ? savedGlobalAiState === 'true' : false;
    setGlobalAiVisibility(initialGlobalAiOpen);
  }

  if (btnGlobalAiCopilot) {
    btnGlobalAiCopilot.addEventListener('click', () => {
      toggleGlobalAi();
    });
  }

  function updateGlobalCopilotContext(viewKey, extraParams = {}) {
    if (!globalCopilot) return;

    if (viewKey === 'editor') {
      const activeFilePath = extraParams.file || (editorChatView.getCurrentPath ? editorChatView.getCurrentPath() : 'index.md');
      const meta = editorChatView.getCurrentMetadata ? editorChatView.getCurrentMetadata() : {};
      const customPrompt = (meta && meta.assistant_prompt) || extraParams.assistantPrompt || '';
      const isSpecialized = Boolean(customPrompt);

      globalCopilot.setContext({
        contextPath: activeFilePath,
        agentName: isSpecialized ? 'Assistente Especialista' : 'Antigravity Agent',
        agentIcon: isSpecialized ? 'psychology' : 'description',
        defaultSystemPrompt: extraParams.assistantPrompt || '',
        customSystemPrompt: (meta && meta.assistant_prompt) || '',
        getContent: () => (editorChatView.getEditorContent ? editorChatView.getEditorContent() : ''),
        chips: [
          { label: "📊 Diagrama Mermaid", prompt: "Gere um diagrama Mermaid para a arquitetura deste documento." },
          { label: "📖 Dicionário Ubíquo", prompt: "Refine o Dicionário Ubíquo adicionando novas entidades com escopo e regras baseadas neste documento." },
          { label: "🛡️ Auditar Especificação", prompt: "Audite a aderência deste documento aos padrões de arquitetura e consistência." },
          { label: "🧪 Cenário BDD", prompt: "Proponha um cenário BDD em Gherkin com base nas invariantes deste documento." }
        ],
        welcomeMessage: isSpecialized
          ? `Assistente Especialista ativo no documento <code>${activeFilePath}</code>. Como posso ajudar no preenchimento e refinamento das seções?`
          : `Pareando com você no documento ativo: <code>${activeFilePath}</code>. Como posso ajudar na modelagem, invariantes ou diagramas?`,
        onApplyContent: (codeText) => {
          if (editorChatView.setEditorMarkdown) {
            editorChatView.setEditorMarkdown(codeText);
          } else if (editorChatView.insertIntoEditor) {
            editorChatView.insertIntoEditor(codeText);
          }
        },
        onApplyDiff: (diffData) => {
          if (editorChatView.showInlineDiff) {
            return editorChatView.showInlineDiff(diffData);
          }
          return false;
        },
        onPromptSaved: async (newPrompt) => {
          if (editorChatView.saveAssistantPrompt) await editorChatView.saveAssistantPrompt(newPrompt);
        },
        onPromptRestored: async (defPrompt) => {
          if (editorChatView.restoreAssistantPrompt) await editorChatView.restoreAssistantPrompt(defPrompt);
        }
      });
    } else if (viewKey === 'dictionary') {
      globalCopilot.setContext({
        contextPath: 'dictionary.json',
        agentName: 'Curador de Linguagem Ubíqua',
        agentIcon: 'menu_book',
        getContent: () => 'Dicionário Ubíquo de Termos de Negócio e Glossário',
        chips: [
          { label: "✨ Sugerir Termo", prompt: "Sugira novos termos ubíquos e sinônimos recomendados para o projeto." },
          { label: "🔍 Auditar Ambiguidade", prompt: "Identifique termos com duplo sentido ou ambiguidades conceituais." },
          { label: "📝 Padronizar Sinônimos", prompt: "Padronize termos de negócio eliminando inconsistências conceituais." }
        ],
        welcomeMessage: 'Curador de Linguagem Ubíqua ativo. Posso ajudar na definição de termos canônicos e vocabulário oficial.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'wiki') {
      globalCopilot.setContext({
        contextPath: 'wiki/index.md',
        agentName: 'Curador de Wiki & ADRs',
        agentIcon: 'auto_stories',
        getContent: () => 'Wiki do Projeto e Architecture Decision Records (ADRs)',
        chips: [
          { label: "🏛️ Nova ADR", prompt: "Ajude a estruturar um Architecture Decision Record (ADR) no padrão Contexto-Decisão-Consequências." },
          { label: "📚 Sintetizar Wiki", prompt: "Sintetize a documentação da Wiki e aponte tópicos desatualizados." }
        ],
        welcomeMessage: 'Curador de Wiki & ADRs ativo. Posso auxiliar na redação de decisões arquiteturais e artigos da base de conhecimento.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'prs') {
      globalCopilot.setContext({
        contextPath: 'prs/index.md',
        agentName: 'Revisor de Pull Requests',
        agentIcon: 'merge_type',
        getContent: () => 'Revisão de Pull Requests e Diffs de Especificação',
        chips: [
          { label: "🔍 Resumo do PR", prompt: "Faça um resumo executivo dos PRs abertos e suas alterações." },
          { label: "⚠️ Conflitos & Riscos", prompt: "Aponte conflitos potenciais e riscos de regressão nas branches ativas." }
        ],
        welcomeMessage: 'Revisor de PRs ativo. Posso avaliar o impacto de propostas de merge em relação à baseline do repositório.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'tutorials') {
      globalCopilot.setContext({
        contextPath: 'tutorials/index.md',
        agentName: 'Tutor Interativo',
        agentIcon: 'school',
        getContent: () => 'Trilhas de Aprendizado, Tutoriais e Exercícios Práticos',
        chips: [
          { label: "💡 Explicar Conceito", prompt: "Explique de forma didática o conceito central deste tutorial com exemplos práticos." },
          { label: "🎯 Próximo Exercício", prompt: "Recomende o próximo exercício prático para fixar o aprendizado." }
        ],
        welcomeMessage: 'Tutor Interativo pronto. Posso tirar dúvidas sobre conceitos de especificação, Frontmatter, BDD e boas práticas.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else {
      globalCopilot.setContext({
        contextPath: `${viewKey}/index.md`,
        agentName: 'Antigravity Agent',
        agentIcon: 'smart_toy',
        chips: [],
        welcomeMessage: `Pareando com você na visão ${viewKey}. Como posso ajudar?`,
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    }
  }

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
      viewKey = 'editor';
    }
    currentActiveSubview = viewKey;

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

    if (viewKey === 'editor') {
      if (treePane) treePane.style.display = 'flex';
      if (resizerTree) resizerTree.style.display = 'block';
      treeView.loadDocumentTree();
      const fileToLoad = queryParams.file || (editorChatView.getCurrentPath ? editorChatView.getCurrentPath() : '');
      if (fileToLoad) {
        editorChatView.loadDocument(fileToLoad);
      } else if (editorChatView.showEmptyState) {
        editorChatView.showEmptyState();
      }
    } else if (viewKey === 'dictionary') {
      dictionaryView.loadDictionary();
    } else if (viewKey === 'wiki') {
      wikiDecisionsView.loadWiki();
    } else if (viewKey === 'templates') {
      templatesView.loadTemplatesCatalog();
    } else if (viewKey === 'tutorials') {
      tutorialsView.loadTutorials(queryParams.id || queryParams.tutorial);
    } else if (viewKey === 'settings') {
      settingsView.loadSystemSettings();
    } else if (viewKey === 'prs') {
      prsView.loadAllPRs();
    }

    updateGlobalCopilotContext(viewKey, queryParams);
  }

  async function open(repo, targetSubview = 'editor', queryParams = {}) {
    activeRepo = repo;
    dashRepoTitle.textContent = repo.name;
    dashRepoLink.href = repo.html_url || `https://github.com/${repo.full_name}`;

    switchSubview(targetSubview || 'editor', queryParams, true);
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

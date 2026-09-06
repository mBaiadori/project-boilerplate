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
  let currentActiveSubview = 'project';

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

  const projectView = initProjectView({
    getActiveRepo: () => activeRepo,
    onConfigSaved: async () => {
      await diffModal.updateBadgeStatus();
      if (editorChatView.loadProjectTaxonomy) {
        await editorChatView.loadProjectTaxonomy();
      }
      if (currentActiveSubview === 'project') {
        updateGlobalCopilotContext('project');
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

  // Global Copilot Management
  function setGlobalAiVisibility(show) {
    if (!globalAiPane) return;
    globalAiPane.classList.toggle('collapsed', !show);
    if (resizerGlobalAi) {
      resizerGlobalAi.classList.toggle('collapsed', !show);
    }
    if (btnGlobalAiCopilot) {
      btnGlobalAiCopilot.classList.toggle('active', show);
    }
    try {
      localStorage.setItem(STORAGE_KEY_GLOBAL_AI_OPEN, show ? 'true' : 'false');
    } catch (e) {}
  }

  function isGlobalAiOpen() {
    return globalAiPane && !globalAiPane.classList.contains('collapsed');
  }

  function toggleGlobalAi() {
    setGlobalAiVisibility(!isGlobalAiOpen());
  }

  if (globalAiPane) {
    globalCopilot = new AIChatCopilot({
      container: globalAiPane,
      resizer: resizerGlobalAi,
      storageKey: 'governance_global_ai_width',
      contextPath: 'project/index.md',
      agentName: 'Arquiteto de Fundação',
      agentIcon: 'psychology',
      modelName: 'gemini-3.5-flash',
      defaultSystemPrompt: '',
      getRepoName: () => (activeRepo ? activeRepo.name : 'default'),
      getContent: () => (projectView.getProjectSummaryContent ? projectView.getProjectSummaryContent() : ''),
      chips: [
        { label: "🚀 Propor Bounded Contexts", prompt: "Com base nas premissas e 5W2H do projeto, proponha a divisão inicial de Bounded Contexts e domínios essenciais." },
        { label: "⚖️ Análise 5W2H", prompt: "Revise o Canvas 5W2H do projeto e identifique riscos, lacunas de escopo e possíveis dependências ocultas." },
        { label: "🏗️ Padrões de Camadas", prompt: "Sugira a arquitetura em camadas mais adequada para os domínios configurados (Hexagonal, Onion, Clean Architecture)." },
        { label: "🔍 Auditar Coerência", prompt: "Audite a consistência entre o nome do projeto, descrição de negócio e as capacidades de domínio mapeadas." }
      ],
      welcomeMessage: 'Olá! Sou o Arquiteto de Fundação. Posso ajudar na definição da visão do projeto, Bounded Contexts, canvas 5W2H e taxonomia de arquitetura.',
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

    if (viewKey === 'project') {
      globalCopilot.setContext({
        contextPath: 'project/index.md',
        agentName: 'Arquiteto de Fundação',
        agentIcon: 'psychology',
        defaultSystemPrompt: projectView.DEFAULT_ABOUT_AGENT_PROMPT || '',
        getContent: () => (projectView.getProjectSummaryContent ? projectView.getProjectSummaryContent() : ''),
        chips: [
          { label: "🚀 Propor Bounded Contexts", prompt: "Com base nas premissas e 5W2H do projeto, proponha a divisão inicial de Bounded Contexts e domínios essenciais." },
          { label: "⚖️ Análise 5W2H", prompt: "Revise o Canvas 5W2H do projeto e identifique riscos, lacunas de escopo e possíveis dependências ocultas." },
          { label: "🏗️ Padrões de Camadas", prompt: "Sugira a arquitetura em camadas mais adequada para os domínios configurados (Hexagonal, Onion, Clean Architecture)." },
          { label: "🔍 Auditar Coerência", prompt: "Audite a consistência entre o nome do projeto, descrição de negócio e as capacidades de domínio mapeadas." }
        ],
        welcomeMessage: 'Olá! Sou o Arquiteto de Fundação. Posso ajudar na definição da visão do projeto, Bounded Contexts, canvas 5W2H e taxonomia de arquitetura.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'editor') {
      const activeFilePath = extraParams.file || (editorChatView.getCurrentPath ? editorChatView.getCurrentPath() : 'domains/index.md');
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
          { label: "🛡️ Auditar DDD", prompt: "Audite a aderência deste documento aos princípios de DDD e padrões de arquitetura." },
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
        contextPath: 'project/dictionary.md',
        agentName: 'Curador de Linguagem Ubíqua',
        agentIcon: 'menu_book',
        getContent: () => 'Dicionário Ubíquo de Termos de Negócio e Glossário de Domínios',
        chips: [
          { label: "✨ Sugerir Termo", prompt: "Sugira novos termos ubíquos e sinônimos recomendados para os domínios do projeto." },
          { label: "🔍 Auditar Ambiguidade", prompt: "Identifique termos com duplo sentido ou ambiguidades conceituais entre contextos delimitados." },
          { label: "📝 Padronizar Sinônimos", prompt: "Padronize termos de negócio eliminando jargões técnicos incompatíveis com a linguagem ubíqua." }
        ],
        welcomeMessage: 'Curador de Linguagem Ubíqua ativo. Posso ajudar na definição de termos canônicos, limites semânticos e glossário DDD.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'engineering') {
      globalCopilot.setContext({
        contextPath: 'engenharia/index.md',
        agentName: 'Especialista em Engenharia',
        agentIcon: 'terminal',
        getContent: () => 'Diretrizes de Engenharia, CI/CD, Containers e DevOps',
        chips: [
          { label: "⚡ Auditar CI/CD", prompt: "Analise a esteira de CI/CD e sugira automações para validação de testes e linter." },
          { label: "🐳 Docker & Containers", prompt: "Recomende melhorias para os Dockerfiles e orquestração de microsserviços." },
          { label: "🛡️ Segurança & Secrets", prompt: "Revise a estratégia de gestão de segredos e conformidade de dependências." }
        ],
        welcomeMessage: 'Especialista em Engenharia pronto. Posso auxiliar em pipelines de CI/CD, configurações Docker, infraestrutura e automação.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'governance') {
      globalCopilot.setContext({
        contextPath: '.spec-memory/_rules/governance.yaml',
        agentName: 'Guardião de Governança',
        agentIcon: 'verified_user',
        getContent: () => 'Regras de Governança, Políticas de Revisão e Conformidade de Especificação',
        chips: [
          { label: "🛡️ Auditar Regras", prompt: "Audite todas as regras de governança ativas e aponte violações de conformidade." },
          { label: "📋 Propor Política", prompt: "Proponha uma nova política de revisão de código e aprovação para branches principais." }
        ],
        welcomeMessage: 'Guardião de Governança ativo. Posso avaliar conformidade de branch protection, políticas de spec memory e regras arquiteturais.',
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
    } else if (viewKey === 'graph') {
      globalCopilot.setContext({
        contextPath: 'graph/dependencies.json',
        agentName: 'Analista de Grafo de Conhecimento',
        agentIcon: 'hub',
        getContent: () => 'Grafo de Relacionamentos, Dependências e Consumidores de Artefatos',
        chips: [
          { label: "🕸️ Dependências Cíclicas", prompt: "Identifique nós com acoplamento excessivo ou ciclos no grafo de dependências." },
          { label: "🎯 Impacto de Mudança", prompt: "Qual o raio de impacto no grafo caso o domínio principal seja refatorado?" }
        ],
        welcomeMessage: 'Analista de Grafo pronto. Posso interpretar nós, arestas de dependência e impactos arquiteturais em cascata.',
        onApplyContent: null,
        onPromptSaved: null,
        onPromptRestored: null
      });
    } else if (viewKey === 'audit') {
      globalCopilot.setContext({
        contextPath: 'audit/spec-lint.md',
        agentName: 'Auditor de Especificação',
        agentIcon: 'fact_check',
        getContent: () => 'Relatório de Linting, Validações Semânticas e Score de Conformidade',
        chips: [
          { label: "🚨 Corrigir Erros L1/L4", prompt: "Analise os erros de lint detectados e forneça correções passo a passo." },
          { label: "📈 Score de Maturidade", prompt: "Como elevar a pontuação de conformidade e maturidade da especificação para 100%?" }
        ],
        welcomeMessage: 'Auditor de Especificação ativo. Posso analisar violações de taxonomia L1–L4 e guiar o plano de correção.',
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
          { label: "🔍 Resumo do PR", prompt: "Faça um resumo executivo dos PRs abertos e seus impactos nos domínios." },
          { label: "⚠️ Conflitos & Riscos", prompt: "Aponte conflitos potenciais e riscos de regressão nas branches ativas." }
        ],
        welcomeMessage: 'Revisor de PRs ativo. Posso avaliar o impacto de propostas de merge em relação à baseline do projeto.',
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
        welcomeMessage: 'Tutor Interativo pronto. Posso tirar dúvidas sobre conceitos de DDD, Frontmatter, BDD e boas práticas.',
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
      viewKey = 'project';
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

    if (viewKey === 'project') {
      projectView.loadProjectConfig(queryParams.tab || null);
    } else if (viewKey === 'editor') {
      // View Documentos: Árvore completa de domains/ visível
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

    updateGlobalCopilotContext(viewKey, queryParams);
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

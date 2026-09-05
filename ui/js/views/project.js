// =============================================================================
// VIEW MODULE: COCKPIT DE FUNDAÇÃO & SETUP DO PROJETO (PROJECT HUB)
// =============================================================================
import { API } from "../api.js";
import { AIChatCopilot } from "../components/ai-chat-copilot.js";

export function initProjectView({ onConfigSaved, onNotify, getActiveRepo }) {
  // Navigation Tabs
  const tabBtns = document.querySelectorAll(".project-tab-btn");
  const tabPanes = document.querySelectorAll(".project-tab-pane");

  // Top Header Elements
  const headerTitle = document.getElementById("proj-header-title");
  const syncBadge = document.getElementById("proj-sync-badge");
  const btnSaveConfig = document.getElementById("btn-project-save-config");
  const btnResetConfig = document.getElementById("btn-project-reset-config");

  // Form Fields: Identidade & Metadados
  const inputName = document.getElementById("proj-input-name");
  const inputArchPattern = document.getElementById("proj-input-arch-pattern");
  const inputVersion = document.getElementById("proj-input-version");
  const inputLead = document.getElementById("proj-input-lead");
  const inputRepoUrl = document.getElementById("proj-input-repo-url");
  const inputDesc = document.getElementById("proj-input-desc");

  // Form Fields: 5W2H Canvas
  const input5w2hWhat = document.getElementById("proj-5w2h-what");
  const input5w2hWhy = document.getElementById("proj-5w2h-why");
  const input5w2hWho = document.getElementById("proj-5w2h-who");
  const input5w2hWhere = document.getElementById("proj-5w2h-where");
  const input5w2hWhen = document.getElementById("proj-5w2h-when");
  const input5w2hHow = document.getElementById("proj-5w2h-how");
  const input5w2hHowMuch = document.getElementById("proj-5w2h-how-much");

  // Form Fields: Organização (Domains / Áreas)
  const domainsGrid = document.getElementById("proj-domains-grid");
  const btnAddDomain = document.getElementById("btn-proj-add-domain");
  const domainsCountBadge = document.getElementById("proj-domains-count-badge");
  const btnDomainsViewGrid = document.getElementById("btn-domains-view-grid");
  const btnDomainsViewList = document.getElementById("btn-domains-view-list");
  const sugPanel = document.getElementById("proj-domains-suggestions-panel");
  const sugHeader = document.getElementById("proj-domains-suggestions-header");
  const sugChevron = document.getElementById("proj-domains-sug-chevron");
  const sugLabel = document.getElementById("proj-domains-sug-label");
  const sugGrid = document.getElementById("proj-domains-suggestions-grid");
  const sugCountBadge = document.getElementById("proj-suggestions-count-badge");
  const STORAGE_KEY_SUG_COLLAPSED = "proj_domains_suggestions_collapsed";
  const STORAGE_KEY_DOMAINS_VIEW_MODE = "proj_domains_view_mode";

  // Default Standard Corporate Domains provided by the framework
  const DEFAULT_ORG_DOMAINS = [
    {
      id: "financeiro",
      name: "Financeiro",
      icon: "payments",
      color: "#10b981",
      description:
        "Gestão de fluxo de caixa, pagamentos, faturamento, conciliação contábil, auditoria e tesouraria.",
      responsibles: [],
      suggested_subdomains: [
        { id: "contas-a-pagar", name: "Contas a Pagar", description: "Gestão de obrigações, parceiros e controle de vencimentos." },
        { id: "contas-a-receber", name: "Contas a Receber", description: "Gestão de recebíveis, cobrança e conciliação bancária de entradas." },
        { id: "faturamento", name: "Faturamento & NFe", description: "Emissão de notas fiscais, impostos e conformidade fiscal." },
        { id: "tesouraria", name: "Tesouraria & Conciliação", description: "Controle de saldos bancários, liquidez diária e transferências." },
      ],
    },
    {
      id: "marketing",
      name: "Marketing",
      icon: "campaign",
      color: "#f59e0b",
      description:
        "Aquisição de clientes, campanhas digitais, branding, funil de conversão, comunicação e growth.",
      responsibles: [],
      suggested_subdomains: [
        { id: "aquisicao", name: "Aquisição & Mídia", description: "Campanhas de tráfego pago, anúncios em redes e canais digitais." },
        { id: "branding", name: "Branding & Posicionamento", description: "Identidade corporativa, tom de voz, design de marca e reputação." },
        { id: "growth", name: "Growth & Experimentação", description: "Otimização de conversão (CRO), testes A/B e funis de retenção." },
        { id: "conteudo", name: "Conteúdo & Inbound", description: "Produção de conteúdo editorial, artigos técnicos, SEO e newsletters." },
      ],
    },
    {
      id: "administrativo",
      name: "Administrativo",
      icon: "corporate_fare",
      color: "#6366f1",
      description:
        "Governança corporativa, facilities, gestão de contratos, compliance regulatório e rotinas internas.",
      responsibles: [],
      suggested_subdomains: [
        { id: "rh-dp", name: "Recursos Humanos & DP", description: "Gestão de colaboradores, folha, benefícios e recrutamento." },
        { id: "facilities", name: "Facilities & Patrimônio", description: "Gestão de infraestrutura física, suprimentos e escritórios." },
        { id: "juridico-compliance", name: "Jurídico & Compliance", description: "Gestão contratual, LGPD, riscos regulatórios e governança." },
        { id: "compras", name: "Compras & Suprimentos", description: "Cotações, negociações com fornecedores e requisições internas." },
      ],
    },
    {
      id: "operacional",
      name: "Operacional",
      icon: "settings_suggest",
      color: "#0ea5e9",
      description:
        "Execução de processos operacionais, logística, atendimento ao cliente, suporte e controle de SLAs.",
      responsibles: [],
      suggested_subdomains: [
        { id: "logistica", name: "Logística & Fulfillment", description: "Controle de estoque, expedição, despacho e rastreamento de entregas." },
        { id: "atendimento", name: "Atendimento & Suporte (SAC)", description: "Central de ajuda, triagem de tickets e atendimento ao cliente final." },
        { id: "qualidade", name: "Qualidade & SLA", description: "Auditoria de processos operacionais e garantia de cumprimento de prazos." },
        { id: "pos-venda", name: "Pós-Venda & Retenção", description: "Sucesso do cliente, acompanhamento de satisfação (NPS) e onboarding." },
      ],
    },
    {
      id: "engenharia",
      name: "Engenharia",
      icon: "terminal",
      color: "#8b5cf6",
      description:
        "Desenvolvimento de software, arquitetura de sistemas, infraestrutura em nuvem, DevOps e segurança.",
      responsibles: [],
      suggested_subdomains: [
        { id: "backend", name: "Backend & APIs", description: "Microsserviços, banco de dados, regras de negócio e integrações REST/gRPC." },
        { id: "frontend", name: "Frontend & Web Apps", description: "Interfaces web, aplicações mobile, componentes de UI e experiência do usuário." },
        { id: "infra-devops", name: "Infraestrutura & DevOps", description: "Pipelines de CI/CD, clusters Kubernetes, Docker e automação de deploy." },
        { id: "seguranca", name: "Segurança & SecOps", description: "Gestão de vulnerabilidades, IAM, criptografia e proteção de dados sensíveis." },
      ],
    },
  ];

  const DOMAIN_COLOR_PALETTE = [
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
    "#6366f1",
    "#14b8a6",
  ];

  // Form Fields: Camadas de Arquitetura & Governança (L0 - L5)
  const layersGrid = document.getElementById("proj-layers-grid");
  const btnAddLayer = document.getElementById("btn-proj-add-layer");
  const layersCountBadge = document.getElementById("proj-layers-count-badge");
  const btnLayersViewGrid = document.getElementById("btn-layers-view-grid");
  const btnLayersViewList = document.getElementById("btn-layers-view-list");
  const layerSugPanel = document.getElementById("proj-layers-suggestions-panel");
  const layerSugHeader = document.getElementById("proj-layers-suggestions-header");
  const layerSugChevron = document.getElementById("proj-layers-sug-chevron");
  const layerSugLabel = document.getElementById("proj-layers-sug-label");
  const layerSugGrid = document.getElementById("proj-layers-suggestions-grid");
  const layerSugCountBadge = document.getElementById("proj-layer-sug-count-badge");
  const STORAGE_KEY_LAYER_SUG_COLLAPSED = "proj_layers_suggestions_collapsed";
  const STORAGE_KEY_LAYERS_VIEW_MODE = "proj_layers_view_mode";

  // Default Standard Architecture Layers provided by the framework (Camadas 0 a 5)
  const DEFAULT_PROJECT_LAYERS = [
    {
      key: "L0_FOUNDATION",
      layer_number: 0,
      label: "Camada 0 — Visão Global & Fundação",
      name: "Visão Global & Fundação",
      icon: "hub",
      color: "#6366f1",
      importance: "Crítica / Raiz",
      description:
        "Constituição do projeto, 5W2H, governança raiz, padrões globais de engenharia e dicionário ubíquo.",
      rules:
        "Define as diretrizes supremas do projeto. Nenhum domínio pode violar os princípios estabelecidos na Camada 0.",
    },
    {
      key: "L1_DOMAIN",
      layer_number: 1,
      label: "Camada 1 — Domínios Bounded Context",
      name: "Domínios Bounded Context",
      icon: "domain",
      color: "#3b82f6",
      importance: "Estratégica",
      description:
        "Contextos delimitados, fronteiras arquiteturais de negócio, fluxos cross-domínio e responsáveis oficiais.",
      rules:
        "Isola os modelos de negócio e delimita a autoridade de dados de cada área da organização.",
    },
    {
      key: "L2_SUBDOMAIN",
      layer_number: 2,
      label: "Camada 2 — Subdomínios & Capacidades",
      name: "Subdomínios & Capacidades",
      icon: "category",
      color: "#0ea5e9",
      importance: "Tática",
      description:
        "Subdomínios, capacidades funcionais, módulos e agrupamentos lógicos de funcionalidades.",
      rules:
        "Organiza o escopo operacional dentro de cada domínio para decomposição e navegabilidade de requisitos.",
    },
    {
      key: "L3_FEATURE",
      layer_number: 3,
      label: "Camada 3 — Artefatos & Especificações",
      name: "Artefatos & Especificações",
      icon: "description",
      color: "#10b981",
      importance: "Operacional",
      description:
        "Ideação, KPIs de sucesso, pesquisa técnica, contratos de API, modelagem de entidades e fluxos visuais.",
      rules:
        "Especificações detalhadas de cada feature antes do scaffolding ou implementação de código.",
    },
    {
      key: "L4_BEHAVIOR",
      layer_number: 4,
      label: "Camada 4 — Comportamento BDD & Cenários",
      name: "Comportamento BDD & Cenários",
      icon: "fact_check",
      color: "#f59e0b",
      importance: "Executável",
      description:
        "Especificações executáveis em Gherkin (Given/When/Then), critérios de aceitação e testes de comportamento.",
      rules:
        "Contrato vivo e não-ambíguo entre negócio, arquitetura e engenharia para validação de regras.",
    },
    {
      key: "L5_OBSERVABILITY",
      layer_number: 5,
      label: "Camada 5 — Observabilidade, QA & Telemetria",
      name: "Observabilidade, QA & Telemetria",
      icon: "monitoring",
      color: "#8b5cf6",
      importance: "Garantia & Produção",
      description:
        "Métricas em produção, testes automatizados, telemetria, SAST, auditoria e feedback loops contínuos.",
      rules:
        "Monitora a integridade em runtime e garante conformidade de segurança e qualidade contínua.",
    },
  ];

  const DEFAULT_LAYER_IMPORTANCE_LEVELS = [
    "Crítica / Raiz",
    "Estratégica",
    "Tática",
    "Operacional",
    "Executável",
    "Garantia & Produção",
  ];

  // Dynamic Suggestion catalogs populated from project.config.json via backend API
  let suggestedDomains = [...DEFAULT_ORG_DOMAINS];
  let suggestedLayers = [...DEFAULT_PROJECT_LAYERS];
  let suggestedImportanceLevels = [...DEFAULT_LAYER_IMPORTANCE_LEVELS];

  // Form Fields: Políticas & Guardião
  const checkRuleInvariants = document.getElementById(
    "proj-rule-invariants-tier1",
  );
  const checkRuleDictionary = document.getElementById(
    "proj-rule-dictionary-val",
  );
  const checkRuleLifecycle = document.getElementById(
    "proj-rule-enforce-lifecycle",
  );
  const inputAiGuardianPrompt = document.getElementById(
    "proj-ai-guardian-prompt",
  );

  // AI Copilot & Pre-Prompt Elements (Tab 1: About)
  const DEFAULT_ABOUT_AGENT_PROMPT = `Você é o Arquiteto de Fundação & Setup do Framework Context OS / Agentic SDLC.
Sua missão é ajudar o arquiteto e o líder técnico a preencher, refinar, estruturar e evoluir a constituição e identidade do projeto (Sobre o Projeto / Definições Estratégicas).

DIRETRIZES FUNDAMENTAIS:
1. Auxilie na redação precisa do Nome do Projeto, 'Por que fazemos?' (dores e justificativa de negócio), 'O que é o produto?' (escopo funcional e proposta de valor), 'Onde se aplica?' (canais e ecossistema), 'Quando?' (marcos e releases) e 'Como construímos?' (padrões arquiteturais e metodologia).
2. Seja proativo em sugerir melhorias de clareza, alinhamento aos princípios de Domain-Driven Design (DDD) e consistência técnica.
3. Forneça respostas estruturadas e textos prontos para serem aplicados nos campos correspondentes da tela.`;

  const btnToggleProjAi = document.getElementById("btn-toggle-proj-ai");
  const projAiPane = document.getElementById("proj-ai-pane");
  let projCopilot = null;

  // Local State
  let currentConfig = null;
  let isDirty = false;
  let cachedMembers = [];

  // Modal: Confirmação de Alterações Não Salvas
  const modalUnsaved = document.getElementById("proj-unsaved-modal");
  const modalUnsavedMsg = document.getElementById("proj-unsaved-modal-msg");
  const modalUnsavedHint = document.getElementById("proj-unsaved-modal-hint");
  const btnCloseUnsaved = document.getElementById("btn-close-proj-unsaved");
  const btnUnsavedCancel = document.getElementById("btn-proj-unsaved-cancel");
  const btnUnsavedDiscard = document.getElementById("btn-proj-unsaved-discard");
  const btnUnsavedSave = document.getElementById("btn-proj-unsaved-save");
  let pendingTargetTab = null;

  // Tab switching with unsaved changes verification
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      requestTabSwitch(targetTab);
    });
  });

  // Track changes to mark state as modified
  function markDirty() {
    isDirty = true;
    if (syncBadge) {
      syncBadge.className = "pill-dot warning";
      syncBadge.innerHTML = '<span class="dot"></span> Alterações não salvas';
    }
  }

  function markClean(isCustomized = true) {
    isDirty = false;
    if (syncBadge) {
      if (isCustomized) {
        syncBadge.className = "pill-dot success";
        syncBadge.innerHTML = '<span class="dot"></span> Configuração Oficial Ativa';
      } else {
        syncBadge.className = "pill-dot info";
        syncBadge.innerHTML = '<span class="dot"></span> Setup Inicial (Sugestões Padrão)';
      }
    }
  }

  // Bind input changes to dirty tracking
  [
    inputName,
    inputArchPattern,
    inputVersion,
    inputLead,
    inputRepoUrl,
    inputDesc,
    input5w2hWhat,
    input5w2hWhy,
    input5w2hWho,
    input5w2hWhere,
    input5w2hWhen,
    input5w2hHow,
    input5w2hHowMuch,
    checkRuleInvariants,
    checkRuleDictionary,
    checkRuleLifecycle,
    inputAiGuardianPrompt,
  ].forEach((el) => {
    if (el) {
      el.addEventListener("input", markDirty);
      el.addEventListener("change", markDirty);
    }
  });

  // Load project members from GitHub & local Git
  async function loadTeamMembers() {
    try {
      const { ok, data } = await API.getProjectMembers();
      if (ok && data && Array.isArray(data.members)) {
        cachedMembers = data.members;
      }
    } catch (e) {
      console.warn("Erro ao carregar membros do projeto:", e);
    }
  }

  // Load project configuration from backend
  async function loadProjectConfig() {
    try {
      await loadTeamMembers();
      const { ok, data } = await API.getProjectConfig();
      if (!ok || !data || !data.config) return;

      if (data.suggested_domains && Array.isArray(data.suggested_domains) && data.suggested_domains.length > 0) {
        suggestedDomains = data.suggested_domains;
      }
      if (data.suggested_layers && Array.isArray(data.suggested_layers) && data.suggested_layers.length > 0) {
        suggestedLayers = data.suggested_layers;
      }
      if (data.suggested_importance_levels && Array.isArray(data.suggested_importance_levels) && data.suggested_importance_levels.length > 0) {
        suggestedImportanceLevels = data.suggested_importance_levels;
      }

      currentConfig = data.config;
      renderFormFields(currentConfig);
      markClean(Boolean(data.is_customized));
    } catch (e) {
      console.error("Erro ao carregar configuração do projeto:", e);
    }
  }

  // Populate all inputs from config object
  function renderFormFields(cfg) {
    if (!cfg) return;

    // Identidade
    const p = cfg.project || {};
    if (inputName) inputName.value = p.name || "";
    if (inputArchPattern) inputArchPattern.value = p.architecture_pattern || "";
    if (inputVersion) inputVersion.value = p.version || "1.0.0";
    if (inputLead) inputLead.value = p.lead || "";
    if (inputRepoUrl) inputRepoUrl.value = p.repository_url || "";
    if (inputDesc) inputDesc.value = p.description || "";

    if (headerTitle) {
      headerTitle.textContent = p.name
        ? `${p.name} — Fundação & Setup`
        : "Cockpit de Fundação & Setup do Projeto";
    }

    // AI Assistant Pre-Prompt setup
    const activePrompt = (cfg.ai_assistant_prompt || "").trim();
    if (projCopilot) {
      projCopilot.setContext({
        customSystemPrompt: activePrompt,
        chips: [
          {
            label: "💡 Proposta de Valor",
            prompt:
              "Sugira uma Proposta de Valor e escopo funcional para o campo 'O que é o produto?' com base no nome e contexto do projeto.",
          },
          {
            label: "🎯 Por que fazemos?",
            prompt:
              "Ajude a articular o campo 'Por que fazemos?', destacando dores de negócio, ROI e motivação central.",
          },
          {
            label: "🏛️ Arquitetura (Como?)",
            prompt:
              "Quais diretrizes arquiteturais, padrões DDD e tecnologias você sugere para 'Como construímos?'?",
          },
          {
            label: "📋 Revisar Preenchimento",
            prompt:
              "Analise todos os campos preenchidos do About e forneça sugestões de melhoria e polimento executivo.",
          },
        ],
      });
    }

    // 5W2H
    const w = cfg.canvas_5w2h || {};
    if (input5w2hWhat) input5w2hWhat.value = w.what || "";
    if (input5w2hWhy) input5w2hWhy.value = w.why || "";
    if (input5w2hWho) input5w2hWho.value = w.who || "";
    if (input5w2hWhere) input5w2hWhere.value = w.where || "";
    if (input5w2hWhen) input5w2hWhen.value = w.when || "";
    if (input5w2hHow) input5w2hHow.value = w.how || "";
    if (input5w2hHowMuch) input5w2hHowMuch.value = w.how_much || "";

    // Organização & Domínios Corporativos
    if (!Array.isArray(cfg.organization_domains)) {
      cfg.organization_domains = [];
    }
    initDomainsViewMode();
    initSuggestionsPanel(cfg.organization_domains.length);
    renderDomains(cfg.organization_domains);

    // Camadas de Arquitetura & Governança (Camadas 0 a 5)
    if (!Array.isArray(cfg.layers)) {
      cfg.layers = [];
    }
    initLayersViewMode();
    initLayerSuggestionsPanel(cfg.layers.length);
    renderLayers();

    // Políticas & Guardião
    const gov = cfg.governance_rules || {};
    if (checkRuleInvariants)
      checkRuleInvariants.checked = !!gov.require_invariants_for_tier1;
    if (checkRuleDictionary)
      checkRuleDictionary.checked = !!gov.require_dictionary_validation;
    if (checkRuleLifecycle)
      checkRuleLifecycle.checked = !!gov.enforce_linear_lifecycle;
    if (inputAiGuardianPrompt)
      inputAiGuardianPrompt.value = cfg.ai_guardian_prompt || "";
  }

  // View Mode: Cards (Grid) vs Lista (Domains)
  function setDomainsViewMode(mode) {
    const isList = mode === "list";
    if (domainsGrid) domainsGrid.classList.toggle("view-list", isList);
    if (sugGrid) sugGrid.classList.toggle("view-list", isList);
    if (btnDomainsViewList) btnDomainsViewList.classList.toggle("active", isList);
    if (btnDomainsViewGrid) btnDomainsViewGrid.classList.toggle("active", !isList);
    try {
      localStorage.setItem(STORAGE_KEY_DOMAINS_VIEW_MODE, isList ? "list" : "grid");
    } catch (e) {}
  }

  function initDomainsViewMode() {
    if (btnDomainsViewGrid) {
      btnDomainsViewGrid.onclick = () => setDomainsViewMode("grid");
    }
    if (btnDomainsViewList) {
      btnDomainsViewList.onclick = () => setDomainsViewMode("list");
    }
    const savedMode = localStorage.getItem(STORAGE_KEY_DOMAINS_VIEW_MODE) || "grid";
    setDomainsViewMode(savedMode);
  }

  // Suggestions Panel Collapse / Expand Handling
  function setSuggestionsCollapsed(collapsed) {
    if (!sugPanel) return;
    sugPanel.classList.toggle("collapsed", collapsed);
    if (sugChevron) {
      sugChevron.textContent = collapsed ? "expand_more" : "expand_less";
    }
    if (sugLabel) {
      sugLabel.textContent = collapsed ? "Expandir" : "Recolher";
    }
    try {
      localStorage.setItem(
        STORAGE_KEY_SUG_COLLAPSED,
        collapsed ? "true" : "false",
      );
    } catch (e) {}
  }

  function initSuggestionsPanel() {
    if (!sugHeader) return;
    sugHeader.onclick = () => {
      const isCurrentlyCollapsed = sugPanel.classList.contains("collapsed");
      setSuggestionsCollapsed(!isCurrentlyCollapsed);
    };

    const savedState = localStorage.getItem(STORAGE_KEY_SUG_COLLAPSED);
    // Keep expanded by default unless explicitly closed by the user
    setSuggestionsCollapsed(savedState === "true");
  }

  // ===========================================================================
  // SUBDOMAIN SLUG VALIDATION & CONFLICT PREVENTION HELPERS
  // ===========================================================================

  function sanitizeSlug(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]+/g, "-")      // replace non-alphanumeric with hyphen
      .replace(/^-+|-+$/g, "")          // trim leading/trailing hyphens
      .replace(/-+/g, "-");             // collapse consecutive hyphens
  }

  function isSubdomainSlugConflict(domain, slug, excludeIndex = -1) {
    const cleanSlug = sanitizeSlug(slug);
    if (!cleanSlug) return false;
    const subdomains = Array.isArray(domain.subdomains) ? domain.subdomains : [];
    return subdomains.some(
      (s, idx) =>
        idx !== excludeIndex &&
        (sanitizeSlug(s.id) === cleanSlug || sanitizeSlug(s.name) === cleanSlug),
    );
  }

  function generateUniqueSubdomainSlug(domain, baseText, excludeIndex = -1) {
    let clean = sanitizeSlug(baseText) || "subdominio";
    const subdomains = Array.isArray(domain.subdomains) ? domain.subdomains : [];
    const existingSlugs = subdomains
      .map((s, idx) =>
        idx === excludeIndex ? null : sanitizeSlug(s.id || s.name),
      )
      .filter(Boolean);

    if (!existingSlugs.includes(clean)) return clean;

    let counter = 2;
    while (existingSlugs.includes(`${clean}-${counter}`)) {
      counter++;
    }
    return `${clean}-${counter}`;
  }

  // Render Organization Domains Cards Grid (Selected Domains on Top, Suggestions Below)
  function renderDomains() {
    if (!currentConfig) currentConfig = {};
    if (!Array.isArray(currentConfig.organization_domains)) {
      currentConfig.organization_domains = [];
    }
    const currentDomains = currentConfig.organization_domains;

    // 1. Update Project Domains Count Badge
    if (domainsCountBadge) {
      domainsCountBadge.textContent =
        currentDomains.length === 0
          ? "Nenhum domínio"
          : `${currentDomains.length} domínio${currentDomains.length > 1 ? "s" : ""}`;
    }

    // 2. Render Top Area (Selected Domains Grid)
    if (domainsGrid) {
      domainsGrid.innerHTML = "";

      if (currentDomains.length === 0) {
        const emptyBox = document.createElement("div");
        emptyBox.className = "org-domains-empty-box";
        emptyBox.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 38px; color: var(--text-muted); opacity: 0.65; margin-bottom: 8px;">domain_disabled</span>
          <strong style="font-size: 15px; color: var(--text-main); margin-bottom: 4px;">Nenhum domínio selecionado</strong>
          <p style="font-size: 12.5px; color: var(--text-muted); margin: 0 0 16px 0; max-width: 460px; line-height: 1.45;">
            Selecione uma ou mais das sugestões padrão do software abaixo para incluir no projeto, ou crie uma área customizada.
          </p>
          <button class="btn btn-secondary btn-sm btn-empty-add-domain" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined icon-xs">add</span> Criar Domínio Customizado
          </button>
        `;
        emptyBox
          .querySelector(".btn-empty-add-domain")
          .addEventListener("click", () => {
            addNewDomain();
          });
        domainsGrid.appendChild(emptyBox);
      } else {
        currentDomains.forEach((d, index) => {
          const card = document.createElement("div");
          card.className = "org-domain-card included";
          card.dataset.index = index;

          const domainColor =
            d.color || DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
          const domainIcon = d.icon || "domain";
          const responsibles = Array.isArray(d.responsibles) ? d.responsibles : [];

          // Render subdomains items
          const subdomains = Array.isArray(d.subdomains) ? d.subdomains : [];
          if (!Array.isArray(d.subdomains)) d.subdomains = subdomains;

          let subdomainsListHtml = "";
          if (subdomains.length === 0) {
            subdomainsListHtml =
              '<span style="font-size: 11px; color: var(--text-muted); font-style: italic; padding: 4px 0;">Nenhum subdomínio configurado</span>';
          } else {
            subdomains.forEach((sub, sIdx) => {
              const subId = sanitizeSlug(sub.id || sub.name || `sub-${sIdx + 1}`);
              const subName = sub.name || subId;
              const subDesc = sub.description || "";
              subdomainsListHtml += `
                <div class="org-subdomain-item" data-sidx="${sIdx}">
                  <div class="org-subdomain-item-header">
                    <div class="org-subdomain-item-left">
                      <span class="material-symbols-outlined" style="font-size: 14px; color: ${domainColor}; flex-shrink: 0;">category</span>
                      <span class="org-subdomain-item-name" title="${escapeHtml(subName)}">${escapeHtml(subName)}</span>
                      <span class="org-subdomain-item-slug">#${escapeHtml(subId)}</span>
                    </div>
                    <div class="org-subdomain-item-actions">
                      <button class="org-subdomain-item-btn org-subdomain-btn-edit" data-sidx="${sIdx}" type="button" title="Editar nome, slug e descrição">
                        <span class="material-symbols-outlined" style="font-size: 14px;">edit</span>
                      </button>
                      <button class="org-subdomain-item-btn btn-remove org-subdomain-btn-remove" data-sidx="${sIdx}" type="button" title="Remover subdomínio">
                        <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
                      </button>
                    </div>
                  </div>
                  ${subDesc ? `<div class="org-subdomain-item-desc-preview" title="${escapeHtml(subDesc)}">${escapeHtml(subDesc)}</div>` : ""}
                  
                  <!-- Expandable Edit Body -->
                  <div class="org-subdomain-item-edit-body" style="display: none;">
                    <div class="org-subdomain-edit-field">
                      <label class="org-subdomain-edit-label">Nome do Subdomínio</label>
                      <input type="text" class="org-subdomain-edit-name" value="${escapeHtml(subName)}" placeholder="Nome do subdomínio..." />
                    </div>
                    <div class="org-subdomain-edit-field">
                      <label class="org-subdomain-edit-label">Identificador (#slug)</label>
                      <input type="text" class="org-subdomain-edit-slug" value="${escapeHtml(subId)}" placeholder="slug-unico" />
                      <div class="org-subdomain-slug-feedback valid">✓ Slug único e válido</div>
                    </div>
                    <div class="org-subdomain-edit-field">
                      <label class="org-subdomain-edit-label">Descrição & Escopo</label>
                      <textarea class="org-subdomain-edit-desc" rows="2" placeholder="O que este subdomínio organiza?">${escapeHtml(subDesc)}</textarea>
                    </div>
                    <div class="org-subdomain-edit-actions">
                      <button class="org-subdomain-edit-cancel-btn" type="button">Cancelar</button>
                      <button class="org-subdomain-edit-save-btn" type="button">
                        <span class="material-symbols-outlined" style="font-size: 12px;">check</span>
                        Concluir
                      </button>
                    </div>
                  </div>
                </div>
              `;
            });
          }

          // Calculate available suggested subdomains for this domain
          const domainTemplate = suggestedDomains.find(
            (t) =>
              t.id === d.id ||
              (t.name && t.name.toLowerCase() === (d.name || "").toLowerCase()),
          );
          const rawSuggestions = domainTemplate?.suggested_subdomains || d.suggested_subdomains || [];
          const availableSubSuggestions = rawSuggestions.filter(
            (sugSub) =>
              !subdomains.some(
                (existing) =>
                  sanitizeSlug(existing.id) === sanitizeSlug(sugSub.id) ||
                  (existing.name && existing.name.toLowerCase() === sugSub.name.toLowerCase()),
              ),
          );

          let suggestedSubdomainsHtml = "";
          if (availableSubSuggestions.length > 0) {
            suggestedSubdomainsHtml = availableSubSuggestions
              .map(
                (sugSub) => `
                <button class="org-subdomain-sug-chip" data-sug-id="${escapeHtml(sugSub.id)}" type="button" title="${escapeHtml(sugSub.description || '')}">
                  <span class="material-symbols-outlined" style="font-size: 11px;">add</span>
                  ${escapeHtml(sugSub.name)}
                </button>
              `,
              )
              .join("");
          }

          // Render responsibles chips
          let membersChipsHtml = "";
          if (responsibles.length === 0) {
            membersChipsHtml =
              '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Nenhum responsável atribuído</span>';
          } else {
            responsibles.forEach((handle, rIdx) => {
              const cleanHandle = String(handle).trim();
              const matchedMember = cachedMembers.find(
                (m) =>
                  (m.handle &&
                    m.handle.toLowerCase() === cleanHandle.toLowerCase()) ||
                  (m.login &&
                    m.login.toLowerCase() ===
                      cleanHandle.replace(/^@/, "").toLowerCase()),
              );
              const avatarUrl = matchedMember
                ? matchedMember.avatar_url
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanHandle.replace(/^@/, ""))}&background=6366f1&color=fff`;
              const displayName = matchedMember
                ? matchedMember.name || matchedMember.handle
                : cleanHandle;

              membersChipsHtml += `
                <span class="org-domain-member-chip" title="${escapeHtml(displayName)}">
                  <img src="${escapeHtml(avatarUrl)}" class="org-domain-member-avatar" alt="${escapeHtml(cleanHandle)}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'" />
                  <span>${escapeHtml(cleanHandle)}</span>
                  <button class="org-domain-member-remove" data-ridx="${rIdx}" type="button" title="Remover responsável">&times;</button>
                </span>
              `;
            });
          }

          // Populate assignable member options from cached GitHub/Git members
          let memberOptionsHtml =
            '<option value="">+ Atribuir Responsável...</option>';
          cachedMembers.forEach((m) => {
            const isAlreadyAdded = responsibles.some(
              (r) =>
                r.toLowerCase() === m.handle.toLowerCase() ||
                r.toLowerCase() === `@${m.login.toLowerCase()}`,
            );
            if (!isAlreadyAdded) {
              const label = m.name ? `${m.name} (${m.handle})` : m.handle;
              memberOptionsHtml += `<option value="${escapeHtml(m.handle)}">${escapeHtml(label)}</option>`;
            }
          });
          memberOptionsHtml +=
            '<option value="__custom__">+ Digitar outro @handle...</option>';

          card.innerHTML = `
            <div class="org-domain-card-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="org-domain-icon-badge" style="background: ${domainColor}18; color: ${domainColor};">
                  <span class="material-symbols-outlined">${domainIcon}</span>
                </div>
                <span class="org-domain-included-pill">
                  <span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span>
                  Incluso no Projeto
                </span>
              </div>
              <button class="org-domain-delete-btn" title="Remover este domínio do projeto" type="button">
                <span class="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <input
                type="text"
                class="org-domain-name-input"
                value="${escapeHtml(d.name || "")}"
                placeholder="Nome da Área / Domínio..."
              />
            </div>
            <textarea
              class="org-domain-desc-input"
              rows="2"
              placeholder="O que este domínio cuida e quais são suas responsabilidades?"
            >${escapeHtml(d.description || "")}</textarea>

            <!-- Subdomains / Capabilities Section -->
            <div class="org-domain-subdomains-section">
              <div class="org-domain-subdomains-header">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: var(--md-sys-color-primary, #1a73e8);">category</span>
                  <span>Subdomínios & Capacidades</span>
                </div>
                <span class="pill-dot info" style="font-size: 10.5px; padding: 1px 6px;">
                  ${subdomains.length} ${subdomains.length === 1 ? 'subdomínio' : 'subdomínios'}
                </span>
              </div>
              <div class="org-subdomains-list">
                ${subdomainsListHtml}
              </div>
              ${suggestedSubdomainsHtml ? `
                <div class="org-subdomain-sug-wrap">
                  <span class="org-subdomain-sug-label">Sugestões rápidas:</span>
                  ${suggestedSubdomainsHtml}
                </div>
              ` : ''}
              <div class="org-subdomain-quick-add-wrap">
                <input
                  type="text"
                  class="org-subdomain-quick-input"
                  placeholder="+ Digitar novo subdomínio (ex: Faturamento)..."
                />
                <button class="org-subdomain-quick-btn" type="button">
                  <span class="material-symbols-outlined" style="font-size: 13px;">add</span>
                  Adicionar
                </button>
              </div>
            </div>

            <!-- Responsibles / Team Section -->
            <div class="org-domain-responsibles-section">
              <div class="org-domain-responsibles-header">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: var(--text-muted);">group</span>
                  <span>Responsáveis & Liderança</span>
                </div>
                <select class="org-domain-assign-dropdown">
                  ${memberOptionsHtml}
                </select>
              </div>
              <div class="org-domain-members-chips">
                ${membersChipsHtml}
              </div>
            </div>

            <div class="org-domain-card-footer">
              <span class="org-domain-slug-pill">#${escapeHtml(d.id || sanitizeSlug(d.name))}</span>
              <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">domains/${escapeHtml(d.id || sanitizeSlug(d.name))}/</span>
            </div>
          `;

          const nameInput = card.querySelector(".org-domain-name-input");
          const descInput = card.querySelector(".org-domain-desc-input");
          const deleteBtn = card.querySelector(".org-domain-delete-btn");
          const slugPill = card.querySelector(".org-domain-slug-pill");
          const assignDropdown = card.querySelector(".org-domain-assign-dropdown");

          nameInput.addEventListener("input", () => {
            d.name = nameInput.value;
            const autoId = sanitizeSlug(d.name);
            if (autoId) {
              d.id = autoId;
              slugPill.textContent = `#${autoId}`;
            }
            markDirty();
          });

          descInput.addEventListener("input", () => {
            d.description = descInput.value;
            markDirty();
          });

          // Subdomain Edit Expand / Collapse
          card.querySelectorAll(".org-subdomain-btn-edit").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const item = btn.closest(".org-subdomain-item");
              if (!item) return;
              const editBody = item.querySelector(".org-subdomain-item-edit-body");
              const isEditing = item.classList.contains("is-editing");
              if (isEditing) {
                item.classList.remove("is-editing");
                if (editBody) editBody.style.display = "none";
              } else {
                item.classList.add("is-editing");
                if (editBody) editBody.style.display = "flex";
                const nameInp = item.querySelector(".org-subdomain-edit-name");
                if (nameInp) nameInp.focus();
              }
            });
          });

          // Subdomain Edit Inputs (Live Validation & Auto-slug)
          card.querySelectorAll(".org-subdomain-item").forEach((item) => {
            const sIdx = parseInt(item.dataset.sidx, 10);
            const sub = d.subdomains[sIdx];
            if (!sub) return;

            const nameInp = item.querySelector(".org-subdomain-edit-name");
            const slugInp = item.querySelector(".org-subdomain-edit-slug");
            const descInp = item.querySelector(".org-subdomain-edit-desc");
            const feedback = item.querySelector(".org-subdomain-slug-feedback");
            const saveBtn = item.querySelector(".org-subdomain-edit-save-btn");
            const cancelBtn = item.querySelector(".org-subdomain-edit-cancel-btn");
            const editBody = item.querySelector(".org-subdomain-item-edit-body");

            let slugManuallyEdited = false;

            const validateSlug = () => {
              if (!slugInp || !feedback) return true;
              const clean = sanitizeSlug(slugInp.value);
              if (!clean) {
                feedback.className = "org-subdomain-slug-feedback conflict";
                feedback.textContent = "⚠️ O identificador (#slug) não pode ser vazio";
                return false;
              }
              const conflict = isSubdomainSlugConflict(d, clean, sIdx);
              if (conflict) {
                feedback.className = "org-subdomain-slug-feedback conflict";
                feedback.textContent = "⚠️ Este identificador já existe neste domínio";
                return false;
              } else {
                feedback.className = "org-subdomain-slug-feedback valid";
                feedback.textContent = "✓ Slug único e válido";
                return true;
              }
            };

            if (nameInp) {
              nameInp.addEventListener("input", () => {
                if (!slugManuallyEdited && slugInp) {
                  slugInp.value = generateUniqueSubdomainSlug(d, nameInp.value, sIdx);
                  validateSlug();
                }
              });
            }

            if (slugInp) {
              slugInp.addEventListener("input", () => {
                slugManuallyEdited = true;
                slugInp.value = sanitizeSlug(slugInp.value);
                validateSlug();
              });
            }

            const applySubdomainEdit = () => {
              if (!nameInp || !slugInp) return;
              const newName = nameInp.value.trim() || sub.name;
              let newSlug = sanitizeSlug(slugInp.value) || sanitizeSlug(newName);
              if (isSubdomainSlugConflict(d, newSlug, sIdx)) {
                newSlug = generateUniqueSubdomainSlug(d, newSlug, sIdx);
              }
              sub.name = newName;
              sub.id = newSlug;
              if (descInp) sub.description = descInp.value.trim();
              renderDomains();
              markDirty();
            };

            if (saveBtn) {
              saveBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                applySubdomainEdit();
              });
            }

            if (cancelBtn) {
              cancelBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                item.classList.remove("is-editing");
                if (editBody) editBody.style.display = "none";
              });
            }

            [nameInp, slugInp].forEach((inputEl) => {
              if (inputEl) {
                inputEl.addEventListener("keydown", (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    applySubdomainEdit();
                  }
                });
              }
            });
          });

          // Subdomain Remove
          card.querySelectorAll(".org-subdomain-btn-remove").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const sIdx = parseInt(btn.dataset.sidx, 10);
              if (!Array.isArray(d.subdomains)) d.subdomains = [];
              d.subdomains.splice(sIdx, 1);
              renderDomains();
              markDirty();
            });
          });

          // Quick Suggestion Subdomain Add
          card.querySelectorAll(".org-subdomain-sug-chip").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const sugId = btn.dataset.sugId;
              const foundSug = rawSuggestions.find((s) => s.id === sugId);
              if (foundSug) {
                if (!Array.isArray(d.subdomains)) d.subdomains = [];
                const uniqueSlug = generateUniqueSubdomainSlug(d, foundSug.id);
                d.subdomains.push({
                  id: uniqueSlug,
                  name: foundSug.name,
                  description: foundSug.description || "",
                  responsibles: [],
                });
                renderDomains();
                markDirty();
              }
            });
          });

          // Quick Custom Subdomain Add
          const subInput = card.querySelector(".org-subdomain-quick-input");
          const subBtn = card.querySelector(".org-subdomain-quick-btn");
          const handleAddCustomSubdomain = () => {
            if (!subInput) return;
            const val = subInput.value.trim();
            if (!val) return;
            const uniqueSlug = generateUniqueSubdomainSlug(d, val);
            if (!Array.isArray(d.subdomains)) d.subdomains = [];
            d.subdomains.push({
              id: uniqueSlug,
              name: val,
              description: `Subdomínio e capacidade funcional de ${val}.`,
              responsibles: [],
            });
            subInput.value = "";
            renderDomains();
            markDirty();
          };

          if (subBtn) {
            subBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              handleAddCustomSubdomain();
            });
          }
          if (subInput) {
            subInput.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleAddCustomSubdomain();
              }
            });
          }

          card.querySelectorAll(".org-domain-member-remove").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const rIdx = parseInt(btn.dataset.ridx, 10);
              if (!Array.isArray(d.responsibles)) d.responsibles = [];
              d.responsibles.splice(rIdx, 1);
              renderDomains();
              markDirty();
            });
          });

          if (assignDropdown) {
            assignDropdown.addEventListener("change", () => {
              const val = assignDropdown.value;
              if (!val) return;
              if (!Array.isArray(d.responsibles)) d.responsibles = [];
              if (val === "__custom__") {
                const customHandle = prompt(
                  "Digite o @handle do responsável (ex: @usuario):",
                );
                if (customHandle && customHandle.trim()) {
                  const formatted = customHandle.trim().startsWith("@")
                    ? customHandle.trim()
                    : `@${customHandle.trim()}`;
                  if (!d.responsibles.includes(formatted)) {
                    d.responsibles.push(formatted);
                    renderDomains();
                    markDirty();
                  }
                }
              } else {
                if (!d.responsibles.includes(val)) {
                  d.responsibles.push(val);
                  renderDomains();
                  markDirty();
                }
              }
            });
          }

          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            currentDomains.splice(index, 1);
            renderDomains();
            markDirty();
          });

          domainsGrid.appendChild(card);
        });

        // Add Domain dashed card at the end of the grid
        const addCard = document.createElement("div");
        addCard.className = "org-domain-card org-domain-card-add";
        addCard.title = "Clique para adicionar um novo domínio customizado";
        addCard.innerHTML = `
          <div class="org-domain-add-icon">
            <span class="material-symbols-outlined">add</span>
          </div>
          <span class="org-domain-add-label">Adicionar Domínio Customizado</span>
          <span class="org-domain-add-hint">Ex: Vendas, Jurídico, RH, Billing...</span>
        `;
        addCard.addEventListener("click", () => {
          addNewDomain();
        });
        domainsGrid.appendChild(addCard);
      }
    }

    // 3. Render Bottom Suggestions Area (Sugestões do Software)
    renderSuggestions(currentDomains);
  }

  // Render Bottom Suggestions Cards
  function renderSuggestions(currentDomains = []) {
    if (!sugGrid) return;
    sugGrid.innerHTML = "";

    const availableSuggestions = suggestedDomains.filter(
      (sug) =>
        !currentDomains.some(
          (d) =>
            d.id === sug.id ||
            (d.name && d.name.toLowerCase() === sug.name.toLowerCase()),
        ),
    );

    if (sugCountBadge) {
      if (availableSuggestions.length === 0) {
        sugCountBadge.textContent = "✓ Todas adicionadas";
        sugCountBadge.className = "badge-sug-count all-added";
      } else {
        sugCountBadge.textContent = `${availableSuggestions.length} disponível${availableSuggestions.length > 1 ? "is" : ""}`;
        sugCountBadge.className = "badge-sug-count";
      }
    }

    if (availableSuggestions.length === 0) {
      const allAddedMsg = document.createElement("div");
      allAddedMsg.style.gridColumn = "1 / -1";
      allAddedMsg.style.padding = "20px";
      allAddedMsg.style.textAlign = "center";
      allAddedMsg.style.color = "var(--text-muted)";
      allAddedMsg.style.fontSize = "13px";
      allAddedMsg.innerHTML =
        '<span class="material-symbols-outlined" style="vertical-align: middle; color: #10b981; margin-right: 6px;">check_circle</span> Todos os domínios sugeridos pelo framework já foram adicionados ao seu projeto.';
      sugGrid.appendChild(allAddedMsg);
      return;
    }

    availableSuggestions.forEach((sug, index) => {
      const card = document.createElement("div");
      card.className = "org-domain-card suggestion-card";
      card.dataset.sugId = sug.id;

      const domainColor =
        sug.color || DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
      const domainIcon = sug.icon || "domain";
      const sugSubdomains = Array.isArray(sug.suggested_subdomains) ? sug.suggested_subdomains : [];

      card.innerHTML = `
        <div class="sug-card-main-col">
          <div class="org-domain-card-header" style="margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="org-domain-icon-badge" style="background: ${domainColor}18; color: ${domainColor};">
                <span class="material-symbols-outlined">${domainIcon}</span>
              </div>
              <div>
                <strong style="font-size: 14px; color: var(--text-main);">${escapeHtml(sug.name)}</strong>
                <span class="org-domain-slug-pill" style="margin-left: 6px;">#${escapeHtml(sug.id)}</span>
              </div>
            </div>
          </div>
          <p class="sug-card-desc" style="font-size: 12.5px; color: var(--text-muted); line-height: 1.45; margin: 4px 0 6px 0;">
            ${escapeHtml(sug.description)}
          </p>
          <!-- Preview of subdomains included -->
          <div class="sug-subdomains-preview" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 4px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Subdomínios inclusos:</span>
            ${sugSubdomains.map(s => `
              <span style="font-size: 11px; background: rgba(0,0,0,0.04); color: var(--text-main); padding: 1px 7px; border-radius: 4px; border: 1px solid var(--border-color);">
                ${escapeHtml(s.name)}
              </span>
            `).join('')}
          </div>
        </div>
        <div class="sug-card-action-col" style="margin-top: 10px; display: flex; align-items: center; justify-content: flex-end;">
          <button class="btn btn-sm btn-primary org-domain-add-sug-btn" type="button" style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span class="material-symbols-outlined icon-xs">add</span>
            Adicionar ao Projeto
          </button>
        </div>
      `;

      const btnAdd = card.querySelector(".org-domain-add-sug-btn");
      btnAdd.addEventListener("click", () => {
        if (!currentConfig) currentConfig = {};
        if (!Array.isArray(currentConfig.organization_domains)) {
          currentConfig.organization_domains = [];
        }
        const domainToAdd = JSON.parse(JSON.stringify(sug));
        if (Array.isArray(sug.suggested_subdomains)) {
          domainToAdd.subdomains = JSON.parse(JSON.stringify(sug.suggested_subdomains));
        } else {
          domainToAdd.subdomains = [];
        }
        currentConfig.organization_domains.push(domainToAdd);
        renderDomains();
        markDirty();
      });

      sugGrid.appendChild(card);
    });
  }

  function addNewDomain() {
    if (!currentConfig) currentConfig = {};
    if (!Array.isArray(currentConfig.organization_domains)) {
      currentConfig.organization_domains = [];
    }
    const idx = currentConfig.organization_domains.length + 1;
    const color = DOMAIN_COLOR_PALETTE[(idx - 1) % DOMAIN_COLOR_PALETTE.length];
    currentConfig.organization_domains.push({
      id: `area-${idx}`,
      name: `Novo Domínio ${idx}`,
      icon: "domain",
      color: color,
      description:
        "Descrição das responsabilidades e escopo de atuação deste domínio.",
      responsibles: [],
      subdomains: [],
    });
    renderDomains();
    markDirty();

    // Auto-focus the new card's name input
    setTimeout(() => {
      if (!domainsGrid) return;
      const inputs = domainsGrid.querySelectorAll(".org-domain-name-input");
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.focus();
        lastInput.select();
      }
    }, 50);
  }

  // Header Add Domain Button
  if (btnAddDomain) {
    btnAddDomain.addEventListener("click", () => {
      addNewDomain();
    });
  }

  // Layer Suggestions Panel Collapse / Expand Handling
  function setLayerSuggestionsCollapsed(collapsed) {
    if (!layerSugPanel) return;
    layerSugPanel.classList.toggle("collapsed", collapsed);
    if (layerSugChevron) {
      layerSugChevron.textContent = collapsed ? "expand_more" : "expand_less";
    }
    if (layerSugLabel) {
      layerSugLabel.textContent = collapsed ? "Expandir" : "Recolher";
    }
    try {
      localStorage.setItem(
        STORAGE_KEY_LAYER_SUG_COLLAPSED,
        collapsed ? "true" : "false",
      );
    } catch (e) {}
  }

  // View Mode: Cards (Grid) vs Lista (Architecture Layers)
  function setLayersViewMode(mode) {
    const isList = mode === "list";
    if (layersGrid) layersGrid.classList.toggle("view-list", isList);
    if (layerSugGrid) layerSugGrid.classList.toggle("view-list", isList);
    if (btnLayersViewList) btnLayersViewList.classList.toggle("active", isList);
    if (btnLayersViewGrid) btnLayersViewGrid.classList.toggle("active", !isList);
    try {
      localStorage.setItem(STORAGE_KEY_LAYERS_VIEW_MODE, isList ? "list" : "grid");
    } catch (e) {}
  }

  function initLayersViewMode() {
    if (btnLayersViewGrid) {
      btnLayersViewGrid.onclick = () => setLayersViewMode("grid");
    }
    if (btnLayersViewList) {
      btnLayersViewList.onclick = () => setLayersViewMode("list");
    }
    const savedMode = localStorage.getItem(STORAGE_KEY_LAYERS_VIEW_MODE) || "grid";
    setLayersViewMode(savedMode);
  }

  function initLayerSuggestionsPanel() {
    if (!layerSugHeader) return;
    layerSugHeader.onclick = () => {
      const isCurrentlyCollapsed =
        layerSugPanel.classList.contains("collapsed");
      setLayerSuggestionsCollapsed(!isCurrentlyCollapsed);
    };

    const savedState = localStorage.getItem(STORAGE_KEY_LAYER_SUG_COLLAPSED);
    // Keep expanded by default unless explicitly closed by user
    setLayerSuggestionsCollapsed(savedState === "true");
  }

  // Render Architecture Layers Cards Grid (Selected Layers on Top, Suggestions Below)
  function renderLayers() {
    if (!currentConfig) currentConfig = {};
    if (!Array.isArray(currentConfig.layers)) {
      currentConfig.layers = [];
    }
    const currentLayers = currentConfig.layers;

    // 1. Update Architecture Layers Count Badge
    if (layersCountBadge) {
      layersCountBadge.textContent =
        currentLayers.length === 0
          ? "Nenhuma camada"
          : `${currentLayers.length} camada${currentLayers.length > 1 ? "s" : ""}`;
    }

    // 2. Render Top Area (Selected Layers Grid)
    if (layersGrid) {
      layersGrid.innerHTML = "";

      if (currentLayers.length === 0) {
        const emptyBox = document.createElement("div");
        emptyBox.className = "org-domains-empty-box";
        emptyBox.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 38px; color: var(--text-muted); opacity: 0.65; margin-bottom: 8px;">layers_clear</span>
          <strong style="font-size: 15px; color: var(--text-main); margin-bottom: 4px;">Nenhuma camada selecionada</strong>
          <p style="font-size: 12.5px; color: var(--text-muted); margin: 0 0 16px 0; max-width: 460px; line-height: 1.45;">
            Selecione uma ou mais camadas padrão do framework abaixo para incluir na governança do projeto, ou crie uma camada customizada.
          </p>
          <button class="btn btn-secondary btn-sm btn-empty-add-layer" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined icon-xs">add</span> Criar Camada Customizada
          </button>
        `;
        emptyBox
          .querySelector(".btn-empty-add-layer")
          .addEventListener("click", () => {
            addNewLayer();
          });
        layersGrid.appendChild(emptyBox);
      } else {
        currentLayers.forEach((layer, index) => {
          const card = document.createElement("div");
          card.className = "arch-layer-card included";
          card.dataset.index = index;

          const layerColor =
            layer.color || DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
          const layerIcon = layer.icon || "layers";
          const layerNum =
            layer.layer_number !== undefined
              ? layer.layer_number
              : (layer.weight !== undefined ? layer.weight - 1 : index);
          const layerKey = layer.key || `L${layerNum}_LAYER`;
          const layerImportance = layer.importance || "Operacional";

          const allImportanceOptions = [...suggestedImportanceLevels];
          if (layerImportance && !allImportanceOptions.includes(layerImportance)) {
            allImportanceOptions.push(layerImportance);
          }

          let importanceOptionsHtml = "";
          allImportanceOptions.forEach((lvl) => {
            const selected = lvl === layerImportance ? "selected" : "";
            importanceOptionsHtml += `<option value="${escapeHtml(lvl)}" ${selected}>${escapeHtml(lvl)}</option>`;
          });

          card.innerHTML = `
            <div class="arch-layer-card-header">
              <div class="arch-layer-badge-wrap">
                <div class="arch-layer-icon-badge" style="background: ${layerColor}18; color: ${layerColor};">
                  <span class="material-symbols-outlined">${layerIcon}</span>
                </div>
                <span class="arch-layer-number-pill" style="background: ${layerColor}22; color: ${layerColor};">
                  Camada ${layerNum}
                </span>
                <span class="org-domain-included-pill" style="margin-left: 4px;">
                  <span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span>
                  Inclusa no Projeto
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <select class="arch-layer-importance-select" title="Nível de importância e criticidade desta camada">
                  ${importanceOptionsHtml}
                </select>
                <button class="arch-layer-delete-btn" title="Remover esta camada do projeto" type="button">
                  <span class="material-symbols-outlined icon-xs">close</span>
                </button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <input
                type="text"
                class="arch-layer-name-input"
                value="${escapeHtml(layer.name || layer.label || `Camada ${layerNum}`)}"
                placeholder="Nome da Camada de Arquitetura..."
              />
            </div>

            <div class="arch-layer-field-group">
              <label class="arch-layer-field-label">
                <span class="material-symbols-outlined" style="font-size: 13px;">info</span>
                O que esta camada inclui
              </label>
              <textarea
                class="arch-layer-desc-input"
                rows="2"
                placeholder="Descreva o escopo e os artefatos que pertencem a esta camada..."
              >${escapeHtml(layer.description || "")}</textarea>
            </div>

            <div class="arch-layer-field-group">
              <label class="arch-layer-field-label">
                <span class="material-symbols-outlined" style="font-size: 13px;">gavel</span>
                Regras de Governança, Navegação & Importância
              </label>
              <textarea
                class="arch-layer-rules-input"
                rows="2"
                placeholder="Regras de validação, hierarquia de decisões e navegação entre domínios..."
              >${escapeHtml(layer.rules || "")}</textarea>
            </div>

            <div class="arch-layer-card-footer">
              <span class="arch-layer-slug-pill">#${escapeHtml(layerKey)}</span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
                Hierarquia: Nível ${layerNum}
              </span>
            </div>
          `;

          const nameInput = card.querySelector(".arch-layer-name-input");
          const descInput = card.querySelector(".arch-layer-desc-input");
          const rulesInput = card.querySelector(".arch-layer-rules-input");
          const importanceSelect = card.querySelector(".arch-layer-importance-select");
          const deleteBtn = card.querySelector(".arch-layer-delete-btn");

          nameInput.addEventListener("input", () => {
            layer.name = nameInput.value;
            layer.label = `Camada ${layerNum} — ${nameInput.value}`;
            markDirty();
          });

          descInput.addEventListener("input", () => {
            layer.description = descInput.value;
            markDirty();
          });

          rulesInput.addEventListener("input", () => {
            layer.rules = rulesInput.value;
            markDirty();
          });

          importanceSelect.addEventListener("change", () => {
            layer.importance = importanceSelect.value;
            markDirty();
          });

          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            currentLayers.splice(index, 1);
            renderLayers();
            markDirty();
          });

          layersGrid.appendChild(card);
        });

        // Add Layer dashed card at the end of the grid
        const addCard = document.createElement("div");
        addCard.className = "arch-layer-card arch-layer-card-add";
        addCard.title = "Clique para adicionar uma nova camada customizada";
        addCard.innerHTML = `
          <div class="arch-layer-add-icon">
            <span class="material-symbols-outlined">add</span>
          </div>
          <span class="arch-layer-add-label">Adicionar Camada Customizada</span>
          <span class="arch-layer-add-hint">Ex: Camada 6 — Auditoria Regulatória, FinOps...</span>
        `;
        addCard.addEventListener("click", () => {
          addNewLayer();
        });
        layersGrid.appendChild(addCard);
      }
    }

    // 3. Render Bottom Suggestions Area (Sugestões de Camadas do Framework)
    renderLayerSuggestions(currentLayers);
  }

  // Render Bottom Architecture Layer Suggestions Cards
  function renderLayerSuggestions(currentLayers = []) {
    if (!layerSugGrid) return;
    layerSugGrid.innerHTML = "";

    const availableSuggestions = suggestedLayers.filter(
      (sug) =>
        !currentLayers.some(
          (l) =>
            l.key === sug.key ||
            (l.name && l.name.toLowerCase() === sug.name.toLowerCase()) ||
            l.layer_number === sug.layer_number,
        ),
    );

    if (layerSugCountBadge) {
      if (availableSuggestions.length === 0) {
        layerSugCountBadge.textContent = "✓ Todas adicionadas";
        layerSugCountBadge.className = "badge-sug-count all-added";
      } else {
        layerSugCountBadge.textContent = `${availableSuggestions.length} disponível${availableSuggestions.length > 1 ? "is" : ""}`;
        layerSugCountBadge.className = "badge-sug-count";
      }
    }

    if (availableSuggestions.length === 0) {
      const allAddedMsg = document.createElement("div");
      allAddedMsg.style.gridColumn = "1 / -1";
      allAddedMsg.style.padding = "20px";
      allAddedMsg.style.textAlign = "center";
      allAddedMsg.style.color = "var(--text-muted)";
      allAddedMsg.style.fontSize = "13px";
      allAddedMsg.innerHTML =
        '<span class="material-symbols-outlined" style="vertical-align: middle; color: #10b981; margin-right: 6px;">check_circle</span> Todas as camadas recomendadas pelo framework já foram adicionadas ao seu projeto.';
      layerSugGrid.appendChild(allAddedMsg);
      return;
    }

    availableSuggestions.forEach((sug, index) => {
      const card = document.createElement("div");
      card.className = "arch-layer-card suggestion-card";
      card.dataset.layerKey = sug.key;

      const layerColor =
        sug.color || DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
      const layerIcon = sug.icon || "layers";

      card.innerHTML = `
        <div class="sug-card-main-col">
          <div class="arch-layer-card-header" style="margin-bottom: 4px;">
            <div class="arch-layer-badge-wrap" style="display: flex; align-items: center; gap: 8px;">
              <div class="arch-layer-icon-badge" style="background: ${layerColor}18; color: ${layerColor};">
                <span class="material-symbols-outlined">${layerIcon}</span>
              </div>
              <span class="arch-layer-number-pill" style="background: ${layerColor}22; color: ${layerColor};">
                Camada ${sug.layer_number}
              </span>
              <strong style="font-size: 14px; color: var(--text-main);">${escapeHtml(sug.name || sug.label)}</strong>
              <span class="pill-dot info" style="font-size: 10.5px; padding: 1px 6px;">${escapeHtml(sug.importance || 'Operacional')}</span>
            </div>
          </div>
          <p class="sug-card-desc" style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin: 4px 0 2px 0;">
            <strong>O que inclui:</strong> ${escapeHtml(sug.description)}
          </p>
          <p class="sug-card-rules" style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4; margin: 2px 0 0 0;">
            <strong>Regras:</strong> ${escapeHtml(sug.rules || '')}
          </p>
        </div>
        <div class="sug-card-action-col" style="margin-top: 10px; display: flex; align-items: center; justify-content: flex-end;">
          <button class="btn btn-sm btn-primary arch-layer-add-sug-btn" type="button" style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span class="material-symbols-outlined icon-xs">add</span>
            Adicionar ao Projeto
          </button>
        </div>
      `;

      const btnAdd = card.querySelector(".arch-layer-add-sug-btn");
      btnAdd.addEventListener("click", () => {
        if (!currentConfig) currentConfig = {};
        if (!Array.isArray(currentConfig.layers)) {
          currentConfig.layers = [];
        }
        currentConfig.layers.push(JSON.parse(JSON.stringify(sug)));
        currentConfig.layers.sort(
          (a, b) => (a.layer_number ?? 0) - (b.layer_number ?? 0),
        );
        renderLayers();
        markDirty();
      });

      layerSugGrid.appendChild(card);
    });
  }

  function addNewLayer() {
    if (!currentConfig) currentConfig = {};
    if (!Array.isArray(currentConfig.layers)) {
      currentConfig.layers = [];
    }
    const idx = currentConfig.layers.length;
    const color = DOMAIN_COLOR_PALETTE[idx % DOMAIN_COLOR_PALETTE.length];
    currentConfig.layers.push({
      key: `L${idx}_CUSTOM`,
      layer_number: idx,
      label: `Camada ${idx} — Nova Camada ${idx}`,
      name: `Nova Camada ${idx}`,
      icon: "layers",
      color: color,
      importance: "Operacional",
      description:
        "Descrição do escopo, responsabilidades e artefatos incluídos nesta camada.",
      rules:
        "Diretrizes e regras aplicadas a esta camada dentro da estrutura de domínios.",
    });
    renderLayers();
    markDirty();

    // Auto-focus the new card's name input
    setTimeout(() => {
      if (!layersGrid) return;
      const inputs = layersGrid.querySelectorAll(".arch-layer-name-input");
      if (inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1];
        lastInput.focus();
        lastInput.select();
      }
    }, 50);
  }

  if (btnAddLayer) {
    btnAddLayer.addEventListener("click", () => {
      addNewLayer();
    });
  }

  // Collect all UI values into single config payload
  function collectConfigData() {
    if (!currentConfig) currentConfig = {};
    const existingProj = currentConfig.project || {};
    const existing5w2h = currentConfig.canvas_5w2h || {};

    currentConfig.project = {
      ...existingProj,
      name: inputName ? inputName.value.trim() : existingProj.name || "",
      architecture_pattern: inputArchPattern
        ? inputArchPattern.value.trim()
        : existingProj.architecture_pattern || "",
      version: inputVersion
        ? inputVersion.value.trim()
        : existingProj.version || "1.0.0",
      lead: inputLead ? inputLead.value.trim() : existingProj.lead || "",
      repository_url: inputRepoUrl
        ? inputRepoUrl.value.trim()
        : existingProj.repository_url || "",
      description: inputDesc
        ? inputDesc.value.trim()
        : existingProj.description || "",
    };

    currentConfig.canvas_5w2h = {
      ...existing5w2h,
      what: input5w2hWhat
        ? input5w2hWhat.value.trim()
        : existing5w2h.what || "",
      why: input5w2hWhy ? input5w2hWhy.value.trim() : existing5w2h.why || "",
      who: input5w2hWho ? input5w2hWho.value.trim() : existing5w2h.who || "",
      where: input5w2hWhere
        ? input5w2hWhere.value.trim()
        : existing5w2h.where || "",
      when: input5w2hWhen
        ? input5w2hWhen.value.trim()
        : existing5w2h.when || "",
      how: input5w2hHow ? input5w2hHow.value.trim() : existing5w2h.how || "",
      how_much: input5w2hHowMuch
        ? input5w2hHowMuch.value.trim()
        : existing5w2h.how_much || "",
    };

    if (!Array.isArray(currentConfig.organization_domains)) {
      currentConfig.organization_domains = [];
    }

    if (!Array.isArray(currentConfig.layers)) {
      currentConfig.layers = [];
    }

    currentConfig.governance_rules = {
      require_invariants_for_tier1: checkRuleInvariants
        ? checkRuleInvariants.checked
        : true,
      require_dictionary_validation: checkRuleDictionary
        ? checkRuleDictionary.checked
        : true,
      enforce_linear_lifecycle: checkRuleLifecycle
        ? checkRuleLifecycle.checked
        : false,
    };

    currentConfig.ai_assistant_prompt = projCopilot
      ? projCopilot.getActivePrompt()
      : currentConfig.ai_assistant_prompt || DEFAULT_ABOUT_AGENT_PROMPT;

    currentConfig.ai_guardian_prompt = inputAiGuardianPrompt
      ? inputAiGuardianPrompt.value.trim()
      : "";

    return currentConfig;
  }

  // =============================================================================
  // AI COPILOT & AGENT PRE-PROMPT CONTROLLER (TAB 1: ABOUT)
  // =============================================================================

  const resizerProjAi = document.getElementById("resizer-proj-ai");
  const STORAGE_KEY_PROJ_CHAT_OPEN = "governance_project_ai_chat_open";

  function setProjAiVisibility(show) {
    if (!projAiPane) return;
    if (show) {
      projAiPane.classList.remove("collapsed");
      projAiPane.style.display = "flex";
      if (resizerProjAi) resizerProjAi.classList.remove("collapsed");
    } else {
      projAiPane.classList.add("collapsed");
      projAiPane.style.display = "none";
      if (resizerProjAi) resizerProjAi.classList.add("collapsed");
    }
    syncProjAiTriggerVisibility();
    try {
      localStorage.setItem(STORAGE_KEY_PROJ_CHAT_OPEN, show ? "true" : "false");
    } catch (e) {}
  }

  function syncProjAiTriggerVisibility() {
    if (!btnToggleProjAi || !projAiPane) return;
    const isCollapsed = projAiPane.classList.contains("collapsed") || projAiPane.style.display === "none";
    btnToggleProjAi.style.display = isCollapsed ? "inline-flex" : "none";
    btnToggleProjAi.classList.toggle("active", !isCollapsed);
  }

  if (btnToggleProjAi && projAiPane) {
    btnToggleProjAi.addEventListener("click", () => {
      setProjAiVisibility(true);
    });
  }

  // Initialize Reusable AI Chat Copilot for Tab 1 About
  if (projAiPane) {
    projCopilot = new AIChatCopilot({
      container: projAiPane,
      resizer: "#resizer-proj-ai",
      storageKey: "governance_project_ai_width",
      contextPath: "project/index.md",
      agentName: "Arquiteto de Fundação",
      agentIcon: "psychology",
      modelName: "gemini-3.5-flash",
      defaultSystemPrompt: DEFAULT_ABOUT_AGENT_PROMPT,
      customSystemPrompt: currentConfig?.ai_assistant_prompt || "",
      getRepoName: () => (getActiveRepo && getActiveRepo() ? getActiveRepo().name : "default"),
      getContent: () =>
        `
# Nome do Projeto: ${inputName ? inputName.value.trim() : ""}
## Por que fazemos?
${input5w2hWhy ? input5w2hWhy.value.trim() : ""}
## O que é o produto?
${input5w2hWhat ? input5w2hWhat.value.trim() : ""}
## Onde se aplica?
${input5w2hWhere ? input5w2hWhere.value.trim() : ""}
## Quando?
${input5w2hWhen ? input5w2hWhen.value.trim() : ""}
## Como construímos?
${input5w2hHow ? input5w2hHow.value.trim() : ""}
      `.trim(),
      chips: [
        {
          label: "💡 Proposta de Valor",
          prompt:
            "Sugira uma Proposta de Valor e escopo funcional para o campo 'O que é o produto?' com base no nome e contexto do projeto.",
        },
        {
          label: "🎯 Por que fazemos?",
          prompt:
            "Ajude a articular o campo 'Por que fazemos?', destacando dores de negócio, ROI e motivação central.",
        },
        {
          label: "🏛️ Arquitetura (Como?)",
          prompt:
            "Quais diretrizes arquiteturais, padrões DDD e tecnologias você sugere para 'Como construímos?'?",
        },
        {
          label: "📋 Revisar Preenchimento",
          prompt:
            "Analise todos os campos preenchidos do About e forneça sugestões de melhoria e polimento executivo.",
        },
      ],
      onPromptSaved: async (newPrompt) => {
        if (!currentConfig) currentConfig = {};
        currentConfig.ai_assistant_prompt = newPrompt;
        markDirty();
        await saveConfigInternal(
          "Pré-prompt do agente atualizado e salvo no projeto!",
        );
      },
      onPromptRestored: async (defaultPrompt) => {
        if (!currentConfig) currentConfig = {};
        currentConfig.ai_assistant_prompt = defaultPrompt;
        markDirty();
        await saveConfigInternal(
          "Pré-prompt restaurado para o padrão do framework!",
        );
      },
      onClose: () => {
        setProjAiVisibility(false);
      },
    });

    const savedProjChatState = localStorage.getItem(STORAGE_KEY_PROJ_CHAT_OPEN);
    const isInitialProjAiOpen = savedProjChatState !== null ? savedProjChatState === "true" : !projAiPane.classList.contains("collapsed");
    setProjAiVisibility(isInitialProjAiOpen);
  }

  // Helper to get currently active tab key
  function getCurrentActiveTab() {
    const activeBtn = document.querySelector(".project-tab-btn.active");
    if (!activeBtn) return "about";
    return activeBtn.dataset.tab === "taxonomy" ? "architecture" : activeBtn.dataset.tab;
  }

  // Request tab switch with unsaved changes prompt
  function requestTabSwitch(targetTab) {
    const canonicalTarget = targetTab === "taxonomy" ? "architecture" : targetTab;
    const currentTab = getCurrentActiveTab();

    if (canonicalTarget === currentTab) return;

    if (!isDirty) {
      switchToTab(canonicalTarget);
      return;
    }

    pendingTargetTab = canonicalTarget;
    openUnsavedModal(currentTab);
  }

  function openUnsavedModal(fromTab) {
    if (!modalUnsaved) {
      const shouldSave = confirm(
        "Você possui alterações não salvas nesta etapa!\n\nDeseja salvar as alterações no Git antes de mudar de aba?",
      );
      if (shouldSave) {
        saveConfigInternal("Alterações salvas com sucesso no Git!").then(() => {
          if (pendingTargetTab) switchToTab(pendingTargetTab);
        });
      } else {
        markClean();
        loadProjectConfig().then(() => {
          if (pendingTargetTab) switchToTab(pendingTargetTab);
        });
      }
      return;
    }

    if (modalUnsavedMsg && modalUnsavedHint) {
      if (fromTab === "about") {
        modalUnsavedMsg.innerHTML =
          "Você fez alterações no <strong>Sobre o Projeto / 5W2H</strong> mas ainda não as salvou no Git. Se mudar de aba sem salvar, suas alterações serão descartadas.";
        modalUnsavedHint.innerHTML =
          "💡 <strong>Dica:</strong> Salve agora para registrar a visão, justificativa de negócio e diretrizes do produto no repositório.";
      } else if (fromTab === "domains") {
        modalUnsavedMsg.innerHTML =
          "Você adicionou ou modificou <strong>Domínios & Áreas de Negócio</strong> nesta etapa. Se você não salvar agora, as pastas em <code>domains/</code> e os responsáveis oficiais não serão criados no projeto.";
        modalUnsavedHint.innerHTML =
          "📁 <strong>Dica:</strong> Salve agora para sincronizar os domínios corporativos e criar as pastas oficiais de especificação.";
      } else if (fromTab === "architecture") {
        modalUnsavedMsg.innerHTML =
          "Você personalizou as <strong>Camadas da Arquitetura (L0–L5)</strong> do projeto. Deseja salvar as regras e importância antes de mudar de aba?";
        modalUnsavedHint.innerHTML =
          "🏛️ <strong>Dica:</strong> Salve agora para definir a hierarquia oficial e as regras de navegação entre domínios.";
      } else if (fromTab === "governance") {
        modalUnsavedMsg.innerHTML =
          "Você alterou as <strong>Políticas de Linter Arquitetural ou Prompt do Guardião IA</strong>. Deseja salvar antes de mudar de aba?";
        modalUnsavedHint.innerHTML =
          "🛡️ <strong>Dica:</strong> Salve agora para ativar o linter e o assistente de IA oficial no repositório.";
      } else {
        modalUnsavedMsg.innerHTML =
          "Você possui alterações não salvas nesta etapa do projeto. O que deseja fazer antes de mudar de aba?";
        modalUnsavedHint.innerHTML =
          "💡 <strong>Dica:</strong> Ao salvar, suas definições são versionadas no Git e sincronizadas com a estrutura oficial do repositório.";
      }
    }

    modalUnsaved.style.display = "flex";
  }

  function closeUnsavedModal() {
    if (modalUnsaved) modalUnsaved.style.display = "none";
    pendingTargetTab = null;
  }

  if (btnCloseUnsaved) {
    btnCloseUnsaved.addEventListener("click", closeUnsavedModal);
  }
  if (btnUnsavedCancel) {
    btnUnsavedCancel.addEventListener("click", closeUnsavedModal);
  }
  if (modalUnsaved) {
    modalUnsaved.addEventListener("click", (e) => {
      if (e.target === modalUnsaved) closeUnsavedModal();
    });
  }

  if (btnUnsavedDiscard) {
    btnUnsavedDiscard.addEventListener("click", async () => {
      const target = pendingTargetTab;
      closeUnsavedModal();
      markClean();
      await loadProjectConfig();
      if (target) switchToTab(target);
      if (onNotify) {
        onNotify("Alterações não salvas foram descartadas.", "info");
      }
    });
  }

  if (btnUnsavedSave) {
    btnUnsavedSave.addEventListener("click", async () => {
      const target = pendingTargetTab;
      btnUnsavedSave.disabled = true;
      btnUnsavedSave.textContent = "Salvando no Git...";
      const ok = await saveConfigInternal("Alterações salvas com sucesso no Git!");
      btnUnsavedSave.disabled = false;
      btnUnsavedSave.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar & Avançar';
      closeUnsavedModal();
      if (ok && target) {
        switchToTab(target);
      }
    });
  }

  // Switch to specific tab helper
  function switchToTab(targetTab) {
    const canonicalTab = targetTab === "taxonomy" ? "architecture" : targetTab;
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    const btn =
      document.querySelector(`.project-tab-btn[data-tab="${canonicalTab}"]`) ||
      document.querySelector(`.project-tab-btn[data-tab="${targetTab}"]`);
    if (btn) btn.classList.add("active");

    const activePane =
      document.getElementById(`pane-proj-${canonicalTab}`) ||
      document.getElementById(`pane-proj-${targetTab}`);
    if (activePane) activePane.classList.add("active");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Save config helper returning Promise<boolean>
  async function saveConfigInternal(customMessage = null) {
    const payload = collectConfigData();
    try {
      const { ok, data } = await API.saveProjectConfig(payload);
      if (ok && data.success) {
        markClean();
        if (headerTitle && payload.project && payload.project.name) {
          headerTitle.textContent = `${payload.project.name} — Fundação & Setup`;
        }
        if (onNotify) {
          onNotify(
            customMessage || "Configurações salvas e registradas no Git!",
            "success",
          );
        }
        if (onConfigSaved) {
          await onConfigSaved(payload);
        }
        return true;
      } else {
        if (onNotify) {
          onNotify(
            "Erro ao salvar no Git: " + (data?.error || "Erro desconhecido"),
            "error",
          );
        }
        return false;
      }
    } catch (e) {
      console.error("Erro ao salvar:", e);
      if (onNotify) onNotify("Falha na comunicação ao salvar no Git.", "error");
      return false;
    }
  }

  // Step Navigation Buttons (Auto-save on advance)
  const btnNavAboutNext = document.getElementById("btn-nav-about-next");
  const btnNavDomainsPrev =
    document.getElementById("btn-nav-domains-prev") ||
    document.getElementById("btn-nav-org-prev");
  const btnNavDomainsNext =
    document.getElementById("btn-nav-domains-next") ||
    document.getElementById("btn-nav-org-next");
  const btnNavArchPrev =
    document.getElementById("btn-nav-arch-prev") ||
    document.getElementById("btn-nav-tax-prev");
  const btnNavArchNext =
    document.getElementById("btn-nav-arch-next") ||
    document.getElementById("btn-nav-tax-next");
  const btnNavGovPrev = document.getElementById("btn-nav-gov-prev");
  const btnNavGovFinish = document.getElementById("btn-nav-gov-finish");

  if (btnNavAboutNext) {
    btnNavAboutNext.addEventListener("click", async () => {
      btnNavAboutNext.disabled = true;
      btnNavAboutNext.innerHTML = "Salvando no Git...";
      const ok = await saveConfigInternal(
        "Sobre salvo no Git! Avançando para Domínios...",
      );
      btnNavAboutNext.disabled = false;
      btnNavAboutNext.innerHTML =
        'Salvar & Avançar para Domínios <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("domains");
    });
  }

  if (btnNavDomainsPrev) {
    btnNavDomainsPrev.addEventListener("click", () => requestTabSwitch("about"));
  }

  if (btnNavDomainsNext) {
    btnNavDomainsNext.addEventListener("click", async () => {
      btnNavDomainsNext.disabled = true;
      btnNavDomainsNext.innerHTML = "Salvando domínios...";
      const ok = await saveConfigInternal(
        "Domínios salvos na configuração do projeto!",
      );
      btnNavDomainsNext.disabled = false;
      btnNavDomainsNext.innerHTML =
        'Salvar & Avançar para Arquitetura <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("architecture");
    });
  }

  if (btnNavArchPrev) {
    btnNavArchPrev.addEventListener("click", () => requestTabSwitch("domains"));
  }

  if (btnNavArchNext) {
    btnNavArchNext.addEventListener("click", async () => {
      btnNavArchNext.disabled = true;
      btnNavArchNext.innerHTML = "Salvando no Git...";
      const ok = await saveConfigInternal(
        "Camadas de Arquitetura salvas no Git! Avançando para Políticas IA...",
      );
      btnNavArchNext.disabled = false;
      btnNavArchNext.innerHTML =
        'Salvar & Avançar para Políticas IA <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("governance");
    });
  }

  if (btnNavGovPrev) {
    btnNavGovPrev.addEventListener("click", () => requestTabSwitch("architecture"));
  }

  if (btnNavGovFinish) {
    btnNavGovFinish.addEventListener("click", async () => {
      btnNavGovFinish.disabled = true;
      btnNavGovFinish.innerHTML = "Finalizando Setup...";
      await saveConfigInternal(
        "Setup da Constituição e Governança do Projeto concluído com sucesso!",
      );
      btnNavGovFinish.disabled = false;
      btnNavGovFinish.innerHTML =
        '<span class="material-symbols-outlined icon-xs">check_circle</span> Salvar & Concluir Setup';
    });
  }

  // Save Project Configuration (Legacy direct button if present)
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener("click", async () => {
      btnSaveConfig.disabled = true;
      btnSaveConfig.textContent = "Salvando no Git...";
      await saveConfigInternal();
      btnSaveConfig.disabled = false;
      btnSaveConfig.innerHTML =
        '<span class="material-symbols-outlined icon-xs">save</span> Salvar Configurações no Git';
    });
  }

  // Reset Project Configuration to Recommended Presets
  if (btnResetConfig) {
    btnResetConfig.addEventListener("click", async () => {
      const confirmReset = confirm(
        "Deseja restaurar as configurações do projeto para o Padrão Recomendado pelo Framework (Camadas 0 a 5, Definições Estratégicas e Domínios padrão)? As alterações atuais serão substituídas.",
      );
      if (!confirmReset) return;

      btnResetConfig.disabled = true;
      btnResetConfig.textContent = "Restaurando...";

      try {
        const { ok, data } = await API.resetProjectConfig();
        if (ok && data.success) {
          currentConfig = data.config;
          renderFormFields(currentConfig);
          markClean();
          if (onNotify) {
            onNotify(
              "Configurações restauradas para o preset recomendado com sucesso!",
              "info",
            );
          }
          if (onConfigSaved) {
            await onConfigSaved(currentConfig);
          }
        } else {
          alert(
            "Erro ao restaurar configurações: " +
              (data.error || "Erro desconhecido"),
          );
        }
      } catch (e) {
        console.error("Erro ao restaurar:", e);
      } finally {
        btnResetConfig.disabled = false;
        btnResetConfig.innerHTML =
          '<span class="material-symbols-outlined icon-xs">restart_alt</span> Restaurar Padrões';
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    loadProjectConfig,
    getConfig: () => currentConfig,
  };
}

// =============================================================================
// VIEW MODULE: COCKPIT DE FUNDAÇÃO & SETUP DO PROJETO (PROJECT HUB)
// =============================================================================
import { API } from "../api.js";
import { AIChatCopilot } from "../components/ai-chat-copilot.js";
import { IconPicker } from "../components/icon-picker.js";

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
        {
          id: "contas-a-pagar",
          name: "Contas a Pagar",
          description:
            "Gestão de obrigações, parceiros e controle de vencimentos.",
        },
        {
          id: "contas-a-receber",
          name: "Contas a Receber",
          description:
            "Gestão de recebíveis, cobrança e conciliação bancária de entradas.",
        },
        {
          id: "faturamento",
          name: "Faturamento & NFe",
          description:
            "Emissão de notas fiscais, impostos e conformidade fiscal.",
        },
        {
          id: "tesouraria",
          name: "Tesouraria & Conciliação",
          description:
            "Controle de saldos bancários, liquidez diária e transferências.",
        },
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
        {
          id: "aquisicao",
          name: "Aquisição & Mídia",
          description:
            "Campanhas de tráfego pago, anúncios em redes e canais digitais.",
        },
        {
          id: "branding",
          name: "Branding & Posicionamento",
          description:
            "Identidade corporativa, tom de voz, design de marca e reputação.",
        },
        {
          id: "growth",
          name: "Growth & Experimentação",
          description:
            "Otimização de conversão (CRO), testes A/B e funis de retenção.",
        },
        {
          id: "conteudo",
          name: "Conteúdo & Inbound",
          description:
            "Produção de conteúdo editorial, artigos técnicos, SEO e newsletters.",
        },
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
        {
          id: "rh-dp",
          name: "Recursos Humanos & DP",
          description:
            "Gestão de colaboradores, folha, benefícios e recrutamento.",
        },
        {
          id: "facilities",
          name: "Facilities & Patrimônio",
          description:
            "Gestão de infraestrutura física, suprimentos e escritórios.",
        },
        {
          id: "juridico-compliance",
          name: "Jurídico & Compliance",
          description:
            "Gestão contratual, LGPD, riscos regulatórios e governança.",
        },
        {
          id: "compras",
          name: "Compras & Suprimentos",
          description:
            "Cotações, negociações com fornecedores e requisições internas.",
        },
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
        {
          id: "logistica",
          name: "Logística & Fulfillment",
          description:
            "Controle de estoque, expedição, despacho e rastreamento de entregas.",
        },
        {
          id: "atendimento",
          name: "Atendimento & Suporte (SAC)",
          description:
            "Central de ajuda, triagem de tickets e atendimento ao cliente final.",
        },
        {
          id: "qualidade",
          name: "Qualidade & SLA",
          description:
            "Auditoria de processos operacionais e garantia de cumprimento de prazos.",
        },
        {
          id: "pos-venda",
          name: "Pós-Venda & Retenção",
          description:
            "Sucesso do cliente, acompanhamento de satisfação (NPS) e onboarding.",
        },
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
        {
          id: "backend",
          name: "Backend & APIs",
          description:
            "Microsserviços, banco de dados, regras de negócio e integrações REST/gRPC.",
        },
        {
          id: "frontend",
          name: "Frontend & Web Apps",
          description:
            "Interfaces web, aplicações mobile, componentes de UI e experiência do usuário.",
        },
        {
          id: "infra-devops",
          name: "Infraestrutura & DevOps",
          description:
            "Pipelines de CI/CD, clusters Kubernetes, Docker e automação de deploy.",
        },
        {
          id: "seguranca",
          name: "Segurança & SecOps",
          description:
            "Gestão de vulnerabilidades, IAM, criptografia e proteção de dados sensíveis.",
        },
      ],
    },
  ];

  // 7 Rainbow Hues x 3 Tonal Variations (Pastel/Light, Vibrant/Primary, Deep/Dark) = 21 Curated Colors
  const DOMAIN_COLOR_PALETTE = [
    // Row 1: Tons Suaves / Claros (Light)
    "#f87171", // 1. Vermelho Claro
    "#fb923c", // 2. Laranja Claro
    "#fde047", // 3. Amarelo Claro
    "#4ade80", // 4. Verde Claro
    "#38bdf8", // 5. Ciano Claro
    "#818cf8", // 6. Azul/Índigo Claro
    "#c084fc", // 7. Violeta Claro

    // Row 2: Tons Vibrantes / Primários (Vibrant)
    "#ef4444", // 1. Vermelho Vivo
    "#f97316", // 2. Laranja Vivo
    "#eab308", // 3. Amarelo Dourado
    "#10b981", // 4. Verde Esmeralda
    "#06b6d4", // 5. Ciano Vivo
    "#3b82f6", // 6. Azul Real
    "#8b5cf6", // 7. Violeta Vivo

    // Row 3: Tons Profundos / Escuros (Deep)
    "#b91c1c", // 1. Vermelho Escuro
    "#c2410c", // 2. Laranja Queimado
    "#a16207", // 3. Âmbar / Bronze
    "#15803d", // 4. Verde Floresta
    "#0e7490", // 5. Petróleo / Azul Petróleo
    "#1d4ed8", // 6. Azul Marinho
    "#6b21a8", // 7. Roxo Profundo
  ];

  // Form Fields: Camadas de Arquitetura & Governança (L0 - L5)
  const layersGrid = document.getElementById("proj-layers-grid");
  const btnAddLayer = document.getElementById("btn-proj-add-layer");
  const btnLayersViewGrid = document.getElementById("btn-layers-view-grid");
  const btnLayersViewList = document.getElementById("btn-layers-view-list");
  const layerSugPanel = document.getElementById(
    "proj-layers-suggestions-panel",
  );
  const layerSugHeader = document.getElementById(
    "proj-layers-suggestions-header",
  );
  const layerSugChevron = document.getElementById("proj-layers-sug-chevron");
  const layerSugLabel = document.getElementById("proj-layers-sug-label");
  const layerSugGrid = document.getElementById("proj-layers-suggestions-grid");
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

  // Form Fields: Políticas, Regulação & Leis Mandatórias
  const regulatorsTagsList = document.getElementById("proj-regulators-tags-list");
  const inputAddRegulator = document.getElementById("proj-input-add-regulator");
  const btnAddRegulator = document.getElementById("btn-add-regulator");
  const inputPoliciesLaws = document.getElementById("proj-policies-laws");
  const inputPoliciesCancellation = document.getElementById("proj-policies-cancellation");
  const inputPoliciesRefund = document.getElementById("proj-policies-refund");
  const inputPoliciesRetention = document.getElementById("proj-policies-retention");
  const inputPoliciesSla = document.getElementById("proj-policies-sla");
  const inputPoliciesDpo = document.getElementById("proj-policies-dpo");
  const inputPoliciesConsent = document.getElementById("proj-policies-consent");
  const inputPoliciesSensitiveData = document.getElementById("proj-policies-sensitive-data");
  const inputPoliciesMarkdownPreview = document.getElementById("proj-policies-markdown-preview");
  const btnSyncPoliciesMd = document.getElementById("btn-sync-policies-md");
  const btnOpenPoliciesEditor = document.getElementById("btn-open-policies-editor");
  const btnPolicyPresetClear = document.getElementById("btn-policy-preset-clear");
  const policyPresetBtns = document.querySelectorAll(".btn-policy-preset");

  let currentRegulators = [];

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
        syncBadge.innerHTML =
          '<span class="dot"></span> Configuração Oficial Ativa';
      } else {
        syncBadge.className = "pill-dot info";
        syncBadge.innerHTML =
          '<span class="dot"></span> Setup Inicial (Sugestões Padrão)';
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
    inputPoliciesLaws,
    inputPoliciesCancellation,
    inputPoliciesRefund,
    inputPoliciesRetention,
    inputPoliciesSla,
    inputPoliciesDpo,
    inputPoliciesConsent,
    inputPoliciesSensitiveData,
    inputPoliciesMarkdownPreview,
  ].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => {
        markDirty();
        if (el !== inputPoliciesMarkdownPreview) {
          compilePoliciesMarkdown();
        }
      });
      el.addEventListener("change", () => {
        markDirty();
        if (el !== inputPoliciesMarkdownPreview) {
          compilePoliciesMarkdown();
        }
      });
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
  async function loadProjectConfig(initialTab = null) {
    try {
      await loadTeamMembers();
      const { ok, data } = await API.getProjectConfig();
      if (!ok || !data || !data.config) return;

      if (
        data.suggested_domains &&
        Array.isArray(data.suggested_domains) &&
        data.suggested_domains.length > 0
      ) {
        suggestedDomains = data.suggested_domains;
      }
      if (
        data.suggested_layers &&
        Array.isArray(data.suggested_layers) &&
        data.suggested_layers.length > 0
      ) {
        suggestedLayers = data.suggested_layers;
      }
      if (
        data.suggested_importance_levels &&
        Array.isArray(data.suggested_importance_levels) &&
        data.suggested_importance_levels.length > 0
      ) {
        suggestedImportanceLevels = data.suggested_importance_levels;
      }

      currentConfig = data.config;
      renderFormFields(currentConfig);
      markClean(Boolean(data.is_customized));

      // Activate tab from URL query if specified
      const urlParams = new URLSearchParams(
        (window.location.hash || "").split("?")[1] || "",
      );
      const activeTabFromUrl = initialTab || urlParams.get("tab");
      if (activeTabFromUrl) {
        const canonicalTab =
          activeTabFromUrl === "taxonomy" ? "architecture" : activeTabFromUrl;
        switchToTab(canonicalTab, false);
      }
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

    // Políticas, Regulação & Leis Mandatórias do Negócio
    const pol = cfg.policies || {};
    currentRegulators = Array.isArray(pol.regulators) ? [...pol.regulators] : [];
    renderRegulatorsTags();
    if (inputPoliciesLaws) inputPoliciesLaws.value = pol.laws || "";
    if (inputPoliciesCancellation) inputPoliciesCancellation.value = pol.cancellation_policy || "";
    if (inputPoliciesRefund) inputPoliciesRefund.value = pol.refund_policy || "";
    if (inputPoliciesRetention) inputPoliciesRetention.value = pol.retention_policy || "";
    if (inputPoliciesSla) inputPoliciesSla.value = pol.sla_support || "";
    if (inputPoliciesDpo) inputPoliciesDpo.value = pol.dpo_contact || "";
    if (inputPoliciesConsent) inputPoliciesConsent.value = pol.consent_policy || "";
    if (inputPoliciesSensitiveData) inputPoliciesSensitiveData.value = pol.sensitive_data_policy || "";
    if (inputPoliciesMarkdownPreview) {
      inputPoliciesMarkdownPreview.value = pol.markdown_content || "";
      if (!inputPoliciesMarkdownPreview.value.trim()) {
        compilePoliciesMarkdown();
      }
    }
  }

  // View Mode: Cards (Grid) vs Lista (Domains)
  function setDomainsViewMode(mode) {
    const isList = mode === "list";
    if (domainsGrid) domainsGrid.classList.toggle("view-list", isList);
    if (sugGrid) sugGrid.classList.toggle("view-list", isList);
    if (btnDomainsViewList)
      btnDomainsViewList.classList.toggle("active", isList);
    if (btnDomainsViewGrid)
      btnDomainsViewGrid.classList.toggle("active", !isList);
    try {
      localStorage.setItem(
        STORAGE_KEY_DOMAINS_VIEW_MODE,
        isList ? "list" : "grid",
      );
    } catch (e) {}
  }

  function initDomainsViewMode() {
    if (btnDomainsViewGrid) {
      btnDomainsViewGrid.onclick = () => setDomainsViewMode("grid");
    }
    if (btnDomainsViewList) {
      btnDomainsViewList.onclick = () => setDomainsViewMode("list");
    }
    const savedMode =
      localStorage.getItem(STORAGE_KEY_DOMAINS_VIEW_MODE) || "grid";
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

  // Track user expand/collapse preference for subdomains per domain card
  const domainSubdomainsExpandedState = new Map();

  // ===========================================================================
  // DOMAIN & SUBDOMAIN SLUG VALIDATION & CONFLICT PREVENTION HELPERS
  // ===========================================================================

  function sanitizeSlug(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
      .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
      .replace(/-+/g, "-"); // collapse consecutive hyphens
  }

  function isDomainSlugConflict(slug, excludeIndex = -1) {
    const cleanSlug = sanitizeSlug(slug);
    if (!cleanSlug) return false;
    const domains = Array.isArray(currentConfig.organization_domains)
      ? currentConfig.organization_domains
      : [];
    return domains.some(
      (d, idx) =>
        idx !== excludeIndex &&
        (sanitizeSlug(d.id) === cleanSlug ||
          sanitizeSlug(d.name) === cleanSlug),
    );
  }

  function generateUniqueDomainSlug(baseText, excludeIndex = -1) {
    let clean = sanitizeSlug(baseText) || "dominio";
    const domains = Array.isArray(currentConfig.organization_domains)
      ? currentConfig.organization_domains
      : [];
    const existingSlugs = domains
      .map((d, idx) =>
        idx === excludeIndex ? null : sanitizeSlug(d.id || d.name),
      )
      .filter(Boolean);

    if (!existingSlugs.includes(clean)) return clean;

    let counter = 2;
    while (existingSlugs.includes(`${clean}-${counter}`)) {
      counter++;
    }
    return `${clean}-${counter}`;
  }

  function isSubdomainSlugConflict(domain, slug, excludeIndex = -1) {
    const cleanSlug = sanitizeSlug(slug);
    if (!cleanSlug) return false;
    const subdomains = Array.isArray(domain.subdomains)
      ? domain.subdomains
      : [];
    return subdomains.some(
      (s, idx) =>
        idx !== excludeIndex &&
        (sanitizeSlug(s.id) === cleanSlug ||
          sanitizeSlug(s.name) === cleanSlug),
    );
  }

  function generateUniqueSubdomainSlug(domain, baseText, excludeIndex = -1) {
    let clean = sanitizeSlug(baseText) || "subdominio";
    const subdomains = Array.isArray(domain.subdomains)
      ? domain.subdomains
      : [];
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
            d.color ||
            DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
          d.color = domainColor;
          const domainIcon = d.icon || "domain";
          d.icon = domainIcon;
          const domainSlug =
            d.id || sanitizeSlug(d.name) || `dominio-${index + 1}`;
          d.id = domainSlug;
          const responsibles = Array.isArray(d.responsibles)
            ? d.responsibles
            : [];

          // Render subdomains items
          const subdomains = Array.isArray(d.subdomains) ? d.subdomains : [];
          if (!Array.isArray(d.subdomains)) d.subdomains = subdomains;

          const isSubdomainsExpanded =
            domainSubdomainsExpandedState.get(domainSlug) === true;

          let subdomainsListHtml = "";
          if (subdomains.length === 0) {
            subdomainsListHtml =
              '<span style="font-size: 11px; color: var(--text-muted); font-style: italic; padding: 4px 0;">Nenhum subdomínio configurado</span>';
          } else {
            subdomains.forEach((sub, sIdx) => {
              const isBlankOrNew = Boolean(sub._isNew || (!sub.name && !sub.description));
              const subId = sanitizeSlug(
                sub.id || sub.name || `sub-${sIdx + 1}`,
              );
              const subName = sub.name || (isBlankOrNew ? "Novo Subdomínio" : subId);
              const subDesc = sub.description || "";
              const namespacedSlug = `#${domainSlug}/${subId}`;

              subdomainsListHtml += `
                <div class="org-subdomain-item ${isBlankOrNew ? "is-editing" : ""}" data-sidx="${sIdx}">
                  <div class="org-subdomain-item-header">
                    <div class="org-subdomain-item-left">
                      <span class="material-symbols-outlined" style="font-size: 14px; color: ${domainColor}; flex-shrink: 0;">category</span>
                      <span class="org-subdomain-item-name" title="${escapeHtml(subName)}">${escapeHtml(subName)}</span>
                      <span class="org-subdomain-item-slug" title="Identificador hierárquico">${escapeHtml(namespacedSlug)}</span>
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
                  <div class="org-subdomain-item-edit-body" style="display: ${isBlankOrNew ? "flex" : "none"};">
                    <div class="org-subdomain-edit-field">
                      <label class="org-subdomain-edit-label">Nome do Subdomínio</label>
                      <input type="text" class="org-subdomain-edit-name" value="${escapeHtml(sub.name || "")}" placeholder="Nome do subdomínio..." />
                    </div>
                    <div class="org-subdomain-edit-field">
                      <label class="org-subdomain-edit-label">Identificador (#slug)</label>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">#${escapeHtml(domainSlug)}/</span>
                        <input type="text" class="org-subdomain-edit-slug" value="${escapeHtml(subId)}" placeholder="slug-unico" />
                      </div>
                      <div class="org-subdomain-slug-feedback conflict" style="display: none;"></div>
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
          const rawSuggestions =
            domainTemplate?.suggested_subdomains ||
            d.suggested_subdomains ||
            [];
          const availableSubSuggestions = rawSuggestions.filter(
            (sugSub) =>
              !subdomains.some(
                (existing) =>
                  sanitizeSlug(existing.id) === sanitizeSlug(sugSub.id) ||
                  (existing.name &&
                    existing.name.toLowerCase() === sugSub.name.toLowerCase()),
              ),
          );

          let suggestedSubdomainsHtml = "";
          if (availableSubSuggestions.length > 0) {
            suggestedSubdomainsHtml = availableSubSuggestions
              .map(
                (sugSub) => `
                <button class="org-subdomain-sug-chip" data-sug-id="${escapeHtml(sugSub.id)}" type="button" title="${escapeHtml(sugSub.description || "")}">
                  <span class="material-symbols-outlined" style="font-size: 11px;">add</span>
                  #${escapeHtml(domainSlug)}/${escapeHtml(sugSub.id || sanitizeSlug(sugSub.name))}
                </button>
              `,
              )
              .join("");
          }

          // Render responsibles chips
          let membersChipsHtml = "";

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
              <div class="org-domain-icon-wrap">
                <div class="org-domain-icon-badge" style="background: ${domainColor}18; color: ${domainColor};" title="Clique para escolher outro ícone na Biblioteca">
                  <span class="material-symbols-outlined">${domainIcon}</span>
                  <span class="icon-edit-hint material-symbols-outlined">edit</span>
                </div>
                <button class="org-domain-color-btn" style="background: ${domainColor};" type="button" title="Alterar cor do domínio"></button>
                <div class="color-palette-popover" style="display: none;">
                  ${DOMAIN_COLOR_PALETTE.map(
                    (c) => `
                    <div class="color-swatch ${c === domainColor ? "active" : ""}" data-color="${c}" style="background: ${c};" title="${c}"></div>
                  `,
                  ).join("")}
                </div>
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

            <!-- Subdomains / Capabilities Section (Collapsible Accordion) -->
            <div class="org-domain-subdomains-section ${isSubdomainsExpanded ? "" : "collapsed"}">
              <div class="org-domain-subdomains-header" title="Clique para expandir/recolher subdomínios">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="material-symbols-outlined org-domain-subdomains-toggle-chevron">expand_more</span>
                  <span class="material-symbols-outlined" style="font-size: 15px; color: ${domainColor};">category</span>
                  <span style="font-size: 12px; font-weight: 600;">Subdomínios & Capacidades</span>
                </div>
              </div>

              <!-- Collapsed Preview Row -->
              <div class="org-domain-subdomains-preview-row">
                ${subdomains.length === 0 ? '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Nenhum subdomínio configurado</span>' : ""}
                ${subdomains
                  .map((sub) => {
                    const subId = sanitizeSlug(sub.id || sub.name);
                    return `<span class="org-subdomain-preview-pill" title="${escapeHtml(sub.name || subId)}">#${escapeHtml(domainSlug)}/${escapeHtml(subId)}</span>`;
                  })
                  .join("")}
              </div>

              <!-- Expanded Body -->
              <div class="org-domain-subdomains-body">
                <div class="org-subdomains-list">
                  ${subdomainsListHtml}
                </div>
                ${
                  suggestedSubdomainsHtml
                    ? `
                  <div class="org-subdomain-sug-wrap">
                    <span class="org-subdomain-sug-label">Sugestões rápidas:</span>
                    ${suggestedSubdomainsHtml}
                  </div>
                `
                    : ""
                }
                <div class="org-subdomain-quick-add-wrap">
                  <button class="org-subdomain-add-blank-btn" type="button">
                    <span class="material-symbols-outlined" style="font-size: 14px;">add</span>
                    Adicionar Subdomínio
                  </button>
                </div>
              </div>
            </div>

            <!-- Responsibles / Team Section -->
            <div class="org-domain-responsibles-section">
              <div class="org-domain-responsibles-header">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: var(--text-muted);">group</span
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
              <div class="org-domain-slug-row">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">#</span>
                  <input
                    type="text"
                    class="org-domain-slug-input"
                    value="${escapeHtml(domainSlug)}"
                    placeholder="slug-do-dominio"
                    title="Identificador único (#slug) do domínio"
                  />
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">domains/${escapeHtml(domainSlug)}/</span>
              </div>
            </div>
          `;

          const nameInput = card.querySelector(".org-domain-name-input");
          const descInput = card.querySelector(".org-domain-desc-input");
          const deleteBtn = card.querySelector(".org-domain-delete-btn");
          const domainSlugInput = card.querySelector(".org-domain-slug-input");
          const assignDropdown = card.querySelector(
            ".org-domain-assign-dropdown",
          );
          const iconBadge = card.querySelector(".org-domain-icon-badge");
          const colorBtn = card.querySelector(".org-domain-color-btn");
          const colorPopover = card.querySelector(".color-palette-popover");
          const subdomainsHeader = card.querySelector(
            ".org-domain-subdomains-header",
          );

          // Icon Picker Trigger
          if (iconBadge) {
            iconBadge.onclick = (e) => {
              e.stopPropagation();
              IconPicker.open({
                currentIcon: d.icon || "domain",
                onSelect: (newIcon) => {
                  d.icon = newIcon;
                  renderDomains();
                  markDirty();
                },
              });
            };
          }

          // Color Palette Popover Trigger
          if (colorBtn && colorPopover) {
            colorBtn.onclick = (e) => {
              e.stopPropagation();
              const isShown = colorPopover.style.display === "grid";
              document
                .querySelectorAll(".color-palette-popover")
                .forEach((p) => {
                  p.style.display = "none";
                });
              colorPopover.style.display = isShown ? "none" : "grid";
            };

            colorPopover.querySelectorAll(".color-swatch").forEach((swatch) => {
              swatch.onclick = (e) => {
                e.stopPropagation();
                d.color = swatch.dataset.color;
                colorPopover.style.display = "none";
                renderDomains();
                markDirty();
              };
            });
          }

          // Subdomains Accordion Toggle
          if (subdomainsHeader) {
            subdomainsHeader.onclick = (e) => {
              e.stopPropagation();
              const currentExpanded =
                domainSubdomainsExpandedState.get(domainSlug) === true;
              domainSubdomainsExpandedState.set(domainSlug, !currentExpanded);
              renderDomains();
            };
          }

          // Domain Name Live Input
          nameInput.addEventListener("input", () => {
            d.name = nameInput.value;
            const autoId = generateUniqueDomainSlug(d.name, index);
            if (autoId && !domainSlugInput.dataset.manuallyEdited) {
              d.id = autoId;
              if (domainSlugInput) domainSlugInput.value = autoId;
            }
            markDirty();
          });

          // Domain Slug Manual Input & Live Uniqueness Validation
          if (domainSlugInput) {
            domainSlugInput.addEventListener("input", () => {
              domainSlugInput.dataset.manuallyEdited = "true";
              const clean = sanitizeSlug(domainSlugInput.value);
              domainSlugInput.value = clean;
              const conflict = isDomainSlugConflict(clean, index);
              if (conflict || !clean) {
                domainSlugInput.classList.add("conflict");
              } else {
                domainSlugInput.classList.remove("conflict");
                d.id = clean;
              }
              markDirty();
            });

            domainSlugInput.addEventListener("blur", () => {
              let clean = sanitizeSlug(domainSlugInput.value);
              if (!clean || isDomainSlugConflict(clean, index)) {
                clean = generateUniqueDomainSlug(clean || d.name, index);
              }
              d.id = clean;
              domainSlugInput.value = clean;
              domainSlugInput.classList.remove("conflict");
              renderDomains();
              markDirty();
            });
          }

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
              const editBody = item.querySelector(
                ".org-subdomain-item-edit-body",
              );
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
            const cancelBtn = item.querySelector(
              ".org-subdomain-edit-cancel-btn",
            );
            const editBody = item.querySelector(
              ".org-subdomain-item-edit-body",
            );

            let slugManuallyEdited = false;

            const validateSlug = () => {
              if (!slugInp || !feedback) return true;
              const clean = sanitizeSlug(slugInp.value);
              if (!clean) {
                feedback.className = "org-subdomain-slug-feedback conflict";
                feedback.style.display = "block";
                feedback.textContent =
                  "⚠️ O identificador (#slug) não pode ser vazio";
                return false;
              }
              const conflict = isSubdomainSlugConflict(d, clean, sIdx);
              if (conflict) {
                feedback.className = "org-subdomain-slug-feedback conflict";
                feedback.style.display = "block";
                feedback.textContent = `⚠️ #${domainSlug}/${clean} já existe neste domínio`;
                return false;
              } else {
                feedback.style.display = "none";
                feedback.textContent = "";
                return true;
              }
            };

            if (nameInp) {
              nameInp.addEventListener("input", () => {
                if (!slugManuallyEdited && slugInp) {
                  slugInp.value = generateUniqueSubdomainSlug(
                    d,
                    nameInp.value,
                    sIdx,
                  );
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
              const newName = nameInp.value.trim() || sub.name || "Novo Subdomínio";
              let newSlug =
                sanitizeSlug(slugInp.value) || sanitizeSlug(newName) || generateUniqueSubdomainSlug(d, "subdominio", sIdx);
              if (isSubdomainSlugConflict(d, newSlug, sIdx)) {
                newSlug = generateUniqueSubdomainSlug(d, newSlug, sIdx);
              }
              sub.name = newName;
              sub.id = newSlug;
              if (descInp) sub.description = descInp.value.trim();
              delete sub._isNew;
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
                if (!sub.name || !sub.name.trim()) {
                  d.subdomains.splice(sIdx, 1);
                  renderDomains();
                  markDirty();
                } else {
                  delete sub._isNew;
                  item.classList.remove("is-editing");
                  if (editBody) editBody.style.display = "none";
                }
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
                domainSubdomainsExpandedState.set(domainSlug, true);
                renderDomains();
                markDirty();
              }
            });
          });

          // Add Blank Subdomain
          const addBlankBtn = card.querySelector(".org-subdomain-add-blank-btn");
          if (addBlankBtn) {
            addBlankBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (!Array.isArray(d.subdomains)) d.subdomains = [];
              const uniqueSlug = generateUniqueSubdomainSlug(d, "novo-subdominio");
              d.subdomains.push({
                id: uniqueSlug,
                name: "",
                description: "",
                responsibles: [],
                _isNew: true,
              });
              domainSubdomainsExpandedState.set(domainSlug, true);
              renderDomains();
              markDirty();

              // Auto-focus the newly created subdomain input
              setTimeout(() => {
                const newlyRenderedCard = domainCardsContainer.querySelector(
                  `.org-domain-card[data-didx="${idx}"]`,
                );
                if (newlyRenderedCard) {
                  const lastSubItem = newlyRenderedCard.querySelector(
                    `.org-subdomain-item[data-sidx="${d.subdomains.length - 1}"]`,
                  );
                  if (lastSubItem) {
                    const nameInp = lastSubItem.querySelector(".org-subdomain-edit-name");
                    if (nameInp) {
                      nameInp.focus();
                      nameInp.select();
                    }
                  }
                }
              }, 30);
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
      const sugSubdomains = Array.isArray(sug.suggested_subdomains)
        ? sug.suggested_subdomains
        : [];

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
            ${sugSubdomains
              .map(
                (s) => `
              <span style="font-size: 11px; background: rgba(0,0,0,0.04); color: var(--text-main); padding: 1px 7px; border-radius: 4px; border: 1px solid var(--border-color);">
                ${escapeHtml(s.name)}
              </span>
            `,
              )
              .join("")}
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
        domainToAdd.id = generateUniqueDomainSlug(
          domainToAdd.id || domainToAdd.name,
        );
        if (Array.isArray(sug.suggested_subdomains)) {
          domainToAdd.subdomains = JSON.parse(
            JSON.stringify(sug.suggested_subdomains),
          );
        } else {
          domainToAdd.subdomains = [];
        }
        domainSubdomainsExpandedState.set(domainToAdd.id, false);
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
    const uniqueSlug = generateUniqueDomainSlug(`dominio-${idx}`);
    currentConfig.organization_domains.push({
      id: uniqueSlug,
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

  // Dismiss open color popovers when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".org-domain-color-btn") &&
      !e.target.closest(".color-palette-popover")
    ) {
      document.querySelectorAll(".color-palette-popover").forEach((p) => {
        p.style.display = "none";
      });
    }
  });

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
    if (btnLayersViewGrid)
      btnLayersViewGrid.classList.toggle("active", !isList);
    try {
      localStorage.setItem(
        STORAGE_KEY_LAYERS_VIEW_MODE,
        isList ? "list" : "grid",
      );
    } catch (e) {}
  }

  function initLayersViewMode() {
    if (btnLayersViewGrid) {
      btnLayersViewGrid.onclick = () => setLayersViewMode("grid");
    }
    if (btnLayersViewList) {
      btnLayersViewList.onclick = () => setLayersViewMode("list");
    }
    const savedMode =
      localStorage.getItem(STORAGE_KEY_LAYERS_VIEW_MODE) || "grid";
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

    // 1. Render Top Area (Selected Layers Grid)
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
            <span class="material-symbols-outlined icon-xs">add</span> Adicionar Camada
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
            layer.color ||
            DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
          layer.color = layerColor;
          const layerIcon = layer.icon || "layers";
          layer.icon = layerIcon;
          const layerNum =
            layer.layer_number !== undefined
              ? layer.layer_number
              : layer.weight !== undefined
                ? layer.weight - 1
                : index;
          const layerKey = layer.key || `L${layerNum}_LAYER`;
          layer.key = layerKey;

          card.innerHTML = `
            <div class="arch-layer-card-header">
              <div class="arch-layer-badge-wrap">
                <div class="arch-layer-drag-handle" title="Arraste para reorganizar o nível desta camada">
                  <span class="material-symbols-outlined">drag_indicator</span>
                </div>
                <div class="arch-layer-icon-wrap">
                  <div class="arch-layer-icon-badge" style="background: ${layerColor}18; color: ${layerColor};" title="Clique para escolher outro ícone na Biblioteca">
                    <span class="material-symbols-outlined">${layerIcon}</span>
                    <span class="icon-edit-hint material-symbols-outlined">edit</span>
                  </div>
                  <button class="arch-layer-color-btn" style="background: ${layerColor};" type="button" title="Alterar cor da camada"></button>
                  <div class="color-palette-popover" style="display: none;">
                    ${DOMAIN_COLOR_PALETTE.map(
                      (c) => `
                      <div class="color-swatch ${c === layerColor ? "active" : ""}" data-color="${c}" style="background: ${c};" title="${c}"></div>
                    `,
                    ).join("")}
                  </div>
                </div>
                <span class="arch-layer-number-pill" style="background: ${layerColor}22; color: ${layerColor};">
                  Camada ${layerNum}
                </span>
              </div>
              <button class="arch-layer-delete-btn" title="Remover esta camada do projeto" type="button">
                <span class="material-symbols-outlined icon-xs">close</span>
              </button>
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
              <div class="org-domain-slug-row">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">#</span>
                  <input
                    type="text"
                    class="arch-layer-slug-input"
                    value="${escapeHtml(layerKey)}"
                    placeholder="L${layerNum}_LAYER"
                    title="Identificador único (#slug/key) da camada"
                  />
                </div>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
                  Nível ${layerNum}
                </span>
              </div>
            </div>
          `;

          // Drag and Drop support for reordering layers with mouse
          card.setAttribute("draggable", "true");

          card.addEventListener("dragstart", (e) => {
            if (
              e.target.closest(
                "input, textarea, button, .color-palette-popover",
              )
            ) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.setData("text/plain", index.toString());
            e.dataTransfer.effectAllowed = "move";
            card.classList.add("is-dragging");
          });

          card.addEventListener("dragend", () => {
            if (layersGrid) {
              layersGrid.querySelectorAll(".arch-layer-card").forEach((c) => {
                c.classList.remove("is-dragging", "drag-over");
              });
            }
          });

          card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          });

          card.addEventListener("dragenter", (e) => {
            e.preventDefault();
            if (!card.classList.contains("is-dragging")) {
              card.classList.add("drag-over");
            }
          });

          card.addEventListener("dragleave", (e) => {
            if (!card.contains(e.relatedTarget)) {
              card.classList.remove("drag-over");
            }
          });

          card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("drag-over");
            const rawFrom = e.dataTransfer.getData("text/plain");
            const fromIdx = parseInt(rawFrom, 10);
            if (!isNaN(fromIdx) && fromIdx !== index) {
              reorderLayers(fromIdx, index);
            }
          });

          const nameInput = card.querySelector(".arch-layer-name-input");
          const descInput = card.querySelector(".arch-layer-desc-input");
          const rulesInput = card.querySelector(".arch-layer-rules-input");
          const deleteBtn = card.querySelector(".arch-layer-delete-btn");
          const slugInput = card.querySelector(".arch-layer-slug-input");
          const iconBadge = card.querySelector(".arch-layer-icon-badge");
          const colorBtn = card.querySelector(".arch-layer-color-btn");
          const colorPopover = card.querySelector(".color-palette-popover");

          // Icon Picker Trigger
          if (iconBadge) {
            iconBadge.onclick = (e) => {
              e.stopPropagation();
              IconPicker.open({
                currentIcon: layer.icon || "layers",
                onSelect: (newIcon) => {
                  layer.icon = newIcon;
                  renderLayers();
                  markDirty();
                },
              });
            };
          }

          // Color Picker Trigger
          if (colorBtn && colorPopover) {
            colorBtn.onclick = (e) => {
              e.stopPropagation();
              const isShown = colorPopover.style.display === "grid";
              document
                .querySelectorAll(".color-palette-popover")
                .forEach((p) => (p.style.display = "none"));
              colorPopover.style.display = isShown ? "none" : "grid";
            };

            colorPopover.querySelectorAll(".color-swatch").forEach((swatch) => {
              swatch.onclick = (e) => {
                e.stopPropagation();
                const chosen = swatch.dataset.color;
                if (chosen) {
                  layer.color = chosen;
                  renderLayers();
                  markDirty();
                }
              };
            });
          }

          // Slug / Key Input
          if (slugInput) {
            slugInput.addEventListener("input", () => {
              const clean = sanitizeSlug(slugInput.value)
                .toUpperCase()
                .replace(/-/g, "_");
              layer.key = clean;
              markDirty();
            });
          }

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
        addCard.title = "Clique para adicionar uma nova camada";
        addCard.innerHTML = `
          <div class="arch-layer-add-icon">
            <span class="material-symbols-outlined">add</span>
          </div>
          <span class="arch-layer-add-label">Adicionar Camada</span>
          <span class="arch-layer-add-hint">Ex: Camada 6 — Auditoria, FinOps, IA...</span>
        `;
        addCard.addEventListener("click", () => {
          addNewLayer();
        });

        // Drag target on addCard to move layer to the last position
        addCard.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        });
        addCard.addEventListener("dragenter", (e) => {
          e.preventDefault();
          addCard.classList.add("drag-over");
        });
        addCard.addEventListener("dragleave", (e) => {
          if (!addCard.contains(e.relatedTarget)) {
            addCard.classList.remove("drag-over");
          }
        });
        addCard.addEventListener("drop", (e) => {
          e.preventDefault();
          addCard.classList.remove("drag-over");
          const rawFrom = e.dataTransfer.getData("text/plain");
          const fromIdx = parseInt(rawFrom, 10);
          if (
            !isNaN(fromIdx) &&
            currentLayers.length > 0 &&
            fromIdx !== currentLayers.length - 1
          ) {
            reorderLayers(fromIdx, currentLayers.length - 1);
          }
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
            </div>
          </div>
          <p class="sug-card-desc" style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin: 4px 0 2px 0;">
            <strong>O que inclui:</strong> ${escapeHtml(sug.description)}
          </p>
          <p class="sug-card-rules" style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4; margin: 2px 0 0 0;">
            <strong>Regras:</strong> ${escapeHtml(sug.rules || "")}
          </p>
        </div>
        <div class="sug-card-action-col" style="margin-top: 10px; display: flex; align-items: center; justify-content: flex-end;">
          <button class="btn btn-sm btn-primary arch-layer-add-sug-btn" type="button" style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span class="material-symbols-outlined icon-xs">add</span>
            Adicionar
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

  // Reorder architecture layers via mouse drag and drop
  function reorderLayers(fromIndex, toIndex) {
    if (!currentConfig || !Array.isArray(currentConfig.layers)) return;
    const layers = currentConfig.layers;
    if (fromIndex < 0 || fromIndex >= layers.length) return;
    if (toIndex < 0 || toIndex >= layers.length) return;
    if (fromIndex === toIndex) return;

    const [movedLayer] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, movedLayer);

    // Recalculate layer_number sequentially so array order represents hierarchy (0=foundation, 1=next, ...)
    layers.forEach((layer, i) => {
      const oldNum = layer.layer_number !== undefined ? layer.layer_number : i;
      layer.layer_number = i;
      if (layer.key && layer.key.match(/^L\d+_/)) {
        layer.key = layer.key.replace(/^L\d+_/, `L${i}_`);
      }
      if (layer.label && layer.label.startsWith("Camada ")) {
        layer.label = `Camada ${i} — ${layer.name || ""}`;
      }
    });

    renderLayers();
    markDirty();
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

  // =============================================================================
  // POLÍTICAS, REGULAÇÃO & LEIS MANDATÓRIAS DO NEGÓCIO
  // =============================================================================
  const POLICY_PRESETS = {
    ecommerce: {
      regulators: ["ANPD (LGPD)", "Procon / CDC", "Sefaz (NFe / Tributário)", "Conar"],
      laws: "• Lei Geral de Proteção de Dados (Lei 13.709/2018)\n• Decreto do Comércio Eletrônico (Decreto 7.962/2013)\n• Código de Defesa do Consumidor (Lei 8.078/1990 - Art. 49)\n• Marco Civil da Internet (Lei 12.965/2014)",
      cancellation: "7 dias corridos a partir da entrega sem custos com devolução integral (CDC Art. 49)",
      refund: "Estorno imediato via Pix ou até 2 faturas no Cartão de Crédito",
      retention: "Notas Fiscais por 5 anos; Logs de acesso a aplicações por 6 meses (Marco Civil)",
      sla: "Atendimento em horário comercial (seg a sex) com resposta máxima em 24h úteis",
      dpo: "dpo@empresa.com",
      consent: "Opt-in explícito e desmarcado por padrão para envio de comunicações e marketing",
      sensitive_data: "Proibição estrita de armazenar CVV ou dados de cartão em texto puro (PCI-DSS); CPF e telefones mascarados em logs operacionais."
    },
    health: {
      regulators: ["CFM (Conselho Federal de Medicina)", "ANPD (LGPD Saúde)", "ANS (Saúde Suplementar)", "Anvisa"],
      laws: "• Resolução CFM nº 2.314/2022 (Regulamentação da Telemedicina no Brasil)\n• Lei Geral de Proteção de Dados (Lei 13.709/2018 - Tratamento de Dados Sensíveis de Saúde)\n• Lei de Digitalização e Guarda de Prontuários (Lei 13.787/2018)\n• Código de Ética Médica (Sigilo Profissional)",
      cancellation: "Cancelamento de teleconsulta com reembolso integral até 2h antes do horário agendado",
      refund: "Estorno via Pix em até 24h ou crédito imediato na plataforma",
      retention: "Guarda obrigatória de prontuários eletrônicos por no mínimo 20 anos (Lei 13.787/2018)",
      sla: "Suporte clínico e técnico disponível 24/7 com tempo de resposta máximo de 15 minutos em emergências",
      dpo: "dpo.saude@empresa.com",
      consent: "Termo de Consentimento Livre e Esclarecido (TCLE) obrigatório antes de qualquer teleatendimento",
      sensitive_data: "Dados de saúde, diagnósticos, receitas e exames são estritamente confidenciais; criptografia de ponta a ponta e proibição de exposição em logs."
    },
    fintech: {
      regulators: ["Bacen (Banco Central do Brasil)", "CVM", "ANPD", "COAF (Prevenção a Lavagem de Dinheiro)"],
      laws: "• Resoluções Bacen para Arranjos de Pagamento e Pix\n• Lei nº 9.613/1998 (Prevenção e Combate à Lavagem de Dinheiro - AML)\n• Padrão Internacional PCI-DSS (Segurança de Cartões)\n• Lei Geral de Proteção de Dados (Lei 13.709/2018)",
      cancellation: "Estorno de cobrança indevida em até 24h; Mecanismo Especial de Devolução (MED Pix)",
      refund: "Liquidado em D+0 para Pix e D+1 para liquidação bancária autorizada",
      retention: "Registros de transações financeiras e KYC arquivados por no mínimo 5 a 10 anos (Bacen/COAF)",
      sla: "Disponibilidade de autorização 99.99% com suporte a chargebacks em até 48h",
      dpo: "dpo.compliance@empresa.com",
      consent: "Autorização explícita de consulta ao SCR (Sistema de Informações de Crédito) e termos de uso bancário",
      sensitive_data: "Tokenização mandatória de PAN e credenciais bancárias; zero secrets em logs ou analytics."
    },
    saas: {
      regulators: ["ANPD (LGPD)", "GDPR (União Europeia)", "Marco Civil da Internet"],
      laws: "• Lei Geral de Proteção de Dados (Lei 13.709/2018)\n• General Data Protection Regulation (GDPR - EU 2016/679)\n• Normas ISO/IEC 27001 e SOC 2 Type II\n• Marco Civil da Internet (Lei 12.965/2014)",
      cancellation: "Cancelamento da assinatura a qualquer momento com vigência até o fim do ciclo faturado",
      refund: "Garantia de reembolso incondicional de 30 dias para novos clientes",
      retention: "Dados do cliente mantidos durante o contrato e expurgados 30 dias após encerramento definitivo",
      sla: "Disponibilidade de plataforma contratual de 99.9% com status page pública em tempo real",
      dpo: "privacy@empresa.com",
      consent: "Termos de Serviço e Acordo de Processamento de Dados (DPA) assinados digitalmente",
      sensitive_data: "Criptografia TLS 1.3 em trânsito e AES-256 em repouso; isolamento multi-tenant rígido."
    }
  };

  function updatePoliciesSummaryBadges() {
    const badgeRegulators = document.getElementById("badge-summary-regulators");
    if (badgeRegulators) {
      const count = currentRegulators.length;
      badgeRegulators.textContent = count === 1 ? "1 órgão" : `${count} órgãos`;
    }
  }

  function renderRegulatorsTags() {
    if (!regulatorsTagsList) return;
    regulatorsTagsList.innerHTML = "";
    updatePoliciesSummaryBadges();
    if (currentRegulators.length === 0) {
      regulatorsTagsList.innerHTML = '<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">Nenhum órgão regulador adicionado. Adicione acima ou selecione uma minuta rápida.</span>';
      return;
    }
    currentRegulators.forEach((reg, idx) => {
      const chip = document.createElement("div");
      chip.className = "policy-tag-chip";
      chip.innerHTML = `
        <span>${escapeHtml(reg)}</span>
        <span class="material-symbols-outlined policy-tag-remove" data-index="${idx}" title="Remover órgão">close</span>
      `;
      chip.querySelector(".policy-tag-remove").addEventListener("click", () => {
        removeRegulatorTag(idx);
      });
      regulatorsTagsList.appendChild(chip);
    });
  }

  function addRegulatorTag(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (!currentRegulators.includes(trimmed)) {
      currentRegulators.push(trimmed);
      renderRegulatorsTags();
      compilePoliciesMarkdown();
      markDirty();
    }
    if (inputAddRegulator) inputAddRegulator.value = "";
  }

  function removeRegulatorTag(idx) {
    if (idx >= 0 && idx < currentRegulators.length) {
      currentRegulators.splice(idx, 1);
      renderRegulatorsTags();
      compilePoliciesMarkdown();
      markDirty();
    }
  }

  function compilePoliciesMarkdown() {
    if (!inputPoliciesMarkdownPreview) return;
    const projName = inputName ? inputName.value.trim() : "Sistema";
    const regList = currentRegulators.length > 0 ? currentRegulators.join(", ") : "Conformidade Geral";
    const laws = inputPoliciesLaws ? inputPoliciesLaws.value.trim() : "";
    const canc = inputPoliciesCancellation ? inputPoliciesCancellation.value.trim() : "";
    const ref = inputPoliciesRefund ? inputPoliciesRefund.value.trim() : "";
    const ret = inputPoliciesRetention ? inputPoliciesRetention.value.trim() : "";
    const sla = inputPoliciesSla ? inputPoliciesSla.value.trim() : "";
    const dpo = inputPoliciesDpo ? inputPoliciesDpo.value.trim() : "";
    const cons = inputPoliciesConsent ? inputPoliciesConsent.value.trim() : "";
    const sens = inputPoliciesSensitiveData ? inputPoliciesSensitiveData.value.trim() : "";

    const md = `---
type: "policies"
version: "1.0.0"
status: "approved"
layer: "L0_FOUNDATION"
path: "project/policies.md"
dpo_contact: "${dpo}"
regulators: ${JSON.stringify(currentRegulators)}
---

# 📜 Políticas de Negócio, Regulação & Leis Mandatórias

> Este documento define os órgãos reguladores, marcos legais e restrições inegociáveis que o projeto **${projName}** deve obedecer.

---

## 🏛️ 1. Órgãos Reguladores & Marco Legal
- **Órgãos Fiscalizadores:** ${regList}
- **Leis & Normas Mandatórias:**
${laws || "Não especificado."}

---

## ⚖️ 2. Regras Mandatórias de Negócio (Hard Rules)
- **Direito de Arrependimento & Cancelamento:** ${canc || "Conforme legislação aplicável."}
- **Política de Estorno & Devolução Financeira:** ${ref || "Conforme termos de serviço."}
- **Retenção Legal de Dados & Documentos:** ${ret || "Conforme prazos legais."}
- **SLA & Atendimento ao Consumidor:** ${sla || "Conforme padrão de atendimento."}

---

## 🔒 3. Privacidade, Dados Pessoais & LGPD / GDPR
- **Encarregado de Dados (DPO):** ${dpo || "dpo@empresa.com"}
- **Consentimento & Opt-in:** ${cons || "Consentimento explícito e granular."}
- **Tratamento de Dados Sensíveis & Logs:**
${sens || "Proibição de dados sensíveis em logs e telemetria aberta."}
`.trim();

    inputPoliciesMarkdownPreview.value = md;
  }

  function applyPolicyPreset(key) {
    const preset = POLICY_PRESETS[key];
    if (!preset) return;
    currentRegulators = [...preset.regulators];
    renderRegulatorsTags();
    if (inputPoliciesLaws) inputPoliciesLaws.value = preset.laws;
    if (inputPoliciesCancellation) inputPoliciesCancellation.value = preset.cancellation;
    if (inputPoliciesRefund) inputPoliciesRefund.value = preset.refund;
    if (inputPoliciesRetention) inputPoliciesRetention.value = preset.retention;
    if (inputPoliciesSla) inputPoliciesSla.value = preset.sla;
    if (inputPoliciesDpo) inputPoliciesDpo.value = preset.dpo;
    if (inputPoliciesConsent) inputPoliciesConsent.value = preset.consent;
    if (inputPoliciesSensitiveData) inputPoliciesSensitiveData.value = preset.sensitive_data;
    compilePoliciesMarkdown();
    markDirty();
    if (onNotify) {
      onNotify(`Minuta de políticas para ${key.toUpperCase()} aplicada!`, "info");
    }
  }

  function clearPolicyPreset() {
    currentRegulators = [];
    renderRegulatorsTags();
    if (inputPoliciesLaws) inputPoliciesLaws.value = "";
    if (inputPoliciesCancellation) inputPoliciesCancellation.value = "";
    if (inputPoliciesRefund) inputPoliciesRefund.value = "";
    if (inputPoliciesRetention) inputPoliciesRetention.value = "";
    if (inputPoliciesSla) inputPoliciesSla.value = "";
    if (inputPoliciesDpo) inputPoliciesDpo.value = "";
    if (inputPoliciesConsent) inputPoliciesConsent.value = "";
    if (inputPoliciesSensitiveData) inputPoliciesSensitiveData.value = "";
    compilePoliciesMarkdown();
    markDirty();
  }

  // Bind Policies Action Buttons & Collapsible Headers
  const policyCollapsibleCards = document.querySelectorAll(".policy-collapsible-card");
  policyCollapsibleCards.forEach((card) => {
    const toggleHeader = card.querySelector(".policy-card-toggle-header");
    if (toggleHeader) {
      toggleHeader.addEventListener("click", () => {
        card.classList.toggle("collapsed");
      });
    }
  });

  if (btnAddRegulator && inputAddRegulator) {
    btnAddRegulator.addEventListener("click", () => {
      addRegulatorTag(inputAddRegulator.value);
    });
    inputAddRegulator.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addRegulatorTag(inputAddRegulator.value);
      }
    });
  }

  if (policyPresetBtns) {
    policyPresetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        applyPolicyPreset(btn.dataset.preset);
      });
    });
  }

  if (btnPolicyPresetClear) {
    btnPolicyPresetClear.addEventListener("click", () => {
      clearPolicyPreset();
    });
  }

  if (btnSyncPoliciesMd) {
    btnSyncPoliciesMd.addEventListener("click", () => {
      compilePoliciesMarkdown();
      markDirty();
      if (onNotify) {
        onNotify("Documento Markdown de políticas recompilado com sucesso!", "success");
      }
    });
  }

  if (btnOpenPoliciesEditor) {
    btnOpenPoliciesEditor.addEventListener("click", () => {
      window.location.hash = "#subview-editor";
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

    // Políticas & Regulação
    currentConfig.policies = {
      regulators: currentRegulators,
      laws: inputPoliciesLaws ? inputPoliciesLaws.value.trim() : "",
      cancellation_policy: inputPoliciesCancellation
        ? inputPoliciesCancellation.value.trim()
        : "",
      refund_policy: inputPoliciesRefund ? inputPoliciesRefund.value.trim() : "",
      retention_policy: inputPoliciesRetention
        ? inputPoliciesRetention.value.trim()
        : "",
      sla_support: inputPoliciesSla ? inputPoliciesSla.value.trim() : "",
      dpo_contact: inputPoliciesDpo ? inputPoliciesDpo.value.trim() : "",
      consent_policy: inputPoliciesConsent
        ? inputPoliciesConsent.value.trim()
        : "",
      sensitive_data_policy: inputPoliciesSensitiveData
        ? inputPoliciesSensitiveData.value.trim()
        : "",
      markdown_content: inputPoliciesMarkdownPreview
        ? inputPoliciesMarkdownPreview.value.trim()
        : "",
    };

    currentConfig.ai_assistant_prompt = projCopilot
      ? projCopilot.getActivePrompt()
      : currentConfig.ai_assistant_prompt || DEFAULT_ABOUT_AGENT_PROMPT;

    return currentConfig;
  }

  // Helper to generate real-time markdown summary of Project configuration for Global AI Copilot
  function getProjectSummaryContent() {
    const domains = (currentConfig?.organization_domains || []).map((d) => {
      const subs = (d.subdomains || [])
        .map((s) => `#${d.id}/${s.id} (${s.name})`)
        .join(", ");
      return `- **#${d.id}** (${d.name}): ${d.description || ""}${subs ? ` [Subdomínios: ${subs}]` : ""}`;
    });

    const layers = (currentConfig?.layers || []).map((l) => {
      return `- **Camada ${l.layer_number}** (${l.name || l.key}): ${l.description || ""} ${l.rules ? `(Regras: ${l.rules})` : ""}`;
    });

    return `
# Projeto: ${inputName ? inputName.value.trim() : "Sem nome"}
- **Padrão Arquitetural:** ${inputArchPattern ? inputArchPattern.value.trim() : "Clean Architecture & DDD"}
- **Versão:** ${inputVersion ? inputVersion.value.trim() : "1.0.0"}
- **Líder Técnico:** ${inputLead ? inputLead.value.trim() : "Não atribuído"}

## Canvas 5W2H de Fundação:
- **Por que fazemos? (Why):** ${input5w2hWhy ? input5w2hWhy.value.trim() : "Não preenchido"}
- **O que é o produto? (What):** ${input5w2hWhat ? input5w2hWhat.value.trim() : "Não preenchido"}
- **Onde se aplica? (Where):** ${input5w2hWhere ? input5w2hWhere.value.trim() : "Não preenchido"}
- **Quando? (When):** ${input5w2hWhen ? input5w2hWhen.value.trim() : "Não preenchido"}
- **Quem são os responsáveis? (Who):** ${input5w2hWho ? input5w2hWho.value.trim() : "Não preenchido"}
- **Como construímos? (How):** ${input5w2hHow ? input5w2hHow.value.trim() : "Não preenchido"}
- **Quanto custa / Métricas? (How Much):** ${input5w2hHowMuch ? input5w2hHowMuch.value.trim() : "Não preenchido"}

## Domínios & Bounded Contexts (${domains.length}):
${domains.length > 0 ? domains.join("\n") : "- Nenhum domínio configurado ainda."}

## Camadas de Arquitetura & Governança (${layers.length}):
${layers.length > 0 ? layers.join("\n") : "- Nenhuma camada configurada ainda."}

## Políticas & Regulação do Negócio:
- **Órgãos Fiscalizadores:** ${currentRegulators.length > 0 ? currentRegulators.join(", ") : "Não informado"}
- **Leis & Normas:** ${inputPoliciesLaws ? inputPoliciesLaws.value.trim() : "Não informado"}
- **Arrependimento / Cancelamento:** ${inputPoliciesCancellation ? inputPoliciesCancellation.value.trim() : "Não informado"}
- **Retenção de Dados:** ${inputPoliciesRetention ? inputPoliciesRetention.value.trim() : "Não informado"}
- **DPO / Privacidade:** ${inputPoliciesDpo ? inputPoliciesDpo.value.trim() : "Não informado"}
    `.trim();
  }

  // Helper to get currently active tab key
  function getCurrentActiveTab() {
    const activeBtn = document.querySelector(".project-tab-btn.active");
    if (!activeBtn) return "about";
    return activeBtn.dataset.tab === "taxonomy"
      ? "architecture"
      : activeBtn.dataset.tab;
  }

  // Request tab switch with unsaved changes prompt
  function requestTabSwitch(targetTab) {
    const canonicalTarget =
      targetTab === "taxonomy" ? "architecture" : targetTab;
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
      } else if (fromTab === "governance" || fromTab === "policies") {
        modalUnsavedMsg.innerHTML =
          "Você alterou as <strong>Políticas de Negócio, Órgãos Reguladores e Marcos Legais</strong>. Deseja salvar o documento <code>project/policies.md</code> no Git antes de mudar de aba?";
        modalUnsavedHint.innerHTML =
          "📜 <strong>Dica:</strong> Salve agora para sincronizar as regras mandatórias do negócio e guardrails para a IA no repositório.";
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
      const ok = await saveConfigInternal(
        "Alterações salvas com sucesso no Git!",
      );
      btnUnsavedSave.disabled = false;
      btnUnsavedSave.innerHTML =
        '<span class="material-symbols-outlined icon-xs">save</span> Salvar & Avançar';
      closeUnsavedModal();
      if (ok && target) {
        switchToTab(target);
      }
    });
  }

  // Helper to silently sync tab in the URL address bar without triggering SPA route reloads
  function updateUrlTab(tabKey) {
    try {
      const hash = window.location.hash || "";
      const qIdx = hash.indexOf("?");
      const basePath = qIdx !== -1 ? hash.substring(0, qIdx) : hash;
      const newHash = `${basePath}?tab=${encodeURIComponent(tabKey)}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, "", newHash);
      }
    } catch (e) {
      // silent fallback
    }
  }

  // Switch to specific tab helper
  function switchToTab(targetTab, updateUrl = true) {
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

    if (updateUrl) {
      updateUrlTab(canonicalTab);
    }

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
    btnNavDomainsPrev.addEventListener("click", () =>
      requestTabSwitch("about"),
    );
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
        "Camadas de Arquitetura salvas no Git! Avançando para Políticas & Regulação...",
      );
      btnNavArchNext.disabled = false;
      btnNavArchNext.innerHTML =
        'Salvar & Avançar para Políticas & Regulação <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("governance");
    });
  }

  if (btnNavGovPrev) {
    btnNavGovPrev.addEventListener("click", () =>
      requestTabSwitch("architecture"),
    );
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
    getProjectSummaryContent,
    DEFAULT_ABOUT_AGENT_PROMPT,
  };
}

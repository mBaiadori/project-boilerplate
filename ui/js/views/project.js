// =============================================================================
// VIEW MODULE: COCKPIT DE FUNDAÇÃO & SETUP DO PROJETO (PROJECT HUB)
// =============================================================================
import { API } from "../api.js";
import { AIChatCopilot } from "../components/ai-chat-copilot.js";

export function initProjectView({ onConfigSaved, onNotify }) {
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
    },
    {
      id: "marketing",
      name: "Marketing",
      icon: "campaign",
      color: "#f59e0b",
      description:
        "Aquisição de clientes, campanhas digitais, branding, funil de conversão, comunicação e growth.",
      responsibles: [],
    },
    {
      id: "administrativo",
      name: "Administrativo",
      icon: "corporate_fare",
      color: "#6366f1",
      description:
        "Governança corporativa, facilities, gestão de contratos, compliance regulatório e rotinas internas.",
      responsibles: [],
    },
    {
      id: "operacional",
      name: "Operacional",
      icon: "settings_suggest",
      color: "#0ea5e9",
      description:
        "Execução de processos operacionais, logística, atendimento ao cliente, suporte e controle de SLAs.",
      responsibles: [],
    },
    {
      id: "engenharia",
      name: "Engenharia",
      icon: "terminal",
      color: "#8b5cf6",
      description:
        "Desenvolvimento de software, arquitetura de sistemas, infraestrutura em nuvem, DevOps e segurança.",
      responsibles: [],
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

  // Form Fields: Taxonomia & Tags
  const tagsContainer = document.getElementById("proj-tags-chips-container");
  const inputNewTag = document.getElementById("proj-input-new-tag");
  const btnAddTag = document.getElementById("btn-proj-add-tag");
  const stagesContainer = document.getElementById("proj-stages-container");

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

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePane = document.getElementById(`pane-proj-${targetTab}`);
      if (activePane) activePane.classList.add("active");
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
    if (
      !cfg.organization_domains ||
      !Array.isArray(cfg.organization_domains) ||
      cfg.organization_domains.length === 0
    ) {
      cfg.organization_domains = JSON.parse(
        JSON.stringify(DEFAULT_ORG_DOMAINS),
      );
    }
    renderDomains(cfg.organization_domains);

    // Taxonomia & Tags
    renderTags(cfg.tags || []);

    // Esteira de Etapas
    renderStages(cfg.lifecycle_stages || []);

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

  // Render Organization Domains Cards Grid with Responsibles Selector and Framework Suggestions
  function renderDomains(domains = []) {
    if (!domainsGrid) return;
    domainsGrid.innerHTML = "";

    const currentDomains = Array.isArray(domains) ? domains : [];
    const unaddedSuggestions = DEFAULT_ORG_DOMAINS.filter(
      (sug) =>
        !currentDomains.some(
          (d) =>
            d.id === sug.id ||
            (d.name && d.name.toLowerCase() === sug.name.toLowerCase()),
        ),
    );

    // Empty state with quick suggestion cards if no domain added yet
    if (currentDomains.length === 0) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "org-domains-empty-suggestions";
      emptyBox.style.cssText =
        "grid-column: 1 / -1; background: var(--bg-surface, #f8fafc); border: 1.5px dashed var(--border-color, #cbd5e1); border-radius: 12px; padding: 22px 20px; text-align: center; margin-bottom: 8px;";
      emptyBox.innerHTML = `
        <div style="font-size: 15px; font-weight: 600; color: var(--text-normal); margin-bottom: 5px;">
          Nenhum domínio configurado no projeto ainda
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px 0; max-width: 540px; margin-left: auto; margin-right: auto; line-height: 1.45;">
          O repositório inicia limpo. Você pode criar áreas sob medida ou adicionar as sugestões recomendadas pelo framework:
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 14px;">
          ${DEFAULT_ORG_DOMAINS.map(
            (s) => `
            <button type="button" class="btn btn-secondary btn-sm btn-quick-add-sug" data-sug-id="${s.id}" style="display: inline-flex; align-items: center; gap: 6px; border-radius: 20px; font-size: 12px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: ${s.color};">${s.icon}</span>
              + ${escapeHtml(s.name)}
            </button>
          `,
          ).join("")}
        </div>
        <button type="button" id="btn-import-all-sug" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined icon-xs">playlist_add</span>
          Importar Todas as Sugestões Padrão
        </button>
      `;

      emptyBox.querySelectorAll(".btn-quick-add-sug").forEach((btn) => {
        btn.addEventListener("click", () => {
          addSuggestedDomain(btn.dataset.sugId);
        });
      });

      const btnImportAll = emptyBox.querySelector("#btn-import-all-sug");
      if (btnImportAll) {
        btnImportAll.addEventListener("click", () => {
          importAllSuggestedDomains();
        });
      }

      domainsGrid.appendChild(emptyBox);
    } else if (unaddedSuggestions.length > 0) {
      // Suggestion bar at top if some suggestions remain available
      const sugBar = document.createElement("div");
      sugBar.style.cssText =
        "grid-column: 1 / -1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 8px; padding: 8px 12px; font-size: 12px;";
      sugBar.innerHTML = `
        <span class="material-symbols-outlined icon-xs" style="color: var(--primary, #6366f1); font-size: 16px;">lightbulb</span>
        <span style="color: var(--text-normal); font-weight: 600;">Sugestões do framework disponíveis:</span>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; flex: 1;">
          ${unaddedSuggestions
            .map(
              (s) => `
            <button type="button" class="btn btn-ghost btn-xs btn-quick-add-sug" data-sug-id="${s.id}" style="padding: 2px 8px; font-size: 11.5px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 12px;">
              + ${escapeHtml(s.name)}
            </button>
          `,
            )
            .join("")}
        </div>
      `;
      sugBar.querySelectorAll(".btn-quick-add-sug").forEach((btn) => {
        btn.addEventListener("click", () => {
          addSuggestedDomain(btn.dataset.sugId);
        });
      });
      domainsGrid.appendChild(sugBar);
    }

    currentDomains.forEach((d, index) => {
      const card = document.createElement("div");
      card.className = "org-domain-card";
      card.dataset.index = index;

      const domainColor =
        d.color || DOMAIN_COLOR_PALETTE[index % DOMAIN_COLOR_PALETTE.length];
      const domainIcon = d.icon || "domain";
      const responsibles = Array.isArray(d.responsibles) ? d.responsibles : [];

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
          <div class="org-domain-icon-badge" style="background: ${domainColor}18; color: ${domainColor};">
            <span class="material-symbols-outlined">${domainIcon}</span>
          </div>
          <button class="org-domain-delete-btn" title="Remover este domínio" type="button">
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
          rows="3"
          placeholder="O que este domínio cuida e quais são suas responsabilidades?"
        >${escapeHtml(d.description || "")}</textarea>

        <!-- Responsibles / Team Section -->
        <div class="org-domain-responsibles-section">
          <div class="org-domain-responsibles-header">
            <select class="org-domain-assign-dropdown">
              ${memberOptionsHtml}
            </select>
          </div>
          <div class="org-domain-members-chips">
            ${membersChipsHtml}
          </div>
        </div>

        <div class="org-domain-card-footer">
          <span class="org-domain-slug-pill">#${escapeHtml(d.id || (d.name || "").toLowerCase().replace(/[^a-z0-9]/g, "-"))}</span>
        </div>
      `;

      const nameInput = card.querySelector(".org-domain-name-input");
      const descInput = card.querySelector(".org-domain-desc-input");
      const deleteBtn = card.querySelector(".org-domain-delete-btn");
      const slugPill = card.querySelector(".org-domain-slug-pill");
      const assignDropdown = card.querySelector(".org-domain-assign-dropdown");

      nameInput.addEventListener("input", () => {
        d.name = nameInput.value;
        const autoId = d.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-");
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

      // Remove Responsible Chip listener
      card.querySelectorAll(".org-domain-member-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const rIdx = parseInt(btn.dataset.ridx, 10);
          if (!Array.isArray(d.responsibles)) d.responsibles = [];
          d.responsibles.splice(rIdx, 1);
          renderDomains(currentDomains);
          markDirty();
        });
      });

      // Assign Dropdown Listener
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
                renderDomains(currentDomains);
                markDirty();
              }
            }
          } else {
            if (!d.responsibles.includes(val)) {
              d.responsibles.push(val);
              renderDomains(currentDomains);
              markDirty();
            }
          }
        });
      }

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentDomains.splice(index, 1);
        renderDomains(currentDomains);
        markDirty();
      });

      domainsGrid.appendChild(card);
    });

    // Add Domain dashed card at the end of the grid
    const addCard = document.createElement("div");
    addCard.className = "org-domain-card org-domain-card-add";
    addCard.title = "Clique para adicionar um novo domínio";
    addCard.innerHTML = `
      <div class="org-domain-add-icon">
        <span class="material-symbols-outlined">add</span>
      </div>
      <span class="org-domain-add-label">Adicionar Novo Domínio</span>
      <span class="org-domain-add-hint">Ex: Vendas, Jurídico, RH, Billing...</span>
    `;
    addCard.addEventListener("click", () => {
      addNewDomain();
    });
    domainsGrid.appendChild(addCard);
  }

  function addSuggestedDomain(sugId) {
    const sug = DEFAULT_ORG_DOMAINS.find((s) => s.id === sugId);
    if (!sug) return;
    if (!currentConfig) currentConfig = {};
    if (!Array.isArray(currentConfig.organization_domains)) {
      currentConfig.organization_domains = [];
    }
    currentConfig.organization_domains.push(JSON.parse(JSON.stringify(sug)));
    renderDomains(currentConfig.organization_domains);
    markDirty();
  }

  function importAllSuggestedDomains() {
    if (!currentConfig) currentConfig = {};
    currentConfig.organization_domains = JSON.parse(
      JSON.stringify(DEFAULT_ORG_DOMAINS),
    );
    renderDomains(currentConfig.organization_domains);
    markDirty();
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
    });
    renderDomains(currentConfig.organization_domains);
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

  // Render Tags
  function renderTags(tags) {
    if (!tagsContainer) return;
    tagsContainer.innerHTML = "";

    tags.forEach((tag, idx) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `
        #${escapeHtml(tag)}
        <button class="tag-chip-remove" data-index="${idx}" title="Remover tag">×</button>
      `;

      chip.querySelector(".tag-chip-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        tags.splice(idx, 1);
        renderTags(tags);
        markDirty();
      });

      tagsContainer.appendChild(chip);
    });
  }

  // Add Tag Action
  function handleAddTag() {
    if (!inputNewTag) return;
    const val = inputNewTag.value.trim().replace(/^#/, "").toLowerCase();
    if (!val) return;

    if (!currentConfig) currentConfig = {};
    if (!currentConfig.tags) currentConfig.tags = [];

    if (!currentConfig.tags.includes(val)) {
      currentConfig.tags.push(val);
      renderTags(currentConfig.tags);
      markDirty();
    }
    inputNewTag.value = "";
  }

  if (btnAddTag) btnAddTag.addEventListener("click", handleAddTag);
  if (inputNewTag) {
    inputNewTag.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    });
  }

  // Render Lifecycle Stages
  function renderStages(stages) {
    if (!stagesContainer) return;
    stagesContainer.innerHTML = "";

    stages.forEach((st) => {
      const card = document.createElement("div");
      card.className = "pipeline-stage-card";
      card.innerHTML = `
        <div class="pipeline-stage-info">
          <strong>${escapeHtml(st.label)}</strong>
          <span>${escapeHtml(st.file)}</span>
        </div>
        <span class="pill-dot success" style="font-size: 11px;">Ativa</span>
      `;
      stagesContainer.appendChild(card);
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

    currentConfig.organization_domains =
      currentConfig.organization_domains || DEFAULT_ORG_DOMAINS;

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
  function syncProjAiTriggerVisibility() {
    if (!btnToggleProjAi || !projAiPane) return;
    const isCollapsed = projAiPane.classList.contains("collapsed") || projAiPane.style.display === "none";
    btnToggleProjAi.style.display = isCollapsed ? "inline-flex" : "none";
    btnToggleProjAi.classList.toggle("active", !isCollapsed);
  }

  if (btnToggleProjAi && projAiPane) {
    btnToggleProjAi.addEventListener("click", () => {
      projAiPane.classList.remove("collapsed");
      projAiPane.style.display = "flex";
      if (resizerProjAi) resizerProjAi.classList.remove("collapsed");
      syncProjAiTriggerVisibility();
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
      getRepoName: () => (activeRepo ? activeRepo.name : "default"),
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
        projAiPane.classList.add("collapsed");
        projAiPane.style.display = "none";
        if (resizerProjAi) resizerProjAi.classList.add("collapsed");
        syncProjAiTriggerVisibility();
      },
    });

    syncProjAiTriggerVisibility();
  }

  // Switch to specific tab helper
  function switchToTab(targetTab) {
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    const btn = document.querySelector(
      `.project-tab-btn[data-tab="${targetTab}"]`,
    );
    if (btn) btn.classList.add("active");

    const activePane = document.getElementById(`pane-proj-${targetTab}`);
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
  const btnNavTaxPrev = document.getElementById("btn-nav-tax-prev");
  const btnNavTaxNext = document.getElementById("btn-nav-tax-next");
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
    btnNavDomainsPrev.addEventListener("click", () => switchToTab("about"));
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
        'Salvar & Avançar para Taxonomia <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("taxonomy");
    });
  }

  if (btnNavTaxPrev) {
    btnNavTaxPrev.addEventListener("click", () => switchToTab("domains"));
  }

  if (btnNavTaxNext) {
    btnNavTaxNext.addEventListener("click", async () => {
      btnNavTaxNext.disabled = true;
      btnNavTaxNext.innerHTML = "Salvando no Git...";
      const ok = await saveConfigInternal(
        "Taxonomia salva no Git! Avançando para Políticas IA...",
      );
      btnNavTaxNext.disabled = false;
      btnNavTaxNext.innerHTML =
        'Salvar & Avançar para Políticas IA <span class="material-symbols-outlined icon-xs">arrow_forward</span>';
      if (ok) switchToTab("governance");
    });
  }

  if (btnNavGovPrev) {
    btnNavGovPrev.addEventListener("click", () => switchToTab("taxonomy"));
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
        "Deseja restaurar as configurações do projeto para o Padrão Recomendado pelo Framework (L1–L6, Definições Estratégicas e Taxonomia padrão)? As alterações atuais serão substituídas.",
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

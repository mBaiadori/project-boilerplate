// =============================================================================
// COMPONENT: UNIVERSAL AI CHAT COPILOT WITH AUTOMATIC CONTINUOUS MEMORY
// =============================================================================
import { API } from "../api.js";
import { DraftStoreService } from "../draft-store.js";
import { ChatMemoryStoreService } from "../services/chat-memory-store.js";

/**
 * Universal Reusable AI Chat Copilot Component
 *
 * Standardizes AI assistance across all platform modules (Workbench, About, Templates, etc.):
 * - 100% Automatic continuous memory backed by Git (.spec-memory/) & IndexedDB cache.
 * - Single-click access to Sidebars (Parameters/Model/Prompt and Reasoning/History).
 * - Minimalist, elegant header: Agent Pill + Green Memory Status Dot + History + Close.
 * - Always grounds prompt execution in the active document context + prior Handoffs.
 * - Multi-user attribution (who iterated, when, and with what model).
 * - Markdown rendering with Code Copy and Direct Insert / Apply buttons.
 * - Quick suggestion chips and Draft store persistence.
 */
const DEFAULT_COPILOT_CHIPS = [
  {
    label: "💡 Sugerir Melhorias",
    prompt:
      "Analise o contexto deste documento e sugira melhorias técnicas, funcionais e de negócio.",
  },
  {
    label: "🏛️ Diretrizes DDD",
    prompt:
      "Audite e recomende padrões de arquitetura DDD, limites de contexto e invariantes.",
  },
  {
    label: "📊 Diagrama Mermaid",
    prompt:
      "Gere um diagrama Mermaid visual representando o fluxo ou arquitetura deste documento.",
  },
  {
    label: "📋 Revisar Seções",
    prompt:
      "Revise a completude do documento e aponte possíveis inconsistências ou lacunas.",
  },
];

export class AIChatCopilot {
  constructor(options = {}) {
    this.container =
      typeof options.container === "string"
        ? document.querySelector(options.container)
        : options.container;

    this.resizer =
      typeof options.resizer === "string"
        ? document.querySelector(options.resizer)
        : options.resizer;

    this.storageKey = options.storageKey || "copilot_chat_width";
    this.contextPath = options.contextPath || "index.md";
    this.agentName = options.agentName || "Antigravity Agent";
    this.agentIcon = options.agentIcon || "";
    this.modelName = options.modelName || "gemini-3.5-flash";
    this.defaultSystemPrompt = (options.defaultSystemPrompt || "").trim();
    this.customSystemPrompt = (options.customSystemPrompt || "").trim();
    this.getContent = options.getContent || (() => "");
    this.chips =
      Array.isArray(options.chips) && options.chips.length > 0
        ? options.chips
        : DEFAULT_COPILOT_CHIPS;
    this.welcomeMessage =
      options.welcomeMessage ||
      "Pareando com você no documento ativo. Como posso ajudar na modelagem, refinamento ou especificações?";
    this.onPromptSaved = options.onPromptSaved || null;
    this.onPromptRestored = options.onPromptRestored || null;
    this.onApplyContent = options.onApplyContent || null;
    this.onClose = options.onClose || null;
    this.getRepoName = options.getRepoName || (() => "default");

    this.chatHistory = [];
    this.rawHistory = [];
    this.sessionId = ChatMemoryStoreService.generateSessionId(this.contextPath);
    this.isPromptSidebarOpen = false;
    this.isHistorySidebarOpen = false;
    this.isRawSidebarOpen = false;
    this.lastRawPayload = null;
    this.lastRawResponse = null;
    this.currentAuthor = null;
    this.currentBriefing = "";

    if (this.container) {
      this.render();
      this.bindEvents();
      this.initResizer();
      this.loadMemoryForContext();
    }
  }

  /**
   * Safely resolves current repo name with fallback to 'default'
   */
  getResolvedRepoName() {
    try {
      if (typeof this.getRepoName === "function") {
        return this.getRepoName() || "default";
      }
      return this.getRepoName || "default";
    } catch (e) {
      console.warn("Could not resolve repo name:", e);
      return "default";
    }
  }

  /**
   * Returns active system prompt (custom if set, otherwise default)
   */
  getActivePrompt() {
    return this.customSystemPrompt || this.defaultSystemPrompt;
  }

  /**
   * Checks if custom prompt is active
   */
  isCustomActive() {
    return Boolean(
      this.customSystemPrompt &&
      this.customSystemPrompt !== this.defaultSystemPrompt,
    );
  }

  /**
   * Updates context dynamically when switching document, tab or template
   */
  async setContext(opts = {}) {
    const prevContextPath = this.contextPath;
    const prevRepo = this.getResolvedRepoName();
    const prevSessionId = this.sessionId;

    // Asynchronously finalize previous session if there were messages
    if (this.chatHistory.length > 0 && prevContextPath !== (opts.contextPath || prevContextPath)) {
      API.finalizeMemorySession({
        repo: prevRepo,
        path: prevContextPath,
        session_id: prevSessionId,
      }).catch((e) => console.warn("Background session finalize failed:", e));
    }

    if (opts.contextPath !== undefined) this.contextPath = opts.contextPath;
    if (opts.agentName !== undefined) this.agentName = opts.agentName;
    if (opts.agentIcon !== undefined) this.agentIcon = opts.agentIcon;
    if (opts.modelName !== undefined) this.modelName = opts.modelName;
    if (opts.defaultSystemPrompt !== undefined)
      this.defaultSystemPrompt = (opts.defaultSystemPrompt || "").trim();
    if (opts.customSystemPrompt !== undefined)
      this.customSystemPrompt = (opts.customSystemPrompt || "").trim();
    if (opts.getContent !== undefined) this.getContent = opts.getContent;
    if (opts.chips !== undefined) {
      this.chips =
        Array.isArray(opts.chips) && opts.chips.length > 0
          ? opts.chips
          : DEFAULT_COPILOT_CHIPS;
    }
    if (opts.onPromptSaved !== undefined)
      this.onPromptSaved = opts.onPromptSaved;
    if (opts.onPromptRestored !== undefined)
      this.onPromptRestored = opts.onPromptRestored;
    if (opts.onApplyContent !== undefined)
      this.onApplyContent = opts.onApplyContent;
    if (opts.welcomeMessage !== undefined)
      this.welcomeMessage = opts.welcomeMessage;

    this.sessionId = ChatMemoryStoreService.generateSessionId(this.contextPath);

    this.updateHeaderUI();
    this.updatePromptDrawerUI();
    this.renderChips();

    // Restore draft if available for new context
    if (
      this.domInputField &&
      DraftStoreService &&
      DraftStoreService.getChatDraft
    ) {
      const draft = DraftStoreService.getChatDraft(
        this.getRepoName(),
        this.contextPath,
      );
      this.domInputField.value = draft || "";
    }

    if (opts.resetHistory) {
      this.resetChat();
    } else {
      await this.loadMemoryForContext();
    }
  }

  /**
   * Loads cached memory & Handoff briefing for the active document
   */
  async loadMemoryForContext() {
    const repo = this.getResolvedRepoName();
    const path = this.contextPath;

    try {
      // 1. Load active session from local IndexedDB cache
      const cached = await ChatMemoryStoreService.loadSession(repo, path);
      if (cached && Array.isArray(cached.history) && cached.history.length > 0) {
        this.chatHistory = cached.history;
        this.sessionId = cached.sessionId || this.sessionId;
        this.renderHistoryStream();
      } else {
        this.resetChat();
      }

      // 2. Fetch server memory brief and actor
      const { ok, data } = await API.getMemoryBrief({ repo, path });
      if (ok && data) {
        this.currentBriefing = data.briefing || "";
        this.currentAuthor = data.actor || null;
        this.updateHeaderUI();
      }

      // If history sidebar is currently open, refresh its content
      if (this.isHistorySidebarOpen) {
        this.loadHistorySidebarContent();
      }
      if (this.isRawSidebarOpen) {
        this.loadRawSidebarContent();
      }
    } catch (err) {
      console.warn("Could not load context memory:", err);
    }
  }

  /**
   * Renders the complete unified markup matching workbench standard
   */
  render() {
    this.container.innerHTML = `
      <!-- Header: Agent Pill Button, Memory Dot, RAW, History & Close Control -->
      <div class="ai-pane-header">
        <div class="ai-copilot-agent-wrapper" style="display: flex; align-items: center; gap: 6px; min-width: 0;">
          <button class="ai-copilot-agent-btn" type="button" title="Clique para configurar o modelo e editar o pré-prompt deste agente">
            <span class="material-symbols-outlined icon-xs ai-copilot-agent-icon">${this.escapeHtml(this.agentIcon)}</span>
            <span class="ai-copilot-agent-name">${this.escapeHtml(this.agentName)}</span>
            <span class="material-symbols-outlined icon-xs ai-copilot-chevron">tune</span>
          </button>
        </div>

        <div class="ai-copilot-header-right" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button 
            class="ai-copilot-memory-dot-btn" 
            type="button" 
            title="Memória Contínua no Git Ativa (.spec-memory/)&#10;Clique para ver a linha de raciocínio, sessões e handoffs gravados."
          >
            <span class="ai-copilot-memory-dot"></span>
          </button>
          <button class="ai-copilot-raw-btn" title="Inspetor RAW (Ver Prompts, Memória e Payloads na Íntegra)" type="button">
            RAW
          </button>
          <button class="btn-icon ai-copilot-history-btn" title="Linha de Raciocínio & Histórico de Sessões" type="button">
            <span class="material-symbols-outlined icon-sm">history</span>
          </button>
          <button class="btn-icon ai-copilot-close-btn" title="Recolher Assistente" type="button">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <!-- Scrollable Message History Stream -->
      <div class="ai-messages-scroll ai-copilot-messages-container">
        <div class="chat-bubble ai">
          <div class="chat-bubble-sender">
            <span class="material-symbols-outlined icon-xs">${this.escapeHtml(this.agentIcon)}</span>
            <strong>${this.escapeHtml(this.agentName)}</strong>
          </div>
          <div class="ai-reply-content">${this.renderMarkdown(this.welcomeMessage)}</div>
        </div>
      </div>

      <!-- Quick Suggestion Chips -->
      <div class="ai-chips-container ai-copilot-chips-container"></div>

      <!-- Prompt Input Area -->
      <div class="ai-input-wrapper ai-copilot-input-wrapper">
        <input 
          type="text" 
          class="ai-copilot-input-field" 
          placeholder="Peça sugestões, diagramas ou refinamento..." 
        />
        <button class="btn btn-primary btn-sm ai-copilot-send-btn" type="button">
          Enviar
        </button>
      </div>
    `;

    this.renderPromptSidebar();
    this.renderHistorySidebar();
    this.renderRawSidebar();
    this.renderChips();
  }

  /**
   * Renders the dedicated full-height parameters & system prompt sidebar
   */
  renderPromptSidebar() {
    if (!this.container || !this.container.parentNode) return;

    let sidebar = this.container.parentNode.querySelector(
      `.ai-copilot-prompt-sidebar[data-copilot-for="${this.storageKey}"]`,
    );
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "ai-copilot-prompt-sidebar";
      sidebar.dataset.copilotFor = this.storageKey;
      sidebar.style.display = "none";

      const insertTarget = this.resizer || this.container;
      this.container.parentNode.insertBefore(sidebar, insertTarget);
    }

    sidebar.innerHTML = `
      <div class="ai-prompt-sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span class="material-symbols-outlined icon-sm" style="color: var(--primary, #2563eb); flex-shrink: 0;">tune</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <strong style="font-size: 13px; color: var(--text-heading, #0f172a); white-space: nowrap;">Parâmetros & Pré-Prompt</strong>
            <span style="font-size: 11px; color: var(--text-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              Context OS &bull; <span class="ai-copilot-prompt-agent-tag">${this.escapeHtml(this.agentName)}</span>
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button class="btn-icon ai-copilot-close-prompt-sidebar-btn" type="button" title="Fechar painel de parâmetros">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>
      
      <div class="ai-prompt-sidebar-body" style="padding: 14px; display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto; min-height: 0; overflow: hidden; background: #ffffff;">
        
        <!-- Model Selection Block -->
        <div style="padding: 10px 12px; background: var(--bg-hover, #f8fafc); border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;">
          <div>
            <div style="font-size: 10px; color: var(--text-muted, #64748b); font-weight: 600; text-transform: uppercase;">Modelo de IA Ativo</div>
            <strong class="ai-copilot-model-name-label" style="font-size: 12.5px; color: var(--primary, #2563eb);">${this.escapeHtml(this.modelName)}</strong>
          </div>
          <button class="btn btn-secondary btn-xs ai-copilot-open-ai-modal-btn" type="button" style="display: inline-flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined icon-xs">tune</span> Configurar
          </button>
        </div>

        <!-- Prompt Description (Full Height Flex Container) -->
        <div style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; gap: 6px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-heading); margin-bottom: 0;">Instruções & Persona do Agente:</label>
            <span class="ai-copilot-status-badge ${this.isCustomActive() ? "custom" : "preset"}" style="font-size: 10px;">
              ${this.isCustomActive() ? "CUSTOMIZADO" : "PADRÃO"}
            </span>
          </div>
          <p class="ai-copilot-prompt-hint" style="font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4; flex-shrink: 0;">
            Diretrizes mestras que este agente utiliza para raciocinar e interagir neste documento:
          </p>
          <textarea class="ai-copilot-prompt-textarea" style="width: 100%; flex: 1 1 auto; min-height: 0; height: 100%; padding: 12px; border: 1px solid var(--border-color, #cbd5e1); border-radius: 8px; font-size: 12px; line-height: 1.5; font-family: var(--font-mono, monospace); resize: none; box-sizing: border-box; background: #f8fafc; outline: none;" spellcheck="false">${this.escapeHtml(this.getActivePrompt())}</textarea>
        </div>
      </div>

      <div class="ai-prompt-sidebar-footer" style="padding: 10px 14px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--bg-hover);">
        <button class="ai-copilot-restore-btn btn-link-subtle" type="button" style="font-size: 11.5px;" title="Restaurar prompt original recomendado pelo framework">
          Restaurar Padrão
        </button>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="ai-copilot-prompt-feedback" style="font-size: 11px;"></span>
          <button class="btn btn-primary btn-xs ai-copilot-save-prompt-btn" type="button" style="display: inline-flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined icon-xs">save</span> Salvar no Projeto
          </button>
        </div>
      </div>
    `;

    this.domPromptSidebar = sidebar;
    this.domPromptTextarea = sidebar.querySelector(
      ".ai-copilot-prompt-textarea",
    );
    this.domSavePromptBtn = sidebar.querySelector(
      ".ai-copilot-save-prompt-btn",
    );
    this.domRestorePromptBtn = sidebar.querySelector(".ai-copilot-restore-btn");
    this.domPromptFeedback = sidebar.querySelector(
      ".ai-copilot-prompt-feedback",
    );
    this.domClosePromptSidebarBtn = sidebar.querySelector(
      ".ai-copilot-close-prompt-sidebar-btn",
    );
    this.domOpenAIModalBtn = sidebar.querySelector(".ai-copilot-open-ai-modal-btn");
  }

  /**
   * Renders the dedicated full-height reasoning & history sidebar attached to the left of the chat pane
   */
  renderHistorySidebar() {
    if (!this.container || !this.container.parentNode) return;

    let sidebar = this.container.parentNode.querySelector(
      `.ai-copilot-history-sidebar[data-copilot-for="${this.storageKey}"]`,
    );
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "ai-copilot-prompt-sidebar ai-copilot-history-sidebar";
      sidebar.dataset.copilotFor = this.storageKey;
      sidebar.style.display = "none";

      const insertTarget = this.resizer || this.container;
      this.container.parentNode.insertBefore(sidebar, insertTarget);
    }

    sidebar.innerHTML = `
      <div class="ai-prompt-sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span class="material-symbols-outlined icon-sm" style="color: var(--primary, #2563eb); flex-shrink: 0;">history</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <strong style="font-size: 13px; color: var(--text-heading, #0f172a); white-space: nowrap;">Linha de Raciocínio & Sessões</strong>
            <span style="font-size: 11px; color: var(--text-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              Context OS &bull; <span class="ai-copilot-history-path-tag">${this.escapeHtml(this.contextPath)}</span>
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn-icon ai-copilot-refresh-history-btn" type="button" title="Recarregar sessões">
            <span class="material-symbols-outlined icon-xs">refresh</span>
          </button>
          <button class="btn-icon ai-copilot-close-history-sidebar-btn" type="button" title="Fechar painel de histórico">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <div class="ai-history-sidebar-body" style="padding: 14px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px;">
        <div class="ai-history-empty-state" style="text-align: center; padding: 36px 16px; background: var(--bg-surface, #ffffff); border: 1px dashed var(--border-color, #cbd5e1); border-radius: 12px; margin: 4px 0;">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px auto; border-radius: 50%; background: rgba(37, 99, 235, 0.08); display: flex; align-items: center; justify-content: center; color: var(--primary, #2563eb);">
            <span class="material-symbols-outlined icon-md">forum</span>
          </div>
          <strong style="display: block; font-size: 13px; color: var(--text-heading, #0f172a); margin-bottom: 6px;">Nenhum histórico arquivado ainda</strong>
          <p style="margin: 0 0 14px 0; font-size: 11.5px; line-height: 1.5; color: var(--text-muted, #64748b);">
            As mensagens, decisões de arquitetura e handoffs deste documento serão gravados e versionados automaticamente aqui.
          </p>
          <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 10px; background: #f1f5f9; border-radius: 6px; color: var(--text-muted, #64748b);">
            <span class="material-symbols-outlined icon-xs" style="color: #10b981;">check_circle</span> Memória Git Ativa (.spec-memory/)
          </div>
        </div>
      </div>
    `;

    this.domHistorySidebar = sidebar;
    this.domCloseHistorySidebarBtn = sidebar.querySelector(".ai-copilot-close-history-sidebar-btn");
    if (this.domCloseHistorySidebarBtn) {
      this.domCloseHistorySidebarBtn.addEventListener("click", () => this.toggleHistorySidebar(false));
    }
    const refreshBtn = sidebar.querySelector(".ai-copilot-refresh-history-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadHistorySidebarContent());
    }

    // Auto-load history content on render
    this.loadHistorySidebarContent();
  }

  /**
   * Loads and renders past sessions inside the history sidebar
   */
  async loadHistorySidebarContent() {
    if (!this.domHistorySidebar) {
      if (this.container && this.container.parentNode) {
        this.domHistorySidebar = this.container.parentNode.querySelector(
          `.ai-copilot-history-sidebar[data-copilot-for="${this.storageKey}"]`,
        );
      }
    }
    if (!this.domHistorySidebar) return;
    const contentEl = this.domHistorySidebar.querySelector(".ai-history-sidebar-body");
    if (!contentEl) return;

    const repo = this.getRepoName();
    const path = this.contextPath;

    try {
      // Ensure brief is loaded
      if (!this.currentBriefing) {
        const briefRes = await API.getMemoryBrief({ repo, path });
        if (briefRes.ok && briefRes.data) {
          this.currentBriefing = briefRes.data.briefing || "";
        }
      }

      const { ok, data } = await API.getMemoryHistory({ repo, path });
      const briefing = this.currentBriefing || "";

      let html = "";

      // 1. Active Handoff Card
      if (briefing) {
        html += `
          <div style="padding: 10px 12px; background: rgba(37, 99, 235, 0.04); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined icon-xs" style="color: var(--primary);">psychology</span>
                <strong style="font-size: 12px; color: var(--primary);">Handoff Consolidado Ativo</strong>
              </div>
              <span class="ai-copilot-status-badge custom" style="font-size: 9px; padding: 1px 6px;">MEMÓRIA GIT</span>
            </div>
            <div style="font-size: 11px; line-height: 1.4; color: var(--text-body); max-height: 130px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; background: #fff; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-color);">${this.escapeHtml(briefing)}</div>
          </div>
        `;
      }

      // 2. Sessions List
      if (ok && data && Array.isArray(data.sessions) && data.sessions.length > 0) {
        html += `
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-weight: 600; color: var(--text-heading);">Sessões Gravadas (.spec-memory/):</span>
              <span style="font-size: 10.5px; color: var(--text-muted);">${data.sessions.length} arquivada${data.sessions.length > 1 ? 's' : ''}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        data.sessions.forEach((s) => {
          const author = s.author || { name: "Developer", handle: "dev" };
          const dateStr = s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "Data não disponível";
          const isCurrent = s.session_id === this.sessionId;
          const m = s.metrics || {};
          const totalTokens = m.total_tokens || 0;
          const promptTokens = m.prompt_tokens || 0;
          const compTokens = m.completion_tokens || 0;
          const totalSecs = ((m.total_latency_ms || 0) / 1000).toFixed(1);
          const rounds = m.rounds || 1;

          const metricsBadge = totalTokens > 0 || m.total_latency_ms > 0
            ? `<div style="margin-top: 6px; font-size: 10px; color: var(--text-muted); background: #f1f5f9; padding: 4px 6px; border-radius: 4px; display: flex; flex-direction: column; gap: 3px; width: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span title="Tokens totais consumidos">🏷️ Total: <strong>${totalTokens.toLocaleString()}</strong> tok</span>
                  <span title="Tempo total de resposta">⏱️ ${totalSecs}s</span>
                  <span title="Interações">💬 ${rounds} round${rounds > 1 ? 's' : ''}</span>
                </div>
                ${(promptTokens > 0 || compTokens > 0) ? `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 9.5px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
                    <span title="Tokens enviados na entrada (Prompt)"><strong style="color: #2563eb;">↑ ${promptTokens.toLocaleString()}</strong> enviad.</span>
                    <span>&bull;</span>
                    <span title="Tokens gerados na resposta (Completion)"><strong style="color: #059669;">↓ ${compTokens.toLocaleString()}</strong> receb.</span>
                  </div>
                ` : ''}
              </div>`
            : '';

          html += `
            <div class="ai-history-session-card" data-session-id="${this.escapeHtml(s.session_id)}" style="border: 1px solid ${isCurrent ? 'var(--primary)' : 'var(--border-color)'}; border-radius: 8px; padding: 10px 12px; background: ${isCurrent ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-card)'}; cursor: pointer; transition: all 0.15s ease;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                  ${this.renderAuthorAvatar(author, 20)}
                  <strong style="font-size: 12px; color: var(--text-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(author.name || author.handle || "Dev")}</strong>
                </div>
                <span style="font-size: 10px; color: var(--text-muted); flex-shrink: 0;">${dateStr}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🤖 ${this.escapeHtml(s.agent_model || 'IA')}</span>
                ${isCurrent ? '<span class="ai-copilot-status-badge custom" style="font-size: 9px; padding: 1px 6px; flex-shrink: 0;">ATIVA</span>' : '<span style="font-size: 10px; color: var(--primary); display: flex; align-items: center; gap: 2px;">Consultar <span class="material-symbols-outlined" style="font-size: 12px;">arrow_forward</span></span>'}
              </div>
              ${metricsBadge}
            </div>
          `;
        });
        html += `</div></div>`;
      } else {
        html += `
          <div class="ai-history-empty-state" style="text-align: center; padding: 36px 16px; background: var(--bg-surface, #ffffff); border: 1px dashed var(--border-color, #cbd5e1); border-radius: 12px; margin: 4px 0;">
            <div style="width: 48px; height: 48px; margin: 0 auto 12px auto; border-radius: 50%; background: rgba(37, 99, 235, 0.08); display: flex; align-items: center; justify-content: center; color: var(--primary, #2563eb);">
              <span class="material-symbols-outlined icon-md">forum</span>
            </div>
            <strong style="display: block; font-size: 13px; color: var(--text-heading, #0f172a); margin-bottom: 6px;">Nenhum histórico arquivado ainda</strong>
            <p style="margin: 0 0 14px 0; font-size: 11.5px; line-height: 1.5; color: var(--text-muted, #64748b);">
              As mensagens, decisões de arquitetura e handoffs deste documento serão gravados e versionados automaticamente aqui.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 10px; background: #f1f5f9; border-radius: 6px; color: var(--text-muted, #64748b);">
              <span class="material-symbols-outlined icon-xs" style="color: #10b981;">check_circle</span> Memória Git Ativa (.spec-memory/)
            </div>
          </div>
        `;
      }

      contentEl.innerHTML = html;

      // Bind click on session cards to view full details
      contentEl.querySelectorAll(".ai-history-session-card").forEach((card) => {
        card.addEventListener("click", () => {
          const sid = card.dataset.sessionId;
          if (sid) this.showSessionDetailsView(sid);
        });
      });
    } catch (e) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">
          <p style="color: var(--md-sys-color-error, #ef4444); margin-bottom: 8px;">Erro ao carregar histórico.</p>
          <button class="btn btn-ghost btn-xs" onclick="this.closest('.ai-history-sidebar').querySelector('.ai-copilot-refresh-history-btn')?.click()">Tentar novamente</button>
        </div>
      `;
    }
  }

  /**
   * Displays modal/drawer with full session details, dialog and handoff
   */
  async showSessionDetailsView(sessionId) {
    if (!this.domHistorySidebar) return;
    const contentEl = this.domHistorySidebar.querySelector(".ai-history-sidebar-body");
    if (!contentEl) return;

    const repo = this.getResolvedRepoName();
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted);">
        <span class="material-symbols-outlined icon-sm animate-spin" style="color: var(--primary);">progress_activity</span>
        <p style="font-size: 12px; margin-top: 8px;">Carregando detalhes da sessão...</p>
      </div>
    `;

    try {
      const { ok, data } = await API.getMemorySession({ repo, session_id: sessionId });
      if (!ok || !data?.session) {
        throw new Error("Sessão não encontrada no servidor");
      }

      const s = data.session;
      const author = s.author || { name: "Developer", handle: "dev" };
      const m = s.metrics || {};
      const dateStr = s.frontmatter?.created_at ? new Date(s.frontmatter.created_at).toLocaleString("pt-BR") : "";

      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Back button header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            <button class="btn btn-ghost btn-xs ai-back-to-history-btn" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px;">
              <span class="material-symbols-outlined" style="font-size: 14px;">arrow_back</span> Voltar à Lista
            </button>
            <span style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${this.escapeHtml(sessionId.slice(-14))}</span>
          </div>

          <!-- Session Metadata Header -->
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              ${this.renderAuthorAvatar(author, 24)}
              <div>
                <strong style="font-size: 12px; color: var(--text-heading); display: block;">${this.escapeHtml(author.name || "Developer")}</strong>
                <span style="font-size: 10.5px; color: var(--text-muted);">${dateStr} &bull; 🤖 ${this.escapeHtml(s.frontmatter?.agent_model || 'IA')}</span>
              </div>
            </div>
            ${m.total_tokens ? `
              <div style="font-size: 10.5px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>🏷️ <strong>${Number(m.total_tokens).toLocaleString()}</strong> tokens totais</span>
                  <span>&bull;</span>
                  <span>⏱️ ${(Number(m.total_latency_ms || 0)/1000).toFixed(2)}s total</span>
                  <span>&bull;</span>
                  <span>💬 ${m.rounds || 1} round${(m.rounds || 1) > 1 ? 's' : ''}</span>
                </div>
                ${(m.prompt_tokens || m.completion_tokens) ? `
                  <div style="display: flex; align-items: center; gap: 10px; font-size: 10px; color: #475569; background: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                    <span title="Tokens de entrada enviados"><strong style="color: #2563eb;">↑ ${Number(m.prompt_tokens || 0).toLocaleString()}</strong> enviados (prompt)</span>
                    <span>&bull;</span>
                    <span title="Tokens de saída gerados"><strong style="color: #059669;">↓ ${Number(m.completion_tokens || 0).toLocaleString()}</strong> recebidos (completion)</span>
                    ${m.cached_tokens ? `<span>&bull;</span> <span style="color: #7c3aed;">⚡ ${Number(m.cached_tokens).toLocaleString()} cache</span>` : ''}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>

          ${s.handoff ? `
            <!-- Consolidated Handoff for this doc -->
            <div style="background: rgba(37, 99, 235, 0.04); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 8px; padding: 10px 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="material-symbols-outlined icon-xs" style="color: var(--primary);">psychology</span>
                  <strong style="font-size: 11.5px; color: var(--primary);">Handoff Consolidado Vinculado</strong>
                </div>
              </div>
              <div style="font-size: 11px; line-height: 1.4; color: var(--text-body); max-height: 140px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; background: #fff; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border-color);">${this.escapeHtml(s.handoff.replace(/^---[\s\S]*?---\n*/, '').trim())}</div>
            </div>
          ` : ''}

          <!-- Dialog Transcript -->
          <div>
            <strong style="font-size: 11.5px; color: var(--text-heading); display: block; margin-bottom: 6px;">Transcrição do Diálogo Gravado no Git:</strong>
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 11.5px; line-height: 1.5; color: var(--text-main); max-height: 280px; overflow-y: auto; white-space: pre-wrap;">${this.escapeHtml(s.body || "(Sem mensagens registradas)")}</div>
          </div>
        </div>
      `;

      const backBtn = contentEl.querySelector(".ai-back-to-history-btn");
      if (backBtn) {
        backBtn.addEventListener("click", () => this.loadHistorySidebarContent());
      }
    } catch (err) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">
          <p style="color: var(--md-sys-color-error, #ef4444); margin-bottom: 8px;">Falha ao carregar detalhes da sessão.</p>
          <button class="btn btn-ghost btn-xs ai-back-to-history-btn">Voltar à Lista</button>
        </div>
      `;
      const backBtn = contentEl.querySelector(".ai-back-to-history-btn");
      if (backBtn) {
        backBtn.addEventListener("click", () => this.loadHistorySidebarContent());
      }
    }
  }

  /**
   * Helper to render user avatar with stylish initials fallback
   */
  renderAuthorAvatar(author, size = 20) {
    let name = "Dev";
    let avatarUrl = "";
    if (author && typeof author === "object") {
      name = author.name || author.handle || "Dev";
      avatarUrl = author.avatar_url || "";
    } else if (typeof author === "string") {
      name = author;
    }
    const initials = name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "DV";

    if (avatarUrl && !avatarUrl.includes("ui-avatars.com")) {
      return `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(name)}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;" onerror="this.outerHTML='<span style=\\'display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:#2563eb;color:#fff;font-size:${Math.round(size*0.45)}px;font-weight:700;flex-shrink:0;\\'>${initials}</span>'" />`;
    }
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:#2563eb;color:#fff;font-size:${Math.round(size*0.45)}px;font-weight:700;flex-shrink:0;">${initials}</span>`;
  }

  /**
   * Renders the dedicated full-height RAW Inspector sidebar (telemetry, prompts, memory)
   */
  renderRawSidebar() {
    if (!this.container || !this.container.parentNode) return;

    let sidebar = this.container.parentNode.querySelector(
      `.ai-copilot-raw-sidebar[data-copilot-for="${this.storageKey}"]`,
    );
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "ai-copilot-prompt-sidebar ai-copilot-raw-sidebar";
      sidebar.dataset.copilotFor = this.storageKey;
      sidebar.style.display = "none";

      const insertTarget = this.resizer || this.container;
      this.container.parentNode.insertBefore(sidebar, insertTarget);
    }

    sidebar.innerHTML = `
      <div class="ai-prompt-sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span class="material-symbols-outlined icon-sm" style="color: var(--primary, #2563eb); flex-shrink: 0;">terminal</span>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <strong style="font-size: 13px; color: var(--text-heading, #0f172a); white-space: nowrap;">Inspetor RAW & Telemetria</strong>
            <span style="font-size: 11px; color: var(--text-muted, #64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              Context OS &bull; <span class="ai-copilot-history-path-tag">${this.escapeHtml(this.contextPath)}</span>
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn btn-ghost btn-xs ai-copilot-export-raw-btn" type="button" title="Exportar histórico RAW para arquivo JSON" style="font-size: 10.5px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;">
            <span class="material-symbols-outlined" style="font-size: 13px;">download</span> Exportar
          </button>
          <button class="btn-icon ai-copilot-refresh-raw-btn" type="button" title="Recarregar telemetria RAW">
            <span class="material-symbols-outlined icon-xs">refresh</span>
          </button>
          <button class="btn-icon ai-copilot-close-raw-sidebar-btn" type="button" title="Fechar inspetor RAW">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <div class="ai-raw-sidebar-body" style="padding: 14px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">
      </div>
    `;

    this.domRawSidebar = sidebar;
    this.domCloseRawSidebarBtn = sidebar.querySelector(".ai-copilot-close-raw-sidebar-btn");
    const refreshBtn = sidebar.querySelector(".ai-copilot-refresh-raw-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadRawSidebarContent());
    }

    const exportBtn = sidebar.querySelector(".ai-copilot-export-raw-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const payloadStr = JSON.stringify(this.rawHistory || [], null, 2);
        const blob = new Blob([payloadStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `telemetry-${this.sessionId || 'session'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    this.loadRawSidebarContent();
  }

  /**
   * Formats author object or string into a clean display name
   */
  formatAuthorName(author) {
    if (!author) return "Você";
    if (typeof author === "string") return author;
    if (typeof author === "object") {
      return author.name || author.handle || author.login || "Você";
    }
    return String(author);
  }

  /**
   * Formats ISO timestamp to DD/MM/YYYY HH:MM:SS
   */
  formatTimestamp(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      const secs = String(d.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
    } catch (e) {
      return String(isoString);
    }
  }

  /**
   * Populates the RAW Inspector sidebar with expandable turn-by-turn entries (User > Date, prompt snippet, and scrollable Enviado/Recebido views)
   */
  loadRawSidebarContent() {
    if (!this.domRawSidebar) {
      if (this.container && this.container.parentNode) {
        this.domRawSidebar = this.container.parentNode.querySelector(
          `.ai-copilot-raw-sidebar[data-copilot-for="${this.storageKey}"]`,
        );
      }
    }
    if (!this.domRawSidebar) return;
    const contentEl = this.domRawSidebar.querySelector(".ai-raw-sidebar-body");
    if (!contentEl) return;

    if (!Array.isArray(this.rawHistory) || this.rawHistory.length === 0) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; background: #ffffff; border: 1px dashed var(--border-color, #cbd5e1); border-radius: 12px; margin: 4px 0;">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px auto; border-radius: 50%; background: rgba(37, 99, 235, 0.08); display: flex; align-items: center; justify-content: center; color: var(--primary, #2563eb);">
            <span class="material-symbols-outlined icon-md">data_object</span>
          </div>
          <strong style="display: block; font-size: 13px; color: var(--text-heading, #0f172a); margin-bottom: 6px;">Nenhuma interação RAW registrada</strong>
          <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--text-muted, #64748b);">
            A cada nova mensagem enviada no chat, uma entrada expansível será adicionada aqui com o payload puro (Enviado e Recebido) e telemetria de tokens.
          </p>
        </div>
      `;
      return;
    }

    let html = "";
    this.rawHistory.forEach((item) => {
      const isExpanded = Boolean(item.expanded);
      const authorName = this.formatAuthorName(item.author);
      const sentJson = item.sentPayload ? JSON.stringify(item.sentPayload, null, 2) : "Nenhum payload enviado.";
      const recvJson = item.receivedPayload ? JSON.stringify(item.receivedPayload, null, 2) : "Aguardando resposta da LLM...";

      // Telemetria do turno
      const usage = item.receivedPayload?.usage;
      const latency = item.receivedPayload?.latency_ms;
      const prov = item.receivedPayload?.provider;
      const mod = item.receivedPayload?.model;

      let telemetryBadge = "";
      if (usage || latency) {
        const parts = [];
        if (latency) parts.push(`⏱️ ${latency}ms`);
        if (usage) {
          const totalTok = (usage.total_tokens || 0).toLocaleString();
          const inTok = (usage.prompt_tokens || 0).toLocaleString();
          const outTok = (usage.completion_tokens || 0).toLocaleString();
          const cachedTok = usage.cached_tokens ? ` | ⚡ ${(usage.cached_tokens).toLocaleString()} cache` : '';
          const estTag = usage.estimated ? ' (est.)' : '';
          parts.push(`🏷️ ${totalTok} tokens (📥 ${inTok} | 📤 ${outTok}${cachedTok})${estTag}`);
        }
        telemetryBadge = `
          <div style="font-size: 10px; color: var(--text-muted, #64748b); margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="background: rgba(37, 99, 235, 0.08); color: var(--primary, #2563eb); padding: 1px 6px; border-radius: 4px; font-weight: 600;">${parts.join(' &bull; ')}</span>
            ${prov ? `<span style="color: #64748b;">🤖 ${this.escapeHtml(prov)} ${mod ? `(${this.escapeHtml(mod)})` : ''}</span>` : ''}
          </div>
        `;
      }

      html += `
        <div class="ai-raw-entry-card" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px; background: #ffffff; overflow: hidden; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <!-- Header (Click to expand/collapse) -->
          <div class="ai-raw-entry-header" data-raw-id="${item.id}" style="padding: 10px 12px; cursor: pointer; background: var(--bg-hover, #f8fafc); border-bottom: ${isExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none'}; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; user-select: none;">
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted, #64748b); margin-bottom: 4px;">
                ${this.renderAuthorAvatar(item.author, 18)}
                <strong style="color: var(--text-heading, #0f172a); font-size: 11.5px;">${this.escapeHtml(authorName)}</strong>
                <span style="color: #94a3b8;">&rsaquo;</span>
                <span style="color: var(--text-muted, #64748b);">${this.escapeHtml(this.formatTimestamp(item.timestamp))}</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: var(--text-main, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${this.escapeHtml(item.promptText || "(Mensagem vazia)")}
              </div>
              ${telemetryBadge}
            </div>
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; padding-top: 2px;">
              <span class="material-symbols-outlined icon-sm" style="color: var(--text-muted, #64748b); transition: transform 0.15s ease; transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}">expand_more</span>
            </div>
          </div>

          <!-- Expanded Body: 2 Scrollable RAW Views with Height Limit -->
          ${isExpanded ? `
            <div class="ai-raw-entry-body" style="padding: 12px; display: flex; flex-direction: column; gap: 12px; background: #ffffff;">
              <!-- View 1: Enviado (Request RAW) -->
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined icon-xs" style="color: #f59e0b;">upload</span>
                    <strong style="font-size: 11.5px; color: var(--text-heading, #0f172a);">1. Enviado (Request RAW)</strong>
                  </div>
                  <button class="btn btn-ghost btn-xs ai-copy-raw-btn" data-target="sent-${item.id}" style="font-size: 10px; padding: 1px 6px;">Copiar</button>
                </div>
                <pre class="ai-raw-code-block" id="raw-sent-${item.id}" style="max-height: 240px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; padding: 10px 12px; background: #0f172a; color: #f8fafc; border-radius: 6px; margin: 0; white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(sentJson)}</pre>
              </div>

              <!-- View 2: Recebido (Response RAW) -->
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-outlined icon-xs" style="color: #10b981;">download</span>
                    <strong style="font-size: 11.5px; color: var(--text-heading, #0f172a);">2. Recebido (Response RAW)</strong>
                  </div>
                  <button class="btn btn-ghost btn-xs ai-copy-raw-btn" data-target="recv-${item.id}" style="font-size: 10px; padding: 1px 6px;">Copiar</button>
                </div>
                <pre class="ai-raw-code-block" id="raw-recv-${item.id}" style="max-height: 240px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; padding: 10px 12px; background: #0f172a; color: #f8fafc; border-radius: 6px; margin: 0; white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(recvJson)}</pre>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });

    contentEl.innerHTML = html;

    // Bind Accordion Click Events
    contentEl.querySelectorAll(".ai-raw-entry-header").forEach((hdr) => {
      hdr.addEventListener("click", () => {
        const rawId = hdr.dataset.rawId;
        const targetItem = this.rawHistory.find((x) => x.id === rawId);
        if (targetItem) {
          targetItem.expanded = !targetItem.expanded;
          this.loadRawSidebarContent();
        }
      });
    });

    // Bind Copy Buttons
    contentEl.querySelectorAll(".ai-copy-raw-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const targetEl = contentEl.querySelector(`#raw-${targetId}`);
        if (targetEl) {
          navigator.clipboard.writeText(targetEl.textContent).then(() => {
            const orig = btn.textContent;
            btn.textContent = "Copiado!";
            setTimeout(() => (btn.textContent = orig), 1500);
          });
        }
      });
    });
  }

  /**
   * Binds user interactions
   */
  bindEvents() {
    this.domAgentBtn = this.container.querySelector(".ai-copilot-agent-btn");
    this.domMemoryDot = this.container.querySelector(".ai-copilot-memory-dot-btn") || this.container.querySelector(".ai-copilot-memory-dot");
    this.domRawBtn = this.container.querySelector(".ai-copilot-raw-btn");
    this.domHistoryBtn = this.container.querySelector(".ai-copilot-history-btn");
    this.domCloseBtn = this.container.querySelector(".ai-copilot-close-btn");
    this.domMessagesContainer = this.container.querySelector(
      ".ai-copilot-messages-container",
    );
    this.domChipsContainer = this.container.querySelector(
      ".ai-copilot-chips-container",
    );
    this.domInputField = this.container.querySelector(
      ".ai-copilot-input-field",
    );
    this.domSendBtn = this.container.querySelector(".ai-copilot-send-btn");

    this.renderChips();

    // Toggle Parameters & System Prompt Sidebar
    if (this.domAgentBtn) {
      this.domAgentBtn.addEventListener("click", () => {
        this.isPromptSidebarOpen = !this.isPromptSidebarOpen;
        if (this.isPromptSidebarOpen) {
          this.isHistorySidebarOpen = false;
          this.isRawSidebarOpen = false;
          if (this.domHistorySidebar) this.domHistorySidebar.style.display = "none";
          if (this.domRawSidebar) this.domRawSidebar.style.display = "none";
          if (this.domHistoryBtn) this.domHistoryBtn.classList.remove("active");
          if (this.domRawBtn) this.domRawBtn.classList.remove("active");
        }

        if (this.domPromptSidebar) {
          this.domPromptSidebar.style.display = this.isPromptSidebarOpen
            ? "flex"
            : "none";
          if (this.isPromptSidebarOpen && this.domPromptTextarea) {
            this.domPromptTextarea.value = this.getActivePrompt();
            setTimeout(() => this.domPromptTextarea.focus(), 50);
          }
        }
        this.domAgentBtn.classList.toggle("drawer-open", this.isPromptSidebarOpen);
      });
    }

    // Toggle Reasoning & History Sidebar (via History Button or Memory Dot)
    const toggleHistorySidebar = () => {
      this.isHistorySidebarOpen = !this.isHistorySidebarOpen;
      if (this.isHistorySidebarOpen) {
        this.isPromptSidebarOpen = false;
        this.isRawSidebarOpen = false;
        if (this.domPromptSidebar) this.domPromptSidebar.style.display = "none";
        if (this.domRawSidebar) this.domRawSidebar.style.display = "none";
        if (this.domAgentBtn) this.domAgentBtn.classList.remove("drawer-open");
        if (this.domRawBtn) this.domRawBtn.classList.remove("active");
        this.loadHistorySidebarContent();
      }

      if (this.domHistorySidebar) {
        this.domHistorySidebar.style.display = this.isHistorySidebarOpen
          ? "flex"
          : "none";
      }
      if (this.domHistoryBtn) {
        this.domHistoryBtn.classList.toggle("active", this.isHistorySidebarOpen);
      }
    };

    if (this.domHistoryBtn) {
      this.domHistoryBtn.addEventListener("click", toggleHistorySidebar);
    }
    if (this.domMemoryDot) {
      this.domMemoryDot.addEventListener("click", toggleHistorySidebar);
    }

    // Toggle RAW Inspector Sidebar
    const toggleRawSidebar = () => {
      this.isRawSidebarOpen = !this.isRawSidebarOpen;
      if (this.isRawSidebarOpen) {
        this.isPromptSidebarOpen = false;
        this.isHistorySidebarOpen = false;
        if (this.domPromptSidebar) this.domPromptSidebar.style.display = "none";
        if (this.domHistorySidebar) this.domHistorySidebar.style.display = "none";
        if (this.domAgentBtn) this.domAgentBtn.classList.remove("drawer-open");
        if (this.domHistoryBtn) this.domHistoryBtn.classList.remove("active");
        this.loadRawSidebarContent();
      }

      if (this.domRawSidebar) {
        this.domRawSidebar.style.display = this.isRawSidebarOpen
          ? "flex"
          : "none";
      }
      if (this.domRawBtn) {
        this.domRawBtn.classList.toggle("active", this.isRawSidebarOpen);
      }
    };

    if (this.domRawBtn) {
      this.domRawBtn.addEventListener("click", toggleRawSidebar);
    }

    // Close Prompt Sidebar via its close button
    if (this.domClosePromptSidebarBtn) {
      this.domClosePromptSidebarBtn.addEventListener("click", () => {
        this.isPromptSidebarOpen = false;
        if (this.domPromptSidebar) this.domPromptSidebar.style.display = "none";
        if (this.domAgentBtn) this.domAgentBtn.classList.remove("drawer-open");
      });
    }

    // Close History Sidebar via its close button
    if (this.domCloseHistorySidebarBtn) {
      this.domCloseHistorySidebarBtn.addEventListener("click", () => {
        this.isHistorySidebarOpen = false;
        if (this.domHistorySidebar) this.domHistorySidebar.style.display = "none";
        if (this.domHistoryBtn) this.domHistoryBtn.classList.remove("active");
      });
    }

    // Close RAW Sidebar via its close button
    if (this.domCloseRawSidebarBtn) {
      this.domCloseRawSidebarBtn.addEventListener("click", () => {
        this.isRawSidebarOpen = false;
        if (this.domRawSidebar) this.domRawSidebar.style.display = "none";
        if (this.domRawBtn) this.domRawBtn.classList.remove("active");
      });
    }

    // Open AI Configuration Modal from Prompt Sidebar button
    if (this.domOpenAIModalBtn) {
      this.domOpenAIModalBtn.addEventListener("click", () => {
        const modal = document.getElementById("ai-settings-modal");
        if (modal) {
          modal.style.display = "flex";
        }
      });
    }

    // Close / Collapse AI Pane
    if (this.domCloseBtn) {
      this.domCloseBtn.addEventListener("click", () => {
        this.isPromptSidebarOpen = false;
        this.isHistorySidebarOpen = false;
        this.isRawSidebarOpen = false;
        if (this.domPromptSidebar) this.domPromptSidebar.style.display = "none";
        if (this.domHistorySidebar) this.domHistorySidebar.style.display = "none";
        if (this.domRawSidebar) this.domRawSidebar.style.display = "none";
        if (this.domAgentBtn) this.domAgentBtn.classList.remove("drawer-open");
        if (this.domHistoryBtn) this.domHistoryBtn.classList.remove("active");
        if (this.domRawBtn) this.domRawBtn.classList.remove("active");

        if (this.onClose) {
          this.onClose();
        } else {
          this.container.style.display = "none";
        }
      });
    }

    // React to Global Memory Reset Events (Dev Tools)
    window.addEventListener("ai-memory-cleared", (e) => {
      const targetRepo = e.detail && e.detail.repo;
      const currentRepo = this.getResolvedRepoName();
      if (!targetRepo || targetRepo === currentRepo || targetRepo === "default") {
        this.resetChat();
        this.currentBriefing = "";
        this.updateHeaderUI();
        if (this.isHistorySidebarOpen) {
          this.loadHistorySidebarContent();
        }
      }
    });

    // Save Custom Pre-Prompt
    if (this.domSavePromptBtn) {
      this.domSavePromptBtn.addEventListener("click", async () => {
        const newPrompt = this.domPromptTextarea.value.trim();
        if (!newPrompt) {
          alert("O prompt do agente não pode ficar vazio.");
          return;
        }

        this.customSystemPrompt = newPrompt;
        this.domSavePromptBtn.disabled = true;
        this.domSavePromptBtn.textContent = "Salvando...";

        try {
          if (this.onPromptSaved) {
            await this.onPromptSaved(newPrompt);
          }
          this.updateHeaderUI();
          if (this.domPromptFeedback) {
            this.domPromptFeedback.style.color = "#10b981";
            this.domPromptFeedback.textContent = "✓ Salvo no Git!";
            setTimeout(() => {
              if (this.domPromptFeedback)
                this.domPromptFeedback.textContent = "";
            }, 3000);
          }
        } catch (e) {
          alert("Erro ao salvar prompt no projeto.");
        } finally {
          this.domSavePromptBtn.disabled = false;
          this.domSavePromptBtn.innerHTML =
            '<span class="material-symbols-outlined icon-xs">save</span> Salvar no Projeto';
        }
      });
    }

    // Restore Default Pre-Prompt
    if (this.domRestorePromptBtn) {
      this.domRestorePromptBtn.addEventListener("click", async () => {
        if (
          confirm(
            "Deseja restaurar o pré-prompt original recomendado pelo framework?",
          )
        ) {
          this.customSystemPrompt = "";
          this.domPromptTextarea.value = this.defaultSystemPrompt;

          try {
            if (this.onPromptRestored) {
              await this.onPromptRestored(this.defaultSystemPrompt);
            }
            this.updateHeaderUI();
            if (this.domPromptFeedback) {
              this.domPromptFeedback.style.color = "var(--primary, #1a73e8)";
              this.domPromptFeedback.textContent = "✓ Padrão restaurado!";
              setTimeout(() => {
                if (this.domPromptFeedback)
                  this.domPromptFeedback.textContent = "";
              }, 3000);
            }
          } catch (e) {
            console.error("Erro ao restaurar prompt:", e);
          }
        }
      });
    }

    // Send Message
    if (this.domSendBtn) {
      this.domSendBtn.addEventListener("click", () => this.sendMessage());
    }

    if (this.domInputField) {
      this.domInputField.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Draft Store integration
      this.domInputField.addEventListener("input", () => {
        if (DraftStoreService && DraftStoreService.saveChatDraft) {
          DraftStoreService.saveChatDraft(
            this.getRepoName(),
            this.contextPath,
            this.domInputField.value,
          );
        }
      });
    }
  }

  /**
   * Initializes horizontal drag resizer for this chat pane
   */
  initResizer() {
    if (!this.resizer) return;

    try {
      const savedWidth = localStorage.getItem(this.storageKey);
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (parsed >= 240 && parsed <= 750) {
          this.container.style.width = `${parsed}px`;
        }
      }
    } catch (e) {}

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    this.resizer.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = this.container.offsetWidth;

      document.body.classList.add("is-resizing");
      this.resizer.classList.add("active");
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(240, Math.min(750, startWidth - deltaX));
      this.container.style.width = `${newWidth}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove("is-resizing");
      this.resizer.classList.remove("active");
      try {
        localStorage.setItem(
          this.storageKey,
          String(this.container.offsetWidth),
        );
      } catch (e) {}
    });
  }

  /**
   * Updates Header Title, Icon, Badges and Author Info
   */
  updateHeaderUI() {
    const nameEl = this.container.querySelector(".ai-copilot-agent-name");
    const iconEl = this.container.querySelector(".ai-copilot-agent-icon");

    if (nameEl) nameEl.textContent = this.agentName;
    if (iconEl) iconEl.textContent = this.agentIcon;

    if (this.domPromptSidebar) {
      const tag = this.domPromptSidebar.querySelector(".ai-copilot-prompt-agent-tag");
      if (tag) tag.textContent = this.agentName;
      const modelLabel = this.domPromptSidebar.querySelector(".ai-copilot-model-name-label");
      if (modelLabel) modelLabel.textContent = this.modelName;
      const badge = this.domPromptSidebar.querySelector(".ai-copilot-status-badge");
      if (badge) {
        const isCustom = this.isCustomActive();
        badge.className = `ai-copilot-status-badge ${isCustom ? "custom" : "preset"}`;
        badge.textContent = isCustom ? "CUSTOMIZADO" : "PADRÃO";
      }
    }

    if (this.domHistorySidebar) {
      const pathTag = this.domHistorySidebar.querySelector(".ai-copilot-history-path-tag");
      if (pathTag) pathTag.textContent = this.contextPath;
    }
  }

  /**
   * Updates prompt textarea
   */
  updatePromptDrawerUI() {
    if (this.domPromptTextarea) {
      this.domPromptTextarea.value = this.getActivePrompt();
    }
    if (this.domPromptSidebar) {
      const tag = this.domPromptSidebar.querySelector(".ai-copilot-prompt-agent-tag");
      if (tag) tag.textContent = this.agentName;
    }
  }

  /**
   * Renders quick prompt suggestion chips
   */
  renderChips() {
    if (!this.domChipsContainer) return;
    this.domChipsContainer.innerHTML = "";

    if (!Array.isArray(this.chips) || this.chips.length === 0) {
      this.domChipsContainer.style.display = "none";
      return;
    }

    this.domChipsContainer.style.display = "flex";
    this.chips.forEach((c) => {
      const promptStr = typeof c === "string" ? c : c.prompt || c.label;
      const labelStr = typeof c === "string" ? c : c.label || c.prompt;

      const btn = document.createElement("button");
      btn.className = "chat-chip ai-copilot-chip";
      btn.type = "button";
      btn.textContent = labelStr;
      btn.title = promptStr;
      btn.addEventListener("click", () => {
        if (this.domInputField) {
          this.domInputField.value = promptStr;
        }
        this.sendMessage(promptStr);
      });
      this.domChipsContainer.appendChild(btn);
    });
  }

  /**
   * Renders restored history stream
   */
  renderHistoryStream() {
    if (!this.domMessagesContainer) return;
    this.domMessagesContainer.innerHTML = "";

    this.chatHistory.forEach((msg) => {
      const isUser = msg.role === "user";
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${isUser ? "user" : "ai"}`;
      if (isUser) {
        bubble.textContent = msg.text;
      } else {
        bubble.innerHTML = `
          <div class="chat-bubble-sender">
            <span class="material-symbols-outlined icon-xs">${this.escapeHtml(this.agentIcon)}</span>
            <strong>${this.escapeHtml(this.agentName)}</strong>
          </div>
          <div class="ai-reply-content">${this.renderMarkdown(msg.text)}</div>
        `;
        this.processDiagramsAndCode(bubble);
      }
      this.domMessagesContainer.appendChild(bubble);
    });

    this.scrollToBottom();
  }

  /**
   * Sends chat message grounded in current context & automatically saves to memory
   */
  async sendMessage(customPrompt = null) {
    const promptText =
      customPrompt ||
      (this.domInputField ? this.domInputField.value.trim() : "");
    if (!promptText) return;

    if (this.domSendBtn) this.domSendBtn.disabled = true;

    try {
      const repo = this.getResolvedRepoName();

      if (DraftStoreService && DraftStoreService.clearChatDraft) {
        DraftStoreService.clearChatDraft(repo, this.contextPath);
      }

      if (this.domInputField) this.domInputField.value = "";

      // Append User Bubble
      this.appendBubble("user", promptText);

      // Get Active Document Content
      let docContext = "";
      try {
        docContext =
          typeof this.getContent === "function"
            ? this.getContent()
            : String(this.getContent || "");
      } catch (e) {
        docContext = "";
      }

      const activePrompt = this.getActivePrompt();

      // Append Loading AI Bubble
      const loadingBubble = this.appendBubble(
        "ai",
        '<div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);"><span class="material-symbols-outlined icon-xs spin">progress_activity</span> Pensando e analisando com o documento ativo...</div>',
        true,
      );

      const effectiveSystemPrompt = this.currentBriefing
        ? `${activePrompt}\n\n${this.currentBriefing}`
        : activePrompt;

      const requestPayload = {
        prompt: promptText,
        content: docContext,
        path: this.contextPath,
        history: this.chatHistory.slice(),
        assistant_prompt: activePrompt,
        effective_system_prompt: effectiveSystemPrompt,
        session_id: this.sessionId,
        repo: repo,
        briefing: this.currentBriefing,
        timestamp: new Date().toISOString(),
      };
      this.lastRawPayload = requestPayload;

      const rawItem = {
        id: `raw-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        author: this.currentAuthor || "Você",
        timestamp: new Date().toISOString(),
        promptText: promptText,
        sentPayload: requestPayload,
        receivedPayload: null,
        expanded: true,
      };
      if (!this.rawHistory) this.rawHistory = [];
      this.rawHistory.unshift(rawItem);

      if (this.isRawSidebarOpen) {
        this.loadRawSidebarContent();
      }

      const { ok, data } = await API.sendChatMessage(requestPayload);
      this.lastRawResponse = data;
      rawItem.receivedPayload = data;
      if (this.isRawSidebarOpen) {
        this.loadRawSidebarContent();
      }

      if (ok && data && (data.reply || data.response)) {
        const replyText = data.reply || data.response;
        this.chatHistory.push({ role: "user", text: promptText });
        this.chatHistory.push({ role: "model", text: replyText });

        // Persist session immediately to local cache
        ChatMemoryStoreService.saveSession(repo, this.contextPath, {
          sessionId: this.sessionId,
          history: this.chatHistory,
          author: data.actor || this.currentAuthor,
          model: data.model || this.modelName,
        });

        const parsedHtml = this.renderMarkdown(replyText);

        let metaTag = "";
        if (data.provider || data.model) {
          metaTag = `<div style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs">bolt</span> ${data.provider || "AI"} (${data.model || this.modelName})</div>`;
        }

        loadingBubble.innerHTML = `
          <div class="chat-bubble-sender">
            <span class="material-symbols-outlined icon-xs">${this.escapeHtml(this.agentIcon)}</span>
            <strong>${this.escapeHtml(this.agentName)}</strong>
          </div>
          ${metaTag}
          <div class="ai-reply-content">${parsedHtml}</div>
        `;

        this.processDiagramsAndCode(loadingBubble);
      } else if (data?.needs_key) {
        loadingBubble.innerHTML = `
          <div class="chat-bubble-sender" style="color: var(--md-sys-color-warning, #f59e0b);">
            <span class="material-symbols-outlined icon-xs">warning</span>
            <strong>Configuração de Chave Necessária</strong>
          </div>
          <p style="margin: 0;">Clique no botão de modelo no topo para inserir sua chave ou selecionar o modo <strong>Ollama Local</strong>.</p>
        `;
        const modal = document.getElementById("ai-settings-modal");
        if (modal) modal.style.display = "flex";
      } else {
        loadingBubble.innerHTML = `
          <div class="chat-bubble-sender" style="color: var(--md-sys-color-error, #ef4444);">
            <span class="material-symbols-outlined icon-xs">error</span>
            <strong>Falha na IA</strong>
          </div>
          <p style="color: var(--md-sys-color-error, #ef4444); margin: 0;">${this.escapeHtml(data?.error || "Não foi possível obter resposta do modelo.")}</p>
        `;
      }
    } catch (err) {
      const errObj = {
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      };
      this.lastRawResponse = errObj;
      if (this.rawHistory && this.rawHistory[0]) {
        this.rawHistory[0].receivedPayload = errObj;
      }
      if (this.isRawSidebarOpen) {
        this.loadRawSidebarContent();
      }
      this.appendBubble(
        "ai",
        `
        <div class="chat-bubble-sender" style="color: var(--md-sys-color-error, #ef4444);">
          <span class="material-symbols-outlined icon-xs">error</span>
          <strong>Erro de Comunicação</strong>
        </div>
        <p style="color: var(--md-sys-color-error, #ef4444); margin: 0;">Falha de comunicação com o servidor local.</p>
        `,
        true,
      );
    } finally {
      if (this.domSendBtn) this.domSendBtn.disabled = false;
      this.scrollToBottom();
      if (this.domInputField) this.domInputField.focus();
    }
  }

  /**
   * Safe Markdown parser using marked engine
   */
  renderMarkdown(text) {
    if (!text) return "";
    if (typeof marked !== "undefined" && marked.parse) {
      try {
        return marked.parse(text);
      } catch (e) {
        console.warn("Markdown parse error:", e);
      }
    }
    return this.escapeHtml(text);
  }

  /**
   * Processes Mermaid diagrams and attaches copy/insert actions to code blocks
   */
  processDiagramsAndCode(bubbleEl) {
    if (!bubbleEl) return;

    if (typeof mermaid !== "undefined") {
      const mermaidCodes = bubbleEl.querySelectorAll(
        "pre code.language-mermaid, pre code.lang-mermaid"
      );
      mermaidCodes.forEach((codeEl) => {
        const preEl = codeEl.closest("pre");
        if (preEl) {
          const mCode = codeEl.textContent;
          const container = document.createElement("div");
          container.className = "mermaid";
          container.textContent = mCode;
          preEl.parentNode.replaceChild(container, preEl);
        }
      });
      const mermaidNodes = bubbleEl.querySelectorAll(".mermaid");
      if (mermaidNodes.length > 0) {
        try {
          mermaid.run({ nodes: mermaidNodes });
        } catch (mErr) {
          console.warn("Mermaid render error:", mErr);
        }
      }
    }

    this.attachCodeBlockActions(bubbleEl);
  }

  /**
   * Appends bubble to chat history stream
   */
  appendBubble(role, contentHtml, isRaw = false) {
    if (!this.domMessagesContainer) return null;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;

    if (role === "user" && !isRaw) {
      bubble.textContent = contentHtml;
    } else {
      bubble.innerHTML = contentHtml;
    }

    this.domMessagesContainer.appendChild(bubble);
    this.scrollToBottom();
    return bubble;
  }

  /**
   * Attaches Copy and Direct Insert / Apply buttons to code blocks
   */
  attachCodeBlockActions(bubbleEl) {
    const codeBlocks = bubbleEl.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      if (pre.classList.contains("mermaid")) return;
      
      const codeText =
        pre.querySelector("code")?.textContent || pre.textContent;
      const actionsBar = document.createElement("div");
      actionsBar.className = "ai-code-actions-bar";
      actionsBar.style.cssText =
        "display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end;";

      // Copy button
      const btnCopy = document.createElement("button");
      btnCopy.className = "btn-xs btn-secondary";
      btnCopy.type = "button";
      btnCopy.innerHTML =
        '<span class="material-symbols-outlined icon-xs">content_copy</span> Copiar';
      btnCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(codeText);
          btnCopy.innerHTML =
            '<span class="material-symbols-outlined icon-xs">check</span> Copiado!';
          setTimeout(() => {
            btnCopy.innerHTML =
              '<span class="material-symbols-outlined icon-xs">content_copy</span> Copiar';
          }, 2000);
        } catch (e) {
          console.warn("Clipboard failed:", e);
        }
      });
      actionsBar.appendChild(btnCopy);

      // Apply / Insert button
      if (this.onApplyContent) {
        const btnApply = document.createElement("button");
        btnApply.className = "btn-xs btn-primary";
        btnApply.type = "button";
        btnApply.innerHTML =
          '<span class="material-symbols-outlined icon-xs">input</span> Inserir no Editor';
        btnApply.addEventListener("click", () => {
          this.onApplyContent(codeText);
        });
        actionsBar.appendChild(btnApply);
      }

      pre.insertAdjacentElement("afterend", actionsBar);
    });
  }

  /**
   * Resets chat history and restores greeting
   */
  resetChat() {
    this.chatHistory = [];
    if (this.domMessagesContainer) {
      this.domMessagesContainer.innerHTML = `
        <div class="chat-bubble ai">
          <div class="chat-bubble-sender">
            <span class="material-symbols-outlined icon-xs">${this.escapeHtml(this.agentIcon)}</span>
            <strong>${this.escapeHtml(this.agentName)}</strong>
          </div>
          <div class="ai-reply-content">${this.renderMarkdown(this.welcomeMessage)}</div>
        </div>
      `;
    }
  }

  scrollToBottom() {
    if (this.domMessagesContainer) {
      this.domMessagesContainer.scrollTop =
        this.domMessagesContainer.scrollHeight;
    }
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

/**
 * Icon Picker Component (Material Symbols Library)
 * Reusable modal and popover icon selector for the Context OS platform.
 */

export const ICON_CATEGORIES = [
  {
    id: "all",
    label: "Todos",
    icon: "apps"
  },
  {
    id: "business",
    label: "Negócios & Finanças",
    icon: "payments",
    icons: [
      "payments", "account_balance", "attach_money", "credit_card", "receipt_long",
      "trending_up", "savings", "paid", "shopping_cart", "store", "price_check",
      "request_quote", "wallet", "inventory_2", "monetization_on", "currency_exchange",
      "calculate", "point_of_sale", "finance_mode", "price_change"
    ]
  },
  {
    id: "tech",
    label: "Engenharia & Tecnologia",
    icon: "terminal",
    icons: [
      "terminal", "code", "developer_mode", "api", "database", "memory", "storage",
      "cloud", "dns", "webhook", "bug_report", "integration_instructions", "lan",
      "security", "lock", "smart_toy", "deployed_code", "hub", "dataset", "device_hub",
      "data_object", "developer_board", "electrical_services", "schema"
    ]
  },
  {
    id: "governance",
    label: "Governança & Pessoas",
    icon: "corporate_fare",
    icons: [
      "corporate_fare", "domain", "groups", "badge", "how_to_reg", "admin_panel_settings",
      "policy", "gavel", "verified_user", "handshake", "diversity_3", "support_agent",
      "psychology", "supervisor_account", "person", "group_add", "military_tech", "shield"
    ]
  },
  {
    id: "operations",
    label: "Operações & Logística",
    icon: "settings_suggest",
    icons: [
      "settings_suggest", "local_shipping", "precision_manufacturing", "forklift",
      "inventory", "warehouse", "conveyor_belt", "route", "all_inbox", "fact_check",
      "speed", "build", "construction", "rule", "handyman", "local_shipping", "package_2"
    ]
  },
  {
    id: "marketing",
    label: "Marketing & Growth",
    icon: "campaign",
    icons: [
      "campaign", "ads_click", "share", "insights", "target", "leaderboard",
      "auto_graph", "loyalty", "public", "rocket_launch", "stars", "celebration",
      "mail", "sms", "forum", "send", "chat", "notifications_active", "trending_up"
    ]
  },
  {
    id: "architecture",
    label: "Design & Arquitetura",
    icon: "category",
    icons: [
      "category", "layers", "palette", "view_quilt", "dashboard_customize", "draw",
      "brush", "view_in_ar", "account_tree", "shapes", "aspect_ratio", "polyline",
      "filter_vintage", "auto_awesome", "design_services", "style", "view_column"
    ]
  },
  {
    id: "observability",
    label: "Qualidade & QA",
    icon: "monitoring",
    icons: [
      "monitoring", "verified", "health_and_safety", "analytics", "troubleshoot",
      "checklist", "rule", "find_in_page", "sync", "visibility", "sensors", "biotech",
      "query_stats", "network_check", "assessment", "track_changes"
    ]
  }
];

class IconPickerManager {
  constructor() {
    this.modalEl = null;
    this.activeCallback = null;
    this.currentCategory = "all";
    this.searchQuery = "";
    this.currentIcon = "";
    this.initModal();
  }

  initModal() {
    if (document.getElementById("standard-icon-picker-modal")) {
      this.modalEl = document.getElementById("standard-icon-picker-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "standard-icon-picker-modal";
    modal.className = "icon-picker-backdrop";
    modal.style.display = "none";

    modal.innerHTML = `
      <div class="icon-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="icon-picker-title">
        <div class="icon-picker-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="color: var(--md-sys-color-primary, #1a73e8);">palette</span>
            <h3 id="icon-picker-title" style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-main);">
              Biblioteca de Ícones
            </h3>
          </div>
          <button class="icon-picker-close-btn" type="button" title="Fechar">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
          </button>
        </div>

        <div class="icon-picker-search-bar">
          <div class="icon-picker-search-wrap">
            <span class="material-symbols-outlined icon-picker-search-icon">search</span>
            <input
              type="text"
              class="icon-picker-search-input"
              placeholder="Buscar ícones por nome ou categoria (ex: payments, code, domain, chart)..."
            />
            <button class="icon-picker-search-clear" type="button" style="display: none;" title="Limpar busca">&times;</button>
          </div>
        </div>

        <div class="icon-picker-categories-pills">
          ${ICON_CATEGORIES.map(
            (c) => `
            <button class="icon-picker-cat-btn ${c.id === 'all' ? 'active' : ''}" data-cat-id="${c.id}" type="button">
              <span class="material-symbols-outlined" style="font-size: 14px;">${c.icon}</span>
              ${c.label}
            </button>
          `
          ).join("")}
        </div>

        <div class="icon-picker-grid-container">
          <div class="icon-picker-grid"></div>
        </div>

        <div class="icon-picker-footer">
          <div class="icon-picker-preview-info">
            <span class="material-symbols-outlined icon-picker-current-badge">category</span>
            <span class="icon-picker-current-name">Nenhum ícone selecionado</span>
          </div>
          <button class="btn btn-secondary btn-sm icon-picker-cancel-btn" type="button">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    // Attach events
    const closeBtn = modal.querySelector(".icon-picker-close-btn");
    const cancelBtn = modal.querySelector(".icon-picker-cancel-btn");
    const searchInput = modal.querySelector(".icon-picker-search-input");
    const clearBtn = modal.querySelector(".icon-picker-search-clear");
    const catBtns = modal.querySelectorAll(".icon-picker-cat-btn");

    closeBtn.onclick = () => this.close();
    cancelBtn.onclick = () => this.close();
    modal.onclick = (e) => {
      if (e.target === modal) this.close();
    };

    searchInput.oninput = (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      clearBtn.style.display = this.searchQuery ? "block" : "none";
      this.renderGrid();
    };

    clearBtn.onclick = () => {
      searchInput.value = "";
      this.searchQuery = "";
      clearBtn.style.display = "none";
      searchInput.focus();
      this.renderGrid();
    };

    catBtns.forEach((btn) => {
      btn.onclick = () => {
        catBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentCategory = btn.dataset.catId;
        this.renderGrid();
      };
    });
  }

  getFilteredIcons() {
    let list = [];
    if (this.currentCategory === "all") {
      const set = new Set();
      ICON_CATEGORIES.forEach((c) => {
        if (c.icons) c.icons.forEach((ic) => set.add(ic));
      });
      list = Array.from(set);
    } else {
      const cat = ICON_CATEGORIES.find((c) => c.id === this.currentCategory);
      list = cat && cat.icons ? cat.icons : [];
    }

    if (this.searchQuery) {
      list = list.filter((ic) => ic.toLowerCase().includes(this.searchQuery));
    }
    return list;
  }

  renderGrid() {
    if (!this.modalEl) return;
    const grid = this.modalEl.querySelector(".icon-picker-grid");
    const previewName = this.modalEl.querySelector(".icon-picker-current-name");
    const previewBadge = this.modalEl.querySelector(".icon-picker-current-badge");
    if (!grid) return;

    grid.innerHTML = "";
    const icons = this.getFilteredIcons();

    if (icons.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--text-muted);">
          <span class="material-symbols-outlined" style="font-size: 32px; opacity: 0.5; margin-bottom: 6px;">search_off</span>
          <p style="margin: 0; font-size: 13px;">Nenhum ícone encontrado para "${escapeHtml(this.searchQuery)}"</p>
        </div>
      `;
      return;
    }

    icons.forEach((iconName) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `icon-picker-cell ${iconName === this.currentIcon ? 'selected' : ''}`;
      btn.title = iconName;
      btn.innerHTML = `
        <span class="material-symbols-outlined">${iconName}</span>
        <span class="icon-cell-name">${iconName}</span>
      `;

      btn.onclick = () => {
        if (this.activeCallback) {
          this.activeCallback(iconName);
        }
        this.close();
      };

      btn.onmouseenter = () => {
        if (previewName) previewName.textContent = iconName;
        if (previewBadge) previewBadge.textContent = iconName;
      };

      grid.appendChild(btn);
    });

    if (previewName) previewName.textContent = this.currentIcon || "Selecione um ícone";
    if (previewBadge) previewBadge.textContent = this.currentIcon || "category";
  }

  open({ currentIcon = "domain", onSelect }) {
    this.currentIcon = currentIcon;
    this.activeCallback = onSelect;
    this.searchQuery = "";
    this.currentCategory = "all";

    if (!this.modalEl) this.initModal();

    const searchInput = this.modalEl.querySelector(".icon-picker-search-input");
    const clearBtn = this.modalEl.querySelector(".icon-picker-search-clear");
    const catBtns = this.modalEl.querySelectorAll(".icon-picker-cat-btn");

    if (searchInput) searchInput.value = "";
    if (clearBtn) clearBtn.style.display = "none";
    catBtns.forEach((b) => b.classList.toggle("active", b.dataset.catId === "all"));

    this.renderGrid();
    this.modalEl.style.display = "flex";
    if (searchInput) setTimeout(() => searchInput.focus(), 50);
  }

  close() {
    if (this.modalEl) {
      this.modalEl.style.display = "none";
    }
    this.activeCallback = null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const IconPicker = new IconPickerManager();
window.IconPicker = IconPicker;

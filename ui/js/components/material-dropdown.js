// =============================================================================
// MATERIAL DROPDOWN COMPONENT (GOOGLE MATERIAL DESIGN 3)
// Componente customizado, acessível e reutilizável de seleção.
// =============================================================================

export class MaterialDropdown {
  /**
   * @param {Object} config
   * @param {HTMLElement|string} config.container - Elemento ou seletor onde o dropdown será renderizado
   * @param {Array<Object>} [config.options=[]] - Lista de opções [{ value, label, icon, badge, subtitle }]
   * @param {string} [config.selectedValue=''] - Valor selecionado inicialmente
   * @param {string} [config.placeholder='Selecione uma opção'] - Texto placeholder
   * @param {string} [config.leadingIcon=''] - Ícone Material Symbols no botão gatilho
   * @param {boolean} [config.searchable=false] - Se deve exibir campo de busca interna
   * @param {Function} [config.onChange=null] - Callback disparado na mudança: (value, option) => {}
   * @param {string} [config.ariaLabel='Menu de seleção'] - Rótulo para acessibilidade
   */
  constructor({
    container,
    options = [],
    selectedValue = '',
    placeholder = 'Selecione uma opção',
    leadingIcon = '',
    searchable = false,
    onChange = null,
    ariaLabel = 'Menu de seleção'
  }) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) {
      throw new Error(`MaterialDropdown: Container não encontrado.`);
    }

    this.options = options || [];
    this.selectedValue = selectedValue;
    this.placeholder = placeholder;
    this.leadingIcon = leadingIcon;
    this.searchable = searchable;
    this.onChange = onChange;
    this.ariaLabel = ariaLabel;

    this.isOpen = false;
    this.focusedIndex = -1;
    this.searchQuery = '';
    this.disabled = false;

    this._onDocumentClick = this._onDocumentClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this.render();
    this.bindEvents();

    if (this.selectedValue !== undefined && this.selectedValue !== null) {
      this.setValue(this.selectedValue, false);
    }
  }

  render() {
    this.container.innerHTML = '';
    this.container.classList.add('md-dropdown-container');

    // Trigger Button
    this.triggerEl = document.createElement('button');
    this.triggerEl.type = 'button';
    this.triggerEl.className = 'md-dropdown-trigger';
    this.triggerEl.setAttribute('aria-haspopup', 'listbox');
    this.triggerEl.setAttribute('aria-expanded', 'false');
    this.triggerEl.setAttribute('aria-label', this.ariaLabel);

    this.triggerEl.innerHTML = `
      <div class="md-dropdown-trigger-left">
        ${this.leadingIcon ? `<span class="material-symbols-outlined icon-sm md-dropdown-leading-icon">${this.leadingIcon}</span>` : ''}
        <span class="md-dropdown-label">${this.escapeHtml(this.placeholder)}</span>
        <span class="md-dropdown-trigger-badge" style="display: none;"></span>
      </div>
      <span class="material-symbols-outlined md-dropdown-chevron">expand_more</span>
    `;

    this.labelEl = this.triggerEl.querySelector('.md-dropdown-label');
    this.triggerBadgeEl = this.triggerEl.querySelector('.md-dropdown-trigger-badge');
    this.leadingIconEl = this.triggerEl.querySelector('.md-dropdown-leading-icon');

    // Popover Menu
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'md-dropdown-menu';
    this.menuEl.setAttribute('role', 'listbox');

    if (this.searchable) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'md-dropdown-search-wrap';
      searchWrap.innerHTML = `
        <span class="material-symbols-outlined icon-xs search-icon">search</span>
        <input type="text" placeholder="Filtrar opções..." autocomplete="off" />
      `;
      this.searchInput = searchWrap.querySelector('input');
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').toLowerCase().trim();
        this.renderOptionsList();
      });
      this.menuEl.appendChild(searchWrap);
    }

    this.listEl = document.createElement('ul');
    this.listEl.className = 'md-dropdown-list';
    this.menuEl.appendChild(this.listEl);

    this.container.appendChild(this.triggerEl);
    this.container.appendChild(this.menuEl);

    this.renderOptionsList();
  }

  renderOptionsList() {
    this.listEl.innerHTML = '';

    const filtered = this.options.filter(opt => {
      if (!this.searchQuery) return true;
      const label = (opt.label || '').toLowerCase();
      const sub = (opt.subtitle || '').toLowerCase();
      return label.includes(this.searchQuery) || sub.includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <li class="md-dropdown-empty">Nenhum resultado encontrado</li>
      `;
      return;
    }

    filtered.forEach((opt, index) => {
      const isSelected = String(opt.value) === String(this.selectedValue);
      const li = document.createElement('li');
      li.className = `md-dropdown-item ${isSelected ? 'selected' : ''}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      li.dataset.value = opt.value;
      li.dataset.index = index;

      li.innerHTML = `
        <div class="md-dropdown-item-left">
          ${opt.icon ? `<span class="material-symbols-outlined md-dropdown-item-icon">${opt.icon}</span>` : ''}
          <div class="md-dropdown-item-labels">
            <span class="md-dropdown-item-title">${this.escapeHtml(opt.label)}</span>
            ${opt.subtitle ? `<span class="md-dropdown-item-subtitle">${this.escapeHtml(opt.subtitle)}</span>` : ''}
          </div>
        </div>
        <div class="md-dropdown-item-right">
          ${opt.badge !== undefined && opt.badge !== null ? `<span class="md-dropdown-item-badge">${this.escapeHtml(String(opt.badge))}</span>` : ''}
          <span class="material-symbols-outlined md-dropdown-item-check">check</span>
        </div>
      `;

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setValue(opt.value, true);
        this.close();
      });

      this.listEl.appendChild(li);
    });
  }

  bindEvents() {
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.disabled) return;
      this.toggle();
    });

    this.container.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('click', this._onDocumentClick);
  }

  _onDocumentClick(e) {
    if (!this.container.contains(e.target)) {
      this.close();
    }
  }

  _onKeyDown(e) {
    if (this.disabled) return;

    if (!this.isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
      return;
    }

    const items = Array.from(this.listEl.querySelectorAll('.md-dropdown-item'));
    if (!items.length) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      this.triggerEl.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = (this.focusedIndex + 1) % items.length;
      this.updateItemFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex = (this.focusedIndex - 1 + items.length) % items.length;
      this.updateItemFocus(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.focusedIndex >= 0 && this.focusedIndex < items.length) {
        items[this.focusedIndex].click();
      }
    }
  }

  updateItemFocus(items) {
    items.forEach((it, idx) => {
      if (idx === this.focusedIndex) {
        it.classList.add('focused');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('focused');
      }
    });
  }

  open() {
    if (this.isOpen || this.disabled) return;
    this.isOpen = true;
    this.container.classList.add('open');
    this.triggerEl.setAttribute('aria-expanded', 'true');

    // Auto dropup detection
    const rect = this.triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 300 && rect.top > 300) {
      this.container.classList.add('dropup');
    } else {
      this.container.classList.remove('dropup');
    }

    if (this.searchable && this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 50);
    }

    const selectedItem = this.listEl.querySelector('.md-dropdown-item.selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.classList.remove('open');
    this.triggerEl.setAttribute('aria-expanded', 'false');
    this.focusedIndex = -1;

    if (this.searchable && this.searchInput) {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.renderOptionsList();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setOptions(options = []) {
    this.options = options || [];
    this.renderOptionsList();
    this.updateTriggerUI();
  }

  setValue(value, triggerChange = true) {
    this.selectedValue = value;
    this.updateTriggerUI();
    this.renderOptionsList();

    if (triggerChange && typeof this.onChange === 'function') {
      const selectedOption = this.getSelectedOption();
      this.onChange(value, selectedOption);
    }
  }

  getValue() {
    return this.selectedValue;
  }

  getSelectedOption() {
    return this.options.find(opt => String(opt.value) === String(this.selectedValue)) || null;
  }

  updateTriggerUI() {
    const selected = this.getSelectedOption();
    if (selected) {
      this.labelEl.textContent = selected.label;
      if (selected.icon && this.leadingIconEl) {
        this.leadingIconEl.textContent = selected.icon;
      } else if (this.leadingIcon && this.leadingIconEl) {
        this.leadingIconEl.textContent = this.leadingIcon;
      }

      if (selected.badge !== undefined && selected.badge !== null) {
        this.triggerBadgeEl.textContent = selected.badge;
        this.triggerBadgeEl.style.display = 'inline-block';
      } else {
        this.triggerBadgeEl.style.display = 'none';
      }
    } else {
      this.labelEl.textContent = this.placeholder;
      if (this.leadingIcon && this.leadingIconEl) {
        this.leadingIconEl.textContent = this.leadingIcon;
      }
      this.triggerBadgeEl.style.display = 'none';
    }
  }

  disable() {
    this.disabled = true;
    this.triggerEl.disabled = true;
    this.container.classList.add('disabled');
  }

  enable() {
    this.disabled = false;
    this.triggerEl.disabled = false;
    this.container.classList.remove('disabled');
  }

  destroy() {
    document.removeEventListener('click', this._onDocumentClick);
    this.container.removeEventListener('keydown', this._onKeyDown);
    this.container.innerHTML = '';
  }

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * Factory helper function
 */
export function createMaterialDropdown(config) {
  return new MaterialDropdown(config);
}

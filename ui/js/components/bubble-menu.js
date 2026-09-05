// =============================================================================
// COMPONENT: BUBBLE MENU (FLOATING SELECTION TOOLBAR WITH NOTION PALETTE)
// Oferece formatação rápida (Negrito, Itálico, Código, Link, Cores Notion) ao selecionar texto.
// =============================================================================

export class BubbleMenu {
  constructor({ container, onFormat }) {
    this.container = container;
    this.onFormat = onFormat || (() => {});
    this.element = null;
    this.colorPicker = null;
    this.isVisible = false;
    this.savedRange = null;

    this.notionColors = [
      { name: 'Padrão', color: 'inherit', bg: 'transparent' },
      { name: 'Cinza', color: '#64748b', bg: '#f1f5f9' },
      { name: 'Marrom', color: '#78350f', bg: '#fef3c7' },
      { name: 'Laranja', color: '#c2410c', bg: '#ffedd5' },
      { name: 'Amarelo', color: '#854d0e', bg: '#fef9c3' },
      { name: 'Verde', color: '#15803d', bg: '#dcfce7' },
      { name: 'Azul', color: '#1d4ed8', bg: '#dbeafe' },
      { name: 'Roxo', color: '#7e22ce', bg: '#f3e8ff' },
      { name: 'Rosa', color: '#be185d', bg: '#fce7f3' },
      { name: 'Vermelho', color: '#b91c1c', bg: '#fee2e2' }
    ];

    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'bubble-menu-popover';
    this.element.innerHTML = `
      <button type="button" class="bubble-btn" data-action="bold" title="Negrito (Ctrl+B)"><strong>B</strong></button>
      <button type="button" class="bubble-btn" data-action="italic" title="Itálico (Ctrl+I)"><em>I</em></button>
      <button type="button" class="bubble-btn" data-action="strike" title="Tachado"><s>S</s></button>
      <div class="bubble-divider"></div>
      <button type="button" class="bubble-btn" data-action="code" title="Código inline"><code>&lt;/&gt;</code></button>
      <button type="button" class="bubble-btn" data-action="link" title="Inserir Link (Ctrl+K)"><span class="material-symbols-outlined icon-xs">link</span></button>
      <button type="button" class="bubble-btn" data-action="color" title="Cor & Destaque"><span class="material-symbols-outlined icon-xs">palette</span></button>
    `;

    // Color Picker Popover
    this.colorPicker = document.createElement('div');
    this.colorPicker.className = 'bubble-color-picker';
    this.colorPicker.innerHTML = this.notionColors.map(c => `
      <div class="color-swatch" style="background:${c.bg}; border-color:${c.color};" data-color="${c.color}" data-bg="${c.bg}" title="${c.name}"></div>
    `).join('');

    this.element.appendChild(this.colorPicker);
    document.body.appendChild(this.element);

    this.element.querySelectorAll('.bubble-btn').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        if (action === 'color') {
          const isShown = this.colorPicker.style.display === 'flex';
          this.colorPicker.style.display = isShown ? 'none' : 'flex';
        } else {
          this.colorPicker.style.display = 'none';
          this.handleAction(action);
        }
      });
    });

    this.colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const color = swatch.dataset.color;
        const bg = swatch.dataset.bg;
        this.applyColor(color, bg);
        this.colorPicker.style.display = 'none';
      });
    });

    document.addEventListener('selectionchange', () => this.updatePosition());
    window.addEventListener('resize', () => this.updatePosition());
    window.addEventListener('scroll', () => this.updatePosition(), true);
  }

  updatePosition() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !this.container) {
      this.hide();
      return;
    }

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range || !this.container.contains(range.commonAncestorContainer)) {
      this.hide();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      this.hide();
      return;
    }

    this.savedRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }

    this.element.style.display = 'flex';
    this.element.style.left = `${rect.left + rect.width / 2}px`;
    this.element.style.top = `${rect.top - 6}px`;
    this.isVisible = true;
  }

  handleAction(action) {
    switch (action) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'strike':
        document.execCommand('strikeThrough', false, null);
        break;
      case 'code':
        this.wrapSelectionWithTag('code');
        break;
      case 'link':
        const url = prompt('Insira o link / URL:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        break;
    }

    this.onFormat(action);
    this.updatePosition();
  }

  applyColor(color, bg) {
    if (bg && bg !== 'transparent') {
      document.execCommand('hiliteColor', false, bg);
    }
    if (color && color !== 'inherit') {
      document.execCommand('foreColor', false, color);
    }
    this.onFormat('color');
  }

  wrapSelectionWithTag(tagName) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const selectedContent = range.extractContents();
    const el = document.createElement(tagName);
    el.appendChild(selectedContent);
    range.insertNode(el);
    selection.selectAllChildren(el);
  }

  hide() {
    if (this.isVisible) {
      this.element.style.display = 'none';
      if (this.colorPicker) this.colorPicker.style.display = 'none';
      this.isVisible = false;
    }
  }

  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

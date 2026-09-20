// =============================================================================
// COMPONENT: SLASH COMMAND MENU POPOVER ('/')
// Menu flutuante acionado ao digitar '/' com atalhos, busca e navegação por teclado.
// =============================================================================

export interface SlashCommand {
  id: string;
  category: string;
  title: string;
  desc: string;
  icon: string;
  keywords: string[];
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SlashMenuEngine {
  container: HTMLElement;
  onSelectCommand: (cmdId: string, targetRange: Range | null) => void;
  element: HTMLElement | null = null;
  searchInput: HTMLInputElement | null = null;
  listContainer: HTMLElement | null = null;
  isOpen = false;
  selectedIndex = 0;
  filteredItems: SlashCommand[] = [];
  query = '';
  triggerRange: Range | null = null;

  commands: SlashCommand[] = [
    // 1. Títulos & Cabeçalhos
    {
      id: 'h1',
      category: 'Títulos & Cabeçalhos',
      title: 'Título 1 (H1)',
      desc: 'Título principal da página ou seção',
      icon: '<span class="material-symbols-outlined icon-sm">format_h1</span>',
      keywords: ['h1', 'titulo', 'header', 'heading', 'grande']
    },
    {
      id: 'h2',
      category: 'Títulos & Cabeçalhos',
      title: 'Título 2 (H2)',
      desc: 'Subtítulo médio de seção',
      icon: '<span class="material-symbols-outlined icon-sm">format_h2</span>',
      keywords: ['h2', 'subtitulo', 'header', 'heading', 'medio']
    },
    {
      id: 'h3',
      category: 'Títulos & Cabeçalhos',
      title: 'Título 3 (H3)',
      desc: 'Subseção e tópicos menores',
      icon: '<span class="material-symbols-outlined icon-sm">format_h3</span>',
      keywords: ['h3', 'topico', 'header', 'pequeno']
    },

    // 2. Tabelas & Estrutura
    {
      id: 'table',
      category: 'Tabelas & Estrutura',
      title: 'Tabela Interativa',
      desc: 'Células editáveis com adicionar/remover linhas e colunas',
      icon: '<span class="material-symbols-outlined icon-sm">table_chart</span>',
      keywords: ['table', 'tabela', 'grid', 'coluna', 'linha', 'dados', 'matriz']
    },
    {
      id: 'toggle',
      category: 'Tabelas & Estrutura',
      title: 'Dropdown / Toggle List',
      desc: 'Seção expansível e recolhível (<details>)',
      icon: '<span class="material-symbols-outlined icon-sm">expand_circle_down</span>',
      keywords: ['toggle', 'dropdown', 'details', 'accordion', 'esconder', 'expansivel']
    },
    {
      id: 'divider',
      category: 'Tabelas & Estrutura',
      title: 'Divisor Horizontal',
      desc: 'Linha sutil separadora entre blocos',
      icon: '<span class="material-symbols-outlined icon-sm">horizontal_rule</span>',
      keywords: ['divider', 'divisor', 'linha', 'separador', 'hr', '---']
    },

    // 3. Callouts & Destaques
    {
      id: 'callout-note',
      category: 'Callouts & Destaques',
      title: 'Nota / Informativo',
      desc: 'Caixa azul com ícone de lâmpada e contexto de negócio',
      icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--primary, #2563eb)">info</span>',
      keywords: ['callout', 'note', 'info', 'nota', 'informativo', 'azul']
    },
    {
      id: 'callout-tip',
      category: 'Callouts & Destaques',
      title: 'Dica / Sucesso',
      desc: 'Caixa verde para boas práticas ou validações',
      icon: '<span class="material-symbols-outlined icon-sm" style="color: #10b981">check_circle</span>',
      keywords: ['callout', 'tip', 'success', 'dica', 'sucesso', 'verde']
    },
    {
      id: 'callout-warning',
      category: 'Callouts & Destaques',
      title: 'Alerta / Atenção',
      desc: 'Caixa amarela para requisitos e riscos',
      icon: '<span class="material-symbols-outlined icon-sm" style="color: #f59e0b">warning</span>',
      keywords: ['callout', 'warning', 'alerta', 'atencao', 'amarelo', 'cuidado']
    },
    {
      id: 'callout-danger',
      category: 'Callouts & Destaques',
      title: 'Perigo / Crítico',
      desc: 'Caixa vermelha para restrições e segurança',
      icon: '<span class="material-symbols-outlined icon-sm" style="color: #ef4444">error</span>',
      keywords: ['callout', 'danger', 'caution', 'perigo', 'critico', 'vermelho']
    },

    // 4. Listas & Tarefas
    {
      id: 'todo',
      category: 'Listas & Tarefas',
      title: 'Lista de Tarefas (Checklist)',
      desc: 'Itens com checkbox interativo sincronizado (- [ ])',
      icon: '<span class="material-symbols-outlined icon-sm">check_box</span>',
      keywords: ['todo', 'task', 'checklist', 'tarefa', 'check', 'caixa']
    },
    {
      id: 'bullet-list',
      category: 'Listas & Tarefas',
      title: 'Lista com Marcadores',
      desc: 'Lista com pontos simples',
      icon: '<span class="material-symbols-outlined icon-sm">format_list_bulleted</span>',
      keywords: ['bullet', 'lista', 'pontos', 'ul']
    },
    {
      id: 'number-list',
      category: 'Listas & Tarefas',
      title: 'Lista Numerada',
      desc: 'Lista sequencial 1, 2, 3...',
      icon: '<span class="material-symbols-outlined icon-sm">format_list_numbered</span>',
      keywords: ['number', 'numero', 'ordenada', 'ol', 'sequencia']
    },

    // 5. Avançado & Código
    {
      id: 'mermaid',
      category: 'Avançado & Código',
      title: 'Diagrama Mermaid',
      desc: 'Fluxogramas, sequências e arquitetura renderizados ao vivo',
      icon: '<span class="material-symbols-outlined icon-sm">schema</span>',
      keywords: ['mermaid', 'diagrama', 'fluxo', 'grafo', 'sequence', 'flowchart']
    },
    {
      id: 'code',
      category: 'Avançado & Código',
      title: 'Bloco de Código',
      desc: 'Caixa com destaque de sintaxe e botão de cópia',
      icon: '<span class="material-symbols-outlined icon-sm">code</span>',
      keywords: ['code', 'codigo', 'bloco', 'pre', 'snippet', 'python', 'javascript']
    },
    {
      id: 'quote',
      category: 'Avançado & Código',
      title: 'Citação em Bloco',
      desc: 'Texto em destaque com barra lateral',
      icon: '<span class="material-symbols-outlined icon-sm">format_quote</span>',
      keywords: ['quote', 'citacao', 'blockquote']
    }
  ];

  constructor({
    container,
    onSelectCommand
  }: {
    container: HTMLElement;
    onSelectCommand?: (cmdId: string, targetRange: Range | null) => void;
  }) {
    this.container = container;
    this.onSelectCommand = onSelectCommand || (() => {});
    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'slash-menu-popover';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="slash-menu-search">
        <span class="material-symbols-outlined icon-sm" style="color: #64748b;">search</span>
        <input type="text" placeholder="Filtrar componente..." spellcheck="false" />
      </div>
      <div class="slash-menu-list"></div>
    `;

    document.body.appendChild(this.element);

    this.searchInput = this.element.querySelector('input');
    this.listContainer = this.element.querySelector('.slash-menu-list');

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this.query = (this.searchInput?.value || '').toLowerCase().trim();
        this.renderList();
      });

      this.searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    // Close when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen && this.element && !this.element.contains(e.target as Node)) {
        this.close();
      }
    });

    // Window resize / scroll repositioning
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.positionMenu();
      }
    });

    window.addEventListener('scroll', () => {
      if (this.isOpen) {
        this.positionMenu();
      }
    }, true);
  }

  positionMenu() {
    if (!this.element || !this.triggerRange) return;

    let rect = this.triggerRange.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.bottom === 0) {
      const node = this.triggerRange.startContainer;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
      if (el) {
        rect = el.getBoundingClientRect();
      }
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 14;
    const menuWidth = this.element.offsetWidth || 320;
    const menuHeight = this.element.offsetHeight || 320;
    const maxAllowedHeight = 360;

    // 1. Horizontal Calculation (Clamp to viewport)
    let left = rect.left;
    if (left + menuWidth > viewportWidth - margin) {
      left = viewportWidth - menuWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    // 2. Vertical Calculation (Smart Flip & Clamp)
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    // Prefer below if at least 220px of space or if spaceBelow >= spaceAbove
    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      const availableHeight = Math.min(maxAllowedHeight, Math.max(120, Math.floor(spaceBelow - 8)));
      this.element.style.maxHeight = `${availableHeight}px`;
      this.element.style.top = `${Math.round(rect.bottom + 6)}px`;
      this.element.style.bottom = 'auto';
    } else {
      // Flip upwards above the caret
      const availableHeight = Math.min(maxAllowedHeight, Math.max(120, Math.floor(spaceAbove - 8)));
      this.element.style.maxHeight = `${availableHeight}px`;
      const currentH = Math.min(menuHeight, availableHeight);
      const topPos = Math.max(margin, Math.round(rect.top - currentH - 6));
      this.element.style.top = `${topPos}px`;
      this.element.style.bottom = 'auto';
    }

    this.element.style.left = `${Math.round(left)}px`;
  }

  openAtCaret(initialQuery = '') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !this.element) return;

    this.triggerRange = selection.getRangeAt(0).cloneRange();
    this.isOpen = true;
    this.query = initialQuery;

    if (this.searchInput) {
      this.searchInput.value = initialQuery;
    }

    this.element.style.display = 'flex';
    this.element.style.visibility = 'hidden';

    this.renderList();
    this.positionMenu();

    this.element.style.visibility = 'visible';

    setTimeout(() => {
      this.positionMenu();
      this.searchInput?.focus();
    }, 30);
  }

  renderList() {
    if (!this.listContainer) return;

    if (!this.query) {
      this.filteredItems = [...this.commands];
    } else {
      this.filteredItems = this.commands.filter(cmd => {
        return (
          cmd.title.toLowerCase().includes(this.query) ||
          cmd.desc.toLowerCase().includes(this.query) ||
          cmd.keywords.some(k => k.toLowerCase().includes(this.query))
        );
      });
    }

    if (this.filteredItems.length === 0) {
      this.listContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
          Nenhum componente encontrado para "<strong>${escapeHtml(this.query)}</strong>"
        </div>
      `;
      this.selectedIndex = 0;
      this.positionMenu();
      return;
    }

    this.selectedIndex = Math.min(this.selectedIndex, this.filteredItems.length - 1);
    if (this.selectedIndex < 0) this.selectedIndex = 0;

    let html = '';
    let currentCat = '';

    this.filteredItems.forEach((cmd, idx) => {
      if (cmd.category !== currentCat) {
        currentCat = cmd.category;
        html += `<div class="slash-menu-category">${currentCat}</div>`;
      }

      const isActive = idx === this.selectedIndex;
      html += `
        <div class="slash-menu-item ${isActive ? 'active' : ''}" data-index="${idx}" data-id="${cmd.id}">
          <div class="slash-item-icon">${cmd.icon}</div>
          <div class="slash-item-info">
            <span class="slash-item-title">${escapeHtml(cmd.title)}</span>
            <span class="slash-item-desc">${escapeHtml(cmd.desc)}</span>
          </div>
        </div>
      `;
    });

    this.listContainer.innerHTML = html;

    this.listContainer.querySelectorAll('.slash-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const cmdId = (item as HTMLElement).dataset.id;
        if (cmdId) {
          this.selectCommand(cmdId);
        }
      });
      item.addEventListener('mouseenter', () => {
        const idx = (item as HTMLElement).dataset.index;
        if (idx !== undefined) {
          this.selectedIndex = parseInt(idx, 10);
          this.updateActiveItem();
        }
      });
    });

    this.scrollActiveItemIntoView();
    this.positionMenu();
  }

  updateActiveItem() {
    if (!this.listContainer) return;
    const items = this.listContainer.querySelectorAll('.slash-menu-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === this.selectedIndex);
    });
  }

  scrollActiveItemIntoView() {
    if (!this.listContainer) return;
    const activeEl = this.listContainer.querySelector('.slash-menu-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  handleKeydown(e: KeyboardEvent) {
    if (!this.isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.filteredItems.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.updateActiveItem();
        this.scrollActiveItemIntoView();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.filteredItems.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.updateActiveItem();
        this.scrollActiveItemIntoView();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.filteredItems.length > 0 && this.filteredItems[this.selectedIndex]) {
        this.selectCommand(this.filteredItems[this.selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }

  selectCommand(commandId: string) {
    this.close();
    this.onSelectCommand(commandId, this.triggerRange);
  }

  close() {
    if (this.isOpen && this.element) {
      this.element.style.display = 'none';
      this.isOpen = false;
      this.query = '';
      if (this.searchInput) {
        this.searchInput.value = '';
      }
    }
  }

  hide() {
    this.close();
  }

  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
    }
  }
}

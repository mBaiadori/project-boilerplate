// =============================================================================
// COMPONENT: SLASH MENU POPOVER ('/')
// Menu flutuante acionado ao digitar '/' com atalhos, busca e navegação por teclado.
// =============================================================================

export class SlashMenu {
  constructor({ container, onSelectCommand }) {
    this.container = container;
    this.onSelectCommand = onSelectCommand || (() => {});
    this.element = null;
    this.isOpen = false;
    this.selectedIndex = 0;
    this.filteredItems = [];
    this.query = '';
    this.triggerRange = null;

    this.commands = [
      // 1. Títulos
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

      // 2. Componentes Estruturais & Tabelas
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

      // 3. Callouts & Alertas
      {
        id: 'callout-note',
        category: 'Callouts & Destaques',
        title: 'Nota / Informativo',
        desc: 'Caixa azul com ícone de lâmpada e contexto de negócio',
        icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--md-sys-color-primary)">info</span>',
        keywords: ['callout', 'note', 'info', 'nota', 'informativo', 'azul']
      },
      {
        id: 'callout-tip',
        category: 'Callouts & Destaques',
        title: 'Dica / Sucesso',
        desc: 'Caixa verde para boas práticas ou validações',
        icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--md-sys-color-tertiary)">check_circle</span>',
        keywords: ['callout', 'tip', 'success', 'dica', 'sucesso', 'verde']
      },
      {
        id: 'callout-warning',
        category: 'Callouts & Destaques',
        title: 'Alerta / Atenção',
        desc: 'Caixa amarela para requisitos e riscos',
        icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--md-sys-color-warning)">warning</span>',
        keywords: ['callout', 'warning', 'alerta', 'atencao', 'amarelo', 'cuidado']
      },
      {
        id: 'callout-danger',
        category: 'Callouts & Destaques',
        title: 'Perigo / Crítico',
        desc: 'Caixa vermelha para restrições e segurança',
        icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--md-sys-color-error)">error</span>',
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

      // 5. Técnico & Diagramas
      {
        id: 'mermaid',
        category: 'Técnico & Governança',
        title: 'Diagrama Mermaid',
        desc: 'Fluxogramas, sequências e arquitetura renderizados ao vivo',
        icon: '<span class="material-symbols-outlined icon-sm">schema</span>',
        keywords: ['mermaid', 'diagrama', 'fluxo', 'grafo', 'sequence', 'flowchart']
      },
      {
        id: 'code',
        category: 'Técnico & Governança',
        title: 'Bloco de Código',
        desc: 'Caixa com destaque de sintaxe e botão de cópia',
        icon: '<span class="material-symbols-outlined icon-sm">code</span>',
        keywords: ['code', 'codigo', 'bloco', 'pre', 'snippet', 'python', 'javascript']
      },
      {
        id: 'quote',
        category: 'Técnico & Governança',
        title: 'Citação em Bloco',
        desc: 'Texto em destaque com barra lateral',
        icon: '<span class="material-symbols-outlined icon-sm">format_quote</span>',
        keywords: ['quote', 'citacao', 'blockquote']
      }
    ];

    this.init();
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'slash-menu-popover';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="slash-menu-search">
        <span class="material-symbols-outlined icon-sm" style="color: var(--md-sys-color-on-surface-variant)">search</span>
        <input type="text" placeholder="Filtrar componente..." spellcheck="false" />
      </div>
      <div class="slash-menu-list"></div>
    `;

    document.body.appendChild(this.element);

    this.searchInput = this.element.querySelector('input');
    this.listContainer = this.element.querySelector('.slash-menu-list');

    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value.toLowerCase().trim();
      this.renderList();
    });

    this.searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Fecha ao clicar fora
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen && !this.element.contains(e.target)) {
        this.close();
      }
    });
  }

  openAtCaret(initialQuery = '') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    this.triggerRange = selection.getRangeAt(0).cloneRange();
    const rect = this.triggerRange.getBoundingClientRect();

    this.element.style.display = 'flex';
    
    // Posiciona logo abaixo do cursor
    const left = Math.min(rect.left, window.innerWidth - 340);
    const top = rect.bottom + 8;
    this.element.style.left = `${Math.max(16, left)}px`;
    this.element.style.top = `${top}px`;

    this.isOpen = true;
    this.query = initialQuery;
    this.searchInput.value = initialQuery;
    this.renderList();

    setTimeout(() => {
      this.searchInput.focus();
    }, 50);
  }

  renderList() {
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
        const cmdId = item.dataset.id;
        this.selectCommand(cmdId);
      });
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(item.dataset.index, 10);
        this.updateActiveItem();
      });
    });

    this.scrollActiveItemIntoView();
  }

  updateActiveItem() {
    const items = this.listContainer.querySelectorAll('.slash-menu-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === this.selectedIndex);
    });
  }

  scrollActiveItemIntoView() {
    const activeEl = this.listContainer.querySelector('.slash-menu-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  handleKeydown(e) {
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

  selectCommand(commandId) {
    this.close();
    this.onSelectCommand(commandId, this.triggerRange);
  }

  close() {
    if (this.isOpen) {
      this.element.style.display = 'none';
      this.isOpen = false;
      this.query = '';
      this.searchInput.value = '';
    }
  }

  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

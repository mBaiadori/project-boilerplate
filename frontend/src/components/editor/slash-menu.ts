import type { DictionaryTerm } from '../../types';

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
  dictionaryTerms: DictionaryTerm[] = [];

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

    // 2. Links & Hiperlinks
    {
      id: 'link',
      category: 'Links & Hiperlinks',
      title: 'Inserir Link',
      desc: 'Adicionar hiperlink web, documento do workspace ou trecho',
      icon: '<span class="material-symbols-outlined icon-sm">link</span>',
      keywords: ['link', 'url', 'href', 'hiperlink', 'documento', 'doc', 'trecho', 'deeplink', 'web', 'site', 'referencia']
    },

    // 3. Tabelas & Estrutura
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
    onSelectCommand,
    dictionaryTerms,
  }: {
    container: HTMLElement;
    onSelectCommand?: (cmdId: string, targetRange: Range | null) => void;
    dictionaryTerms?: DictionaryTerm[];
  }) {
    this.container = container;
    this.onSelectCommand = onSelectCommand || (() => {});
    this.dictionaryTerms = dictionaryTerms || [];
    this.init();
  }

  setDictionaryTerms(terms: DictionaryTerm[]) {
    this.dictionaryTerms = terms || [];
  }

  init() {
    this.element = document.createElement('div');
    this.element.className = 'slash-menu-popover';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="slash-menu-search">
        <span class="material-symbols-outlined icon-sm" style="color: #64748b;">search</span>
        <input type="text" placeholder="Filtrar componente ou termo..." spellcheck="false" />
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
    const menuWidth = this.element.offsetWidth || 340;
    const menuHeight = this.element.offsetHeight || 320;
    const maxAllowedHeight = Math.min(380, viewportHeight - 28);

    // Obtém o wrapper do editor para respeitar os limites do canvas
    const editorWrapper = document.getElementById('notion-editor-wrapper') || this.container;
    const wrapperRect = editorWrapper ? editorWrapper.getBoundingClientRect() : null;

    // 1. Cálculo Horizontal (Clamp para viewport e wrapper do editor)
    let left = rect.left;
    const minLeft = wrapperRect ? Math.max(margin, wrapperRect.left + 8) : margin;
    const maxLeft = wrapperRect 
      ? Math.min(viewportWidth - menuWidth - margin, wrapperRect.right - menuWidth - 8)
      : viewportWidth - menuWidth - margin;

    if (maxLeft >= minLeft) {
      left = Math.max(minLeft, Math.min(left, maxLeft));
    } else {
      left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));
    }

    // 2. Cálculo Vertical (Smart Flip & Clamp para não cortar no topo ou rodapé)
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    // Se houver pelo menos 220px abaixo ou se o espaço abaixo for maior que acima
    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      const availableHeight = Math.min(maxAllowedHeight, Math.max(140, Math.floor(spaceBelow - 8)));
      this.element.style.maxHeight = `${availableHeight}px`;
      const topPos = Math.min(viewportHeight - availableHeight - margin, Math.max(margin, rect.bottom + 6));
      this.element.style.top = `${Math.round(topPos)}px`;
      this.element.style.bottom = 'auto';
    } else {
      // Inverte para cima (Flip upwards)
      const availableHeight = Math.min(maxAllowedHeight, Math.max(140, Math.floor(spaceAbove - 8)));
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
    this.selectedIndex = 0;
    this.query = initialQuery;

    if (this.searchInput) {
      this.searchInput.value = initialQuery;
    }

    this.element.style.display = 'flex';
    this.element.style.visibility = 'hidden';

    this.renderList();
    this.positionMenu();

    this.element.style.visibility = 'visible';

    // Foco imediato no campo de pesquisa das ferramentas
    this.focusSearchInput();

    // Reforça foco e cálculo de posição após renderização
    requestAnimationFrame(() => {
      this.positionMenu();
      this.focusSearchInput();
    });

    setTimeout(() => {
      this.positionMenu();
      this.focusSearchInput();
    }, 25);
  }

  focusSearchInput() {
    if (this.searchInput) {
      this.searchInput.focus();
      this.searchInput.select();
    }
  }

  renderList() {
    if (!this.listContainer) return;

    // Combina comandos padrão com termos do dicionário
    const allAvailableCommands: SlashCommand[] = [...this.commands];
    if (this.dictionaryTerms && this.dictionaryTerms.length > 0) {
      this.dictionaryTerms.forEach((dt) => {
        allAvailableCommands.push({
          id: `term:${dt.term}`,
          category: 'Glossário & Termos',
          title: dt.term,
          desc: dt.definition || 'Termo do dicionário do workspace',
          icon: '<span class="material-symbols-outlined icon-sm" style="color: var(--primary, #2563eb)">menu_book</span>',
          keywords: [dt.term.toLowerCase(), ...(dt.synonyms || []).map(s => s.toLowerCase()), 'termo', 'glossario', 'dicionario']
        });
      });
    }

    if (!this.query) {
      this.filteredItems = allAvailableCommands;
    } else {
      const q = this.query.toLowerCase();
      this.filteredItems = allAvailableCommands.filter((cmd) => {
        return (
          cmd.title.toLowerCase().includes(q) ||
          cmd.desc.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.toLowerCase().includes(q))
        );
      });
    }

    if (this.filteredItems.length === 0) {
      this.listContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-dim, #94a3b8); font-size: 13px;">
          Nenhuma ferramenta encontrada para "<strong>${escapeHtml(this.query)}</strong>"
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
        html += `<div class="slash-menu-category">${escapeHtml(currentCat)}</div>`;
      }

      const isActive = idx === this.selectedIndex;
      html += `
        <div class="slash-menu-item ${isActive ? 'active' : ''}" data-index="${idx}" data-id="${escapeHtml(cmd.id)}">
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
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

  navigateDown() {
    if (this.filteredItems.length > 0) {
      this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
      this.updateActiveItem();
      this.scrollActiveItemIntoView();
    }
  }

  navigateUp() {
    if (this.filteredItems.length > 0) {
      this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
      this.updateActiveItem();
      this.scrollActiveItemIntoView();
    }
  }

  applySelected() {
    if (this.filteredItems.length > 0 && this.filteredItems[this.selectedIndex]) {
      this.selectCommand(this.filteredItems[this.selectedIndex].id);
    }
  }

  handleKeydown(e: KeyboardEvent) {
    if (!this.isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.navigateDown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.navigateUp();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.applySelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        this.navigateUp();
      } else {
        this.navigateDown();
      }
    }
  }

  selectCommand(commandId: string) {
    const range = this.triggerRange;
    this.close(false);
    this.onSelectCommand(commandId, range);
  }

  close(restoreFocus = true) {
    if (this.isOpen && this.element) {
      this.element.style.display = 'none';
      this.isOpen = false;
      this.query = '';
      if (this.searchInput) {
        this.searchInput.value = '';
      }

      if (restoreFocus && this.triggerRange) {
        const sel = window.getSelection();
        if (sel) {
          try {
            sel.removeAllRanges();
            sel.addRange(this.triggerRange);
          } catch (_) {}
        }
      }
    }
  }

  hide() {
    this.close(false);
  }

  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
    }
  }
}

// =============================================================================
// COMPONENT: NOTION-LIKE LIVE INTERACTIVE MARKDOWN EDITOR (PRO NOTION UX)
// Inclui Side Block Handles ('+' e '⋮⋮'), Auto-formatação Markdown (#, ##, -, 1., []),
// Smart Backspace, Context Menu de Blocos, Tabelas, Callouts e Diagramas Mermaid.
// =============================================================================

import { SlashMenu } from './slash-menu.js';
import { BubbleMenu } from './bubble-menu.js';
import { NotionTable } from './notion-table.js';

export class NotionEditor {
  constructor({ canvasElement, onChange, onSave }) {
    this.canvas = canvasElement;
    this.onChange = onChange || (() => {});
    this.onSave = onSave || (() => {});

    this.undoStack = [];
    this.redoStack = [];
    this.isComposing = false;
    this.historyTimer = null;
    this.MAX_HISTORY = 150;

    this.slashMenu = null;
    this.bubbleMenu = null;
    this.sideHandle = null;
    this.blockMenu = null;
    this.hoveredBlock = null;

    this.init();
  }

  init() {
    this.canvas.setAttribute('contenteditable', 'true');
    this.canvas.setAttribute('spellcheck', 'false');
    this.canvas.classList.add('notion-canvas');

    // 1. Inicializa Menus Flutuantes
    this.slashMenu = new SlashMenu({
      container: this.canvas,
      onSelectCommand: (cmdId, targetRange) => this.handleSlashCommand(cmdId, targetRange)
    });

    this.bubbleMenu = new BubbleMenu({
      container: this.canvas,
      onFormat: () => this.recordChange()
    });

    // 2. Inicializa Side Handle ('+' e '⋮⋮') e Menu de Contexto
    this.initSideHandles();

    // 3. Eventos de Teclado, Input e Mouse
    this.canvas.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.canvas.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.canvas.addEventListener('input', (e) => this.handleInput(e));
    this.canvas.addEventListener('paste', (e) => this.handlePaste(e));

    // Clique em checkboxes de todo-lists e ícones de callout
    this.canvas.addEventListener('click', (e) => {
      if (e.target.classList.contains('notion-todo-checkbox')) {
        const item = e.target.closest('.notion-todo-item');
        if (item) {
          item.classList.toggle('checked', e.target.checked);
          this.recordChange();
        }
      } else if (e.target.classList.contains('notion-callout-icon')) {
        this.toggleCalloutType(e.target.closest('.notion-callout'));
      }
    });

    // Se estiver vazio, inicializa com parágrafo inicial
    if (!this.canvas.innerHTML.trim()) {
      this.canvas.innerHTML = '<p><br></p>';
    }
  }

  // ===========================================================================
  // NOTION SIDE GUTTER HANDLES ('+' e '⋮⋮') & CONTEXT MENU
  // ===========================================================================

  initSideHandles() {
    this.sideHandle = document.createElement('div');
    this.sideHandle.className = 'notion-side-handle';
    this.sideHandle.innerHTML = `
      <button type="button" class="btn-side-handle" data-action="add-block" title="Adicionar bloco abaixo (+)">+</button>
      <button type="button" class="btn-side-handle" data-action="block-options" draggable="true" title="Arraste para mover ou clique para opções (⋮⋮)">⋮⋮</button>
    `;
    document.body.appendChild(this.sideHandle);

    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'notion-drop-indicator';
    this.dropIndicator.style.display = 'none';
    document.body.appendChild(this.dropIndicator);

    this.blockMenu = document.createElement('div');
    this.blockMenu.className = 'notion-block-menu';
    this.blockMenu.innerHTML = `
      <div class="block-menu-section">Ações do Bloco</div>
      <div class="block-menu-item" data-action="move-up"><span class="material-symbols-outlined icon-xs">arrow_upward</span> Mover para Cima</div>
      <div class="block-menu-item" data-action="move-down"><span class="material-symbols-outlined icon-xs">arrow_downward</span> Mover para Baixo</div>
      <div class="block-menu-item" data-action="duplicate"><span class="material-symbols-outlined icon-xs">content_copy</span> Duplicar Bloco</div>
      <div class="block-menu-item danger" data-action="delete"><span class="material-symbols-outlined icon-xs">delete</span> Excluir Bloco</div>
      <div class="block-menu-divider"></div>
      <div class="block-menu-section">Transformar em...</div>
      <div class="block-menu-item" data-turn="p"><span class="material-symbols-outlined icon-xs">notes</span> Texto Normal</div>
      <div class="block-menu-item" data-turn="h1"><span class="material-symbols-outlined icon-xs">format_h1</span> Título 1</div>
      <div class="block-menu-item" data-turn="h2"><span class="material-symbols-outlined icon-xs">format_h2</span> Título 2</div>
      <div class="block-menu-item" data-turn="h3"><span class="material-symbols-outlined icon-xs">format_h3</span> Título 3</div>
      <div class="block-menu-item" data-turn="todo"><span class="material-symbols-outlined icon-xs">check_box</span> Checklist</div>
      <div class="block-menu-item" data-turn="callout"><span class="material-symbols-outlined icon-xs">info</span> Caixa de Destaque</div>
      <div class="block-menu-item" data-turn="quote"><span class="material-symbols-outlined icon-xs">format_quote</span> Citação</div>
      <div class="block-menu-item" data-turn="code"><span class="material-symbols-outlined icon-xs">code</span> Bloco de Código</div>
    `;
    document.body.appendChild(this.blockMenu);

    const dragBtn = this.sideHandle.querySelector('[data-action="block-options"]');

    // 1. DRAG & DROP NATIVO DE BLOCOS
    dragBtn.addEventListener('dragstart', (e) => {
      if (!this.hoveredBlock) return;
      this.draggedBlock = this.hoveredBlock;
      e.dataTransfer.setData('text/plain', '');
      e.dataTransfer.effectAllowed = 'move';
      this.hoveredBlock.style.opacity = '0.4';
      this.blockMenu.style.display = 'none';
    });

    dragBtn.addEventListener('dragend', () => {
      if (this.draggedBlock) {
        this.draggedBlock.style.opacity = '1';
        this.draggedBlock = null;
      }
      this.dropIndicator.style.display = 'none';
    });

    this.canvas.addEventListener('dragover', (e) => {
      if (!this.draggedBlock) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const target = this.findTopLevelBlock(e.target);
      if (target && target !== this.canvas && target !== this.draggedBlock) {
        this.dropTargetBlock = target;
        const rect = target.getBoundingClientRect();
        const isUpperHalf = e.clientY < rect.top + rect.height / 2;
        this.dropPosition = isUpperHalf ? 'before' : 'after';

        this.dropIndicator.style.display = 'block';
        this.dropIndicator.style.left = `${rect.left}px`;
        this.dropIndicator.style.width = `${rect.width}px`;
        this.dropIndicator.style.top = isUpperHalf ? `${rect.top - 2}px` : `${rect.bottom - 1}px`;
      }
    });

    this.canvas.addEventListener('dragleave', (e) => {
      if (!this.canvas.contains(e.relatedTarget)) {
        this.dropIndicator.style.display = 'none';
      }
    });

    this.canvas.addEventListener('drop', (e) => {
      if (!this.draggedBlock || !this.dropTargetBlock) return;
      e.preventDefault();

      if (this.dropPosition === 'before') {
        this.dropTargetBlock.insertAdjacentElement('beforebegin', this.draggedBlock);
      } else {
        this.dropTargetBlock.insertAdjacentElement('afterend', this.draggedBlock);
      }

      this.dropIndicator.style.display = 'none';
      this.draggedBlock.style.opacity = '1';
      this.draggedBlock = null;
      this.dropTargetBlock = null;
      this.recordChange();
    });

    // 2. Posicionamento do Side Handle no Hover
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.draggedBlock) return;
      if (!this.canvas.offsetParent) {
        this.hideFloatingMenus();
        return;
      }
      const block = this.findTopLevelBlock(e.target);
      if (block && block !== this.canvas) {
        this.hoveredBlock = block;
        const rect = block.getBoundingClientRect();
        this.sideHandle.style.display = 'flex';
        this.sideHandle.style.left = `${rect.left - 54}px`;
        this.sideHandle.style.top = `${rect.top + 2}px`;
      }
    });

    this.canvas.addEventListener('mouseleave', (e) => {
      setTimeout(() => {
        const isOverHandle = this.sideHandle && this.sideHandle.matches(':hover');
        const isOverMenu = this.blockMenu && this.blockMenu.matches(':hover');
        if (!isOverHandle && !isOverMenu) {
          if (this.sideHandle) this.sideHandle.style.display = 'none';
        }
      }, 60);
    });

    this.sideHandle.addEventListener('mouseenter', () => {
      this.sideHandle.style.display = 'flex';
    });

    this.sideHandle.addEventListener('mouseleave', () => {
      setTimeout(() => {
        const isOverCanvas = this.canvas && this.canvas.matches(':hover');
        const isOverMenu = this.blockMenu && this.blockMenu.matches(':hover');
        if (!isOverCanvas && !isOverMenu) {
          if (this.sideHandle) this.sideHandle.style.display = 'none';
        }
      }, 60);
    });

    // 3. Clique no botão '+'
    this.sideHandle.querySelector('[data-action="add-block"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.hoveredBlock) return;
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      this.hoveredBlock.insertAdjacentElement('afterend', newP);
      this.placeCursorIn(newP);
      this.slashMenu.openAtCaret('');
      this.recordChange();
    });

    // 4. Clique no botão '⋮⋮' (Opções)
    dragBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.hoveredBlock) return;
      const rect = this.sideHandle.getBoundingClientRect();
      this.blockMenu.style.display = 'flex';
      const menuWidth = 230;
      const left = Math.min(rect.right + 6, window.innerWidth - menuWidth - 10);
      this.blockMenu.style.left = `${Math.max(10, left)}px`;
      this.blockMenu.style.top = `${rect.top}px`;
    });

    // 5. Ações do Menu de Bloco
    this.blockMenu.querySelectorAll('.block-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const turn = item.dataset.turn;
        this.blockMenu.style.display = 'none';

        if (!this.hoveredBlock) return;

        if (action === 'move-up') {
          const prev = this.hoveredBlock.previousElementSibling;
          if (prev) {
            prev.insertAdjacentElement('beforebegin', this.hoveredBlock);
            this.recordChange();
          }
        } else if (action === 'move-down') {
          const next = this.hoveredBlock.nextElementSibling;
          if (next) {
            next.insertAdjacentElement('afterend', this.hoveredBlock);
            this.recordChange();
          }
        } else if (action === 'delete') {
          this.hoveredBlock.remove();
          if (!this.canvas.children.length) this.canvas.innerHTML = '<p><br></p>';
          this.recordChange();
        } else if (action === 'duplicate') {
          const clone = this.hoveredBlock.cloneNode(true);
          this.hoveredBlock.insertAdjacentElement('afterend', clone);
          this.attachInteractiveListeners();
          this.recordChange();
        } else if (turn) {
          this.turnBlockInto(this.hoveredBlock, turn);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!this.blockMenu.contains(e.target)) {
        this.blockMenu.style.display = 'none';
      }
    });
  }

  hideFloatingMenus() {
    if (this.sideHandle) this.sideHandle.style.display = 'none';
    if (this.blockMenu) this.blockMenu.style.display = 'none';
    if (this.dropIndicator) this.dropIndicator.style.display = 'none';
    if (this.bubbleMenu && typeof this.bubbleMenu.hide === 'function') this.bubbleMenu.hide();
    if (this.slashMenu && typeof this.slashMenu.hide === 'function') this.slashMenu.hide();
  }

  findTopLevelBlock(node) {
    let current = node;
    while (current && current.parentElement && current.parentElement !== this.canvas) {
      current = current.parentElement;
    }
    return current;
  }

  turnBlockInto(block, type) {
    const text = block.textContent.trim();
    let newEl = null;

    if (type === 'h1') newEl = document.createElement('h1');
    else if (type === 'h2') newEl = document.createElement('h2');
    else if (type === 'h3') newEl = document.createElement('h3');
    else if (type === 'p') newEl = document.createElement('p');
    else if (type === 'quote') newEl = document.createElement('blockquote');
    else if (type === 'todo') {
      const div = document.createElement('div');
      div.innerHTML = this.createTodoItemHtml(text || 'Nova tarefa');
      newEl = div.firstElementChild;
    } else if (type === 'callout') {
      const div = document.createElement('div');
      div.innerHTML = this.createCalloutBlockHtml('note', text || 'Nota de destaque...');
      newEl = div.firstElementChild;
    } else if (type === 'code') {
      const div = document.createElement('div');
      div.innerHTML = this.createCodeBlockHtml('javascript', text || '// Código');
      newEl = div.firstElementChild;
    }

    if (newEl && !['todo', 'callout', 'code'].includes(type)) {
      newEl.textContent = text || '';
      if (!newEl.innerHTML) newEl.innerHTML = '<br>';
    }

    if (newEl) {
      block.replaceWith(newEl);
      this.attachInteractiveListeners();
      this.placeCursorIn(newEl);
      this.recordChange();
    }
  }

  toggleCalloutType(calloutEl) {
    if (!calloutEl) return;
    const types = ['note', 'tip', 'warning', 'danger'];
    const current = calloutEl.dataset.type || 'note';
    const nextIdx = (types.indexOf(current) + 1) % types.length;
    const nextType = types[nextIdx];

    calloutEl.dataset.type = nextType;
    const iconSpan = calloutEl.querySelector('.notion-callout-icon');
    if (iconSpan) {
      const iconMap = {
        note: 'info',
        tip: 'check_circle',
        warning: 'warning',
        danger: 'error'
      };
      iconSpan.textContent = iconMap[nextType] || 'info';
    }
    this.recordChange();
  }

  // ===========================================================================
  // MARKDOWN TO DOM (PARSER)
  // ===========================================================================

  setMarkdown(markdown = '') {
    if (!markdown.trim()) {
      this.canvas.innerHTML = '<p><br></p>';
      this.pushSnapshot(true);
      return;
    }

    const lines = markdown.split(/\r?\n/);
    const htmlFragments = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Mermaid Code Block
      if (line.trim().startsWith('```mermaid')) {
        let code = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          code += lines[i] + '\n';
          i++;
        }
        i++;
        htmlFragments.push(this.createMermaidBlockHtml(code.trim()));
        continue;
      }

      // 2. Generic Code Block
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '').trim() || 'text';
        let code = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          code += lines[i] + '\n';
          i++;
        }
        i++;
        htmlFragments.push(this.createCodeBlockHtml(lang, code.trim()));
        continue;
      }

      // 3. Dropdown / Toggle List (<details><summary>...</summary>...</details>)
      if (line.trim().startsWith('<details') || line.trim().startsWith('<details>')) {
        let toggleContent = '';
        let summaryTitle = 'Seção Expansível';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('</details>')) {
          const sumMatch = lines[i].match(/<summary>(.*?)<\/summary>/i);
          if (sumMatch) {
            summaryTitle = sumMatch[1].trim();
          } else {
            toggleContent += lines[i] + '\n';
          }
          i++;
        }
        i++;
        htmlFragments.push(this.createToggleBlockHtml(summaryTitle, toggleContent.trim()));
        continue;
      }

      // 4. Callout / Alert Box
      const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|DANGER|CAUTION|INFO|SUCCESS)\]/i);
      if (calloutMatch) {
        const rawType = calloutMatch[1].toLowerCase();
        let type = 'note';
        if (['tip', 'success'].includes(rawType)) type = 'tip';
        else if (['warning'].includes(rawType)) type = 'warning';
        else if (['danger', 'caution'].includes(rawType)) type = 'danger';

        let calloutBody = '';
        i++;
        while (i < lines.length && lines[i].startsWith('>')) {
          calloutBody += lines[i].replace(/^>\s?/, '') + '\n';
          i++;
        }
        htmlFragments.push(this.createCalloutBlockHtml(type, calloutBody.trim()));
        continue;
      }

      // 5. GFM Table
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        htmlFragments.push(this.createTableFromMarkdown(tableLines));
        continue;
      }

      // 6. To-Do Checklist
      const todoMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
      if (todoMatch) {
        const isChecked = todoMatch[2].toLowerCase() === 'x';
        const text = todoMatch[3];
        htmlFragments.push(this.createTodoItemHtml(text, isChecked));
        i++;
        continue;
      }

      // 7. Headings
      const h1Match = line.match(/^#\s+(.*)$/);
      if (h1Match) {
        htmlFragments.push(`<h1>${this.parseInlineMarkdown(h1Match[1])}</h1>`);
        i++;
        continue;
      }
      const h2Match = line.match(/^##\s+(.*)$/);
      if (h2Match) {
        htmlFragments.push(`<h2>${this.parseInlineMarkdown(h2Match[1])}</h2>`);
        i++;
        continue;
      }
      const h3Match = line.match(/^###\s+(.*)$/);
      if (h3Match) {
        htmlFragments.push(`<h3>${this.parseInlineMarkdown(h3Match[1])}</h3>`);
        i++;
        continue;
      }
      const h4Match = line.match(/^####\s+(.*)$/);
      if (h4Match) {
        htmlFragments.push(`<h4>${this.parseInlineMarkdown(h4Match[1])}</h4>`);
        i++;
        continue;
      }

      // 8. Horizontal Rule
      if (line.match(/^(\*{3,}|-{3,}|_{3,})$/)) {
        htmlFragments.push('<hr>');
        i++;
        continue;
      }

      // 9. Blockquote
      if (line.startsWith('>')) {
        let quoteText = '';
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteText += lines[i].replace(/^>\s?/, '') + ' ';
          i++;
        }
        htmlFragments.push(`<blockquote>${this.parseInlineMarkdown(quoteText.trim())}</blockquote>`);
        continue;
      }

      // 10. Bullet List
      if (line.match(/^[-*+]\s+(.*)$/)) {
        let listHtml = '<ul>';
        while (i < lines.length && lines[i].match(/^[-*+]\s+(.*)$/)) {
          const itemText = lines[i].replace(/^[-*+]\s+/, '');
          listHtml += `<li>${this.parseInlineMarkdown(itemText)}</li>`;
          i++;
        }
        listHtml += '</ul>';
        htmlFragments.push(listHtml);
        continue;
      }

      // 11. Numbered List
      if (line.match(/^\d+\.\s+(.*)$/)) {
        let listHtml = '<ol>';
        while (i < lines.length && lines[i].match(/^\d+\.\s+(.*)$/)) {
          const itemText = lines[i].replace(/^\d+\.\s+/, '');
          listHtml += `<li>${this.parseInlineMarkdown(itemText)}</li>`;
          i++;
        }
        listHtml += '</ol>';
        htmlFragments.push(listHtml);
        continue;
      }

      // 12. Paragraph
      if (!line.trim()) {
        htmlFragments.push('<p><br></p>');
      } else {
        htmlFragments.push(`<p>${this.parseInlineMarkdown(line)}</p>`);
      }
      i++;
    }

    this.canvas.innerHTML = htmlFragments.join('\n');
    this.renderAllMermaidBlocks();
    this.attachInteractiveListeners();
    this.pushSnapshot(true);
  }

  // ===========================================================================
  // DOM TO MARKDOWN (SERIALIZER)
  // ===========================================================================

  getMarkdown() {
    const lines = [];
    const children = Array.from(this.canvas.children);

    for (const node of children) {
      if (node.classList && (node.classList.contains('notion-inline-diff-card') || node.classList.contains('not-prose'))) {
        continue;
      }

      const tag = node.tagName ? node.tagName.toLowerCase() : '';

      if (tag === 'h1') {
        lines.push(`# ${this.serializeInline(node)}`);
        lines.push('');
      } else if (tag === 'h2') {
        lines.push(`## ${this.serializeInline(node)}`);
        lines.push('');
      } else if (tag === 'h3') {
        lines.push(`### ${this.serializeInline(node)}`);
        lines.push('');
      } else if (tag === 'h4') {
        lines.push(`#### ${this.serializeInline(node)}`);
        lines.push('');
      } else if (tag === 'p') {
        const text = this.serializeInline(node).trim();
        lines.push(text);
        lines.push('');
      } else if (tag === 'hr') {
        lines.push('---');
        lines.push('');
      } else if (tag === 'blockquote') {
        const text = this.serializeInline(node).trim();
        lines.push(`> ${text}`);
        lines.push('');
      } else if (tag === 'ul') {
        node.querySelectorAll('li').forEach(li => {
          lines.push(`- ${this.serializeInline(li)}`);
        });
        lines.push('');
      } else if (tag === 'ol') {
        let idx = 1;
        node.querySelectorAll('li').forEach(li => {
          lines.push(`${idx}. ${this.serializeInline(li)}`);
          idx++;
        });
        lines.push('');
      } else if (node.classList.contains('notion-table-block') || node.classList.contains('notion-table-wrapper')) {
        lines.push(this.serializeTable(node));
        lines.push('');
      } else if (node.classList.contains('notion-toggle') || tag === 'details') {
        lines.push(this.serializeToggle(node));
        lines.push('');
      } else if (node.classList.contains('notion-callout')) {
        lines.push(this.serializeCallout(node));
        lines.push('');
      } else if (node.classList.contains('notion-todo-item')) {
        const chk = node.querySelector('.notion-todo-checkbox');
        const isChecked = chk ? chk.checked : false;
        const textEl = node.querySelector('.notion-todo-text') || node;
        const text = this.serializeInline(textEl).trim();
        lines.push(`- [${isChecked ? 'x' : ' '}] ${text}`);
      } else if (node.classList.contains('notion-code-block')) {
        const langEl = node.querySelector('.notion-code-lang');
        const codeEl = node.querySelector('.notion-code-content') || node.querySelector('code');
        const lang = langEl ? langEl.textContent.trim().toLowerCase() : '';
        const code = codeEl ? codeEl.innerText : '';
        lines.push(`\`\`\`${lang}`);
        lines.push(code);
        lines.push('```');
        lines.push('');
      } else if (node.classList.contains('notion-mermaid-block')) {
        const textarea = node.querySelector('.notion-mermaid-textarea');
        const code = textarea ? textarea.value.trim() : (node.dataset.mermaidCode || '');
        lines.push('```mermaid');
        lines.push(code);
        lines.push('```');
        lines.push('');
      } else {
        const text = this.serializeInline(node).trim();
        if (text) {
          lines.push(text);
          lines.push('');
        }
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ===========================================================================
  // SERIALIZERS AUXILIARES
  // ===========================================================================

  parseInlineMarkdown(text) {
    if (!text) return '<br>';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  }

  serializeInline(element) {
    if (!element) return '';
    let result = '';

    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'strong' || tag === 'b') {
          result += `**${this.serializeInline(child)}**`;
        } else if (tag === 'em' || tag === 'i') {
          result += `*${this.serializeInline(child)}*`;
        } else if (tag === 's' || tag === 'strike') {
          result += `~~${this.serializeInline(child)}~~`;
        } else if (tag === 'code') {
          result += `\`${child.textContent}\``;
        } else if (tag === 'a') {
          const href = child.getAttribute('href') || '#';
          result += `[${this.serializeInline(child)}](${href})`;
        } else if (tag === 'br') {
          result += '\n';
        } else {
          result += this.serializeInline(child);
        }
      }
    });

    return result;
  }

  serializeTable(wrapper) {
    const table = wrapper.querySelector('table');
    if (!table) return '';

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    const mdLines = [];
    rows.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll('th, td'));
      const rowStr = '| ' + cells.map(c => this.serializeInline(c).trim() || ' ').join(' | ') + ' |';
      mdLines.push(rowStr);

      if (rIdx === 0) {
        const sepStr = '| ' + cells.map(() => '---').join(' | ') + ' |';
        mdLines.push(sepStr);
      }
    });

    return mdLines.join('\n');
  }

  serializeToggle(toggle) {
    const summary = toggle.querySelector('summary');
    const title = summary ? (summary.querySelector('.notion-toggle-summary-text')?.textContent || summary.textContent || 'Seção').trim() : 'Seção';
    const content = toggle.querySelector('.notion-toggle-content') || toggle;
    const body = this.serializeInline(content).trim();

    return `<details>\n<summary>${title}</summary>\n\n${body}\n</details>`;
  }

  serializeCallout(callout) {
    const type = (callout.dataset.type || 'note').toUpperCase();
    const content = callout.querySelector('.notion-callout-content') || callout;
    const body = this.serializeInline(content).trim();
    const lines = body.split('\n');

    return `> [!${type}]\n` + lines.map(l => `> ${l}`).join('\n');
  }

  // ===========================================================================
  // HTML GENERATORS
  // ===========================================================================

  createTableHtml(rows = 3, cols = 3) {
    return NotionTable.createDefaultHtml(rows, cols);
  }

  createTableFromMarkdown(tableLines) {
    return NotionTable.fromMarkdownLines(tableLines);
  }

  createToggleBlockHtml(title = 'Clique para expandir', content = 'Conteúdo oculto...') {
    return `
      <details class="notion-toggle" open>
        <summary>
          <span class="notion-toggle-summary-text" contenteditable="true">${escapeHtml(title)}</span>
        </summary>
        <div class="notion-toggle-content" contenteditable="true">
          <p>${this.parseInlineMarkdown(content)}</p>
        </div>
      </details>
    `;
  }

  createCalloutBlockHtml(type = 'note', content = 'Insira o contexto aqui...') {
    const iconMap = {
      note: 'info',
      tip: 'check_circle',
      warning: 'warning',
      danger: 'error'
    };
    const icon = iconMap[type] || 'info';

    return `
      <div class="notion-callout" data-type="${type}" contenteditable="false">
        <span class="notion-callout-icon material-symbols-outlined icon-sm" title="Clique para alternar tipo de alerta">${icon}</span>
        <div class="notion-callout-content" contenteditable="true">${this.parseInlineMarkdown(content)}</div>
      </div>
    `;
  }

  createTodoItemHtml(text = 'Nova tarefa', isChecked = false) {
    return `
      <div class="notion-todo-item ${isChecked ? 'checked' : ''}" contenteditable="false">
        <input type="checkbox" class="notion-todo-checkbox" ${isChecked ? 'checked' : ''} />
        <span class="notion-todo-text" contenteditable="true">${this.parseInlineMarkdown(text)}</span>
      </div>
    `;
  }

  createCodeBlockHtml(lang = 'javascript', code = '// Código aqui') {
    return `
      <div class="notion-code-block" contenteditable="false">
        <div class="notion-code-header">
          <span class="notion-code-lang">${escapeHtml(lang)}</span>
          <button type="button" class="btn-code-copy">Copiar</button>
        </div>
        <pre class="notion-code-content" contenteditable="true"><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  }

  createMermaidBlockHtml(code = 'flowchart TD\n  A[Início] --> B[Processo]\n  B --> C[Fim]') {
    const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return `
      <div class="notion-mermaid-block" id="${id}" data-mermaid-code="${escapeHtml(code)}" contenteditable="false">
        <div class="notion-mermaid-header">
          <div class="notion-mermaid-title">
            <span class="material-symbols-outlined icon-xs">schema</span>
            <span>Diagrama Mermaid</span>
          </div>
          <div class="notion-mermaid-actions">
            <button type="button" class="btn-mermaid-action btn-toggle-mermaid-editor">Editar Código</button>
            <button type="button" class="btn-mermaid-action btn-refresh-mermaid">Renderizar</button>
          </div>
        </div>
        <div class="notion-mermaid-render">
          <span style="color:#94a3b8; font-size:12px;">Renderizando diagrama...</span>
        </div>
        <div class="notion-mermaid-editor">
          <textarea class="notion-mermaid-textarea" spellcheck="false">${escapeHtml(code)}</textarea>
        </div>
      </div>
    `;
  }

  // ===========================================================================
  // INTERACTIVE LISTENERS & MERMAID RENDERING
  // ===========================================================================

  attachInteractiveListeners() {
    // Inicialização das Tabelas com UX do Notion
    this.canvas.querySelectorAll('.notion-table-block, .notion-table-wrapper').forEach(wrapper => {
      new NotionTable({
        wrapper,
        onChange: () => this.recordChange()
      });
    });

    // Código
    this.canvas.querySelectorAll('.btn-code-copy').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const codeEl = btn.closest('.notion-code-block').querySelector('.notion-code-content');
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.innerText);
          btn.textContent = 'Copiado!';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
        }
      };
    });

    // Mermaid
    this.canvas.querySelectorAll('.notion-mermaid-block').forEach(block => {
      const btnToggle = block.querySelector('.btn-toggle-mermaid-editor');
      const btnRefresh = block.querySelector('.btn-refresh-mermaid');
      const editorPanel = block.querySelector('.notion-mermaid-editor');
      const textarea = block.querySelector('.notion-mermaid-textarea');

      if (btnToggle && editorPanel) {
        btnToggle.onclick = () => {
          const isHidden = editorPanel.style.display === 'none' || !editorPanel.style.display;
          editorPanel.style.display = isHidden ? 'block' : 'none';
          btnToggle.textContent = isHidden ? 'Fechar Editor' : 'Editar Código';
          if (isHidden && textarea) textarea.focus();
        };
      }

      if (btnRefresh && textarea) {
        btnRefresh.onclick = () => {
          block.dataset.mermaidCode = textarea.value.trim();
          this.renderMermaidBlock(block);
          this.recordChange();
        };
      }
    });
  }

  async renderAllMermaidBlocks() {
    const blocks = this.canvas.querySelectorAll('.notion-mermaid-block');
    for (const block of blocks) {
      await this.renderMermaidBlock(block);
    }
  }

  async renderMermaidBlock(block) {
    if (typeof mermaid === 'undefined') return;
    const renderArea = block.querySelector('.notion-mermaid-render');
    const textarea = block.querySelector('.notion-mermaid-textarea');
    const code = textarea ? textarea.value.trim() : (block.dataset.mermaidCode || '');

    if (!renderArea || !code) return;

    try {
      const renderId = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await mermaid.render(renderId, code);
      renderArea.innerHTML = svg;
    } catch (e) {
      renderArea.innerHTML = `
        <div style="color:#ef4444; font-size:12px; padding:12px; display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-outlined icon-xs">warning</span>
          <span>Erro na sintaxe Mermaid: ${escapeHtml(e.message || String(e))}</span>
        </div>
      `;
    }
  }

  // ===========================================================================
  // NOTION INPUT RULES (AUTO-FORMATTING ON TYPING '# ', '- ', '1. ', '[] ')
  // ===========================================================================

  handleKeyUp(e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      this.checkMarkdownInputRules();
    }
  }

  checkMarkdownInputRules() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const parent = node.parentElement;
    if (!parent || parent.tagName.toLowerCase() !== 'p') return;

    // Regras de conversão instantânea estilo Notion
    if (text.startsWith('# ')) {
      node.textContent = text.substring(2);
      this.turnBlockInto(parent, 'h1');
    } else if (text.startsWith('## ')) {
      node.textContent = text.substring(3);
      this.turnBlockInto(parent, 'h2');
    } else if (text.startsWith('### ')) {
      node.textContent = text.substring(4);
      this.turnBlockInto(parent, 'h3');
    } else if (text.startsWith('- ') || text.startsWith('* ')) {
      node.textContent = text.substring(2);
      const ul = document.createElement('ul');
      const li = document.createElement('li');
      li.innerHTML = node.textContent || '<br>';
      ul.appendChild(li);
      parent.replaceWith(ul);
      this.placeCursorIn(li);
      this.recordChange();
    } else if (text.startsWith('1. ')) {
      node.textContent = text.substring(3);
      const ol = document.createElement('ol');
      const li = document.createElement('li');
      li.innerHTML = node.textContent || '<br>';
      ol.appendChild(li);
      parent.replaceWith(ol);
      this.placeCursorIn(li);
      this.recordChange();
    } else if (text.startsWith('[] ') || text.startsWith('[ ] ')) {
      node.textContent = text.replace(/^\[\s?\]\s/, '');
      this.turnBlockInto(parent, 'todo');
    } else if (text.startsWith('> ')) {
      node.textContent = text.substring(2);
      this.turnBlockInto(parent, 'quote');
    } else if (text.startsWith('--- ')) {
      const hr = document.createElement('hr');
      parent.replaceWith(hr);
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      hr.insertAdjacentElement('afterend', newP);
      this.placeCursorIn(newP);
      this.recordChange();
    }
  }

  // ===========================================================================
  // ATALHOS DE TECLADO, SMART BACKSPACE & ENTER
  // ===========================================================================

  handleKeyDown(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    // Salvar: Ctrl+S
    if (modifier && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      this.onSave();
      return;
    }

    // Undo / Redo
    if (modifier && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((modifier && (e.key === 'y' || e.key === 'Y')) || (modifier && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      this.redo();
      return;
    }

    // Smart Backspace no início de blocos formatados
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        if (range.startOffset === 0) {
          const block = this.findTopLevelBlock(range.startContainer);
          if (block && block !== this.canvas) {
            const tag = block.tagName.toLowerCase();
            if (['h1', 'h2', 'h3', 'h4', 'blockquote'].includes(tag)) {
              e.preventDefault();
              this.turnBlockInto(block, 'p');
              return;
            } else if (block.classList.contains('notion-todo-item')) {
              e.preventDefault();
              this.turnBlockInto(block, 'p');
              return;
            } else if (block.classList.contains('notion-callout')) {
              e.preventDefault();
              this.turnBlockInto(block, 'p');
              return;
            }
          }
        }
      }
    }

    // Navegação em Células de Tabela com Tab
    if (e.key === 'Tab') {
      const cell = document.activeElement ? document.activeElement.closest('td, th') : null;
      if (cell) {
        e.preventDefault();
        const tr = cell.parentElement;
        const table = tr.closest('table');
        const allCells = Array.from(table.querySelectorAll('th, td'));
        const idx = allCells.indexOf(cell);

        if (e.shiftKey) {
          if (idx > 0) allCells[idx - 1].focus();
        } else {
          if (idx < allCells.length - 1) {
            allCells[idx + 1].focus();
          } else {
            const cols = table.querySelectorAll('thead tr th').length || 2;
            const newTr = document.createElement('tr');
            for (let i = 0; i < cols; i++) {
              newTr.innerHTML += '<td contenteditable="true"></td>';
            }
            table.querySelector('tbody').appendChild(newTr);
            this.recordChange();
            setTimeout(() => {
              newTr.querySelector('td')?.focus();
            }, 10);
          }
        }
        return;
      }
    }

    // Enter dentro de To-Do item cria novo To-Do
    if (e.key === 'Enter') {
      const todoItem = document.activeElement ? document.activeElement.closest('.notion-todo-item') : null;
      if (todoItem && !e.shiftKey) {
        e.preventDefault();
        const textSpan = todoItem.querySelector('.notion-todo-text');
        if (textSpan && !textSpan.textContent.trim()) {
          // Se estava vazio, converte para parágrafo normal
          this.turnBlockInto(todoItem, 'p');
          return;
        }

        const newItem = document.createElement('div');
        newItem.className = 'notion-todo-item';
        newItem.setAttribute('contenteditable', 'false');
        newItem.innerHTML = `
          <input type="checkbox" class="notion-todo-checkbox" />
          <span class="notion-todo-text" contenteditable="true"></span>
        `;
        todoItem.insertAdjacentElement('afterend', newItem);
        this.recordChange();
        setTimeout(() => {
          newItem.querySelector('.notion-todo-text')?.focus();
        }, 10);
        return;
      }
    }

    // Trigger da barra '/'
    if (e.key === '/' && !modifier) {
      setTimeout(() => {
        this.checkSlashTrigger();
      }, 10);
    }
  }

  checkSlashTrigger() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const text = node.textContent || '';
    const offset = range.startOffset;

    if (offset > 0 && text[offset - 1] === '/') {
      this.slashMenu.openAtCaret('');
    }
  }

  handleSlashCommand(cmdId, targetRange) {
    if (targetRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(targetRange);

      const node = targetRange.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE && node.textContent.includes('/')) {
        node.textContent = node.textContent.replace(/\/$/, '');
      }
    }

    switch (cmdId) {
      case 'h1':
        this.insertBlockHtml('<h1>Título 1</h1>');
        break;
      case 'h2':
        this.insertBlockHtml('<h2>Título 2</h2>');
        break;
      case 'h3':
        this.insertBlockHtml('<h3>Título 3</h3>');
        break;
      case 'table':
        this.insertBlockHtml(this.createTableHtml(2, 3));
        break;
      case 'toggle':
        this.insertBlockHtml(this.createToggleBlockHtml('Nova Seção Expansível', 'Conteúdo da seção...'));
        break;
      case 'divider':
        this.insertBlockHtml('<hr>');
        break;
      case 'callout-note':
        this.insertBlockHtml(this.createCalloutBlockHtml('note', 'Nota explicativa ou regra de negócio...'));
        break;
      case 'callout-tip':
        this.insertBlockHtml(this.createCalloutBlockHtml('tip', 'Dica de implementação ou boas práticas...'));
        break;
      case 'callout-warning':
        this.insertBlockHtml(this.createCalloutBlockHtml('warning', 'Atenção aos critérios de aceite e contratos...'));
        break;
      case 'callout-danger':
        this.insertBlockHtml(this.createCalloutBlockHtml('danger', 'Restrição crítica de segurança ou arquitetura...'));
        break;
      case 'todo':
        this.insertBlockHtml(this.createTodoItemHtml('Nova tarefa a executar', false));
        break;
      case 'bullet-list':
        this.insertBlockHtml('<ul><li>Item da lista</li></ul>');
        break;
      case 'number-list':
        this.insertBlockHtml('<ol><li>Primeiro passo</li></ol>');
        break;
      case 'mermaid':
        this.insertBlockHtml(this.createMermaidBlockHtml());
        break;
      case 'code':
        this.insertBlockHtml(this.createCodeBlockHtml('javascript', '// Seu código aqui'));
        break;
      case 'quote':
        this.insertBlockHtml('<blockquote>Citação em destaque...</blockquote>');
        break;
    }

    this.attachInteractiveListeners();
    this.renderAllMermaidBlocks();
    this.recordChange();
  }

  insertBlockHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    const element = div.firstElementChild;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let targetNode = range.startContainer;
      while (targetNode && targetNode.parentElement !== this.canvas && targetNode !== this.canvas) {
        targetNode = targetNode.parentElement;
      }

      if (targetNode && targetNode.parentElement === this.canvas) {
        if (!targetNode.textContent.trim()) {
          targetNode.replaceWith(element);
        } else {
          targetNode.insertAdjacentElement('afterend', element);
        }
      } else {
        this.canvas.appendChild(element);
      }
    } else {
      this.canvas.appendChild(element);
    }

    this.placeCursorIn(element);
  }

  placeCursorIn(element) {
    const target = element.querySelector('[contenteditable="true"]') || element;
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  handleInput(e) {
    this.recordChange();
  }

  handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
    this.recordChange();
  }

  recordChange() {
    clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => {
      this.pushSnapshot();
    }, 300);

    this.onChange();
  }

  pushSnapshot(force = false) {
    const html = this.canvas.innerHTML;
    if (!force && this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === html) {
      return;
    }

    this.undoStack.push(html);
    if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
    if (force) this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);

    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) {
      this.canvas.innerHTML = prev;
      this.attachInteractiveListeners();
      this.renderAllMermaidBlocks();
      this.onChange();
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);

    this.canvas.innerHTML = next;
    this.attachInteractiveListeners();
    this.renderAllMermaidBlocks();
    this.onChange();
  }

  insertTextAtCursor(text) {
    this.insertBlockHtml(`<p>${escapeHtml(text)}</p>`);
  }

  /**
   * Renders in-editor visual diff card marking the exact section to be modified
   */
  showInlineDiff({ search = '', replace = '', explanation = '', onAccept = null, onReject = null } = {}) {
    this.clearInlineDiff();

    const cleanSearch = (search || '').trim();
    const cleanReplace = (replace || '').trim();

    if (!cleanSearch && !cleanReplace) return false;

    const diffCard = document.createElement('div');
    diffCard.className = 'notion-inline-diff-card not-prose';
    diffCard.setAttribute('contenteditable', 'false');

    diffCard.innerHTML = `
      <div class="inline-diff-header">
        <div class="inline-diff-title">
          <span class="material-symbols-outlined icon-xs" style="color: #059669;">difference</span>
          <strong>Alteração Proposta pela IA ${explanation ? `&bull; <span style="font-weight: 400; color: var(--text-muted);">${escapeHtml(explanation)}</span>` : ''}</strong>
        </div>
        <div class="inline-diff-actions">
          <button type="button" class="btn-diff-accept" title="Aceitar e aplicar esta alteração no documento">
            <span class="material-symbols-outlined icon-xs">check</span> Aceitar
          </button>
          <button type="button" class="btn-diff-reject" title="Descartar esta alteração e manter original">
            <span class="material-symbols-outlined icon-xs">undo</span> Desfazer
          </button>
        </div>
      </div>
      <div class="inline-diff-body">
        ${cleanSearch && cleanSearch !== '*' ? `<div class="diff-del"><span class="diff-sign">-</span> ${escapeHtml(cleanSearch)}</div>` : ''}
        ${cleanReplace ? `<div class="diff-ins"><span class="diff-sign">+</span> ${escapeHtml(cleanReplace)}</div>` : ''}
      </div>
    `;

    // Handle Accept
    const btnAccept = diffCard.querySelector('.btn-diff-accept');
    btnAccept.addEventListener('click', (e) => {
      e.stopPropagation();
      this.applyInlineDiff(cleanSearch, cleanReplace);
      if (onAccept) onAccept();
    });

    // Handle Reject / Undo
    const btnReject = diffCard.querySelector('.btn-diff-reject');
    btnReject.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearInlineDiff();
      if (onReject) onReject();
    });

    // Try to position near matching node
    let targetNode = null;
    if (cleanSearch && cleanSearch !== '*') {
      const searchFirstLine = cleanSearch.split('\n')[0].replace(/^#+\s*/, '').trim();
      if (searchFirstLine) {
        for (const child of Array.from(this.canvas.children)) {
          if (child.textContent.includes(searchFirstLine)) {
            targetNode = child;
            break;
          }
        }
      }
    }

    if (targetNode) {
      this.canvas.insertBefore(diffCard, targetNode);
      diffCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (cleanSearch === '*' || !cleanSearch) {
      this.canvas.appendChild(diffCard);
      diffCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      this.canvas.prepend(diffCard);
      diffCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._activeDiffCard = diffCard;
    this._activeDiffData = { search: cleanSearch, replace: cleanReplace };
    return true;
  }

  /**
   * Removes active inline diff card without modifying document
   */
  clearInlineDiff() {
    const existing = this.canvas.querySelector('.notion-inline-diff-card');
    if (existing) {
      existing.remove();
    }
    this._activeDiffCard = null;
    this._activeDiffData = null;
  }

  /**
   * Applies inline diff permanently into the document
   */
  applyInlineDiff(search, replace) {
    this.clearInlineDiff();
    const currentMd = this.getMarkdown();
    let newMd = currentMd;

    if (search && currentMd.includes(search)) {
      newMd = currentMd.replace(search, replace);
    } else if (search) {
      const lines = currentMd.split('\n');
      const searchLines = search.split('\n').map(l => l.trim()).filter(Boolean);
      if (searchLines.length > 0) {
        const firstSearch = searchLines[0];
        const matchIdx = lines.findIndex(l => l.trim() === firstSearch);
        if (matchIdx !== -1) {
          lines.splice(matchIdx, searchLines.length, replace);
          newMd = lines.join('\n');
        } else {
          newMd = `${currentMd}\n\n${replace}`;
        }
      } else {
        newMd = `${currentMd}\n\n${replace}`;
      }
    } else {
      newMd = `${currentMd}\n\n${replace}`;
    }

    this.setMarkdown(newMd);
    this.recordChange();
    this.onChange(newMd);
  }

  destroy() {
    if (this.slashMenu) this.slashMenu.destroy();
    if (this.bubbleMenu) this.bubbleMenu.destroy();
    if (this.sideHandle && this.sideHandle.parentElement) this.sideHandle.remove();
    if (this.blockMenu && this.blockMenu.parentElement) this.blockMenu.remove();
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

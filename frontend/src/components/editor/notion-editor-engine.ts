// =============================================================================
// COMPONENT: NOTION-LIKE LIVE INTERACTIVE MARKDOWN EDITOR ENGINE (PRO NOTION UX)
// Side Block Handles ('+' e '⋮⋮'), Auto-formatação Markdown (#, ##, -, 1., []),
// Smart Backspace, Context Menu de Blocos, Tabelas, Callouts e Diagramas Mermaid.
// =============================================================================

import { SlashMenuEngine } from './slash-menu';
import { BubbleMenuEngine } from './bubble-menu';
import { NotionTable } from './notion-table';
import {
  parseTextFragmentUrl,
  findTextFragmentInElement,
  type TextFragmentQuery
} from '../../utils/text-fragment';

declare const mermaid: any;

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface FragmentStatusInfo {
  type: 'not_found' | 'fuzzy_match';
  exact: string;
  prefix?: string;
  suffix?: string;
  currentFoundText?: string;
}

export class NotionEditorEngine {
  canvas: HTMLElement;
  filePath: string | null = null;
  onChange: () => void;
  onSave: () => void;
  onNavigateFile?: (path: string) => void;
  onSendSelectionToCopilot?: (text: string) => void;
  onToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onOpenLinkModal?: (defaultText: string, callback: (url: string, text: string) => void, initialUrl?: string) => void;
  onFragmentStatus?: (info: FragmentStatusInfo | null) => void;

  undoStack: string[] = [];
  redoStack: string[] = [];
  isComposing = false;
  historyTimer: any = null;
  MAX_HISTORY = 150;

  slashMenu: SlashMenuEngine | null = null;
  bubbleMenu: BubbleMenuEngine | null = null;
  sideHandle: HTMLElement | null = null;
  blockMenu: HTMLElement | null = null;
  linkPopover: HTMLElement | null = null;
  activeAnchor: HTMLAnchorElement | null = null;
  dropIndicator: HTMLElement | null = null;
  hoveredBlock: HTMLElement | null = null;
  draggedBlock: HTMLElement | null = null;
  dropTargetBlock: HTMLElement | null = null;
  dropPosition: 'before' | 'after' = 'after';

  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnInput: (e: Event) => void;
  private boundOnPaste: (e: ClipboardEvent) => void;
  private boundOnClick: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseLeave: (e: MouseEvent) => void;
  private boundOnDragOver: (e: DragEvent) => void;
  private boundOnDragLeave: (e: DragEvent) => void;
  private boundOnDrop: (e: DragEvent) => void;
  private boundDocClick: (e: MouseEvent) => void;

  constructor({
    canvasElement,
    filePath,
    onChange,
    onSave,
    onNavigateFile,
    onSendSelectionToCopilot,
    onToast,
    onOpenLinkModal,
    onFragmentStatus
  }: {
    canvasElement: HTMLElement;
    filePath?: string | null;
    onChange?: () => void;
    onSave?: () => void;
    onNavigateFile?: (path: string) => void;
    onSendSelectionToCopilot?: (text: string) => void;
    onToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
    onOpenLinkModal?: (defaultText: string, callback: (url: string, text: string) => void, initialUrl?: string) => void;
    onFragmentStatus?: (info: FragmentStatusInfo | null) => void;
  }) {
    this.canvas = canvasElement;
    this.filePath = filePath || null;
    this.onChange = onChange || (() => {});
    this.onSave = onSave || (() => {});
    this.onNavigateFile = onNavigateFile;
    this.onSendSelectionToCopilot = onSendSelectionToCopilot;
    this.onToast = onToast;
    this.onOpenLinkModal = onOpenLinkModal;
    this.onFragmentStatus = onFragmentStatus;

    this.boundOnKeyDown = (e) => this.handleKeyDown(e);
    this.boundOnKeyUp = (e) => this.handleKeyUp(e);
    this.boundOnInput = (e) => this.handleInput(e);
    this.boundOnPaste = (e) => this.handlePaste(e);
    this.boundOnClick = (e) => this.handleClick(e);
    this.boundOnMouseMove = (e) => this.handleMouseMove(e);
    this.boundOnMouseLeave = (e) => this.handleMouseLeave(e);
    this.boundOnDragOver = (e) => this.handleDragOver(e);
    this.boundOnDragLeave = (e) => this.handleDragLeave(e);
    this.boundOnDrop = (e) => this.handleDrop(e);
    this.boundDocClick = (e) => {
      if (this.blockMenu && !this.blockMenu.contains(e.target as Node)) {
        this.blockMenu.style.display = 'none';
      }
      if (this.linkPopover && !this.linkPopover.contains(e.target as Node) && !(e.target as HTMLElement).closest('a')) {
        this.hideLinkPopover();
      }
    };

    this.init();
  }

  init() {
    this.canvas.setAttribute('contenteditable', 'true');
    this.canvas.setAttribute('spellcheck', 'false');
    this.canvas.classList.add('notion-canvas');

    // 1. Menus Flutuantes
    this.slashMenu = new SlashMenuEngine({
      container: this.canvas,
      onSelectCommand: (cmdId, targetRange) => this.handleSlashCommand(cmdId, targetRange)
    });

    this.bubbleMenu = new BubbleMenuEngine({
      container: this.canvas,
      getFilePath: () => this.filePath,
      onFormat: () => this.recordChange(),
      onOpenLinkModal: this.onOpenLinkModal,
      onAskCopilot: (text) => {
        if (this.onSendSelectionToCopilot) {
          this.onSendSelectionToCopilot(text);
        }
      },
      onCopyLink: () => {
        if (this.onToast) {
          this.onToast('Link resiliente do trecho copiado para a área de transferência!', 'success');
        }
      }
    });

    // 2. Side Handle e Menu de Contexto
    this.initSideHandles();
    this.initLinkPopover();

    // 3. Event Listeners
    this.canvas.addEventListener('keydown', this.boundOnKeyDown);
    this.canvas.addEventListener('keyup', this.boundOnKeyUp);
    this.canvas.addEventListener('input', this.boundOnInput);
    this.canvas.addEventListener('paste', this.boundOnPaste);
    this.canvas.addEventListener('click', this.boundOnClick);
    this.canvas.addEventListener('mousemove', this.boundOnMouseMove);
    this.canvas.addEventListener('mouseleave', this.boundOnMouseLeave);
    this.canvas.addEventListener('dragover', this.boundOnDragOver);
    this.canvas.addEventListener('dragleave', this.boundOnDragLeave);
    this.canvas.addEventListener('drop', this.boundOnDrop);
    document.addEventListener('click', this.boundDocClick);

    if (!this.canvas.innerHTML.trim()) {
      this.canvas.innerHTML = '<p><br></p>';
    }
  }

  initSideHandles() {
    this.sideHandle = document.createElement('div');
    this.sideHandle.className = 'notion-side-handle';
    this.sideHandle.style.display = 'none';
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
    this.blockMenu.style.display = 'none';
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

    const dragBtn = this.sideHandle.querySelector('[data-action="block-options"]') as HTMLElement | null;

    if (dragBtn) {
      dragBtn.addEventListener('dragstart', (e: DragEvent) => {
        if (!this.hoveredBlock) return;
        this.draggedBlock = this.hoveredBlock;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', '');
          e.dataTransfer.effectAllowed = 'move';
        }
        this.hoveredBlock.style.opacity = '0.4';
        if (this.blockMenu) this.blockMenu.style.display = 'none';
      });

      dragBtn.addEventListener('dragend', () => {
        if (this.draggedBlock) {
          this.draggedBlock.style.opacity = '1';
          this.draggedBlock = null;
        }
        if (this.dropIndicator) this.dropIndicator.style.display = 'none';
      });

      dragBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.hoveredBlock || !this.sideHandle || !this.blockMenu) return;
        const rect = this.sideHandle.getBoundingClientRect();
        this.blockMenu.style.display = 'flex';
        const menuWidth = 230;
        const left = Math.min(rect.right + 6, window.innerWidth - menuWidth - 10);
        this.blockMenu.style.left = `${Math.max(10, left)}px`;
        this.blockMenu.style.top = `${rect.top}px`;
      });
    }

    this.sideHandle.querySelector('[data-action="add-block"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.hoveredBlock) return;
      const newP = document.createElement('p');
      newP.innerHTML = '<br>';
      this.hoveredBlock.insertAdjacentElement('afterend', newP);
      this.placeCursorIn(newP);
      if (this.slashMenu) this.slashMenu.openAtCaret('');
      this.recordChange();
    });

    this.sideHandle.addEventListener('mouseenter', () => {
      if (this.sideHandle) this.sideHandle.style.display = 'flex';
    });

    this.sideHandle.addEventListener('mouseleave', () => {
      setTimeout(() => {
        const isOverCanvas = this.canvas && this.canvas.matches(':hover');
        const isOverMenu = this.blockMenu && this.blockMenu.matches(':hover');
        if (!isOverCanvas && !isOverMenu && this.sideHandle) {
          this.sideHandle.style.display = 'none';
        }
      }, 60);
    });

    // Ações do Menu de Bloco
    this.blockMenu.querySelectorAll('.block-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = (item as HTMLElement).dataset.action;
        const turn = (item as HTMLElement).dataset.turn;
        if (this.blockMenu) this.blockMenu.style.display = 'none';

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
          const clone = this.hoveredBlock.cloneNode(true) as HTMLElement;
          this.hoveredBlock.insertAdjacentElement('afterend', clone);
          this.attachInteractiveListeners();
          this.recordChange();
        } else if (turn) {
          this.turnBlockInto(this.hoveredBlock, turn);
        }
      });
    });
  }

  initLinkPopover() {
    this.linkPopover = document.createElement('div');
    this.linkPopover.className = 'notion-link-popover';
    this.linkPopover.style.display = 'none';
    this.linkPopover.innerHTML = `
      <div class="link-popover-info">
        <span class="material-symbols-outlined link-popover-type-icon">description</span>
        <a class="link-popover-url-text" target="_blank" rel="noopener noreferrer"></a>
      </div>
      <div class="link-popover-divider"></div>
      <button type="button" class="link-popover-btn" data-action="open-link" title="Abrir / Navegar">
        <span class="material-symbols-outlined icon-xs">open_in_new</span>
        <span>Abrir</span>
      </button>
      <button type="button" class="link-popover-btn" data-action="edit-link" title="Editar texto ou destino do link">
        <span class="material-symbols-outlined icon-xs">edit</span>
        <span>Editar</span>
      </button>
      <button type="button" class="link-popover-btn" data-action="copy-link" title="Copiar endereço do link">
        <span class="material-symbols-outlined icon-xs">content_copy</span>
        <span>Copiar</span>
      </button>
      <button type="button" class="link-popover-btn danger" data-action="unlink" title="Remover link (manter texto)">
        <span class="material-symbols-outlined icon-xs">link_off</span>
        <span>Remover</span>
      </button>
    `;
    document.body.appendChild(this.linkPopover);

    this.linkPopover.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    this.linkPopover.querySelectorAll('.link-popover-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        if (!this.activeAnchor) return;

        if (action === 'open-link') {
          const href = this.activeAnchor.getAttribute('href') || '';
          this.hideLinkPopover();
          if (href.startsWith('http://') || href.startsWith('https://')) {
            window.open(href, '_blank');
          } else if (href.startsWith('#') || href.startsWith(':~:text=')) {
            this.scrollToFragment(href);
          } else {
            const hashIndex = href.indexOf('#');
            const linkFile = hashIndex !== -1 ? href.slice(0, hashIndex).replace(/^\.?\//, '') : href.replace(/^\.?\//, '');
            const hash = hashIndex !== -1 ? href.slice(hashIndex) : '';
            const currentFile = (this.filePath || '').replace(/^\.?\//, '');
            
            if (linkFile === currentFile || !linkFile) {
              if (hash) {
                this.scrollToFragment(hash);
              }
            } else if (this.onNavigateFile) {
              this.onNavigateFile(href);
            }
          }
        } else if (action === 'edit-link') {
          const anchor = this.activeAnchor;
          const href = anchor.getAttribute('href') || '';
          const currentText = anchor.textContent || '';
          this.hideLinkPopover();
          if (this.onOpenLinkModal) {
            this.onOpenLinkModal(currentText, (newUrl, newText) => {
              if (anchor && anchor.isConnected) {
                anchor.setAttribute('href', newUrl);
                anchor.textContent = newText || newUrl;
                const isDoc = newUrl.endsWith('.md') || newUrl.includes('.md#') || newUrl.includes(':~:text=');
                if (isDoc) {
                  anchor.classList.add('notion-doc-link');
                } else {
                  anchor.classList.remove('notion-doc-link');
                }
                this.recordChange();
                if (this.onToast) {
                  this.onToast('Link atualizado com sucesso!', 'success');
                }
              }
            }, href);
          }
        } else if (action === 'copy-link') {
          const href = this.activeAnchor.getAttribute('href') || '';
          if (href) {
            navigator.clipboard.writeText(href);
            if (this.onToast) {
              this.onToast('Link copiado para a área de transferência!', 'success');
            }
          }
          this.hideLinkPopover();
        } else if (action === 'unlink') {
          const anchor = this.activeAnchor;
          const textNode = document.createTextNode(anchor.textContent || '');
          anchor.parentNode?.replaceChild(textNode, anchor);
          this.hideLinkPopover();
          this.recordChange();
          if (this.onToast) {
            this.onToast('Link removido.', 'info');
          }
        }
      });
    });
  }

  showLinkPopover(anchor: HTMLAnchorElement) {
    if (!this.linkPopover) return;
    this.activeAnchor = anchor;
    const href = anchor.getAttribute('href') || '';
    const isDoc = href.endsWith('.md') || href.includes('.md#') || href.includes(':~:text=');
    
    const typeIcon = this.linkPopover.querySelector('.link-popover-type-icon') as HTMLElement | null;
    if (typeIcon) {
      typeIcon.textContent = isDoc ? 'description' : href.startsWith('http') ? 'public' : 'link';
    }

    const urlText = this.linkPopover.querySelector('.link-popover-url-text') as HTMLAnchorElement | null;
    if (urlText) {
      urlText.textContent = href;
      urlText.title = href;
      urlText.href = href;
    }

    this.linkPopover.style.display = 'flex';
    const rect = anchor.getBoundingClientRect();
    const popWidth = this.linkPopover.offsetWidth || 320;
    const left = Math.max(10, Math.min(rect.left + (rect.width / 2) - (popWidth / 2), window.innerWidth - popWidth - 10));
    
    let top = rect.bottom + 6;
    if (top + 45 > window.innerHeight && rect.top - 45 > 0) {
      top = rect.top - 45;
    }

    this.linkPopover.style.left = `${left}px`;
    this.linkPopover.style.top = `${top}px`;
  }

  hideLinkPopover() {
    if (this.linkPopover) {
      this.linkPopover.style.display = 'none';
    }
    this.activeAnchor = null;
  }

  handleMouseMove(e: MouseEvent) {
    if (this.draggedBlock) return;
    if (!this.canvas.offsetParent) {
      this.hideFloatingMenus();
      return;
    }
    const block = this.findTopLevelBlock(e.target as Node);
    if (block && block !== this.canvas && this.sideHandle) {
      this.hoveredBlock = block;
      const rect = block.getBoundingClientRect();
      this.sideHandle.style.display = 'flex';
      this.sideHandle.style.left = `${rect.left - 54}px`;
      this.sideHandle.style.top = `${rect.top + 2}px`;
    }
  }

  handleMouseLeave(_e: MouseEvent) {
    setTimeout(() => {
      const isOverHandle = this.sideHandle && this.sideHandle.matches(':hover');
      const isOverMenu = this.blockMenu && this.blockMenu.matches(':hover');
      if (!isOverHandle && !isOverMenu && this.sideHandle) {
        this.sideHandle.style.display = 'none';
      }
    }, 60);
  }

  handleDragOver(e: DragEvent) {
    if (!this.draggedBlock) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const target = this.findTopLevelBlock(e.target as Node);
    if (target && target !== this.canvas && target !== this.draggedBlock && this.dropIndicator) {
      this.dropTargetBlock = target;
      const rect = target.getBoundingClientRect();
      const isUpperHalf = e.clientY < rect.top + rect.height / 2;
      this.dropPosition = isUpperHalf ? 'before' : 'after';

      this.dropIndicator.style.display = 'block';
      this.dropIndicator.style.left = `${rect.left}px`;
      this.dropIndicator.style.width = `${rect.width}px`;
      this.dropIndicator.style.top = isUpperHalf ? `${rect.top - 2}px` : `${rect.bottom - 1}px`;
    }
  }

  handleDragLeave(e: DragEvent) {
    if (!this.canvas.contains(e.relatedTarget as Node) && this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
  }

  handleDrop(e: DragEvent) {
    if (!this.draggedBlock || !this.dropTargetBlock) return;
    e.preventDefault();

    if (this.dropPosition === 'before') {
      this.dropTargetBlock.insertAdjacentElement('beforebegin', this.draggedBlock);
    } else {
      this.dropTargetBlock.insertAdjacentElement('afterend', this.draggedBlock);
    }

    if (this.dropIndicator) this.dropIndicator.style.display = 'none';
    this.draggedBlock.style.opacity = '1';
    this.draggedBlock = null;
    this.dropTargetBlock = null;
    this.recordChange();
  }

  handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Tratar clique em links para popover de edição/ações ou navegação direta com Ctrl/Cmd
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && this.canvas.contains(anchor)) {
      const href = anchor.getAttribute('href') || '';
      if (href) {
        if (e.ctrlKey || e.metaKey) {
          if (href.startsWith('http://') || href.startsWith('https://')) return;
          e.preventDefault();
          if (href.startsWith('#') || href.startsWith(':~:text=')) {
            this.scrollToFragment(href);
          } else {
            const hashIndex = href.indexOf('#');
            const linkFile = hashIndex !== -1 ? href.slice(0, hashIndex).replace(/^\.?\//, '') : href.replace(/^\.?\//, '');
            const hash = hashIndex !== -1 ? href.slice(hashIndex) : '';
            const currentFile = (this.filePath || '').replace(/^\.?\//, '');
            
            if (linkFile === currentFile || !linkFile) {
              if (hash) {
                this.scrollToFragment(hash);
              }
            } else if (this.onNavigateFile) {
              this.onNavigateFile(href);
            }
          }
          return;
        }

        // Clique normal abre o menu flutuante de ações do link (Abrir, Editar, Copiar, Remover)
        e.preventDefault();
        this.showLinkPopover(anchor);
        return;
      }
    }

    if (target.classList.contains('notion-todo-checkbox')) {
      const item = target.closest('.notion-todo-item') as HTMLElement | null;
      if (item) {
        item.classList.toggle('checked', (target as HTMLInputElement).checked);
        this.recordChange();
      }
    } else if (target.classList.contains('notion-callout-icon')) {
      this.toggleCalloutType(target.closest('.notion-callout') as HTMLElement | null);
    }
  }

  /**
   * Rola suavemente até o trecho especificado por um W3C TextFragment ou texto exato,
   * aplicando um efeito visual de destaque luminoso (pulsing highlight).
   */
  scrollToFragment(target: TextFragmentQuery | string): boolean {
    let query: TextFragmentQuery | null = null;
    if (typeof target === 'string') {
      query = parseTextFragmentUrl(target);
      if (!query) {
        const cleanText = target.replace(/^#/, '').replace(/^\/?/, '').trim();
        if (cleanText) {
          query = { exact: cleanText };
        }
      }
    } else {
      query = target;
    }

    if (!query || !query.exact) return false;

    this.clearFragmentHighlights();

    const match = findTextFragmentInElement(this.canvas, query);
    if (!match) {
      if (this.onFragmentStatus) {
        this.onFragmentStatus({
          type: 'not_found',
          exact: query.exact,
          prefix: query.prefix,
          suffix: query.suffix
        });
      }
      if (this.onToast) {
        this.onToast(`Trecho "${query.exact.slice(0, 32)}..." não foi localizado no documento atual.`, 'warning');
      }
      return false;
    }

    try {
      if (match.isExact) {
        if (this.onFragmentStatus) {
          this.onFragmentStatus(null);
        }
      } else {
        if (this.onFragmentStatus) {
          this.onFragmentStatus({
            type: 'fuzzy_match',
            exact: query.exact,
            prefix: query.prefix,
            suffix: query.suffix,
            currentFoundText: match.element.textContent?.trim()
          });
        }
      }

      // Rolagem suave até o elemento centralizando no viewport
      match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Aplicar destaque visual com classe CSS animada
      match.element.classList.add('notion-fragment-highlight-block');
      if (!match.isExact) {
        match.element.classList.add('is-fuzzy-match');
        match.element.setAttribute('data-fragment-note', 'Trecho localizado por aproximação');
      }

      // Remover o highlight após 5 segundos
      setTimeout(() => {
        this.clearFragmentHighlights();
      }, 5500);

      if (!match.isExact && this.onToast) {
        this.onToast('Trecho localizado com pequenas modificações no texto original.', 'info');
      }

      return true;
    } catch (err) {
      console.warn('[NotionEditorEngine] Erro ao aplicar highlight no elemento:', err);
      return false;
    }
  }

  /**
   * Remove marcações de destaque de fragmentos
   */
  clearFragmentHighlights() {
    const highlightedBlocks = this.canvas.querySelectorAll('.notion-fragment-highlight-block, .is-fuzzy-match');
    highlightedBlocks.forEach(b => {
      b.classList.remove('notion-fragment-highlight-block', 'is-fuzzy-match');
      b.removeAttribute('data-fragment-note');
    });
  }

  hideFloatingMenus() {
    if (this.sideHandle) this.sideHandle.style.display = 'none';
    if (this.blockMenu) this.blockMenu.style.display = 'none';
    if (this.dropIndicator) this.dropIndicator.style.display = 'none';
    if (this.bubbleMenu) this.bubbleMenu.hide();
    if (this.slashMenu) this.slashMenu.hide();
    this.hideLinkPopover();
  }

  findTopLevelBlock(node: Node | null): HTMLElement | null {
    let current = node as HTMLElement | null;
    while (current && current.parentElement && current.parentElement !== this.canvas) {
      current = current.parentElement;
    }
    return current;
  }

  turnBlockInto(block: HTMLElement, type: string) {
    const text = block.textContent?.trim() || '';
    let newEl: HTMLElement | null = null;

    if (type === 'h1') newEl = document.createElement('h1');
    else if (type === 'h2') newEl = document.createElement('h2');
    else if (type === 'h3') newEl = document.createElement('h3');
    else if (type === 'p') newEl = document.createElement('p');
    else if (type === 'quote') newEl = document.createElement('blockquote');
    else if (type === 'todo') {
      const div = document.createElement('div');
      div.innerHTML = this.createTodoItemHtml(text || 'Nova tarefa');
      newEl = div.firstElementChild as HTMLElement;
    } else if (type === 'callout') {
      const div = document.createElement('div');
      div.innerHTML = this.createCalloutBlockHtml('note', text || 'Nota de destaque...');
      newEl = div.firstElementChild as HTMLElement;
    } else if (type === 'code') {
      const div = document.createElement('div');
      div.innerHTML = this.createCodeBlockHtml('javascript', text || '// Código');
      newEl = div.firstElementChild as HTMLElement;
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

  toggleCalloutType(calloutEl: HTMLElement | null) {
    if (!calloutEl) return;
    const types = ['note', 'tip', 'warning', 'danger'];
    const current = calloutEl.dataset.type || 'note';
    const nextIdx = (types.indexOf(current) + 1) % types.length;
    const nextType = types[nextIdx];

    calloutEl.dataset.type = nextType;
    const iconSpan = calloutEl.querySelector('.notion-callout-icon');
    if (iconSpan) {
      const iconMap: Record<string, string> = {
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
    const htmlFragments: string[] = [];
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

      // 3. Dropdown / Toggle List
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
        const tableLines: string[] = [];
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

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes(':~:text=')) {
        setTimeout(() => {
          this.scrollToFragment(hash);
        }, 180);
      }
    }
  }

  // ===========================================================================
  // DOM TO MARKDOWN (SERIALIZER)
  // ===========================================================================

  getMarkdown(): string {
    const lines: string[] = [];
    const children = Array.from(this.canvas.children) as HTMLElement[];

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
        const chk = node.querySelector('.notion-todo-checkbox') as HTMLInputElement | null;
        const isChecked = chk ? chk.checked : false;
        const textEl = (node.querySelector('.notion-todo-text') || node) as HTMLElement;
        const text = this.serializeInline(textEl).trim();
        lines.push(`- [${isChecked ? 'x' : ' '}] ${text}`);
      } else if (node.classList.contains('notion-code-block')) {
        const langEl = node.querySelector('.notion-code-lang');
        const codeEl = (node.querySelector('.notion-code-content') || node.querySelector('code')) as HTMLElement | null;
        const lang = langEl ? langEl.textContent?.trim().toLowerCase() : '';
        const code = codeEl ? codeEl.innerText : '';
        lines.push(`\`\`\`${lang}`);
        lines.push(code);
        lines.push('```');
        lines.push('');
      } else if (node.classList.contains('notion-mermaid-block')) {
        const textarea = node.querySelector('.notion-mermaid-textarea') as HTMLTextAreaElement | null;
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

  parseInlineMarkdown(text: string): string {
    if (!text) return '<br>';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
        // Remover prefixo residual 'description' decorrente da ligature do ícone
        const cleanLabel = (label || '').replace(/^description(?=[a-zA-Z0-9_\sÀ-ÿ])/i, '').trim() || label;
        const isDoc = href.endsWith('.md') || href.includes('.md#') || href.includes(':~:text=') || href.startsWith('#');
        return `<a href="${href}" class="${isDoc ? 'notion-doc-link' : ''}" target="${isDoc ? '_self' : '_blank'}">${cleanLabel}</a>`;
      });
  }

  serializeInline(element: HTMLElement | null): string {
    if (!element) return '';
    let result = '';

    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        
        // Ignorar ícones (Material Symbols / SVG) para nunca serializar o nome do ícone como texto no Markdown
        if (
          el.classList.contains('material-symbols-outlined') || 
          el.classList.contains('notion-icon') || 
          el.classList.contains('icon-xs') ||
          el.classList.contains('icon-sm') ||
          tag === 'svg'
        ) {
          return;
        }

        if (tag === 'strong' || tag === 'b') {
          result += `**${this.serializeInline(el)}**`;
        } else if (tag === 'em' || tag === 'i') {
          result += `*${this.serializeInline(el)}*`;
        } else if (tag === 's' || tag === 'strike') {
          result += `~~${this.serializeInline(el)}~~`;
        } else if (tag === 'code') {
          result += `\`${el.textContent}\``;
        } else if (tag === 'a') {
          const href = el.getAttribute('href') || '#';
          let label = this.serializeInline(el);
          label = label.replace(/^description(?=[a-zA-Z0-9_\sÀ-ÿ])/i, '').trim() || label;
          result += `[${label}](${href})`;
        } else if (tag === 'br') {
          result += '\n';
        } else {
          result += this.serializeInline(el);
        }
      }
    });

    return result;
  }

  serializeTable(wrapper: HTMLElement): string {
    const table = wrapper.querySelector('table');
    if (!table) return '';

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    const mdLines: string[] = [];
    rows.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll('th, td')) as HTMLElement[];
      const rowStr = '| ' + cells.map(c => this.serializeInline(c).trim() || ' ').join(' | ') + ' |';
      mdLines.push(rowStr);

      if (rIdx === 0) {
        const sepStr = '| ' + cells.map(() => '---').join(' | ') + ' |';
        mdLines.push(sepStr);
      }
    });

    return mdLines.join('\n');
  }

  serializeToggle(toggle: HTMLElement): string {
    const summary = toggle.querySelector('summary');
    const title = summary ? (summary.querySelector('.notion-toggle-summary-text')?.textContent || summary.textContent || 'Seção').trim() : 'Seção';
    const content = (toggle.querySelector('.notion-toggle-content') || toggle) as HTMLElement;
    const body = this.serializeInline(content).trim();

    return `<details>\n<summary>${title}</summary>\n\n${body}\n</details>`;
  }

  serializeCallout(callout: HTMLElement): string {
    const type = (callout.dataset.type || 'note').toUpperCase();
    const content = (callout.querySelector('.notion-callout-content') || callout) as HTMLElement;
    const body = this.serializeInline(content).trim();
    const lines = body.split('\n');

    return `> [!${type}]\n` + lines.map(l => `> ${l}`).join('\n');
  }

  // ===========================================================================
  // HTML GENERATORS
  // ===========================================================================

  createTableHtml(rows = 3, cols = 3): string {
    return NotionTable.createDefaultHtml(rows, cols);
  }

  createTableFromMarkdown(tableLines: string[]): string {
    return NotionTable.fromMarkdownLines(tableLines);
  }

  createToggleBlockHtml(title = 'Clique para expandir', content = 'Conteúdo oculto...'): string {
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

  createCalloutBlockHtml(type = 'note', content = 'Insira o contexto aqui...'): string {
    const iconMap: Record<string, string> = {
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

  createTodoItemHtml(text = 'Nova tarefa', isChecked = false): string {
    return `
      <div class="notion-todo-item ${isChecked ? 'checked' : ''}" contenteditable="false">
        <input type="checkbox" class="notion-todo-checkbox" ${isChecked ? 'checked' : ''} />
        <span class="notion-todo-text" contenteditable="true">${this.parseInlineMarkdown(text)}</span>
      </div>
    `;
  }

  createCodeBlockHtml(lang = 'javascript', code = '// Código aqui'): string {
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

  createMermaidBlockHtml(code = 'flowchart TD\n  A[Início] --> B[Processo]\n  B --> C[Fim]'): string {
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
    this.canvas.querySelectorAll('.notion-table-block, .notion-table-wrapper').forEach(wrapper => {
      new NotionTable({
        wrapper: wrapper as HTMLElement,
        onChange: () => this.recordChange()
      });
    });

    this.canvas.querySelectorAll('.btn-code-copy').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => {
        e.preventDefault();
        const codeEl = btn.closest('.notion-code-block')?.querySelector('.notion-code-content') as HTMLElement | null;
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.innerText);
          btn.textContent = 'Copiado!';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
        }
      };
    });

    this.canvas.querySelectorAll('.notion-mermaid-block').forEach(block => {
      const btnToggle = block.querySelector('.btn-toggle-mermaid-editor') as HTMLElement | null;
      const btnRefresh = block.querySelector('.btn-refresh-mermaid') as HTMLElement | null;
      const editorPanel = block.querySelector('.notion-mermaid-editor') as HTMLElement | null;
      const textarea = block.querySelector('.notion-mermaid-textarea') as HTMLTextAreaElement | null;

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
          (block as HTMLElement).dataset.mermaidCode = textarea.value.trim();
          this.renderMermaidBlock(block as HTMLElement);
          this.recordChange();
        };
      }
    });
  }

  async renderAllMermaidBlocks() {
    const blocks = Array.from(this.canvas.querySelectorAll('.notion-mermaid-block')) as HTMLElement[];
    for (const block of blocks) {
      await this.renderMermaidBlock(block);
    }
  }

  async renderMermaidBlock(block: HTMLElement) {
    if (typeof mermaid === 'undefined') return;
    const renderArea = block.querySelector('.notion-mermaid-render');
    const textarea = block.querySelector('.notion-mermaid-textarea') as HTMLTextAreaElement | null;
    const code = textarea ? textarea.value.trim() : (block.dataset.mermaidCode || '');

    if (!renderArea || !code) return;

    try {
      const renderId = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await mermaid.render(renderId, code);
      renderArea.innerHTML = svg;
    } catch (e: any) {
      renderArea.innerHTML = `
        <div style="color:#ef4444; font-size:12px; padding:12px; display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-outlined icon-xs">warning</span>
          <span>Erro na sintaxe Mermaid: ${escapeHtml(e?.message || String(e))}</span>
        </div>
      `;
    }
  }

  // ===========================================================================
  // NOTION INPUT RULES
  // ===========================================================================

  handleKeyUp(e: KeyboardEvent) {
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

    const text = node.textContent || '';
    const parent = node.parentElement;
    if (!parent || parent.tagName.toLowerCase() !== 'p') return;

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
  // ATALHOS DE TECLADO & SMART BACKSPACE
  // ===========================================================================

  handleKeyDown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (e.key === 'Escape') {
      this.hideLinkPopover();
    }

    if (modifier && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      this.onSave();
      return;
    }

    if (modifier && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const selection = window.getSelection();
      let existingAnchor: HTMLAnchorElement | null = null;
      if (selection && selection.anchorNode) {
        const parentEl = selection.anchorNode.nodeType === Node.ELEMENT_NODE 
          ? (selection.anchorNode as HTMLElement) 
          : selection.anchorNode.parentElement;
        existingAnchor = (parentEl?.closest('a') as HTMLAnchorElement) || null;
      }
      const initialUrl = existingAnchor ? existingAnchor.getAttribute('href') || '' : '';
      const selectedText = selection ? selection.toString().trim() : '';
      const initialText = selectedText || (existingAnchor ? existingAnchor.textContent || '' : '');
      const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

      if (this.onOpenLinkModal) {
        this.onOpenLinkModal(initialText, (newUrl, newText) => {
          const isDoc = newUrl.endsWith('.md') || newUrl.includes('.md#') || newUrl.includes(':~:text=') || newUrl.startsWith('#');
          if (existingAnchor && existingAnchor.isConnected) {
            existingAnchor.setAttribute('href', newUrl);
            existingAnchor.textContent = newText || newUrl;
            if (isDoc) {
              existingAnchor.classList.add('notion-doc-link');
              existingAnchor.target = '_self';
            } else {
              existingAnchor.classList.remove('notion-doc-link');
              existingAnchor.target = '_blank';
            }
          } else if (savedRange) {
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(savedRange);
            }
            const anchor = document.createElement('a');
            anchor.setAttribute('href', newUrl);
            if (isDoc) {
              anchor.className = 'notion-doc-link';
              anchor.target = '_self';
            } else {
              anchor.target = '_blank';
            }
            anchor.textContent = newText || newUrl;
            savedRange.deleteContents();
            savedRange.insertNode(anchor);
          } else {
            document.execCommand('createLink', false, newUrl);
          }
          this.attachInteractiveListeners();
          this.recordChange();
        }, initialUrl);
      }
      return;
    }

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

    // Smart Backspace
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

    // Tab Navigation em Tabelas
    if (e.key === 'Tab') {
      const cell = document.activeElement ? document.activeElement.closest('td, th') as HTMLElement | null : null;
      if (cell) {
        e.preventDefault();
        const tr = cell.parentElement as HTMLTableRowElement | null;
        const table = tr ? tr.closest('table') : null;
        if (table) {
          const allCells = Array.from(table.querySelectorAll('th, td')) as HTMLElement[];
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
              table.querySelector('tbody')?.appendChild(newTr);
              this.recordChange();
              setTimeout(() => {
                (newTr.querySelector('td') as HTMLElement)?.focus();
              }, 10);
            }
          }
          return;
        }
      }
    }

    // Enter dentro de To-Do
    if (e.key === 'Enter') {
      const todoItem = document.activeElement ? document.activeElement.closest('.notion-todo-item') as HTMLElement | null : null;
      if (todoItem && !e.shiftKey) {
        e.preventDefault();
        const textSpan = todoItem.querySelector('.notion-todo-text');
        if (textSpan && !textSpan.textContent?.trim()) {
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
          (newItem.querySelector('.notion-todo-text') as HTMLElement)?.focus();
        }, 10);
        return;
      }
    }

    // Trigger Slash '/'
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

    if (offset > 0 && text[offset - 1] === '/' && this.slashMenu) {
      this.slashMenu.openAtCaret('');
    }
  }

  handleSlashCommand(cmdId: string, targetRange: Range | null) {
    if (targetRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(targetRange);
      }

      const node = targetRange.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE && node.textContent?.includes('/')) {
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
      case 'link': {
        if (this.onOpenLinkModal) {
          this.onOpenLinkModal('', (url, text) => {
            const isDoc = url.endsWith('.md') || url.includes('.md#') || url.includes(':~:text=');
            this.insertBlockHtml(`<p><a href="${escapeHtml(url)}" class="${isDoc ? 'notion-doc-link' : ''}" target="${isDoc ? '_self' : '_blank'}">${escapeHtml(text || url)}</a></p>`);
          });
        }
        break;
      }
      case 'doc-link': {
        if (this.onOpenLinkModal) {
          this.onOpenLinkModal('', (url, text) => {
            this.insertBlockHtml(`<p><a href="${escapeHtml(url)}" class="notion-doc-link">${escapeHtml(text || url)}</a></p>`);
          });
        }
        break;
      }
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

  insertBlockHtml(html: string) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    const element = div.firstElementChild as HTMLElement;
    if (!element) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let targetNode = range.startContainer as HTMLElement | null;
      while (targetNode && targetNode.parentElement !== this.canvas && targetNode !== this.canvas) {
        targetNode = targetNode.parentElement;
      }

      if (targetNode && targetNode.parentElement === this.canvas) {
        if (!targetNode.textContent?.trim()) {
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

    this.attachInteractiveListeners();
    this.placeCursorIn(element);
    this.recordChange();
  }

  placeCursorIn(element: HTMLElement) {
    const target = (element.querySelector('[contenteditable="true"]') || element) as HTMLElement;
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  handleInput(_e: Event) {
    this.recordChange();
  }

  handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData || (window as any).clipboardData)?.getData('text/plain') || '';
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
    if (current) this.redoStack.push(current);

    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) {
      this.canvas.innerHTML = prev;
      this.attachInteractiveListeners();
      this.renderAllMermaidBlocks();
      this.onChange();
    }
  }

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(next);
      this.canvas.innerHTML = next;
      this.attachInteractiveListeners();
      this.renderAllMermaidBlocks();
      this.onChange();
    }
  }

  destroy() {
    this.canvas.removeEventListener('keydown', this.boundOnKeyDown);
    this.canvas.removeEventListener('keyup', this.boundOnKeyUp);
    this.canvas.removeEventListener('input', this.boundOnInput);
    this.canvas.removeEventListener('paste', this.boundOnPaste);
    this.canvas.removeEventListener('click', this.boundOnClick);
    this.canvas.removeEventListener('mousemove', this.boundOnMouseMove);
    this.canvas.removeEventListener('mouseleave', this.boundOnMouseLeave);
    this.canvas.removeEventListener('dragover', this.boundOnDragOver);
    this.canvas.removeEventListener('dragleave', this.boundOnDragLeave);
    this.canvas.removeEventListener('drop', this.boundOnDrop);
    document.removeEventListener('click', this.boundDocClick);

    if (this.slashMenu) this.slashMenu.destroy();
    if (this.bubbleMenu) this.bubbleMenu.destroy();
    if (this.sideHandle) this.sideHandle.remove();
    if (this.blockMenu) this.blockMenu.remove();
    if (this.linkPopover) this.linkPopover.remove();
    if (this.dropIndicator) this.dropIndicator.remove();
  }
}

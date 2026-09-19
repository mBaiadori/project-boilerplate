// =============================================================================
// COMPONENT: NOTION SIMPLE TABLE (PRO NOTION UX COM CONTROLE DE LINHAS/COLUNAS)
// Exclusão e inserção em qualquer posição (no meio, início ou fim),
// menu de contexto no botão direito, botões flutuantes e navegação ágil.
// =============================================================================

function parseInline(text: string): string {
  if (!text) return '';
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

export class NotionTable {
  wrapper: HTMLElement;
  onChange: () => void;
  table: HTMLTableElement | null;
  activeCell: HTMLElement | null = null;
  contextMenu: HTMLElement | null = null;

  constructor({ wrapper, onChange }: { wrapper: HTMLElement; onChange?: () => void }) {
    this.wrapper = wrapper;
    this.onChange = onChange || (() => {});
    this.table = wrapper.querySelector('table');
    this.init();
  }

  static createDefaultHtml(rows = 3, cols = 3): string {
    let thead = '<tr>';
    for (let c = 1; c <= cols; c++) {
      thead += `<th contenteditable="true" spellcheck="false">Coluna ${c}</th>`;
    }
    thead += '</tr>';

    let tbody = '';
    for (let r = 1; r < rows; r++) {
      tbody += '<tr>';
      for (let c = 1; c <= cols; c++) {
        tbody += `<td contenteditable="true" spellcheck="false"></td>`;
      }
      tbody += '</tr>';
    }

    return `
      <div class="notion-table-block" contenteditable="false">
        <div class="notion-table-container">
          <button type="button" class="btn-table-add-col" title="Adicionar coluna à direita (+)">+</button>
          <table class="notion-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
          <button type="button" class="btn-table-add-row" title="Adicionar linha abaixo (+)">+</button>
        </div>
      </div>
    `;
  }

  static fromMarkdownLines(tableLines: string[]): string {
    if (!tableLines || tableLines.length < 2) return '';

    const cleanLines = tableLines.filter(l => !l.match(/^\s*\|\s*[-:\s|]+\s*\|\s*$/));
    if (cleanLines.length === 0) return '';

    const headerLine = cleanLines[0];
    const headerCells = headerLine.split('|').slice(1, -1).map(c => c.trim());

    let thead = '<tr>';
    headerCells.forEach(c => {
      thead += `<th contenteditable="true" spellcheck="false">${parseInline(c)}</th>`;
    });
    thead += '</tr>';

    let tbody = '';
    for (let r = 1; r < cleanLines.length; r++) {
      const rowCells = cleanLines[r].split('|').slice(1, -1).map(c => c.trim());
      tbody += '<tr>';
      for (let c = 0; c < headerCells.length; c++) {
        const val = rowCells[c] || '';
        tbody += `<td contenteditable="true" spellcheck="false">${parseInline(val)}</td>`;
      }
      tbody += '</tr>';
    }

    return `
      <div class="notion-table-block" contenteditable="false">
        <div class="notion-table-container">
          <button type="button" class="btn-table-add-col" title="Adicionar coluna à direita (+)">+</button>
          <table class="notion-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
          <button type="button" class="btn-table-add-row" title="Adicionar linha abaixo (+)">+</button>
        </div>
      </div>
    `;
  }

  init() {
    if (!this.wrapper) return;
    this.table = this.wrapper.querySelector('table');
    if (!this.table) return;

    this.createTableContextMenu();

    const btnAddCol = this.wrapper.querySelector('.btn-table-add-col') as HTMLElement | null;
    if (btnAddCol) {
      btnAddCol.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.insertColumnAtEnd();
      };
    }

    const btnAddRow = this.wrapper.querySelector('.btn-table-add-row') as HTMLElement | null;
    if (btnAddRow) {
      btnAddRow.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.insertRowAtEnd();
      };
    }

    this.table.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const cell = target ? target.closest('th, td') as HTMLElement | null : null;
      if (cell) {
        e.preventDefault();
        this.activeCell = cell;
        this.openContextMenu(e.clientX, e.clientY);
      }
    });

    this.table.addEventListener('input', () => {
      this.onChange();
    });
  }

  createTableContextMenu() {
    let menu = document.getElementById('notion-table-context-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'notion-table-context-menu';
      menu.className = 'notion-table-context-menu';
      menu.innerHTML = `
        <div class="table-menu-section">Colunas</div>
        <div class="table-menu-item" data-action="insert-col-left"><span class="material-symbols-outlined icon-xs">arrow_left</span> Inserir Coluna à Esquerda</div>
        <div class="table-menu-item" data-action="insert-col-right"><span class="material-symbols-outlined icon-xs">arrow_right</span> Inserir Coluna à Direita</div>
        <div class="table-menu-item danger" data-action="delete-col"><span class="material-symbols-outlined icon-xs">delete</span> Excluir Coluna</div>
        <div class="table-menu-divider"></div>
        <div class="table-menu-section">Linhas</div>
        <div class="table-menu-item" data-action="insert-row-above"><span class="material-symbols-outlined icon-xs">arrow_drop_up</span> Inserir Linha Acima</div>
        <div class="table-menu-item" data-action="insert-row-below"><span class="material-symbols-outlined icon-xs">arrow_drop_down</span> Inserir Linha Abaixo</div>
        <div class="table-menu-item danger" data-action="delete-row"><span class="material-symbols-outlined icon-xs">delete</span> Excluir Linha</div>
        <div class="table-menu-divider"></div>
        <div class="table-menu-item danger" data-action="delete-table"><span class="material-symbols-outlined icon-xs">table_rows_narrow</span> Excluir Tabela Inteira</div>
      `;
      document.body.appendChild(menu);

      menu.querySelectorAll('.table-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = (item as HTMLElement).dataset.action;
          if (menu) menu.style.display = 'none';
          if (this.activeCell && action) {
            this.handleMenuAction(action);
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (menu && !menu.contains(e.target as Node)) {
          menu.style.display = 'none';
        }
      });
    }
    this.contextMenu = menu;
  }

  openContextMenu(x: number, y: number) {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'flex';
    const menuWidth = 220;
    const left = Math.min(x, window.innerWidth - menuWidth - 10);
    this.contextMenu.style.left = `${Math.max(10, left)}px`;
    this.contextMenu.style.top = `${y}px`;
  }

  handleMenuAction(action: string) {
    if (!this.activeCell || !this.table) return;

    const cell = this.activeCell;
    const tr = cell.parentElement as HTMLTableRowElement | null;
    if (!tr) return;

    const cellIndex = Array.from(tr.children).indexOf(cell);
    const tbody = this.table.querySelector('tbody');
    const allRows = Array.from(this.table.querySelectorAll('tr'));
    const rowIndex = allRows.indexOf(tr);

    switch (action) {
      case 'insert-col-left':
        allRows.forEach(row => {
          const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
          const newCell = document.createElement(isHeader ? 'th' : 'td');
          newCell.setAttribute('contenteditable', 'true');
          newCell.setAttribute('spellcheck', 'false');
          if (isHeader) newCell.textContent = `Coluna ${cellIndex + 1}`;
          row.children[cellIndex]?.insertAdjacentElement('beforebegin', newCell);
        });
        break;

      case 'insert-col-right':
        allRows.forEach(row => {
          const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
          const newCell = document.createElement(isHeader ? 'th' : 'td');
          newCell.setAttribute('contenteditable', 'true');
          newCell.setAttribute('spellcheck', 'false');
          if (isHeader) newCell.textContent = `Coluna ${cellIndex + 2}`;
          row.children[cellIndex]?.insertAdjacentElement('afterend', newCell);
        });
        break;

      case 'delete-col':
        if (tr.children.length <= 1) {
          this.wrapper.remove();
        } else {
          allRows.forEach(row => {
            row.children[cellIndex]?.remove();
          });
        }
        break;

      case 'insert-row-above':
        if (rowIndex === 0) {
          const newTr = document.createElement('tr');
          const colsCount = tr.children.length;
          for (let i = 0; i < colsCount; i++) {
            newTr.innerHTML += '<td contenteditable="true" spellcheck="false"></td>';
          }
          tbody?.insertAdjacentElement('afterbegin', newTr);
        } else {
          const newTr = document.createElement('tr');
          const colsCount = tr.children.length;
          for (let i = 0; i < colsCount; i++) {
            newTr.innerHTML += '<td contenteditable="true" spellcheck="false"></td>';
          }
          tr.insertAdjacentElement('beforebegin', newTr);
        }
        break;

      case 'insert-row-below':
        const newTr = document.createElement('tr');
        const colsCount = tr.children.length;
        for (let i = 0; i < colsCount; i++) {
          newTr.innerHTML += '<td contenteditable="true" spellcheck="false"></td>';
        }
        tr.insertAdjacentElement('afterend', newTr);
        break;

      case 'delete-row':
        if (rowIndex === 0) {
          alert('Não é possível excluir a linha de cabeçalho. Exclua a tabela inteira se desejar.');
        } else {
          tr.remove();
        }
        break;

      case 'delete-table':
        this.wrapper.remove();
        break;
    }

    this.onChange();
  }

  insertColumnAtEnd() {
    if (!this.table) return;
    const allRows = Array.from(this.table.querySelectorAll('tr'));
    const colsCount = allRows[0]?.children.length || 0;

    allRows.forEach(row => {
      const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.setAttribute('contenteditable', 'true');
      newCell.setAttribute('spellcheck', 'false');
      if (isHeader) newCell.textContent = `Coluna ${colsCount + 1}`;
      row.appendChild(newCell);
    });

    this.onChange();
  }

  insertRowAtEnd() {
    if (!this.table) return;
    const thead = this.table.querySelector('thead');
    const colsCount = thead?.querySelectorAll('th').length || 2;
    const tbody = this.table.querySelector('tbody');

    const newTr = document.createElement('tr');
    for (let i = 0; i < colsCount; i++) {
      newTr.innerHTML += '<td contenteditable="true" spellcheck="false"></td>';
    }
    tbody?.appendChild(newTr);

    this.onChange();
  }
}

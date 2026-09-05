// =============================================================================
// COMPONENT: NOTION SIMPLE TABLE (PRO NOTION UX COM CONTROLE DE LINHAS/COLUNAS)
// Exclusão e inserção em qualquer posição (no meio, início ou fim),
// menu de contexto no botão direito, botões flutuantes e navegação ágil.
// =============================================================================

export class NotionTable {
  constructor({ wrapper, onChange }) {
    this.wrapper = wrapper;
    this.onChange = onChange || (() => {});
    this.table = wrapper.querySelector('table');
    this.activeCell = null;
    this.contextMenu = null;
    this.init();
  }

  static createDefaultHtml(rows = 3, cols = 3) {
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
          <!-- Floating Column Add Button -->
          <button type="button" class="btn-table-add-col" title="Adicionar coluna à direita (+)">+</button>
          
          <table class="notion-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>

          <!-- Floating Row Add Button -->
          <button type="button" class="btn-table-add-row" title="Adicionar linha abaixo (+)">+</button>
        </div>
      </div>
    `;
  }

  static fromMarkdownLines(tableLines) {
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

    // Botão flutuante de adicionar coluna à direita
    const btnAddCol = this.wrapper.querySelector('.btn-table-add-col');
    if (btnAddCol) {
      btnAddCol.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.addColumnAtEnd();
      };
    }

    // Botão flutuante de adicionar linha abaixo
    const btnAddRow = this.wrapper.querySelector('.btn-table-add-row');
    if (btnAddRow) {
      btnAddRow.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.addRowAtEnd(true);
      };
    }

    // Eventos de Células
    this.table.addEventListener('focusin', (e) => {
      const cell = e.target.closest('th, td');
      if (cell) this.activeCell = cell;
    });

    this.table.addEventListener('keydown', (e) => this.handleCellKeyDown(e));
    this.table.addEventListener('input', () => this.onChange());

    // Menu de Contexto ao Clicar com Botão Direito em qualquer Célula
    this.table.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest('th, td');
      if (cell) {
        e.preventDefault();
        this.activeCell = cell;
        this.openContextMenu(e.clientX, e.clientY);
      }
    });
  }

  createTableContextMenu() {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'notion-table-context-menu';
    this.contextMenu.innerHTML = `
      <div class="table-menu-section">Linha</div>
      <div class="table-menu-item" data-action="insert-row-above"><span class="material-symbols-outlined icon-xs">add</span> Inserir Linha Acima</div>
      <div class="table-menu-item" data-action="insert-row-below"><span class="material-symbols-outlined icon-xs">add</span> Inserir Linha Abaixo</div>
      <div class="table-menu-item danger" data-action="delete-row"><span class="material-symbols-outlined icon-xs">delete</span> Excluir Linha Selecionada</div>
      <div class="table-menu-divider"></div>
      <div class="table-menu-section">Coluna</div>
      <div class="table-menu-item" data-action="insert-col-left"><span class="material-symbols-outlined icon-xs">add</span> Inserir Coluna à Esquerda</div>
      <div class="table-menu-item" data-action="insert-col-right"><span class="material-symbols-outlined icon-xs">add</span> Inserir Coluna à Direita</div>
      <div class="table-menu-item danger" data-action="delete-col"><span class="material-symbols-outlined icon-xs">delete</span> Excluir Coluna Selecionada</div>
      <div class="table-menu-divider"></div>
      <div class="table-menu-item" data-action="clear-cell"><span class="material-symbols-outlined icon-xs">backspace</span> Limpar Célula</div>
    `;
    document.body.appendChild(this.contextMenu);

    this.contextMenu.querySelectorAll('.table-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        this.contextMenu.style.display = 'none';
        this.executeTableAction(action);
      });
    });

    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.contextMenu.style.display = 'none';
      }
    });
  }

  openContextMenu(x, y) {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'flex';
    const menuWidth = 220;
    const left = Math.min(x, window.innerWidth - menuWidth - 10);
    this.contextMenu.style.left = `${Math.max(10, left)}px`;
    this.contextMenu.style.top = `${y + 4}px`;
  }

  executeTableAction(action) {
    if (!this.activeCell) return;
    const tr = this.activeCell.parentElement;
    const allCellsInRow = Array.from(tr.querySelectorAll('th, td'));
    const colIdx = allCellsInRow.indexOf(this.activeCell);
    const isHeaderRow = tr.parentElement.tagName.toLowerCase() === 'thead';

    switch (action) {
      case 'insert-row-above':
        this.insertRowRelativeTo(tr, 'before');
        break;
      case 'insert-row-below':
        this.insertRowRelativeTo(tr, 'after');
        break;
      case 'delete-row':
        this.deleteSpecificRow(tr);
        break;
      case 'insert-col-left':
        this.insertColumnAt(colIdx);
        break;
      case 'insert-col-right':
        this.insertColumnAt(colIdx + 1);
        break;
      case 'delete-col':
        this.deleteColumnAt(colIdx);
        break;
      case 'clear-cell':
        this.activeCell.textContent = '';
        this.activeCell.focus();
        this.onChange();
        break;
    }
  }

  handleCellKeyDown(e) {
    const cell = e.target.closest('th, td');
    if (!cell) return;

    const tr = cell.parentElement;
    const allCellsInRow = Array.from(tr.querySelectorAll('th, td'));
    const colIdx = allCellsInRow.indexOf(cell);
    const allRows = Array.from(this.table.querySelectorAll('tr'));
    const rowIdx = allRows.indexOf(tr);

    // 1. Tecla TAB: Próxima célula ou Nova Linha na última célula
    if (e.key === 'Tab') {
      e.preventDefault();
      const allCells = Array.from(this.table.querySelectorAll('th, td'));
      const idx = allCells.indexOf(cell);

      if (e.shiftKey) {
        if (idx > 0) allCells[idx - 1].focus();
      } else {
        if (idx < allCells.length - 1) {
          allCells[idx + 1].focus();
        } else {
          this.addRowAtEnd(true);
        }
      }
      return;
    }

    // 2. Tecla ENTER: Pula para a célula de baixo
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (rowIdx < allRows.length - 1) {
        const nextRow = allRows[rowIdx + 1];
        const targetCell = nextRow.querySelectorAll('th, td')[colIdx];
        if (targetCell) targetCell.focus();
      } else {
        this.addRowAtEnd(true, colIdx);
      }
      return;
    }

    // 3. Setas Up / Down entre linhas
    if (e.key === 'ArrowDown') {
      if (rowIdx < allRows.length - 1) {
        const nextRow = allRows[rowIdx + 1];
        const targetCell = nextRow.querySelectorAll('th, td')[colIdx];
        if (targetCell) targetCell.focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (rowIdx > 0) {
        const prevRow = allRows[rowIdx - 1];
        const targetCell = prevRow.querySelectorAll('th, td')[colIdx];
        if (targetCell) targetCell.focus();
      }
    }
  }

  // Inserção e Remoção Precisa de Linhas
  insertRowRelativeTo(targetTr, position = 'after') {
    const colCount = this.table.querySelectorAll('thead tr th').length || 2;
    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.setAttribute('spellcheck', 'false');
      newTr.appendChild(td);
    }

    if (position === 'before') {
      if (targetTr.parentElement.tagName.toLowerCase() === 'thead') {
        // Não insere linha comum antes do thead; insere como primeira do tbody
        this.table.querySelector('tbody').prepend(newTr);
      } else {
        targetTr.insertAdjacentElement('beforebegin', newTr);
      }
    } else {
      if (targetTr.parentElement.tagName.toLowerCase() === 'thead') {
        this.table.querySelector('tbody').prepend(newTr);
      } else {
        targetTr.insertAdjacentElement('afterend', newTr);
      }
    }

    this.onChange();
    setTimeout(() => newTr.querySelector('td')?.focus(), 10);
  }

  deleteSpecificRow(targetTr) {
    if (targetTr.parentElement.tagName.toLowerCase() === 'thead') {
      alert('O cabeçalho da tabela não pode ser excluído diretamente.');
      return;
    }
    const tbodyRows = this.table.querySelectorAll('tbody tr');
    if (tbodyRows.length <= 1) {
      // Se for a única linha do corpo, apenas limpa
      targetTr.querySelectorAll('td').forEach(td => { td.textContent = ''; });
    } else {
      targetTr.remove();
    }
    this.onChange();
  }

  addRowAtEnd(focusFirst = false, focusCol = 0) {
    const colCount = this.table.querySelectorAll('thead tr th').length || 2;
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.setAttribute('spellcheck', 'false');
      tr.appendChild(td);
    }
    this.table.querySelector('tbody').appendChild(tr);
    this.onChange();

    if (focusFirst) {
      setTimeout(() => {
        const cells = tr.querySelectorAll('td');
        if (cells[focusCol]) cells[focusCol].focus();
        else if (cells[0]) cells[0].focus();
      }, 10);
    }
  }

  // Inserção e Remoção Precisa de Colunas
  insertColumnAt(colIndex) {
    const theadRow = this.table.querySelector('thead tr');
    const ths = Array.from(theadRow.querySelectorAll('th'));
    const newTh = document.createElement('th');
    newTh.setAttribute('contenteditable', 'true');
    newTh.setAttribute('spellcheck', 'false');
    newTh.textContent = `Coluna ${ths.length + 1}`;

    if (colIndex >= ths.length) {
      theadRow.appendChild(newTh);
    } else {
      ths[colIndex].insertAdjacentElement('beforebegin', newTh);
    }

    this.table.querySelectorAll('tbody tr').forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td'));
      const newTd = document.createElement('td');
      newTd.setAttribute('contenteditable', 'true');
      newTd.setAttribute('spellcheck', 'false');

      if (colIndex >= tds.length) {
        tr.appendChild(newTd);
      } else {
        tds[colIndex].insertAdjacentElement('beforebegin', newTd);
      }
    });

    this.onChange();
    setTimeout(() => newTh.focus(), 10);
  }

  deleteColumnAt(colIndex) {
    const ths = this.table.querySelectorAll('thead tr th');
    if (ths.length <= 1) {
      alert('A tabela precisa de pelo menos uma coluna.');
      return;
    }

    if (ths[colIndex]) ths[colIndex].remove();
    this.table.querySelectorAll('tbody tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds[colIndex]) tds[colIndex].remove();
    });

    this.onChange();
  }

  addColumnAtEnd() {
    this.insertColumnAt(this.table.querySelectorAll('thead tr th').length);
  }
}

function parseInline(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

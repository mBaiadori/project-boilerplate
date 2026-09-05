// =============================================================================
// VIEW MODULE: AI KNOWLEDGE WIKI & DECISIONS (KARPATHY-STYLE LLM-WIKI)
// =============================================================================
import { API } from '../api.js';

export function initWikiDecisionsView({ getActiveRepo }) {
  const container = document.getElementById('subview-wiki');
  if (!container) return { loadWiki: () => {} };

  let activeCategory = 'decisions';
  let wikiData = { decisions: [], concepts: [], gotchas: [], _rules: [], handoffs: [] };
  let activeEntry = null;

  function renderLayout() {
    container.innerHTML = `
      <div class="wiki-view-wrapper" style="display: flex; height: 100%; width: 100%; overflow: hidden; background: var(--bg-main, #f8fafc);">
        
        <!-- Left Sidebar: Categories & Page List -->
        <aside class="wiki-sidebar" style="width: 320px; flex-shrink: 0; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; background: var(--bg-card, #ffffff);">
          
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined icon-md" style="color: var(--primary, #2563eb);">menu_book</span>
                <h2 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-heading);">Wiki & Decisões IA</h2>
              </div>
              <button id="btn-wiki-new-entry" class="btn btn-primary btn-xs" style="display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined icon-xs">add</span> Novo
              </button>
            </div>
            <p style="margin: 0; font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              Conhecimento consolidado automaticamente pelas interações com IA e versionado no Git (<code>.spec-memory/</code>).
            </p>
          </div>

          <!-- Category Chips -->
          <div style="display: flex; gap: 4px; padding: 10px 14px; overflow-x: auto; border-bottom: 1px solid var(--border-color); background: var(--bg-hover, #f1f5f9);" id="wiki-category-tabs">
            <button class="chat-chip ${activeCategory === 'decisions' ? 'active' : ''}" data-cat="decisions" style="font-size: 11.5px;">🏛️ Decisões</button>
            <button class="chat-chip ${activeCategory === 'concepts' ? 'active' : ''}" data-cat="concepts" style="font-size: 11.5px;">🧩 Conceitos</button>
            <button class="chat-chip ${activeCategory === 'gotchas' ? 'active' : ''}" data-cat="gotchas" style="font-size: 11.5px;">⚠️ Gotchas</button>
            <button class="chat-chip ${activeCategory === '_rules' ? 'active' : ''}" data-cat="_rules" style="font-size: 11.5px;">🛡️ Regras</button>
            <button class="chat-chip ${activeCategory === 'handoffs' ? 'active' : ''}" data-cat="handoffs" style="font-size: 11.5px;">📜 Handoffs</button>
          </div>

          <!-- Page List -->
          <div id="wiki-entries-list" style="flex: 1; overflow-y: auto; padding: 10px;">
            <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 12px;">Carregando páginas...</div>
          </div>
        </aside>

        <!-- Main Content Area: Viewer & Editor -->
        <main class="wiki-main-pane" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-card, #ffffff);">
          <div id="wiki-content-header" style="padding: 14px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
            <div id="wiki-header-details">
              <h1 id="wiki-doc-title" style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: var(--text-heading);">Selecione uma página</h1>
              <div id="wiki-doc-meta" style="font-size: 12px; color: var(--text-muted);">Padrão Karpathy LLM-Wiki no Git</div>
            </div>
            <div id="wiki-header-actions" style="display: none; gap: 8px;">
              <button id="btn-wiki-edit-toggle" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined icon-xs">edit</span> Editar
              </button>
              <button id="btn-wiki-save-entry" class="btn btn-primary btn-sm" style="display: none; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined icon-xs">save</span> Salvar no Git
              </button>
            </div>
          </div>

          <!-- View / Edit Pane -->
          <div id="wiki-body-container" style="flex: 1; overflow-y: auto; padding: 24px 32px;">
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
              <span class="material-symbols-outlined icon-xl" style="color: var(--primary); opacity: 0.4; font-size: 48px;">library_books</span>
              <h3 style="margin: 14px 0 6px 0; font-size: 16px; color: var(--text-heading);">Wiki de Conhecimento do Projeto</h3>
              <p style="font-size: 13px; max-width: 480px; margin: 0 auto;">Navegue pelas decisões arquiteturais, regras de negócio e conceitos extraídos das sessões de IA com o seu time.</p>
            </div>
          </div>
        </main>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Category selection
    container.querySelectorAll('#wiki-category-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        container.querySelectorAll('#wiki-category-tabs button').forEach(b => b.classList.toggle('active', b === btn));
        renderEntriesList();
      });
    });

    // New Entry Button
    const btnNew = container.querySelector('#btn-wiki-new-entry');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        createNewEntry();
      });
    }

    // Edit Toggle
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    if (btnEdit && btnSave) {
      btnEdit.addEventListener('click', () => {
        if (!activeEntry) return;
        const isEditing = btnSave.style.display !== 'none';
        if (isEditing) {
          // Cancel edit -> view mode
          btnSave.style.display = 'none';
          btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
          renderActiveEntryView();
        } else {
          // View mode -> edit mode
          btnSave.style.display = 'inline-flex';
          btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
          renderActiveEntryEditor();
        }
      });

      btnSave.addEventListener('click', async () => {
        const textarea = container.querySelector('#wiki-editor-textarea');
        const titleInput = container.querySelector('#wiki-editor-title-input');
        if (!textarea || !activeEntry) return;

        btnSave.disabled = true;
        btnSave.textContent = 'Salvando no Git...';

        const repo = getActiveRepo()?.name || 'default';
        const title = titleInput ? titleInput.value.trim() : activeEntry.title;
        const content = textarea.value;

        try {
          const { ok, data } = await API.saveMemoryWikiEntry({
            repo,
            category: activeCategory,
            slug: activeEntry.slug,
            title,
            content
          });

          if (ok) {
            btnSave.style.display = 'none';
            btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
            await loadWiki();
          } else {
            alert('Erro ao salvar página da wiki.');
          }
        } catch (e) {
          alert('Erro de conexão ao salvar na wiki.');
        } finally {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar no Git';
        }
      });
    }
  }

  function renderEntriesList() {
    const listEl = container.querySelector('#wiki-entries-list');
    if (!listEl) return;

    const items = wikiData[activeCategory] || [];
    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 12px;">
          Nenhum registro nesta categoria.
        </div>
      `;
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 4px;">';
    items.forEach(item => {
      const isSelected = activeEntry && activeEntry.slug === item.slug && activeEntry.category === activeCategory;
      const updatedDate = item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : '';
      
      html += `
        <button class="wiki-entry-item ${isSelected ? 'selected' : ''}" data-slug="${item.slug}" style="text-align: left; padding: 10px 12px; border-radius: 6px; border: 1px solid ${isSelected ? 'var(--primary)' : 'transparent'}; background: ${isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}; cursor: pointer; display: flex; flex-direction: column; gap: 2px;">
          <strong style="font-size: 12.5px; color: var(--text-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</strong>
          <div style="font-size: 10.5px; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>${item.slug}.md</span>
            <span>${updatedDate}</span>
          </div>
        </button>
      `;
    });
    html += '</div>';
    listEl.innerHTML = html;

    listEl.querySelectorAll('.wiki-entry-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.slug;
        const entry = items.find(i => i.slug === slug);
        if (entry) {
          activeEntry = { ...entry, category: activeCategory };
          renderEntriesList();
          renderActiveEntryView();
        }
      });
    });
  }

  function renderActiveEntryView() {
    if (!activeEntry) return;

    const titleEl = container.querySelector('#wiki-doc-title');
    const metaEl = container.querySelector('#wiki-doc-meta');
    const bodyEl = container.querySelector('#wiki-body-container');
    const actionsEl = container.querySelector('#wiki-header-actions');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');

    if (btnSave) btnSave.style.display = 'none';
    if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Editar';
    if (actionsEl) actionsEl.style.display = 'flex';

    if (titleEl) titleEl.textContent = activeEntry.title;
    if (metaEl) {
      const author = activeEntry.frontmatter?.author || 'Developer';
      const handle = activeEntry.frontmatter?.author_handle ? `(@${activeEntry.frontmatter.author_handle})` : '';
      metaEl.innerHTML = `Categoria: <strong>${activeCategory}</strong> &bull; Arquivo: <code>.spec-memory/${activeCategory}/${activeEntry.file_name}</code> &bull; Autor: <strong>${author}</strong> ${handle}`;
    }

    if (bodyEl) {
      let parsed = '';
      if (typeof marked !== 'undefined' && marked.parse) {
        parsed = marked.parse(activeEntry.content);
      } else {
        parsed = `<pre>${activeEntry.content}</pre>`;
      }
      bodyEl.innerHTML = `<div class="wiki-rendered-markdown" style="font-size: 14px; line-height: 1.6; color: var(--text-body); max-width: 800px;">${parsed}</div>`;
    }
  }

  function renderActiveEntryEditor() {
    if (!activeEntry) return;
    const bodyEl = container.querySelector('#wiki-body-container');
    if (!bodyEl) return;

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <div>
          <label style="font-size: 12px; font-weight: 600; color: var(--text-heading); display: block; margin-bottom: 4px;">Título da Página:</label>
          <input type="text" id="wiki-editor-title-input" value="${activeEntry.title}" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px;" />
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label style="font-size: 12px; font-weight: 600; color: var(--text-heading); display: block; margin-bottom: 4px;">Conteúdo em Markdown:</label>
          <textarea id="wiki-editor-textarea" style="width: 100%; flex: 1; min-height: 400px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: vertical;" spellcheck="false">${activeEntry.content}</textarea>
        </div>
      </div>
    `;
  }

  function createNewEntry() {
    const defaultSlug = `nova-${activeCategory.replace('_', '')}-${Date.now().toString().slice(-4)}`;
    activeEntry = {
      slug: defaultSlug,
      title: 'Nova Decisão / Conceito',
      file_name: `${defaultSlug}.md`,
      content: '## Contexto\nDescreva aqui o problema e as motivações...\n\n## Decisão\nO que foi acordado com a equipe e com a IA...',
      category: activeCategory,
      frontmatter: {}
    };
    renderActiveEntryEditor();
    const actionsEl = container.querySelector('#wiki-header-actions');
    const btnSave = container.querySelector('#btn-wiki-save-entry');
    const btnEdit = container.querySelector('#btn-wiki-edit-toggle');
    if (actionsEl) actionsEl.style.display = 'flex';
    if (btnSave) btnSave.style.display = 'inline-flex';
    if (btnEdit) btnEdit.innerHTML = '<span class="material-symbols-outlined icon-xs">close</span> Cancelar';
  }

  async function loadWiki() {
    const repo = getActiveRepo()?.name || 'default';
    try {
      const { ok, data } = await API.getMemoryWiki({ repo });
      if (ok && data && data.wiki) {
        wikiData = data.wiki;
        renderEntriesList();
        if (activeEntry) {
          const currentList = wikiData[activeCategory] || [];
          const updated = currentList.find(i => i.slug === activeEntry.slug);
          if (updated) {
            activeEntry = { ...updated, category: activeCategory };
            renderActiveEntryView();
          }
        }
      }
    } catch (e) {
      console.warn('Could not load project wiki:', e);
    }
  }

  renderLayout();

  return {
    loadWiki
  };
}

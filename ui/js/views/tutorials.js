// =============================================================================
// VIEW MODULE: TUTORIAIS & GUIA DE ARQUITETURA (DDD, SDD, BDD, TDD)
// =============================================================================
import { API } from '../api.js';
import { Router } from '../router.js';

export function initTutorialsView({ onOpenInEditor }) {
  const tutorialsListContainer = document.getElementById('tutorials-list-container');
  const tutorialsSearchInput = document.getElementById('tutorials-search-input');
  const tutorialsTotalCount = document.getElementById('tutorials-total-count');
  const tutorialCurrentCategory = document.getElementById('tutorial-current-category');
  const tutorialCurrentTitle = document.getElementById('tutorial-current-title');
  const tutorialReadTime = document.getElementById('tutorial-read-time');
  const tutorialMarkdownContent = document.getElementById('tutorial-markdown-content');
  const btnTutorialOpenEditor = document.getElementById('btn-tutorial-open-editor');
  const btnPrevTutorial = document.getElementById('btn-prev-tutorial');
  const btnNextTutorial = document.getElementById('btn-next-tutorial');

  let cachedTutorials = [];
  let currentTutorialIndex = 0;

  async function loadTutorials(targetIdOrIndex = null) {
    tutorialsListContainer.innerHTML = '<div class="loading-state">Carregando guia e tutoriais...</div>';
    try {
      const { ok, data } = await API.getTutorials();
      if (ok && data.tutorials && data.tutorials.length > 0) {
        cachedTutorials = data.tutorials;
        if (tutorialsTotalCount) tutorialsTotalCount.textContent = `${cachedTutorials.length} tópicos`;
        renderTutorialsList(cachedTutorials);

        const route = Router.getRoute();
        const target = targetIdOrIndex || route.query.id || route.query.tutorial;
        let initialIdx = 0;
        if (target !== undefined && target !== null) {
          const foundIdx = cachedTutorials.findIndex(t => t.id === target || String(t.id) === String(target));
          if (foundIdx !== -1) initialIdx = foundIdx;
          else if (!isNaN(Number(target)) && Number(target) >= 0 && Number(target) < cachedTutorials.length) {
            initialIdx = Number(target);
          }
        }
        selectTutorial(initialIdx, false);
      } else {
        tutorialsListContainer.innerHTML = '<div class="empty-state">Nenhum tutorial encontrado.</div>';
      }
    } catch (err) {
      tutorialsListContainer.innerHTML = '<div class="empty-state">Erro ao carregar tutoriais.</div>';
    }
  }

  function renderTutorialsList(tutorials = []) {
    tutorialsListContainer.innerHTML = '';
    if (tutorials.length === 0) {
      tutorialsListContainer.innerHTML = '<div class="empty-state">Nenhum tópico corresponde à busca.</div>';
      return;
    }

    tutorials.forEach((tut, idx) => {
      const item = document.createElement('div');
      item.className = `tutorial-nav-item ${idx === currentTutorialIndex ? 'active' : ''}`;
      item.dataset.index = idx;

      let badgeClass = 'info';
      const bLower = (tut.badge || '').toLowerCase();
      if (bLower.includes('t0') || bLower.includes('ddd')) badgeClass = 't0';
      else if (bLower.includes('t1') || bLower.includes('sdd')) badgeClass = 't1';
      else if (bLower.includes('t2') || bLower.includes('bdd')) badgeClass = 't2';

      item.innerHTML = `
        <div class="tutorial-item-top">
          <span class="tutorial-item-category">${escapeHtml(tut.category || 'Geral')}</span>
          <span class="tree-badge-mini ${badgeClass}">${escapeHtml(tut.badge || 'Guia')}</span>
        </div>
        <div class="tutorial-item-title">${escapeHtml(tut.title)}</div>
        <div class="tutorial-item-meta">
          <span style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs">schedule</span> ${escapeHtml(tut.read_time || '3 min')}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        selectTutorial(idx);
      });

      tutorialsListContainer.appendChild(item);
    });
  }

  async function selectTutorial(index, updateUrl = true) {
    if (!cachedTutorials || index < 0 || index >= cachedTutorials.length) return;
    currentTutorialIndex = index;

    const tut = cachedTutorials[index];

    if (updateUrl && tut && tut.id) {
      Router.setQuery({ id: tut.id }, true);
    }

    // Update active class in sidebar
    document.querySelectorAll('.tutorial-nav-item').forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });

    // Update header meta
    if (tutorialCurrentCategory) tutorialCurrentCategory.textContent = tut.category || 'Geral';
    if (tutorialCurrentTitle) tutorialCurrentTitle.textContent = tut.title;
    if (tutorialReadTime) tutorialReadTime.innerHTML = `<span class="dot"></span> ${escapeHtml(tut.read_time || '3 min')}`;

    // Render markdown content
    if (typeof marked !== 'undefined') {
      tutorialMarkdownContent.innerHTML = marked.parse(tut.content || '');

      // Render Mermaid Diagrams if present
      if (typeof mermaid !== 'undefined') {
        const blocks = tutorialMarkdownContent.querySelectorAll('pre code.language-mermaid, .mermaid');
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const graph = block.textContent.trim();
          const div = document.createElement('div');
          div.className = 'mermaid-diagram-container';
          try {
            const { svg } = await mermaid.render(`tutorial-mermaid-${Date.now()}-${i}`, graph);
            div.innerHTML = svg;
            if (block.tagName.toLowerCase() === 'code') block.parentElement.replaceWith(div);
            else block.replaceWith(div);
          } catch (e) {
            console.error('Mermaid render error in tutorial:', e);
          }
        }
      }
    } else {
      tutorialMarkdownContent.textContent = tut.content || '';
    }

    // Scroll reader to top
    const readerPane = document.querySelector('.tutorials-reader-pane');
    if (readerPane) readerPane.scrollTop = 0;

    // Update Next / Prev buttons
    if (btnPrevTutorial) {
      btnPrevTutorial.style.display = index > 0 ? 'inline-flex' : 'none';
      if (index > 0) {
        btnPrevTutorial.textContent = `‹ ${cachedTutorials[index - 1].title.substring(0, 22)}...`;
      }
    }

    if (btnNextTutorial) {
      if (index < cachedTutorials.length - 1) {
        btnNextTutorial.style.display = 'inline-flex';
        btnNextTutorial.textContent = `Próximo: ${cachedTutorials[index + 1].title.substring(0, 22)}... ›`;
      } else {
        btnNextTutorial.style.display = 'none';
      }
    }
  }

  // Previous / Next button handlers
  if (btnPrevTutorial) {
    btnPrevTutorial.addEventListener('click', () => {
      if (currentTutorialIndex > 0) selectTutorial(currentTutorialIndex - 1);
    });
  }

  if (btnNextTutorial) {
    btnNextTutorial.addEventListener('click', () => {
      if (currentTutorialIndex < cachedTutorials.length - 1) selectTutorial(currentTutorialIndex + 1);
    });
  }

  // Practice in Editor Button
  if (btnTutorialOpenEditor) {
    btnTutorialOpenEditor.addEventListener('click', () => {
      const tut = cachedTutorials[currentTutorialIndex];
      if (tut && onOpenInEditor) {
        onOpenInEditor({
          filename: `tutorial-${tut.id}.md`,
          content: tut.content,
          title: tut.title
        });
      }
    });
  }

  // Search filter
  if (tutorialsSearchInput) {
    tutorialsSearchInput.addEventListener('input', () => {
      const q = tutorialsSearchInput.value.toLowerCase().trim();
      if (!q) {
        renderTutorialsList(cachedTutorials);
        return;
      }
      const filtered = cachedTutorials.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
      renderTutorialsList(filtered);
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    loadTutorials,
    selectTutorial
  };
}

// =============================================================================
// VIEW MODULE: ENGENHARIA & PADRÕES ARQUITETURAIS (ADRs, CONTRATOS, CONVENÇÕES)
// =============================================================================
import { API } from '../api.js';

export function initEngineeringView({ onOpenInEditor }) {
  const container = document.getElementById('engineering-grid-container');
  const btnNewEngineering = document.getElementById('btn-new-engineering-pattern');
  const btnAiEngineering = document.getElementById('btn-ai-engineering-pattern');
  const filterChipsContainer = document.getElementById('engineering-category-filters');
  const searchInput = document.getElementById('engineering-search-input');

  // Modal elements
  const modal = document.getElementById('engineering-modal');
  const btnCloseModal = document.getElementById('btn-close-eng-modal');
  const btnCancelModal = document.getElementById('btn-cancel-eng-modal');
  const btnSaveModal = document.getElementById('btn-save-eng-modal');
  const modalTitle = document.getElementById('eng-modal-title');
  const inputTitle = document.getElementById('eng-title-input');
  const selectCategory = document.getElementById('eng-category-select');
  const inputFilename = document.getElementById('eng-filename-input');
  const inputContent = document.getElementById('eng-content-input');
  const inputAiPrompt = document.getElementById('eng-ai-prompt-input');
  const btnGenerateAi = document.getElementById('btn-eng-generate-ai');

  let currentCategory = 'all';
  let searchQuery = '';
  let cachedFiles = [];

  // Filter chips
  if (filterChipsContainer) {
    filterChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.store-filter-chip');
      if (!chip) return;
      document.querySelectorAll('#engineering-category-filters .store-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category || 'all';
      renderEngineeringList();
    });
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderEngineeringList();
    });
  }

  // Modal Triggers
  if (btnNewEngineering) {
    btnNewEngineering.addEventListener('click', () => openModal());
  }
  if (btnAiEngineering) {
    btnAiEngineering.addEventListener('click', () => {
      openModal();
      if (inputAiPrompt) inputAiPrompt.focus();
    });
  }

  function openModal(item = null) {
    if (item) {
      modalTitle.textContent = `Editar Padrão: ${item.title}`;
      inputTitle.value = item.title || '';
      selectCategory.value = item.category || 'Padrão de Engenharia';
      inputFilename.value = item.filename || 'padrao.md';
      inputContent.value = item.content || '';
    } else {
      modalTitle.textContent = 'Novo Padrão de Engenharia / ADR';
      inputTitle.value = '';
      selectCategory.value = 'ADR';
      inputFilename.value = 'adr-001-decisao-arquitetural.md';
      inputContent.value = `---
id: "adr-001-decisao-arquitetural"
title: "ADR 001: Título da Decisão de Arquitetura"
type: "adr"
version: "1.0.0"
status: "active"
layer: "L4_ARTIFACT"
path: "engenharia/adr-001.md"
parent: "project/index.md"
---

# ADR 001: Título da Decisão de Arquitetura

## 1. Status
**ACEITO** (Data: 2026-09-02)

## 2. Contexto do Problema
Descreva as restrições arquiteturais, necessidades de escala, segurança ou resiliência.

## 3. Decisão de Engenharia
Descreva a solução técnica adotada, tecnologias e justificativa de trade-offs.

## 4. Consequências & Trade-offs
* **Positivas:** [Ganhos de performance, desacoplamento]
* **Negativas:** [Complexidade operacional inicial]
`;
    }
    if (inputAiPrompt) inputAiPrompt.value = '';
    if (modal) modal.style.display = 'flex';
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // AI Generator for ADRs & Patterns
  if (btnGenerateAi) {
    btnGenerateAi.addEventListener('click', async () => {
      const idea = (inputAiPrompt?.value || '').trim();
      if (!idea) {
        alert('Descreva a necessidade técnica ou decisão para o assistente gerar o padrão.');
        return;
      }
      btnGenerateAi.disabled = true;
      btnGenerateAi.textContent = 'Gerando ADR com IA...';

      try {
        const { ok, data } = await API.chat({
          prompt: `Gere uma especificação de padrão de engenharia / ADR estruturada em formato Markdown com Frontmatter para o seguinte contexto: "${idea}". Retorne o Markdown completo.`,
          path: 'engenharia/novo-padrao.md',
          content: ''
        });
        if (ok && data.reply) {
          inputContent.value = data.reply;
          const cleanName = idea.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
          inputFilename.value = `padrao-${cleanName}.md`;
          inputTitle.value = idea.substring(0, 40);
        } else {
          alert('Erro ao gerar padrão com IA.');
        }
      } catch (err) {
        alert('Erro ao conectar com a IA.');
      } finally {
        btnGenerateAi.disabled = false;
        btnGenerateAi.innerHTML = '<span class="material-symbols-outlined icon-xs">auto_awesome</span> Gerar Padrão com IA';
      }
    });
  }

  // Save Modal
  if (btnSaveModal) {
    btnSaveModal.addEventListener('click', async () => {
      const title = inputTitle.value.trim();
      const category = selectCategory.value;
      const filename = inputFilename.value.trim();
      const content = inputContent.value;

      if (!title || !filename) {
        alert('Por favor informe o título e o nome do arquivo.');
        return;
      }

      btnSaveModal.disabled = true;
      btnSaveModal.textContent = 'Salvando...';

      try {
        const { ok, data } = await API.createEngineeringFile({ title, category, filename, content });
        if (ok && data.success) {
          alert(data.message || 'Padrão criado com sucesso!');
          closeModal();
          await loadEngineeringFiles();
          if (onOpenInEditor) onOpenInEditor(data.path);
        } else {
          alert(data.error || 'Erro ao salvar padrão.');
        }
      } catch (e) {
        alert('Erro ao conectar com o servidor.');
      } finally {
        btnSaveModal.disabled = false;
        btnSaveModal.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar Padrão';
      }
    });
  }

  async function loadEngineeringFiles() {
    if (!container) return;
    container.innerHTML = '<div class="loading-state">Carregando padrões de engenharia...</div>';

    try {
      const { ok, data } = await API.getEngineeringFiles();
      if (ok) {
        cachedFiles = data.files || [];
        renderEngineeringList();
      } else {
        container.innerHTML = '<div class="empty-state">Erro ao carregar padrões de engenharia.</div>';
      }
    } catch (e) {
      container.innerHTML = '<div class="empty-state">Erro de comunicação com o servidor.</div>';
    }
  }

  function renderEngineeringList() {
    if (!container) return;
    container.innerHTML = '';

    const filtered = cachedFiles.filter(item => {
      // Category filter
      if (currentCategory !== 'all') {
        const c = (item.category || '').toLowerCase();
        const t = currentCategory.toLowerCase();
        if (!c.includes(t)) return false;
      }
      // Text search
      if (searchQuery) {
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const path = (item.path || '').toLowerCase();
        if (!title.includes(searchQuery) && !desc.includes(searchQuery) && !cat.includes(searchQuery) && !path.includes(searchQuery)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 36px; text-align: center;">
          <div style="margin-bottom: 8px;"><span class="material-symbols-outlined icon-xl" style="color: var(--md-sys-color-outline);">engineering</span></div>
          <h3>Nenhum padrão técnico encontrado</h3>
          <p class="subtitle">Adicione Architecture Decision Records (ADRs), convenções de mensageria, contratos de APIs ou diretrizes de segurança na pasta <code>engenharia/</code>.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="document.getElementById('btn-new-engineering-pattern').click()">
            <span class="material-symbols-outlined icon-xs">add</span> Criar Primeiro Padrão Técnico
          </button>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'template-card';

      const cleanTitle = escapeHtml(item.title || item.filename);
      const cleanCategory = escapeHtml(item.category || 'Engenharia');
      const cleanDesc = escapeHtml(item.description || '');

      card.innerHTML = `
        <div class="template-card-header">
          <span class="pill">${cleanCategory}</span>
          <span class="tree-badge-mini info" style="display: inline-flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined icon-xs">engineering</span> ENG
          </span>
        </div>
        <div class="template-card-body">
          <h3 class="template-title">${cleanTitle}</h3>
          <p class="template-desc">${cleanDesc}</p>
          <div class="template-code-preview" style="cursor: pointer;" title="Clique para abrir">
            <code>${escapeHtml((item.content || '').trim().substring(0, 160))}...</code>
          </div>
        </div>
        <div class="template-card-footer">
          <span style="font-size: 11px; color: var(--text-dim); font-family: monospace;">${escapeHtml(item.path)}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.editEngPattern('${escapeHtml(item.path)}')">
              <span class="material-symbols-outlined icon-xs">edit</span> Editar
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.openEngPattern('${escapeHtml(item.path)}')">
              <span class="material-symbols-outlined icon-xs">visibility</span> Abrir
            </button>
          </div>
        </div>
      `;

      card.querySelector('.template-code-preview').onclick = () => {
        if (onOpenInEditor) onOpenInEditor(item.path);
      };

      container.appendChild(card);
    });
  }

  window.openEngPattern = function(path) {
    if (onOpenInEditor) onOpenInEditor(path);
  };

  window.editEngPattern = function(path) {
    const item = cachedFiles.find(f => f.path === path);
    if (item) openModal(item);
  };

  return {
    loadEngineeringFiles
  };
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

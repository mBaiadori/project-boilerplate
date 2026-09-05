// =============================================================================
// VIEW MODULE: DICIONÁRIO UBÍQUO ESTRUTURADO (JSON, LISTA & CODENAME)
// =============================================================================
import { API } from '../api.js';

export function initDictionaryView({ onOpenDocument }) {
  const dictTermsTbody = document.getElementById('dict-terms-tbody');
  const dictSearchInput = document.getElementById('dict-search-input');
  const dictDomainFilters = document.getElementById('dict-domain-filters');
  const countDictTerms = document.getElementById('count-dict-terms');
  const btnOpenNewTerm = document.getElementById('btn-open-new-term');
  const btnCopyDictJson = document.getElementById('btn-copy-dict-json');

  // Modal Elements
  const dictTermModal = document.getElementById('dict-term-modal');
  const dictModalTitle = document.getElementById('dict-modal-title');
  const dictInputId = document.getElementById('dict-input-id');
  const dictInputTerm = document.getElementById('dict-input-term');
  const dictInputCodename = document.getElementById('dict-input-codename');
  const dictInputAliases = document.getElementById('dict-input-aliases');
  const dictInputDefinition = document.getElementById('dict-input-definition');
  const dictDomainsSelector = document.getElementById('dict-domains-selector');
  const dictInputStatus = document.getElementById('dict-input-status');
  const btnCloseDictModal = document.getElementById('btn-close-dict-modal');
  const btnCancelDictModal = document.getElementById('btn-cancel-dict-modal');
  const btnSaveDictModal = document.getElementById('btn-save-dict-modal');

  let allTerms = [];
  let availableDomains = ['core', 'billing', 'identidade', 'arquitetura'];
  let currentDomainFilter = 'all';
  let searchQuery = '';
  let selectedDomainsForModal = new Set(['core']);
  let isCodenameManuallyEdited = false;

  // 1. Event Listeners de Filtro e Busca
  if (dictSearchInput) {
    dictSearchInput.addEventListener('input', () => {
      searchQuery = dictSearchInput.value.trim().toLowerCase();
      renderTerms();
    });
  }

  if (dictDomainFilters) {
    dictDomainFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.store-filter-chip');
      if (!chip) return;
      dictDomainFilters.querySelectorAll('.store-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentDomainFilter = chip.dataset.domain || 'all';
      renderTerms();
    });
  }

  // 2. Codename Auto-sanitização e Sugestão
  if (dictInputCodename) {
    dictInputCodename.addEventListener('input', (e) => {
      isCodenameManuallyEdited = true;
      // Permite apenas letras, números e underlines
      e.target.value = e.target.value
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toUpperCase();
    });
  }

  if (dictInputTerm) {
    dictInputTerm.addEventListener('input', () => {
      if (!isCodenameManuallyEdited && dictInputCodename) {
        dictInputCodename.value = sanitizeCodename(dictInputTerm.value);
      }
    });
  }

  function sanitizeCodename(text) {
    if (!text) return '';
    return text
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  // 3. Modal Triggers
  if (btnOpenNewTerm) {
    btnOpenNewTerm.addEventListener('click', () => openTermModal());
  }

  if (btnCloseDictModal && dictTermModal) {
    btnCloseDictModal.addEventListener('click', () => { dictTermModal.style.display = 'none'; });
  }
  if (btnCancelDictModal && dictTermModal) {
    btnCancelDictModal.addEventListener('click', () => { dictTermModal.style.display = 'none'; });
  }

  if (btnCopyDictJson) {
    btnCopyDictJson.addEventListener('click', () => {
      const jsonStr = JSON.stringify(allTerms, null, 2);
      navigator.clipboard.writeText(jsonStr).then(() => {
        const originalHtml = btnCopyDictJson.innerHTML;
        btnCopyDictJson.innerHTML = '<span class="material-symbols-outlined icon-xs">check</span> JSON Copiado!';
        setTimeout(() => { btnCopyDictJson.innerHTML = originalHtml; }, 1600);
      });
    });
  }

  // 4. Salvar Termo (Criar ou Atualizar)
  if (btnSaveDictModal) {
    btnSaveDictModal.addEventListener('click', async () => {
      const termName = dictInputTerm ? dictInputTerm.value.trim() : '';
      const definition = dictInputDefinition ? dictInputDefinition.value.trim() : '';
      let codename = dictInputCodename ? dictInputCodename.value.trim() : '';

      if (!termName || !definition) {
        alert('Por favor, informe o Termo e a Definição.');
        return;
      }

      if (!codename) {
        codename = sanitizeCodename(termName);
      } else {
        codename = sanitizeCodename(codename);
      }

      const id = dictInputId.value.trim() || `term-${codename.toLowerCase().replace(/_/g, '-')}`;
      const domains = Array.from(selectedDomainsForModal);
      if (domains.length === 0) domains.push('core');

      const rawAliases = dictInputAliases ? dictInputAliases.value : '';
      const aliases = rawAliases
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const status = dictInputStatus ? dictInputStatus.value : 'approved';

      const newTerm = {
        id,
        term: termName,
        codename,
        definition,
        domains,
        aliases,
        status,
        updated_at: new Date().toISOString()
      };

      const existingIdx = allTerms.findIndex(t => t.id === id);
      if (existingIdx >= 0) {
        allTerms[existingIdx] = newTerm;
      } else {
        allTerms.unshift(newTerm);
      }

      if (dictTermModal) dictTermModal.style.display = 'none';
      renderTerms();
      renderDomainFilters();

      try {
        await API.saveDictionary(allTerms);
      } catch (err) {
        console.error('Erro ao salvar dicionário:', err);
      }
    });
  }

  async function syncAvailableDomains() {
    try {
      const { ok, data } = await API.getProjectDomainsDocs();
      if (ok && data && Array.isArray(data.domains)) {
        availableDomains = data.domains;
      }
    } catch (e) {
      console.warn('Erro ao carregar domínios do projeto:', e);
    }
  }

  function renderModalDomainChips() {
    if (!dictDomainsSelector) return;
    
    const allKnown = Array.from(new Set([...availableDomains, ...selectedDomainsForModal])).sort();
    
    dictDomainsSelector.innerHTML = allKnown.map(d => {
      const isSelected = selectedDomainsForModal.has(d);
      return `
        <button type="button" class="dict-chip-select ${isSelected ? 'active' : ''}" data-domain="${escapeHtml(d)}" style="display: inline-flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined icon-xs">${isSelected ? 'check' : 'add'}</span>
          <span>${escapeHtml(d)}</span>
        </button>
      `;
    }).join('');

    dictDomainsSelector.querySelectorAll('.dict-chip-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const dom = btn.dataset.domain;
        if (selectedDomainsForModal.has(dom)) {
          if (selectedDomainsForModal.size > 1) {
            selectedDomainsForModal.delete(dom);
          }
        } else {
          selectedDomainsForModal.add(dom);
        }
        renderModalDomainChips();
      });
    });
  }

  async function openTermModal(termObj = null) {
    await syncAvailableDomains();

    if (termObj) {
      isCodenameManuallyEdited = true;
      if (dictModalTitle) dictModalTitle.textContent = `Editar Termo: ${termObj.term}`;
      if (dictInputId) dictInputId.value = termObj.id || '';
      if (dictInputTerm) dictInputTerm.value = termObj.term || '';
      if (dictInputCodename) dictInputCodename.value = termObj.codename || sanitizeCodename(termObj.term || '');
      if (dictInputAliases) dictInputAliases.value = (termObj.aliases || []).join(', ');
      if (dictInputDefinition) dictInputDefinition.value = termObj.definition || '';
      if (dictInputStatus) dictInputStatus.value = termObj.status || 'approved';
      selectedDomainsForModal = new Set(Array.isArray(termObj.domains) && termObj.domains.length > 0 ? termObj.domains : ['core']);
    } else {
      isCodenameManuallyEdited = false;
      if (dictModalTitle) dictModalTitle.textContent = 'Novo Termo do Dicionário';
      if (dictInputId) dictInputId.value = '';
      if (dictInputTerm) dictInputTerm.value = '';
      if (dictInputCodename) dictInputCodename.value = '';
      if (dictInputAliases) dictInputAliases.value = '';
      if (dictInputDefinition) dictInputDefinition.value = '';
      if (dictInputStatus) dictInputStatus.value = 'approved';
      selectedDomainsForModal = new Set(['core']);
    }

    renderModalDomainChips();

    if (dictTermModal) {
      dictTermModal.style.display = 'flex';
      setTimeout(() => dictInputTerm?.focus(), 40);
    }
  }

  // 5. Carregar Dicionário do Backend
  async function loadDictionary() {
    if (dictTermsTbody) {
      dictTermsTbody.innerHTML = '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #64748b;">Carregando Dicionário Ubíquo...</td></tr>';
    }
    await syncAvailableDomains();
    try {
      const { ok, data } = await API.getDictionary();
      if (ok && data && Array.isArray(data.terms)) {
        allTerms = data.terms;
      } else {
        allTerms = [];
      }
      renderDomainFilters();
      renderTerms();
    } catch (err) {
      if (dictTermsTbody) {
        dictTermsTbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; color: #ef4444; text-align: center;">Erro ao carregar Dicionário Ubíquo.</td></tr>';
      }
    }
  }

  // 6. Renderizar Filtros por Domínio
  function renderDomainFilters() {
    if (!dictDomainFilters) return;
    const domainSet = new Set();
    allTerms.forEach(t => {
      if (Array.isArray(t.domains)) {
        t.domains.forEach(d => domainSet.add(d.toLowerCase()));
      }
    });

    const domains = Array.from(domainSet).sort();
    let html = `<button class="store-filter-chip ${currentDomainFilter === 'all' ? 'active' : ''}" data-domain="all">Todos (${allTerms.length})</button>`;
    
    domains.forEach(d => {
      const count = allTerms.filter(t => (t.domains || []).map(x => x.toLowerCase()).includes(d)).length;
      const isActive = currentDomainFilter === d ? 'active' : '';
      html += `<button class="store-filter-chip ${isActive}" data-domain="${escapeHtml(d)}">${escapeHtml(d)} (${count})</button>`;
    });

    dictDomainFilters.innerHTML = html;
  }

  // 7. Renderizar Lista em Tabela
  function renderTerms() {
    if (!dictTermsTbody) return;

    let filtered = allTerms.filter(t => {
      const termMatch = (t.term || '').toLowerCase().includes(searchQuery) ||
                        (t.codename || '').toLowerCase().includes(searchQuery) ||
                        (t.definition || '').toLowerCase().includes(searchQuery) ||
                        (t.aliases || []).some(a => a.toLowerCase().includes(searchQuery));
      
      const domainMatch = currentDomainFilter === 'all' ||
                          (t.domains || []).map(d => d.toLowerCase()).includes(currentDomainFilter);

      return termMatch && domainMatch;
    });

    if (countDictTerms) {
      countDictTerms.textContent = `${filtered.length} termo(s)`;
    }

    if (filtered.length === 0) {
      dictTermsTbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">
            <div style="margin-bottom: 8px;"><span class="material-symbols-outlined icon-xl" style="color: var(--md-sys-color-outline);">spellcheck</span></div>
            <strong style="color: var(--text-main); font-size: 14px;">Nenhum termo encontrado</strong>
            <p style="color: var(--text-muted); font-size: 12.5px; margin-top: 4px;">Ajuste a busca ou adicione um novo termo clicando em "+ Novo Termo".</p>
          </td>
        </tr>
      `;
      return;
    }

    dictTermsTbody.innerHTML = filtered.map(t => {
      const domainBadges = (t.domains || []).map(d => `
        <span class="dict-domain-badge">${escapeHtml(d)}</span>
      `).join(' ');

      const codenameHtml = t.codename
        ? `<span class="dict-codename-badge">${escapeHtml(t.codename)}</span>`
        : `<span class="dict-codename-badge">${escapeHtml(sanitizeCodename(t.term || ''))}</span>`;

      const aliasesHtml = (t.aliases && t.aliases.length > 0)
        ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Sinônimos: ${t.aliases.map(a => `<code>${escapeHtml(a)}</code>`).join(', ')}</div>`
        : '';

      return `
        <tr data-id="${escapeHtml(t.id)}">
          <td>
            <strong style="color: var(--text-main); font-size: 13.5px;">${escapeHtml(t.term)}</strong>
            ${aliasesHtml}
          </td>
          <td>
            ${codenameHtml}
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">${domainBadges}</div>
          </td>
          <td style="line-height: 1.45; font-size: 12.5px; color: var(--text-main);">
            ${escapeHtml(t.definition)}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-icon-subtle btn-edit-term" title="Editar Termo" style="padding: 4px 6px;"><span class="material-symbols-outlined icon-xs">edit</span></button>
            <button type="button" class="btn-icon-subtle btn-delete-term" title="Excluir Termo" style="padding: 4px 6px;"><span class="material-symbols-outlined icon-xs">delete</span></button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos nas Linhas da Tabela
    dictTermsTbody.querySelectorAll('tr').forEach(row => {
      const id = row.dataset.id;
      const termObj = allTerms.find(t => t.id === id);
      if (!termObj) return;

      const btnEdit = row.querySelector('.btn-edit-term');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          openTermModal(termObj);
        });
      }

      const btnDelete = row.querySelector('.btn-delete-term');
      if (btnDelete) {
        btnDelete.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Deseja excluir o termo "${termObj.term}" (${termObj.codename || ''}) do Dicionário Ubíquo?`)) {
            allTerms = allTerms.filter(t => t.id !== id);
            renderTerms();
            renderDomainFilters();
            try {
              await API.saveDictionary(allTerms);
            } catch (err) {
              console.error('Erro ao excluir termo:', err);
            }
          }
        });
      }
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
    loadDictionary
  };
}

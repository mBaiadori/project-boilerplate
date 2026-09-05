// =============================================================================
// VIEW MODULE: CENTRAL DE PULL REQUESTS & VISÃO HISTÓRICA
// =============================================================================
import { API } from '../api.js';

export function initPRsView() {
  const prsFullList = document.getElementById('prs-full-list');
  const prsSearchInput = document.getElementById('prs-search-input');
  const prsStatusFilters = document.getElementById('prs-status-filters');
  const btnRefreshPrs = document.getElementById('btn-refresh-prs');

  const countPrsAll = document.getElementById('count-prs-all');
  const countPrsOpen = document.getElementById('count-prs-open');
  const countPrsMerged = document.getElementById('count-prs-merged');
  const countPrsClosed = document.getElementById('count-prs-closed');

  let allPRs = [];
  let currentStatusFilter = 'all';
  let searchQuery = '';

  // 1. Event Listeners
  if (prsSearchInput) {
    prsSearchInput.addEventListener('input', () => {
      searchQuery = prsSearchInput.value.trim().toLowerCase();
      renderPRsFullList();
    });
  }

  if (prsStatusFilters) {
    prsStatusFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.store-filter-chip');
      if (!chip) return;
      prsStatusFilters.querySelectorAll('.store-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentStatusFilter = chip.dataset.status || 'all';
      renderPRsFullList();
    });
  }

  if (btnRefreshPrs) {
    btnRefreshPrs.addEventListener('click', () => loadAllPRs());
  }

  // 2. Carregar PRs da API
  async function loadAllPRs() {
    if (prsFullList) {
      prsFullList.innerHTML = '<div class="loading-state">Carregando histórico completo de PRs...</div>';
    }
    try {
      const res = await API.getPRs();
      if (res && Array.isArray(res.prs)) {
        allPRs = res.prs;
      } else if (res && res.data && Array.isArray(res.data.prs)) {
        allPRs = res.data.prs;
      } else {
        allPRs = [];
      }
      updateCounters();
      renderPRsFullList();
    } catch (err) {
      console.error('Erro ao carregar PRs:', err);
      if (prsFullList) {
        prsFullList.innerHTML = '<div class="empty-state" style="color: #ef4444;">Erro ao carregar lista de Pull Requests.</div>';
      }
    }
  }

  function updateCounters() {
    const total = allPRs.length;
    const openCount = allPRs.filter(p => (p.status || 'OPEN').toUpperCase() === 'OPEN' || (p.status || '').toUpperCase() === 'APPROVED').length;
    const mergedCount = allPRs.filter(p => (p.status || '').toUpperCase() === 'MERGED').length;
    const closedCount = allPRs.filter(p => (p.status || '').toUpperCase() === 'CLOSED').length;

    if (countPrsAll) countPrsAll.textContent = total;
    if (countPrsOpen) countPrsOpen.textContent = openCount;
    if (countPrsMerged) countPrsMerged.textContent = mergedCount;
    if (countPrsClosed) countPrsClosed.textContent = closedCount;
  }

  function formatDateSafe(dateVal) {
    if (!dateVal) return '';
    try {
      // Se for formato pt-br direto (ex: "02/09/2026 15:13")
      if (typeof dateVal === 'string' && dateVal.includes('/')) {
        return dateVal;
      }
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
    return String(dateVal);
  }

  function renderPRsFullList() {
    if (!prsFullList) return;
    prsFullList.innerHTML = '';

    let filtered = allPRs.filter(pr => {
      const st = (pr.status || 'OPEN').toUpperCase();
      
      let matchesStatus = true;
      if (currentStatusFilter === 'open') {
        matchesStatus = (st === 'OPEN' || st === 'APPROVED');
      } else if (currentStatusFilter === 'merged') {
        matchesStatus = (st === 'MERGED');
      } else if (currentStatusFilter === 'closed') {
        matchesStatus = (st === 'CLOSED');
      }

      const idStr = String(pr.id || '');
      const titleStr = (pr.title || '').toLowerCase();
      const authorStr = (pr.author || '').toLowerCase();
      const branchStr = (pr.branch || '').toLowerCase();
      const descStr = (pr.description || '').toLowerCase();

      const matchesSearch = !searchQuery ||
        idStr.includes(searchQuery) ||
        titleStr.includes(searchQuery) ||
        authorStr.includes(searchQuery) ||
        branchStr.includes(searchQuery) ||
        descStr.includes(searchQuery);

      return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
      prsFullList.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center;">
          <div style="margin-bottom: 8px;"><span class="material-symbols-outlined icon-xl" style="color: var(--md-sys-color-outline);">call_merge</span></div>
          <strong style="color: var(--text-normal); font-size: 14px;">Nenhum Pull Request encontrado neste filtro</strong>
          <p style="color: var(--text-muted); font-size: 12.5px; margin-top: 4px;">Alterne os filtros acima ou limpe a busca.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(pr => {
      const card = document.createElement('div');
      const st = (pr.status || 'OPEN').toUpperCase();
      const approvalsCount = Array.isArray(pr.approvals) ? pr.approvals.length : 0;
      const requiredApprovals = pr.required_approvals || 1;
      const createdDate = formatDateSafe(pr.created_at);
      const mergedDate = formatDateSafe(pr.merged_at);

      card.className = `pr-card status-${st.toLowerCase()}`;

      let actions = '';
      if (st === 'OPEN' || st === 'APPROVED') {
        actions = `
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-approve btn-sm" onclick="window.approvePrAction(${pr.id})">
              <span class="material-symbols-outlined icon-xs">check_circle</span> Aprovar como Reviewer (${approvalsCount}/${requiredApprovals})
            </button>
            <span style="font-size: 11.5px; color: #64748b; font-style: italic;">
              <span class="material-symbols-outlined icon-xs" style="vertical-align: middle;">bolt</span> O merge na branch <code>main</code> é executado automaticamente ao atingir o quórum.
            </span>
          </div>
        `;
      } else if (st === 'MERGED') {
        actions = `
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 8px;">
            <span style="font-size: 11.5px; color: #7e22ce; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined icon-xs">done_all</span> Auto-Merged na branch main ${mergedDate ? `em ${mergedDate}` : ''}
            </span>
            ${pr.html_url ? `<a href="${escapeHtml(pr.html_url)}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 11px;">Ver no GitHub ↗</a>` : ''}
          </div>
        `;
      } else {
        actions = `<span style="font-size: 11.5px; color: #64748b; font-weight: 500;">Fechado sem merge</span>`;
      }

      card.innerHTML = `
        <div class="pr-top">
          <div>
            <div class="pr-title" style="display: flex; align-items: center; gap: 8px;">
              <span>#PR-${pr.id}: ${escapeHtml(pr.title || 'Sem título')}</span>
            </div>
            <div class="pr-meta" style="margin-top: 4px;">
              Autor: <strong>${escapeHtml(pr.author || 'dev')}</strong> 
              ${createdDate ? `&bull; Criado em: <span>${createdDate}</span>` : ''}
              ${pr.file_path ? `&bull; Arquivo: <code>${escapeHtml(pr.file_path)}</code>` : ''}
            </div>
          </div>
          <span class="status-badge ${st}">${st === 'MERGED' ? 'AUTO-MERGED' : st}</span>
        </div>

        ${pr.description ? `<div style="font-size: 12px; color: #475569; line-height: 1.4; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${escapeHtml(pr.description)}</div>` : ''}

        <div class="pr-info-box">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined icon-xs">fork_right</span>
              <strong>Branch:</strong> <code>${escapeHtml(pr.branch || 'feature')}</code> &rarr; <code>${escapeHtml(pr.base_branch || 'main')}</code>
            </div>
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined icon-xs">group</span>
              <strong>Aprovações:</strong> ${approvalsCount > 0 ? pr.approvals.map(escapeHtml).join(', ') : 'Aguardando revisão'}
            </div>
          </div>
        </div>

        <div class="pr-actions">${actions}</div>
      `;
      prsFullList.appendChild(card);
    });
  }

  window.approvePrAction = async function(id) {
    const { ok, data } = await API.approvePR(id);
    if (ok && data.success) {
      alert(data.message || (data.auto_merged ? 'Quórum atingido e merge executado automaticamente!' : 'Aprovação registrada com sucesso!'));
      loadAllPRs();
    } else {
      alert(data.error || 'Erro ao registrar aprovação.');
    }
  };

  return {
    loadAllPRs
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

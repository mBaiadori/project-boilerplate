// =============================================================================
// VIEW MODULE: GOVERNANÇA & REVIEWERS POOL
// =============================================================================
import { API } from '../api.js';

export function initGovernanceView() {
  const govMinApprovalsSelect = document.getElementById('gov-min-approvals-select');
  const btnSaveGovSettings = document.getElementById('btn-save-gov-settings');
  const reviewersTableBody = document.getElementById('reviewers-table-body');
  const btnOpenAddReviewer = document.getElementById('btn-open-add-reviewer');
  const addReviewerPanel = document.getElementById('add-reviewer-panel');
  const btnCancelAddReviewer = document.getElementById('btn-cancel-add-reviewer');
  const newRevSelectMember = document.getElementById('new-rev-select-member');
  const newRevName = document.getElementById('new-rev-name');
  const newRevHandle = document.getElementById('new-rev-handle');
  const newRevRole = document.getElementById('new-rev-role');
  const newRevTier = document.getElementById('new-rev-tier');
  const btnConfirmAddReviewer = document.getElementById('btn-confirm-add-reviewer');

  let projectMembers = [];

  async function loadProjectMembersForGovernance() {
    try {
      const { ok, data } = await API.getProjectMembers();
      if (ok && data && Array.isArray(data.members)) {
        projectMembers = data.members;
        populateMemberSelect(projectMembers);
      }
    } catch (e) {
      console.warn('Erro ao carregar membros para governança:', e);
    }
  }

  function populateMemberSelect(members = []) {
    if (!newRevSelectMember) return;
    newRevSelectMember.innerHTML = '<option value="">-- Selecione um membro identificado no projeto --</option>';
    members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.handle;
      opt.textContent = `${m.name || m.login} (${m.handle}) — ${m.role || 'Membro'}`;
      opt.dataset.name = m.name || m.login;
      opt.dataset.handle = m.handle;
      opt.dataset.role = m.role || 'Tech Lead';
      newRevSelectMember.appendChild(opt);
    });
  }

  if (newRevSelectMember) {
    newRevSelectMember.addEventListener('change', () => {
      const selectedOpt = newRevSelectMember.selectedOptions[0];
      if (selectedOpt && selectedOpt.value) {
        newRevName.value = selectedOpt.dataset.name || '';
        newRevHandle.value = selectedOpt.dataset.handle || '';
        if (newRevRole && selectedOpt.dataset.role) {
          const roleVal = selectedOpt.dataset.role;
          if (roleVal.includes('Lead') || roleVal.includes('Owner')) newRevRole.value = 'Tech Lead';
          else if (roleVal.includes('Product') || roleVal.includes('PO')) newRevRole.value = 'Product Owner';
          else newRevRole.value = 'Staff Engineer';
        }
      }
    });
  }

  btnOpenAddReviewer.addEventListener('click', () => {
    loadProjectMembersForGovernance();
    addReviewerPanel.style.display = 'flex';
  });

  btnCancelAddReviewer.addEventListener('click', () => {
    addReviewerPanel.style.display = 'none';
    if (newRevSelectMember) newRevSelectMember.value = '';
    newRevName.value = '';
    newRevHandle.value = '';
  });

  btnConfirmAddReviewer.addEventListener('click', async () => {
    const name = newRevName.value.trim();
    const handle = newRevHandle.value.trim();
    const role = newRevRole.value;
    const tier = newRevTier.value;

    if (!name || !handle) {
      alert('Informe o nome e o GitHub handle (ex: @usuario).');
      return;
    }

    try {
      const { ok, data } = await API.addReviewer({ name, handle, role, tier });
      if (ok && data.success) {
        addReviewerPanel.style.display = 'none';
        if (newRevSelectMember) newRevSelectMember.value = '';
        newRevName.value = '';
        newRevHandle.value = '';
        renderReviewersTable(data.reviewers || []);
      }
    } catch (err) {
      alert('Erro ao adicionar reviewer.');
    }
  });

  btnSaveGovSettings.addEventListener('click', async () => {
    const min_approvals = parseInt(govMinApprovalsSelect.value || 1);
    btnSaveGovSettings.disabled = true;
    btnSaveGovSettings.textContent = 'Salvando...';

    try {
      const { ok, data } = await API.updateGovernanceSettings({ min_approvals });
      if (ok && data.success) {
        alert(data.message);
      }
    } catch (err) {
      alert('Erro ao salvar configurações.');
    } finally {
      btnSaveGovSettings.disabled = false;
      btnSaveGovSettings.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar Regra de Branch';
    }
  });

  async function loadGovernanceData() {
    try {
      const data = await API.getGovernance();
      const gov = data.governance || {};
      govMinApprovalsSelect.value = String(gov.min_approvals || 1);
      renderReviewersTable(gov.reviewers || []);
    } catch (err) {
      console.error('Erro ao carregar governança:', err);
    }
  }

  function renderReviewersTable(reviewers = []) {
    reviewersTableBody.innerHTML = '';
    if (reviewers.length === 0) {
      reviewersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-dim);">Nenhum reviewer cadastrado.</td></tr>';
      return;
    }

    reviewers.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td><code>${escapeHtml(r.handle)}</code></td>
        <td>${escapeHtml(r.role)}</td>
        <td><span class="pill">${escapeHtml(r.tier)}</span></td>
        <td style="text-align: right;">
          <button class="btn-icon-subtle btn-remove-rev" onclick="window.removeReviewerAction('${r.id}')" title="Remover Revisor">
            <span class="material-symbols-outlined icon-xs">delete</span>
          </button>
        </td>
      `;
      reviewersTableBody.appendChild(tr);
    });
  }

  window.removeReviewerAction = async function(id) {
    if (confirm('Deseja remover este reviewer?')) {
      const { ok, data } = await API.removeReviewer(id);
      if (ok && data.success) {
        loadGovernanceData();
      }
    }
  };

  return {
    loadGovernanceData
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

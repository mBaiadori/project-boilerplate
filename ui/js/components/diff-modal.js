// =============================================================================
// COMPONENT: CENTRAL DE PROPOSTA DE PR, DIFF AMIGÁVEL & WORKSPACE STAGING
// =============================================================================
import { API } from '../api.js';

export function initDiffModal({ onPROpened, onDiscardChanges }) {
  const modal = document.getElementById('workspace-diff-modal');
  const btnOpenNavbar = document.getElementById('btn-open-workspace-diff');
  const btnClose = document.getElementById('btn-close-diff-modal');
  const btnCancel = document.getElementById('btn-cancel-diff-modal');
  const btnDirectReview = document.getElementById('btn-review-diff-direct');

  const pendingBadgeText = document.getElementById('pending-changes-badge-text');
  const diffGuardrailBadge = document.getElementById('diff-guardrail-badge');
  const diffFilesCount = document.getElementById('diff-files-count');
  const diffAdditionsCount = document.getElementById('diff-additions-count');
  const diffDeletionsCount = document.getElementById('diff-deletions-count');
  const diffFilesContainer = document.getElementById('diff-files-container');

  const prTitleInput = document.getElementById('unified-pr-title-input');
  const prDescInput = document.getElementById('unified-pr-desc-input');
  const btnGenerateSummaryAI = document.getElementById('btn-generate-pr-summary-ai');
  const btnSubmitUnifiedPR = document.getElementById('btn-submit-unified-pr');
  const btnDiscardWorkspace = document.getElementById('btn-discard-workspace');

  // Pre-Flight Sync Banner Elements
  const preflightBanner = document.getElementById('diff-preflight-sync-banner');
  const preflightIcon = document.getElementById('preflight-icon');
  const preflightTitle = document.getElementById('preflight-title');
  const preflightDesc = document.getElementById('preflight-desc');
  const preflightActions = document.getElementById('preflight-banner-actions');

  function open() {
    modal.style.display = 'flex';
    loadWorkspaceDiffs();
  }

  function close() {
    modal.style.display = 'none';
  }

  if (btnOpenNavbar) btnOpenNavbar.addEventListener('click', open);
  if (btnDirectReview) btnDirectReview.addEventListener('click', open);
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnCancel) btnCancel.addEventListener('click', close);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') close();
  });

  async function updateBadgeStatus() {
    try {
      const data = await API.getWorkspaceChanges();
      const count = data.total_files || 0;
      if (count > 0) {
        btnOpenNavbar.style.display = 'inline-flex';
        pendingBadgeText.textContent = `${count} alteração(ões) pendente(s)`;
      } else {
        btnOpenNavbar.style.display = 'none';
      }
    } catch (e) {}
  }

  async function loadWorkspaceDiffs() {
    diffFilesContainer.innerHTML = '<div class="loading-state">Calculando diffs do workspace...</div>';
    
    if (preflightBanner) {
      preflightBanner.style.display = 'flex';
      preflightBanner.className = 'preflight-sync-banner';
      if (preflightIcon) preflightIcon.textContent = 'search';
      if (preflightTitle) preflightTitle.textContent = 'Verificando status da branch main remota...';
      if (preflightDesc) preflightDesc.textContent = 'Comparando com a versão mais recente do GitHub para prevenir conflitos.';
      if (preflightActions) preflightActions.innerHTML = '';
    }

    try {
      const [data, syncRes] = await Promise.all([
        API.getWorkspaceChanges(),
        API.getProjectSyncStatus()
      ]);
      const syncData = (syncRes && syncRes.ok && syncRes.data) ? syncRes.data : syncRes;

      if (preflightBanner && syncData) {
        if (syncData.remote_ahead_by > 0) {
          if (syncData.conflict_risk) {
            preflightBanner.className = 'preflight-sync-banner danger';
            if (preflightIcon) preflightIcon.textContent = 'warning';
            if (preflightTitle) preflightTitle.textContent = `Risco de Conflito (${syncData.conflicting_files.length} arquivo(s))`;
            if (preflightDesc) preflightDesc.textContent = `A main remota recebeu ${syncData.remote_ahead_by} commit(s) que modificaram arquivos que você alterou: ${syncData.conflicting_files.join(', ')}.`;
          } else {
            preflightBanner.className = 'preflight-sync-banner warning';
            if (preflightIcon) preflightIcon.textContent = 'info';
            if (preflightTitle) preflightTitle.textContent = `A main possui ${syncData.remote_ahead_by} novo(s) commit(s) (Sem conflitos)`;
            if (preflightDesc) preflightDesc.textContent = 'As atualizações da main estão em outros arquivos do projeto e não afetam diretamente este PR.';
          }
        } else {
          preflightBanner.className = 'preflight-sync-banner success';
          if (preflightIcon) preflightIcon.textContent = 'check_circle';
          if (preflightTitle) preflightTitle.textContent = 'Sincronizado com a main remota';
          if (preflightDesc) preflightDesc.textContent = 'Nenhum conflito de versão detectado. Pronto para abrir o Pull Request!';
        }
      }

      const changes = data.changes || [];
      const totalAdditions = data.total_additions || 0;
      const totalDeletions = data.total_deletions || 0;
      const totalFiles = data.total_files || 0;

      diffFilesCount.textContent = totalFiles;
      diffAdditionsCount.textContent = totalAdditions;
      diffDeletionsCount.textContent = totalDeletions;

      // Guardrail styling
      diffGuardrailBadge.textContent = (data.guardrail || 'Pequeno (Ideal)').replace(/[🟢🟡🔴]/g, '').trim();
      if (data.guardrail?.includes('GRANDE')) {
        diffGuardrailBadge.className = 'pill';
        diffGuardrailBadge.style.color = '#ef4444';
        diffGuardrailBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else if (data.guardrail?.includes('MÉDIO')) {
        diffGuardrailBadge.className = 'pill';
        diffGuardrailBadge.style.color = '#f59e0b';
        diffGuardrailBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      } else {
        diffGuardrailBadge.className = 'pill';
        diffGuardrailBadge.style.color = '#10b981';
        diffGuardrailBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }

      if (changes.length === 0) {
        diffFilesContainer.innerHTML = '<div class="empty-state">Nenhuma alteração pendente no workspace. O repositório está limpo e sincronizado!</div>';
        return;
      }

      diffFilesContainer.innerHTML = '';
      changes.forEach(c => {
        const fileBox = document.createElement('div');
        fileBox.className = 'diff-file-card';

        let badgeType = 'Modificado';
        let badgeClass = 'warning';
        if (c.type === 'ADDED') {
          badgeType = 'Criado';
          badgeClass = 'protected';
        } else if (c.type === 'DELETED') {
          badgeType = 'Excluído';
          badgeClass = 'danger';
        }

        const headerHtml = `
          <div class="diff-file-header">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
              <span class="pill ${badgeClass}" style="font-size: 10.5px; flex-shrink: 0;">${badgeType}</span>
              <code style="color: var(--text-heading); font-weight: 600; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.path)}">${escapeHtml(c.path)}</code>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              <span style="font-size: 11px; color: var(--text-muted);">
                <span style="color: var(--success); font-weight: 600;">+${c.additions}</span> / <span style="color: var(--danger); font-weight: 600;">-${c.deletions}</span>
              </span>
              <button 
                type="button" 
                class="btn-discard-file-change" 
                data-path="${escapeHtml(c.path)}" 
                title="Descartar alterações apenas deste arquivo"
                aria-label="Descartar alterações de ${escapeHtml(c.path)}"
              >
                <span class="material-symbols-outlined icon-xs">undo</span>
                <span>Descartar</span>
              </button>
            </div>
          </div>
        `;

        const diffPre = document.createElement('div');
        diffPre.className = 'diff-content-block';

        const lines = (c.diff_text || '').split('\n');
        if (lines.length === 0 || !c.diff_text) {
          diffPre.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">Sem diff textual disponível</span>`;
        } else {
          diffPre.innerHTML = lines.map(line => {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              return `<div class="diff-line-add">${escapeHtml(line)}</div>`;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              return `<div class="diff-line-del">${escapeHtml(line)}</div>`;
            } else if (line.startsWith('@@')) {
              return `<div style="color: #60a5fa; font-weight: 600; padding: 2px 4px;">${escapeHtml(line)}</div>`;
            } else {
              return `<div style="color: #94a3b8; padding: 1px 4px;">${escapeHtml(line)}</div>`;
            }
          }).join('');
        }

        fileBox.innerHTML = headerHtml;
        fileBox.appendChild(diffPre);

        // Bind single-file discard button
        const btnDiscardSingle = fileBox.querySelector('.btn-discard-file-change');
        if (btnDiscardSingle) {
          btnDiscardSingle.addEventListener('click', async (e) => {
            e.stopPropagation();
            const targetFilePath = btnDiscardSingle.dataset.path;
            if (confirm(`Deseja descartar as alterações do arquivo "${targetFilePath}"? O arquivo voltará ao estado original.`)) {
              btnDiscardSingle.disabled = true;
              btnDiscardSingle.innerHTML = '<span class="material-symbols-outlined icon-xs spin">progress_activity</span><span>Descartando...</span>';
              try {
                const { ok, data } = await API.discardWorkspaceChanges(targetFilePath);
                if (ok && data.success) {
                  await loadWorkspaceDiffs();
                  await updateBadgeStatus();
                  if (onDiscardChanges) onDiscardChanges(targetFilePath);
                } else {
                  alert(data?.error || 'Erro ao descartar alteração.');
                  btnDiscardSingle.disabled = false;
                  btnDiscardSingle.innerHTML = '<span class="material-symbols-outlined icon-xs">undo</span><span>Descartar</span>';
                }
              } catch (err) {
                alert('Falha na comunicação ao descartar alteração.');
                btnDiscardSingle.disabled = false;
                btnDiscardSingle.innerHTML = '<span class="material-symbols-outlined icon-xs">undo</span><span>Descartar</span>';
              }
            }
          });
        }

        diffFilesContainer.appendChild(fileBox);
      });

    } catch (e) {
      diffFilesContainer.innerHTML = '<div class="empty-state">Erro ao calcular diffs.</div>';
    }
  }

  // AI PR Summary Generator
  btnGenerateSummaryAI.addEventListener('click', async () => {
    btnGenerateSummaryAI.disabled = true;
    btnGenerateSummaryAI.textContent = 'Gerando com IA...';

    try {
      const { ok, data } = await API.generatePRSummaryAI();
      if (ok && data.title) {
        prTitleInput.value = data.title;
        if (data.description) prDescInput.value = data.description;
      }
    } catch (e) {
      alert('Erro ao gerar resumo do PR com IA.');
    } finally {
      btnGenerateSummaryAI.disabled = false;
      btnGenerateSummaryAI.innerHTML = '<span class="material-symbols-outlined icon-xs">auto_awesome</span> Gerar Resumo & Impacto com IA';
    }
  });

  // Submit Unified PR (com Pre-Step de Sincronismo e Conflitos)
  btnSubmitUnifiedPR.addEventListener('click', async () => {
    const title = prTitleInput.value.trim() || 'Proposta de Alterações Oficiais';
    const description = prDescInput.value.trim();

    btnSubmitUnifiedPR.disabled = true;
    btnSubmitUnifiedPR.textContent = 'Verificando sincronismo com a main...';

    try {
      // 1. Pre-Step: Verifica se a main remota possui conflitos
      const syncRes = await API.getProjectSyncStatus();
      const syncData = (syncRes && syncRes.ok && syncRes.data) ? syncRes.data : syncRes;

      if (syncData && syncData.conflict_risk) {
        btnSubmitUnifiedPR.disabled = false;
        btnSubmitUnifiedPR.innerHTML = '<span class="material-symbols-outlined icon-xs">call_merge</span> Criar Pull Request';
        alert(`Conflito Detectado!\n\nA branch main remota foi atualizada com novos commits que modificaram os mesmos arquivos deste PR:\n- ${syncData.conflicting_files.join('\n- ')}\n\nPor favor, revise as alterações ou sincronize seu workspace antes de prosseguir com o push.`);
        return;
      }

      // 2. Se estiver limpo/sem conflito, prossegue com o push e PR
      btnSubmitUnifiedPR.textContent = 'Enviando commits e criando PR...';
      const { ok, data } = await API.createUnifiedPR({ title, description });
      if (ok && data.success) {
        alert(data.message || 'Pull Request criado com sucesso!');
        close();
        updateBadgeStatus();
        if (onPROpened) onPROpened(data.pr);
      } else {
        alert(data.error || 'Erro ao criar Pull Request unificado.');
      }
    } catch (e) {
      alert('Erro ao criar Pull Request unificado.');
    } finally {
      btnSubmitUnifiedPR.disabled = false;
      btnSubmitUnifiedPR.innerHTML = '<span class="material-symbols-outlined icon-xs">call_merge</span> Criar Pull Request';
    }
  });

  // Discard Workspace Changes (All)
  btnDiscardWorkspace.addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja descartar TODAS as alterações pendentes no workspace? Os arquivos voltarão ao estado anterior.')) {
      btnDiscardWorkspace.disabled = true;
      try {
        const { ok, data } = await API.discardWorkspaceChanges();
        if (ok && data.success) {
          alert('↩️ Alterações descartadas com sucesso!');
          close();
          updateBadgeStatus();
          if (onDiscardChanges) onDiscardChanges();
        } else {
          alert(data?.error || 'Erro ao descartar alterações.');
        }
      } catch (e) {
        alert('Erro ao descartar alterações.');
      } finally {
        btnDiscardWorkspace.disabled = false;
      }
    }
  });

  return {
    open,
    close,
    updateBadgeStatus,
    loadWorkspaceDiffs
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

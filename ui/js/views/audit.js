// =============================================================================
// VIEW MODULE: AUDITORIA DE QUALIDADE, SEGURANÇA (SAST) & FEEDBACK LOOPS
// =============================================================================
import { API } from '../api.js';

export function initAuditView({ onOpenDocument }) {
  const auditScoreNumber = document.getElementById('audit-score-number');
  const auditScoreGrade = document.getElementById('audit-score-grade');
  const auditTotalDocs = document.getElementById('audit-total-docs');
  
  const barFrontmatter = document.getElementById('audit-bar-frontmatter');
  const valFrontmatter = document.getElementById('audit-val-frontmatter');
  const barLinks = document.getElementById('audit-bar-links');
  const valLinks = document.getElementById('audit-val-links');
  const barSecurity = document.getElementById('audit-bar-security');
  const valSecurity = document.getElementById('audit-val-security');
  const barBDD = document.getElementById('audit-bar-bdd');
  const valBDD = document.getElementById('audit-val-bdd');

  const auditIssuesList = document.getElementById('audit-issues-list');
  const auditLoopsList = document.getElementById('audit-loops-list');
  const auditFilterBtns = document.querySelectorAll('.audit-filter-btn');
  const btnRefreshAudit = document.getElementById('btn-refresh-audit');

  let currentAuditData = null;
  let activeSeverityFilter = 'all';

  async function loadAudit() {
    if (auditIssuesList) {
      auditIssuesList.innerHTML = '<div class="loading-state">Executando auditoria contínua de governança...</div>';
    }

    try {
      const data = await API.getAuditReport();
      currentAuditData = data;
      renderScore(data);
      renderChecks(data.checks || {});
      renderIssues(data.issues || []);
      renderFeedbackLoops(data.feedback_loops || []);
    } catch (err) {
      if (auditIssuesList) {
        auditIssuesList.innerHTML = '<div class="loading-state" style="color: var(--danger);">Erro ao carregar auditoria.</div>';
      }
    }
  }

  function renderScore(data) {
    if (auditScoreNumber) auditScoreNumber.textContent = `${data.score || 100}%`;
    if (auditScoreGrade) {
      auditScoreGrade.textContent = `Grade ${data.grade || 'A+'}`;
      auditScoreGrade.className = `audit-grade grade-${(data.grade || 'A').replace('+', '_plus')}`;
    }
    if (auditTotalDocs) auditTotalDocs.textContent = `${data.total_docs || 0} documentos indexados`;
  }

  function renderChecks(checks) {
    const fm = checks.frontmatter || 100;
    const lk = checks.broken_links || 100;
    const sec = checks.security || 100;
    const bdd = checks.bdd_compliance || 100;

    if (barFrontmatter) barFrontmatter.style.width = `${fm}%`;
    if (valFrontmatter) valFrontmatter.textContent = `${fm}%`;

    if (barLinks) barLinks.style.width = `${lk}%`;
    if (valLinks) valLinks.textContent = `${lk}%`;

    if (barSecurity) barSecurity.style.width = `${sec}%`;
    if (valSecurity) valSecurity.textContent = `${sec}%`;

    if (barBDD) barBDD.style.width = `${bdd}%`;
    if (valBDD) valBDD.textContent = `${bdd}%`;
  }

  function renderIssues(issues) {
    if (!auditIssuesList) return;

    const filtered = issues.filter(issue => {
      if (activeSeverityFilter === 'all') return true;
      return issue.severity === activeSeverityFilter;
    });

    if (filtered.length === 0) {
      auditIssuesList.innerHTML = `
        <div class="audit-empty-success">
          <span class="material-symbols-outlined icon-lg" style="color: var(--md-sys-color-success); margin-bottom: 6px;">check_circle</span>
          <strong>Nenhuma inconformidade detectada!</strong>
          <span>O workspace está 100% alinhado aos padrões de governança, Clean Arch e segurança.</span>
        </div>
      `;
      return;
    }

    auditIssuesList.innerHTML = filtered.map(issue => {
      const sevClass = issue.severity === 'danger' ? 'sev-danger' : (issue.severity === 'warning' ? 'sev-warning' : 'sev-info');
      const sevLabel = issue.severity === 'danger' ? 'Crítico' : (issue.severity === 'warning' ? 'Aviso' : 'Recomendação');

      return `
        <div class="audit-issue-card ${sevClass}">
          <div class="issue-left">
            <div class="issue-header-row">
              <span class="issue-tag ${sevClass}">${sevLabel}</span>
              <span class="issue-category">${escapeHtml(issue.category)}</span>
              <code class="issue-path">${escapeHtml(issue.path)}</code>
            </div>
            <p class="issue-message">${escapeHtml(issue.message)}</p>
          </div>
          <button class="btn btn-secondary btn-sm btn-fix-doc" data-path="${escapeHtml(issue.path)}">
            Abrir Spec ↗
          </button>
        </div>
      `;
    }).join('');

    auditIssuesList.querySelectorAll('.btn-fix-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        if (onOpenDocument) onOpenDocument(path);
      });
    });
  }

  function renderFeedbackLoops(loops) {
    if (!auditLoopsList) return;

    if (loops.length === 0) {
      auditLoopsList.innerHTML = `
        <div class="empty-state-sm">
          Nenhum loop de feedback ativo no momento. As esteiras estão em fluxo contínuo normal.
        </div>
      `;
      return;
    }

    auditLoopsList.innerHTML = loops.map(loop => {
      return `
        <div class="loop-card">
          <div class="loop-info">
            <span class="loop-badge">Gatilho: <code>${escapeHtml(loop.trigger)}</code></span>
            <span class="loop-title">${escapeHtml(loop.source_title || loop.source_path)}</span>
          </div>
          <div class="loop-action-row">
            <span class="loop-arrow" style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs">arrow_forward</span> Alvo:</span>
            <button class="btn-link-doc" data-path="${escapeHtml(loop.target_path)}">
              <code>${escapeHtml(loop.target_path)}</code>
            </button>
          </div>
        </div>
      `;
    }).join('');

    auditLoopsList.querySelectorAll('.btn-link-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        if (onOpenDocument) onOpenDocument(path);
      });
    });
  }

  // Filter Buttons
  auditFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      auditFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSeverityFilter = btn.dataset.filter || 'all';
      if (currentAuditData) {
        renderIssues(currentAuditData.issues || []);
      }
    });
  });

  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener('click', () => loadAudit());
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  return {
    load: loadAudit
  };
}

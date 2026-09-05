// =============================================================================
// COMPONENT: SCAFFOLD WIZARD MODAL (CRIAÇÃO GUIADA DE DOMÍNIOS, ÁREAS E FEATURES)
// =============================================================================
import { API } from '../api.js';

export function initScaffoldModal({ onScaffoldSuccess }) {
  const modalBackdrop = document.getElementById('scaffold-wizard-modal');
  const btnClose = document.getElementById('btn-close-scaffold-modal');
  const btnCancel = document.getElementById('btn-cancel-scaffold');
  const btnConfirm = document.getElementById('btn-confirm-scaffold');

  // Type Selection Buttons
  const typeBtns = document.querySelectorAll('.scaffold-type-tab');
  const groupDomain = document.getElementById('scaffold-group-domain');
  const groupArea = document.getElementById('scaffold-group-area');
  const groupFeature = document.getElementById('scaffold-group-feature');
  const groupRisk = document.getElementById('scaffold-group-risk');
  const groupCrossCutting = document.getElementById('scaffold-group-cross');

  // Inputs
  const inputDomainSelect = document.getElementById('scaffold-domain-select');
  const inputDomainCustom = document.getElementById('scaffold-domain-custom');
  const inputAreaSelect = document.getElementById('scaffold-area-select');
  const inputAreaCustom = document.getElementById('scaffold-area-custom');
  const inputFeatureName = document.getElementById('scaffold-feature-name');
  const inputFeatureTitle = document.getElementById('scaffold-feature-title');
  const crossCuttingCheckboxes = document.getElementById('scaffold-cross-container');
  const previewPathCode = document.getElementById('scaffold-preview-path');

  let activeType = 'feature'; // 'feature' | 'subdomain' | 'domain'
  let cachedGraph = null;

  async function openModal(defaultType = 'feature') {
    activeType = defaultType;
    modalBackdrop.style.display = 'flex';
    setTypeTab(activeType);

    try {
      cachedGraph = await API.getProjectGraph();
      populateDropdowns(cachedGraph.nodes || {});
      updatePathPreview();
    } catch (err) {
      console.warn('Erro ao carregar grafo no wizard:', err);
    }
  }

  function closeModal() {
    modalBackdrop.style.display = 'none';
  }

  function setTypeTab(type) {
    activeType = type;
    typeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });

    if (type === 'domain') {
      groupDomain.style.display = 'block';
      groupArea.style.display = 'none';
      groupFeature.style.display = 'none';
      groupRisk.style.display = 'none';
      groupCrossCutting.style.display = 'none';
    } else if (type === 'subdomain') {
      groupDomain.style.display = 'block';
      groupArea.style.display = 'block';
      groupFeature.style.display = 'none';
      groupRisk.style.display = 'none';
      groupCrossCutting.style.display = 'none';
    } else {
      groupDomain.style.display = 'block';
      groupArea.style.display = 'block';
      groupFeature.style.display = 'block';
      groupRisk.style.display = 'block';
      groupCrossCutting.style.display = 'block';
    }
    updatePathPreview();
  }

  function populateDropdowns(nodes) {
    const domainsSet = new Set();
    const areasMap = {}; // domain -> Set of areas

    Object.keys(nodes).forEach(p => {
      if (p.startsWith('domains/')) {
        const parts = p.split('/');
        if (parts.length >= 2) {
          const dom = parts[1];
          domainsSet.add(dom);
          if (!areasMap[dom]) areasMap[dom] = new Set();
          if (parts.length >= 3 && !parts[2].endsWith('.md')) {
            areasMap[dom].add(parts[2]);
          }
        }
      }
    });

    const domainsList = Array.from(domainsSet);
    inputDomainSelect.innerHTML = domainsList.map(d => `<option value="${d}">${d}</option>`).join('') +
      '<option value="__custom__">+ Criar Novo Domínio...</option>';

    function updateAreasForSelectedDomain() {
      const currentDom = inputDomainSelect.value;
      if (currentDom === '__custom__') {
        inputDomainCustom.style.display = 'block';
        inputAreaSelect.innerHTML = '<option value="__custom__">+ Digitar Nova Área...</option>';
        inputAreaCustom.style.display = 'block';
      } else {
        inputDomainCustom.style.display = 'none';
        const areas = Array.from(areasMap[currentDom] || []);
        inputAreaSelect.innerHTML = areas.map(a => `<option value="${a}">${a}</option>`).join('') +
          '<option value="__custom__">+ Criar Nova Área...</option>';
        if (areas.length > 0) {
          inputAreaCustom.style.display = 'none';
        } else {
          inputAreaCustom.style.display = 'block';
        }
      }
      updatePathPreview();
    }

    inputDomainSelect.onchange = updateAreasForSelectedDomain;
    inputAreaSelect.onchange = () => {
      if (inputAreaSelect.value === '__custom__') inputAreaCustom.style.display = 'block';
      else inputAreaCustom.style.display = 'none';
      updatePathPreview();
    };

    updateAreasForSelectedDomain();

    // Populate Cross-Cutting options
    if (crossCuttingCheckboxes) {
      const candidates = Object.entries(nodes).filter(([p, n]) => p.endsWith('.md') && p !== 'index.md');
      crossCuttingCheckboxes.innerHTML = candidates.map(([p, n]) => {
        return `
          <label class="cross-checkbox-item">
            <input type="checkbox" name="cross-candidate" value="${p}">
            <div class="cross-text">
              <span class="cross-title">${escapeHtml(n.title || p)}</span>
              <span class="cross-path">${escapeHtml(p)}</span>
            </div>
          </label>
        `;
      }).join('');
    }
  }

  function getEffectiveDomain() {
    if (inputDomainSelect.value === '__custom__') return (inputDomainCustom.value || 'novo-dominio').trim().toLowerCase();
    return (inputDomainSelect.value || 'novo-dominio').trim().toLowerCase();
  }

  function getEffectiveArea() {
    if (inputAreaSelect.value === '__custom__') return (inputAreaCustom.value || 'core').trim().toLowerCase();
    return (inputAreaSelect.value || 'core').trim().toLowerCase();
  }

  function updatePathPreview() {
    if (!previewPathCode) return;
    const dom = getEffectiveDomain();
    const area = getEffectiveArea();
    const feat = (inputFeatureName.value || 'MINHA-FEATURE').trim().toUpperCase();

    if (activeType === 'domain') {
      previewPathCode.textContent = `domains/${dom}/index.md`;
    } else if (activeType === 'subdomain') {
      previewPathCode.textContent = `domains/${dom}/${area}/index.md`;
    } else {
      previewPathCode.textContent = `domains/${dom}/${area}/${feat}/ (Esteira completa: 8 documentos)`;
    }
  }

  inputDomainCustom.oninput = updatePathPreview;
  inputAreaCustom.oninput = updatePathPreview;
  inputFeatureName.oninput = () => {
    if (!inputFeatureTitle.dataset.manualEdited) {
      inputFeatureTitle.value = inputFeatureName.value.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    updatePathPreview();
  };

  inputFeatureTitle.oninput = () => {
    inputFeatureTitle.dataset.manualEdited = 'true';
  };

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => setTypeTab(btn.dataset.type));
  });

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Gerando Esteira...';

      const dom = getEffectiveDomain();
      const area = getEffectiveArea();
      const name = (inputFeatureName.value || 'NOVA-FEATURE').trim();
      const title = (inputFeatureTitle.value || name).trim();

      const selectedRisk = document.querySelector('input[name="scaffold-risk-radio"]:checked')?.value || 'tier_2';
      const crossTargets = Array.from(document.querySelectorAll('input[name="cross-candidate"]:checked')).map(cb => cb.value);

      const payload = {
        type: activeType,
        domain: dom,
        area: area,
        name: name,
        title: title,
        risk_tier: selectedRisk,
        cross_cutting: crossTargets
      };

      try {
        const { ok, data } = await API.scaffoldEntity(payload);
        if (ok && data.success) {
          closeModal();
          if (onScaffoldSuccess) {
            onScaffoldSuccess(data.primary_file);
          }
        } else {
          alert('Erro ao gerar esteira: ' + (data?.error || 'Erro desconhecido.'));
        }
      } catch (err) {
        alert('Erro ao conectar com o servidor para criar esteira.');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Criar & Abrir Esteira';
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  return {
    open: openModal,
    close: closeModal
  };
}

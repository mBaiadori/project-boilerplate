// =============================================================================
// VIEW MODULE: GLOBAL GRAPH & CROSS-CUTTING EXPLORER
// =============================================================================
import { API } from '../api.js';

export function initGraphView({ onOpenDocument }) {
  const container = document.getElementById('subview-graph');
  const graphMermaidBox = document.getElementById('graph-mermaid-box');
  const graphStatsContainer = document.getElementById('graph-stats-container');
  const graphNodesList = document.getElementById('graph-nodes-list');
  const graphFilterBtns = document.querySelectorAll('.graph-filter-btn');
  const btnRefreshGraph = document.getElementById('btn-refresh-graph');
  const blastRadiusSelect = document.getElementById('blast-radius-select');
  const blastRadiusResult = document.getElementById('blast-radius-result');

  let currentGraphData = null;
  let activeFilter = 'all';

  async function loadGraph() {
    if (graphMermaidBox) {
      graphMermaidBox.innerHTML = '<div class="loading-state">Calculando grafo de relações e camadas L1-L4...</div>';
    }

    try {
      const data = await API.getProjectGraph();
      currentGraphData = data;
      renderStats(data.stats);
      renderFilterNodes(data.nodes);
      renderMermaidDiagram(data.nodes);
      populateBlastRadiusSelector(data.nodes);
    } catch (err) {
      if (graphMermaidBox) {
        graphMermaidBox.innerHTML = '<div class="loading-state" style="color: var(--danger);">Erro ao carregar grafo do projeto.</div>';
      }
    }
  }

  function renderStats(stats) {
    if (!graphStatsContainer || !stats) return;
    const byLayer = stats.by_layer || {};
    graphStatsContainer.innerHTML = `
      <div class="graph-stat-pill"><span class="stat-num">${stats.total_nodes || 0}</span> Docs Totais</div>
      <div class="graph-stat-pill"><span class="stat-num">${byLayer.L1_PROJECT || 0}</span> L1 Raiz</div>
      <div class="graph-stat-pill"><span class="stat-num">${byLayer.L2_DOMAIN || 0}</span> L2 Domínios</div>
      <div class="graph-stat-pill"><span class="stat-num">${byLayer.L3_SUBDOMAIN || 0}</span> L3 Áreas</div>
      <div class="graph-stat-pill"><span class="stat-num">${byLayer.L4_FEATURE || 0}</span> L4 Features</div>
      <div class="graph-stat-pill highlight"><span class="stat-num">${stats.total_cross_cutting || 0}</span> Conexões Cross-Cutting</div>
    `;
  }

  function renderFilterNodes(nodes) {
    if (!graphNodesList || !nodes) return;
    const entries = Object.entries(nodes);
    
    const filtered = entries.filter(([path, node]) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'L1') return node.layer === 'L1_PROJECT';
      if (activeFilter === 'L2') return node.layer === 'L2_DOMAIN';
      if (activeFilter === 'L3') return node.layer === 'L3_SUBDOMAIN';
      if (activeFilter === 'L4') return node.layer === 'L4_FEATURE' || node.layer === 'L4_ARTIFACT';
      if (activeFilter === 'cross') return (node.dependencies && node.dependencies.length > 0) || (node.consumers && node.consumers.length > 0);
      return true;
    });

    if (filtered.length === 0) {
      graphNodesList.innerHTML = '<div class="empty-state">Nenhum nó encontrado para este filtro.</div>';
      return;
    }

    graphNodesList.innerHTML = filtered.map(([path, node]) => {
      const consumersCount = (node.consumers || []).length;
      const depsCount = (node.dependencies || []).length;
      const layerBadge = node.layer ? node.layer.replace('_PROJECT', '').replace('_DOMAIN', '').replace('_SUBDOMAIN', '').replace('_FEATURE', '').replace('_ARTIFACT', '') : 'DOC';

      return `
        <div class="graph-node-card" data-path="${path}">
          <div class="node-card-header">
            <span class="node-layer-badge layer-${layerBadge}">${layerBadge}</span>
            <span class="node-title">${escapeHtml(node.title || path)}</span>
          </div>
          <div class="node-path">${escapeHtml(path)}</div>
          <div class="node-meta-row">
            ${consumersCount > 0 ? `<span class="badge-consumer" title="Outros documentos que dependem deste" style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs">link</span> ${consumersCount} consumidor(es)</span>` : ''}
            ${depsCount > 0 ? `<span class="badge-dep" title="Contratos consumidos" style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs">arrow_forward</span> ${depsCount} dependência(s)</span>` : ''}
            ${consumersCount === 0 && depsCount === 0 ? `<span class="badge-neutral">Isolado</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach click event to open doc
    graphNodesList.querySelectorAll('.graph-node-card').forEach(card => {
      card.addEventListener('click', () => {
        const path = card.dataset.path;
        if (onOpenDocument) onOpenDocument(path);
      });
    });
  }

  function renderMermaidDiagram(nodes) {
    if (!graphMermaidBox || !nodes) return;
    const entries = Object.entries(nodes);
    if (entries.length === 0) {
      graphMermaidBox.innerHTML = '<div class="empty-state">Nenhum documento disponível no workspace.</div>';
      return;
    }

    let mm = 'graph TD\n';
    mm += '  classDef l1 fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff;\n';
    mm += '  classDef l2 fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#fff;\n';
    mm += '  classDef l3 fill:#1e1e38,stroke:#a78bfa,stroke-width:2px,color:#fff;\n';
    mm += '  classDef l4 fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;\n';
    mm += '  classDef cross fill:#4a044e,stroke:#f472b6,stroke-width:2px,color:#fff,stroke-dasharray: 4 4;\n\n';

    const safeId = (p) => 'N_' + p.replace(/[^a-zA-Z0-9]/g, '_');

    // Declare Nodes
    entries.forEach(([path, node]) => {
      const nid = safeId(path);
      const title = (node.title || path).replace(/"/g, "'");
      const layer = node.layer || 'L4_ARTIFACT';
      let cls = 'l4';
      if (layer === 'L1_PROJECT') cls = 'l1';
      else if (layer === 'L2_DOMAIN') cls = 'l2';
      else if (layer === 'L3_SUBDOMAIN') cls = 'l3';

      mm += `  ${nid}["${title}<br/><small>${path}</small>"]:::${cls}\n`;
    });

    mm += '\n  %% Conexões Hierárquicas (Parent -> Child)\n';
    entries.forEach(([path, node]) => {
      (node.children || []).forEach(child => {
        if (nodes[child.path]) {
          mm += `  ${safeId(path)} --> ${safeId(child.path)}\n`;
        }
      });
    });

    mm += '\n  %% Relações Cross-Cutting (Inter-Domínios)\n';
    entries.forEach(([path, node]) => {
      (node.dependencies || []).forEach(dep => {
        if (nodes[dep.target_path]) {
          const relLabel = (dep.relation_type || 'consumes').replace(/_/g, ' ');
          mm += `  ${safeId(path)} -.->|"${relLabel}"| ${safeId(dep.target_path)}\n`;
        }
      });
    });

    graphMermaidBox.innerHTML = `<div class="mermaid">${mm}</div>`;
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.run({ nodes: graphMermaidBox.querySelectorAll('.mermaid') });
      } catch (err) {
        console.warn('Erro ao renderizar Mermaid:', err);
      }
    }
  }

  function populateBlastRadiusSelector(nodes) {
    if (!blastRadiusSelect || !nodes) return;
    blastRadiusSelect.innerHTML = '<option value="">Selecione um documento para simular o impacto de mudança...</option>' +
      Object.entries(nodes).map(([path, node]) => {
        return `<option value="${path}">[${node.layer}] ${node.title || path}</option>`;
      }).join('');
  }

  if (blastRadiusSelect) {
    blastRadiusSelect.addEventListener('change', () => {
      const selectedPath = blastRadiusSelect.value;
      if (!selectedPath || !currentGraphData || !currentGraphData.nodes[selectedPath]) {
        if (blastRadiusResult) blastRadiusResult.innerHTML = '';
        return;
      }

      const node = currentGraphData.nodes[selectedPath];
      const blast = node.blast_radius || [];
      const consumers = node.consumers || [];

      if (blast.length === 0 && consumers.length === 0) {
        blastRadiusResult.innerHTML = `
          <div class="blast-box safe">
            <strong style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs" style="color: var(--md-sys-color-success);">check_circle</span> Impacto Local Isolado:</strong> Nenhuma outra funcionalidade consome este documento. Alterações não causam efeitos colaterais em outros domínios.
          </div>
        `;
      } else {
        blastRadiusResult.innerHTML = `
          <div class="blast-box warning">
            <strong style="display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined icon-xs" style="color: var(--md-sys-color-warning);">warning</span> Raio de Impacto Detectado (${blast.length + consumers.length} nós afetados):</strong>
            <p>Se você alterar as invariantes ou contratos deste documento, os seguintes nós sofrerão impacto direto ou indireto:</p>
            <ul>
              ${consumers.map(c => `<li><strong>Consumidor Direto:</strong> <code>${escapeHtml(c.source_path)}</code> (${c.relation_type || 'consumes'})</li>`).join('')}
              ${blast.filter(b => !consumers.some(c => c.source_path === b.path)).map(b => `<li><strong>Dependente Indireto:</strong> <code>${escapeHtml(b.path)}</code></li>`).join('')}
            </ul>
          </div>
        `;
      }
    });
  }

  // Filter Buttons
  graphFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      graphFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'all';
      if (currentGraphData) {
        renderFilterNodes(currentGraphData.nodes);
      }
    });
  });

  if (btnRefreshGraph) {
    btnRefreshGraph.addEventListener('click', () => loadGraph());
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    load: loadGraph
  };
}

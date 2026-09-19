import React, { useState } from 'react';
import type { TreeNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface FileTreeProps {
  onOpenFile: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  onOpenFile,
  isCollapsed,
  onToggleCollapse
}) => {
  const { tree, activeFile, loadTree } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('domain-ideacao');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const computeTargetPath = () => {
    const rawName = (itemName || '').trim().toLowerCase().replace(/\s+/g, '-');
    const cleanName = rawName || 'novo-item';

    if (itemType === 'domain-ideacao') return `domains/${cleanName}/ideacao.md`;
    if (itemType === 'domain-kpis') return `domains/${cleanName}/kpis.md`;
    if (itemType === 'bdd-specs') return `specs/${cleanName}.md`;
    if (itemType === 'folder') return `domains/${cleanName}`;
    return `${cleanName}.md`;
  };

  const handleCreateConfirm = async () => {
    const targetPath = computeTargetPath();
    const isFolder = itemType === 'folder';

    try {
      await API.createProjectFile({
        path: targetPath,
        is_folder: isFolder,
        content: isFolder ? '' : `# ${itemName || 'Novo Documento'}\n\nDocumento gerado no workspace.`
      });
      await loadTree();
      setIsCreating(false);
      setItemName('');
      if (!isFolder) {
        onOpenFile(targetPath);
      }
    } catch (e) {
      console.error('[FileTree] Erro ao criar item:', e);
    }
  };

  const toggleNode = (path: string) => {
    setCollapsedNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
    if (!searchTerm.trim()) return nodes;
    const term = searchTerm.toLowerCase();

    return nodes.reduce<TreeNode[]>((acc, node) => {
      if (node.name.toLowerCase().includes(term) || node.path.toLowerCase().includes(term)) {
        acc.push(node);
      } else if (node.children) {
        const filtered = filterNodes(node.children);
        if (filtered.length > 0) {
          acc.push({ ...node, children: filtered });
        }
      }
      return acc;
    }, []);
  };

  const renderTreeItem = (node: TreeNode, depth = 0) => {
    const isFolder = node.is_directory || node.type === 'directory' || (node.children && node.children.length > 0);
    const isNodeCollapsed = collapsedNodes[node.path];
    const isSelected = activeFile === node.path;

    return (
      <div key={node.path} className="tree-node-wrapper">
        <div
          className={`tree-node-row ${isSelected ? 'active' : ''}`}
          onClick={() => {
            if (isFolder) {
              toggleNode(node.path);
            } else {
              onOpenFile(node.path);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
        >
          {isFolder ? (
            <span className="tree-arrow">{isNodeCollapsed ? '▸' : '▾'}</span>
          ) : (
            <span className="tree-doc-bullet">•</span>
          )}
          <span className="tree-node-name">{node.name}</span>
        </div>

        {isFolder && !isNodeCollapsed && node.children && (
          <div className="tree-children-container">
            {node.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = filterNodes(tree);

  if (isCollapsed) {
    return (
      <button
        id="btn-expand-tree-pane"
        className="btn-expand-sidebar"
        title="Expandir Árvore"
        onClick={onToggleCollapse}
      >
        <span>›</span>
      </button>
    );
  }

  return (
    <>
      <aside className="workbench-tree-pane" id="workbench-tree-pane">
        <div className="tree-pane-header">
          <div className="tree-pane-title">
            <span>Documentos</span>
          </div>
          <div className="tree-pane-actions">
            <button
              id="btn-tree-new-file"
              className="btn-icon"
              title="Novo Documento"
              onClick={() => setIsCreating(!isCreating)}
            >
              +
            </button>
            <button
              id="btn-tree-refresh"
              className="btn-icon"
              title="Recarregar Árvore"
              onClick={() => loadTree()}
            >
              ↻
            </button>
            <button
              id="btn-toggle-tree-pane"
              className="btn-icon"
              title="Recolher Árvore"
              onClick={onToggleCollapse}
            >
              ‹
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="tree-search-box">
          <input
            type="text"
            id="tree-search-input"
            placeholder="Filtrar domínios..."
            spellCheck="false"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Inline Creator Panel */}
        {isCreating && (
          <div id="tree-create-panel" className="tree-create-box">
            <div className="tree-create-header">
              <span id="tree-create-title">Criar Novo Item</span>
              <button
                id="btn-cancel-tree-create"
                className="btn-close-sm"
                onClick={() => setIsCreating(false)}
              >
                <span className="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="tree-item-name" style={{ fontSize: '11px' }}>Nome:</label>
              <input
                type="text"
                id="tree-item-name"
                placeholder="ex: pagamentos, notificacoes"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                autoFocus
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }} id="tree-item-path-preview">
                Destino: <code>{computeTargetPath()}</code>
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="tree-item-type" style={{ fontSize: '11px' }}>Tipo de Item:</label>
              <select
                id="tree-item-type"
                style={{ fontSize: '12px', padding: '5px 8px' }}
                value={itemType}
                onChange={e => setItemType(e.target.value)}
              >
                <option value="domain-ideacao">Domínio: Ideação (T1)</option>
                <option value="domain-kpis">Domínio: KPIs & Invariantes</option>
                <option value="bdd-specs">Cenário BDD (Gherkin)</option>
                <option value="custom-file">Documento Avulso (.md)</option>
                <option value="folder">Nova Pasta / Domínio</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
              <button
                id="btn-confirm-cancel-tree"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsCreating(false)}
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-create-tree"
                className="btn btn-primary btn-sm"
                onClick={handleCreateConfirm}
              >
                Criar
              </button>
            </div>
          </div>
        )}

        {/* Tree Nodes Container */}
        <div className="tree-scroll-container">
          <div id="tree-nodes-container" className="antigravity-tree-root">
            {filteredTree.length === 0 ? (
              <div className="loading-state">Nenhum documento encontrado</div>
            ) : (
              filteredTree.map(node => renderTreeItem(node))
            )}
          </div>
        </div>
      </aside>

      <div
        id="resizer-tree"
        className="pane-resizer"
        title="Arrastar para redimensionar árvore"
      ></div>
    </>
  );
};

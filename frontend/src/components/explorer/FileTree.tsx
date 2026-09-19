// =============================================================================
// COMPONENT: ÁRVORE DE DOCUMENTOS & EXPLORER (CONFLUENCE-GRADE)
// 100% fiel à estrutura DOM, classes CSS, animações de pasta e menus de contexto
// =============================================================================

import React, { useState, useMemo } from 'react';
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
  const [customCreationParentFolder, setCustomCreationParentFolder] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('domain-ideacao');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Rename Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameOldPath, setRenameOldPath] = useState('');
  const [renameNewPath, setRenameNewPath] = useState('');

  // Path Computation
  const computeTargetPath = () => {
    const rawName = (itemName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const cleanName = rawName || 'novo-item';

    let path = '';
    if (customCreationParentFolder) {
      path =
        itemType === 'folder'
          ? `${customCreationParentFolder}/${cleanName}`
          : `${customCreationParentFolder}/${cleanName}.md`;
    } else if (itemType === 'domain-ideacao') {
      path = `domains/${cleanName}/ideacao.md`;
    } else if (itemType === 'domain-kpis') {
      path = `domains/${cleanName}/kpis.md`;
    } else if (itemType === 'bdd-specs') {
      path = `specs/${cleanName}.md`;
    } else if (itemType === 'folder') {
      path = `domains/${cleanName}`;
    } else {
      path = `${cleanName}.md`;
    }

    return { path, isFolder: itemType === 'folder', cleanName, type: itemType };
  };

  const handleCreateConfirm = async () => {
    const { path, isFolder, cleanName, type } = computeTargetPath();
    if (!itemName.trim()) {
      alert('Informe o nome do item.');
      return;
    }

    let initialContent = '';
    if (type === 'domain-ideacao') {
      initialContent = `# Domínio: ${cleanName.toUpperCase()}\n\n> Bounded Context: \`${cleanName}\` — Tier 1\n\n## Visão de Negócio\nObjetivos e finalidade deste domínio.\n\n## Entidades Oficiais\n- \`${cleanName}_id\`: Identificador único.\n`;
    } else if (type === 'domain-kpis') {
      initialContent = `# Invariantes & KPIs: ${cleanName.toUpperCase()}\n\n- SLA de Resposta: < 200ms\n- Disponibilidade: 99.99%\n`;
    } else if (type === 'bdd-specs') {
      initialContent = `# Cenários BDD: ${cleanName.toUpperCase()}\n\nFeature: Gestão de ${cleanName}\n\n  Scenario: Execução com Sucesso\n    Given que o usuário possui permissão\n    When solicita a ação\n    Then a operação é aprovada\n`;
    } else if (!isFolder) {
      initialContent = `# ${cleanName.toUpperCase()}\n\nDocumento gerado no workspace.\n`;
    }

    try {
      const res = await API.createProjectFile({
        path,
        is_folder: isFolder,
        content: initialContent
      });
      if (res.ok) {
        setIsCreating(false);
        setItemName('');
        setCustomCreationParentFolder('');
        await loadTree();
        if (!isFolder) {
          onOpenFile(path);
        }
      } else {
        alert(res.data?.error || 'Erro ao criar item na árvore.');
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor para criar item.');
    }
  };

  const handleOpenRename = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenameOldPath(path);
    setRenameNewPath(path);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async () => {
    const old_path = renameOldPath.trim();
    const new_path = renameNewPath.trim();

    if (!new_path || new_path === old_path) {
      setRenameModalOpen(false);
      return;
    }

    try {
      const res = await API.renameProjectFile({ old_path, new_path });
      if (res.ok && res.data?.success) {
        setRenameModalOpen(false);
        await loadTree();
        if (activeFile === old_path) {
          onOpenFile(new_path);
        }
      } else {
        alert(`Erro ao renomear: ${res.data?.error || 'Falha na operação'}`);
      }
    } catch (e) {
      alert('Erro ao conectar com o servidor para renomear.');
    }
  };

  const handleDeletePath = async (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      confirm(
        `Tem certeza que deseja excluir "${path}"? Esta alteração será registrada no workspace e consolidada no PR.`
      )
    ) {
      try {
        const res = await API.deleteProjectFile(path);
        if (res.ok && res.data?.success) {
          await loadTree();
          if (activeFile === path) {
            onOpenFile('');
          }
        } else {
          alert('Erro ao excluir item.');
        }
      } catch (e) {
        alert('Erro ao conectar com o servidor para excluir.');
      }
    }
  };

  const handleAddInside = (dirPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCustomCreationParentFolder(dirPath);
    setItemName('');
    setIsCreating(true);
  };

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Build display nodes based on project structure & search query
  const displayNodes = useMemo(() => {
    if (!tree || tree.length === 0) return [];

    let nodes: TreeNode[] = [];

    const projectFolder = tree.find(
      n => (n.name === 'project' || n.path === 'project') && (n.type === 'dir' || n.type === 'directory' || n.is_directory)
    );
    if (projectFolder) {
      const cleanProjChildren = (projectFolder.children || []).filter(
        child => !child.name.endsWith('.json') && !child.name.startsWith('.')
      );
      nodes.push({
        ...projectFolder,
        children: cleanProjChildren
      });
    }

    const domainFolder = tree.find(
      n => (n.name === 'domains' || n.path === 'domains') && (n.type === 'dir' || n.type === 'directory' || n.is_directory)
    );
    if (domainFolder && domainFolder.children && domainFolder.children.length > 0) {
      domainFolder.children.forEach(d => nodes.push(d));
    } else if (domainFolder) {
      nodes.push(domainFolder);
    }

    // Fallback if standard folders not found
    if (nodes.length === 0) {
      nodes = tree.filter(n => {
        const p = (n.path || n.name || '').toLowerCase();
        return (
          !p.startsWith('templates') &&
          !p.startsWith('engenharia') &&
          !p.startsWith('patterns') &&
          !p.startsWith('.github') &&
          !p.startsWith('.git') &&
          p !== 'index.md'
        );
      });
    }

    // Filter by search term if present
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchNode = (node: TreeNode): TreeNode | null => {
        const nameMatch = node.name && node.name.toLowerCase().includes(q);
        const pathMatch = node.path && node.path.toLowerCase().includes(q);
        const isDir = node.type === 'dir' || node.type === 'directory' || node.is_directory;

        if (!isDir) {
          return nameMatch || pathMatch ? node : null;
        }

        const filteredChildren = (node.children || [])
          .map(matchNode)
          .filter((c): c is TreeNode => c !== null);

        if (nameMatch || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      };

      return nodes.map(matchNode).filter((n): n is TreeNode => n !== null);
    }

    return nodes;
  }, [tree, searchTerm]);

  // Node Renderer
  const renderTreeNode = (node: TreeNode) => {
    const isDir = node.type === 'dir' || node.type === 'directory' || node.is_directory;
    const isProjectFolder = node.name === 'project' || node.path === 'project';
    const isCollapsedFolder = !!collapsedFolders[node.path];

    if (isDir) {
      return (
        <div key={node.path} className="tree-node">
          <div className="tree-folder" onClick={(e) => toggleFolder(node.path, e)}>
            <div className="tree-folder-left">
              <span className={`tree-caret ${!isCollapsedFolder ? 'expanded' : ''}`}>›</span>
              <span className="tree-folder-name">
                {isProjectFolder ? '📁 project (Fundação)' : node.name}
              </span>
            </div>
            <div className="tree-folder-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn-tree-action"
                title="Novo arquivo"
                onClick={(e) => handleAddInside(node.path, e)}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
              </button>
              {!isProjectFolder && (
                <>
                  <button
                    className="btn-tree-action"
                    title="Renomear pasta"
                    onClick={(e) => handleOpenRename(node.path, e)}
                  >
                    <span className="material-symbols-outlined icon-xs">edit</span>
                  </button>
                  <button
                    className="btn-tree-action delete"
                    title="Excluir pasta"
                    onClick={(e) => handleDeletePath(node.path, e)}
                  >
                    <span className="material-symbols-outlined icon-xs">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`tree-children ${isCollapsedFolder ? 'collapsed' : ''}`}>
            {node.children && node.children.map(child => renderTreeNode(child))}
          </div>
        </div>
      );
    }

    // File Node
    const isActive = activeFile === node.path || (activeFile && activeFile.endsWith(node.name));
    let dotClass = 'dot-default';
    if (node.badge === 'T0') dotClass = 'dot-t0';
    else if (node.badge === 'T1') dotClass = 'dot-t1';
    else if (node.badge === 'T2') dotClass = 'dot-t2';

    return (
      <div key={node.path} className="tree-node">
        <div
          className={`tree-file-item ${isActive ? 'active' : ''}`}
          onClick={() => onOpenFile(node.path)}
        >
          <div className="tree-file-left">
            <span className={`tree-dot ${dotClass}`}></span>
            <span className="tree-file-name">{node.name}</span>
          </div>
          <div className="tree-file-right">
            {node.badge && (
              <span className={`tree-badge-mini ${node.badge.toLowerCase()}`}>
                {node.badge}
              </span>
            )}
            <div className="tree-file-actions" onClick={e => e.stopPropagation()}>
              {node.path !== 'index.md' && (
                <>
                  <button
                    className="btn-tree-action"
                    title="Renomear"
                    onClick={(e) => handleOpenRename(node.path, e)}
                  >
                    <span className="material-symbols-outlined icon-xs">edit</span>
                  </button>
                  <button
                    className="btn-tree-action delete"
                    title="Excluir"
                    onClick={(e) => handleDeletePath(node.path, e)}
                  >
                    <span className="material-symbols-outlined icon-xs">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
              onClick={() => {
                setCustomCreationParentFolder('');
                setItemName('');
                setIsCreating(!isCreating);
              }}
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

        {/* Quick Search / Filter Input */}
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

        {/* Inline Document/Folder Creator Panel */}
        {isCreating && (
          <div id="tree-create-panel" className="tree-create-box">
            <div className="tree-create-header">
              <span id="tree-create-title">Criar Novo Item</span>
              <button
                id="btn-cancel-tree-create"
                className="btn-close-sm"
                onClick={() => {
                  setIsCreating(false);
                  setCustomCreationParentFolder('');
                }}
              >
                <span className="material-symbols-outlined icon-xs">close</span>
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="tree-item-name" style={{ fontSize: '11px' }}>
                Nome:
              </label>
              <input
                type="text"
                id="tree-item-name"
                placeholder="ex: pagamentos, notificacoes"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                autoFocus
              />
              <span
                style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}
                id="tree-item-path-preview"
              >
                Destino: <code>{computeTargetPath().path}</code>
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="tree-item-type" style={{ fontSize: '11px' }}>
                Tipo de Item:
              </label>
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '6px',
                marginTop: '4px'
              }}
            >
              <button
                id="btn-confirm-cancel-tree"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIsCreating(false);
                  setCustomCreationParentFolder('');
                }}
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

        {/* Tree Hierarchy Container */}
        <div className="tree-scroll-container">
          <div id="tree-nodes-container" className="antigravity-tree-root">
            {displayNodes.length === 0 ? (
              <div
                className="tree-empty-state"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '28px 14px',
                  gap: '8px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ marginBottom: '4px' }}>
                  <span
                    className="material-symbols-outlined icon-xl"
                    style={{ color: 'var(--md-sys-color-outline)' }}
                  >
                    account_tree
                  </span>
                </div>
                <strong
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-normal)',
                    margin: 0
                  }}
                >
                  Nenhum documento cadastrado
                </strong>
                <p
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    margin: 0
                  }}
                >
                  Crie bounded contexts e especificações em <code>domains/</code> ou <code>project/</code>.
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  style={{
                    marginTop: '6px',
                    width: '100%',
                    fontSize: '11.5px',
                    padding: '6px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  onClick={() => {
                    setCustomCreationParentFolder('');
                    setItemName('');
                    setIsCreating(true);
                  }}
                >
                  <span>+ Novo Documento</span>
                </button>
              </div>
            ) : (
              displayNodes.map(node => renderTreeNode(node))
            )}
          </div>
        </div>
      </aside>

      {/* Rename Modal */}
      {renameModalOpen && (
        <div id="rename-modal" className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Renomear ou Mover</h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Atualize o nome ou caminho na árvore</span>
              </div>
              <button
                id="btn-close-rename-modal"
                className="btn-close"
                aria-label="Fechar"
                onClick={() => setRenameModalOpen(false)}
              >
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ gap: '14px', padding: '18px 22px' }}>
              <input type="hidden" id="rename-old-path" value={renameOldPath} />
              <div className="form-group">
                <label htmlFor="rename-new-path" style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                  Novo Caminho / Nome:
                </label>
                <input
                  type="text"
                  id="rename-new-path"
                  placeholder="ex: domains/billing/novo-nome.md"
                  value={renameNewPath}
                  onChange={e => setRenameNewPath(e.target.value)}
                  autoFocus
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }} id="rename-path-hint">
                  Caminho relativo a partir da raiz do repositório.
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                <button
                  id="btn-cancel-rename"
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-rename"
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handleConfirmRename}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

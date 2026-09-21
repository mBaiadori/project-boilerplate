// =============================================================================
// COMPONENT: ÁRVORE DE DOCUMENTOS & EXPLORER (VS CODE-GRADE)
// Barra de busca no topo, barra de ícones de ação abaixo e suporte total a arquivos
// =============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  FilePlus, 
  FolderPlus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  ChevronLeft,
  X,
  FileText,
  FileCode,
  AlertCircle,
  ChevronsDownUp,
  Search
} from 'lucide-react';
import type { TreeNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface FileTreeProps {
  onOpenFile: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
}

interface InlineCreatingState {
  parentPath: string;
  isFolder: boolean;
}

interface DraggedItem {
  path: string;
  name: string;
  isFolder: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({
  onOpenFile,
  isCollapsed,
  onToggleCollapse,
  width
}) => {
  const { tree, activeFile, loadTree, gitStatus, pendingChanges, refreshPendingChanges, refreshGitStatus } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const dragHoverTimerRef = useRef<any>(null);

  // VS Code Inline Creation State
  const [inlineCreating, setInlineCreating] = useState<InlineCreatingState | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Toast Notification inside Tree
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'warning' } | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string, type: 'info' | 'warning' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Listen for Spec/Document Reveal in Tree events
  useEffect(() => {
    const handleReveal = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      const targetPath = customEvent.detail?.path;
      if (!targetPath) return;

      // 1. Uncollapse tree sidebar if collapsed
      if (isCollapsed) {
        onToggleCollapse();
      }

      // 2. Clear search filter if active to make sure full tree is rendered
      if (searchTerm) {
        setSearchTerm('');
      }

      // 3. Compute all ancestor folder paths
      const parts = targetPath.split('/');
      parts.pop(); // remove file name
      const parentPaths: string[] = [];
      let currentAcc = '';
      for (const part of parts) {
        currentAcc = currentAcc ? `${currentAcc}/${part}` : part;
        parentPaths.push(currentAcc);
      }

      // 4. Expand all ancestor folders
      if (parentPaths.length > 0) {
        setCollapsedFolders(prev => {
          const updated = { ...prev };
          for (const p of parentPaths) {
            updated[p] = false;
          }
          return updated;
        });
      }

      // 5. Smoothly scroll target element into center view and flash reveal animation
      setTimeout(() => {
        try {
          const safeSelector = `[data-tree-path="${CSS.escape(targetPath)}"]`;
          const element = document.querySelector(safeSelector) as HTMLElement;
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('is-revealed');
            setTimeout(() => {
              element.classList.remove('is-revealed');
            }, 2000);
          }
        } catch (err) {
          console.warn('[FileTree] Falha ao rolar para elemento:', err);
        }
      }, 150);
    };

    window.addEventListener('spec:reveal-in-tree', handleReveal);
    return () => {
      window.removeEventListener('spec:reveal-in-tree', handleReveal);
    };
  }, [isCollapsed, onToggleCollapse, searchTerm]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, node: TreeNode, isFolder: boolean) => {
    e.stopPropagation();
    const item: DraggedItem = {
      path: node.path,
      name: node.name,
      isFolder
    };
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedItem(null);
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);
  };

  const handleDragOverFolder = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    if (draggedItem.path === folderPath) return;
    if (draggedItem.isFolder && (folderPath === draggedItem.path || folderPath.startsWith(`${draggedItem.path}/`))) {
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget !== folderPath) {
      setDragOverTarget(folderPath);
      setIsDragOverRoot(false);

      if (collapsedFolders[folderPath]) {
        if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);
        dragHoverTimerRef.current = setTimeout(() => {
          setCollapsedFolders(prev => ({ ...prev, [folderPath]: false }));
        }, 600);
      }
    }
  };

  const handleDragLeaveFolder = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTarget === folderPath) {
      setDragOverTarget(null);
      if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);
    }
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);

    if (!draggedItem) return;
    const { path: sourcePath, name: itemName, isFolder } = draggedItem;
    setDraggedItem(null);

    if (sourcePath === targetFolderPath) return;
    if (isFolder && (folderPathEqualOrChild(targetFolderPath, sourcePath))) {
      showToast('Não é possível mover uma pasta para dentro de si mesma.', 'warning');
      return;
    }

    const targetPath = `${targetFolderPath}/${itemName}`;
    if (sourcePath === targetPath) return;

    await executeMove(sourcePath, targetPath, itemName, targetFolderPath);
  };

  const folderPathEqualOrChild = (target: string, source: string) => {
    return target === source || target.startsWith(`${source}/`);
  };

  const handleDragOverFile = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    if (draggedItem.path === filePath) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(filePath);
    setIsDragOverRoot(false);
  };

  const handleDragLeaveFile = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTarget === filePath) {
      setDragOverTarget(null);
    }
  };

  const handleDropOnFile = async (e: React.DragEvent, targetFilePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    if (!draggedItem) return;

    const { path: sourcePath, name: itemName, isFolder } = draggedItem;
    setDraggedItem(null);

    if (sourcePath === targetFilePath) return;

    const segments = targetFilePath.split('/');
    segments.pop();
    const parentDir = segments.join('/');

    if (isFolder && parentDir && (parentDir === sourcePath || parentDir.startsWith(`${sourcePath}/`))) {
      showToast('Não é possível mover uma pasta para dentro de si mesma.', 'warning');
      return;
    }

    const targetPath = parentDir ? `${parentDir}/${itemName}` : itemName;
    if (sourcePath === targetPath) return;

    await executeMove(sourcePath, targetPath, itemName, parentDir || 'raiz');
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem) {
      setIsDragOverRoot(true);
      setDragOverTarget(null);
    }
  };

  const handleDragLeaveRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOverRoot(false);
    setDragOverTarget(null);

    if (!draggedItem) return;

    const sourcePath = draggedItem.path;
    const itemName = sourcePath.split('/').pop() || sourcePath;

    if (!sourcePath.includes('/')) return;

    const targetPath = itemName;
    if (sourcePath === targetPath) return;

    await executeMove(sourcePath, targetPath, itemName, 'raiz');
  };

  const executeMove = async (old_path: string, new_path: string, itemName: string, destinationLabel: string) => {
    try {
      const res = await API.renameProjectFile({ old_path, new_path });
      if (res.ok && res.data?.success) {
        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
        if (activeFile === old_path) {
          onOpenFile(new_path);
        } else if (activeFile && activeFile.startsWith(`${old_path}/`)) {
          const rel = activeFile.slice(old_path.length);
          onOpenFile(`${new_path}${rel}`);
        }
        showToast(`"${itemName}" movido para ${destinationLabel === 'raiz' ? 'a raiz' : `"${destinationLabel}"`}.`, 'info');
      } else {
        showToast(`Erro ao mover: ${res.data?.error || 'Falha ao mover item'}`, 'warning');
      }
    } catch (err) {
      showToast('Erro ao conectar ao servidor para mover o item.', 'warning');
    }
  };

  // Rename Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameOldPath, setRenameOldPath] = useState('');
  const [renameNewPath, setRenameNewPath] = useState('');
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);

  // Focus inline input when creation starts
  useEffect(() => {
    if (inlineCreating && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineCreating]);

  // Start Inline Creation (VS Code style)
  const startInlineCreate = (parentPath: string = '', isFolder: boolean = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Ensure parent folder is expanded so inline input is visible
    if (parentPath) {
      setCollapsedFolders(prev => ({
        ...prev,
        [parentPath]: false
      }));
    }

    setInlineCreating({ parentPath, isFolder });
    setInlineValue('');
  };

  // Confirm Inline Creation
  const handleConfirmInlineCreate = async () => {
    if (!inlineCreating) return;
    const rawName = inlineValue.trim();
    if (!rawName) {
      setInlineCreating(null);
      return;
    }

    const { parentPath, isFolder } = inlineCreating;
    let fileName = rawName;

    const isMarkdown = !isFolder && (fileName.endsWith('.md') || fileName.endsWith('.markdown') || !fileName.includes('.'));
    if (!isFolder && !fileName.includes('.')) {
      fileName = `${fileName}.md`;
    }

    const targetPath = parentPath ? `${parentPath}/${fileName}` : fileName;

    let initialContent = '';
    if (!isFolder && isMarkdown) {
      const docTitle = rawName.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
      initialContent = `# ${docTitle}\n\nDocumento gerado no workspace.\n`;
    }

    try {
      const res = await API.createProjectFile({
        path: targetPath,
        is_folder: isFolder,
        content: initialContent
      });

      if (res.ok) {
        setInlineCreating(null);
        setInlineValue('');
        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);

        if (isFolder) {
          showToast(`Pasta "${rawName}" criada com sucesso.`, 'info');
          setSelectedFolder(targetPath);
        } else if (isMarkdown) {
          onOpenFile(targetPath);
          showToast(`Documento criado e aberto.`, 'info');
        } else {
          showToast(`Arquivo "${rawName}" criado no workspace.`, 'info');
        }
      } else {
        alert(res.data?.error || 'Erro ao criar item na árvore.');
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor para criar item.');
    }
  };

  // Cancel Inline Creation
  const handleCancelInlineCreate = () => {
    setInlineCreating(null);
    setInlineValue('');
  };

  // Collapse All Folders (VS Code action)
  const handleCollapseAllFolders = () => {
    const allFolderPaths: Record<string, boolean> = {};
    const collectDirs = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        const isDir = n.type === 'dir' || n.type === 'directory' || n.is_directory;
        if (isDir) {
          allFolderPaths[n.path] = true;
          if (n.children) collectDirs(n.children);
        }
      }
    };
    if (tree) collectDirs(tree);
    setCollapsedFolders(allFolderPaths);
    showToast('Todas as pastas foram recolhidas.', 'info');
  };

  // File Click Handler: Enforce Markdown Only
  const handleFileClick = (path: string, name: string) => {
    const isMarkdown = name.endsWith('.md') || name.endsWith('.markdown') || path.endsWith('.md') || path.endsWith('.markdown');

    if (isMarkdown) {
      onOpenFile(path);
    } else {
      // Document is NOT markdown -> Do NOT open in editor
      showToast(`Apenas documentos Markdown (.md) podem ser editados.`, 'warning');
    }
  };

  const handleOpenRename = (path: string, isFolder: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenameOldPath(path);
    setRenameNewPath(path);
    setIsRenamingFolder(isFolder);
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
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
        if (activeFile === old_path) {
          const isMd = new_path.endsWith('.md') || new_path.endsWith('.markdown');
          if (isMd) {
            onOpenFile(new_path);
          } else {
            onOpenFile('');
          }
        }
        showToast('Item renomeado com sucesso.', 'info');
      } else {
        alert(`Erro ao renomear: ${res.data?.error || 'Falha na operação'}`);
      }
    } catch (e) {
      alert('Erro ao conectar com o servidor para renomear.');
    }
  };

  const handleDeletePath = async (path: string, isFolder: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemTypeLabel = isFolder ? 'a pasta' : 'o arquivo';
    if (
      confirm(
        `Tem certeza que deseja excluir ${itemTypeLabel} "${path}"? Esta alteração será registrada no workspace.`
      )
    ) {
      try {
        const res = await API.deleteProjectFile(path);
        if (res.ok && res.data?.success) {
          await loadTree();
          await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
          if (activeFile === path || activeFile.startsWith(`${path}/`)) {
            onOpenFile('');
          }
          showToast(`Item excluído com sucesso.`, 'info');
        } else {
          alert('Erro ao excluir item.');
        }
      } catch (e) {
        alert('Erro ao conectar com o servidor para excluir.');
      }
    }
  };

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFolder(folderPath);
    setCollapsedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Build display nodes based on search query (displaying ALL files)
  const displayNodes = useMemo(() => {
    if (!tree || tree.length === 0) return [];

    const cleanNodes = (nodesList: TreeNode[]): TreeNode[] => {
      return nodesList
        .filter(n => {
          const name = n.name || '';
          const path = n.path || '';
          if (name.startsWith('.') || path.startsWith('.')) return false;
          if (name === 'node_modules') return false;
          return true;
        })
        .map(n => {
          if (n.children && n.children.length > 0) {
            return {
              ...n,
              children: cleanNodes(n.children)
            };
          }
          return n;
        });
    };

    let nodes: TreeNode[] = cleanNodes(tree);

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

  // Render Inline Input Row for VS Code creation
  const renderInlineCreateInput = (parentPath: string) => {
    if (!inlineCreating || inlineCreating.parentPath !== parentPath) return null;

    const { isFolder } = inlineCreating;
    return (
      <div className="tree-inline-create-row" onClick={e => e.stopPropagation()}>
        {isFolder ? (
          <Folder size={14} color="#2563eb" style={{ flexShrink: 0 }} />
        ) : (
          <FileText size={14} color="#2563eb" style={{ flexShrink: 0 }} />
        )}
        <input
          ref={inlineInputRef}
          type="text"
          className="tree-inline-input"
          placeholder={isFolder ? 'nome-da-pasta' : 'novo-documento.md'}
          value={inlineValue}
          onChange={e => setInlineValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleConfirmInlineCreate();
            } else if (e.key === 'Escape') {
              handleCancelInlineCreate();
            }
          }}
          onBlur={() => {
            if (!inlineValue.trim()) {
              handleCancelInlineCreate();
            } else {
              handleConfirmInlineCreate();
            }
          }}
        />
      </div>
    );
  };

  // Node Renderer
  const renderTreeNode = (node: TreeNode) => {
    const isDir = node.type === 'dir' || node.type === 'directory' || node.is_directory;
    const isCollapsedFolder = !!collapsedFolders[node.path];
    const isFolderSelected = selectedFolder === node.path;
    const isDraggingThis = draggedItem?.path === node.path;
    const isDragOverThis = dragOverTarget === node.path;

    if (isDir) {
      return (
        <div key={node.path} className={`tree-node ${isDraggingThis ? 'is-dragging' : ''}`}>
          <div
            className={`tree-folder ${isFolderSelected ? 'selected' : ''} ${isDraggingThis ? 'is-dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
            data-tree-path={node.path}
            draggable
            onDragStart={(e) => handleDragStart(e, node, true)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOverFolder(e, node.path)}
            onDragLeave={(e) => handleDragLeaveFolder(e, node.path)}
            onDrop={(e) => handleDropOnFolder(e, node.path)}
            onClick={(e) => toggleFolder(node.path, e)}
          >
            <div className="tree-folder-left">
              <span
                className={`tree-caret ${!isCollapsedFolder ? 'expanded' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: !isCollapsedFolder ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s ease'
                }}
              >
                <ChevronRight size={12} />
              </span>
              {isCollapsedFolder ? (
                <Folder size={14} color="#64748b" style={{ flexShrink: 0 }} />
              ) : (
                <FolderOpen size={14} color="#2563eb" style={{ flexShrink: 0 }} />
              )}
              <span className="tree-folder-name">{node.name}</span>
            </div>
            <div className="tree-folder-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn-tree-action"
                title="Novo Arquivo nesta pasta"
                onClick={(e) => startInlineCreate(node.path, false, e)}
              >
                <FilePlus size={12} />
              </button>
              <button
                className="btn-tree-action"
                title="Nova Pasta nesta pasta"
                onClick={(e) => startInlineCreate(node.path, true, e)}
              >
                <FolderPlus size={12} />
              </button>
              <button
                className="btn-tree-action"
                title="Renomear pasta"
                onClick={(e) => handleOpenRename(node.path, true, e)}
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir pasta"
                onClick={(e) => handleDeletePath(node.path, true, e)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {!isCollapsedFolder && (
            <div className="tree-children">
              {/* Inline input if creating inside this folder */}
              {renderInlineCreateInput(node.path)}

              {node.children && node.children.map(child => renderTreeNode(child))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const isMarkdown = node.name.endsWith('.md') || node.name.endsWith('.markdown') || node.path.endsWith('.md') || node.path.endsWith('.markdown');
    const isFileActive = activeFile === node.path;
    const fileExt = node.name.includes('.') ? node.name.split('.').pop()?.toUpperCase() : '';

    const dotClass = node.name.includes('kpi') || node.path.includes('kpi')
      ? 'dot-t0'
      : node.name.includes('ideacao') || node.path.includes('ideacao')
        ? 'dot-t1'
        : 'dot-t2';

    const badgeClass = node.badge ? node.badge.toLowerCase() : 't1';

    const gitFile = gitStatus?.files?.find(f => f.path === node.path || f.path.endsWith(node.path));
    const pendingChange = pendingChanges?.find(c => c.path === node.path);
    const gitStatusCode = gitFile ? (gitFile.status === '??' ? 'U' : gitFile.status) : (pendingChange ? (pendingChange.type === 'ADDED' ? 'A' : 'M') : null);

    return (
      <div key={node.path} className={`tree-node ${isDraggingThis ? 'is-dragging' : ''}`}>
        <div
          className={`tree-file-item ${isFileActive ? 'active' : ''} ${!isMarkdown ? 'non-markdown' : ''} ${isDraggingThis ? 'is-dragging' : ''} ${isDragOverThis ? 'drag-over' : ''}`}
          data-tree-path={node.path}
          draggable
          onDragStart={(e) => handleDragStart(e, node, false)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverFile(e, node.path)}
          onDragLeave={(e) => handleDragLeaveFile(e, node.path)}
          onDrop={(e) => handleDropOnFile(e, node.path)}
          onClick={() => handleFileClick(node.path, node.name)}
          title={isMarkdown ? `Abrir ${node.name}` : `Arquivo (${fileExt || 'não markdown'}). Apenas arquivos .md são abertos no editor.`}
        >
          <div className="tree-file-left">
            {isMarkdown ? (
              <span className={`tree-dot ${dotClass}`}></span>
            ) : (
              <FileCode size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
            )}
            <span className="tree-file-name">{node.name}</span>
            {gitStatusCode && (
              <span
                className="tree-git-status-badge"
                title={gitStatusCode === 'M' ? 'Modificado no Git' : gitStatusCode === 'A' ? 'Adicionado no Git' : gitStatusCode === 'U' ? 'Novo / Não rastreado no Git' : 'Alterado'}
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-mono)',
                  background: gitStatusCode === 'M' ? 'rgba(234, 179, 8, 0.2)' : gitStatusCode === 'A' || gitStatusCode === 'U' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: gitStatusCode === 'M' ? '#d97706' : gitStatusCode === 'A' || gitStatusCode === 'U' ? '#16a34a' : '#dc2626',
                  marginLeft: '4px',
                  lineHeight: '1.2'
                }}
              >
                {gitStatusCode}
              </span>
            )}
          </div>
          <div className="tree-file-right">
            {!isMarkdown && fileExt && (
              <span className="tree-badge-unsupported">
                {fileExt}
              </span>
            )}
            {isMarkdown && node.badge && (
              <span className={`tree-badge-mini ${badgeClass}`}>
                {node.badge}
              </span>
            )}
            <div className="tree-file-actions" onClick={e => e.stopPropagation()}>
              <button
                className="btn-tree-action"
                title="Renomear"
                onClick={(e) => handleOpenRename(node.path, false, e)}
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir"
                onClick={(e) => handleDeletePath(node.path, false, e)}
              >
                <Trash2 size={11} />
              </button>
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

  const selectedFolderName = selectedFolder ? selectedFolder.split('/').pop() || selectedFolder : '';

  return (
    <>
      <aside 
        className="workbench-tree-pane" 
        id="workbench-tree-pane"
        style={{ width: width ? `${width}px` : undefined }}
        onClick={() => setSelectedFolder('')}
      >
        {/* TOP SECTION: Search Bar on Top + Actions Toolbar Below */}
        <div className="tree-top-container" onClick={e => e.stopPropagation()}>
          {/* Search Input Bar at Top */}
          <div className="tree-search-wrapper">
            <span className="tree-search-icon">
              <Search size={13} color="#94a3b8" />
            </span>
            <input
              type="text"
              id="tree-search-input"
              className="tree-search-input"
              placeholder="Buscar arquivos..."
              spellCheck="false"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="tree-search-clear"
                title="Limpar busca"
                onClick={() => setSearchTerm('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action Toolbar Below Search Bar */}
          <div className="tree-toolbar-row">
            <div className="tree-toolbar-label" title={selectedFolder ? `Pasta selecionada: ${selectedFolder}` : 'Raiz do repositório'}>
              {selectedFolder ? `/${selectedFolderName}` : 'ARQUIVOS'}
            </div>
            <div className="tree-toolbar-icons">
              <button
                id="btn-tree-new-file"
                className="btn-tree-tool"
                title={selectedFolder ? `Novo Arquivo em /${selectedFolderName}` : 'Novo Arquivo na raiz'}
                onClick={() => startInlineCreate(selectedFolder, false)}
              >
                <FilePlus size={14} />
              </button>
              <button
                id="btn-tree-new-folder"
                className="btn-tree-tool"
                title={selectedFolder ? `Nova Pasta em /${selectedFolderName}` : 'Nova Pasta na raiz'}
                onClick={() => startInlineCreate(selectedFolder, true)}
              >
                <FolderPlus size={14} />
              </button>
              <button
                id="btn-tree-collapse-all"
                className="btn-tree-tool"
                title="Recolher Todas as Pastas"
                onClick={handleCollapseAllFolders}
              >
                <ChevronsDownUp size={14} />
              </button>
              <button
                id="btn-tree-refresh"
                className="btn-tree-tool"
                title="Atualizar Árvore"
                onClick={() => loadTree()}
              >
                <RefreshCw size={13} />
              </button>
              <button
                id="btn-toggle-tree-pane"
                className="btn-tree-tool"
                title="Recolher Painel Lateral"
                onClick={onToggleCollapse}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tree Hierarchy Container */}
        <div 
          className="tree-scroll-container"
          onDragOver={handleDragOverRoot}
          onDragLeave={handleDragLeaveRoot}
          onDrop={handleDropOnRoot}
        >
          <div id="tree-nodes-container" className={`antigravity-tree-root ${isDragOverRoot ? 'drag-over-root' : ''}`}>
            {/* Inline input at Root Level */}
            {renderInlineCreateInput('')}

            {displayNodes.length === 0 && !inlineCreating ? (
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
                  <FileText size={24} color="#94a3b8" />
                </div>
                <strong
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-normal)',
                    margin: 0
                  }}
                >
                  Nenhum arquivo encontrado
                </strong>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.4
                  }}
                >
                  Crie novos documentos ou pastas para estruturar seu projeto.
                </p>
                <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '6px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startInlineCreate('', false);
                    }}
                  >
                    <FilePlus size={13} />
                    <span>Novo Arquivo</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      padding: '6px 8px',
                      border: '1px solid var(--border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startInlineCreate('', true);
                    }}
                  >
                    <FolderPlus size={13} />
                    <span>Nova Pasta</span>
                  </button>
                </div>
              </div>
            ) : (
              displayNodes.map(node => renderTreeNode(node))
            )}
          </div>
        </div>

        {/* Tree Pane Floating Toast Notifications */}
        {toast && (
          <div className="tree-toast-container">
            <div className={`tree-toast ${toast.type}`}>
              {toast.type === 'warning' && <AlertCircle size={14} color="#fbbf24" style={{ flexShrink: 0 }} />}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Rename Modal */}
      {renameModalOpen && (
        <div id="rename-modal" className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                  {isRenamingFolder ? 'Renomear Pasta' : 'Renomear Arquivo'}
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Atualize o nome ou caminho na árvore</span>
              </div>
              <button
                id="btn-close-rename-modal"
                className="btn-close"
                aria-label="Fechar"
                onClick={() => setRenameModalOpen(false)}
              >
                <X size={14} />
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
                  placeholder={isRenamingFolder ? 'ex: domains/billing' : 'ex: domains/billing/spec.md'}
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

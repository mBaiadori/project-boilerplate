import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { TreeNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCopilotStore } from '../../stores/copilotStore';
import { Button, IconButton, SearchInput, Badge } from '../ui';

interface ContextSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Utility: Recursively find all files inside a directory node
function getFilesUnderNode(node: TreeNode): string[] {
  const isDir = node.type === 'dir' || node.type === 'directory' || Boolean(node.is_directory);
  if (!isDir) {
    return [node.path];
  }
  let files: string[] = [];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      files = files.concat(getFilesUnderNode(child));
    }
  }
  return files;
}

// Utility: Find node by path in tree
function findNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === targetPath) return n;
    if (n.children && n.children.length > 0) {
      const found = findNodeByPath(n.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

// Utility: Collect all directory paths from tree
function getAllDirPaths(nodes: TreeNode[]): string[] {
  let dirs: string[] = [];
  for (const n of nodes) {
    const isDir = n.type === 'dir' || n.type === 'directory' || Boolean(n.is_directory);
    if (isDir) {
      dirs.push(n.path);
      if (n.children) {
        dirs = dirs.concat(getAllDirPaths(n.children));
      }
    }
  }
  return dirs;
}

// Utility: Collect all file paths from tree
function getAllFilePaths(nodes: TreeNode[]): string[] {
  let files: string[] = [];
  for (const n of nodes) {
    const isDir = n.type === 'dir' || n.type === 'directory' || Boolean(n.is_directory);
    if (isDir) {
      if (n.children) {
        files = files.concat(getAllFilePaths(n.children));
      }
    } else {
      files.push(n.path);
    }
  }
  return files;
}

// Utility: Expand a list of referencedDocs (which may contain folder paths or file paths) into a Set of file paths
function expandReferencesToFiles(referencedPaths: string[], tree: TreeNode[]): Set<string> {
  const fileSet = new Set<string>();
  for (const p of referencedPaths) {
    const node = findNodeByPath(tree, p);
    if (node) {
      const files = getFilesUnderNode(node);
      for (const f of files) fileSet.add(f);
    } else {
      fileSet.add(p);
    }
  }
  return fileSet;
}

// Utility: Collapse selected files into folder references when 100% of files in a folder are selected.
function collapseFilesToReferences(selectedFiles: Set<string>, tree: TreeNode[]): string[] {
  const remainingFiles = new Set(selectedFiles);
  const collapsedReferences: string[] = [];

  function processNode(node: TreeNode): boolean {
    const isDir = node.type === 'dir' || node.type === 'directory' || Boolean(node.is_directory);
    if (!isDir) {
      return remainingFiles.has(node.path);
    }

    const filesUnder = getFilesUnderNode(node);
    if (filesUnder.length === 0) return false;

    // Check if ALL files in this folder are in selectedFiles
    const allSelected = filesUnder.every((f) => selectedFiles.has(f));

    if (allSelected) {
      // 100% of files selected -> Represent as the full folder!
      collapsedReferences.push(node.path);
      for (const f of filesUnder) {
        remainingFiles.delete(f);
      }
      return true;
    }

    // Otherwise, process children recursively to see if sub-folders can collapse
    if (node.children) {
      for (const child of node.children) {
        processNode(child);
      }
    }
    return false;
  }

  // Process root nodes
  for (const rootNode of tree) {
    processNode(rootNode);
  }

  // Any leftover files that belong to partially selected folders are added individually
  for (const f of remainingFiles) {
    collapsedReferences.push(f);
  }

  return collapsedReferences;
}

// Checkbox helper with indeterminate support
const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}> = ({ checked, indeterminate, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ cursor: 'pointer', margin: 0 }}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

export const ContextSidebar: React.FC<ContextSidebarProps> = ({ isOpen, onClose }) => {
  const { tree, activeFile, projectConfig } = useWorkspace();
  const { referencedDocs, setReferencedDocs, setIsGlobalScope } = useCopilotStore();

  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const allWorkspaceFiles = useMemo(() => getAllFilePaths(tree), [tree]);
  const allWorkspaceDirs = useMemo(() => getAllDirPaths(tree), [tree]);

  // Initialize selected files from current referencedDocs
  useEffect(() => {
    if (isOpen) {
      const initialFiles = expandReferencesToFiles(referencedDocs, tree);
      setSelectedFilePaths(initialFiles);
      setSearchQuery('');

      // Auto-expand folders that contain selected files
      const newExpanded: Record<string, boolean> = {};
      const autoExpand = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          const isDir = n.type === 'dir' || n.type === 'directory' || Boolean(n.is_directory);
          if (isDir) {
            const files = getFilesUnderNode(n);
            if (files.some((f) => initialFiles.has(f))) {
              newExpanded[n.path] = true;
            }
            if (n.children) autoExpand(n.children);
          }
        }
      };
      autoExpand(tree);
      setExpandedFolders((prev) => ({ ...prev, ...newExpanded }));
    }
  }, [isOpen, referencedDocs, tree]);

  // Synchronize with copilot store whenever selection changes
  const applySelection = (nextSelectedFiles: Set<string>) => {
    setSelectedFilePaths(nextSelectedFiles);
    const collapsed = collapseFilesToReferences(nextSelectedFiles, tree);
    setReferencedDocs(collapsed);
    if (collapsed.length === 0) {
      setIsGlobalScope(true);
    } else {
      setIsGlobalScope(false);
    }
  };

  // Toggle single file
  const handleToggleFile = (filePath: string) => {
    const next = new Set(selectedFilePaths);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    applySelection(next);
  };

  // Toggle directory (select all files under it or deselect all if already fully selected)
  const handleToggleDirectory = (dirNode: TreeNode) => {
    const filesUnder = getFilesUnderNode(dirNode);
    if (filesUnder.length === 0) return;

    const allSelected = filesUnder.every((f) => selectedFilePaths.has(f));
    const next = new Set(selectedFilePaths);

    if (allSelected) {
      // Deselect all files in this directory
      for (const f of filesUnder) next.delete(f);
    } else {
      // Select all files in this directory
      for (const f of filesUnder) next.add(f);
    }

    applySelection(next);

    // Automatically expand the folder so the user sees the checked items
    setExpandedFolders((prev) => ({ ...prev, [dirNode.path]: true }));
  };

  // Toggle folder accordion expand/collapse
  const handleToggleFolderExpand = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Quick select active file
  const handleToggleActiveFile = () => {
    if (!activeFile) return;
    const next = new Set(selectedFilePaths);
    if (next.has(activeFile)) {
      next.delete(activeFile);
    } else {
      next.add(activeFile);
    }
    applySelection(next);
  };

  // Check if ALL files are selected
  const isAllFilesSelected = useMemo(() => {
    if (allWorkspaceFiles.length === 0) return false;
    return allWorkspaceFiles.every((f) => selectedFilePaths.has(f));
  }, [allWorkspaceFiles, selectedFilePaths]);

  // Toggle Select All / Deselect All
  const handleToggleSelectAll = () => {
    if (isAllFilesSelected) {
      // Deselect all
      applySelection(new Set());
    } else {
      // Select all files
      applySelection(new Set(allWorkspaceFiles));
    }
  };

  // Check if ALL folders are expanded
  const isAllFoldersExpanded = useMemo(() => {
    if (allWorkspaceDirs.length === 0) return false;
    return allWorkspaceDirs.every((d) => Boolean(expandedFolders[d]));
  }, [allWorkspaceDirs, expandedFolders]);

  // Toggle Expand All / Collapse All folders
  const handleToggleExpandAll = () => {
    if (isAllFoldersExpanded) {
      // Collapse all
      setExpandedFolders({});
    } else {
      // Expand all
      const allDirsMap: Record<string, boolean> = {};
      for (const d of allWorkspaceDirs) {
        allDirsMap[d] = true;
      }
      setExpandedFolders(allDirsMap);
    }
  };

  // Compute final collapsed references
  const collapsedReferences = useMemo(() => {
    return collapseFilesToReferences(selectedFilePaths, tree);
  }, [selectedFilePaths, tree]);

  const projectColor = projectConfig?.primary_color || 'var(--color-primary, #2563eb)';

  if (!isOpen) return null;

  // Render Tree Node recursively
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isDir = node.type === 'dir' || node.type === 'directory' || Boolean(node.is_directory);
    const filesUnder = isDir ? getFilesUnderNode(node) : [];

    let isChecked = false;
    let isIndeterminate = false;

    if (isDir) {
      const selectedCount = filesUnder.filter((f) => selectedFilePaths.has(f)).length;
      if (selectedCount === filesUnder.length && filesUnder.length > 0) {
        isChecked = true;
      } else if (selectedCount > 0) {
        isIndeterminate = true;
      }
    } else {
      isChecked = selectedFilePaths.has(node.path);
    }

    const isExpanded = Boolean(expandedFolders[node.path]);

    // Search filter matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSelf = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      const matchesChild = isDir && filesUnder.some((f) => f.toLowerCase().includes(q));
      if (!matchesSelf && !matchesChild) return null;
    }

    return (
      <div key={node.path} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            paddingLeft: `${depth * 16 + 6}px`,
            borderRadius: '6px',
            background: isChecked
              ? 'var(--color-primary-subtle, rgba(37, 99, 235, 0.08))'
              : isIndeterminate
              ? 'rgba(37, 99, 235, 0.04)'
              : 'transparent',
            border: isChecked
              ? '1px solid var(--color-primary, #2563eb)'
              : isIndeterminate
              ? '1px dashed var(--color-primary-subtle, #93c5fd)'
              : '1px solid transparent',
            marginBottom: '2px',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          onClick={() => {
            if (isDir) {
              handleToggleDirectory(node);
            } else {
              handleToggleFile(node.path);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
            {/* Folder expansion toggle */}
            {isDir ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFolderExpand(node.path);
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-muted, #64748b)',
                }}
                title={isExpanded ? 'Colapsar pasta' : 'Expandir pasta'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  {isExpanded ? 'expand_more' : 'chevron_right'}
                </span>
              </button>
            ) : (
              <span style={{ width: '15px', flexShrink: 0 }} />
            )}

            {/* Checkbox */}
            <IndeterminateCheckbox
              checked={isChecked}
              indeterminate={isIndeterminate}
              onChange={() => {
                if (isDir) {
                  handleToggleDirectory(node);
                } else {
                  handleToggleFile(node.path);
                }
              }}
            />

            {/* Icon */}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '15px',
                color: isDir
                  ? isChecked
                    ? 'var(--color-primary, #2563eb)'
                    : 'var(--color-primary, #3b82f6)'
                  : 'var(--color-text-muted, #64748b)',
                flexShrink: 0,
              }}
            >
              {isDir ? (isExpanded ? 'folder_open' : 'folder') : 'description'}
            </span>

            {/* Label */}
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: isChecked || isIndeterminate ? 600 : isDir ? 500 : 400,
                color: isChecked
                  ? 'var(--color-primary, #1d4ed8)'
                  : isIndeterminate
                  ? 'var(--color-text-primary, #1e40af)'
                  : 'var(--color-text-primary, #1e293b)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={node.path}
            >
              {node.name}{isDir ? '/' : ''}
            </span>
          </div>

          {/* Directory selected count badge */}
          {isDir && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '10px',
                background: isChecked
                  ? 'var(--color-primary, #2563eb)'
                  : isIndeterminate
                  ? 'var(--color-primary-subtle, #dbeafe)'
                  : 'var(--color-surface-container-high, #e2e8f0)',
                color: isChecked
                  ? '#ffffff'
                  : isIndeterminate
                  ? 'var(--color-primary, #1e40af)'
                  : 'var(--color-text-secondary, #475569)',
                flexShrink: 0,
              }}
              title={`${filesUnder.filter((f) => selectedFilePaths.has(f)).length} de ${filesUnder.length} arquivos selecionados`}
            >
              {filesUnder.filter((f) => selectedFilePaths.has(f)).length}/{filesUnder.length} docs
            </span>
          )}
        </div>

        {/* Children if expanded */}
        {isDir && (isExpanded || Boolean(searchQuery.trim())) && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="ai-copilot-prompt-sidebar ai-copilot-context-sidebar ui-sidebar-drawer"
      style={{ width: '420px', maxWidth: '50vw' }}
    >
      {/* 1. Header do Painel */}
      <div className="ui-sidebar-drawer__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: `${projectColor}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: projectColor,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              folder_managed
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '12.5px', color: 'var(--color-text-primary, #0f172a)', whiteSpace: 'nowrap' }}>
              Gerenciar Contexto
            </strong>
            <span className="ui-text-muted" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
              {selectedFilePaths.size} {selectedFilePaths.size === 1 ? 'arquivo selecionado' : 'arquivos selecionados'} &bull; {collapsedReferences.length} refs
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <IconButton
            size="sm"
            variant="ghost"
            title="Fechar painel de contexto"
            onClick={onClose}
            icon={<span className="material-symbols-outlined icon-sm">close</span>}
          />
        </div>
      </div>

      {/* 2. Barra de Busca e Ações Rápidas */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-subtle, #e2e8f0)',
          background: 'var(--color-surface, #ffffff)',
          flexShrink: 0,
        }}
      >
        {/* Search Input Padronizado */}
        <SearchInput
          placeholder="Buscar arquivos ou pastas por nome ou caminho..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
        />

        {/* Quick Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* Botão Expandir / Colapsar que alterna estado e ícone */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleExpandAll}
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                {isAllFoldersExpanded ? 'unfold_less' : 'unfold_more'}
              </span>
            }
            title={isAllFoldersExpanded ? 'Colapsar todas as pastas' : 'Expandir todas as pastas'}
          >
            {isAllFoldersExpanded ? 'Colapsar Pastas' : 'Expandir Pastas'}
          </Button>

          {/* Botão Selecionar Tudo / Desmarcar Tudo que alterna estado e ícone */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleSelectAll}
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                {isAllFilesSelected ? 'deselect' : 'select_all'}
              </span>
            }
            title={isAllFilesSelected ? 'Desmarcar todos os arquivos' : 'Selecionar todos os arquivos do workspace'}
          >
            {isAllFilesSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
          </Button>

          {/* Botão + Doc Ativo */}
          {activeFile && (
            <Button
              variant={selectedFilePaths.has(activeFile) ? 'primary' : 'ghost'}
              size="sm"
              onClick={handleToggleActiveFile}
              icon={
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  edit_document
                </span>
              }
              title={`Alternar inclusão do arquivo ativo (${activeFile})`}
            >
              + {activeFile.split('/').pop()}
            </Button>
          )}

          {/* Limpar Seleção Rápida */}
          {selectedFilePaths.size > 0 && !isAllFilesSelected && (
            <IconButton
              size="sm"
              variant="danger"
              onClick={() => applySelection(new Set())}
              title="Limpar seleção de arquivos"
              icon={<span className="material-symbols-outlined" style={{ fontSize: '14px' }}>clear_all</span>}
            />
          )}
        </div>
      </div>

      {/* 3. Strip do Contexto Ativo / Modo Global */}
      <div
        style={{
          padding: '8px 14px',
          background: 'var(--color-surface-container-low, #f8fafc)',
          borderBottom: '1px solid var(--color-border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          minHeight: '36px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', flexShrink: 0 }}>
          Contexto Ativo:
        </span>

        {collapsedReferences.length === 0 ? (
          <Badge variant="neutral" size="sm">
            🌐 Modo Global Ativo (Sem arquivos fixados)
          </Badge>
        ) : (
          collapsedReferences.map((p) => {
            const node = findNodeByPath(tree, p);
            const isDir = Boolean(node && (node.type === 'dir' || node.type === 'directory' || node.is_directory));
            const filesUnder = node && isDir ? getFilesUnderNode(node) : [];
            const label = p.split('/').pop() || p;

            return (
              <div
                key={p}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: isDir ? 'var(--color-tertiary-subtle, #f3e8ff)' : 'var(--color-primary-subtle, #eff6ff)',
                  border: `1px solid ${isDir ? 'var(--color-tertiary, #c084fc)' : 'var(--color-primary, #93c5fd)'}`,
                  fontSize: '10.5px',
                  color: isDir ? '#6b21a8' : 'var(--color-primary, #1d4ed8)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={isDir ? `Diretório completo: ${p} (${filesUnder.length} arquivos)` : `Arquivo: ${p}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                  {isDir ? 'folder' : 'description'}
                </span>
                <span>{label}{isDir ? '/' : ''}</span>
                {isDir && (
                  <span style={{ fontSize: '9px', opacity: 0.85 }}>({filesUnder.length})</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDir && node) {
                      handleToggleDirectory(node);
                    } else {
                      handleToggleFile(p);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: isDir ? '#6b21a8' : 'var(--color-primary, #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remover do contexto"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                    close
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Tree Container com Scroll Vertical */}
      <div
        className="ui-sidebar-drawer__body"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {tree.length > 0 ? (
          tree.map((node) => renderTreeNode(node, 0))
        ) : (
          <div className="ui-empty-state" style={{ padding: '32px 16px', margin: 'auto 0' }}>
            <span className="material-symbols-outlined icon-md ui-text-muted" style={{ display: 'block', margin: '0 auto 8px auto' }}>
              folder_off
            </span>
            <span className="ui-text-muted" style={{ fontSize: '11.5px' }}>
              Nenhum arquivo encontrado no repositório.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

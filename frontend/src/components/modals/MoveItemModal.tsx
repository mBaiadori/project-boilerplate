import React, { useState, useEffect, useMemo } from 'react';
import { FolderGit2, Folder, FileText, ArrowRight, X, AlertCircle } from 'lucide-react';
import type { TreeNode } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePath: string;
  sourceRepo?: string;
  isFolder?: boolean;
  onSuccess?: (newPath: string, targetRepo: string) => void;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  sourcePath,
  sourceRepo,
  isFolder = false,
  onSuccess,
}) => {
  const { repos, activeRepo, activeOrg, moveFileOrFolder, treesByRepo, loadTree } = useWorkspace();
  const currentSourceRepo = sourceRepo || activeRepo?.name || 'default';
  
  const itemName = sourcePath.split('/').pop() || sourcePath;
  const sourceParentDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : '';

  // Repositórios pertencentes exclusivamente à Organização Ativa
  const orgRepos = useMemo(() => {
    if (!repos || repos.length === 0) {
      if (activeRepo) return [activeRepo];
      return [];
    }
    const currentOrgLogin = activeOrg?.login?.toLowerCase();
    if (!currentOrgLogin) return repos.filter((r) => !r.is_locked);
    const filtered = repos.filter((r) => {
      if (!r.owner) return true;
      return (
        r.owner.toLowerCase() === currentOrgLogin ||
        r.full_name?.toLowerCase().startsWith(`${currentOrgLogin}/`)
      );
    });
    if (
      activeRepo &&
      !filtered.some((r) => r.name.toLowerCase() === activeRepo.name.toLowerCase())
    ) {
      filtered.unshift(activeRepo);
    }
    return filtered.filter((r) => !r.is_locked);
  }, [repos, activeOrg, activeRepo]);

  const [targetRepo, setTargetRepo] = useState<string>(currentSourceRepo);
  const [targetFolder, setTargetFolder] = useState<string>(sourceParentDir);
  const [customName, setCustomName] = useState<string>(itemName);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens with new source item
  useEffect(() => {
    if (isOpen) {
      setTargetRepo(currentSourceRepo);
      setTargetFolder(sourceParentDir);
      setCustomName(itemName);
      setErrorMessage(null);
      setIsSubmitting(false);

      if (!treesByRepo[currentSourceRepo]) {
        loadTree(currentSourceRepo).catch(() => {});
      }
    }
  }, [isOpen, sourcePath, currentSourceRepo, sourceParentDir, itemName, treesByRepo, loadTree]);

  // When targetRepo changes, load its tree if not loaded
  useEffect(() => {
    if (isOpen && targetRepo && !treesByRepo[targetRepo]) {
      loadTree(targetRepo).catch(() => {});
    }
  }, [isOpen, targetRepo, treesByRepo, loadTree]);

  if (!isOpen) return null;

  // Extract list of folders in target repo
  const getFoldersFromNodes = (nodes: TreeNode[], parentPrefix: string = ''): string[] => {
    let result: string[] = [];
    for (const node of nodes) {
      if (node.type === 'directory') {
        const full = parentPrefix ? `${parentPrefix}/${node.name}` : node.name;
        // Don't allow moving a folder into itself
        if (isFolder && targetRepo === currentSourceRepo && (full === sourcePath || full.startsWith(`${sourcePath}/`))) {
          continue;
        }
        result.push(full);
        if (node.children && node.children.length > 0) {
          result = result.concat(getFoldersFromNodes(node.children, full));
        }
      }
    }
    return result;
  };

  const availableFolders = [
    '', // Raiz
    ...getFoldersFromNodes(treesByRepo[targetRepo] || []),
  ];

  const handleConfirmMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = customName.trim();
    if (!cleanName) {
      setErrorMessage('O nome do item não pode ser vazio.');
      return;
    }

    const cleanFolder = targetFolder.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const finalTargetPath = cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;

    // Avoid moving to exact same location
    if (targetRepo.toLowerCase() === currentSourceRepo.toLowerCase() && finalTargetPath === sourcePath) {
      setErrorMessage('O destino escolhido é exatamente o mesmo que a localização atual.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await moveFileOrFolder(sourcePath, finalTargetPath, currentSourceRepo, targetRepo);
      if (res.success) {
        onSuccess?.(finalTargetPath, targetRepo);
        onClose();
      } else {
        setErrorMessage(res.error || 'Erro ao mover item.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao mover item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '14px',
          border: '1px solid var(--color-outline-variant, #e2e8f0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-outline-variant, #f1f5f9)',
            background: 'var(--color-surface-container-lowest, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--color-primary-container, #eff6ff)',
                color: 'var(--color-primary, #2563eb)',
              }}
            >
              <FolderGit2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-on-surface, #1e293b)' }}>
                Mover {isFolder ? 'Pasta' : 'Documento'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-outline, #64748b)' }}>
                Transfira entre repositórios ou altere a estrutura de pastas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-outline, #64748b)',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmMove} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Source Item Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--color-surface-container-low, #f8fafc)',
              borderRadius: '8px',
              border: '1px solid var(--color-outline-variant, #e2e8f0)',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {isFolder ? (
                <Folder size={15} color="var(--color-primary, #2563eb)" />
              ) : (
                <FileText size={15} color="var(--color-primary, #2563eb)" />
              )}
              <span style={{ fontWeight: 600, color: '#334155' }}>Origem:</span>
              <span
                style={{
                  background: '#e0e7ff',
                  color: '#3730a3',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                {currentSourceRepo}
              </span>
              <span
                style={{
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                /{sourcePath}
              </span>
            </div>
          </div>

          {/* Target Repository Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface, #334155)' }}>
                Repositório de Destino
              </label>
              {activeOrg && (
                <span style={{ fontSize: '11px', color: 'var(--color-outline, #64748b)' }}>
                  Organização: <strong style={{ color: 'var(--color-primary, #2563eb)' }}>{activeOrg.full_name || activeOrg.login}</strong>
                </span>
              )}
            </div>
            <select
              value={targetRepo}
              onChange={(e) => {
                setTargetRepo(e.target.value);
                setTargetFolder('');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant, #cbd5e1)',
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-on-surface, #1e293b)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {orgRepos.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} {r.name === currentSourceRepo ? '(Atual)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Target Folder Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface, #334155)' }}>
              Pasta de Destino no Repositório
            </label>
            <select
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant, #cbd5e1)',
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-on-surface, #1e293b)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">/ (Raiz do repositório)</option>
              {availableFolders.filter(Boolean).map((f) => (
                <option key={f} value={f}>
                  /{f}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ou digite um caminho personalizado:</span>
              <input
                type="text"
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                placeholder="ex: domains/architecture"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '11px',
                  color: '#334155',
                }}
              />
            </div>
          </div>

          {/* Name Confirmation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface, #334155)' }}>
              Nome do {isFolder ? 'Diretório' : 'Arquivo'}
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-outline-variant, #cbd5e1)',
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-on-surface, #1e293b)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-outline-variant, #f1f5f9)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-primary, #2563eb)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isSubmitting ? (
                <span>Movendo...</span>
              ) : (
                <>
                  <span>Mover para {targetRepo}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

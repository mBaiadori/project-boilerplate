import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { parseTextFragmentUrl } from '../../utils/text-fragment';
import type { TreeNode } from '../../types';

interface InsertLinkModalProps {
  isOpen: boolean;
  initialText?: string;
  initialUrl?: string;
  onClose: () => void;
  onConfirm: (url: string, text: string) => void;
}

export const InsertLinkModal: React.FC<InsertLinkModalProps> = ({
  isOpen,
  initialText = '',
  initialUrl = '',
  onClose,
  onConfirm,
}) => {
  const { tree, activeFile } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'doc' | 'snippet' | 'url'>('doc');
  const [linkText, setLinkText] = useState(initialText);

  // Tab 1: Document Tree Navigation
  const [searchDoc, setSearchDoc] = useState('');
  const [selectedDocPath, setSelectedDocPath] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Tab 2: Snippet / Fragment Deep Link
  const [snippetUrl, setSnippetUrl] = useState('');

  // Tab 3: External Web URL
  const [customUrl, setCustomUrl] = useState('');

  // Helpers to truncate and format default link labels
  const getTruncatedDefaultLabel = useCallback((url: string, tab: 'doc' | 'snippet' | 'url'): string => {
    if (tab === 'doc') {
      const fileName = url.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || url;
      return fileName || 'Documento';
    }
    if (tab === 'snippet') {
      const parsed = parseTextFragmentUrl(url);
      if (parsed?.exact) {
        const exact = parsed.exact.trim();
        return exact.length > 32 ? `${exact.slice(0, 30)}...` : exact;
      }
      const pathPart = url.split('#')[0].split('/').pop()?.replace(/\.(md|markdown)$/i, '') || '';
      return pathPart ? `${pathPart} (trecho)` : 'Trecho';
    }
    // Web url
    try {
      const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      return clean.length > 32 ? `${clean.slice(0, 30)}...` : clean || url;
    } catch {
      return url;
    }
  }, []);

  // Initialize and pre-fill state upon opening
  useEffect(() => {
    if (isOpen) {
      setLinkText(initialText || '');
      setSearchDoc('');

      if (initialUrl) {
        if (initialUrl.startsWith('http://') || initialUrl.startsWith('https://')) {
          setActiveTab('url');
          setCustomUrl(initialUrl);
          setSnippetUrl('');
          setSelectedDocPath('');
        } else if (initialUrl.includes(':~:text=') || initialUrl.includes('#')) {
          setActiveTab('snippet');
          setSnippetUrl(initialUrl);
          setSelectedDocPath(initialUrl.split('#')[0]);
          setCustomUrl('');
        } else {
          setActiveTab('doc');
          setSelectedDocPath(initialUrl);
          setSnippetUrl('');
          setCustomUrl('');
        }
      } else {
        setActiveTab('doc');
        setSnippetUrl('');
        setCustomUrl('');
      }
    }
  }, [isOpen, initialText, initialUrl]);

  // Decoded preview for Snippet tab
  const snippetParsedInfo = useMemo(() => {
    if (!snippetUrl.trim()) return null;
    const pathPart = snippetUrl.split('#')[0].replace(/^\.?\//, '');
    const fragment = parseTextFragmentUrl(snippetUrl);
    return {
      filePath: pathPart,
      fragment,
    };
  }, [snippetUrl]);

  if (!isOpen) return null;

  // Toggle folder in tree
  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Filter tree nodes recursively when searching
  const filterTreeNodes = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term.trim()) return nodes;
    const lower = term.toLowerCase();

    const result: TreeNode[] = [];
    for (const node of nodes) {
      const isDir = node.type === 'dir' || node.type === 'directory' || (node as any).is_directory;
      if (isDir) {
        const matchingChildren = filterTreeNodes(node.children || [], term);
        if (matchingChildren.length > 0 || node.name.toLowerCase().includes(lower)) {
          result.push({
            ...node,
            children: matchingChildren
          });
        }
      } else if (node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower)) {
        result.push(node);
      }
    }
    return result;
  };

  const displayTree = filterTreeNodes(tree || [], searchDoc);

  // Render tree item recursively
  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isDir = node.type === 'dir' || node.type === 'directory' || (node as any).is_directory;
      const isCollapsed = searchDoc.trim() ? false : !!collapsedFolders[node.path];
      const isMd = !isDir && (node.name.endsWith('.md') || node.name.endsWith('.markdown'));
      const isSelected = selectedDocPath === node.path;
      const isCurrentFile = activeFile === node.path;

      if (isDir) {
        return (
          <div key={node.path} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              onClick={(e) => toggleFolder(node.path, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 8px',
                paddingLeft: `${depth * 16 + 8}px`,
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                borderRadius: '6px',
                userSelect: 'none',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #f1f5f9)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="material-symbols-outlined icon-xs"
                style={{
                  transform: !isCollapsed ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  color: '#94a3b8',
                }}
              >
                chevron_right
              </span>
              <span className="material-symbols-outlined icon-xs" style={{ color: isCollapsed ? '#64748b' : '#2563eb' }}>
                {isCollapsed ? 'folder' : 'folder_open'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
              </span>
            </div>

            {!isCollapsed && node.children && node.children.length > 0 && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      // File item
      return (
        <div
          key={node.path}
          onClick={() => {
            if (isMd) {
              setSelectedDocPath(node.path);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '5px 8px',
            paddingLeft: `${depth * 16 + 22}px`,
            fontSize: '12px',
            cursor: isMd ? 'pointer' : 'default',
            borderRadius: '6px',
            background: isSelected ? 'var(--primary-subtle, #eff6ff)' : 'transparent',
            border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
            color: isSelected ? 'var(--primary, #2563eb)' : isMd ? 'inherit' : '#94a3b8',
            opacity: isMd ? 1 : 0.6,
            transition: 'all 0.12s ease',
            margin: '1px 0',
          }}
          onMouseEnter={(e) => {
            if (!isSelected && isMd) e.currentTarget.style.background = 'var(--surface-hover, #f8fafc)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span
              className="material-symbols-outlined icon-xs"
              style={{ color: isSelected ? '#2563eb' : '#64748b', flexShrink: 0 }}
            >
              description
            </span>
            <span
              style={{
                fontWeight: isSelected ? 600 : 400,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {node.name.replace(/\.(md|markdown)$/i, '')}
            </span>
            {isCurrentFile && (
              <span style={{ fontSize: '10px', background: '#e2e8f0', color: '#475569', padding: '1px 5px', borderRadius: '4px' }}>
                atual
              </span>
            )}
          </div>

          {isSelected && (
            <span
              className="material-symbols-outlined icon-xs"
              style={{ color: '#2563eb', fontWeight: 600, flexShrink: 0 }}
            >
              check_circle
            </span>
          )}
        </div>
      );
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'doc') {
      if (!selectedDocPath) return;
      const finalUrl = selectedDocPath;
      const finalLabel = linkText.trim() || getTruncatedDefaultLabel(selectedDocPath, 'doc');
      onConfirm(finalUrl, finalLabel);
    } else if (activeTab === 'snippet') {
      if (!snippetUrl.trim()) return;
      let finalUrl = snippetUrl.trim();
      const mdMatch = finalUrl.match(/^\[(?:[^\]]*)\]\(([^)]+)\)$/);
      if (mdMatch) {
        finalUrl = mdMatch[1].trim();
      }
      finalUrl = finalUrl.replace(/^["'<]|["'>]$/g, '').trim();
      const finalLabel = linkText.trim() || getTruncatedDefaultLabel(finalUrl, 'snippet');
      onConfirm(finalUrl, finalLabel);
    } else {
      if (!customUrl.trim()) return;
      let finalUrl = customUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('mailto:')) {
        finalUrl = `https://${finalUrl}`;
      }
      const finalLabel = linkText.trim() || getTruncatedDefaultLabel(finalUrl, 'url');
      onConfirm(finalUrl, finalLabel);
    }

    onClose();
  };

  const isSubmitDisabled =
    (activeTab === 'doc' && !selectedDocPath) ||
    (activeTab === 'snippet' && !snippetUrl.trim()) ||
    (activeTab === 'url' && !customUrl.trim());

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
          border: '1px solid var(--color-outline-variant, #cbd5e1)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-outline-variant, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-container-low, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary, #2563eb)' }}>
              {initialUrl ? 'edit' : 'link'}
            </span>
            <strong style={{ fontSize: '14px', color: 'var(--color-on-surface, #0f172a)' }}>
              {initialUrl ? 'Editar Link / Referência' : 'Inserir Link / Referência'}
            </strong>
          </div>
          <button
            type="button"
            className="btn-icon-subtle"
            onClick={onClose}
            title="Fechar (Esc)"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined icon-xs">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ padding: '16px 18px 10px 18px', borderBottom: '1px solid #f1f5f9' }}>
            {/* Campo COMUM: Texto de Exibição (ACIMA das abas) */}
            <label
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--color-outline, #334155)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Texto de Exibição (Rótulo visível no documento):
            </label>
            <input
              type="text"
              className="form-input"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Ex: Documento de Autenticação (ou deixe vazio para usar o nome/link)"
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-outline-variant, #cbd5e1)',
              }}
            />
            <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
              Se vazio, usará o nome do documento ou link de forma resumida/truncada.
            </span>
          </div>

          {/* As 3 Abas Justificadas com Largura Total */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              width: '100%',
              borderBottom: '1px solid var(--color-outline-variant, #e2e8f0)',
              background: 'var(--color-surface-container-low, #f8fafc)',
            }}
          >
            {/* Aba 1: Documento */}
            <button
              type="button"
              onClick={() => setActiveTab('doc')}
              style={{
                padding: '11px 12px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'doc' ? 600 : 500,
                color: activeTab === 'doc' ? 'var(--primary, #2563eb)' : 'var(--color-outline, #64748b)',
                borderBottom: activeTab === 'doc' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
                background: activeTab === 'doc' ? 'var(--color-surface, #ffffff)' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined icon-xs" style={{ color: activeTab === 'doc' ? 'var(--primary, #2563eb)' : '#94a3b8' }}>
                account_tree
              </span>
              <span>Documento</span>
            </button>

            {/* Aba 2: Trecho */}
            <button
              type="button"
              onClick={() => setActiveTab('snippet')}
              style={{
                padding: '11px 12px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'snippet' ? 600 : 500,
                color: activeTab === 'snippet' ? 'var(--primary, #2563eb)' : 'var(--color-outline, #64748b)',
                borderBottom: activeTab === 'snippet' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
                background: activeTab === 'snippet' ? 'var(--color-surface, #ffffff)' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined icon-xs" style={{ color: activeTab === 'snippet' ? 'var(--primary, #2563eb)' : '#94a3b8' }}>
                share_location
              </span>
              <span>Trecho (Link)</span>
            </button>

            {/* Aba 3: Web */}
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              style={{
                padding: '11px 12px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'url' ? 600 : 500,
                color: activeTab === 'url' ? 'var(--primary, #2563eb)' : 'var(--color-outline, #64748b)',
                borderBottom: activeTab === 'url' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
                background: activeTab === 'url' ? 'var(--color-surface, #ffffff)' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined icon-xs" style={{ color: activeTab === 'url' ? 'var(--primary, #2563eb)' : '#94a3b8' }}>
                language
              </span>
              <span>Web (URL)</span>
            </button>
          </div>

          {/* Conteúdo da Aba Ativa */}
          <div style={{ padding: '16px 18px', minHeight: '220px', display: 'flex', flexDirection: 'column' }}>
            {/* 1. ABA DOCUMENTO: Árvore Completa */}
            {activeTab === 'doc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <span
                    className="material-symbols-outlined icon-xs"
                    style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    value={searchDoc}
                    onChange={(e) => setSearchDoc(e.target.value)}
                    placeholder="Filtrar por nome na árvore de arquivos..."
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      padding: '6px 10px 6px 30px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-outline-variant, #cbd5e1)',
                    }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#ffffff',
                    padding: '6px',
                  }}
                >
                  {displayTree.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Nenhum documento encontrado no workspace.
                    </div>
                  ) : (
                    renderTree(displayTree)
                  )}
                </div>

                {selectedDocPath && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#2563eb',
                      background: '#eff6ff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined icon-xs">task_alt</span>
                    <span>
                      Documento selecionado: <strong>{selectedDocPath}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. ABA TRECHO: Colar link gerado */}
            {activeTab === 'snippet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div>
                  <label
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--color-outline, #334155)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Cole o link do trecho copiado (gerado no editor):
                  </label>
                  <textarea
                    rows={3}
                    className="form-input"
                    value={snippetUrl}
                    onChange={(e) => setSnippetUrl(e.target.value)}
                    placeholder="Ex: specs/auth.md#:~:text=login%20via%20Google..."
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-outline-variant, #cbd5e1)',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                    Dica: No editor, selecione o texto desejado e clique no botão <strong>"Link do Trecho"</strong>.
                  </span>
                </div>

                {snippetParsedInfo && snippetParsedInfo.fragment && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                      PREVIEW DO TRECHO IDENTIFICADO:
                    </div>
                    <div>
                      Arquivo: <strong>{snippetParsedInfo.filePath || 'Documento atual'}</strong>
                    </div>
                    <div style={{ color: '#854d0e', background: '#fef9c3', padding: '3px 6px', borderRadius: '4px' }}>
                      Trecho: <strong>"{snippetParsedInfo.fragment.exact}"</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ABA WEB: URL externa */}
            {activeTab === 'url' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--color-outline, #334155)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Endereço Web (URL):
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://exemplo.com/documentacao..."
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: '13px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-outline-variant, #cbd5e1)',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                  Insira links para documentações online, repositórios externos, APIs ou artigos.
                </span>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitDisabled}
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span className="material-symbols-outlined icon-xs">{initialUrl ? 'check' : 'add_link'}</span>
              {initialUrl ? 'Salvar Link' : 'Inserir Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENT: NOTION-LIKE LIVE INTERACTIVE MARKDOWN EDITOR (PRO NOTION UX)
// Exact DOM layout, SVG toolbar icons, connectivity pills, and metadata inspector
// =============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Plus, Sparkles } from 'lucide-react';
import { parseFrontmatter } from '../../services/frontmatter';
import { NotionEditorEngine } from './notion-editor-engine';
import { API } from '../../services/api';

interface NotionEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  filePath: string | null;
  onNavigateFile?: (path: string) => void;
  onReload?: () => void;
  onOpenDiffModal?: () => void;
  onToggleCopilot?: () => void;
  onOpenScaffoldWizard?: () => void;
  onSendSelectionToCopilot?: (text: string) => void;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  content,
  onChange,
  filePath,
  onReload = () => {},
  onOpenDiffModal,
  onToggleCopilot,
  onOpenScaffoldWizard,
  onSendSelectionToCopilot
}) => {
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'Pronto' | 'Salvando...' | 'Salvo no workspace'>('Pronto');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NotionEditorEngine | null>(null);
  const isInternalChangeRef = useRef(false);

  const parsed = parseFrontmatter(content || '');
  const body = parsed.body || content || '';

  const handleSave = useCallback(async () => {
    if (!filePath) return;
    setSaveStatus('Salvando...');
    try {
      const currentBody = engineRef.current ? engineRef.current.getMarkdown() : body;
      await API.saveProjectFile({ path: filePath, content: currentBody });
      setSaveStatus('Salvo no workspace');
      setTimeout(() => setSaveStatus('Pronto'), 2500);
    } catch (e) {
      console.error('Erro ao salvar documento:', e);
      setSaveStatus('Pronto');
    }
  }, [filePath, body]);

  // Initialize & Mount NotionEditorEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new NotionEditorEngine({
      canvasElement: canvasRef.current,
      onChange: () => {
        if (!engineRef.current) return;
        const currentBody = engineRef.current.getMarkdown();
        isInternalChangeRef.current = true;
        onChange(currentBody);
      },
      onSave: () => {
        handleSave();
      },
      onSendSelectionToCopilot: (text) => {
        if (onSendSelectionToCopilot) {
          onSendSelectionToCopilot(text);
        }
      }
    });

    engineRef.current = engine;
    engine.setMarkdown(body);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync external content changes into the editor canvas
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (engineRef.current) {
      const currentEngineMd = engineRef.current.getMarkdown();
      if (currentEngineMd !== body) {
        engineRef.current.setMarkdown(body);
      }
    }
  }, [body]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleCopyPath = () => {
    if (filePath) {
      navigator.clipboard.writeText(filePath);
    }
  };

  const handleCopyFullDoc = () => {
    navigator.clipboard.writeText(content);
  };

  const handleExportMarkdown = () => {
    const filename = (filePath || 'document').split('/').pop() || 'document.md';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onChange(text);
        setIsImportModalOpen(false);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmPasteImport = () => {
    if (importText.trim()) {
      onChange(importText);
      setIsImportModalOpen(false);
      setImportText('');
    }
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const lineCount = body ? body.split(/\r?\n/).length : 0;

  if (!filePath) {
    return (
      <div id="editor-empty-state" className="editor-empty-state">
        <div className="editor-empty-state-card">
          <div className="empty-icon-circle">
            <FileText size={32} color="var(--primary, #2563eb)" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-heading, #0f172a)', margin: '14px 0 6px' }}>
            Nenhum Documento Selecionado
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: '0 0 22px', lineHeight: 1.5, maxWidth: '380px' }}>
            Selecione uma especificação na árvore lateral ou inicie a modelagem de um novo domínio de arquitetura.
          </p>
          <div className="empty-state-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {onOpenScaffoldWizard && (
              <button
                id="btn-empty-new-spec"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={onOpenScaffoldWizard}
              >
                <Plus size={15} />
                <span>Explorar Templates & Criar</span>
              </button>
            )}
            {onToggleCopilot && (
              <button
                id="btn-empty-open-copilot"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={onToggleCopilot}
              >
                <Sparkles size={15} />
                <span>Abrir Copilot IA</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. Document Header & Toolbar (Exact Original Layout with SVG Icons) */}
      <div className="editor-top-toolbar">
        <div className="doc-meta-left">
          <div className="doc-breadcrumbs">
            <input
              type="text"
              id="doc-path-input"
              className="doc-path-input"
              value={filePath || ''}
              readOnly
              placeholder="Selecione ou crie um documento..."
              spellCheck="false"
              title="Caminho do documento no workspace"
            />
            <button
              id="btn-copy-doc-path"
              className="btn-icon-subtle"
              type="button"
              title="Copiar caminho do arquivo"
              onClick={handleCopyPath}
            >
              <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="editor-actions-right">
          <div className="doc-icon-actions">
            <button
              id="btn-copy-doc-full"
              className="btn-icon-action"
              type="button"
              title="Copiar Markdown completo"
              onClick={handleCopyFullDoc}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button
              id="btn-export-md-file"
              className="btn-icon-action"
              type="button"
              title="Exportar arquivo .md"
              onClick={handleExportMarkdown}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button
              id="btn-import-doc"
              className="btn-icon-action"
              type="button"
              title="Importar documento (.md ou colar)"
              onClick={() => setIsImportModalOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
          </div>

          <div className="toolbar-divider"></div>

          {/* Botão Salvar (Ícone Disquete) */}
          <button
            id="btn-save-draft"
            className="btn-icon-action"
            type="button"
            title="Salvar no workspace (Ctrl+S)"
            style={{
              color: 'var(--primary, #2563eb)',
              borderColor: '#bfdbfe',
              background: '#eff6ff'
            }}
            onClick={handleSave}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>

          {/* Botão Diffs & PR (Ícone Git PR) */}
          {onOpenDiffModal && (
            <button
              id="btn-review-diff-direct"
              className="btn-icon-action"
              type="button"
              title="Revisar alterações e propor PR"
              onClick={onOpenDiffModal}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                <line x1="6" y1="9" x2="6" y2="21"></line>
              </svg>
            </button>
          )}

          {/* Botão Modo Auditoria */}
          <button
            id="btn-toggle-audit-mode"
            className={`btn-icon-action ${isAuditMode ? 'active' : ''}`}
            type="button"
            title="Modo Auditoria & GitLens (Ver autor e aprovador de cada seção)"
            onClick={() => setIsAuditMode(!isAuditMode)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Notion-like Canvas Body */}
      <div className="notion-editor-wrapper" id="notion-editor-wrapper">
        <div className="notion-editor-scroll-container">
          <div
            ref={canvasRef}
            id="notion-editor-canvas"
            className="notion-canvas"
          />
        </div>
      </div>

      {/* 5. Editor Status Footer */}
      <footer className="editor-bottom-bar">
        <div className="editor-status-left">
          <span id="save-draft-status" className="status-indicator">{saveStatus}</span>
          <span className="status-divider">&bull;</span>
          <span id="doc-word-count">{wordCount} palavras</span>
          <span className="status-divider">&bull;</span>
          <span id="doc-line-count">{lineCount} linhas</span>
        </div>
        <div className="editor-status-right">
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Atalho: <code>Ctrl+S</code> / <code>Cmd+S</code>
          </span>
          <button
            id="btn-reload-doc"
            className="btn-icon-subtle"
            title="Recarregar do disco"
            onClick={onReload}
          >
            <span className="material-symbols-outlined icon-xs">refresh</span>
          </button>
        </div>
      </footer>

      {/* Import Doc Modal */}
      {isImportModalOpen && (
        <div id="import-doc-modal" className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Importar Documento</h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Upload de arquivo .md ou colar texto</span>
              </div>
              <button id="btn-close-import-modal" className="btn-close" aria-label="Fechar" onClick={() => setIsImportModalOpen(false)}>
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px', gap: '14px' }}>
              <div className="import-dropzone" id="import-dropzone">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                  Arraste um arquivo <code style={{ fontSize: '11.5px', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>.md</code> aqui ou{' '}
                  <label htmlFor="import-file-input" style={{ color: 'var(--primary, #2563eb)', textDecoration: 'underline', cursor: 'pointer' }}>
                    clique para selecionar
                  </label>
                </div>
                <input
                  type="file"
                  id="import-file-input"
                  accept=".md,.markdown,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                <span>OU COLE O CONTEÚDO MARKDOWN</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              </div>

              <textarea
                id="import-paste-textarea"
                className="import-paste-textarea"
                placeholder="Cole aqui o conteúdo Markdown com ou sem metadados YAML..."
                spellCheck="false"
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ padding: '12px 22px' }}>
              <button id="btn-cancel-import" className="btn btn-ghost btn-sm" type="button" onClick={() => setIsImportModalOpen(false)}>
                Cancelar
              </button>
              <button id="btn-confirm-import" className="btn btn-primary btn-sm" type="button" onClick={handleConfirmPasteImport}>
                Importar para o Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

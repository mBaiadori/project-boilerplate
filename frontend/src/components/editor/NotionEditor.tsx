import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Plus, Sparkles } from 'lucide-react';
import { parseFrontmatter } from '../../services/frontmatter';
import { NotionEditorEngine } from './notion-editor-engine';
import { API } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { VisualMarkdownDiff } from './VisualMarkdownDiff';
import { DocumentHistoryDrawer } from './DocumentHistoryDrawer';
import type { GitCommitInfo, DocumentMetadataItem } from '../../types';

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
  const { originalContent, refreshPendingChanges, refreshGitStatus, activeRepo } = useWorkspace();
  const [saveStatus, setSaveStatus] = useState<'Pronto' | 'Salvando...' | 'Salvo no workspace'>('Pronto');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Git Mode, Visual Diff & Document History Drawer State
  const [isGitMode, setIsGitMode] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(null);
  const [historicalContent, setHistoricalContent] = useState<string>('');
  const [blameData, setBlameData] = useState<any[]>([]);
  const [docMetadata, setDocMetadata] = useState<DocumentMetadataItem | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NotionEditorEngine | null>(null);
  const isInternalChangeRef = useRef(false);

  const parsed = parseFrontmatter(content || '');
  const body = parsed.body || content || '';

  // Load document metadata and blame when file changes or git mode is opened
  useEffect(() => {
    if (!filePath) return;

    // Load metadata
    API.getProjectMetadata(activeRepo?.name).then(res => {
      if (res.ok && Array.isArray(res.data)) {
        const found = res.data.find(d => d.path === filePath || d.path.replace(/^\/+/, '') === filePath.replace(/^\/+/, ''));
        if (found) setDocMetadata(found);
      }
    }).catch(() => {});

    // Reset commit selection when switching file
    setSelectedCommit(null);
    setHistoricalContent('');
  }, [filePath, activeRepo]);

  // Load Blame info when entering Git / Audit Mode
  useEffect(() => {
    if (isGitMode && filePath) {
      API.getFileBlame(filePath).then(res => {
        if (res.ok && res.data?.blame) {
          setBlameData(res.data.blame);
        }
      }).catch(() => {});
    }
  }, [isGitMode, filePath]);

  // Load Historical Content when selecting a past commit
  useEffect(() => {
    if (!selectedCommit || !filePath) {
      setHistoricalContent('');
      return;
    }

    API.getFileVersion(filePath, selectedCommit.hash).then(res => {
      if (res.ok && res.data?.success) {
        setHistoricalContent(res.data.content);
      }
    }).catch(err => {
      console.error('[NotionEditor] Erro ao carregar versão do commit:', err);
    });
  }, [selectedCommit, filePath]);

  // Save document and re-sync Git status strictly on save event
  const handleSave = useCallback(async () => {
    if (!filePath) return;
    setSaveStatus('Salvando...');
    try {
      const currentBody = engineRef.current ? engineRef.current.getMarkdown() : body;
      await API.saveProjectFile({ path: filePath, content: currentBody });
      await Promise.all([
        refreshPendingChanges(),
        refreshGitStatus()
      ]);
      setSaveStatus('Salvo no workspace');
      setTimeout(() => setSaveStatus('Pronto'), 2500);
    } catch (e) {
      console.error('Erro ao salvar documento:', e);
      setSaveStatus('Pronto');
    }
  }, [filePath, body, refreshPendingChanges, refreshGitStatus]);

  // Initialize & Mount NotionEditorEngine
  useEffect(() => {
    if (!canvasRef.current || isGitMode) return;

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
  }, [isGitMode]);

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

  const handleConfirmPasteImport = () => {
    if (importText.trim()) {
      onChange(importText);
      setIsImportModalOpen(false);
      setImportText('');
    }
  };

  const handleRestoreHistoricalVersion = async () => {
    if (!historicalContent) return;
    if (window.confirm(`Deseja restaurar o documento para o commit ${selectedCommit?.shortHash || 'selecionado'}?`)) {
      onChange(historicalContent);
      setIsGitMode(false);
      setSelectedCommit(null);
      await API.saveProjectFile({ path: filePath!, content: historicalContent });
      await refreshPendingChanges();
      await refreshGitStatus();
    }
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const lineCount = body ? body.split(/\r?\n/).length : 0;
  const isDirty = originalContent !== body;

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

  const comparisonOldContent = selectedCommit ? historicalContent : (originalContent || '');
  const comparisonOldTitle = selectedCommit 
    ? `Commit ${selectedCommit.shortHash} (${selectedCommit.author})` 
    : 'Versão Base (HEAD)';

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* Center Main Editor / Git Visual Diff Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        
        {/* 1. Document Header & Toolbar */}
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

            {/* Alternador de Modo Git & Versões ("Olhinho" / Diffs) */}
            <button
              id="btn-toggle-git-mode"
              className={`btn-icon-action ${isGitMode ? 'active' : ''}`}
              type="button"
              title={isGitMode ? 'Voltar para Modo de Edição' : 'Modo Git & Auditoria (Ver alterações formatadas, quem editou e versões)'}
              style={{
                color: isGitMode ? '#ffffff' : 'var(--primary, #2563eb)',
                background: isGitMode ? 'var(--primary, #2563eb)' : '#eff6ff',
                borderColor: '#bfdbfe'
              }}
              onClick={() => {
                const nextMode = !isGitMode;
                setIsGitMode(nextMode);
                if (nextMode) setIsHistoryDrawerOpen(true);
              }}
            >
              <span className="material-symbols-outlined icon-xs">visibility</span>
            </button>

            {/* Botão Gaveta de Histórico */}
            <button
              id="btn-toggle-history-drawer"
              className={`btn-icon-action ${isHistoryDrawerOpen ? 'active' : ''}`}
              type="button"
              title="Linha do Tempo de Commits & Versões deste documento"
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            >
              <span className="material-symbols-outlined icon-xs">history</span>
            </button>

            {/* Botão Salvar (Ícone Disquete) */}
            {!isGitMode && (
              <button
                id="btn-save-draft"
                className="btn-icon-action"
                type="button"
                title="Salvar no workspace e atualizar Git (Ctrl+S)"
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
            )}

            {/* Botão Central de Diffs & PR */}
            {onOpenDiffModal && (
              <button
                id="btn-review-diff-direct"
                className="btn-icon-action"
                type="button"
                title="Revisar alterações e propor PR Oficial"
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
          </div>
        </div>

        {/* 2. Body: Either Visual Markdown Diff (Git Mode) or Notion Live Editor */}
        {isGitMode ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <VisualMarkdownDiff
              oldContent={comparisonOldContent}
              newContent={body}
              oldTitle={comparisonOldTitle}
              newTitle="Versão Atual (Working Copy)"
              fileName={filePath || undefined}
              blameData={blameData}
              showAuthorship={true}
              onRestoreOldVersion={selectedCommit ? handleRestoreHistoricalVersion : undefined}
              onClose={() => setIsGitMode(false)}
            />
          </div>
        ) : (
          <div className="notion-editor-wrapper" id="notion-editor-wrapper">
            <div className="notion-editor-scroll-container">
              <div
                ref={canvasRef}
                id="notion-editor-canvas"
                className="notion-canvas"
              />
            </div>
          </div>
        )}

        {/* 3. Editor Status Footer */}
        <footer className="editor-bottom-bar">
          <div className="editor-status-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span id="save-draft-status" className="status-indicator">
              {isGitMode ? 'Modo Git & Auditoria Ativo' : isDirty ? 'Modificações não salvas' : saveStatus}
            </span>
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
      </div>

      {/* Right Drawer: Document History Timeline & Governance */}
      <DocumentHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        filePath={filePath}
        selectedCommitHash={selectedCommit ? selectedCommit.hash : null}
        onSelectCommit={(commit) => {
          setSelectedCommit(commit);
          setIsGitMode(true);
        }}
        documentMeta={docMetadata}
      />

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
              <div className="import-paste-box">
                <textarea
                  id="import-paste-textarea"
                  rows={8}
                  placeholder="Ou cole seu texto Markdown aqui diretamente..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmPasteImport} disabled={!importText.trim()}>
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

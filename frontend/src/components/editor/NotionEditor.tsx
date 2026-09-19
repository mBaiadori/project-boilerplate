import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseFrontmatter, serializeFrontmatter, type DocumentMetadata } from '../../services/frontmatter';
import { SlashMenu, type SlashCommandItem } from './SlashMenu';
import { BubbleMenu } from './BubbleMenu';
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
  onNavigateFile = () => {},
  onReload = () => {},
  onOpenDiffModal,
  onToggleCopilot,
  onOpenScaffoldWizard,
  onSendSelectionToCopilot
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'Pronto' | 'Salvando...' | 'Salvo no workspace'>('Pronto');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Context Connectivity Data
  const [contextData, setContextData] = useState<any>(null);
  const [showConsumers, setShowConsumers] = useState(false);
  const [showDeps, setShowDeps] = useState(false);

  // Slash & Bubble Menu State
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [bubbleMenuOpen, setBubbleMenuOpen] = useState(false);
  const [bubbleMenuPosition, setBubbleMenuPosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = parseFrontmatter(content || '');
  const metadata: DocumentMetadata = parsed.metadata || {};
  const body = parsed.body || '';

  // Load connectivity context on file change
  useEffect(() => {
    if (filePath) {
      API.getDocumentContext(filePath)
        .then(data => setContextData(data))
        .catch(err => console.warn('Erro ao carregar contexto:', err));
    } else {
      setContextData(null);
    }
  }, [filePath]);

  const handleMetadataFieldChange = (field: keyof DocumentMetadata, value: any) => {
    const updatedMetadata = { ...metadata, [field]: value };
    const newDoc = serializeFrontmatter(updatedMetadata, body);
    onChange(newDoc);
  };

  const handleBodyChange = (newBody: string) => {
    const newDoc = serializeFrontmatter(metadata, newBody);
    onChange(newDoc);
  };

  const handleSave = useCallback(async () => {
    if (!filePath) return;
    setSaveStatus('Salvando...');
    try {
      await API.saveProjectFile({ path: filePath, content });
      setSaveStatus('Salvo no workspace');
      setTimeout(() => setSaveStatus('Pronto'), 2500);
    } catch (e) {
      console.error('Erro ao salvar documento:', e);
      setSaveStatus('Pronto');
    }
  }, [filePath, content]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
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

  const handleAutoGenId = () => {
    const pathPart = filePath ? filePath.replace(/\.md$/, '').replace(/\//g, '-') : 'doc';
    const autoId = `spec-${pathPart}-${Date.now().toString(36)}`;
    handleMetadataFieldChange('id', autoId);
  };

  const handleSelectText = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setBubbleMenuOpen(false);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0) {
      setBubbleMenuPosition({ top: rect.top, left: rect.left });
      setBubbleMenuOpen(true);
    }
  };

  const handleFormat = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const replacement = `${prefix}${selected || 'texto'}${suffix}`;

    const newBody = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    handleBodyChange(newBody);
    setBubbleMenuOpen(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 50);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/') {
      const textarea = textareaRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        setSlashMenuPosition({ top: rect.top + 40, left: rect.left + 30 });
        setSlashMenuOpen(true);
        setSlashFilter('');
      }
    } else if (slashMenuOpen) {
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setSlashFilter(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setSlashFilter(prev => prev.slice(0, -1));
      }
    }
  };

  const handleSelectSlashCommand = (cmd: SlashCommandItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const before = textarea.value.substring(0, cursor);
    const after = textarea.value.substring(cursor);
    const cleanBefore = before.endsWith('/') ? before.slice(0, -1) : before;
    const newBody = cleanBefore + cmd.template + after;
    handleBodyChange(newBody);
    setSlashMenuOpen(false);

    setTimeout(() => {
      textarea.focus();
    }, 50);
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const lineCount = body ? body.split('\n').length : 0;

  const consumers = contextData?.consumers || [];
  const dependencies = contextData?.dependencies || [];
  const currentLayer = metadata.layer || contextData?.layer || 'L4_ARTIFACT';
  const currentStatus = (metadata.status || contextData?.status || 'draft').toUpperCase();

  // If no document is selected, render empty state
  if (!filePath) {
    return (
      <div id="editor-empty-state" className="editor-empty-state" style={{ display: 'flex' }}>
        <div className="editor-empty-state-card">
          <div className="empty-icon-circle">
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-primary, #6366f1)' }}>
              description
            </span>
          </div>
          <h3 style={{ margin: '14px 0 6px 0', fontSize: '17px', fontWeight: 600, color: 'var(--text-normal)' }}>
            Nenhum documento selecionado
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.5, textAlign: 'center' }}>
            Selecione um documento na árvore lateral à esquerda ou inicie uma nova especificação a partir do catálogo de templates.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              id="btn-empty-state-templates"
              className="btn btn-primary"
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              onClick={onOpenScaffoldWizard}
            >
              <span className="material-symbols-outlined icon-sm">auto_stories</span>
              <span>Explorar Templates</span>
            </button>
            <button
              id="btn-empty-state-new"
              className="btn btn-secondary"
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              onClick={onOpenScaffoldWizard}
            >
              <span className="material-symbols-outlined icon-sm">add</span>
              <span>Novo Documento</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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

        {/* Editor Actions */}
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
            style={{ color: 'var(--primary, #2563eb)', borderColor: '#bfdbfe', background: '#eff6ff' }}
            onClick={handleSave}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>

          {/* Botão Diffs & PR (Ícone Git PR) */}
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

          {/* Botão Modo Auditoria / GitLens */}
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

          {/* Botão IA */}
          <button
            id="btn-toggle-ai-pane"
            className="btn-icon-action"
            type="button"
            title="Abrir Assistente de IA"
            onClick={onToggleCopilot}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Active Bidirectional Connectivity & Breadcrumb Bar */}
      <div className="doc-connectivity-bar" id="doc-connectivity-bar">
        <div className="connectivity-left">
          <span className="layer-pill" id="conn-layer-pill">{currentLayer}</span>
          <span className="status-pill" id="conn-status-pill">{currentStatus}</span>
          <div className="breadcrumb-trail" id="conn-breadcrumb-trail">
            {filePath.split('/').map((part, i) => (
              <span key={i} className={`trail-item ${i === filePath.split('/').length - 1 ? 'current' : ''}`}>
                {part}
              </span>
            ))}
          </div>
        </div>

        <div className="connectivity-right">
          {consumers.length > 0 && (
            <div className="conn-item-badge" id="conn-consumers-badge">
              <button
                className="conn-pill consumers"
                id="btn-toggle-consumers-pop"
                title="Outros documentos que dependem desta spec"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowConsumers(!showConsumers)}
              >
                <span className="material-symbols-outlined icon-xs">link</span>
                <span id="conn-consumers-count">{consumers.length}</span> Consumidor(es)
              </button>
              {showConsumers && (
                <div className="conn-dropdown-menu" id="dropdown-consumers" style={{ display: 'block' }}>
                  {consumers.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => {
                        onNavigateFile(c.path || c);
                        setShowConsumers(false);
                      }}
                    >
                      {c.title || c.path || c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {dependencies.length > 0 && (
            <div className="conn-item-badge" id="conn-deps-badge">
              <button
                className="conn-pill deps"
                id="btn-toggle-deps-pop"
                title="Contratos consumidos por esta spec"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowDeps(!showDeps)}
              >
                <span className="material-symbols-outlined icon-xs">arrow_forward</span>
                <span id="conn-deps-count">{dependencies.length}</span> Dependência(s)
              </button>
              {showDeps && (
                <div className="conn-dropdown-menu" id="dropdown-deps" style={{ display: 'block' }}>
                  {dependencies.map((d: any, idx: number) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => {
                        onNavigateFile(d.path || d);
                        setShowDeps(false);
                      }}
                    >
                      {d.title || d.path || d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Metadata Inspector / Form Card (Collapsible Structured Form) */}
      <div className="doc-meta-inspector" id="doc-meta-inspector">
        <div
          className="meta-inspector-header"
          id="meta-inspector-toggle"
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
        >
          <div className="meta-inspector-left">
            <span className="meta-toggle-icon material-symbols-outlined icon-sm">tune</span>
            <strong id="meta-header-title">Metadados & Governança</strong>
            <div className="meta-header-summary" id="meta-header-summary">
              <span className="pill" id="meta-summary-pill">{metadata.type || 'Spec'}</span>
            </div>
          </div>
        </div>

        {/* Expanded Form Fields */}
        <div
          className="meta-inspector-form"
          id="meta-inspector-form"
          style={{ display: isInspectorOpen ? 'block' : 'none' }}
        >
          <div className="meta-form-grid">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="meta-input-id">ID do Artefato:</label>
                <button
                  id="btn-auto-gen-id"
                  className="btn-icon-subtle"
                  type="button"
                  title="Gerar ID Oficial Único"
                  style={{ fontSize: '11px', padding: '1px 6px', color: 'var(--primary, #2563eb)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                  onClick={handleAutoGenId}
                >
                  <span className="material-symbols-outlined icon-xs">bolt</span>
                  Auto ID
                </button>
              </div>
              <input
                type="text"
                id="meta-input-id"
                placeholder="ex: l4-billing-pix-checkout"
                spellCheck="false"
                value={metadata.id || ''}
                onChange={e => handleMetadataFieldChange('id', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="meta-input-title">Título do Documento:</label>
              <input
                type="text"
                id="meta-input-title"
                placeholder="ex: Modelagem de Entidades PIX"
                value={metadata.title || ''}
                onChange={e => handleMetadataFieldChange('title', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="meta-input-layer">Layer:</label>
              <select
                id="meta-input-layer"
                value={metadata.layer || 'L4_ARTIFACT'}
                onChange={e => handleMetadataFieldChange('layer', e.target.value)}
              >
                <option value="L1_PROJECT">L1 — Projeto & Visão</option>
                <option value="L2_DOMAIN">L2 — Domínio de Negócio</option>
                <option value="L3_SUBDOMAIN">L3 — Subdomínio / Área</option>
                <option value="L4_ARTIFACT">L4 — Artefato / Feature</option>
                <option value="L5_BEHAVIOR">L5 — Comportamento / BDD</option>
                <option value="L6_OBSERVABILITY">L6 — Observabilidade & QA</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="meta-input-status">Status de Governança:</label>
              <select
                id="meta-input-status"
                value={metadata.status || 'draft'}
                onChange={e => handleMetadataFieldChange('status', e.target.value)}
              >
                <option value="draft">DRAFT (Rascunho)</option>
                <option value="in_review">IN_REVIEW (Em Revisão)</option>
                <option value="active">ACTIVE (Ativo)</option>
                <option value="approved">APPROVED (Aprovado)</option>
                <option value="deprecated">DEPRECATED (Obsoleto)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="meta-input-type">Tipo de Artefato:</label>
              <input
                type="text"
                id="meta-input-type"
                placeholder="ex: entity, flow, specs, kpis, ideacao"
                value={metadata.type || ''}
                onChange={e => handleMetadataFieldChange('type', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="meta-input-version">Versão:</label>
              <input
                type="text"
                id="meta-input-version"
                placeholder="1.0.0"
                value={metadata.version || ''}
                onChange={e => handleMetadataFieldChange('version', e.target.value)}
              />
            </div>
          </div>

          {/* Graph & Connections Row */}
          <div className="meta-form-connections">
            <div className="meta-section-title">Conexões do Grafo & Esteira (Lifecycle)</div>
            <div className="meta-connections-grid">
              <div className="form-group">
                <label htmlFor="meta-input-parent">Documento Pai (Parent):</label>
                <input
                  type="text"
                  id="meta-input-parent"
                  placeholder="ex: domains/billing/pix/flow.md"
                  spellCheck="false"
                  value={metadata.parent || ''}
                  onChange={e => handleMetadataFieldChange('parent', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meta-input-prev-stage">Etapa Anterior (Previous Stage):</label>
                <input
                  type="text"
                  id="meta-input-prev-stage"
                  placeholder="ex: domains/billing/pix/flow.md"
                  spellCheck="false"
                  value={metadata.previous_stage || ''}
                  onChange={e => handleMetadataFieldChange('previous_stage', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meta-input-next-stage">Próxima Etapa (Next Stage):</label>
                <input
                  type="text"
                  id="meta-input-next-stage"
                  placeholder="ex: domains/billing/pix/specs.md"
                  spellCheck="false"
                  value={metadata.next_stage || ''}
                  onChange={e => handleMetadataFieldChange('next_stage', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="meta-input-feedback">Feedback Loop:</label>
                <input
                  type="text"
                  id="meta-input-feedback"
                  placeholder="ex: domains/billing/pix/flow.md"
                  spellCheck="false"
                  value={metadata.feedback_loop || ''}
                  onChange={e => handleMetadataFieldChange('feedback_loop', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Notion-like Canvas Body */}
      <div className="notion-editor-wrapper" id="notion-editor-wrapper">
        <div className="notion-editor-scroll-container">
          <div id="notion-editor-canvas" className="notion-canvas" onMouseUp={handleSelectText}>
            <textarea
              ref={textareaRef}
              id="notion-raw-textarea"
              value={body}
              onChange={e => handleBodyChange(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Digite '/' para comandos rápidos ou comece a escrever sua especificação..."
              style={{
                width: '100%',
                minHeight: '520px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: '15px',
                lineHeight: '1.7',
                color: 'var(--text-main)'
              }}
            />
          </div>
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

      {/* Floating Menus */}
      <SlashMenu
        isOpen={slashMenuOpen}
        onClose={() => setSlashMenuOpen(false)}
        onSelect={handleSelectSlashCommand}
        position={slashMenuPosition}
        filterText={slashFilter}
      />

      <BubbleMenu
        isOpen={bubbleMenuOpen}
        position={bubbleMenuPosition}
        onFormat={handleFormat}
        onAskAI={() => {
          const textarea = textareaRef.current;
          if (textarea && onSendSelectionToCopilot) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.substring(start, end);
            if (selected.trim()) {
              onSendSelectionToCopilot(selected);
              setBubbleMenuOpen(false);
            }
          }
        }}
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

// =============================================================================
// SUBVIEW: GERENCIADOR & EDITOR DE TEMPLATES
// CRUD visual de templates + Edição rica com NotionEditor + Copilot Prompt Unificado
// =============================================================================

import React, { useState, useEffect } from 'react';
import type { TemplateItem } from '../../types';
import { useTemplate } from '../../hooks/useTemplate';
import { useAI } from '../../context/AIContext';
import { NotionEditor } from '../../components/editor/NotionEditor';

interface TemplatesSubViewProps {
  onApplyTemplate?: (filePath: string) => void;
}

type Tab = 'projeto' | 'comunidade';
type ViewMode = 'grid' | 'editor';

const CATEGORY_SUGGESTIONS = ['geral', 'engenharia', 'arquitetura', 'requisitos', 'api', 'produto', 'design'];

export const TemplatesSubView: React.FC<TemplatesSubViewProps> = () => {
  const {
    templates,
    communityTemplates,
    loading,
    importingId,
    fetchTemplates,
    fetchCommunityTemplates,
    createTemplate,
    updateTemplate,
    importFromCommunity,
    deleteTemplate,
  } = useTemplate();

  const { setIsTemplateEditorMode, setDynamicContext } = useAI();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<Tab>('projeto');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Template State (for rich editor)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  const [tplId, setTplId] = useState('');
  const [tplTemplateName, setTplTemplateName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategory, setTplCategory] = useState('');
  const [tplBadge, setTplBadge] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplTags, setTplTags] = useState('');
  const [tplContent, setTplContent] = useState('');
  const [tplPrompt, setTplPrompt] = useState('');

  // Import feedback
  const [importFeedback, setImportFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    fetchTemplates();
    fetchCommunityTemplates();
  }, [fetchTemplates, fetchCommunityTemplates]);

  // Sync AI Context template editor mode & dynamic template content for Copilot
  useEffect(() => {
    if (viewMode === 'editor') {
      setIsTemplateEditorMode(true);
      setDynamicContext({
        filePath: tplTemplateName ? `templates/${tplTemplateName}.md` : `templates/${tplId || 'novo-template'}.md`,
        content: tplContent,
        badge: `🛠️ Template: ${tplTitle || tplId || 'Novo'}`
      });
    } else {
      setIsTemplateEditorMode(false);
      setDynamicContext(null);
    }
    return () => {
      setIsTemplateEditorMode(false);
      setDynamicContext(null);
    };
  }, [viewMode, tplContent, tplTitle, tplId, tplTemplateName, setIsTemplateEditorMode, setDynamicContext]);

  // ── Derived list ────────────────────────────────────────────────────────────
  const activeList = activeTab === 'comunidade' ? communityTemplates : templates;
  const allCategories = Array.from(new Set(activeList.map(t => t.category).filter(Boolean))).sort();

  const filteredTemplates = activeList.filter(tpl => {
    const matchesCat = activeCategory === 'all' || tpl.category?.toLowerCase() === activeCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      tpl.title.toLowerCase().includes(q) ||
      (tpl.templateName || '').toLowerCase().includes(q) ||
      (tpl.description || '').toLowerCase().includes(q) ||
      (tpl.tags || []).some(t => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // ── Handlers para alternar para o Editor Rico ───────────────────────────────
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setTplId('');
    setTplTemplateName('');
    setTplTitle('Novo Template');
    setTplCategory('geral');
    setTplBadge('Local');
    setTplDesc('');
    setTplTags('');
    setTplContent('# Novo Template\n\n## 1. Visão Geral & Objetivos\nDescreva a proposta deste documento.\n\n## 2. Requisitos Principais\n- [ ] Requisito inicial a ser definido\n\n## 3. Detalhamento Técnico\nEspecifique os pontos de implementação.\n');
    setTplPrompt('Você é o assistente especialista responsável por guiar o preenchimento deste documento.\nAjude o usuário a definir objetivos claros, revisar requisitos funcionais e estruturar decisões técnicas.');
    setSaveError('');
    setSaveSuccessMsg('');
    setShowConfigDrawer(true);
    setViewMode('editor');
  };

  const handleOpenEdit = (tpl: TemplateItem) => {
    setIsEditMode(true);
    setTplId(tpl.id);
    setTplTemplateName(tpl.templateName || tpl.id);
    setTplTitle(tpl.title || '');
    setTplCategory(tpl.category || 'geral');
    setTplBadge(tpl.badge || (tpl.source === 'community' ? 'Comunidade' : 'Local'));
    setTplDesc(tpl.description || '');
    setTplTags((tpl.tags || []).join(', '));
    setTplContent(tpl.content || `# ${tpl.title || 'Template'}\n\n## 1. Visão Geral\n`);
    setTplPrompt(tpl.prompt || tpl.systemPrompt || 'Você é o assistente especialista deste documento.');
    setSaveError('');
    setSaveSuccessMsg('');
    setShowConfigDrawer(false);
    setViewMode('editor');
  };

  const handleSaveTemplate = async () => {
    const finalTitle = tplTitle.trim();
    const finalSlug = tplId.trim() || tplTemplateName.trim() || finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!finalTitle) {
      setSaveError('O título do template é obrigatório.');
      return { success: false, message: 'O título do template é obrigatório.' };
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccessMsg('');

    try {
      const payload: Partial<TemplateItem> = {
        templateName: tplTemplateName.trim() || finalSlug,
        title: finalTitle,
        ext: 'md',
        category: tplCategory.trim() || 'geral',
        badge: tplBadge.trim() || 'Local',
        description: tplDesc.trim(),
        tags: tplTags.split(',').map(t => t.trim()).filter(Boolean),
        content: tplContent.trim(),
        prompt: tplPrompt.trim(),
        systemPrompt: tplPrompt.trim(),
        source: isEditMode ? undefined : 'local',
      };

      let result;
      if (isEditMode) {
        result = await updateTemplate(tplId || finalSlug, payload);
      } else {
        payload.id = finalSlug.toLowerCase().replace(/\s+/g, '-');
        result = await createTemplate(payload);
      }

      if (result.success) {
        setSaveSuccessMsg('Template salvo com sucesso no .templates.json!');
        await fetchTemplates();
        // Automaticamente retorna para a listagem após salvar com sucesso
        setTimeout(() => {
          setViewMode('grid');
          setIsTemplateEditorMode(false);
        }, 400);
        return { success: true, message: 'Template salvo com sucesso!' };
      } else {
        setSaveError(result.message || 'Erro ao salvar template.');
        return { success: false, message: result.message || 'Erro ao salvar template.' };
      }
    } catch (err: any) {
      setSaveError(err.message || 'Erro de conexão.');
      return { success: false, message: err.message || 'Erro de conexão.' };
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tpl: TemplateItem) => {
    const ok = window.confirm(`Deseja realmente remover o template "${tpl.title || tpl.id}" do projeto?`);
    if (!ok) return;

    const result = await deleteTemplate(tpl.id);
    if (result.success) {
      setImportFeedback(prev => ({ ...prev, [tpl.id]: { ok: true, msg: 'Removido do projeto com sucesso!' } }));
      setTimeout(() => setImportFeedback(prev => { const n = { ...prev }; delete n[tpl.id]; return n; }), 3000);
    } else {
      setImportFeedback(prev => ({ ...prev, [tpl.id]: { ok: false, msg: result.message || 'Erro ao remover' } }));
      alert(result.message || 'Erro ao remover template.');
    }
  };

  const handleImport = async (tpl: TemplateItem) => {
    const result = await importFromCommunity(tpl.id);
    setImportFeedback(prev => ({ ...prev, [tpl.id]: { ok: result.success, msg: result.message } }));
    if (result.success) {
      setTimeout(() => setImportFeedback(prev => { const n = { ...prev }; delete n[tpl.id]; return n; }), 3000);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER 1: MODO EDITOR RICO DE TEMPLATE (UNIFICADO NO NOTIONEDITOR)
  // ═════════════════════════════════════════════════════════════════════════════
  if (viewMode === 'editor') {
    return (
      <div id="template-rich-editor-view" className="dash-subview" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', background: 'var(--color-surface)' }}>
        
        {/* Top Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          borderBottom: '1px solid var(--color-outline-variant)',
          background: 'var(--color-surface-container-low)',
          flexShrink: 0,
          gap: '12px',
        }}>
          {/* Left: Back button & Title/Slug */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <button
              id="btn-back-to-templates-grid"
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setViewMode('grid');
                setIsTemplateEditorMode(false);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Voltar à lista de templates"
            >
              <span className="material-symbols-outlined icon-xs">arrow_back</span>
              Voltar
            </button>
            <span style={{ color: 'var(--color-outline)' }}>/</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>bookmark</span>
              <strong style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tplTitle || 'Novo Template'}
              </strong>
              <span className="badge badge-primary-subtle" style={{ fontSize: '10px' }}>
                {tplCategory || 'Geral'}
              </span>
            </div>
          </div>

          {/* Right: Metadados Drawer Toggle & Salvar Template */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className={`btn btn-sm ${showConfigDrawer ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
              title="Configurar Metadados do Template"
            >
              <span className="material-symbols-outlined icon-xs">tune</span>
              Metadados
              <span className="material-symbols-outlined icon-xs" style={{ fontSize: '14px' }}>
                {showConfigDrawer ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            <button
              id="btn-save-template-editor"
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-outlined icon-xs">
                {isSaving ? 'sync' : 'save'}
              </span>
              {isSaving ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {saveError && (
          <div style={{ padding: '6px 18px', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-error)' }}>
            <span className="material-symbols-outlined icon-xs">error</span>
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccessMsg && (
          <div style={{ padding: '6px 18px', background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-primary)' }}>
            <span className="material-symbols-outlined icon-xs">check_circle</span>
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Metadados Dropdown Drawer */}
        {showConfigDrawer && (
          <div style={{
            background: 'var(--color-surface-container-low)',
            borderBottom: '1px solid var(--color-outline-variant)',
            padding: '12px 18px',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
            gap: '10px',
            flexShrink: 0,
          }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px', color: 'var(--text-muted)' }}>
                Título do Template *
              </label>
              <input
                type="text"
                placeholder="ex: Especificação de Microsserviço"
                value={tplTitle}
                onChange={e => setTplTitle(e.target.value)}
                style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px', color: 'var(--text-muted)' }}>
                Identificador / Slug {!isEditMode && '*'}
              </label>
              <input
                type="text"
                placeholder="ex: microservice-spec"
                value={tplId}
                disabled={isEditMode}
                onChange={e => setTplId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: isEditMode ? 'var(--color-surface-container)' : undefined }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px', color: 'var(--text-muted)' }}>
                Categoria
              </label>
              <input
                type="text"
                list="tpl-cat-suggestions"
                placeholder="ex: engenharia"
                value={tplCategory}
                onChange={e => setTplCategory(e.target.value)}
                style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
              <datalist id="tpl-cat-suggestions">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '3px', color: 'var(--text-muted)' }}>
                Tags (separadas por vírgula)
              </label>
              <input
                type="text"
                placeholder="ex: backend, api, rest"
                value={tplTags}
                onChange={e => setTplTags(e.target.value)}
                style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}

        {/* Embedded Exact Same Rich Notion Document Editor with Tabs */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <NotionEditor
            content={tplContent}
            onChange={setTplContent}
            promptContent={tplPrompt}
            onPromptChange={setTplPrompt}
            filePath={tplTemplateName ? `templates/${tplTemplateName}.md` : `templates/${tplId || 'novo-template'}.md`}
            isTemplateMode={true}
            customTitle={tplTitle}
            onCustomTitleChange={setTplTitle}
            onCustomSave={handleSaveTemplate}
            customSaveStatus={isSaving ? 'Salvando template...' : 'Template Pronto'}
          />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER 2: MODO GRID DE TEMPLATES (PROJETO & COMUNIDADE)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div id="subview-templates" className="dash-subview" style={{ display: 'block', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="templates-view-wrapper">

        {/* ── Header ── */}
        <div className="template-store-header">
          <div className="templates-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Gerenciador de Templates</h2>
              <p className="subtitle">
                Central de modelos técnicos padronizados com Prompt de Copilot integrado (.templates.json).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button id="btn-refresh-templates" className="btn btn-ghost btn-sm" type="button" onClick={() => { fetchTemplates(); fetchCommunityTemplates(); }}>
                <span className="material-symbols-outlined icon-xs">refresh</span>
                Sincronizar
              </button>
              <button id="btn-open-new-template" className="btn btn-primary btn-sm" type="button" onClick={handleOpenCreate}>
                <span className="material-symbols-outlined icon-xs">add</span>
                Novo Template
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="template-store-tabs" role="tablist">
            <button
              className={`store-tab-btn ${activeTab === 'projeto' ? 'active' : ''}`}
              id="tab-tpl-projeto"
              type="button"
              role="tab"
              aria-selected={activeTab === 'projeto'}
              onClick={() => setActiveTab('projeto')}
            >
              📁 Projeto ({templates.length})
            </button>
            <button
              className={`store-tab-btn ${activeTab === 'comunidade' ? 'active' : ''}`}
              id="tab-tpl-comunidade"
              type="button"
              role="tab"
              aria-selected={activeTab === 'comunidade'}
              onClick={() => setActiveTab('comunidade')}
            >
              🌐 Comunidade ({communityTemplates.length})
            </button>
          </div>

          {/* Community info */}
          {activeTab === 'comunidade' && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--color-secondary-container)', display: 'flex', gap: '8px', alignItems: 'center', margin: '0 0 8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>info</span>
              <span style={{ fontSize: '12px', color: 'var(--color-on-secondary-container)' }}>
                Templates globais da comunidade. Importe-os para o <code>.templates.json</code> do projeto para usá-los e personalizá-los.
              </span>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div className="store-filter-bar" id="store-category-filters">
              <button className={`store-filter-chip ${activeCategory === 'all' ? 'active' : ''}`} type="button" onClick={() => setActiveCategory('all')}>
                Todos
              </button>
              {allCategories.map(c => (
                <button key={c} className={`store-filter-chip ${activeCategory === c ? 'active' : ''}`} type="button" onClick={() => setActiveCategory(c!)}>
                  {c}
                </button>
              ))}
            </div>
            <div style={{ minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <input
                type="text"
                id="tpl-search-input"
                placeholder="Buscar template..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: '12px', padding: '5px 12px', width: '100%', border: '1px solid var(--border)', borderRadius: '16px' }}
              />
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div id="templates-grid-container" className="templates-cards-grid">
          {loading ? (
            <div className="loading-state">Carregando templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              {activeTab === 'projeto' ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>description</span>
                  Nenhum template no projeto ainda.{' '}
                  <button type="button" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', marginLeft: '8px' }} onClick={handleOpenCreate}>
                    Criar primeiro template
                  </button>
                </>
              ) : (
                'Nenhum template encontrado na comunidade.'
              )}
            </div>
          ) : (
            filteredTemplates.map(tpl => {
              const fb = importFeedback[tpl.id];
              const alreadyImported = activeTab === 'comunidade' && templates.some(t => t.id === tpl.id);
              return (
                <div key={tpl.id} className="template-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="template-card-header">
                    <span className="badge badge-primary-subtle" style={{ fontSize: '10px' }}>{tpl.category || 'Geral'}</span>
                    {tpl.badge && <span className="badge badge-success-subtle" style={{ fontSize: '10px' }}>{tpl.badge}</span>}
                    {tpl.source === 'community' && <span className="badge" style={{ fontSize: '10px', background: 'var(--color-tertiary-container)', color: 'var(--color-tertiary)' }}>Comunidade</span>}
                  </div>
                  <h3 className="template-card-title">{tpl.title}</h3>
                  <p className="template-card-desc" style={{ flex: 1 }}>{tpl.description || (tpl.prompt ? `Prompt: ${tpl.prompt.slice(0, 80)}...` : 'Sem descrição.')}</p>
                  {(tpl.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {(tpl.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {fb && (
                    <p style={{ fontSize: '11px', color: fb.ok ? 'var(--color-primary)' : 'var(--color-error)', margin: '0 0 6px' }}>
                      {fb.ok ? '✓' : '✗'} {fb.msg}
                    </p>
                  )}
                  <div className="template-card-footer" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {activeTab === 'projeto' ? (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          onClick={() => handleOpenEdit(tpl)}
                        >
                          <span className="material-symbols-outlined icon-xs">edit_note</span>
                          Editar Template
                        </button>
                        <button
                          id={`btn-delete-tpl-${tpl.id}`}
                          className="btn btn-ghost btn-sm"
                          type="button"
                          title="Remover template do projeto"
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => handleDelete(tpl)}
                        >
                          <span className="material-symbols-outlined icon-xs">delete</span>
                        </button>
                      </>
                    ) : (
                      alreadyImported ? (
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <span
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', opacity: 0.9, fontSize: '11px' }}
                          >
                            ✓ Importado
                          </span>
                          <button
                            id={`btn-unimport-community-${tpl.id}`}
                            className="btn btn-ghost btn-sm"
                            type="button"
                            title="Desimportar / remover este template do projeto"
                            style={{ color: 'var(--color-error)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => handleDelete(tpl)}
                          >
                            <span className="material-symbols-outlined icon-xs">delete</span>
                            Desimportar
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`btn-import-community-${tpl.id}`}
                          className="btn btn-primary btn-sm"
                          type="button"
                          style={{ width: '100%' }}
                          disabled={importingId === tpl.id}
                          onClick={() => handleImport(tpl)}
                        >
                          {importingId === tpl.id ? 'Importando...' : 'Importar para o Projeto'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

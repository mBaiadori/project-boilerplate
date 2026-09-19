import React, { useState, useEffect, useCallback } from 'react';
import type { TemplateItem } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface TemplatesSubViewProps {
  onApplyTemplate: (filePath: string) => void;
}

export const TemplatesSubView: React.FC<TemplatesSubViewProps> = ({ onApplyTemplate }) => {
  const { loadTree, loadFile } = useWorkspace();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'project'>('store');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiIdea, setAiIdea] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategory, setTplCategory] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplFilename, setTplFilename] = useState('');
  const [tplAssistant, setTplAssistant] = useState('');
  const [tplContent, setTplContent] = useState('');

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getTemplates();
      if (res && Array.isArray(res.templates)) {
        setTemplates(res.templates);
      }
    } catch (err) {
      console.error('[TemplatesSubView] Erro ao carregar templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleUseTemplate = async (tpl: TemplateItem) => {
    const filename = tpl.filename || `${tpl.id}.md`;
    const targetPath = filename.includes('/') ? filename : `specs/${filename}`;

    try {
      await API.createProjectFile({
        path: targetPath,
        content: tpl.content
      });
      await loadTree();
      await loadFile(targetPath);
      onApplyTemplate(targetPath);
    } catch (err) {
      console.error('[TemplatesSubView] Erro ao aplicar template:', err);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiIdea.trim()) return;
    setIsGeneratingAI(true);
    try {
      const res = await API.askAI({
        prompt: `Gere a estrutura de um template técnico oficial em Markdown para a seguinte ideia: "${aiIdea}". Retorne título, categoria, descrição resumida, nome de arquivo e o markdown completo com metadados frontmatter.`,
        history: []
      });
      if (res.ok && res.data) {
        setTplTitle(`Template: ${aiIdea.slice(0, 30)}`);
        setTplCategory('IA & Agentes');
        setTplDesc(`Estrutura gerada por IA para ${aiIdea.slice(0, 50)}`);
        setTplFilename(`${aiIdea.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}.md`);
        setTplContent(res.data.response || res.data.content || '# ' + aiIdea);
      }
    } catch (err) {
      console.error('Erro ao gerar com IA:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!tplTitle.trim()) return;
    const newTpl: TemplateItem = {
      id: tplFilename.replace(/\.md$/, '') || `tpl-${Date.now()}`,
      title: tplTitle,
      category: tplCategory || 'Geral',
      description: tplDesc,
      filename: tplFilename || 'spec.md',
      content: tplContent,
      installed: true
    };
    setTemplates(prev => [...prev, newTpl]);
    setIsModalOpen(false);
  };

  const categories = [
    { key: 'all', label: 'Todos' },
    { key: 'Domain-Driven Design', label: 'DDD & Domínio' },
    { key: 'BDD', label: 'BDD & Specs' },
    { key: 'FinTech', label: 'FinTech & PIX' },
    { key: 'Event-Driven', label: 'Event-Driven / Kafka' },
    { key: 'Qualidade', label: 'QA & Testes' },
    { key: 'AI Agents', label: 'IA & Agentes' }
  ];

  const filteredTemplates = templates.filter(tpl => {
    const matchesTab = activeTab === 'store' || tpl.installed;
    const matchesCat = activeCategory === 'all' || tpl.category?.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tpl.description && tpl.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesCat && matchesSearch;
  });

  return (
    <div id="subview-templates" className="dash-subview" style={{ display: 'block', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="templates-view-wrapper">
        <div className="template-store-header">
          <div className="templates-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Template Store & Catálogo</h2>
              <p className="subtitle">
                Descubra packs arquiteturais da comunidade e instale templates padrão diretamente no seu projeto.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="btn-open-new-template"
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => {
                  setAiIdea('');
                  setTplTitle('');
                  setTplCategory('');
                  setTplDesc('');
                  setTplFilename('');
                  setTplAssistant('');
                  setTplContent('');
                  setIsModalOpen(true);
                }}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Criar Template
              </button>
              <button
                id="btn-open-tpl-ai-direct"
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => {
                  setAiIdea('');
                  setIsModalOpen(true);
                }}
              >
                <span className="material-symbols-outlined icon-xs">auto_awesome</span>
                Gerar com IA
              </button>
            </div>
          </div>

          {/* Store Tabs */}
          <div className="template-store-tabs" role="tablist">
            <button
              className={`store-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
              id="tab-store-all"
              type="button"
              role="tab"
              aria-selected={activeTab === 'store'}
              onClick={() => setActiveTab('store')}
            >
              Catálogo & Comunidade
            </button>
            <button
              className={`store-tab-btn ${activeTab === 'project' ? 'active' : ''}`}
              id="tab-store-project"
              type="button"
              role="tab"
              aria-selected={activeTab === 'project'}
              onClick={() => setActiveTab('project')}
            >
              Instalados no Projeto (<span id="count-installed-tpls">{templates.filter(t => t.installed).length}</span>)
            </button>
          </div>

          {/* Filter Bar & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div className="store-filter-bar" id="store-category-filters">
              {categories.map(c => (
                <button
                  key={c.key}
                  className={`store-filter-chip ${activeCategory === c.key ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveCategory(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div style={{ minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <input
                type="text"
                id="store-search-input"
                placeholder="Buscar template ou pack..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: '16px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Grid de Templates */}
        <div id="templates-grid-container" className="templates-cards-grid">
          {isLoading ? (
            <div className="loading-state">Carregando templates da Store...</div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum template encontrado com os filtros atuais.
            </div>
          ) : (
            filteredTemplates.map(tpl => (
              <div key={tpl.id} className="template-card">
                <div className="template-card-header">
                  <span className="badge badge-primary-subtle" style={{ fontSize: '10px' }}>
                    {tpl.category || 'Arquitetura'}
                  </span>
                  {tpl.installed && (
                    <span className="badge badge-success-subtle" style={{ fontSize: '10px' }}>
                      Instalado
                    </span>
                  )}
                </div>
                <h3 className="template-card-title">{tpl.title}</h3>
                <p className="template-card-desc">{tpl.description}</p>
                <div className="template-card-footer">
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    style={{ width: '100%' }}
                    onClick={() => handleUseTemplate(tpl)}
                  >
                    Usar este Template
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Editor & Criador de Templates com IA */}
      {isModalOpen && (
        <div id="template-editor-modal" className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '720px', maxHeight: '90vh' }}>
            <div className="modal-header">
              <div>
                <h3 id="tpl-modal-title">Novo Template</h3>
                <span className="subtitle">Defina a estrutura Markdown e o Assistente de IA especialista</span>
              </div>
              <button id="btn-close-tpl-modal" className="btn-close" aria-label="Fechar" type="button" onClick={() => setIsModalOpen(false)}>
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>

            <div className="modal-body" style={{ gap: '14px' }}>
              {/* AI Generator Box */}
              <div className="card" style={{ background: 'var(--bg-subtle)', border: '1px solid #b3d4ff', padding: '12px', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                    Assistente Criador de Templates (IA)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    id="tpl-ai-idea-input"
                    placeholder="Descreva a ideia (ex: Contrato de Integração de Webhooks, SLA de Mensageria, etc.)..."
                    style={{ flex: 1, fontSize: '12.5px' }}
                    value={aiIdea}
                    onChange={e => setAiIdea(e.target.value)}
                  />
                  <button
                    id="btn-generate-tpl-ai"
                    className="btn btn-primary btn-sm"
                    type="button"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={handleGenerateWithAI}
                    disabled={isGeneratingAI || !aiIdea.trim()}
                  >
                    {isGeneratingAI ? 'Gerando...' : 'Gerar com IA'}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label htmlFor="tpl-title-input">Título do Template:</label>
                  <input
                    type="text"
                    id="tpl-title-input"
                    placeholder="ex: Contratos de API & Webhooks"
                    value={tplTitle}
                    onChange={e => setTplTitle(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="tpl-category-input">Categoria:</label>
                  <input
                    type="text"
                    id="tpl-category-input"
                    placeholder="ex: Integração"
                    value={tplCategory}
                    onChange={e => setTplCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label htmlFor="tpl-desc-input">Descrição Resumida:</label>
                  <input
                    type="text"
                    id="tpl-desc-input"
                    placeholder="ex: Padrão formal para payloads e eventos de webhook."
                    value={tplDesc}
                    onChange={e => setTplDesc(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="tpl-filename-input">Nome de Arquivo:</label>
                  <input
                    type="text"
                    id="tpl-filename-input"
                    placeholder="ex: webhooks.md"
                    value={tplFilename}
                    onChange={e => setTplFilename(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tpl-assistant-input">
                  Assistente de IA Específico deste Template (Prompt de Sistema):
                </label>
                <textarea
                  id="tpl-assistant-input"
                  rows={3}
                  placeholder="Instrução para a IA ao lidar com este documento..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={tplAssistant}
                  onChange={e => setTplAssistant(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="tpl-content-input">Estrutura do Template (Markdown):</label>
                <textarea
                  id="tpl-content-input"
                  rows={8}
                  placeholder="# Título do Documento..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.5 }}
                  value={tplContent}
                  onChange={e => setTplContent(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button id="btn-cancel-tpl-modal" className="btn btn-ghost btn-sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button id="btn-save-tpl-modal" className="btn btn-primary btn-sm" type="button" onClick={handleSaveTemplate} disabled={!tplTitle.trim()}>
                  Salvar Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

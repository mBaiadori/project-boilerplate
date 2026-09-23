import React, { useState, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAI } from '../../context/AIContext';
import { API } from '../../services/api';

const CATEGORY_META: Record<string, { label: string; short: string; badge: string; icon: string; color: string; bg: string; desc: string }> = {
  decisions: {
    label: 'Decisões Arquiteturais',
    short: 'Decisões',
    badge: 'ADR',
    icon: 'account_balance',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.08)',
    desc: 'Decisões técnicas e escolhas de arquitetura que definem a stack e contratos.'
  },
  _rules: {
    label: 'Regras & Invariantes',
    short: 'Regras',
    badge: 'REGRA',
    icon: 'shield',
    color: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.08)',
    desc: 'Políticas inegociáveis de segurança, dados e qualidade seguidas em todo prompt.'
  },
  concepts: {
    label: 'Conceitos & Domínio',
    short: 'Conceitos',
    badge: 'CONCEITO',
    icon: 'extension',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    desc: 'Glossário ubíquo, regras de negócio e limites de contexto do produto.'
  },
  gotchas: {
    label: 'Gotchas & Armadilhas',
    short: 'Gotchas',
    badge: 'GOTCHA',
    icon: 'warning',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.08)',
    desc: 'Bugs conhecidos, armadilhas de libs e comportamentos não óbvios documentados.'
  },
  handoffs: {
    label: 'Handoffs de Sessão',
    short: 'Handoffs',
    badge: 'HANDOFF',
    icon: 'history_edu',
    color: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.08)',
    desc: 'Passagens de bastão de contexto compiladas para continuidade entre agentes.'
  }
};

const STARTER_TEMPLATES = [
  {
    category: 'decisions',
    title: 'ADR 0001: Autenticação Stateless e Segurança',
    slug: '0001-autenticacao-stateless',
    content: `## Contexto & Motivação\nA aplicação necessita de um mecanismo de autenticação seguro, escalável horizontalmente e compatível com microserviços e mobile.\n\n## Decisão Tomada\nAdotamos autenticação stateless baseada em **JWT (JSON Web Tokens)** assinados com chaves assimétricas **RSA-256 (RS256)**:\n- Tokens de acesso com TTL curto (15 minutos).\n- Refresh tokens armazenados em cookies seguros com flags \`HttpOnly\`, \`Secure\` e \`SameSite=Strict\`.\n\n## Consequências & Invariantes\n- Nenhum estado de sessão é mantido na memória dos nós de aplicação.\n- Toda rota autenticada valida a assinatura do token localmente via chave pública.`
  },
  {
    category: '_rules',
    title: 'Regra de Governança: Conformidade LGPD & Logs Sanitizados',
    slug: 'regra-lgpd-sanitizacao-logs',
    content: `## Propósito\nGarantir que nenhum dado pessoal sensível (PII), chaves de API, senhas ou tokens trafeguem ou sejam persistidos em logs abertos.\n\n## Invariantes Obrigatórias\n1. **Sanitização Automática:** Todos os logs e transcrições passam por filtros de expressão regular antes de gravação no Git.\n2. **Sem Credenciais no Código:** Segredos devem ser injetados exclusivamente via variáveis de ambiente ou Infisical.\n3. **Auditoria:** Apenas identificadores anônimos (UUID) podem ser indexados em métricas públicas.`
  }
];

interface WikiEntry {
  category: string;
  slug: string;
  title: string;
  content: string;
  updated_at?: string;
}

export const WikiSubView: React.FC = () => {
  const { activeRepo } = useWorkspace();
  const { setDynamicContext } = useAI();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WikiEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Edit / Create State
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<string>('decisions');
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editContent, setEditContent] = useState('');

  const loadWikiEntries = useCallback(async () => {
    if (!activeRepo) return;
    setIsLoading(true);
    try {
      const res = await API.getMemoryWiki({ repo: activeRepo.name, query: searchQuery });
      if (res.ok && res.data) {
        const rawEntries: WikiEntry[] = res.data.entries || [];
        setEntries(rawEntries);
        if (rawEntries.length > 0 && !activeEntry) {
          setActiveEntry(rawEntries[0]);
        }
      }
    } catch (err) {
      console.error('[WikiSubView] Erro ao carregar wiki:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRepo, searchQuery, activeEntry]);

  useEffect(() => {
    loadWikiEntries();
  }, [loadWikiEntries]);

  useEffect(() => {
    if (activeEntry) {
      setDynamicContext({
        filePath: `wiki/${activeEntry.category}/${activeEntry.slug}.md`,
        content: `# ${activeEntry.title}\n\nCategoria: ${activeEntry.category}\n\n${activeEntry.content}`,
        badge: `📖 Wiki: ${activeEntry.title}`
      });
    } else if (entries.length > 0) {
      setDynamicContext({
        filePath: 'wiki/summary.json',
        content: JSON.stringify(entries, null, 2),
        badge: '📖 Base de Conhecimento Wiki'
      });
    }
    return () => {
      setDynamicContext(null);
    };
  }, [activeEntry, entries, setDynamicContext]);

  const handleStartNewEntry = () => {
    setEditCategory(activeCategory === 'all' ? 'decisions' : activeCategory);
    setEditTitle('');
    setEditSlug('');
    setEditContent('');
    setIsEditing(true);
  };

  const handleStartEdit = () => {
    if (!activeEntry) return;
    setEditCategory(activeEntry.category);
    setEditTitle(activeEntry.title);
    setEditSlug(activeEntry.slug);
    setEditContent(activeEntry.content);
    setIsEditing(true);
  };

  const handleSaveEntry = async () => {
    if (!editTitle.trim() || !activeRepo) return;
    const slug = editSlug.trim() || editTitle.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');

    try {
      await API.saveMemoryWikiEntry({
        repo: activeRepo.name,
        category: editCategory,
        slug,
        title: editTitle.trim(),
        content: editContent
      });
      setIsEditing(false);
      const savedEntry: WikiEntry = {
        category: editCategory,
        slug,
        title: editTitle.trim(),
        content: editContent
      };
      setActiveEntry(savedEntry);
      await loadWikiEntries();
    } catch (err) {
      console.error('[WikiSubView] Erro ao salvar entrada:', err);
    }
  };

  const handleDeleteEntry = async () => {
    if (!activeEntry || !activeRepo) return;
    if (window.confirm(`Excluir a entrada "${activeEntry.title}"?`)) {
      try {
        await API.deleteMemoryWikiEntry({
          repo: activeRepo.name,
          category: activeEntry.category,
          slug: activeEntry.slug
        });
        setActiveEntry(null);
        setIsEditing(false);
        await loadWikiEntries();
      } catch (err) {
        console.error('[WikiSubView] Erro ao deletar entrada:', err);
      }
    }
  };

  const handleInstallStarter = async (starter: typeof STARTER_TEMPLATES[0]) => {
    if (!activeRepo) return;
    try {
      await API.saveMemoryWikiEntry({
        repo: activeRepo.name,
        category: starter.category,
        slug: starter.slug,
        title: starter.title,
        content: starter.content
      });
      await loadWikiEntries();
    } catch (err) {
      console.error('Erro ao instalar starter:', err);
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesCategory = activeCategory === 'all' || e.category === activeCategory;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content && e.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (catKey: string) => {
    if (catKey === 'all') return entries.length;
    return entries.filter(e => e.category === catKey).length;
  };

  return (
    <div id="subview-wiki" className="dash-subview" style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div className="wiki-view-wrapper" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg-main, #f8fafc)' }}>
        
        {/* Left Sidebar: Categories, Search & Document List */}
        <aside className="wiki-sidebar" style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card, #ffffff)' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #2563eb)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu_book</span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-heading)' }}>Base de Conhecimento</h2>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Notas, Guias e Decisões da Equipe</span>
                </div>
              </div>
              <button
                id="btn-wiki-new-entry"
                className="btn btn-primary btn-xs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}
                onClick={handleStartNewEntry}
              >
                <span className="material-symbols-outlined icon-xs">add</span> Nova Nota
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span className="material-symbols-outlined icon-xs" style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}>search</span>
              <input
                type="text"
                id="wiki-search-input"
                placeholder="Buscar em todas as notas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '7px 28px 7px 30px', fontSize: '11.5px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-input, #f8fafc)', outline: 'none' }}
              />
              {searchQuery && (
                <button
                  id="btn-wiki-search-clear"
                  type="button"
                  style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  onClick={() => setSearchQuery('')}
                >
                  <span className="material-symbols-outlined icon-xs">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Vertical Category Navigation List */}
          <div style={{ padding: '10px 12px 6px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px' }} id="wiki-category-nav">
            <button
              className={`wiki-nav-btn ${activeCategory === 'all' ? 'active' : ''}`}
              data-cat="all"
              onClick={() => setActiveCategory('all')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', border: 'none', background: activeCategory === 'all' ? 'rgba(37, 99, 235, 0.08)' : 'transparent', color: activeCategory === 'all' ? 'var(--primary, #2563eb)' : 'var(--text-body)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>library_books</span>
                <span>Todas as Notas</span>
              </div>
              <span id="count-all" className="badge-count" style={{ fontSize: '10.5px', background: '#e2e8f0', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                {getCategoryCount('all')}
              </span>
            </button>

            {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
              const count = getCategoryCount(catKey);
              const isActive = activeCategory === catKey;
              return (
                <button
                  key={catKey}
                  className={`wiki-nav-btn ${isActive ? 'active' : ''}`}
                  data-cat={catKey}
                  onClick={() => setActiveCategory(catKey)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: '6px', border: 'none', background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent', color: isActive ? 'var(--primary, #2563eb)' : 'var(--text-body)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: meta.color }}>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <span id={`count-${catKey}`} className="badge-count" style={{ fontSize: '10.5px', background: '#e2e8f0', padding: '1px 6px', borderRadius: '10px' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List of Entries Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {isLoading ? (
              <div className="loading-state" style={{ padding: '16px' }}>Carregando notas...</div>
            ) : filteredEntries.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Nenhuma nota encontrada.
              </div>
            ) : (
              filteredEntries.map(entry => {
                const isSelected = activeEntry?.slug === entry.slug && activeEntry?.category === entry.category;
                const meta = CATEGORY_META[entry.category] || CATEGORY_META.decisions;
                return (
                  <div
                    key={`${entry.category}-${entry.slug}`}
                    className={`wiki-entry-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setActiveEntry(entry);
                      setIsEditing(false);
                    }}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      borderLeft: isSelected ? '3px solid var(--primary, #2563eb)' : '3px solid transparent',
                      background: isSelected ? 'var(--bg-hover, #f1f5f9)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span className="badge" style={{ background: meta.color, color: '#fff', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>
                        {meta.badge}
                      </span>
                    </div>
                    <strong style={{ fontSize: '12.5px', color: 'var(--text-heading)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.title}
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {entry.slug}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Reader / Editor Pane */}
        <main style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '24px 36px', background: '#ffffff' }}>
          {isEditing ? (
            /* Edit / Create Mode */
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  {activeEntry ? 'Editar Nota do Wiki' : 'Nova Nota no Wiki'}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary btn-sm" type="button" onClick={handleSaveEntry} disabled={!editTitle.trim()}>
                    Salvar Nota
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Categoria:</label>
                <select className="form-select" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Título da Nota:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: ADR 0002: Cache Distribuído com Redis"
                  value={editTitle}
                  onChange={e => {
                    setEditTitle(e.target.value);
                    if (!editSlug) {
                      setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, '-'));
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label>Slug:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: 0002-cache-redis"
                  value={editSlug}
                  onChange={e => setEditSlug(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Conteúdo Markdown:</label>
                <textarea
                  rows={14}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.6 }}
                  placeholder="## Contexto & Decisão..."
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
              </div>
            </div>
          ) : activeEntry ? (
            /* View / Reader Mode */
            <div style={{ maxWidth: '850px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="badge"
                    style={{
                      background: CATEGORY_META[activeEntry.category]?.color || '#2563eb',
                      color: '#fff',
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    {CATEGORY_META[activeEntry.category]?.badge || 'WIKI'}
                  </span>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)' }}>
                    {activeEntry.title}
                  </h1>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary btn-xs"
                    type="button"
                    title="Editar Nota"
                    onClick={handleStartEdit}
                  >
                    <span className="material-symbols-outlined icon-xs">edit</span> Editar
                  </button>
                  <button
                    className="btn btn-secondary btn-xs"
                    type="button"
                    title="Copiar Markdown"
                    onClick={() => navigator.clipboard.writeText(activeEntry.content)}
                  >
                    <span className="material-symbols-outlined icon-xs">content_copy</span> Copiar
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    type="button"
                    title="Deletar Nota"
                    onClick={handleDeleteEntry}
                    style={{ color: '#ef4444' }}
                  >
                    <span className="material-symbols-outlined icon-xs">delete</span>
                  </button>
                </div>
              </div>

              <article
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: marked.parse(activeEntry.content || '') as string }}
                style={{ fontSize: '14.5px', lineHeight: 1.7 }}
              />
            </div>
          ) : (
            /* Empty State */
            <div style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 16px auto' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu_book</span>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 600 }}>Wiki & Memória Contínua</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Esta base armazena o conhecimento vivo de arquitetura, invariantes e ADRs sincronizadas diretamente no Git sob <code>.spec-memory/</code>.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {STARTER_TEMPLATES.map((starter, i) => (
                  <button
                    key={i}
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => handleInstallStarter(starter)}
                  >
                    + Adicionar {starter.title.split(':')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

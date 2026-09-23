import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTemplate } from '../../hooks/useTemplate';
import type { TemplateItem } from '../../types';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user selects a project/merged template */
  onSelect: (template: TemplateItem) => void;
}

type TabMode = 'projeto' | 'comunidade';

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { templates, communityTemplates, loading, importingId, error, fetchTemplates, fetchCommunityTemplates, importFromCommunity } = useTemplate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [tab, setTab] = useState<TabMode>('projeto');
  const [importFeedback, setImportFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchCommunityTemplates();
      setSearch('');
      setActiveCategory('Todos');
      setTab('projeto');
      setImportFeedback(null);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen, fetchTemplates, fetchCommunityTemplates]);

  // Active list depending on tab
  const activeList = tab === 'comunidade' ? communityTemplates : templates;

  // Derive unique categories from active list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    activeList.forEach((t) => { if (t.category) cats.add(t.category); });
    return ['Todos', ...Array.from(cats).sort()];
  }, [activeList]);

  // Filter by search and category
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeList.filter((t) => {
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory =
        activeCategory === 'Todos' || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeList, search, activeCategory]);

  const handleImport = async (tpl: TemplateItem) => {
    const result = await importFromCommunity(tpl.id);
    setImportFeedback({ id: tpl.id, ok: result.success, msg: result.message });
    if (result.success) {
      // Auto-switch to project tab to show it
      setTimeout(() => { setTab('projeto'); setImportFeedback(null); }, 1400);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="template-picker-modal" className="modal-backdrop" style={{ display: 'flex', zIndex: 1100 }}>
      <div
        className="modal-box"
        style={{ maxWidth: '700px', width: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="modal-header">
          <div>
            <h3>Escolher Template</h3>
            <span className="subtitle">Selecione um template ou importe da comunidade</span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-outline-variant)', paddingInline: '20px' }}>
          {(['projeto', 'comunidade'] as TabMode[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setActiveCategory('Todos'); setSearch(''); }}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                color: tab === t ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
                textTransform: 'capitalize',
              }}
            >
              {t === 'projeto' ? `📁 Projeto (${templates.length})` : `🌐 Comunidade (${communityTemplates.length})`}
            </button>
          ))}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '16px', color: 'var(--color-outline)', pointerEvents: 'none',
            }}>search</span>
            <input
              ref={searchRef}
              id="template-picker-search"
              type="text"
              className="form-input"
              placeholder="Pesquisar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>
        </div>

        {/* ── Category chips ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: '6px', padding: '10px 20px',
          borderBottom: '1px solid var(--color-outline-variant)',
          overflowX: 'auto', flexShrink: 0,
        }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '4px 12px', borderRadius: '999px', border: '1px solid',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                background: activeCategory === cat ? 'var(--color-primary)' : 'transparent',
                color: activeCategory === cat ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                borderColor: activeCategory === cat ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Template list ──────────────────────────────────────────────── */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', gap: '8px', flexDirection: 'column' }}>

          {/* Comunidade info banner */}
          {tab === 'comunidade' && (
            <div style={{
              padding: '8px 12px', borderRadius: '8px', marginBottom: '4px',
              background: 'var(--color-secondary-container)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-secondary)', flexShrink: 0 }}>info</span>
              <span style={{ fontSize: '11px', color: 'var(--color-on-secondary-container)' }}>
                Templates da comunidade são somente-leitura. Importe-os para o projeto para poder usá-los no picker.
              </span>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>hourglass_empty</span>
              Carregando templates...
            </div>
          )}

          {error && (
            <div style={{ padding: '16px', color: 'var(--color-error)', background: 'var(--color-error-container)', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>search_off</span>
              Nenhum template encontrado{search ? ` para "${search}"` : ''}.
              {tab === 'comunidade' && !search && (
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                  Nenhum template disponível na biblioteca da comunidade.
                </p>
              )}
            </div>
          )}

          {!loading && filtered.map((tpl) => {
            const isImporting = importingId === tpl.id;
            const feedback = importFeedback?.id === tpl.id ? importFeedback : null;
            const alreadyImported = tab === 'comunidade' && templates.some(t => t.id === tpl.id);

            return (
              <div
                key={tpl.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)',
                  background: 'var(--color-surface-container)',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                  background: 'var(--color-secondary-container)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-secondary)' }}>description</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface)' }}>{tpl.title}</span>
                    {tpl.badge && (
                      <span style={{
                        fontSize: '10px', padding: '1px 7px', borderRadius: '999px',
                        background: tpl.source === 'community' ? 'var(--color-tertiary-container)' : 'var(--color-secondary-container)',
                        color: tpl.source === 'community' ? 'var(--color-tertiary)' : 'var(--color-secondary)',
                        fontWeight: 600,
                      }}>{tpl.badge}</span>
                    )}
                    {alreadyImported && (
                      <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', background: 'var(--color-primary-container)', color: 'var(--color-primary)', fontWeight: 600 }}>
                        ✓ Importado
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)', lineHeight: 1.4 }}>{tpl.description}</p>
                  {(tpl.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {(tpl.tags || []).slice(0, 5).map((tag) => (
                        <span key={tag} style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                          background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)',
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {feedback && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: feedback.ok ? 'var(--color-primary)' : 'var(--color-error)' }}>
                      {feedback.ok ? '✓' : '✗'} {feedback.msg}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  {tab === 'projeto' ? (
                    <button
                      id={`btn-select-tpl-${tpl.id}`}
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => { onSelect(tpl); onClose(); }}
                    >
                      Usar
                    </button>
                  ) : (
                    <button
                      id={`btn-import-tpl-${tpl.id}`}
                      type="button"
                      className={`btn btn-sm ${alreadyImported ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={isImporting}
                      onClick={() => handleImport(tpl)}
                    >
                      {isImporting ? '...' : alreadyImported ? 'Reimportar' : 'Importar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
            {filtered.length} template{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

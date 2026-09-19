import React, { useState, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import type { TutorialItem } from '../../types';
import { API } from '../../services/api';

interface TutorialsSubViewProps {
  onOpenEditor?: () => void;
}

export const TutorialsSubView: React.FC<TutorialsSubViewProps> = ({ onOpenEditor }) => {
  const [tutorials, setTutorials] = useState<TutorialItem[]>([]);
  const [activeTutorialIndex, setActiveTutorialIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadTutorials = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getTutorials();
      if (res && Array.isArray(res.tutorials)) {
        setTutorials(res.tutorials);
      }
    } catch (err) {
      console.error('[TutorialsSubView] Erro ao carregar tutoriais:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTutorials();
  }, [loadTutorials]);

  const filteredTutorials = tutorials.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeTutorial = filteredTutorials[activeTutorialIndex] || filteredTutorials[0] || tutorials[0];

  const renderContent = () => {
    if (!activeTutorial) return { __html: '<p>Nenhum guia selecionado.</p>' };
    try {
      return { __html: marked.parse(activeTutorial.content || '') as string };
    } catch (e) {
      return { __html: '<p>Erro ao formatar conteúdo.</p>' };
    }
  };

  const handlePrev = () => {
    if (activeTutorialIndex > 0) {
      setActiveTutorialIndex(activeTutorialIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeTutorialIndex < filteredTutorials.length - 1) {
      setActiveTutorialIndex(activeTutorialIndex + 1);
    }
  };

  return (
    <div id="subview-tutorials" className="dash-subview" style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div className="tutorials-workbench-layout">
        {/* Left Sidebar: Tutorials Index */}
        <aside className="tutorials-sidebar-pane">
          <div className="tutorials-sidebar-header">
            <div className="tutorials-title-wrap">
              <span className="tutorials-main-title">Guia & Tutoriais</span>
              <span className="tutorials-badge-count" id="tutorials-total-count">
                {tutorials.length} tópicos
              </span>
            </div>
            <p className="tutorials-subtitle">
              DDD, SDD, BDD, TDD e Governança Oficial.
            </p>
            <div className="tree-search-box" style={{ padding: '6px 0 0 0', background: 'transparent', border: 'none' }}>
              <input
                type="text"
                id="tutorials-search-input"
                placeholder="Filtrar tópicos..."
                spellCheck="false"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="tutorials-list-scroll" id="tutorials-list-container">
            {isLoading ? (
              <div className="loading-state">Carregando tutoriais...</div>
            ) : filteredTutorials.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                Nenhum tutorial encontrado.
              </div>
            ) : (
              filteredTutorials.map((tut, idx) => {
                const isActive = (activeTutorial?.id === tut.id);
                return (
                  <div
                    key={tut.id}
                    className={`tutorial-topic-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTutorialIndex(idx)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      background: isActive ? 'var(--bg-hover)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span className="badge badge-primary-subtle" style={{ fontSize: '10px' }}>
                        {tut.badge || tut.category || 'Guia'}
                      </span>
                    </div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-heading)', display: 'block' }}>
                      {tut.title}
                    </strong>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Reader Pane */}
        <main className="tutorials-reader-pane">
          <div className="tutorials-reader-header">
            <div className="tutorials-breadcrumbs">
              <span>Tutoriais</span>
              <span>›</span>
              <span id="tutorial-current-category">{activeTutorial?.category || 'Fundamentos'}</span>
              <span>›</span>
              <strong id="tutorial-current-title">{activeTutorial?.title || 'Guia de Navegação'}</strong>
            </div>
            <div className="tutorials-header-actions">
              <span id="tutorial-read-time" className="pill-dot info">
                <span className="dot"></span> 3 min
              </span>
              {onOpenEditor && (
                <button
                  id="btn-tutorial-open-editor"
                  className="btn btn-secondary btn-sm"
                  title="Praticar / Abrir modelo no Editor"
                  type="button"
                  onClick={onOpenEditor}
                >
                  Praticar no Editor
                </button>
              )}
            </div>
          </div>

          <div className="tutorials-reader-body">
            <article id="tutorial-markdown-content" className="markdown-body" dangerouslySetInnerHTML={renderContent()} />

            {/* Bottom Navigation */}
            <div className="tutorials-footer-nav" style={{ display: 'flex', alignItems: 'center', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              {activeTutorialIndex > 0 && (
                <button
                  id="btn-prev-tutorial"
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={handlePrev}
                >
                  ‹ Tópico Anterior
                </button>
              )}

              {activeTutorialIndex < filteredTutorials.length - 1 && (
                <button
                  id="btn-next-tutorial"
                  className="btn btn-primary btn-sm"
                  type="button"
                  style={{ marginLeft: 'auto' }}
                  onClick={handleNext}
                >
                  Próximo Tópico ›
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

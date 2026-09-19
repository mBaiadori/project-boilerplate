import React, { useState } from 'react';

export type SubViewType = 'editor' | 'dictionary' | 'wiki' | 'templates' | 'prs' | 'settings' | 'tutorials';

interface SidebarNavProps {
  activeView: SubViewType;
  onSelectView: (view: SubViewType) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ activeView, onSelectView }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`dash-sidebar-nav ${isCollapsed ? 'collapsed' : ''}`} id="dash-sidebar-nav">
      <div className="dash-menu">
        <div className="dash-menu-header-row">
          <span className="dash-menu-header">Módulos</span>
          <button
            id="btn-toggle-global-sidebar"
            className="dash-sidebar-toggle-top"
            title={isCollapsed ? "Expandir Menu Lateral" : "Recolher Menu Lateral"}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <span className="toggle-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </span>
          </button>
        </div>

        {/* 1. Editor */}
        <button
          className={`dash-nav-item ${activeView === 'editor' ? 'active' : ''}`}
          data-view="editor"
          title="Documentos & Especificações"
          onClick={() => onSelectView('editor')}
        >
          <svg className="nav-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span className="nav-label">Documentos</span>
        </button>

        {/* 2. Dicionário */}
        <button
          className={`dash-nav-item ${activeView === 'dictionary' ? 'active' : ''}`}
          data-view="dictionary"
          title="Dicionário Ubíquo & Vocabulário Oficial"
          onClick={() => onSelectView('dictionary')}
        >
          <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="4"></rect>
            <path d="m8 16 4-8 4 8"></path>
            <path d="M9.5 13h5"></path>
          </svg>
          <span className="nav-label">Dicionário</span>
        </button>

        {/* 3. Wiki */}
        <button
          className={`dash-nav-item ${activeView === 'wiki' ? 'active' : ''}`}
          data-view="wiki"
          title="Wiki de Conhecimento & Decisões da IA (Padrão Karpathy LLM-Wiki)"
          onClick={() => onSelectView('wiki')}
        >
          <svg className="nav-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span className="nav-label">Wiki IA</span>
        </button>

        {/* 4. Templates */}
        <button
          className={`dash-nav-item ${activeView === 'templates' ? 'active' : ''}`}
          data-view="templates"
          title="Catálogo de Templates & Assistentes de IA"
          onClick={() => onSelectView('templates')}
        >
          <span className="material-symbols-outlined nav-icon" style={{ fontSize: '21px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            auto_stories
          </span>
          <span className="nav-label">Templates</span>
        </button>

        {/* 5. PRs */}
        <button
          className={`dash-nav-item ${activeView === 'prs' ? 'active' : ''}`}
          data-view="prs"
          title="Pull Requests & Auditoria"
          onClick={() => onSelectView('prs')}
        >
          <svg className="nav-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
            <line x1="6" y1="9" x2="6" y2="21"></line>
          </svg>
          <span className="nav-label">Pull Requests</span>
        </button>

        {/* 6. Settings */}
        <button
          className={`dash-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          data-view="settings"
          title="Configurações Sistêmicas & Prompts Mestre"
          onClick={() => onSelectView('settings')}
        >
          <svg className="nav-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span className="nav-label">Configurações</span>
        </button>

        {/* 7. Tutoriais */}
        <button
          className={`dash-nav-item ${activeView === 'tutorials' ? 'active' : ''}`}
          data-view="tutorials"
          title="Guia & Tutoriais: DDD, SDD, BDD, TDD"
          onClick={() => onSelectView('tutorials')}
        >
          <span className="material-symbols-outlined nav-icon" style={{ fontSize: '21px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            school
          </span>
          <span className="nav-label">Tutoriais</span>
        </button>
      </div>

      <div className="dash-sidebar-footer">
        <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', textAlign: 'center' }}>
          Context OS
        </span>
      </div>
    </aside>
  );
};

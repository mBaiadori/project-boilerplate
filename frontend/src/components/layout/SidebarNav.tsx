import React, { useState } from "react";

export type SubViewType =
  | "editor"
  | "edits"
  | "versions"
  | "dictionary"
  | "wiki"
  | "templates"
  | "skills"
  | "aicenter"
  | "prs"
  | "settings";

interface SidebarNavProps {
  activeView: SubViewType;
  onSelectView: (view: SubViewType) => void;
  hasUnreadWhatsNew?: boolean;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeView,
  onSelectView,
  hasUnreadWhatsNew = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`dash-sidebar-nav ${isCollapsed ? "collapsed" : ""}`}
      id="dash-sidebar-nav"
    >
      <div className="dash-menu">
        <div className="dash-menu-header-row">
          <span className="dash-menu-header">Módulos</span>
          <button
            id="btn-toggle-global-sidebar"
            className="dash-sidebar-toggle-top"
            title={
              isCollapsed ? "Expandir Menu Lateral" : "Recolher Menu Lateral"
            }
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <span className="toggle-arrow">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </span>
          </button>
        </div>

        {/* 1. Documentos */}
        <button
          className={`dash-nav-item ${activeView === "editor" ? "active" : ""}`}
          data-view="editor"
          title="Documentos & Editor"
          onClick={() => onSelectView("editor")}
        >
          <svg
            className="nav-icon"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span className="nav-label">Documentos</span>
        </button>

        {/* 2. Edições */}
        <button
          className={`dash-nav-item ${activeView === "edits" || activeView === "versions" ? "active" : ""}`}
          data-view="edits"
          title="Central de Edições"
          onClick={() => onSelectView("edits")}
          style={{ position: "relative" }}
        >
          <span
            className="material-symbols-outlined nav-icon"
            style={{
              fontSize: "21px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            history_edu
          </span>
          <span className="nav-label">Edições</span>
          {hasUnreadWhatsNew && (
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                right: "14px",
              }}
              title="Novidades não visualizadas!"
            />
          )}
        </button>

        {/* 3. Templates */}
        <button
          className={`dash-nav-item ${activeView === "templates" ? "active" : ""}`}
          data-view="templates"
          title="Templates & Assistentes de Documentos"
          onClick={() => onSelectView("templates")}
        >
          <span
            className="material-symbols-outlined nav-icon"
            style={{
              fontSize: "21px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            auto_stories
          </span>
          <span className="nav-label">Templates</span>
        </button>

        {/* 4. AI Center (Skills, Personas, Tools, MCP) */}
        <button
          className={`dash-nav-item ${activeView === "aicenter" || activeView === "skills" ? "active" : ""}`}
          data-view="aicenter"
          title="AI Center: Skills, Personas, Ferramentas Nativas & MCP"
          onClick={() => onSelectView("aicenter")}
        >
          <span
            className="material-symbols-outlined nav-icon"
            style={{
              fontSize: "21px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            psychology
          </span>
          <span className="nav-label">AI Center</span>
        </button>

        {/* 3. Revisões & Propostas de Evolução */}
        <button
          className={`dash-nav-item ${activeView === "prs" ? "active" : ""}`}
          data-view="prs"
          title="Revisões e Propostas de Evolução da Documentação"
          onClick={() => onSelectView("prs")}
        >
          <span
            className="material-symbols-outlined nav-icon"
            style={{
              fontSize: "21px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            rate_review
          </span>
          <span className="nav-label">Revisões</span>
        </button>

        {/* 6. Base de Conhecimento / Wiki */}
        <button
          className={`dash-nav-item ${activeView === "wiki" ? "active" : ""}`}
          data-view="wiki"
          title="Base de Conhecimento & Decisões"
          onClick={() => onSelectView("wiki")}
        >
          <svg
            className="nav-icon"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span className="nav-label">Conhecimento</span>
        </button>

        {/* 7. Dicionário Ubíquo */}
        <button
          className={`dash-nav-item ${activeView === "dictionary" ? "active" : ""}`}
          data-view="dictionary"
          title="Dicionário Ubíquo & Vocabulário Oficial"
          onClick={() => onSelectView("dictionary")}
        >
          <span
            className="material-symbols-outlined nav-icon"
            style={{
              fontSize: "21px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            spellcheck
          </span>
          <span className="nav-label">Dicionário</span>
        </button>

        {/* 5. Configurações */}
        <button
          className={`dash-nav-item ${activeView === "settings" ? "active" : ""}`}
          data-view="settings"
          title="Configurações do Projeto, Equipe & IA"
          onClick={() => onSelectView("settings")}
        >
          <svg
            className="nav-icon"
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span className="nav-label">Configurações</span>
        </button>
      </div>

      <div className="dash-sidebar-footer">
        <span
          style={{
            fontSize: "10.5px",
            color: "var(--text-dim)",
            textAlign: "center",
          }}
        >
          Context OS
        </span>
      </div>
    </aside>
  );
};

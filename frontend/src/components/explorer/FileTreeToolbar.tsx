import React, { memo } from "react";
import {
  Search,
  X,
  FolderGit2,
  FilePlus,
  FolderPlus,
  Upload,
  Laptop,
  ChevronsUpDown,
  ChevronsDownUp,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import type { Repo } from "../../types";

interface FileTreeToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedFolder: string;
  activeRepo: Repo | null;
  isTreeLoading: boolean;
  onCreateRootRepo: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onImportFile: () => void;
  onOpenInOS: (e: React.MouseEvent) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefreshAll: () => void;
  onToggleCollapse: () => void;
}

export const FileTreeToolbar: React.FC<FileTreeToolbarProps> = memo(({
  searchTerm,
  onSearchChange,
  selectedFolder,
  activeRepo,
  isTreeLoading,
  onCreateRootRepo,
  onNewFile,
  onNewFolder,
  onImportFile,
  onOpenInOS,
  onExpandAll,
  onCollapseAll,
  onRefreshAll,
  onToggleCollapse,
}) => {
  const selectedFolderName = selectedFolder
    ? selectedFolder.split("/").pop() || selectedFolder
    : "";

  return (
    <div
      className="tree-top-container"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Input Bar */}
      <div className="tree-search-wrapper">
        <span className="tree-search-icon">
          <Search size={13} color="#94a3b8" />
        </span>
        <input
          type="text"
          id="tree-search-input"
          className="tree-search-input"
          placeholder="Buscar arquivos..."
          spellCheck="false"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button
            className="tree-search-clear"
            title="Limpar busca"
            onClick={() => onSearchChange("")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Action Toolbar Below Search Bar */}
      <div className="tree-toolbar-row">
        <div className="tree-toolbar-icons">
          {/* Novo Repositório */}
          <button
            id="btn-tree-create-root-repo"
            className="btn-tree-tool btn-tree-tool-repo"
            title="Novo repositório"
            onClick={onCreateRootRepo}
          >
            <FolderGit2 size={14} color="#2563eb" />
          </button>

          {/* Novo Arquivo */}
          <button
            id="btn-tree-new-file"
            className="btn-tree-tool"
            title={
              selectedFolder
                ? `Novo Arquivo em /${selectedFolderName}`
                : activeRepo?.name
                  ? `Novo Arquivo na raiz de ${activeRepo.name}`
                  : "Novo Arquivo no repositório ativo"
            }
            onClick={onNewFile}
          >
            <FilePlus size={14} />
          </button>

          {/* Nova Pasta */}
          <button
            id="btn-tree-new-folder"
            className="btn-tree-tool"
            title={
              selectedFolder
                ? `Nova Pasta em /${selectedFolderName}`
                : activeRepo?.name
                  ? `Nova Pasta na raiz de ${activeRepo.name}`
                  : "Nova Pasta no repositório ativo"
            }
            onClick={onNewFolder}
          >
            <FolderPlus size={14} />
          </button>

          {/* Importar Documentos */}
          <button
            id="btn-tree-import-file"
            className="btn-tree-tool"
            title={
              selectedFolder
                ? `Importar Documentos em /${selectedFolderName}`
                : activeRepo?.name
                  ? `Importar Documentos na raiz de ${activeRepo.name}`
                  : "Importar Documentos"
            }
            onClick={onImportFile}
          >
            <Upload size={13} />
          </button>

          {/* Abrir no PC */}
          <button
            id="btn-tree-open-os"
            className="btn-tree-tool"
            title={
              selectedFolder
                ? `Abrir pasta /${selectedFolderName} no gerenciador de arquivos do PC`
                : activeRepo?.name
                  ? `Abrir repositório "${activeRepo.name}" no gerenciador de arquivos do PC`
                  : "Abrir pasta do projeto no gerenciador de arquivos do PC"
            }
            onClick={onOpenInOS}
          >
            <Laptop size={13} />
          </button>

          {/* Expandir Todas as Pastas e Repositórios */}
          <button
            id="btn-tree-expand-all"
            className="btn-tree-tool"
            title="Expandir Todas as Pastas e Repositórios"
            onClick={onExpandAll}
          >
            <ChevronsUpDown size={14} />
          </button>

          {/* Recolher Todas as Pastas */}
          <button
            id="btn-tree-collapse-all"
            className="btn-tree-tool"
            title="Recolher Todas as Pastas"
            onClick={onCollapseAll}
          >
            <ChevronsDownUp size={14} />
          </button>

          {/* Atualizar Árvore */}
          <button
            id="btn-tree-refresh"
            className={`btn-tree-tool ${isTreeLoading ? "spinning" : ""}`}
            title={
              isTreeLoading ? "Carregando arquivos..." : "Atualizar Árvore"
            }
            onClick={onRefreshAll}
            disabled={isTreeLoading}
          >
            <RefreshCw
              size={13}
              className={isTreeLoading ? "spinning" : ""}
            />
          </button>

          {/* Recolher Painel Lateral */}
          <button
            id="btn-toggle-tree-pane"
            className="btn-tree-tool"
            title="Recolher Painel Lateral"
            onClick={onToggleCollapse}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
      {isTreeLoading && (
        <div
          className="tree-progress-track"
          title="Sincronizando arquivos com o disco..."
        >
          <div className="tree-progress-bar"></div>
        </div>
      )}
    </div>
  );
});

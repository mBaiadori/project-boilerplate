import React from "react";

export interface GitBranchesTabProps {
  currentBranch: string;
  newBranchName: string;
  onNewBranchNameChange: (val: string) => void;
  onCreateBranch: (e: React.FormEvent) => void;
}

export const GitBranchesTab: React.FC<GitBranchesTabProps> = ({
  currentBranch,
  newBranchName,
  onNewBranchNameChange,
  onCreateBranch,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Create Branch Form */}
      <form
        onSubmit={onCreateBranch}
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
          background: "var(--bg-surface)",
        }}
      >
        <h4
          style={{
            margin: "0 0 10px 0",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Criar ou Alternar Trilha de Trabalho
        </h4>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="ex: revisao-politicas ou especificacao-v2"
            value={newBranchName}
            onChange={(e) => onNewBranchNameChange(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!newBranchName.trim()}
          >
            Alternar / Criar Trilha
          </button>
        </div>
      </form>

      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
          background: "var(--bg-surface)",
        }}
      >
        <h4
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Trilha Ativa
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--primary)" }}
          >
            done
          </span>
          <code style={{ fontSize: "14px", fontWeight: 700 }}>
            {currentBranch}
          </code>
          <span className="badge badge-primary-subtle">Em Edição</span>
        </div>
      </div>
    </div>
  );
};

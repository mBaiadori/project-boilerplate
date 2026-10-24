import React from "react";
import type { GitCommitInfo } from "../../../types";

export interface GitHistoryTabProps {
  gitLog: GitCommitInfo[];
}

export const GitHistoryTab: React.FC<GitHistoryTabProps> = ({ gitLog = [] }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {gitLog.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Nenhum marco de publicação registrado no histórico desta trilha.
        </div>
      ) : (
        gitLog.map((commit, idx) => (
          <div
            key={commit?.hash || idx}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "12px 16px",
              background: "var(--bg-surface)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span
                  className="badge badge-neutral"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  #{commit?.shortHash || commit?.hash?.slice(0, 7) || "marco"}
                </span>
                <strong
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-heading)",
                  }}
                >
                  {commit?.message || "Publicação"}
                </strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Publicado por <strong>{commit?.author || "Equipe"}</strong> em{" "}
                {commit?.date || ""}
              </div>
            </div>
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--text-dim)", fontSize: "18px" }}
            >
              history_edu
            </span>
          </div>
        ))
      )}
    </div>
  );
};

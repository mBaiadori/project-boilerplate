import React from "react";
import type { SkillItem } from "../../../../types";

interface SkillDetailDrawerProps {
  selectedSkill: SkillItem | null;
  onClose: () => void;
}

export const SkillDetailDrawer: React.FC<SkillDetailDrawerProps> = ({
  selectedSkill,
  onClose,
}) => {
  if (!selectedSkill) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "580px",
          height: "100%",
          background: "var(--color-surface, #ffffff)",
          color: "var(--color-on-surface, #202124)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              {selectedSkill.title || selectedSkill.name}
            </h3>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                fontFamily: "monospace",
              }}
            >
              id: {selectedSkill.id} • v{selectedSkill.version}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: "4px" }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <h4
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "6px",
            }}
          >
            Descrição
          </h4>
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.5",
              margin: "0 0 16px 0",
            }}
          >
            {selectedSkill.description}
          </p>
          {selectedSkill.content && (
            <div>
              <h4
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Instruções do Agente (SKILL.md)
              </h4>
              <pre
                style={{
                  fontSize: "11.5px",
                  lineHeight: "1.45",
                  fontFamily: "var(--font-mono, monospace)",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--color-surface-container-low, #f8f9fa)",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  whiteSpace: "pre-wrap",
                  overflowX: "auto",
                  maxHeight: "300px",
                }}
              >
                {selectedSkill.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

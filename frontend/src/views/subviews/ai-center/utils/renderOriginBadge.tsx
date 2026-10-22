import React from "react";

export const renderOriginBadge = (source?: string): React.ReactElement => {
  if (source === "system") {
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          padding: "2px 6px",
          borderRadius: "4px",
          background: "rgba(26, 115, 232, 0.12)",
          color: "var(--color-primary, #1a73e8)",
          border: "1px solid rgba(26, 115, 232, 0.25)",
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
        }}
        title="Recurso Nativo do Sistema"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "11px" }}
        >
          verified
        </span>
        Do Sistema
      </span>
    );
  }
  if (source === "project") {
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          padding: "2px 6px",
          borderRadius: "4px",
          background: "rgba(16, 185, 129, 0.12)",
          color: "#10b981",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
        }}
        title="Recurso Customizado do Projeto"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "11px" }}
        >
          folder_special
        </span>
        Do Projeto
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: "4px",
        background: "rgba(147, 51, 234, 0.12)",
        color: "#9333ea",
        border: "1px solid rgba(147, 51, 234, 0.25)",
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
      }}
      title="Catálogo da Comunidade (Licença MIT)"
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: "11px" }}
      >
        groups
      </span>
      Da Comunidade
    </span>
  );
};

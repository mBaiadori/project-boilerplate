import React from "react";
import type { DocumentMetadata } from "../../services/frontmatter";

interface FrontmatterHeaderProps {
  metadata: DocumentMetadata;
  onChange: (updated: DocumentMetadata) => void;
}

export const FrontmatterHeader: React.FC<FrontmatterHeaderProps> = ({
  metadata,
  onChange,
}) => {
  const statusOptions = [
    "draft",
    "proposed",
    "review",
    "approved",
    "superseded",
    "deprecated",
  ];

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...metadata,
      [field]: value,
    });
  };

  return (
    <div
      className="frontmatter-header-box"
      style={{
        background: "var(--color-surface-container-low)",
        border: "1px solid var(--color-outline-variant)",
        borderRadius: "8px",
        padding: "12px 16px",
        marginBottom: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: "var(--color-outline)",
            fontWeight: 700,
          }}
        >
          Metadados Estruturados (Frontmatter)
        </span>
        <span
          className="badge badge-primary-subtle"
          style={{ fontSize: "11px" }}
        >
          {metadata.categories || metadata.category || ""}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-outline)" }}>
            Status:
          </span>
          <select
            className="form-select"
            value={metadata.status || "draft"}
            onChange={(e) => handleFieldChange("status", e.target.value)}
            style={{
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "4px",
            }}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Categoria */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-outline)" }}>
            Categoria:
          </span>
          <input
            type="text"
            className="form-input"
            value={metadata.categories || metadata.category || ""}
            onChange={(e) => handleFieldChange("categories", e.target.value)}
            style={{ fontSize: "12px", width: "110px", padding: "3px 6px" }}
            placeholder="geral..."
          />
        </div>
      </div>
    </div>
  );
};

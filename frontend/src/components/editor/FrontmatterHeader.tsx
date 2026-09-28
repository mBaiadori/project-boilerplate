import React from "react";
import type { DocumentMetadata } from "../../services/frontmatter";
import { Badge, Input } from "../ui";
import { Tag } from "lucide-react";

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

  const categoryLabel = metadata.categories || metadata.category || "";

  return (
    <div
      className="frontmatter-header-box"
      style={{
        background: "var(--color-surface-container-low)",
        border: "1px solid var(--color-outline-variant)",
        borderRadius: "var(--radius-md, 8px)",
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
            letterSpacing: "0.05em",
            color: "var(--color-outline)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Tag size={12} />
          Metadados Estruturados (Frontmatter)
        </span>

        {categoryLabel && (
          <Badge variant="primary" size="sm">
            {categoryLabel}
          </Badge>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-outline)", fontWeight: 600 }}>
            Status:
          </span>
          <select
            value={metadata.status || "draft"}
            onChange={(e) => handleFieldChange("status", e.target.value)}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "var(--radius-md, 6px)",
              border: "1px solid var(--color-outline-variant)",
              background: "var(--color-surface-container)",
              color: "var(--color-on-surface)",
              outline: "none",
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-outline)", fontWeight: 600 }}>
            Categoria:
          </span>
          <div style={{ width: "130px" }}>
            <Input
              value={categoryLabel}
              onChange={(e) => handleFieldChange("categories", e.target.value)}
              placeholder="geral..."
              style={{ fontSize: "12px", padding: "4px 8px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

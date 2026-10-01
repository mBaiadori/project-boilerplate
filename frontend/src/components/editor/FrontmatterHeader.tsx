import React from "react";
import type { DocumentMetadata } from "../../services/frontmatter";
import { Badge, Input } from "../ui";
import { Tag, Shield } from "lucide-react";
import { useSecurity } from "../../context/SecurityContext";

interface FrontmatterHeaderProps {
  metadata: DocumentMetadata;
  onChange: (updated: DocumentMetadata) => void;
}

export const FrontmatterHeader: React.FC<FrontmatterHeaderProps> = ({
  metadata,
  onChange,
}) => {
  const { securityLevels } = useSecurity();

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

  const currentLevelId =
    metadata.security_level_id ||
    (metadata.security_level !== undefined
      ? securityLevels.find((l) => l.rank === Number(metadata.security_level))?.id
      : "public") ||
    "public";

  const activeLevel =
    securityLevels.find((l) => l.id === currentLevelId || l.rank === Number(metadata.security_level)) ||
    securityLevels.find((l) => l.id === "public") ||
    securityLevels[securityLevels.length - 1];

  const handleSecurityLevelChange = (levelId: string) => {
    const chosen = securityLevels.find((l) => l.id === levelId);
    if (chosen) {
      onChange({
        ...metadata,
        security_level_id: chosen.id,
        security_level: chosen.rank,
      });
    }
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {activeLevel && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: activeLevel.color + "15",
                borderColor: activeLevel.color + "40",
                borderWidth: "1px",
                borderStyle: "solid",
                color: activeLevel.color,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Shield size={11} />
              {activeLevel.name}
            </span>
          )}

          {categoryLabel && (
            <Badge variant="primary" size="sm">
              {categoryLabel}
            </Badge>
          )}
        </div>
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

        {/* Nível de Segurança / Acesso */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--color-outline)", fontWeight: 600 }}>
            Segurança:
          </span>
          <select
            value={currentLevelId}
            onChange={(e) => handleSecurityLevelChange(e.target.value)}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "var(--radius-md, 6px)",
              border: "1px solid var(--color-outline-variant)",
              background: "var(--color-surface-container)",
              color: activeLevel?.color || "var(--color-on-surface)",
              fontWeight: 500,
              outline: "none",
            }}
          >
            {securityLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id} style={{ color: "var(--color-on-surface)" }}>
                {lvl.name} (Rank {lvl.rank})
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


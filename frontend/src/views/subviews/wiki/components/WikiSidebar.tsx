import React from "react";
import { BookOpen, Library, Plus } from "lucide-react";
import { Badge, Button, SearchInput, Spinner } from "../../../../components/ui";
import { CATEGORY_META, type WikiEntry } from "../types";

interface WikiSidebarProps {
  onStartNewEntry: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  getCategoryCount: (cat: string) => number;
  isLoading: boolean;
  filteredEntries: WikiEntry[];
  activeEntry: WikiEntry | null;
  onSelectEntry: (entry: WikiEntry) => void;
}

export const WikiSidebar: React.FC<WikiSidebarProps> = ({
  onStartNewEntry,
  searchQuery,
  onSearchChange,
  activeCategory,
  onSelectCategory,
  getCategoryCount,
  isLoading,
  filteredEntries,
  activeEntry,
  onSelectEntry,
}) => {
  return (
    <aside
      style={{
        width: "320px",
        flexShrink: 0,
        borderRight: "1px solid var(--color-outline-variant)",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-container-low)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "var(--radius-md, 8px)",
                background: "var(--color-primary-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-primary)",
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-on-surface)",
                }}
              >
                Base Wiki & Memória
              </h2>
              <span style={{ fontSize: "11px", color: "var(--color-outline)" }}>
                Decisões, Regras e ADRs
              </span>
            </div>
          </div>

          <Button
            id="btn-wiki-new-entry"
            variant="primary"
            size="sm"
            onClick={onStartNewEntry}
            icon={<Plus size={14} />}
          >
            Nova Nota
          </Button>
        </div>

        <SearchInput
          id="wiki-search-input"
          placeholder="Buscar em todas as notas..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
        />
      </div>

      {/* Categories List */}
      <div
        style={{
          padding: "10px 12px 6px 12px",
          borderBottom: "1px solid var(--color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
        id="wiki-category-nav"
      >
        <button
          type="button"
          className={`ui-nav-item ${activeCategory === "all" ? "ui-nav-item--active" : ""}`}
          data-cat="all"
          onClick={() => onSelectCategory("all")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Library size={15} />
            <span>Todas as Notas</span>
          </div>
          <Badge variant="neutral" size="sm">{getCategoryCount("all")}</Badge>
        </button>

        {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
          const count = getCategoryCount(catKey);
          const isActive = activeCategory === catKey;
          return (
            <button
              key={catKey}
              type="button"
              className={`ui-nav-item ${isActive ? "ui-nav-item--active" : ""}`}
              data-cat={catKey}
              onClick={() => onSelectCategory(catKey)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <span>{meta.label}</span>
              </div>
              <Badge variant={meta.badgeVariant} size="sm">{count}</Badge>
            </button>
          );
        })}
      </div>

      {/* Entries List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {isLoading ? (
          <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}>
            <Spinner size="md" message="Carregando notas..." />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--color-outline)",
              fontSize: "12.5px",
            }}
          >
            Nenhuma nota encontrada.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected =
              activeEntry?.slug === entry.slug &&
              activeEntry?.category === entry.category;
            const meta =
              CATEGORY_META[entry.category] || CATEGORY_META.decisions;
            return (
              <div
                key={`${entry.category}-${entry.slug}`}
                onClick={() => onSelectEntry(entry)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md, 8px)",
                  cursor: "pointer",
                  border: isSelected ? "1px solid var(--color-primary)" : "1px solid transparent",
                  background: isSelected
                    ? "var(--color-primary-container)"
                    : "transparent",
                  transition: "all 0.15s ease",
                  marginBottom: "4px",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--color-surface-container)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "4px",
                  }}
                >
                  <Badge variant={meta.badgeVariant} size="sm">
                    {meta.badge}
                  </Badge>
                </div>
                <strong
                  style={{
                    fontSize: "13px",
                    color: "var(--color-on-surface)",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {entry.title}
                </strong>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--color-outline)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {entry.slug}
                </span>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

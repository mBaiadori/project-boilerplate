import React, { useRef, useEffect, useState } from "react";
import { FolderGit2, ChevronDown, Check, Layers } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import type { Repo } from "../../types";

interface RepoSelectorDropdownProps {
  value?: string; // "all" ou nome do repositório
  onChange?: (repoValue: string) => void;
  onSelectRepo?: (repo: Repo) => void;
  repoOpenCounts?: Record<string, number>;
  allowAll?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const RepoSelectorDropdown: React.FC<RepoSelectorDropdownProps> = ({
  value,
  onChange,
  onSelectRepo,
  repoOpenCounts = {},
  allowAll = true,
  className = "",
  style,
}) => {
  const { activeRepo, repos, selectRepo } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!repos || repos.length === 0) return null;

  const isAllSelected = value === "all";
  const currentRepoName = isAllSelected ? "Todos os Repositórios" : (value || activeRepo?.name || "local");

  const totalOpenCount = Object.values(repoOpenCounts).reduce((acc, curr) => acc + (curr || 0), 0);
  const currentOpenCount = isAllSelected ? totalOpenCount : (repoOpenCounts[currentRepoName] || 0);

  const handleSelectRepo = (r: Repo) => {
    selectRepo(r);
    if (onChange) {
      onChange(r.name);
    }
    if (onSelectRepo) {
      onSelectRepo(r);
    }
    setIsOpen(false);
  };

  const handleSelectAll = () => {
    if (onChange) {
      onChange("all");
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex", ...style }}
      className={`repo-selector-container ${className}`}
    >
      <button
        type="button"
        id="btn-prs-repo-selector"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Alternar Repositório ou Ver Todos"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "32px",
          padding: "0 10px 0 8px",
          backgroundColor: isOpen
            ? "var(--md-sys-color-surface-container-high, #e8eaed)"
            : "var(--md-sys-color-surface-container-low, #f8f9fa)",
          borderRadius: "var(--md-shape-corner-full, 9999px)",
          border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
          color: "var(--md-sys-color-on-surface, #202124)",
          fontSize: "12.5px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          userSelect: "none",
          maxWidth: "280px",
        }}
      >
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            backgroundColor: isAllSelected
              ? "rgba(99, 102, 241, 0.15)"
              : "var(--md-sys-color-primary-container, #d2e3fc)",
            color: isAllSelected
              ? "var(--color-primary, #4f46e5)"
              : "var(--md-sys-color-primary, #1a73e8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isAllSelected ? <Layers size={13} /> : <FolderGit2 size={13} />}
        </div>

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}
        >
          {currentRepoName}
        </span>

        {currentOpenCount > 0 && (
          <span
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: "9999px",
              backgroundColor: "rgba(37, 99, 235, 0.12)",
              color: "var(--color-primary, #2563eb)",
              border: "1px solid rgba(37, 99, 235, 0.25)",
              flexShrink: 0,
            }}
          >
            {currentOpenCount} {currentOpenCount === 1 ? "aberta" : "abertas"}
          </span>
        )}

        <ChevronDown
          size={14}
          color="var(--md-sys-color-on-surface-variant, #5f6368)"
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu com a lista de Repositórios */}
      {isOpen && (
        <div
          id="prs-repo-dropdown-menu"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: "260px",
            maxWidth: "320px",
            backgroundColor: "var(--md-sys-color-surface, #ffffff)",
            borderRadius: "var(--md-shape-corner-md, 12px)",
            border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
            boxShadow: "var(--md-sys-elevation-3, 0 10px 25px -5px rgba(0, 0, 0, 0.15))",
            zIndex: 1000,
            padding: "5px",
            overflow: "hidden",
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {allowAll && (
            <>
              <div
                role="option"
                aria-selected={isAllSelected}
                onClick={handleSelectAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: isAllSelected ? 600 : 500,
                  backgroundColor: isAllSelected
                    ? "var(--md-sys-color-primary-container, #d2e3fc)"
                    : "transparent",
                  color: isAllSelected
                    ? "var(--md-sys-color-on-primary-container, #041e49)"
                    : "var(--md-sys-color-on-surface, #202124)",
                  cursor: "pointer",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isAllSelected) {
                    e.currentTarget.style.backgroundColor =
                      "var(--md-sys-color-surface-container-high, #e8eaed)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAllSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers
                    size={15}
                    style={{
                      color: isAllSelected
                        ? "var(--md-sys-color-primary, #1a73e8)"
                        : "var(--md-sys-color-on-surface-variant, #5f6368)",
                    }}
                  />
                  <span>Todos os Repositórios</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {totalOpenCount > 0 && (
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "9999px",
                        backgroundColor: isAllSelected ? "#ffffff" : "rgba(37, 99, 235, 0.12)",
                        color: "var(--color-primary, #2563eb)",
                        border: "1px solid rgba(37, 99, 235, 0.2)",
                      }}
                    >
                      {totalOpenCount}
                    </span>
                  )}
                  {isAllSelected && (
                    <Check
                      size={14}
                      color="var(--md-sys-color-primary, #1a73e8)"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--md-sys-color-outline-variant, #dadce0)",
                  margin: "4px 0",
                }}
              />
            </>
          )}

          <div
            style={{
              padding: "4px 8px 2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--md-sys-color-on-surface-variant, #5f6368)",
            }}
          >
            Repositórios
          </div>

          <div style={{ maxHeight: "220px", overflowY: "auto" }}>
            {repos.map((r) => {
              const isSelected = !isAllSelected && (currentRepoName || "").toLowerCase() === r.name.toLowerCase();
              const count = repoOpenCounts[r.name] || 0;

              return (
                <div
                  key={r.name}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectRepo(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: isSelected ? 600 : 500,
                    backgroundColor: isSelected
                      ? "var(--md-sys-color-primary-container, #d2e3fc)"
                      : "transparent",
                    color: isSelected
                      ? "var(--md-sys-color-on-primary-container, #041e49)"
                      : "var(--md-sys-color-on-surface, #202124)",
                    cursor: "pointer",
                    transition: "background-color 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor =
                        "var(--md-sys-color-surface-container-high, #e8eaed)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <FolderGit2
                      size={15}
                      style={{
                        color: isSelected
                          ? "var(--md-sys-color-primary, #1a73e8)"
                          : "var(--md-sys-color-on-surface-variant, #5f6368)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                      </span>
                      {r.full_name && !r.is_local && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--md-sys-color-on-surface-variant, #747775)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.full_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {count > 0 && (
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "9999px",
                          backgroundColor: isSelected ? "#ffffff" : "rgba(37, 99, 235, 0.12)",
                          color: "var(--color-primary, #2563eb)",
                          border: "1px solid rgba(37, 99, 235, 0.2)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                    {isSelected && (
                      <Check
                        size={14}
                        color="var(--md-sys-color-primary, #1a73e8)"
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

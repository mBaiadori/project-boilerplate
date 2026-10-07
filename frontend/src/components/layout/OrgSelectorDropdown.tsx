import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useOrgUiStore } from "../../stores/orgUiStore";

export const OrgSelectorDropdown: React.FC = () => {
  const { activeOrg, orgs, selectOrg, repos } = useWorkspace();
  const { isOrgDropdownOpen, toggleOrgDropdown, closeOrgDropdown } = useOrgUiStore();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    if (!isOrgDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeOrgDropdown();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOrgDropdown();
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
  }, [isOrgDropdownOpen, closeOrgDropdown]);

  if (!orgs || orgs.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
      className="org-selector-container"
    >
      <button
        type="button"
        id="btn-header-org-selector"
        aria-haspopup="listbox"
        aria-expanded={isOrgDropdownOpen}
        title="Alternar Organização Ativa"
        onClick={toggleOrgDropdown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          height: "32px",
          padding: "0 10px 0 6px",
          backgroundColor: isOrgDropdownOpen
            ? "var(--md-sys-color-surface-container-high, #e8eaed)"
            : "var(--md-sys-color-surface-container-low, #f8f9fa)",
          borderRadius: "var(--md-shape-corner-full, 9999px)",
          border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
          color: "var(--md-sys-color-on-surface, #202124)",
          fontSize: "12.5px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s ease",
          userSelect: "none",
          maxWidth: "200px",
        }}
      >
        {activeOrg?.avatar_url ? (
          <img
            src={activeOrg.avatar_url}
            alt={activeOrg.login}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "var(--md-sys-color-primary-container, #d2e3fc)",
              color: "var(--md-sys-color-primary, #1a73e8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Building2 size={12} />
          </div>
        )}

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}
        >
          {activeOrg?.full_name || activeOrg?.login || "Organização"}
        </span>

        <ChevronDown
          size={14}
          color="var(--md-sys-color-on-surface-variant, #5f6368)"
          style={{
            transform: isOrgDropdownOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu com a lista de Organizações */}
      {isOrgDropdownOpen && (
        <div
          id="header-org-dropdown-menu"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: "220px",
            backgroundColor: "var(--md-sys-color-surface, #ffffff)",
            borderRadius: "var(--md-shape-corner-md, 12px)",
            border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
            boxShadow: "var(--md-sys-elevation-3, 0 10px 25px -5px rgba(0, 0, 0, 0.15))",
            zIndex: 1000,
            padding: "4px",
            overflow: "hidden",
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {orgs.map((o) => {
            const isSelected = (activeOrg?.login || "").toLowerCase() === o.login.toLowerCase();
            return (
              <div
                key={o.login}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  selectOrg(o.login);
                  closeOrgDropdown();
                  const targetRepos = repos.filter((r) => {
                    const owner = (r.owner || (r.full_name ? r.full_name.split("/")[0] : "")).toLowerCase();
                    return owner === o.login.toLowerCase();
                  });
                  if (targetRepos.length > 0) {
                    navigate(`/org/${encodeURIComponent(o.login)}/repo/${encodeURIComponent(targetRepos[0].name)}/editor`);
                  } else if (o.login === "local") {
                    navigate("/repo/local/editor");
                  }
                }}
                style={{
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
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "var(--md-sys-color-surface-container-high, #e8eaed)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {o.avatar_url ? (
                  <img
                    src={o.avatar_url}
                    alt={o.login}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      backgroundColor: isSelected
                        ? "var(--md-sys-color-primary, #1a73e8)"
                        : "var(--md-sys-color-surface-container, #f1f3f4)",
                      color: isSelected ? "#ffffff" : "var(--md-sys-color-on-surface-variant, #5f6368)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={13} />
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    flex: 1,
                    lineHeight: 1.2,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "inherit",
                    }}
                  >
                    {o.full_name || o.login}
                  </span>
                  {o.full_name && o.full_name !== o.login && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: isSelected ? "var(--md-sys-color-primary, #1a73e8)" : "var(--md-sys-color-on-surface-variant, #5f6368)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      @{o.login}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check
                    size={15}
                    style={{
                      color: "var(--md-sys-color-primary, #1a73e8)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

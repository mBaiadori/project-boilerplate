import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, User, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui";

export const AccountSwitcherMenu: React.FC = () => {
  const { t } = useTranslation(["repos", "common", "auth"]);
  const { user, provider, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const providerLabel =
    provider === "forgejo"
      ? "Forgejo"
      : provider === "github"
        ? "GitHub"
        : "Modo Local";

  return (
    <div
      ref={menuRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-account-switcher"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: isOpen
            ? "var(--color-surface-container, #f1f3f4)"
            : "var(--color-surface-container-low, #f8f9fa)",
          border: "1px solid var(--color-outline-variant, #dadce0)",
          borderRadius: "var(--radius-full, 9999px)",
          padding: "4px 12px 4px 6px",
          cursor: "pointer",
          color: "var(--color-on-surface, #202124)",
          transition: "all 0.15s ease",
          boxShadow: "var(--md-sys-elevation-1, 0 1px 2px rgba(0, 0, 0, 0.05))",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--color-outline, #747775)";
          e.currentTarget.style.backgroundColor =
            "var(--color-surface-container, #f1f3f4)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor =
              "var(--color-outline-variant, #dadce0)";
            e.currentTarget.style.backgroundColor =
              "var(--color-surface-container-low, #f8f9fa)";
          }
        }}
      >
        <div style={{ position: "relative" }}>
          {user?.avatar_url ? (
            <img
              id="user-avatar-img"
              src={user.avatar_url}
              alt={user.name || user.login}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1.5px solid var(--color-primary-container, #d2e3fc)",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary-container, #d2e3fc)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-primary, #1a73e8)",
              }}
            >
              <User size={15} />
            </div>
          )}
          <span
            style={{
              position: "absolute",
              bottom: "-1px",
              right: "-1px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              border: "2px solid var(--color-surface, #ffffff)",
            }}
          />
        </div>

        <div
          style={{
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            id="user-name"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1.25,
              color: "var(--color-on-surface, #202124)",
              maxWidth: "140px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.name || user?.login || "Desenvolvedor"}
          </span>
          <span
            id="user-provider"
            style={{
              fontSize: "11px",
              color: "var(--color-on-surface-variant, #5f6368)",
              lineHeight: 1.2,
            }}
          >
            {providerLabel}
          </span>
        </div>

        <ChevronDown
          size={14}
          style={{
            color: "var(--color-on-surface-variant, #5f6368)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            marginLeft: "2px",
          }}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="account-switcher-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: "280px",
            backgroundColor: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-outline-variant, #dadce0)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow:
              "var(--md-sys-elevation-3, 0 10px 28px rgba(0, 0, 0, 0.18))",
            zIndex: 1000,
            overflow: "hidden",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* Header / Active Account Details */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--color-surface-container-low, #f8f9fa)",
              borderBottom: "1px solid var(--color-outline-variant, #dadce0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || user.login}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--color-primary-container, #d2e3fc)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-primary-container, #d2e3fc)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-primary, #1a73e8)",
                  }}
                >
                  <User size={20} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--color-on-surface, #202124)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.name || user?.login}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-on-surface-variant, #5f6368)",
                  }}
                >
                  @{user?.login}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Badge variant="primary" size="sm">
                {providerLabel}
              </Badge>
              {user?.role && (
                <Badge variant="subtle" size="sm">
                  {user.role}
                </Badge>
              )}
            </div>
          </div>

          {/* Action: Logout */}
          <div style={{ padding: "8px" }}>
            <button
              type="button"
              id="btn-logout-menu"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm, 6px)",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--color-error, #d93025)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-error-container, #fce8e6)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
            >
              <LogOut size={16} />
              <span>{t("repos:navLogout", "Desconectar sessão")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

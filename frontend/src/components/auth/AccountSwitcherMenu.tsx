import React from "react";
import { User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const AccountSwitcherMenu: React.FC = () => {
  const { user } = useAuth();

  const displayName = user?.name || user?.login || "Desenvolvedor";
  const username = user?.login ? `@${user.login}` : "";

  return (
    <div
      id="user-profile-badge"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <div style={{ position: "relative" }}>
        {user?.avatar_url ? (
          <img
            id="user-avatar-img"
            src={user.avatar_url}
            alt={displayName}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
              border: "none",
            }}
          />
        ) : (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-container, #d2e3fc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary, #1a73e8)",
              border: "none",
            }}
          >
            <User size={18} />
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
          lineHeight: 1.2,
        }}
      >
        <span
          id="user-name"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--color-on-surface, #202124)",
            maxWidth: "200px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </span>
        {username && (
          <span
            id="user-handle"
            style={{
              fontSize: "12px",
              color: "var(--color-on-surface-variant, #5f6368)",
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {username}
          </span>
        )}
      </div>
    </div>
  );
};

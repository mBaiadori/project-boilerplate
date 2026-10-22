import React from "react";
import { LogOut } from "lucide-react";
import { Button } from "../../../../components/ui";

interface UserSessionSectionProps {
  user: {
    avatar_url?: string;
    name?: string;
    login?: string;
  } | null;
  onLogout: () => void;
}

export const UserSessionSection: React.FC<UserSessionSectionProps> = ({
  user,
  onLogout,
}) => {
  return (
    <section id="user-session" style={{ scrollMarginTop: "72px" }}>
      <div className="ui-panel ui-row ui-row--align-center ui-row--justify-between">
        <div className="ui-row ui-row--align-center ui-row--sm">
          <img
            src={
              user?.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=2563eb&color=fff`
            }
            alt="Avatar"
            className="ui-avatar"
            style={{ width: 34, height: 34, borderRadius: "50%" }}
          />
          <div className="ui-stack ui-stack--xs">
            <strong className="ui-text-title">
              {user?.name || "Usuário Autenticado"}
            </strong>
            <span className="ui-text-caption ui-text-muted">
              @{user?.login || "github"}
            </span>
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          leftIcon={<LogOut size={13} />}
          onClick={onLogout}
        >
          Desconectar
        </Button>
      </div>
    </section>
  );
};

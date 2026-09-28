import React from "react";
import { IconButton } from "./IconButton";
import { ArrowLeft } from "lucide-react";

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  onBack?: () => void;
  backTooltip?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  onBack,
  backTooltip = "Voltar",
  actions,
  icon,
  className = "",
}) => {
  return (
    <div className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header__left">
        {onBack && (
          <IconButton
            bordered
            size="md"
            tooltip={backTooltip}
            onClick={onBack}
          >
            <ArrowLeft size={18} />
          </IconButton>
        )}
        {icon && <div className="ui-page-header__icon">{icon}</div>}
        <div className="ui-page-header__title-wrap">
          <div className="ui-page-header__title-row">
            <h1 className="ui-page-header__title">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="ui-page-header__subtitle">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
};

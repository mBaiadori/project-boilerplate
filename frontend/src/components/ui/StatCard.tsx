import React from "react";

export interface StatCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor,
  iconColor,
  className = "",
  onClick,
}) => {
  return (
    <div
      className={`ui-stat-card ${className}`.trim()}
      style={{ cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      {icon && (
        <div
          className="ui-stat-card__icon-wrap"
          style={{
            background: iconBgColor || undefined,
            color: iconColor || undefined,
          }}
        >
          {icon}
        </div>
      )}
      <div className="ui-stat-card__content">
        <div className="ui-stat-card__value">{value}</div>
        <div className="ui-stat-card__title">{title}</div>
        {subtitle && (
          <div className="ui-stat-card__subtitle">{subtitle}</div>
        )}
      </div>
    </div>
  );
};

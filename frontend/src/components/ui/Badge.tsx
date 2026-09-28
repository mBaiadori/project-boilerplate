import React from "react";

export type BadgeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  hasDot?: boolean;
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  hasDot = false,
  dot = false,
  icon,
  className = "",
  ...props
}) => {
  const variantClass = `ui-badge--${variant}`;
  const sizeClass = size !== "md" ? `ui-badge--${size}` : "";
  const showDot = hasDot || dot;

  return (
    <span
      className={`ui-badge ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {showDot && <span className="ui-badge__dot" />}
      {icon}
      {children}
    </span>
  );
};

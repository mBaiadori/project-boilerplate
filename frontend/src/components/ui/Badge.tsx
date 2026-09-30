import React from "react";

export type BadgeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "outline"
  | "subtle";

export type BadgeSize = "xs" | "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  hasDot?: boolean;
  dot?: boolean;
  icon?: React.ReactNode;
  color?: string; // Hex color from .project.config.json or dynamic taxonomies
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  hasDot = false,
  dot = false,
  icon,
  color,
  style,
  className = "",
  ...props
}) => {
  const variantClass = `ui-badge--${variant}`;
  const sizeClass = size !== "md" ? `ui-badge--${size}` : "";
  const showDot = hasDot || dot;

  // Dynamic color support based on project taxonomy guidelines
  const dynamicStyle: React.CSSProperties = color
    ? {
        backgroundColor: color.startsWith("#") ? `${color}18` : undefined,
        borderColor: color.startsWith("#") ? `${color}40` : undefined,
        color: color,
        ...style,
      }
    : style || {};

  return (
    <span
      className={`ui-badge ${variantClass} ${sizeClass} ${className}`.trim()}
      style={dynamicStyle}
      {...props}
    >
      {showDot && (
        <span
          className="ui-badge__dot"
          style={color ? { backgroundColor: color } : undefined}
        />
      )}
      {icon}
      {children}
    </span>
  );
};

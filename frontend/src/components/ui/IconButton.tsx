import React from "react";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "standard" | "bordered" | "ghost";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  bordered?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  icon,
  size = "md",
  variant = "standard",
  bordered = false,
  tooltip,
  title,
  className = "",
  ...props
}) => {
  const sizeClass = size !== "md" ? `ui-icon-btn--${size}` : "";
  const borderClass = bordered || variant === "bordered" ? "ui-icon-btn--bordered" : "";
  const ghostClass = variant === "ghost" ? "ui-icon-btn--ghost" : "";

  return (
    <button
      className={`ui-icon-btn ${sizeClass} ${borderClass} ${ghostClass} ${className}`.trim()}
      title={tooltip || title}
      aria-label={tooltip || title}
      {...props}
    >
      {icon || children}
    </button>
  );
};

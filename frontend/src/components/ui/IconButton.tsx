import React from "react";

export type IconButtonSize = "xs" | "sm" | "md" | "lg";
export type IconButtonVariant =
  | "standard"
  | "bordered"
  | "ghost"
  | "subtle"
  | "primary"
  | "danger"
  | "outline";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  bordered?: boolean;
  active?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
  badge?: number | string | boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  icon,
  size = "md",
  variant = "ghost",
  bordered = false,
  active = false,
  tooltip,
  title,
  badge,
  className = "",
  ...props
}) => {
  const sizeClass = size !== "md" ? `ui-icon-btn--${size}` : "";
  const isBordered = bordered || variant === "bordered" || variant === "outline";
  const borderClass = isBordered ? "ui-icon-btn--bordered" : "";
  const variantClass = variant !== "standard" && variant !== "bordered" ? `ui-icon-btn--${variant}` : "";
  const activeClass = active ? "ui-icon-btn--active" : "";

  return (
    <button
      className={`ui-icon-btn ${sizeClass} ${variantClass} ${borderClass} ${activeClass} ${className}`.trim()}
      title={tooltip || title}
      aria-label={tooltip || title}
      aria-pressed={active ? true : undefined}
      {...props}
    >
      {icon || children}
      {badge !== undefined && badge !== false && (
        <span
          className="ui-icon-btn__badge"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "var(--md-sys-color-error, #d93025)",
            border: "1.5px solid var(--md-sys-color-surface, #ffffff)",
            fontSize: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          {typeof badge !== "boolean" ? badge : null}
        </span>
      )}
    </button>
  );
};

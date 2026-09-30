import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "subtle"
  | "danger"
  | "ghost"
  | "outline"
  | "tonal";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  active?: boolean;
  tooltip?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  leftIcon,
  rightIcon,
  iconPosition = "left",
  isLoading = false,
  loading = false,
  fullWidth = false,
  active = false,
  disabled,
  tooltip,
  title,
  className = "",
  style,
  ...props
}) => {
  const isBusy = isLoading || loading;
  const leadIcon = iconPosition === "left" ? (icon || leftIcon) : undefined;
  const trailIcon = iconPosition === "right" ? (icon || rightIcon) : rightIcon;
  const variantClass = `ui-btn--${variant}`;
  const sizeClass = `ui-btn--${size}`;
  const activeClass = active ? "ui-btn--active" : "";

  return (
    <button
      className={`ui-btn ${variantClass} ${sizeClass} ${activeClass} ${className}`.trim()}
      disabled={disabled || isBusy}
      data-disabled={disabled || isBusy}
      aria-pressed={active ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      title={tooltip || title}
      style={{
        ...(fullWidth ? { width: "100%", justifyContent: "center" } : {}),
        ...style,
      }}
      {...props}
    >
      {isBusy ? (
        <span className="ui-spinner ui-spinner--sm" style={{ marginRight: 2 }} />
      ) : (
        leadIcon
      )}
      {children}
      {!isBusy && trailIcon}
    </button>
  );
};

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  attached?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  attached = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`ui-btn-group ${attached ? "ui-btn-group--attached" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  leftIcon,
  rightIcon,
  isLoading = false,
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  style,
  ...props
}) => {
  const isBusy = isLoading || loading;
  const leadIcon = icon || leftIcon;
  const variantClass = `ui-btn--${variant}`;
  const sizeClass = `ui-btn--${size}`;

  return (
    <button
      className={`ui-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || isBusy}
      data-disabled={disabled || isBusy}
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
      {!isBusy && rightIcon}
    </button>
  );
};

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`ui-btn-group ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

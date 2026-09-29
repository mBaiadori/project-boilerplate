import React from "react";

export type CardVariant = "default" | "elevated" | "flat";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  padding,
  className = "",
  ...props
}) => {
  const variantClass = variant !== "default" ? `ui-card--${variant}` : "";
  const paddingClass = padding ? `ui-card--p-${padding}` : "";
  return (
    <div className={`ui-card ${variantClass} ${paddingClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  actions,
  action,
  children,
  className = "",
  ...props
}) => {
  const headerActions = actions || action;
  return (
    <div className={`ui-card__header ${className}`.trim()} {...props}>
      {children || (
        <>
          <div className="ui-card__title-wrap">
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {headerActions && <div className="ui-card__actions">{headerActions}</div>}
        </>
      )}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`ui-card__content ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`ui-card__footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

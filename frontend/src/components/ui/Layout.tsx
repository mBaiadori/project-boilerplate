import React from "react";

export type SpacingGap = "xs" | "sm" | "md" | "lg" | "xl";

/* ========================================================================= */
/* PAGE CONTAINER & BODY                                                     */
/* ========================================================================= */

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div className={`ui-page-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export interface PageBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "normal" | "compact" | "flush";
  className?: string;
}

export const PageBody: React.FC<PageBodyProps> = ({
  children,
  variant = "normal",
  className = "",
  ...props
}) => {
  const variantClass =
    variant === "compact"
      ? "ui-page-body--compact"
      : variant === "flush"
      ? "ui-page-body--flush"
      : "";

  return (
    <div className={`ui-page-body ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

/* ========================================================================= */
/* STACK (VERTICAL FLEX)                                                     */
/* ========================================================================= */

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: SpacingGap;
  className?: string;
}

export const Stack: React.FC<StackProps> = ({
  children,
  gap = "md",
  className = "",
  ...props
}) => {
  return (
    <div className={`ui-stack ui-stack--${gap} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

/* ========================================================================= */
/* ROW (HORIZONTAL FLEX)                                                     */
/* ========================================================================= */

export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: SpacingGap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
  className?: string;
}

export const Row: React.FC<RowProps> = ({
  children,
  gap = "sm",
  align = "center",
  justify = "start",
  wrap = false,
  className = "",
  ...props
}) => {
  const alignClass = `ui-row--align-${align}`;
  const justifyClass = `ui-row--justify-${justify}`;
  const wrapClass = wrap ? "ui-row--wrap" : "ui-row--nowrap";

  return (
    <div
      className={`ui-row ui-row--${gap} ${alignClass} ${justifyClass} ${wrapClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

/* ========================================================================= */
/* GRID                                                                      */
/* ========================================================================= */

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  minItemWidth?: number;
  gap?: SpacingGap;
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  children,
  cols,
  minItemWidth,
  gap = "md",
  className = "",
  style,
  ...props
}) => {
  const customStyle: React.CSSProperties = { ...style };

  let gridClass = "ui-grid";

  if (minItemWidth) {
    customStyle.gridTemplateColumns = `repeat(auto-fill, minmax(${minItemWidth}px, 1fr))`;
    customStyle.gap =
      gap === "xs"
        ? "4px"
        : gap === "sm"
        ? "8px"
        : gap === "md"
        ? "16px"
        : gap === "lg"
        ? "20px"
        : "24px";
  } else if (cols === 2) {
    gridClass = "ui-grid-2cols";
  } else if (cols === 3) {
    gridClass = "ui-grid-3cols";
  } else {
    gridClass = "ui-grid-cards";
  }

  return (
    <div
      className={`${gridClass} ${className}`.trim()}
      style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

/* ========================================================================= */
/* TOOLBAR                                                                   */
/* ========================================================================= */

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  wrap?: boolean;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  children,
  left,
  right,
  wrap = false,
  className = "",
  ...props
}) => {
  const wrapClass = wrap ? "ui-toolbar--wrap" : "";

  return (
    <div className={`ui-toolbar ${wrapClass} ${className}`.trim()} {...props}>
      {left && <div className="ui-toolbar__left">{left}</div>}
      {children}
      {right && <div className="ui-toolbar__right">{right}</div>}
    </div>
  );
};

/* ========================================================================= */
/* SECTION                                                                   */
/* ========================================================================= */

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = "",
  ...props
}) => {
  return (
    <section className={`ui-section ${className}`.trim()} {...props}>
      {(title || subtitle || actions) && (
        <div className="ui-section__header">
          <div className="ui-section__title-wrap">
            {title && <h3 className="ui-section__title">{title}</h3>}
            {subtitle && <p className="ui-section__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </div>
      )}
      <div className="ui-section__body">{children}</div>
    </section>
  );
};

/* ========================================================================= */
/* DIVIDER                                                                   */
/* ========================================================================= */

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ className = "", ...props }) => {
  return <hr className={`ui-divider ${className}`.trim()} {...props} />;
};

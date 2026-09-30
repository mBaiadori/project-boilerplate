import React from "react";

export type SpacingGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type SurfaceBg =
  | "surface"
  | "low"
  | "high"
  | "lowest"
  | "primary-subtle"
  | "transparent";

export type SurfaceBorder = "none" | "subtle" | "default" | "dashed" | "primary";
export type SurfaceRounded = "none" | "xs" | "sm" | "md" | "lg" | "full";
export type SurfaceElevation = 0 | 1 | 2 | 3;

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
/* SURFACE & BOX (UNIVERSAL CONTAINER)                                       */
/* ========================================================================= */

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  bg?: SurfaceBg;
  border?: SurfaceBorder;
  rounded?: SurfaceRounded;
  padding?: SpacingGap;
  p?: SpacingGap;
  elevation?: SurfaceElevation;
  flex?: boolean | "row" | "column" | "center";
  gap?: SpacingGap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  overflow?: "visible" | "hidden" | "auto";
  className?: string;
}

export const Surface: React.FC<SurfaceProps> = ({
  children,
  bg = "surface",
  border = "subtle",
  rounded = "sm",
  padding,
  p,
  elevation = 0,
  flex = false,
  gap,
  align,
  justify,
  wrap,
  fullWidth,
  fullHeight,
  overflow,
  className = "",
  style,
  ...props
}) => {
  const pad = p || padding || "md";
  const bgClass = `ui-surface--bg-${bg}`;
  const borderClass = `ui-surface--border-${border}`;
  const roundedClass = `ui-surface--rounded-${rounded}`;
  const padClass = `ui-surface--p-${pad}`;
  const elevationClass = `ui-surface--elevation-${elevation}`;

  const flexStyles: React.CSSProperties = {};
  if (flex) {
    flexStyles.display = "flex";
    if (flex === "column") flexStyles.flexDirection = "column";
    if (flex === "row") flexStyles.flexDirection = "row";
    if (flex === "center") {
      flexStyles.alignItems = "center";
      flexStyles.justifyContent = "center";
    }
  }

  if (gap) {
    const gapMap: Record<SpacingGap, string> = {
      none: "0",
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px",
    };
    flexStyles.gap = gapMap[gap];
  }

  if (align) {
    const alignMap = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
      stretch: "stretch",
    };
    flexStyles.alignItems = alignMap[align];
  }

  if (justify) {
    const justifyMap = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
      between: "space-between",
    };
    flexStyles.justifyContent = justifyMap[justify];
  }

  if (wrap !== undefined) {
    flexStyles.flexWrap = wrap ? "wrap" : "nowrap";
  }

  if (fullWidth) flexStyles.width = "100%";
  if (fullHeight) flexStyles.height = "100%";
  if (overflow) flexStyles.overflow = overflow;

  return (
    <div
      className={`ui-surface ${bgClass} ${borderClass} ${roundedClass} ${padClass} ${elevationClass} ${className}`.trim()}
      style={{ ...flexStyles, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

export const Box = Surface;

/* ========================================================================= */
/* PANELS (STRUCTURAL SECTIONS)                                              */
/* ========================================================================= */

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  subtle?: boolean;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  subtle = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`ui-panel ${subtle ? "ui-panel--subtle" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export const PanelHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`ui-panel--header ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const PanelBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`ui-panel--body ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const PanelFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`ui-panel--footer ${className}`.trim()} {...props}>
    {children}
  </div>
);

/* ========================================================================= */
/* STACK (VERTICAL FLEX)                                                     */
/* ========================================================================= */

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: SpacingGap;
  p?: SpacingGap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  fullWidth?: boolean;
  className?: string;
}

export const Stack: React.FC<StackProps> = ({
  children,
  gap = "md",
  p,
  align,
  justify,
  fullWidth = true,
  className = "",
  style,
  ...props
}) => {
  const padClass = p ? `ui-surface--p-${p}` : "";
  const alignClass = align ? `ui-row--align-${align}` : "";
  const justifyClass = justify ? `ui-row--justify-${justify}` : "";

  return (
    <div
      className={`ui-stack ui-stack--${gap} ${padClass} ${alignClass} ${justifyClass} ${className}`.trim()}
      style={{
        ...(fullWidth ? { width: "100%" } : {}),
        ...style,
      }}
      {...props}
    >
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
  p?: SpacingGap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const Row: React.FC<RowProps> = ({
  children,
  gap = "sm",
  p,
  align = "center",
  justify = "start",
  wrap = false,
  fullWidth = false,
  className = "",
  style,
  ...props
}) => {
  const alignClass = `ui-row--align-${align}`;
  const justifyClass = `ui-row--justify-${justify}`;
  const wrapClass = wrap ? "ui-row--wrap" : "ui-row--nowrap";
  const padClass = p ? `ui-surface--p-${p}` : "";

  return (
    <div
      className={`ui-row ui-row--${gap} ${padClass} ${alignClass} ${justifyClass} ${wrapClass} ${className}`.trim()}
      style={{
        ...(fullWidth ? { width: "100%" } : {}),
        ...style,
      }}
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

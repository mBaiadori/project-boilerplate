import React from "react";
import { Badge } from "./Badge";

export type ChipSize = "xs" | "sm" | "md" | "lg";
export type ChipVariant = "default" | "outlined" | "tonal" | "filter";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  selected?: boolean;
  size?: ChipSize;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  count?: number;
  color?: string; // Dynamic taxonomy color
  onRemove?: (e: React.MouseEvent) => void;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  active = false,
  selected = false,
  size = "md",
  variant = "default",
  icon,
  count,
  color,
  onRemove,
  className = "",
  style,
  ...props
}) => {
  const isSelected = active || selected;
  const sizeClass = size !== "md" ? `ui-chip--${size}` : "";
  const activeClass = isSelected ? "ui-chip--active" : "";
  const variantClass = variant !== "default" ? `ui-chip--${variant}` : "";

  // Dynamic color support based on project taxonomy rules
  const dynamicStyle: React.CSSProperties = color
    ? isSelected
      ? {
          backgroundColor: color,
          borderColor: color,
          color: "#ffffff",
          ...style,
        }
      : {
          backgroundColor: color.startsWith("#") ? `${color}15` : undefined,
          borderColor: color.startsWith("#") ? `${color}40` : undefined,
          color: color,
          ...style,
        }
    : style || {};

  return (
    <button
      type="button"
      className={`ui-chip ${sizeClass} ${activeClass} ${variantClass} ${className}`.trim()}
      aria-pressed={isSelected}
      style={dynamicStyle}
      {...props}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined && (
        <Badge
          size="sm"
          variant={isSelected ? "primary" : "neutral"}
          style={isSelected ? { background: "rgba(255, 255, 255, 0.25)", color: "#ffffff" } : undefined}
        >
          {count}
        </Badge>
      )}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          className="ui-chip__remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onRemove(e as unknown as React.MouseEvent);
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 4,
            cursor: "pointer",
            opacity: 0.7,
            borderRadius: "50%",
            width: 14,
            height: 14,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            close
          </span>
        </span>
      )}
    </button>
  );
};

export interface FilterChipItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  color?: string;
  disabled?: boolean;
}

export interface FilterChipsProps<T extends string = string> {
  items: (FilterChipItem<T> | string)[];
  activeId: T;
  onChange: (id: T) => void;
  size?: ChipSize;
  className?: string;
  style?: React.CSSProperties;
}

export const FilterChips = <T extends string = string>({
  items,
  activeId,
  onChange,
  size = "md",
  className = "",
  style,
}: FilterChipsProps<T>) => {
  return (
    <div className={`ui-chip-group ${className}`.trim()} style={style}>
      {items.map((item) => {
        const chipItem: FilterChipItem<T> =
          typeof item === "string"
            ? ({ id: item as T, label: item } as FilterChipItem<T>)
            : item;

        const isSelected = activeId === chipItem.id;

        return (
          <Chip
            key={chipItem.id}
            active={isSelected}
            size={size}
            icon={chipItem.icon}
            count={chipItem.count}
            color={chipItem.color}
            disabled={chipItem.disabled}
            onClick={() => onChange(chipItem.id)}
          >
            {chipItem.label}
          </Chip>
        );
      })}
    </div>
  );
};

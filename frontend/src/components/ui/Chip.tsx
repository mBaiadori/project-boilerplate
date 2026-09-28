import React from "react";
import { Badge } from "./Badge";

export type ChipSize = "sm" | "md" | "lg";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  selected?: boolean;
  size?: ChipSize;
  icon?: React.ReactNode;
  count?: number;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  active = false,
  selected = false,
  size = "md",
  icon,
  count,
  className = "",
  ...props
}) => {
  const isSelected = active || selected;
  const sizeClass = size !== "md" ? `ui-chip--${size}` : "";
  const activeClass = isSelected ? "ui-chip--active" : "";

  return (
    <button
      type="button"
      className={`ui-chip ${sizeClass} ${activeClass} ${className}`.trim()}
      aria-pressed={isSelected}
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
    </button>
  );
};

export interface FilterChipItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
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

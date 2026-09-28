import React from "react";
import { Badge } from "./Badge";

export type TabsVariant = "underline" | "pills";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  badge?: React.ReactNode;
  badgeVariant?: "primary" | "success" | "warning" | "danger" | "info" | "neutral" | "purple";
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: TabsVariant;
  fullWidth?: boolean;
  className?: string;
}

export const Tabs = <T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = "underline",
  fullWidth = false,
  className = "",
}: TabsProps<T>) => {
  const variantClass = `ui-tabs--${variant}`;

  return (
    <div
      className={`ui-tabs ${variantClass} ${className}`.trim()}
      role="tablist"
      style={fullWidth ? { width: "100%", display: "flex" } : undefined}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const countVal = tab.count !== undefined ? tab.count : typeof tab.badge === "number" ? tab.badge : undefined;
        const customBadge = typeof tab.badge !== "number" ? tab.badge : undefined;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            className={`ui-tab-item ${isActive ? "ui-tab-item--active" : ""}`}
            style={fullWidth ? { flex: 1, justifyContent: "center" } : undefined}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {countVal !== undefined && (
              <Badge
                size="sm"
                variant={
                  tab.badgeVariant || (isActive ? "primary" : "neutral")
                }
              >
                {countVal}
              </Badge>
            )}
            {customBadge && (
              typeof customBadge === "string" ? (
                <Badge size="sm" variant={tab.badgeVariant || "neutral"}>
                  {customBadge}
                </Badge>
              ) : (
                customBadge
              )
            )}
          </button>
        );
      })}
    </div>
  );
};

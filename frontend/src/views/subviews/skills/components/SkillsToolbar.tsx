import React from "react";
import { Folder, Globe, Settings } from "lucide-react";
import { FilterChips, SearchInput, Tabs } from "../../../../components/ui";
import { CATEGORY_CHIPS, type ScopeFilter } from "../types";

interface SkillsToolbarProps {
  scopeFilter: ScopeFilter;
  onSelectScopeFilter: (scope: ScopeFilter) => void;
  installedCount: number;
  systemCount: number;
  communityCount: number;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export const SkillsToolbar: React.FC<SkillsToolbarProps> = ({
  scopeFilter,
  onSelectScopeFilter,
  installedCount,
  systemCount,
  communityCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
}) => {
  const tabList = [
    {
      id: "installed",
      label: "Instaladas no Projeto",
      badge: installedCount,
      icon: <Folder size={14} />,
    },
    {
      id: "system",
      label: "Sistema (Oficiais)",
      badge: systemCount,
      icon: <Settings size={14} />,
    },
    {
      id: "community",
      label: "Comunidade",
      badge: communityCount,
      icon: <Globe size={14} />,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <Tabs
          tabs={tabList}
          activeTab={scopeFilter}
          onChange={(tab) => onSelectScopeFilter(tab as ScopeFilter)}
          variant="pills"
        />

        <div style={{ width: "320px" }}>
          <SearchInput
            id="skills-search-input"
            placeholder="Buscar skills por título, tags ou ferramentas..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange("")}
          />
        </div>
      </div>

      {/* Categories Chips */}
      <FilterChips
        items={CATEGORY_CHIPS}
        activeId={selectedCategory}
        onChange={(cat) => onSelectCategory(cat)}
        size="sm"
      />
    </div>
  );
};

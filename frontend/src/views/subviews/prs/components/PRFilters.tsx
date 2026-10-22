import React from "react";
import { FilterChips, SearchInput } from "../../../../components/ui";
import type { PRStatusFilter } from "../types";

interface PRFiltersProps {
  activeStatus: PRStatusFilter;
  setActiveStatus: (status: PRStatusFilter) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  countAll: number;
  countOpen: number;
  countMerged: number;
  countClosed: number;
}

export const PRFilters: React.FC<PRFiltersProps> = ({
  activeStatus,
  setActiveStatus,
  searchQuery,
  setSearchQuery,
  countAll,
  countOpen,
  countMerged,
  countClosed,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div className="ui-row ui-row--align-center ui-row--sm" style={{ flexWrap: "wrap" }}>
        <span
          className="ui-text-muted"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            marginRight: "4px",
          }}
        >
          Status:
        </span>
        <FilterChips<PRStatusFilter>
          activeId={activeStatus}
          onChange={(id) => setActiveStatus(id)}
          size="sm"
          items={[
            { id: "all", label: `Todas (${countAll})` },
            { id: "open", label: `Em Aberto (${countOpen})` },
            { id: "merged", label: `Integradas (${countMerged})` },
            { id: "closed", label: `Arquivadas (${countClosed})` },
          ]}
        />
      </div>

      <div style={{ width: "280px", maxWidth: "100%" }}>
        <SearchInput
          placeholder="Buscar proposta por título, autor, id..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
        />
      </div>
    </div>
  );
};

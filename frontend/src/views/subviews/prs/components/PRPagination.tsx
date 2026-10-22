import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PRPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  isLoading?: boolean;
}

export const PRPagination: React.FC<PRPaginationProps> = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}) => {
  const safeTotalItems = typeof totalItems === "number" && !isNaN(totalItems) ? totalItems : 0;
  const safeTotalPages = Math.max(1, typeof totalPages === "number" && !isNaN(totalPages) ? totalPages : 1);
  const safeCurrentPage = Math.max(1, Math.min(typeof currentPage === "number" && !isNaN(currentPage) ? currentPage : 1, safeTotalPages));
  const safePageSize = Math.max(1, typeof pageSize === "number" && !isNaN(pageSize) ? pageSize : 15);

  if (safeTotalItems <= 0) return null;

  const startItem = Math.min((safeCurrentPage - 1) * safePageSize + 1, safeTotalItems);
  const endItem = Math.min(safeCurrentPage * safePageSize, safeTotalItems);

  // Calcula conjunto de páginas visíveis (até 5 números)
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 5) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", safeTotalPages);
      } else if (safeCurrentPage >= safeTotalPages - 2) {
        pages.push(1, "...", safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages);
      } else {
        pages.push(1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", safeTotalPages);
      }
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div
      id="prs-pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        padding: "12px 16px",
        backgroundColor: "var(--color-surface, #ffffff)",
        borderRadius: "var(--md-shape-corner-md, 12px)",
        border: "1px solid var(--color-outline-variant, #dadce0)",
        marginTop: "8px",
      }}
    >
      {/* Resumo da Contagem */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "13px",
          color: "var(--color-text-secondary, #475569)",
        }}
      >
        <span>
          Exibindo <strong>{startItem}</strong> a <strong>{endItem}</strong> de <strong>{totalItems}</strong> revisões
        </span>

        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--color-outline, #94a3b8)" }}>Por página:</span>
            <select
              value={pageSize}
              disabled={isLoading}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                fontSize: "12.5px",
                padding: "2px 6px",
                borderRadius: "6px",
                border: "1px solid var(--color-outline-variant, #dadce0)",
                backgroundColor: "var(--color-surface-container-low, #f8fafc)",
                color: "var(--color-on-surface, #1e293b)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {/* Controles de Navegação */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {/* Primeira Página */}
        <button
          type="button"
          aria-label="Primeira página"
          disabled={safeCurrentPage <= 1 || isLoading}
          onClick={() => onPageChange(1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid var(--color-outline-variant, #dadce0)",
            backgroundColor: "transparent",
            color: safeCurrentPage <= 1 ? "var(--color-outline, #cbd5e1)" : "var(--color-on-surface, #334155)",
            cursor: safeCurrentPage <= 1 || isLoading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Anterior */}
        <button
          type="button"
          aria-label="Página anterior"
          disabled={safeCurrentPage <= 1 || isLoading}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid var(--color-outline-variant, #dadce0)",
            backgroundColor: "transparent",
            color: safeCurrentPage <= 1 ? "var(--color-outline, #cbd5e1)" : "var(--color-on-surface, #334155)",
            cursor: safeCurrentPage <= 1 || isLoading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Números das Páginas */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {visiblePages.map((pageNum, idx) => {
            if (pageNum === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: "0 4px",
                    color: "var(--color-outline, #94a3b8)",
                    fontSize: "13px",
                  }}
                >
                  ...
                </span>
              );
            }

            const isCurrent = pageNum === safeCurrentPage;
            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                disabled={isLoading}
                onClick={() => onPageChange(Number(pageNum))}
                style={{
                  minWidth: "32px",
                  height: "32px",
                  padding: "0 6px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: isCurrent ? 700 : 500,
                  border: isCurrent
                    ? "1px solid var(--color-primary, #1a73e8)"
                    : "1px solid transparent",
                  backgroundColor: isCurrent
                    ? "var(--color-primary, #1a73e8)"
                    : "transparent",
                  color: isCurrent
                    ? "#ffffff"
                    : "var(--color-on-surface, #334155)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Próxima */}
        <button
          type="button"
          aria-label="Próxima página"
          disabled={safeCurrentPage >= safeTotalPages || isLoading}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid var(--color-outline-variant, #dadce0)",
            backgroundColor: "transparent",
            color: safeCurrentPage >= safeTotalPages ? "var(--color-outline, #cbd5e1)" : "var(--color-on-surface, #334155)",
            cursor: safeCurrentPage >= safeTotalPages || isLoading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ChevronRight size={16} />
        </button>

        {/* Última Página */}
        <button
          type="button"
          aria-label="Última página"
          disabled={safeCurrentPage >= safeTotalPages || isLoading}
          onClick={() => onPageChange(safeTotalPages)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid var(--color-outline-variant, #dadce0)",
            backgroundColor: "transparent",
            color: safeCurrentPage >= safeTotalPages ? "var(--color-outline, #cbd5e1)" : "var(--color-on-surface, #334155)",
            cursor: safeCurrentPage >= safeTotalPages || isLoading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

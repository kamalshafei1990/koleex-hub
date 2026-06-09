"use client";

/* DataTable — Security Center monochrome table (Phase 2A · A2).
   Generic, read-only. Hairline rows, tabular numerics, optional row-click
   (keyboard-accessible), "top-N + View all" pattern, horizontal scroll on
   narrow screens. No fetching, no mutation. */

import type { ReactNode, KeyboardEvent } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Accessible label per clickable row. */
  rowLabel?: (row: T) => string;
  emptyText?: string;
  /** Screen-reader caption for the table. */
  caption?: string;
  /** Render only the first N rows; pair with totalCount + onViewAll. */
  maxRows?: number;
  totalCount?: number;
  onViewAll?: () => void;
  className?: string;
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowLabel,
  emptyText = "Nothing to show.",
  caption,
  maxRows,
  totalCount,
  onViewAll,
  className = "",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-[var(--text-dim)]">{emptyText}</p>;
  }

  const shown = typeof maxRows === "number" ? rows.slice(0, maxRows) : rows;
  const clickable = typeof onRowClick === "function";
  const total = totalCount ?? rows.length;

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={className}>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-2 py-1.5 font-medium ${ALIGN[c.align ?? "left"]}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                {...(clickable
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": rowLabel?.(row),
                      onClick: () => onRowClick?.(row),
                      onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => onKey(e, row),
                    }
                  : {})}
                className={`border-t border-[var(--border)] ${
                  clickable
                    ? "cursor-pointer hover:bg-[var(--bg-surface-hover)] focus:bg-[var(--bg-surface-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-1.5 ${ALIGN[c.align ?? "left"]} ${
                      c.align === "right" ? "tabular-nums" : ""
                    } ${c.className ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {typeof maxRows === "number" && total > maxRows && typeof onViewAll === "function" && (
        <button
          onClick={onViewAll}
          className="mt-2 rounded text-xs text-blue-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        >
          View all {total}
        </button>
      )}
    </div>
  );
}

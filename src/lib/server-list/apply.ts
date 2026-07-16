/* ---------------------------------------------------------------------------
   server-list/apply — apply a validated ServerListRequest to a Supabase query.
   Server-only helper (no React). Enforces: allowlisted search columns, eq
   filters, deterministic ordering with a unique id tie-breaker, and a bounded
   offset window. The caller is responsible for tenant scoping + column policy
   BEFORE calling this (this only adds search/sort/pagination).
   --------------------------------------------------------------------------- */
import type { ServerListConfig, ServerListRequest } from "./types";

/* Structural view of just the Supabase builder methods we chain. Kept minimal
   so this file doesn't depend on @supabase types directly. */
interface Chainable {
  or(filter: string): Chainable;
  eq(column: string, value: string): Chainable;
  order(column: string, opts: { ascending: boolean; nullsFirst?: boolean }): Chainable;
  range(from: number, to: number): Chainable;
}

/* Escape a user string for use inside a PostgREST double-quoted `.or` value.
   Double-quoting makes `,` `(` `)` `.` literal (they'd otherwise break the
   or-expression grammar); we still must escape backslash and the quote itself.
   `%`/`_` remain ilike wildcards — benign for a substring name search. */
function escForOr(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function applyServerList<B>(builder: B, req: ServerListRequest, cfg: ServerListConfig): B {
  let b = builder as unknown as Chainable;

  // Free-text search across ONLY the approved columns (OR of ilike).
  if (req.q && cfg.searchColumns.length > 0) {
    const v = escForOr(req.q);
    const orExpr = cfg.searchColumns.map((c) => `${c}.ilike."%${v}%"`).join(",");
    b = b.or(orExpr);
  }

  // Approved equality filters.
  for (const [key, val] of Object.entries(req.filters)) {
    const col = cfg.filters[key]?.column;
    if (col) b = b.eq(col, val);
  }

  // Deterministic ordering + unique tie-breaker so offset pages never
  // duplicate or skip rows under stable data. nullsFirst:false → NULLS LAST.
  const sortCol = cfg.sortFields[req.sort] ?? cfg.sortFields[cfg.defaultSort.field];
  b = b.order(sortCol, { ascending: req.dir === "asc", nullsFirst: false });
  if (sortCol !== "id") b = b.order("id", { ascending: true });

  // Bounded offset window.
  const offset = (req.page - 1) * req.pageSize;
  b = b.range(offset, offset + req.pageSize - 1);

  return b as unknown as B;
}

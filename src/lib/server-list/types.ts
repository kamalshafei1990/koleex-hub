/* ---------------------------------------------------------------------------
   server-list — shared typed contract for server-driven directory lists.
   (Phase 4 Wave 2A.1)

   One small, generic contract that directory-style apps (Customers first,
   then Contacts/Suppliers/Products/… once approved) can reuse to move
   search / filter / sort / pagination to the SERVER. It intentionally accepts
   ONLY explicitly-allowlisted parameters — never raw column names, SQL
   fragments, or client-defined filter expressions.

   This file is framework-agnostic (no React, no Supabase types) so it can be
   imported by both the route handler and the client hook.
   --------------------------------------------------------------------------- */

export type SortDir = "asc" | "desc";

/** The validated, safe request the server will actually execute. */
export interface ServerListRequest {
  /** 1-based page index (offset pagination). */
  page: number;
  /** Rows per page, already clamped to the config maximum. */
  pageSize: number;
  /** Normalized search query (trimmed, whitespace-collapsed, length-capped). */
  q: string;
  /** Approved sort key (maps to a real column via config). */
  sort: string;
  dir: SortDir;
  /** Approved filter key → approved value. Unknown keys/values are dropped. */
  filters: Record<string, string>;
}

/** The response envelope returned to the client. */
export interface ServerListResponse<T> {
  rows: T[];
  page: number;
  pageSize: number;
  /** Total matching rows — only when the config opts into a count. Else null. */
  total: number | null;
  /** True when another page likely exists (rows filled the page). */
  hasMore: boolean;
  /** Echo of the safe normalized query metadata (never raw user input beyond q). */
  q: string;
  sort: string;
  dir: SortDir;
}

/** Per-resource policy: the ONLY things a caller may search/sort/filter by. */
export interface ServerListConfig {
  defaultPageSize: number;
  /** Hard server-enforced ceiling; requests above are clamped down. */
  maxPageSize: number;
  /** approved sort key → real, non-sensitive DB column. */
  sortFields: Record<string, string>;
  defaultSort: { field: string; dir: SortDir };
  /** Non-sensitive columns the free-text query may match (ilike). */
  searchColumns: string[];
  /** approved filter key → { column, optional value allowlist }. */
  filters: Record<string, { column: string; allowed?: readonly string[] }>;
  /** Maximum accepted search length (chars) before truncation. */
  maxQueryLength: number;
}

/** Normalize a raw search string: trim, collapse internal whitespace, cap length.
    Unicode-safe (NFC) so Chinese/Arabic/mixed input compares consistently; we
    do NOT strip non-ASCII. Returns "" for empty/whitespace-only input. */
export function normalizeQuery(raw: string | null | undefined, maxLen: number): string {
  if (!raw) return "";
  let s = String(raw);
  try { s = s.normalize("NFC"); } catch { /* older runtimes — leave as-is */ }
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Parse + validate URL search params into a safe ServerListRequest.
    Every value is checked against the config allowlists; anything unknown
    falls back to a safe default (never trusts client-supplied columns). */
export function parseListParams(
  params: URLSearchParams,
  cfg: ServerListConfig,
): ServerListRequest {
  // page
  let page = Number.parseInt(params.get("page") ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  // pageSize — clamp to [1, maxPageSize]
  let pageSize = Number.parseInt(params.get("pageSize") ?? String(cfg.defaultPageSize), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = cfg.defaultPageSize;
  if (pageSize > cfg.maxPageSize) pageSize = cfg.maxPageSize;

  // sort — only an approved key; else default
  const sortReq = params.get("sort") ?? "";
  const sort = Object.prototype.hasOwnProperty.call(cfg.sortFields, sortReq)
    ? sortReq
    : cfg.defaultSort.field;
  const dirReq = (params.get("dir") ?? "").toLowerCase();
  const dir: SortDir = dirReq === "asc" || dirReq === "desc"
    ? (dirReq as SortDir)
    : (sort === cfg.defaultSort.field ? cfg.defaultSort.dir : "asc");

  // q — normalized
  const q = normalizeQuery(params.get("q"), cfg.maxQueryLength);

  // filters — only approved keys + (when constrained) approved values
  const filters: Record<string, string> = {};
  for (const key of Object.keys(cfg.filters)) {
    const val = params.get(key);
    if (val == null || val === "") continue;
    const def = cfg.filters[key];
    if (def.allowed && !def.allowed.includes(val)) continue; // reject unknown value
    filters[key] = val;
  }

  return { page, pageSize, q, sort, dir, filters };
}

/** Build the sanitized response envelope from executed rows. */
export function buildListResponse<T>(
  rows: T[],
  req: ServerListRequest,
  total: number | null,
): ServerListResponse<T> {
  return {
    rows,
    page: req.page,
    pageSize: req.pageSize,
    total,
    hasMore: rows.length >= req.pageSize,
    q: req.q,
    sort: req.sort,
    dir: req.dir,
  };
}

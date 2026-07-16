"use client";

/* ---------------------------------------------------------------------------
   useServerList — reusable client hook for server-driven directory lists.
   (Phase 4 Wave 2A.1)

   Wraps TanStack Query (the app's existing cache layer — NOT a second store)
   to provide: server pagination, server search (debounced), approved
   filters/sort, AbortController cancellation of stale requests, retention of
   the previous usable page while a new one loads, initial-loading vs
   background-refreshing states, error/retry, and per-account+tenant cache
   isolation via the query key.

   It does NOT hold sensitive data in any global unscoped store — all data
   lives in the TanStack cache keyed by (resource, tenantId, accountId, params),
   so one account can never read another's cached list, and the app's existing
   logout/reload drops it.
   --------------------------------------------------------------------------- */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { fetchJson } from "@/lib/query/useApiQuery";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { ServerListResponse, SortDir } from "@/lib/server-list/types";

export interface UseServerListOptions {
  /** Stable resource identity for the cache key, e.g. "contacts:customer". */
  resource: string;
  /** Base endpoint, e.g. "/api/contacts". */
  endpoint: string;
  /** Cache-isolation scope — MUST carry the current tenant + account. */
  scope: { tenantId?: string | null; accountId?: string | null };
  /** Params always sent (e.g. { type: "customer", paged: "1" }). */
  fixedParams?: Record<string, string>;
  pageSize?: number;
  initialSort?: { field: string; dir: SortDir };
  enabled?: boolean;
  searchDebounceMs?: number;
}

export function useServerList<T>(opts: UseServerListOptions) {
  const [page, setPage] = useState(1);
  const [rawQuery, setRawQuery] = useState("");
  const debouncedQuery = useDebouncedValue(rawQuery.trim(), opts.searchDebounceMs ?? 300);
  const [sort, setSort] = useState(opts.initialSort?.field ?? "");
  const [dir, setDir] = useState<SortDir>(opts.initialSort?.dir ?? "asc");
  const [filters, setFilters] = useState<Record<string, string>>({});

  /* Any change to query/filter/sort resets to page 1 (so you never land on an
     out-of-range page of a smaller result set). */
  const setQuery = useCallback((v: string) => { setRawQuery(v); setPage(1); }, []);
  const setFilter = useCallback((key: string, value: string | null) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      if (value == null || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);
  const setSortField = useCallback((field: string, d: SortDir) => {
    setSort(field); setDir(d); setPage(1);
  }, []);

  const url = useMemo(() => {
    const sp = new URLSearchParams({ ...(opts.fixedParams ?? {}) });
    sp.set("page", String(page));
    if (opts.pageSize) sp.set("pageSize", String(opts.pageSize));
    if (debouncedQuery) sp.set("q", debouncedQuery);
    if (sort) { sp.set("sort", sort); sp.set("dir", dir); }
    for (const [k, v] of Object.entries(filters)) sp.set(k, v);
    return `${opts.endpoint}?${sp.toString()}`;
  }, [opts.endpoint, opts.fixedParams, opts.pageSize, page, debouncedQuery, sort, dir, filters]);

  const queryKey = useMemo(() => [
    "server-list", opts.resource,
    opts.scope.tenantId ?? "anon", opts.scope.accountId ?? "anon",
    { page, pageSize: opts.pageSize ?? null, q: debouncedQuery, sort, dir, filters },
  ], [opts.resource, opts.scope.tenantId, opts.scope.accountId, page, opts.pageSize, debouncedQuery, sort, dir, filters]);

  const query = useQuery<ServerListResponse<T>>({
    queryKey,
    // TanStack passes an AbortSignal; forwarding it cancels stale in-flight
    // requests, and TanStack itself ignores out-of-order resolutions.
    queryFn: ({ signal }) => fetchJson<ServerListResponse<T>>(url, { signal }),
    enabled: opts.enabled !== false,
    placeholderData: keepPreviousData, // keep the last usable page visible while refetching
    staleTime: 30_000,
  });

  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? null,
    hasMore: query.data?.hasMore ?? false,
    page,
    setPage,
    query: rawQuery,
    setQuery,
    sort,
    dir,
    setSort: setSortField,
    filters,
    setFilter,
    /** True only before the first data arrives (show a skeleton). */
    isInitialLoading: query.isLoading,
    /** True while a background refresh runs but previous rows are still shown. */
    isRefreshing: query.isFetching && !query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}

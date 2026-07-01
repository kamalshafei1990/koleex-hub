"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

/**
 * fetchJson — the standard read fetch used by the cached data layer.
 *
 * Unlike the ad-hoc `fetch(url, { cache: "no-store" })` calls scattered across
 * the app (which forced every navigation to re-download), this lets TanStack
 * Query own caching. It still hits the network for the *first* load; repeat
 * views come from cache instantly and revalidate in the background.
 *
 * Surfaces a clean Error message (server `error`/`message` field when present)
 * instead of leaking a raw HTTP status to the UI.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error || body?.message) msg = String(body.error || body.message);
    } catch {
      /* non-JSON error body — keep the status message */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/**
 * useApiQuery — thin convenience wrapper over useQuery for GET endpoints.
 *
 * Pass a stable `key` (used for cache identity/dedup) and a `url`. Pass
 * `url = null` to disable the query until inputs are ready (e.g. an id that
 * hasn't loaded yet). All other TanStack options pass through.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  url: string | null,
  options?: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey: key,
    queryFn: () => fetchJson<T>(url as string),
    enabled: url != null && options?.enabled !== false,
    ...options,
  });
}

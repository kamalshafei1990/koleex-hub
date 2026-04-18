"use client";

/* ---------------------------------------------------------------------------
   fetch-cache — minimal SWR-ish wrapper that deduplicates in-flight GETs
   and serves cached payloads for a short TTL. Designed to be drop-in
   for the hand-rolled `fetch(url).then(r => r.json())` calls scattered
   through the app.

     const rows = await cachedFetchJson<MyRow[]>("/api/my-list");
     // Second call within 3 s returns the same payload without
     // issuing a new request.

   Pass `{ ttl: 0 }` to bypass cache (useful right after a write).
   --------------------------------------------------------------------------- */

interface CacheEntry {
  payload: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 3_000;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Clear every entry for a given URL prefix. Call after a write to the
 *  underlying resource so the next read picks up the new state. */
export function invalidateFetchCache(prefix = ""): void {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export async function cachedFetchJson<T>(
  url: string,
  opts: { ttl?: number; init?: RequestInit } = {},
): Promise<T> {
  const ttl = opts.ttl ?? DEFAULT_TTL_MS;
  const key = url;

  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload as T;
    }
  }
  const flying = inflight.get(key);
  if (flying) return flying as Promise<T>;

  const promise = (async () => {
    try {
      const res = await fetch(url, {
        credentials: "include",
        ...(opts.init ?? {}),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const json = (await res.json()) as T;
      if (ttl > 0) {
        cache.set(key, { payload: json, expiresAt: Date.now() + ttl });
      }
      return json;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

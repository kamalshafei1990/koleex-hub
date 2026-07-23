"use client";

/* ---------------------------------------------------------------------------
   Request coalescing for shared reference endpoints.

   The problem this solves, measured on /employees (dev, one page load):
     /api/me/permissions        × 6
     /api/me/bootstrap          × 5
     /api/employees             × 4
     /api/management/departments × 3

   None of that is a caching bug — it is FAN-OUT. `usePermissions()` is a hook,
   so every component that calls it runs its own effect, and inside that effect
   the role-permissions fetch and the department fetch each hit the SAME
   endpoint separately. Three consumers on a page therefore issue six identical
   requests. They all resolve to the same bytes.

   The cost is not just bandwidth. Those requests are individually fast when
   they run alone (departments: 71ms) but collapse under their own burst
   (departments: 10.2s, and a 500) because they queue behind each other and
   saturate the connection pool. Removing the duplicates is what makes the page
   fast — not making any single endpoint faster.

   `cachedGet` gives two guarantees:
     · IN-FLIGHT COALESCING — concurrent callers for the same URL share one
       request and one promise. This is the part that kills the fan-out, and it
       works even with ttlMs = 0.
     · SHORT TTL REUSE — a resolved body is reused for `ttlMs`, so a remount
       moments later does not re-fetch.

   Deliberately NOT a general data layer: no revalidation, no subscriptions, no
   stale-while-revalidate. It is for small, read-only, caller-independent
   reference payloads. Anything user-editable must keep fetching normally, or
   call `invalidateCachedGet` after it writes.

   Failures are never cached — a rejected request is dropped from the map so the
   next caller retries.
   --------------------------------------------------------------------------- */

interface Entry {
  /** Resolved payload; present only once the request succeeded. */
  value?: unknown;
  /** Wall-clock ms when `value` was stored. */
  at?: number;
  /** In-flight promise, shared by every concurrent caller. */
  inflight?: Promise<unknown>;
}

const cache = new Map<string, Entry>();

/** GET `url` as JSON, coalescing concurrent callers and reusing the body for
 *  `ttlMs`. Throws on a non-OK response so callers keep their error handling. */
export async function cachedGet<T>(url: string, ttlMs = 15_000): Promise<T> {
  const hit = cache.get(url);

  if (hit?.inflight) return hit.inflight as Promise<T>;
  if (hit && hit.at != null && Date.now() - hit.at < ttlMs) {
    return hit.value as T;
  }

  const inflight = (async () => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  })();

  cache.set(url, { inflight });

  try {
    const value = await inflight;
    cache.set(url, { value, at: Date.now() });
    return value;
  } catch (e) {
    /* Never cache a failure — the next caller must be free to retry. */
    cache.delete(url);
    throw e;
  }
}

/** Drop cached entries. No argument clears everything (use on sign-out, so a
 *  second account never reads the first one's reference data). A string clears
 *  every URL that starts with it, which covers query-string variants. */
export function invalidateCachedGet(urlPrefix?: string): void {
  if (!urlPrefix) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}

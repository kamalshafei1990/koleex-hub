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

/* SYS-4: bundlers may duplicate small modules across chunks, which would
   split this map into per-chunk copies and silently disable coalescing —
   exactly what happened to visual-bindings (3 copies in one build). The
   globalThis anchor guarantees one shared map no matter how many chunk
   graphs include this file. */
const g = globalThis as typeof globalThis & { __kxCachedGet?: Map<string, Entry> };
const cache: Map<string, Entry> = g.__kxCachedGet ?? (g.__kxCachedGet = new Map());

/** GET `url` as JSON, coalescing concurrent callers and reusing the body for
 *  `ttlMs`. Throws on a non-OK response so callers keep their error handling. */
/* ── Shell batching ────────────────────────────────────────────────────────
   Coalescing removed the DUPLICATES; this removes the ROUND TRIPS. Measured
   on the owner's connection: one warm API call costs ~0.33 s, but the 14 the
   catalogue screen opens at once took 6.95 s — concurrent streams on a lossy
   cross-border link stall each other, so the count is what hurts, not the
   server. These four endpoints are fetched by every screen and are all
   returned by /api/shell, so the first caller pulls the batch and the rest
   are served from this cache without ever touching the network.

   Deliberately conservative: if the batch fails, or returns null for a key,
   the caller falls through to its own endpoint exactly as before. The
   individual routes stay the source of truth. */
const SHELL_SECTION: Record<string, string> = {
  "/api/me/permissions": "permissions",
  "/api/me/work": "work",
  "/api/fx/cny-usd": "fx",
};
/* SYS-4: Turbopack duplicates this module across chunks, so a plain
   module-level promise becomes several independent ones and the "single"
   flight fires once per copy — measured 2 /api/shell calls instead of 1.
   Anchoring on globalThis makes every copy share one promise. */
interface ShellState { inflight: Promise<Record<string, unknown> | null> | null }
const sg = globalThis as typeof globalThis & { __kxShellBatch?: ShellState };
const shellState: ShellState = sg.__kxShellBatch ?? (sg.__kxShellBatch = { inflight: null });

/* The catalogue screens need two more reference payloads that the rest of
   the Hub never reads — kept in their OWN batch so Home doesn't pay for a
   128 KB taxonomy it will never show. */
const CATALOG_SECTION: Record<string, string> = {
  "/api/taxonomy/all": "taxonomy",
  "/api/classification-icons": "icons",
};
const cg = globalThis as typeof globalThis & { __kxCatalogBatch?: ShellState };
const catalogState: ShellState = cg.__kxCatalogBatch ?? (cg.__kxCatalogBatch = { inflight: null });

/* Home asks for three more on mount — and RoleHome already requests them
   together in one Promise.all, so they collapse into one trip cleanly. Kept
   out of the shell batch because no other screen reads them. */
const HOME_SECTION: Record<string, string> = {
  "/api/me/preferences": "preferences",
  "/api/workflows/status": "workflows",
  "/api/finance/setup/status": "financeSetup",
};
const hg = globalThis as typeof globalThis & { __kxHomeBatch?: ShellState };
const homeState: ShellState = hg.__kxHomeBatch ?? (hg.__kxHomeBatch = { inflight: null });

/** The shared shell batch. Exported so non-cachedGet consumers (visual
 *  bindings) join the SAME request instead of opening a second one. */
export async function getShell(): Promise<Record<string, unknown> | null> {
  return fetchShell();
}

async function fetchBatch(
  state: ShellState,
  url: string,
  sections: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const body = (await res.json()) as Record<string, unknown>;
      const now = Date.now();
      for (const [path, section] of Object.entries(sections)) {
        const value = body[section];
        if (value != null && !cache.get(path)?.inflight) cache.set(path, { value, at: now });
      }
      return body;
    } catch {
      return null;
    } finally {
      state.inflight = null;
    }
  })();
  return state.inflight;
}

async function fetchShell(): Promise<Record<string, unknown> | null> {
  return fetchBatch(shellState, "/api/shell", SHELL_SECTION);
}

/* Every batch, in one table. A new one is a single entry here plus its route —
   there is no other place that has to learn about it, and a URL that appears
   in no table keeps fetching its own endpoint exactly as before. */
const BATCHES = [
  { url: "/api/shell",        state: shellState,   map: SHELL_SECTION },
  { url: "/api/catalog-refs", state: catalogState, map: CATALOG_SECTION },
  { url: "/api/home-refs",    state: homeState,    map: HOME_SECTION },
] as const;

function pickBatch(url: string) {
  for (const b of BATCHES) {
    const section = b.map[url];
    if (section) return { section, state: b.state, url: b.url, map: b.map };
  }
  return null;
}

export async function cachedGet<T>(url: string, ttlMs = 15_000): Promise<T> {
  const hit = cache.get(url);

  if (hit?.inflight) return hit.inflight as Promise<T>;
  if (hit && hit.at != null && Date.now() - hit.at < ttlMs) {
    return hit.value as T;
  }

  /* Which batch, if any, already carries this payload? */
  const batch = pickBatch(url);
  if (batch) {
    const batched = (async () => {
      const body = await fetchBatch(batch.state, batch.url, batch.map);
      const value = body?.[batch.section];
      if (value != null) return value as T;
      /* Batch unavailable for this key — take the original path. */
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
      return (await res.json()) as T;
    })();
    cache.set(url, { inflight: batched });
    try {
      const value = await batched;
      cache.set(url, { value, at: Date.now() });
      return value;
    } catch (e) {
      cache.delete(url);
      throw e;
    }
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

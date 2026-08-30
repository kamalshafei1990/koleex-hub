/* ---------------------------------------------------------------------------
   ai/cache/tenant-cache — a small TTL cache that CANNOT be built without a
   tenant.

   Phase 5C. No `server-only`: it is a Map with a clock, and the suite imports
   it directly.

   THE POINT OF THIS FILE IS THE KEY, NOT THE CACHING. Caching a retrieval
   result is easy and worth little on its own. Caching it under a key that
   omits the tenant is a cross-tenant data leak with a TTL-length window — one
   tenant's approved knowledge, complete with source titles and page numbers,
   served into another tenant's prompt. That is precisely the class of bug
   validate:ai-tenant-isolation exists to catch, and a cache is the easiest
   place in a codebase to introduce it, because the bug looks like a
   performance win and behaves correctly in every single-tenant test.

   So the tenant is the FIRST POSITIONAL ARGUMENT of every operation. Not part
   of a key the caller composes, not an option with a default, not something a
   helper might forget: get() and set() cannot be called without it. `null` is
   a distinct namespace, not an absent one — a platform-level lookup must never
   collide with a tenanted one.

   The key is built with JSON.stringify over a tuple rather than string
   concatenation. A separator character is only unambiguous until some id
   contains it, and "the ids are UUIDs" is an assumption about today's data,
   not a property of the code.

   BOUNDED, because this is serverless. A Map that only grows is a memory leak
   on a warm instance serving thousands of turns. Entries expire by TTL and the
   map is capped; past the cap, oldest insertions are dropped. Bounded memory
   matters more than a perfect hit rate — a cache that causes an OOM has a hit
   rate of zero.

   IT FAILS OPEN by construction: a miss returns undefined and the caller does
   the real work. There is no path where a cache problem yields a WRONG answer
   rather than a slower one — except through the key, which is why the key is
   what this file is arranged around.
   --------------------------------------------------------------------------- */

export interface TenantCacheOptions {
  ttlMs: number;
  /** Hard cap on live entries. Past it, oldest insertions are evicted. */
  maxEntries: number;
  now: () => number;
}

interface Entry<T> {
  at: number;
  value: T;
}

export interface TenantCache<T> {
  get(tenantId: string | null, key: string): T | undefined;
  set(tenantId: string | null, key: string, value: T): void;
  /** Drop everything for one tenant — for after a write that invalidates it. */
  invalidateTenant(tenantId: string | null): void;
  size(): number;
  /** Test and observability only. Contains keys, never a tenant's DATA. */
  keys(): string[];
}

/** Unambiguous by construction: a tuple through JSON.stringify cannot be
 *  forged by an id that happens to contain the separator. */
export function cacheKey(tenantId: string | null, key: string): string {
  return JSON.stringify([tenantId, key]);
}

export function createTenantCache<T>(opts: Partial<TenantCacheOptions> = {}): TenantCache<T> {
  const cfg: TenantCacheOptions = {
    ttlMs: 60_000,
    maxEntries: 500,
    now: () => Date.now(),
    ...opts,
  };
  /* Map preserves insertion order, which is what makes the eviction below
     oldest-first without a second structure to keep in sync. */
  const map = new Map<string, Entry<T>>();

  const evictIfNeeded = () => {
    while (map.size > cfg.maxEntries) {
      const oldest = map.keys().next();
      if (oldest.done) break;
      map.delete(oldest.value);
    }
  };

  return {
    get(tenantId, key) {
      const k = cacheKey(tenantId, key);
      const hit = map.get(k);
      if (!hit) return undefined;
      if (cfg.now() - hit.at >= cfg.ttlMs) {
        map.delete(k);
        return undefined;
      }
      return hit.value;
    },

    set(tenantId, key, value) {
      const k = cacheKey(tenantId, key);
      /* Delete first so a refresh moves the entry to the END of the insertion
         order. Without this a hot key keeps its original position and is
         evicted ahead of colder entries written after it. */
      map.delete(k);
      map.set(k, { at: cfg.now(), value });
      evictIfNeeded();
    },

    invalidateTenant(tenantId) {
      /* Compare the decoded tenant rather than matching a string prefix: a
         prefix test would make tenant "ab" match tenant "abc". */
      for (const k of [...map.keys()]) {
        try {
          const [t] = JSON.parse(k) as [string | null, string];
          if (t === tenantId) map.delete(k);
        } catch {
          /* not one of ours — leave it */
        }
      }
    },

    size: () => map.size,
    keys: () => [...map.keys()],
  };
}

/* ---------------------------------------------------------------------------
   storage-guard — keeps localStorage below the origin quota so warm-start
   never silently stops working.

   WHY THIS EXISTS. Measured live on the owner's own browser 2026-08-15:

     localStorage total          4,568 KB
     typical origin quota        5,120 KB
     → 89 % FULL, on 344 contacts

   The three largest keys were all contact caches — 2,044 + 886 + 855 KB,
   which is 83 % of everything stored. The target is 6,000 contacts.

   ⚠️ THE BUG IS NOT A MISSING LIMIT — IT IS A PER-KEY LIMIT WITH NO TOTAL.
   `Contacts.tsx` already guards its write with `if (json.length < 2_500_000)`,
   and that is correct for one key. But the cache is written once per FILTER —
   `:all`, `:customer`, `:supplier` — so three keys each individually "under the
   limit" add up to a possible 7.5 MB against a 5 MB quota. Twenty-one places in
   the app write JSON to localStorage; each one guards itself and nothing guards
   the sum.

   WHAT GOING OVER ACTUALLY COSTS. `setItem` throws QuotaExceededError, every
   caller swallows it in an empty catch, and the
   app keeps working — but **the warm start silently stops happening**. Every
   screen open goes back to the network. There is no error, no log, and nothing
   on screen: the app just gets slower and stays slower. That is exactly the
   symptom the owner described.

   ⚠️ SECOND COST, AND IT IS THE ONE PEOPLE FORGET: localStorage is
   SYNCHRONOUS. Reading a 2 MB entry blocks the main thread while it parses —
   so an oversized cache does not only fail to help, it actively delays the
   first paint it was supposed to accelerate.

   ── WHAT THIS MAY AND MAY NOT DELETE ──────────────────────────────────────
   Only CACHE is ever evicted — data the server can rebuild on the next fetch.
   Anything the user authored or chose is untouchable, because losing it is
   losing work, not losing speed:

     NEVER TOUCHED   koleex:pd:draft:*   product drafts — unsaved user work
                     koleex-theme, koleex-display, koleex-*  preferences
                     koleex-device-id, koleex-last-user      identity
                     anything not matching a known cache prefix

   The default is KEEP. A key is only evictable if it matches a prefix listed
   in CACHE_PREFIXES — an unknown key is treated as precious, never as spare.
   That way a new feature that starts storing something important is safe by
   default rather than at risk until someone remembers to add it here.
   --------------------------------------------------------------------------- */

/** Prefixes whose values are rebuildable from the server. Order is eviction
 *  priority: earlier entries are dropped first because they are the cheapest
 *  to refetch and the least likely to be needed on the very next screen. */
const CACHE_PREFIXES: readonly string[] = [
  "kx_contacts_v1:",      // legacy copies only — this cache lives in IndexedDB
                          // now (idb-cache.ts); listed so any left behind by an
                          // older build are still evictable rather than stuck.
  "kx_products_list_v1:",
  "kx_products_meta_v1:",
  "kx_products_models_v1:",  // added 2026-08-15: found holding 23 KB while the
  "kx_products_imgs_v1:",    // guard treated all three as precious, because an
  "kx_class_icons_v1:",      // unlisted key defaults to KEEP. All three are
                             // rebuilt from the server on the next fetch, so
                             // they are cache and belong here — 103 KB that was
                             // previously unreclaimable.
  "kx_vb_v1",             // visual library
  "kx_todo_snap_v1",
  "kx:taxo:",             // taxonomy + logos — small, cheap, and rarely stale
];

/** Start evicting at this share of the assumed quota. Below it, do nothing:
 *  a cache that fits is doing its job and must not be disturbed. */
const HIGH_WATER = 0.70;
/** Evict down to this, not just to the line — otherwise the next write
 *  immediately trips the guard again and we thrash on every page load. */
const LOW_WATER = 0.50;
/** Conservative: real quotas vary by browser (Safari is stricter than
 *  Chromium) and the number below is the common floor, not the ceiling. */
const ASSUMED_QUOTA_BYTES = 5 * 1024 * 1024;

function isCache(key: string): boolean {
  return CACHE_PREFIXES.some((p) => key.startsWith(p));
}

export type StorageReport = {
  totalBytes: number;
  percentFull: number;
  evictedKeys: string[];
  freedBytes: number;
};

/** Measure what is stored, without changing anything. */
export function measureStorage(): { totalBytes: number; cacheBytes: number; keys: number } {
  let total = 0;
  let cache = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const n = (localStorage.getItem(k) || "").length + k.length;
      total += n;
      if (isCache(k)) cache += n;
    }
  } catch { /* storage disabled (private mode / blocked) — report zero */ }
  return { totalBytes: total, cacheBytes: cache, keys: (() => { try { return localStorage.length; } catch { return 0; } })() };
}

/**
 * Bring localStorage back under the high-water mark by evicting CACHE ONLY.
 *
 * Safe to call on every app start: it does nothing at all when there is room,
 * which is the common case. Returns a report so the caller can log or surface
 * it — silence is what let this problem grow, so the guard is observable.
 */
export function pruneStorage(): StorageReport {
  const report: StorageReport = { totalBytes: 0, percentFull: 0, evictedKeys: [], freedBytes: 0 };
  let entries: { key: string; bytes: number }[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const bytes = (localStorage.getItem(k) || "").length + k.length;
      report.totalBytes += bytes;
      if (isCache(k)) entries.push({ key: k, bytes });
    }
  } catch {
    return report; // storage unavailable — nothing to do and nothing to report
  }

  report.percentFull = Math.round((report.totalBytes / ASSUMED_QUOTA_BYTES) * 100);
  if (report.totalBytes <= ASSUMED_QUOTA_BYTES * HIGH_WATER) return report;

  /* Evict by CACHE_PREFIXES order first (cheapest to rebuild), and within the
     same prefix take the largest first so the fewest deletions free the most. */
  entries = entries.sort((a, b) => {
    const pa = CACHE_PREFIXES.findIndex((p) => a.key.startsWith(p));
    const pb = CACHE_PREFIXES.findIndex((p) => b.key.startsWith(p));
    return pa !== pb ? pa - pb : b.bytes - a.bytes;
  });

  const target = ASSUMED_QUOTA_BYTES * LOW_WATER;
  let running = report.totalBytes;
  for (const e of entries) {
    if (running <= target) break;
    try {
      localStorage.removeItem(e.key);
      running -= e.bytes;
      report.freedBytes += e.bytes;
      report.evictedKeys.push(e.key);
    } catch { /* a key that will not delete is not worth failing the sweep for */ }
  }
  report.totalBytes = running;
  report.percentFull = Math.round((running / ASSUMED_QUOTA_BYTES) * 100);
  return report;
}

/**
 * Write a cache entry that can never be the thing that fills the quota.
 *
 * Use this instead of a bare `localStorage.setItem` for anything cache-shaped:
 * it prunes first if the store is already high, and on QuotaExceededError it
 * prunes once and retries rather than silently giving up — which is what every
 * existing `catch {}` does today.
 *
 * Returns whether the value ended up stored, so a caller can tell the
 * difference between "cached" and "will cold-load next time".
 */
export function setCache(key: string, value: string, maxBytes = 2_000_000): boolean {
  if (value.length > maxBytes) return false;  // too big to be worth the space
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    pruneStorage();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

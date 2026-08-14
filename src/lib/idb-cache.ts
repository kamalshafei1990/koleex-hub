"use client";

/* ---------------------------------------------------------------------------
   idb-cache — the warm-start store for caches that outgrow localStorage.

   WHY THIS EXISTS. Measured on the owner's browser 2026-08-15: the contacts
   directory cache was 5.9 KB per contact — 2,044 KB for 344 contacts on the
   `:all` key alone, and it is written once per filter. The target is 6,000
   contacts, which is roughly

       6,000 × 5.9 KB ≈ 35 MB   against a ~5 MB localStorage quota

   — about 7× over on one key. `storage-guard` keeps the app working past that
   line by evicting, but evicting the warm start is the same as not having one.
   IndexedDB has no 5 MB ceiling (hundreds of MB, quota-managed) and is
   ASYNCHRONOUS, so a large read no longer blocks the main thread the way a
   2 MB `localStorage.getItem` + `JSON.parse` does.

   ⚠️ ASYNC IS THE WHOLE COST, AND IT DECIDES WHAT MAY MOVE HERE. A cache read
   during render — a lazy `useState` initialiser — CANNOT come from IndexedDB:
   the value arrives after the first paint and the screen moves. Product Data's
   `readMetaCache` is exactly that (its own comment records the card "jumping a
   little to the right then back" when it was read late), so those caches stay
   in localStorage on purpose; they are also small and bounded. Only caches
   already read inside an effect — with a loading or refreshing state on screen
   — belong here. Contacts is one; check before adding another.

   ── SECURITY: THIS STORE IS INSIDE THE SIGN-OUT WIPE ──────────────────────
   ⚠️ Contact directories are tenant data. `session-caches.ts` exists because a
   soft-nav sign-out used to leave warm-start caches behind, so a different user
   on a shared device could paint the previous user's data. Moving a cache here
   without wiring it into that wipe would silently re-open exactly that hole —
   so `clearScopedIdbCaches()` below is called from `clearSessionScopedCaches()`
   and is awaited before the sign-out navigation. Keys stay tenant-scoped too.
   If you add a cache here, it inherits the wipe only if its key starts with one
   of the SCOPED_PREFIXES those two files share.

   FALLBACK. If IndexedDB is unavailable (private mode, blocked, or an old
   engine), every function degrades to localStorage under the same key. That
   path is still covered by the sign-out wipe, because the key prefix is the
   same one `session-caches` sweeps.
   --------------------------------------------------------------------------- */

const DB_NAME = "koleex-cache";
const DB_VERSION = 1;
const STORE = "kv";

/** One connection per tab, opened lazily and reused. A failed open resolves to
 *  null rather than rejecting — callers fall back to localStorage instead of
 *  having to care why IndexedDB is missing. */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      /* Private mode in some engines neither resolves nor errors — do not let a
         warm start hang on it. 2s is far longer than a real open (<10ms). */
      setTimeout(() => resolve(null), 2000);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(null);
        t.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }).catch(() => null);
}

/* ── localStorage fallback, used when IndexedDB is not available ─────────── */

function lsGet(key: string): unknown | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Read a cached value. Returns null for "not cached" and for every failure —
 * a warm start that cannot read its cache is a cold start, never an error.
 *
 * ⚠️ Also migrates: a value still sitting in localStorage under the same key
 * (written by the pre-IndexedDB build) is returned AND moved here, then removed
 * from localStorage. That is what stops the first load after deploy from being
 * cold, and what stops the old copy lingering in a store it no longer belongs
 * in — which matters because the sign-out wipe should only have one place to
 * look for it going forward.
 */
export async function idbGet<T>(key: string): Promise<T | null> {
  const hit = await tx<unknown>("readonly", (s) => s.get(key) as IDBRequest<unknown>);
  if (hit != null) return hit as T;

  if (typeof window === "undefined") return null;
  const legacy = lsGet(key);
  if (legacy == null) return null;
  /* Move it, then drop the old copy. Both are best-effort: if the write fails
     the value is still returned, and the next visit simply migrates again. */
  void idbSet(key, legacy);
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  return legacy as T;
}

/**
 * Write a cached value. Resolves true only if it is actually stored, so a
 * caller can tell "cached" from "will cold-load next time".
 *
 * Stores the live object, not a JSON string: IndexedDB uses structured clone,
 * so skipping `JSON.stringify`/`parse` is both faster and avoids doubling the
 * payload in memory while it is being written.
 */
export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const ok = await tx<IDBValidKey>("readwrite", (s) => s.put(value, key));
  if (ok !== null) return true;
  /* No IndexedDB — fall back to localStorage through the guard, which prunes
     and retries instead of silently dropping the write on a full store. */
  try {
    const { setCache } = await import("@/lib/storage-guard");
    return setCache(key, JSON.stringify(value));
  } catch { return false; }
}

/** Delete one key from both stores. Best-effort and idempotent. */
export async function idbDel(key: string): Promise<void> {
  await tx<undefined>("readwrite", (s) => s.delete(key));
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * ⚠️ SIGN-OUT WIPE. Remove every key under the given prefixes.
 *
 * Called from `clearSessionScopedCaches()` and AWAITED before the sign-out
 * navigation, so the delete cannot be cut short by the hard reload on the
 * legacy path. Keep it awaited: an unawaited version appears to work in
 * development and loses the race on a real sign-out.
 */
export async function clearScopedIdbCaches(prefixes: readonly string[]): Promise<void> {
  const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  if (!keys?.length) return;
  const doomed = keys.filter((k) => typeof k === "string" && prefixes.some((p) => k.startsWith(p)));
  await Promise.all(doomed.map((k) => tx<undefined>("readwrite", (s) => s.delete(k))));
}

/** Everything currently held here, for diagnostics — used by the storage
 *  report so "what is cached" has one answer across both stores. */
export async function idbKeys(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  return (keys || []).filter((k): k is string => typeof k === "string");
}

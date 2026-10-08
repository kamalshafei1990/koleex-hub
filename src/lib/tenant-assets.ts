"use client";

/* ---------------------------------------------------------------------------
   tenant-assets — ONE shared client fetch for /api/quotations/saved-assets.

   The tenant's stamp + signature were fetched independently by every document
   surface — Quotations, Invoices, Contracts, Packing Lists, and Settings each
   issued their own GET on mount. Measured on a single app open (dev,
   2026-10-08): the same URL fired twice in parallel, ~900 ms each from China
   (the database lives in Tokyo; every round-trip pays that latency). Across an
   app-hopping session the same two values were re-downloaded on every launch.

   This module turns that into: one inflight promise shared by every caller,
   one result cached for 60 s of session time, and an explicit invalidation
   hook for the POST/DELETE writers so an upload in Settings is visible the
   next time a document asks.

   globalThis-anchored so separate client chunks share one store (same pattern
   as lib/geo/state-city-lazy.ts, SYS-4).
   --------------------------------------------------------------------------- */

export interface SavedAssets {
  stampUrl: string | null;
  signatureUrl: string | null;
}

interface Store {
  data: SavedAssets | null;
  at: number;
  inflight: Promise<SavedAssets | null> | null;
}

const TTL_MS = 60_000;

const g = globalThis as typeof globalThis & { __kxSavedAssets?: Store };
const store: Store =
  g.__kxSavedAssets ?? (g.__kxSavedAssets = { data: null, at: 0, inflight: null });

/** Shared GET. Resolves to the tenant's saved stamp/signature, or null when
    the request failed (callers degrade to upload-only, as before). The result
    is cached for 60 s and concurrent callers share one network request. */
export function fetchSavedAssets(): Promise<SavedAssets | null> {
  if (store.data && Date.now() - store.at < TTL_MS) return Promise.resolve(store.data);
  if (store.inflight) return store.inflight;
  store.inflight = fetch("/api/quotations/saved-assets", { credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return null;
      const json = (await res.json()) as SavedAssets;
      store.data = json;
      store.at = Date.now();
      return json;
    })
    .catch(() => null)
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

/** Drop the cached copy. Every POST/DELETE to the same endpoint calls this so
    the next reader anywhere in the app sees the fresh asset, not the 60 s TTL's
    stale one. Also usable after a failed upload to clear a poisoned entry. */
export function invalidateSavedAssets(): void {
  store.data = null;
  store.at = 0;
}

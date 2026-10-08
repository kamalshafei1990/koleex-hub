"use client";

/* ---------------------------------------------------------------------------
   tenant-assets — ONE shared client fetch for /api/quotations/saved-assets.

   The tenant's stamp + signature were fetched independently by every document
   surface — Quotations, Invoices, Contracts, Packing Lists, and Settings each
   issued their own GET on mount. Measured on a single app open (dev,
   2026-10-08): the same URL fired twice in parallel, ~900 ms each from China
   (the database lives in Tokyo; every round-trip pays that latency). Across an
   app-hopping session the same two values were re-downloaded on every launch.

   This is a thin semantic wrapper over the Hub's ONE reference-data layer
   (lib/client-cache): one inflight promise shared by every caller, the result
   held for 60 s, nothing cached on failure. `invalidateSavedAssets` maps to
   the shared invalidation so POST/DELETE writers make the next reader fresh.
   Kept as its own module (not five inlined cachedGet calls) so the endpoint,
   the TTL and the response SHAPE live in exactly one place.
   --------------------------------------------------------------------------- */

import { cachedGet, invalidateCachedGet } from "@/lib/client-cache";

export interface SavedAssets {
  stampUrl: string | null;
  signatureUrl: string | null;
}

const URL = "/api/quotations/saved-assets";
const TTL_MS = 60_000;

/** Shared GET. Resolves to the tenant's saved stamp/signature, or null when
    the request failed (callers degrade to upload-only, as before). The result
    is cached for 60 s and concurrent callers share one network request. */
export async function fetchSavedAssets(): Promise<SavedAssets | null> {
  try {
    return await cachedGet<SavedAssets>(URL, TTL_MS);
  } catch {
    return null;
  }
}

/** Drop the cached copy. Every POST/DELETE to the same endpoint calls this so
    the next reader anywhere in the app sees the fresh asset, not the 60 s TTL's
    stale one. */
export function invalidateSavedAssets(): void {
  invalidateCachedGet(URL);
}

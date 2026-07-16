/* ---------------------------------------------------------------------------
   app-chunk-preload — warm the REAL next/dynamic client component chunk for
   heavy apps. (Phase 4 — Cold Start & First Application Launch)

   The gap this closes: `<Link prefetch>` / router.prefetch only warm the
   ROUTE / RSC shell code. The heavy interactive app itself is loaded via
   `next/dynamic(() => import("./App"))` inside the route, and that client
   chunk stays COLD until the user actually navigates — which is why the FIRST
   launch of Customers / Suppliers / CRM takes several seconds while the chunk
   downloads, but every launch after is instant (chunk cached).

   This registry maps an app id → a plain dynamic import of the same module the
   route lazy-loads. Calling it warms webpack's chunk cache; the route's own
   `dynamic()` import then resolves instantly. Deduplicated per session.

   Architecture split (see FIRST_APP_LAUNCH_ARCHITECTURE.md):
     · route prefetch          → route / RSC code       (Next <Link>)
     · preloadAppChunk         → real client app chunk  (this module)
     · business data           → still unfetched until navigation
   Never preloads an unauthorized app — the caller passes only authorized ids.
   --------------------------------------------------------------------------- */

/* Each preloader imports the SAME module the corresponding route lazy-loads,
   so the browser dedupes the chunk. For Customers/Suppliers we warm the
   production-default LEGACY implementation (the shared 11.6k-line Contacts
   chunk, used by the vast majority); cohort/server-list users still load their
   smaller adapter on click via the route's own dynamic loading state. */
const CHUNK_PRELOADERS: Record<string, () => Promise<unknown>> = {
  crm: () => import("@/components/crm/CRM"),
  customers: () => import("@/components/contacts/Contacts"),
  suppliers: () => import("@/components/contacts/Contacts"),
  quotations: () => import("@/components/quotations/Quotations"),
};

const warmed = new Set<string>();

/** True if this app has a real client chunk worth warming. */
export function hasChunkPreloader(appId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHUNK_PRELOADERS, appId);
}

/** Whether this app's chunk was already warmed this session (so a launch can
    be classified cold vs warm for telemetry). Apps without a preloader are
    treated as "warm" (nothing to warm → the launch cost isn't a cold chunk). */
export function wasChunkWarmed(appId: string): boolean {
  return !hasChunkPreloader(appId) || warmed.has(appId);
}

/** Warm the real client chunk for `appId` (best-effort, deduped per session).
    No-op for apps without a registered preloader, or once already warmed. */
export function preloadAppChunk(appId: string): void {
  if (warmed.has(appId)) return;
  const fn = CHUNK_PRELOADERS[appId];
  if (!fn) return;
  warmed.add(appId);
  try {
    void fn().catch(() => {
      // A failed warm just means the chunk loads on click as before — never
      // surface it. Allow a later retry.
      warmed.delete(appId);
    });
  } catch {
    warmed.delete(appId);
  }
}

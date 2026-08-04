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

import { isPreloadAllowed, readNetworkContext } from "./app-prefetch";

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
    No-op for apps without a registered preloader, or once already warmed.

    GATED ON THE CONNECTION. This module used to warm unconditionally while
    its sibling app-prefetch already refused to preload on Save-Data, a slow
    effective connection, a hidden tab or offline — so the cheap DATA warm was
    polite and the expensive CHUNK warm was not. Measured on a cold home load:
    the Customers/Suppliers chunk pulls 2,270 KB of the page's 3,502 KB of
    JavaScript (it carries the country-state-city dataset), it starts right
    AFTER the load event, and it took 3.3 s — competing for bandwidth with the
    page the user is actually waiting for. On a fast link that is free and the
    next launch is instant; on a slow one it is the reason the first open
    crawls. Same gate as the data warm, so both behave alike.

    `force` is for intent-driven warms (hover / focus on an app tile): the user
    has aimed at that app, so paying for its chunk is what they asked for. */
export function preloadAppChunk(appId: string, opts?: { force?: boolean }): void {
  if (warmed.has(appId)) return;
  if (!opts?.force && !isPreloadAllowed(readNetworkContext())) return;
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

/* ---------------------------------------------------------------------------
   app-prefetch — evidence-based route-preload strategy for app launches.
   (Phase 4 — Home & App Launch Performance)

   Next.js <Link> already prefetches route CODE for links in the viewport, and
   AppLaunchLink adds intent (hover/focus) prefetch. This module only decides
   the SMALL set of apps worth warming on IDLE (before any intent), and gates
   ALL preloading on network / device / authorization safety.

   Tiers (see docs/performance/APP_PREFETCH_STRATEGY.md):
     A — idle preload: the few most-launched, light-to-medium apps (from real
         activity data, NOT assumptions). Warmed on requestIdleCallback.
     B — intent-only: everything else active — prefetched on hover/focus/touch
         via AppLaunchLink.
     C — no automatic preload: heavy / sensitive / rare apps. Load on click only.

   Pure + framework-free so it is unit-testable; the browser reads happen in
   readNetworkContext().
   --------------------------------------------------------------------------- */

/** App ids (navigation.ts) chosen for idle preload — max 4. Sourced from the
    60-day launch ranking (Customers/Suppliers/Products/Quotations are the top
    business apps that are also light-to-medium to load). See
    APP_USAGE_AND_PRELOAD_RANKING.md. Keep this list SHORT — never idle-preload
    the whole catalogue. */
export const TIER_A_IDLE_PRELOAD: readonly string[] = ["customers", "suppliers", "products", "quotations"];

/** App ids explicitly excluded from ANY automatic preload (heavy / rare /
    sensitive): the Visual Library database (5k assets), the AI workspace, the
    activity monitor, the download center, finance dashboards, price calculator.
    They still load instantly on an explicit click. */
export const TIER_C_NO_PRELOAD: readonly string[] = [
  "database", "ai", "activity-monitor", "software-center", "finance", "price-calculator",
];

export function prefetchTier(appId: string): "A" | "B" | "C" {
  if (TIER_A_IDLE_PRELOAD.includes(appId)) return "A";
  if (TIER_C_NO_PRELOAD.includes(appId)) return "C";
  return "B";
}

export interface NetworkContext {
  saveData: boolean;
  /** navigator.connection.effectiveType, e.g. "4g" | "3g" | "2g" | "slow-2g". */
  effectiveType: string | null;
  hidden: boolean;
  online: boolean;
  /** navigator.deviceMemory (GB), if exposed. */
  deviceMemoryGb: number | null;
}

/** Whether idle/intent preloading is safe under the current conditions.
    Respects Save-Data, slow effective connection, hidden tab, offline, and
    low device memory. Pure — inject the context (browser read is separate). */
export function isPreloadAllowed(ctx: NetworkContext): boolean {
  if (ctx.saveData) return false;
  if (!ctx.online) return false;
  if (ctx.hidden) return false;
  if (ctx.effectiveType === "slow-2g" || ctx.effectiveType === "2g") return false;
  if (typeof ctx.deviceMemoryGb === "number" && ctx.deviceMemoryGb > 0 && ctx.deviceMemoryGb < 1) return false;
  return true;
}

/** The Tier-A apps this user is AUTHORIZED to open (never preload an app the
    permission set doesn't include — that would leak an unauthorized route).
    `moduleFor` maps an app id → its module name for the permission check. */
export function idlePreloadApps(
  authorizedAppIds: ReadonlySet<string>,
): string[] {
  return TIER_A_IDLE_PRELOAD.filter((id) => authorizedAppIds.has(id));
}

/** Read the live network / device context in the browser (safe defaults on
    servers / unsupported browsers → treated as "allowed" except Save-Data). */
export function readNetworkContext(): NetworkContext {
  if (typeof navigator === "undefined") {
    return { saveData: false, effectiveType: null, hidden: false, online: true, deviceMemoryGb: null };
  }
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return {
    saveData: !!conn?.saveData,
    effectiveType: conn?.effectiveType ?? null,
    hidden: typeof document !== "undefined" && document.visibilityState === "hidden",
    online: navigator.onLine !== false,
    deviceMemoryGb: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
  };
}

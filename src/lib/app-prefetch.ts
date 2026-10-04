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
/* KOLEEX AI IS WARMED ON HOME (owner, 2026-09-13: "extremely fast, almost no
   loading"). It was tier C as "the heavy AI workspace"; it is also the app
   this owner opens most, and the loading screen they see is its chunk
   downloading on the tap. The idle warm stays gated on Save-Data, a slow
   link, a hidden tab and being offline (isPreloadAllowed). */
export const TIER_A_IDLE_PRELOAD: readonly string[] = ["ai", "customers", "suppliers", "products", "quotations"];

/** App ids explicitly excluded from ANY automatic preload (heavy / rare /
    sensitive): the Visual Library database (5k assets), the activity monitor,
    the download center, finance dashboards, price calculator.
    They still load instantly on an explicit click. */
export const TIER_C_NO_PRELOAD: readonly string[] = [
  "database", "activity-monitor", "software-center", "finance", "price-calculator",
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
  /** The link MEASURED slow on this page load (see measuredSlowLink). */
  slowLink?: boolean;
}

/** Whether the HEAVY background warm — a whole app's client chunk, hundreds
    of KB to MB (Contacts alone is ~1.3 MB on the wire) — is worth paying
    now. Stricter than isPreloadAllowed: also off on a link measured slow,
    where that download would still be running when the user taps another
    app and would make that app wait (owner, 26/09, phone in China without a
    VPN: "some apps take long time in opening"). The cheap route/RSC prefetch
    and the intent warm on touch/hover (`force`) are unaffected. */
export function isHeavyPreloadAllowed(ctx: NetworkContext): boolean {
  return isPreloadAllowed(ctx) && !ctx.slowLink;
}

/* ── Measured link speed ──
   navigator.connection is missing on iPhone (Safari) and on Chrome it only
   buckets "4g" down to a 270 ms RTT — a phone in mainland China without a VPN
   reports "4g" while each round-trip to the Hub takes 300-900 ms. So judge by
   what this page load actually saw: the document's time to first byte, and
   the throughput of the scripts it has already downloaded. Recomputed on each
   call (a few entries, cheap), so a link that recovers is noticed. */
const SLOW_TTFB_MS = 700;
const SLOW_BYTES_PER_MS = 300; // ≈ 300 KB/s ≈ 2.4 Mbit/s
export function measuredSlowLink(): boolean {
  try {
    if (typeof performance === "undefined" || !performance.getEntriesByType) return false;
    const conn = (navigator as unknown as { connection?: { rtt?: number } }).connection;
    if (typeof conn?.rtt === "number" && conn.rtt >= 400) return true;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0 && nav.responseStart - nav.requestStart > SLOW_TTFB_MS) return true;
    let bytes = 0;
    let ms = 0;
    for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
      /* Real network downloads only: cached entries report transferSize 0. */
      if (e.initiatorType !== "script" || e.transferSize < 20_000) continue;
      const dl = e.responseEnd - e.responseStart;
      if (dl <= 0) continue;
      bytes += e.transferSize;
      ms += dl;
    }
    return bytes >= 100_000 && bytes / ms < SLOW_BYTES_PER_MS;
  } catch {
    return false;
  }
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
    slowLink: measuredSlowLink(),
  };
}

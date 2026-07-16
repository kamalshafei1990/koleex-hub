/* ---------------------------------------------------------------------------
   kx-perf — shared client performance instrumentation (Phase 2 observability).

   One tiny module every feature reuses instead of scattering timing code.
   Design rules (see docs/performance/OBSERVABILITY_ARCHITECTURE.md):

   · PRIVACY-SAFE BY CONSTRUCTION — only metric names from the dictionary,
     numeric values, and whitelisted short tags ever leave the browser.
     No URLs with params, no search text, no message text, no record data.
     Routes are normalized (`/customers/8f3a…` → `/customers/:id`).
   · NEVER THROWS — every entry point is wrapped; a metrics bug must not be
     able to break a business flow.
   · NEAR-ZERO OVERHEAD — records append to an in-memory buffer; batches are
     shipped at most every 20 s via `sendBeacon` (fire-and-forget, survives
     page unload) to /api/perf/ingest which turns them into structured logs.
   · PERCENTILE-READY — raw values are shipped (not pre-averaged) so P50/75/
     95/99 can be computed downstream.

   The dev-only Discuss performance panel subscribes to the same ring buffer,
   so panel and production metrics can never disagree.
   --------------------------------------------------------------------------- */

export type PerfTags = Record<string, string | number | boolean>;
export type PerfEntry = { n: string; v: number; t: number; tags?: PerfTags };

const MAX_BATCH = 50;
const FLUSH_MS = 20_000;
const RING_MAX = 200;

let buf: PerfEntry[] = [];
const ring: PerfEntry[] = [];
const counters = new Map<string, number>();
const listeners = new Set<(e: PerfEntry) => void>();
let flushTimer: number | null = null;
let inited = false;
let sid = "anon";

const isBrowser = () => typeof window !== "undefined";

function safeTags(tags?: PerfTags): PerfTags | undefined {
  if (!tags) return undefined;
  const out: PerfTags = {};
  let n = 0;
  for (const [k, v] of Object.entries(tags)) {
    if (n >= 8) break;
    if (!/^[a-z0-9_]{1,24}$/.test(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") { out[k] = v; n++; continue; }
    const s = String(v).slice(0, 64);
    if (/^[A-Za-z0-9 ._:/\-]*$/.test(s)) { out[k] = s; n++; }
  }
  return n ? out : undefined;
}

/** Collapse dynamic path segments so no record id / entity id is reported.
 *  `/customers/8f3a-…/edit` → `/customers/:id/edit`. */
export function normalizeRoute(path: string): string {
  try {
    return (
      path
        .split("?")[0]
        .split("/")
        .map((seg) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) || /^\d+$/.test(seg) || seg.length > 32
            ? ":id"
            : seg,
        )
        .join("/") || "/"
    ).slice(0, 80);
  } catch {
    return "unknown";
  }
}

function push(e: PerfEntry) {
  buf.push(e);
  ring.push(e);
  if (ring.length > RING_MAX) ring.shift();
  for (const l of listeners) { try { l(e); } catch { /* listener must not break perf */ } }
  if (buf.length >= MAX_BATCH) flush();
}

/** Record one measured duration (milliseconds). */
export function record(name: string, valueMs: number, tags?: PerfTags): void {
  try {
    if (!isBrowser() || !Number.isFinite(valueMs)) return;
    push({ n: name, v: +valueMs.toFixed(1), t: Date.now(), tags: safeTags(tags) });
  } catch { /* never throw */ }
}

/** Record a point-in-time event (shipped with value 1). */
export function event(name: string, tags?: PerfTags): void {
  record(name, 1, tags);
}

/** Increment a local counter; the SUM is shipped once per flush window
 *  (used for high-frequency ticks like polls / long tasks so instrumentation
 *  itself never floods the network). */
export function count(name: string, by = 1): void {
  try { counters.set(name, (counters.get(name) ?? 0) + by); } catch { /* ignore */ }
}

/** Start a manual timer: const end = time("x"); …; end({ok:true}) */
export function time(name: string, tags?: PerfTags): (extra?: PerfTags) => void {
  const t0 = isBrowser() ? performance.now() : 0;
  return (extra?: PerfTags) => record(name, performance.now() - t0, { ...tags, ...extra });
}

/** Dev-panel subscription to the live entry stream. */
export function subscribe(cb: (e: PerfEntry) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function recent(): PerfEntry[] { return ring.slice(); }

function flush(): void {
  try {
    for (const [n, v] of counters) {
      if (v > 0) { const e = { n, v, t: Date.now() }; ring.push(e); buf.push(e); }
    }
    counters.clear();
    if (!buf.length) return;
    const batch = buf.slice(0, MAX_BATCH);
    buf = buf.slice(MAX_BATCH);
    const body = JSON.stringify({ sid, m: batch });
    /* sendBeacon: async, survives unload, no response handling needed. */
    if (!navigator.sendBeacon?.("/api/perf/ingest", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/perf/ingest", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  } catch { /* never throw */ }
}

let offlineSince: number | null = null;

/** Idempotent bootstrap — called once from <PerfVitals/> in RootShell. */
export function initPerf(): void {
  if (!isBrowser() || inited) return;
  inited = true;
  try {
    sid = sessionStorage.getItem("kx_perf_sid") ?? crypto.randomUUID().slice(0, 8);
    sessionStorage.setItem("kx_perf_sid", sid);
  } catch { /* private mode */ }

  /* Cold-load timings from the Navigation Timing API. */
  try {
    const done = () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      const route = normalizeRoute(location.pathname);
      record("nav.cold.ttfb_ms", nav.responseStart, { route });
      record("nav.cold.dom_ms", nav.domContentLoadedEventEnd, { route });
      if (nav.loadEventEnd > 0) record("nav.cold.load_ms", nav.loadEventEnd, { route });
    };
    if (document.readyState === "complete") done();
    else window.addEventListener("load", () => setTimeout(done, 0), { once: true });
  } catch { /* ignore */ }

  /* Long tasks — aggregated per flush window (count + total ms). */
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { count("longtask.count"); count("longtask.ms", Math.round(e.duration)); }
    }).observe({ type: "longtask", buffered: false });
  } catch { /* unsupported browser */ }

  /* Online / offline / reconnect transitions. */
  try {
    window.addEventListener("offline", () => { offlineSince = performance.now(); event("net.offline"); });
    window.addEventListener("online", () => {
      record("net.reconnect_ms", offlineSince ? performance.now() - offlineSince : 0);
      offlineSince = null;
    });
  } catch { /* ignore */ }

  /* Ship pending metrics when the app is backgrounded / closed. */
  try {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    window.addEventListener("pagehide", flush);
    flushTimer = window.setInterval(flush, FLUSH_MS);
    void flushTimer;
  } catch { /* ignore */ }
}

/* ── Warm navigation timing (route-to-route inside the SPA shell) ────────
   markNavStart() is called from a document-level capture click listener in
   <PerfVitals/>; completeNav() from its usePathname() effect. */
let navStart: { t: number; from: string } | null = null;
export function markNavStart(fromPath: string): void {
  navStart = { t: performance.now(), from: normalizeRoute(fromPath) };
}
export function completeNav(toPath: string): void {
  try {
    if (!navStart) return;
    const dt = performance.now() - navStart.t;
    /* Ignore stale marks (user clicked but nav never happened). */
    if (dt < 60_000) {
      record("nav.warm_ms", dt, { from: navStart.from, to: normalizeRoute(toPath) });
      /* If this navigation was an explicit app launch (AppLaunchLink), also
         emit an app-keyed launch-to-usable-shell timing so the launch journey
         is measurable per app. `app` is a normalized app id — never PII. */
      if (pendingLaunch && performance.now() - pendingLaunch.t < 60_000) {
        record("app_launch.nav_ms", dt, { app: pendingLaunch.app });
      }
    }
    navStart = null;
    pendingLaunch = null;
  } catch { /* ignore */ }
}

/* ── App-launch journey timing (Home / sidebar / launcher) ───────────────────
   The launch surface calls markAppLaunch(appId) on activation. It records the
   press→activate feedback delay (should be ~0 with CSS :active) and marks the
   launch so completeNav() can attribute the warm-nav time to this app. Only a
   normalized app id + numeric ms ever leave the browser. */
let pendingLaunch: { app: string; t: number } | null = null;
export function markAppLaunch(app: string, pressToActivateMs?: number, cold?: boolean): void {
  try {
    if (!isBrowser()) return;
    const a = /^[a-z0-9_-]{1,32}$/.test(app) ? app : "unknown";
    pendingLaunch = { app: a, t: performance.now() };
    event("app_launch.open", { app: a });
    if (typeof pressToActivateMs === "number" && Number.isFinite(pressToActivateMs)) {
      record("app_launch.press_feedback_ms", Math.max(0, pressToActivateMs), { app: a });
      /* Cold = the app's real client chunk was NOT warmed before this press, so
         the launch pays the dynamic-chunk download. Separating cold from warm
         is the whole point of this subphase (see FIRST_APP_LAUNCH_ARCHITECTURE). */
      if (cold) record("app_launch.cold.press_feedback_ms", Math.max(0, pressToActivateMs), { app: a });
    }
  } catch { /* never throw */ }
}

/* ── Cold-start: Home visible-vs-interactive (Phase 4 — Cold Start) ───────────
   Proves or disproves "Home visible but not interactive". Called once when the
   Home app grid's React handlers are attached (mount effect). Records the time
   from navigation start to interactive, plus the browser-measured First Input
   Delay (the gap between the user's first tap and the handler running). Only
   durations leave the browser — never account/permission/route content. */
let homeInteractiveDone = false;
export function markHomeInteractive(): void {
  try {
    if (!isBrowser() || homeInteractiveDone) return;
    homeInteractiveDone = true;
    const nav = performance.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    const start = nav?.startTime ?? 0;
    record("home.interactive_ms", Math.max(0, performance.now() - start));
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { processingStart?: number }>) {
          if (typeof e.processingStart === "number") {
            record("home.first_input_delay_ms", Math.max(0, e.processingStart - e.startTime));
          }
          po.disconnect();
          return;
        }
      });
      po.observe({ type: "first-input", buffered: true });
    } catch { /* first-input entry type unsupported → skip */ }
  } catch { /* never throw */ }
}

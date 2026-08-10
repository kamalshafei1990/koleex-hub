"use client";

/* ---------------------------------------------------------------------------
   load-progress — the REAL percentage behind every loading bar.
   (Owner requirement 2026-08-08: "the bar can load real not fake shape")

   One global counter of same-origin /api GET requests: started++ when a
   fetch leaves, settled++ when it resolves/rejects (or when the counting
   TIMEOUT fires — a hung request may take forever, but it is not allowed
   to freeze every loading bar after it). A loading surface snapshots the
   counters on mount; its percentage = settled-share ÷ started-share since
   mount, with the requests already in flight AT mount counted into both
   sides fairly. That is the actual network completion ratio — no simulated
   crawl. Jumpy steps ARE the truth.

   Deliberately excluded from tracking:
     · non-GET (mutations shouldn't move a loading bar)
     · /api/ai/* and /api/translator (streaming — they resolve on stream END)
     · /api/perf/* (instrumentation must not instrument itself)
     · any request explicitly asking for text/event-stream
     · cross-origin (Supabase realtime/storage etc.)

   INSTALL AT BOOT: AppLaunchSplash (root-mounted) calls
   ensureLoadProgressPatch() at module scope, so the patch is in place
   BEFORE any screen fires its data requests. BrandLoading re-calls it as a
   harmless idempotent backup.

   SYS-4: state anchors on globalThis so Turbopack chunk duplication can
   never split the counter. The patch always delegates to the original —
   a tracking failure can never break a request. */

interface LpState {
  started: number;
  settled: number;
  listeners: Set<() => void>;
  patched: boolean;
  nav: NavBaseline | null;
}

/* ONE navigation's baseline, shared by every loading surface in its chain.
   A navigation renders several gates back to back — route boundary, dynamic
   fallback, full-page data gate — and each used to snapshot its OWN
   baseline on mount, so the bar visibly reset and refilled at every
   handoff: the owner's "the loading bar… appears and disappears". The
   baseline (and the monotonic max) now live here: an acquiring surface
   reuses the chain's baseline if the previous holder released within the
   handoff window, so the percentage CONTINUES across stages. */
export interface NavBaseline {
  started: number;
  settled: number;
  inflight: number;
  maxPct: number;
  holders: number;
  releasedAt: number;
}
const HANDOFF_MS = 400;

const g = globalThis as typeof globalThis & { __kxLoadProgress?: LpState };
const st: LpState =
  g.__kxLoadProgress ?? (g.__kxLoadProgress = { started: 0, settled: 0, listeners: new Set(), patched: false, nav: null });

/* A request pending longer than this stops holding bars hostage: it gets
   counted as settled for PROGRESS purposes only (the request itself keeps
   running normally). 25s ≈ well past any healthy call, even cross-border. */
const COUNT_TIMEOUT_MS = 25_000;

function notify(): void {
  for (const l of st.listeners) {
    try { l(); } catch { /* listener bugs never break fetch */ }
  }
}

function headerAccept(input: RequestInfo | URL, init?: RequestInit): string {
  try {
    const h = init?.headers;
    if (h) {
      if (h instanceof Headers) return h.get("accept") ?? "";
      if (Array.isArray(h)) return (h.find(([k]) => k.toLowerCase() === "accept")?.[1]) ?? "";
      const rec = h as Record<string, string>;
      for (const k of Object.keys(rec)) if (k.toLowerCase() === "accept") return rec[k];
    }
    if (typeof input === "object" && input !== null && "headers" in input) {
      return (input as Request).headers.get("accept") ?? "";
    }
  } catch { /* fall through */ }
  return "";
}

function isTracked(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    const method = (
      init?.method ??
      (typeof input === "object" && input !== null && "method" in input ? (input as Request).method : "GET")
    ).toUpperCase();
    if (method !== "GET") return false;
    /* Route navigation payloads: the App Router fetches these for every
       in-app move, so a gate that is waiting purely on navigation still
       has something honest to count. */
    if (u.searchParams.has("_rsc")) return true;
    if (!u.pathname.startsWith("/api/")) return false;
    if (u.pathname.startsWith("/api/ai")) return false;
    if (u.pathname.startsWith("/api/translator")) return false;
    if (u.pathname.startsWith("/api/perf")) return false;
    if (u.pathname.startsWith("/api/discuss/stream")) return false;
    if (headerAccept(input, init).includes("text/event-stream")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Install the counting patch (idempotent). Called at boot from
 *  AppLaunchSplash's module scope + defensively from BrandLoading. */
export function ensureLoadProgressPatch(): void {
  if (st.patched || typeof window === "undefined") return;
  st.patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isTracked(input, init)) return orig(input as RequestInfo, init);
    st.started += 1;
    notify();
    let counted = false;
    const settle = () => {
      if (counted) return;
      counted = true;
      st.settled += 1;
      notify();
    };
    const timer = window.setTimeout(settle, COUNT_TIMEOUT_MS);
    return orig(input as RequestInfo, init).finally(() => {
      window.clearTimeout(timer);
      settle();
    });
  }) as typeof window.fetch;
}

export function subscribeLoadProgress(cb: () => void): () => void {
  st.listeners.add(cb);
  return () => st.listeners.delete(cb);
}

export function snapshotLoadProgress(): { started: number; settled: number } {
  return { started: st.started, settled: st.settled };
}

/** A loading surface joins the current navigation's progress chain (or
 *  starts a new one if the previous chain ended more than a beat ago). */
export function acquireNavBaseline(): NavBaseline {
  const now = Date.now();
  let b = st.nav;
  if (!b || (b.holders === 0 && now - b.releasedAt > HANDOFF_MS)) {
    b = st.nav = {
      started: st.started,
      settled: st.settled,
      inflight: Math.max(0, st.started - st.settled),
      maxPct: 0,
      holders: 0,
      releasedAt: 0,
    };
  }
  b.holders += 1;
  return b;
}

export function releaseNavBaseline(b: NavBaseline): void {
  b.holders = Math.max(0, b.holders - 1);
  b.releasedAt = Date.now();
}

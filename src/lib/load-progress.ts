"use client";

/* ---------------------------------------------------------------------------
   load-progress — the REAL percentage behind every loading bar.
   (Owner requirement 2026-08-08: "the bar can load real not fake shape")

   One global counter of same-origin /api GET requests: started++ when a
   fetch leaves, settled++ when it resolves or rejects. A loading surface
   snapshots the counters on mount; its percentage = settled-since-mount ÷
   started-since-mount. That is the actual network completion ratio — no
   simulated crawl, no time-based easing. Jumpy steps ARE the truth.

   Deliberately excluded from tracking:
     · non-GET (mutations shouldn't move a loading bar)
     · /api/ai/* (streaming responses resolve when the stream ENDS)
     · /api/perf/* (instrumentation must not instrument itself)
     · cross-origin (Supabase realtime/storage etc.)

   SYS-4: state anchors on globalThis so Turbopack chunk duplication can
   never split the counter into parallel copies. The fetch patch installs
   once and always delegates to the original — a failure in tracking can
   never break a request. */

interface LpState {
  started: number;
  settled: number;
  listeners: Set<() => void>;
  patched: boolean;
}

const g = globalThis as typeof globalThis & { __kxLoadProgress?: LpState };
const st: LpState =
  g.__kxLoadProgress ?? (g.__kxLoadProgress = { started: 0, settled: 0, listeners: new Set(), patched: false });

function notify(): void {
  for (const l of st.listeners) {
    try { l(); } catch { /* listener bugs never break fetch */ }
  }
}

function isTracked(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    if (!u.pathname.startsWith("/api/")) return false;
    if (u.pathname.startsWith("/api/ai")) return false;
    if (u.pathname.startsWith("/api/perf")) return false;
    const method = (
      init?.method ??
      (typeof input === "object" && "method" in input ? (input as Request).method : "GET")
    ).toUpperCase();
    return method === "GET";
  } catch {
    return false;
  }
}

/** Install the counting patch (idempotent; call from any loading surface). */
export function ensureLoadProgressPatch(): void {
  if (st.patched || typeof window === "undefined") return;
  st.patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isTracked(input, init)) return orig(input as RequestInfo, init);
    st.started += 1;
    notify();
    return orig(input as RequestInfo, init).finally(() => {
      st.settled += 1;
      notify();
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

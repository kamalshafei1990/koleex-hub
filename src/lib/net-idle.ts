"use client";

/* ---------------------------------------------------------------------------
   whenNetworkQuiet — "wait until the screen has finished FETCHING", which is
   not the same question as requestIdleCallback answers.

   THE MEASUREMENT THAT CREATED THIS (2026-08-21, Product Data, dev server):
   nine API calls left the browser inside the first 820ms of a screen open and
   throttled each other — /api/shell alone took 6.5s and /api/catalog-refs
   7.9s. Two of those nine were pure background beacons (the presence
   heartbeat and the deploy-version check), and BOTH were already written to
   stay out of the way: each waits for requestIdleCallback before firing.

   They fired at 815ms and 816ms anyway, and the reason is the mechanism, not
   the intent: requestIdleCallback reports MAIN-THREAD idleness. While six
   fetches are in flight the main thread is doing nothing at all — so the
   browser calls it idle, and the beacon adds itself to the queue it was
   trying to avoid. The comment in ActivityTracker states the goal exactly
   ("nothing on screen waits for it, so it must not compete with the data
   that is") — this is the missing instrument for it.

   What this measures instead: the moment no NEW /api/ request has started
   for `quietMs`. PerformanceObserver sees every request regardless of which
   layer issued it — cached, batched or raw fetch — so nothing can slip past
   it the way a per-caller counter would.

   Never blocks forever: `maxWaitMs` is a hard ceiling, and a browser without
   PerformanceObserver falls back to a plain timer. Both paths resolve.
   --------------------------------------------------------------------------- */

export function whenNetworkQuiet(opts?: {
  /** No new API request started for this long = quiet. */
  quietMs?: number;
  /** Ceiling — resolve regardless, so a chatty screen cannot starve callers. */
  maxWaitMs?: number;
}): Promise<void> {
  const quietMs = opts?.quietMs ?? 700;
  const maxWaitMs = opts?.maxWaitMs ?? 6000;

  if (typeof window === "undefined") return Promise.resolve();
  if (typeof PerformanceObserver === "undefined") {
    return new Promise((r) => window.setTimeout(r, Math.min(quietMs * 2, maxWaitMs)));
  }

  return new Promise((resolve) => {
    let lastApiAt = performance.now();
    let done = false;
    let obs: PerformanceObserver | null = null;
    let timer = 0;

    const finish = () => {
      if (done) return;
      done = true;
      try { obs?.disconnect(); } catch { /* already gone */ }
      window.clearTimeout(timer);
      resolve();
    };

    /* Seed from what has ALREADY been requested this navigation: a caller
       mounting late must not see a fresh-looking clock and fire instantly. */
    try {
      const seen = performance.getEntriesByType("resource");
      for (const e of seen) {
        if (e.name.includes("/api/")) lastApiAt = Math.max(lastApiAt, e.startTime);
      }
    } catch { /* resource timing unavailable — the tick below still works */ }

    try {
      obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name.includes("/api/")) lastApiAt = Math.max(lastApiAt, e.startTime);
        }
      });
      obs.observe({ type: "resource", buffered: true });
    } catch { /* observation failed — the ceiling below still resolves */ }

    const deadline = performance.now() + maxWaitMs;
    const tick = () => {
      if (done) return;
      const now = performance.now();
      if (now - lastApiAt >= quietMs || now >= deadline) { finish(); return; }
      timer = window.setTimeout(tick, 150);
    };
    timer = window.setTimeout(tick, 150);
  });
}

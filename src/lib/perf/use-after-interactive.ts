"use client";

/* ---------------------------------------------------------------------------
   useAfterInteractive — gate non-critical on-mount work behind first idle.
   (Phase 4 — Platform Speed Max-Out, Workstream 1: Home hydration reduction)

   Returns `false` during the hydration-critical window, then flips to `true`
   once the browser is idle after first paint (requestIdleCallback, with a short
   setTimeout fallback where unsupported). Use it to defer decorative /
   non-critical effects — badge-count fetches, realtime subscriptions, analytics
   — so PRIMARY navigation (the app grid) becomes interactive first, then the
   deferred work runs a beat later.

   It changes ONLY *when* the work starts, never *whether* it runs or its
   security/correctness — the gated effect still fetches, still subscribes, still
   cleans up. Fully reversible: delete the hook and treat the value as `true`.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useAfterInteractive(timeout = 2000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") { setReady(true); return; }
    const w = window as IdleWindow;
    const fire = () => setReady(true);

    if (typeof w.requestIdleCallback === "function") {
      const handle = w.requestIdleCallback(fire, { timeout });
      return () => w.cancelIdleCallback?.(handle);
    }
    // Fallback: a small delay still lets first paint + hydration settle first.
    const handle = window.setTimeout(fire, 200);
    return () => window.clearTimeout(handle);
  }, [timeout]);

  return ready;
}

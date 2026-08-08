"use client";

/* ---------------------------------------------------------------------------
   BrandLoading — THE one loading moment for every full-content surface.
   (Loading language v2, owner picks 2026-08-08: sample "B — logo breath"
   + progress style "P1 — thin line with a REAL percentage".)

   The KOLEEX hub lockup breathing over a clean surface. Under it:
     · When same-origin /api GETs are observed since this surface mounted,
       a thin Hub Blue line FILLS with the real completion ratio
       (settled ÷ started — see lib/load-progress) and a small % reads out.
       The jumps are uneven because the network is — that is the point.
     · Until any request is seen, the indeterminate light sweep shows
       (never a fake crawling percentage).

   Use for APP-LEVEL gates only (route loading.tsx, dynamic fallbacks,
   full data gates) — small in-place placeholders stay quiet text/spinners.
   CSS-only animation, theme-aware webp pair, reduced-motion-safe. */

import { useEffect, useRef, useState } from "react";
import { ensureLoadProgressPatch, snapshotLoadProgress, subscribeLoadProgress } from "@/lib/load-progress";

/* Minimum requests before a percentage is worth showing (3 → 0/33/66/100).
   Fewer than this and the bar runs indeterminate instead of pretending. */
const MEANINGFUL_REQUESTS = 3;

/* Height of the loading surface. Owner report: "the loading page is not
   centred, it dances up and down because I can scroll while it's showing".
   Cause: the gate was min-h-screen (100vh) sitting BELOW the app header, so
   the page was taller than the viewport by the header height — the logo was
   centred in the block, not on screen, and the whole thing scrolled. Fixed
   height = visible area (dvh, so the iOS URL bar can't change it mid-scroll)
   minus the header, and nothing can overflow. */
const SURFACE = "h-[calc(100dvh-var(--kx-header-h,3.5rem))] overflow-hidden";

export default function BrandLoading({
  label = "Loading…",
  className = SURFACE,
}: {
  label?: string;
  /** Sizing/positioning of the surface the loader centers in. Defaults to
   *  exactly the visible content area — pass your own only for embedded
   *  (non-full-page) gates. */
  className?: string;
}) {
  const [pct, setPct] = useState<number | null>(null);
  const maxRef = useRef(0);

  useEffect(() => {
    ensureLoadProgressPatch();
    const base = snapshotLoadProgress();
    /* Requests already in flight when this gate appeared belong to the
       thing the user is waiting for — count them into BOTH sides, so a
       gate that mounts one tick after the screen fired its fetches still
       shows an honest ratio instead of nothing (the "no percentage in
       most apps" bug) or a fake instant-100%. */
    const baseInflight = Math.max(0, base.started - base.settled);
    const update = () => {
      const now = snapshotLoadProgress();
      const started = now.started - base.started + baseInflight;
      const settled = now.settled - base.settled;
      /* A percentage only MEANS something when there are enough requests
         for intermediate values to exist. Waiting on one request over a
         high-latency link can only ever read 0% then 100% — which looks
         broken and taught the owner to distrust the bar (his words: "it
         starts at zero, stays a long time, then suddenly 100%"). Below
         the threshold we show the moving indeterminate bar instead: the
         honest statement is "working", not a number we can't compute.
         Once it qualifies it stays qualified (no flicker back). */
      if (started < MEANINGFUL_REQUESTS && maxRef.current === 0) return;
      /* Monotonic display: late-starting requests grow the denominator,
         but a bar that moves backwards reads as broken. */
      const p = Math.max(maxRef.current, Math.min(100, Math.round((settled / Math.max(started, 1)) * 100)));
      maxRef.current = p;
      setPct(p);
    };
    update();
    return subscribeLoadProgress(update);
  }, []);

  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`relative w-full ${className}`}>
      <span className="sr-only">{label}</span>
      <div className="kx-brand-load" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- 17KB webp, no optimization needed */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-dark.webp" alt="" className="kx-brand-logo-dark" />
        {/* eslint-disable-next-line @next/next/no-img-element -- theme twin of the above */}
        <img src="/brand/hub-logo/koleex-hub-logo-for-light.webp" alt="" className="kx-brand-logo-light" />
        {/* P6 "comet head" — ONE bar in every gate. With trackable requests
            it fills to the REAL ratio and shows the number; otherwise the
            same bar slides indeterminately (chunk/RSC waits can't be
            counted honestly, so no number is invented). */}
        <div className={`kx-brand-progress${pct === null ? " is-indeterminate" : ""}`}>
          <i style={pct === null ? undefined : { width: `${pct}%` }} />
        </div>
        {pct !== null && <div className="kx-brand-pct">{pct}%</div>}
      </div>
    </div>
  );
}

"use client";

/* ---------------------------------------------------------------------------
   BrandLoading — THE one loading moment for every full-content surface.
   (Loading language v2, owner picks 2026-08-08: sample "B — logo breath"
   + progress style "P1 — thin line with a REAL percentage".)

   The KOLEEX hub lockup inside the Koleex orb (owner pick 2026-08-10 —
   see the .kx-orb block in globals.css). Under it:
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
import { useTranslation } from "@/lib/i18n";
import { commonT } from "@/lib/translations/common";
import { acquireNavBaseline, ensureLoadProgressPatch, releaseNavBaseline, snapshotLoadProgress, subscribeLoadProgress } from "@/lib/load-progress";

/* Minimum requests before a percentage is worth showing (3 → 0/33/66/100).
   Fewer than this and the bar runs indeterminate instead of pretending. */
const MEANINGFUL_REQUESTS = 3;

/* Height of the loading surface. Owner report: "the loading page is not
   centred, it dances up and down because I can scroll while it's showing".
   Cause: the gate was min-h-screen (100vh) sitting BELOW the app header, so
   the page was taller than the viewport by the header height — the logo was
   centred in the block, not on screen, and the whole thing scrolled.
   .kx-load-surface (globals) = exactly the visible area, with the shell's
   per-display-mode units — the earlier dvh version re-measured while the
   iOS toolbar slid and the orb drifted mid-load. */
const SURFACE = "kx-load-surface overflow-hidden";

export default function BrandLoading({
  label,
  className = SURFACE,
}: {
  /** Screen-reader text. Omit to get the translated default. */
  label?: string;
  /** Sizing/positioning of the surface the loader centers in. Defaults to
   *  exactly the visible content area — pass your own only for embedded
   *  (non-full-page) gates. */
  className?: string;
}) {
  const { t } = useTranslation(commonT);
  const [pct, setPct] = useState<number | null>(null);
  const maxRef = useRef(0);

  useEffect(() => {
    ensureLoadProgressPatch();
    /* The baseline belongs to the NAVIGATION, not to this instance: the
       route boundary, the dynamic fallback and the page's data gate render
       this same component back to back, and a per-mount baseline made the
       bar reset and refill at each handoff (owner: "the loading bar…
       appears and disappears"). Requests already in flight at chain start
       count into both sides, so a gate mounting one tick after the screen
       fired its fetches still shows an honest ratio. */
    const base = acquireNavBaseline();
    const update = () => {
      const now = snapshotLoadProgress();
      const started = now.started - base.started + base.inflight;
      const settled = now.settled - base.settled;
      /* A percentage only MEANS something when there are enough requests
         for intermediate values to exist. Waiting on one request over a
         high-latency link can only ever read 0% then 100% — which looks
         broken and taught the owner to distrust the bar (his words: "it
         starts at zero, stays a long time, then suddenly 100%"). Below
         the threshold we show the moving indeterminate bar instead: the
         honest statement is "working", not a number we can't compute.
         Once it qualifies it stays qualified (no flicker back). */
      if (started < MEANINGFUL_REQUESTS && base.maxPct === 0) return;
      /* Monotonic across the WHOLE chain: the max lives on the shared
         baseline, so the next stage resumes from the same number instead
         of flashing backwards. */
      const p = Math.max(base.maxPct, Math.min(100, Math.round((settled / Math.max(started, 1)) * 100)));
      base.maxPct = p;
      maxRef.current = p;
      setPct(p);
    };
    update();
    const unsub = subscribeLoadProgress(update);
    return () => {
      unsub();
      releaseNavBaseline(base);
    };
  }, []);

  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`relative w-full ${className}`}>
      <span className="sr-only">{label ?? t("ui.loading", "Loading\u2026")}</span>
      <div className="kx-brand-load" aria-hidden>
        {/* The orb. The lockup no longer breathes on its own — it sits inside
            the sphere and a highlight travels across it. The progress line
            below is UNCHANGED and deliberately so: the real completion ratio
            is the part of this screen that actually tells you something. */}
        <span className="kx-orb kx-orb--page">
          <span className="kx-orb-ball" />
          <span className="kx-orb-mark">
            {/* eslint-disable-next-line @next/next/no-img-element -- 17KB webp, no optimization needed */}
            <img src="/brand/hub-logo/koleex-hub-logo-for-dark.webp" alt="" className="kx-brand-logo-dark" />
            {/* eslint-disable-next-line @next/next/no-img-element -- theme twin of the above */}
            <img src="/brand/hub-logo/koleex-hub-logo-for-light.webp" alt="" className="kx-brand-logo-light" />
            <span className="kx-orb-shine"><i /></span>
          </span>
        </span>
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

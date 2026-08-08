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

export default function BrandLoading({
  label = "Loading…",
  className = "min-h-[60vh]",
}: {
  label?: string;
  /** Sizing/positioning of the surface the loader centers in. */
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
      if (started <= 0) return;
      const settled = now.settled - base.settled;
      /* Monotonic display: late-starting requests grow the denominator,
         but a bar that moves backwards reads as broken. */
      const p = Math.max(maxRef.current, Math.min(100, Math.round((settled / started) * 100)));
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

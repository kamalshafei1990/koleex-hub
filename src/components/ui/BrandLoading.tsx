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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ensureLoadProgressPatch, snapshotLoadProgress, subscribeLoadProgress } from "@/lib/load-progress";

export default function BrandLoading({
  label = "Loading…",
  className = "min-h-[60vh]",
  footer,
}: {
  label?: string;
  /** Sizing/positioning of the surface the loader centers in. */
  className?: string;
  /** Optional row under the progress line (e.g. the splash's app name). */
  footer?: ReactNode;
}) {
  const [pct, setPct] = useState<number | null>(null);
  const maxRef = useRef(0);

  useEffect(() => {
    ensureLoadProgressPatch();
    const base = snapshotLoadProgress();
    const update = () => {
      const now = snapshotLoadProgress();
      const started = now.started - base.started;
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
        {pct === null ? (
          <div className="kx-brand-underline" />
        ) : (
          <>
            <div className="kx-brand-progress">
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="kx-brand-pct">{pct}%</div>
          </>
        )}
        {footer}
      </div>
    </div>
  );
}

"use client";

/* CountUp — ours, not React Bits'.
   ---------------------------------------------------------------------------
   Their version is 101 lines and imports framer-motion. The Hub has NO
   animation library at all — not framer-motion, not gsap, not three — and one
   number ticking upward is not a reason to acquire the first one. So this is
   the same idea in a third of the code, on rAF, with no dependency.

   Written for KpiCard, which appears in 24 files: the value is already on
   screen the moment the data lands, and the count is only how it arrives.

   THREE RULES IT KEEPS, because a counter that breaks them is worse than a
   plain number:
     · prefers-reduced-motion gets the final value immediately;
     · the DOM always ends on the exact target, never on a rounding artefact;
     · re-rendering with the same value does not restart the count — a list
       that refreshes every few seconds would otherwise animate forever. */

import { useEffect, useRef, useState } from "react";

const DURATION = 900;

/** easeOutExpo — fast then settling, which reads as "landing on" a figure
 *  rather than sliding to it. Linear looks mechanical at this length. */
function ease(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function CountUp({
  value, decimals = 0, prefix = "", suffix = "", className = "",
}: {
  value: number; decimals?: number; prefix?: string; suffix?: string; className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === value) { setShown(value); from.current = value; return; }

    const start = performance.now();
    const a = from.current, b = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      /* The final frame assigns b itself rather than the eased value, so the
         number on screen is the number passed in — not 4,999.97 rounded. */
      setShown(t === 1 ? b : a + (b - a) * ease(t));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  return (
    /* tabular-nums so the digits do not jitter sideways while they change —
       without it a counter visibly shivers, which is the whole reason people
       decide animated numbers look cheap. */
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}{shown.toLocaleString(undefined, {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      })}{suffix}
    </span>
  );
}

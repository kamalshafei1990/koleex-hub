"use client";

/* CountUp — ours, not React Bits'.
   ---------------------------------------------------------------------------
   Their version is 101 lines and imports framer-motion. The Hub has NO
   animation library at all — not framer-motion, not gsap, not three — and one
   number ticking upward is not a reason to acquire the first one. So this is
   the same idea in a third of the code, on rAF, with no dependency.

   IT RESERVES ITS FINAL WIDTH, and that is not a nicety — it is what makes it
   safe to put inside KpiCard. Two things would otherwise break:

     · KpiCard shrink-fits long values by MEASURING the rendered width and
       re-fitting whenever it changes. A number counting from 0 to 48,250 goes
       from one character to six, so the width changes on almost every frame —
       the observer would re-fit continuously, which is the oscillation its own
       comment warns about.
     · Any card next to it would twitch as the box grew.

   So the target value is rendered once, invisible, to hold the box; the live
   value sits absolutely on top of it. The measured width is the FINAL width
   from the first frame, so the fit is computed once and correctly, and nothing
   moves while the digits change.

   THREE MORE RULES, because a counter that breaks them is worse than a plain
   number:
     · prefers-reduced-motion gets the final value immediately;
     · the DOM ends on the EXACT target, never a rounding artefact;
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
  value, format, className = "",
}: {
  value: number;
  /** Turns a number into the exact text to show. Supplied by the caller so
   *  currency, separators and locale stay wherever they already live. */
  format: (n: number) => string;
  className?: string;
}) {
  /* null means "not animating", and then the EXACT prop is rendered. Keeping
     the in-flight number as the only state means the not-animating paths —
     reduced motion, an unchanged value, the settled frame — write no state at
     all, which is both correct and what the hooks rule asks for. */
  const [anim, setAnim] = useState<number | null>(null);
  /* Starts at zero, not at the first value, so the count happens on APPEARANCE
     as well as on change. KPI cards are usually gated on `loading`, so the
     component mounts already holding the final figure — anchoring `from` to
     that would have meant the animation never ran on the screens it was built
     for. */
  const from = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === value) { from.current = value; return; }

    const start = performance.now();
    const a = from.current, b = value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      if (t < 1) {
        setAnim(a + (b - a) * ease(t));
        raf.current = requestAnimationFrame(tick);
      } else {
        /* Cleared rather than set to b, so the settled frame renders the PROP
           itself — the number on screen is the number passed in, never a
           rounding artefact of the easing. */
        from.current = b;
        setAnim(null);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  const shown = anim ?? value;

  return (
    <span className={`relative inline-block ${className}`} style={{ fontVariantNumeric: "tabular-nums" }}>
      {/* The sizer. It occupies the box so the width is the FINAL width from
          the very first paint — but it is also a second copy of the text in the
          DOM, so it is hidden from assistive tech AND from selection. Without
          user-select:none, copying the card gives "88" for a value of 8. */}
      <span aria-hidden className="invisible select-none">{format(value)}</span>
      <span className="absolute inset-0">{format(shown)}</span>
    </span>
  );
}

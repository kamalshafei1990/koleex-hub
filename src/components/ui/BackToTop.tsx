"use client";

/* ===========================================================================
   BackToTop — the way back up a long catalogue.

   Not a plain arrow button: the button IS a progress dial. A ring fills as
   you travel down the page, so the same control answers two questions at
   once — "how deep am I?" and "take me back". The ring is drawn in Hub Blue
   because here the colour is FUNCTIONAL (it encodes scroll position), which
   is exactly the case the monochrome brand rule reserves blue for.

   Behaviour details that make it feel native to the Hub:
   · Apps scroll inside #main-scroll-container, not the window — so the
     component finds its real scroll parent by walking up from where it is
     mounted, with window as the fallback. Listening on window here would
     produce a button that never appears.
   · Appears only after ~1.5 viewports of travel; below that, "top" is a
     flick away and a floating control is just noise.
   · Sits ABOVE the bottom-right cluster (AI / Discuss pill, panel
     launcher) so nothing stacks on anything.
   · rAF-throttled passive scroll listener — this rides pages with 80 cards.
   · Honors prefers-reduced-motion (instant jump instead of smooth).
   =========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";

/* Ring geometry: r=15.5 in a 36×36 viewBox → circumference ≈ 97.4. */
const R = 15.5;
const CIRC = 2 * Math.PI * R;

function isScrollable(el: HTMLElement): boolean {
  const s = getComputedStyle(el);
  return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
}

export default function BackToTop({ label }: { label: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const targetRef = useRef<HTMLElement | Window | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    /* Find the actual scroll parent by walking up from the anchor. */
    let el: HTMLElement | null = anchorRef.current?.parentElement ?? null;
    while (el && !isScrollable(el)) el = el.parentElement;
    const target: HTMLElement | Window = el ?? window;
    targetRef.current = target;

    let raf = 0;
    const read = () => {
      raf = 0;
      const top = el ? el.scrollTop : window.scrollY;
      const max = el
        ? el.scrollHeight - el.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const viewport = el ? el.clientHeight : window.innerHeight;
      setVisible(top > viewport * 1.5);
      setProgress(max > 0 ? Math.min(1, top / max) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };

    read();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toTop = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (target instanceof Window) target.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    else target.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  }, []);

  return (
    <>
      {/* Invisible anchor: its only job is to tell the effect where in the
          DOM we live, so the scroll-parent walk starts from the right spot. */}
      <span ref={anchorRef} aria-hidden="true" className="hidden" />
      <button
        type="button"
        onClick={toTop}
        title={label}
        aria-label={label}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        /* kx-glass-pop ONLY while visible — it was permanently pinning this
           button on screen. In Aurora that class is
             animation: kx-pop-in 0.28s … both;
           and `both` keeps the animation's final frame applied forever. An
           animation's computed value outranks a plain declaration, so the
           `opacity-0` below never took effect: measured on prod, the button
           reported aria-hidden="true" with the opacity-0 class present and a
           computed opacity of 1, at scrollTop 0. It sat over the catalogue on
           every screen, and on a phone it covered the division strip.

           Applying the class only in the visible state gives the pop-in
           exactly where it belongs — on appearance — and lets the hidden
           state actually hide. */
        className={`group fixed z-[35] end-4 md:end-5 h-11 w-11 rounded-full
          bg-[var(--bg-secondary)] border border-[var(--border-subtle)]
          shadow-[0_6px_24px_rgba(0,0,0,0.35)]
          flex items-center justify-center
          text-[var(--text-muted)] hover:text-[var(--text-primary)]
          transition-all duration-300
          ${visible ? "kx-glass-pop opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}
        style={{
          /* The bottom-right column is already occupied: AI/Discuss pill at
             ~24px, panel launcher at 92px (its top ≈132px). This sits at
             148px so the three stack with clean gaps — measured against the
             live launcher, not guessed. Safe-area keeps it off the iOS home
             indicator. */
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 148px)",
        }}
      >
        {/* The progress dial. Track in the hairline border colour; the fill
            sweeps Hub Blue → its light stop as you approach the bottom. */}
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="kx-btt-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#567FB2" />
              <stop offset="100%" stopColor="#BCD8F0" />
            </linearGradient>
          </defs>
          <circle cx="18" cy="18" r={R} fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
          <circle
            cx="18" cy="18" r={R} fill="none"
            stroke="url(#kx-btt-ring)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
        {/* The arrow nudges upward on hover — the button telegraphs its verb. */}
        <ArrowUpIcon size={15} className="relative transition-transform duration-200 group-hover:-translate-y-0.5" />
      </button>
    </>
  );
}

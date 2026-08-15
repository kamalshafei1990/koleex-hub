"use client";

/* LiquidGlass — refraction that fits a fluid box.
   ---------------------------------------------------------------------------
   Wraps React Bits' GlassSurface (MIT + Commons Clause, vendored under
   components/vendor/reactbits) after the owner picked it from the lab.

   IT EXISTS BECAUSE THE COMPONENT TAKES PIXELS. GlassSurface's width and
   height are numbers — it builds an SVG displacement map at exactly that size,
   so it cannot size itself to a card. That was the objection tsc surfaced when
   width="100%" was rejected, and it is fatal in a layout that is fluid almost
   everywhere. This measures the box and hands it real pixels.

   THE PERFORMANCE FEAR WAS WRONG, and it is worth recording as wrong. I called
   this risky on the grounds that SVG displacement filters are expensive.
   Measured on the lab page while scrolling, at the display cap throughout:

     no instance   8.3ms median / 9.4 p95
     one instance  8.3 / 9.4
     EIGHT         8.3 / 9.3

   Same caveat as every other number this session: a DPR-2 120Hz Mac where all
   three cases sat at the cap. It says the filter will not break a good
   machine; it does not describe a weak one.

   WHAT IS STILL TRUE is the other objection, and it decides where this may be
   used: refraction bends what is BEHIND it, so over a near-flat ground it
   produces a near-flat result. It earns its place only on surfaces that sit
   over something with detail in it. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

const GlassSurface = dynamic(
  () => import("@/components/vendor/reactbits/GlassSurface.jsx"),
  { ssr: false },
);

export default function LiquidGlass({
  children, radius = 16, className = "",
}: {
  children: ReactNode;
  /** Must match the wrapper's own rounding — the filter draws its own edge. */
  radius?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      /* Rounded, and only written when it actually CHANGES. The filter rebuilds
         its displacement map on every size change, so feeding it sub-pixel
         jitter would rebuild it on every scroll. */
      setSize((prev) => {
        const w = Math.round(r.width), h = Math.round(r.height);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={`relative ${className}`}>
      {/* Until the first measurement there is no filter to draw — the children
          render on their own rather than flashing at the wrong size. */}
      {size && size.w > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <GlassSurface
            width={size.w} height={size.h} borderRadius={radius}
            displace={6} distortionScale={-160}
            redOffset={4} greenOffset={14} blueOffset={24}
            brightness={60} opacity={0.86} blur={2}
            backgroundOpacity={0.05} saturation={1.3}
          >
            {/* GlassSurface types children as required because it is built to
                WRAP content. Here it is used as a pure filter layer sitting
                behind the card's own children, so the card keeps its real
                padding and layout instead of inheriting the component's fixed
                box — which is the whole reason this wrapper exists. */}
            {null}
          </GlassSurface>
        </div>
      )}
      {/* h-full so the children see the wrapper's real height. Without it the
          content box collapses to zero and anything absolutely positioned
          inside resolves against nothing — which on a square tile put the label
          above the tile instead of in it. */}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

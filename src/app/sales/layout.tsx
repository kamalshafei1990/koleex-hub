"use client";

/* ---------------------------------------------------------------------------
   /sales/* layout — the Aurora scope + the ground, once for the whole segment.

   THE SCOPE GOES ON THE SEGMENT LAYOUT, NOT PER PAGE (the Scale Pattern).
   One `kx-app` here remaps the app's own tokens — --bg-primary to transparent,
   --bg-secondary to a translucent tint, the surface ramp to white 4/7/12% —
   so every panel, chip, row and hover across all four sales routes turns
   translucent at once, the recessed-well form-field rules start matching every
   input/select/textarea unedited, and any route added to this segment later is
   converted the day it is created. Core keeps the solid values it always had.

   HEIGHT: `h-full`, not `min-h-screen`. The Hub shell already resolved the
   viewport maths — `.kx-shell-top` is the 100vh/100svh box, `#main-scroll-container`
   is the scroller inside it — so a layout that measures the viewport again
   lands one header-height too tall and buys a phantom scrollbar on every
   screen. (Purchase, Inventory and Database layouts still carry `min-h-screen`
   and that bug with it; not fixed here because it is not this app.) SalesApp
   fills this box and scrolls internally; the flowing order pages take
   `min-h-full` and let the Hub scroller do the work.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the skin
   switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        /* fixed, never absolute, so the ground stays put while the page
           scrolls; inert so it never eats a click meant for the app. */
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {/* kx-ground-host lifts this layout's own children above the z-0 canvas.
          It deliberately skips positioned children — that `:not()` chain is what
          keeps an absolutely-placed control from being dropped back into normal
          flow, which is how the sidebar's collapse button once ended up
          off-screen. */}
      {children}
    </div>
  );
}

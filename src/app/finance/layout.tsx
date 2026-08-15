"use client";

/* ---------------------------------------------------------------------------
   /finance/* layout — the Aurora scope + the ground, once for 29 routes.

   THE SCOPE GOES ON THE SEGMENT LAYOUT (the Scale Pattern). One `kx-app` here
   remaps the app's own tokens — --bg-primary to transparent, --bg-secondary to
   a translucent tint, the surface ramp to white 4/7/12% — so every panel, row,
   chip and hover across all twenty-nine finance routes turns translucent at
   once, the recessed-well field rules start matching every input/select/
   textarea unedited, and any route added to the segment later is converted the
   day it is created. Core keeps the solid values it always had, because every
   Aurora rule is scoped to the skin attribute.

   `min-h-full`, never `min-h-screen`: the Hub shell already resolved the
   viewport maths, so a 100vh floor in here is one header-height taller than
   the area that can display it. These are flowing pages — they let the Hub
   scroller scroll them.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the skin
   switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}

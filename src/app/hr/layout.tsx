"use client";

/* ---------------------------------------------------------------------------
   /hr layout — the Aurora scope + the ground.

   One `kx-app` remaps the app's own tokens, so its panels, rows and hovers turn
   translucent and the recessed-well field rules start matching every
   input/select/textarea unedited. Core keeps the solid values it always had.

   This app was in a HALF state before: its screens already carried glass from
   shared chrome (KpiCard, PageHeader, the kds dialogs — 22 frosted surfaces
   measured on the route) but had no scope and no ground, so the frost had
   nothing behind it and the whole screen read as Core. Scope and ground are
   what make that glass mean something.

   `min-h-full`: the app flows with the page now — #main-scroll-container
   scrolls it like every other Hub app (owner, 2026-10-08: the nested
   scroller never received the wheel in the in-app browser, "can't scroll
   down"). The ground still covers the viewport behind it.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function HrLayout({ children }: { children: React.ReactNode }) {
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

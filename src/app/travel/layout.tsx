"use client";

/* ---------------------------------------------------------------------------
   /travel/* layout — the Aurora scope + the ground, once for the whole segment.

   Built Aurora-first: Travel is the first app added after the conversion
   programme, so it never carries a Core-only phase to migrate later.

   THE SCOPE GOES ON THE SEGMENT LAYOUT, NOT PER PAGE (the Scale Pattern).
   One `kx-app` here remaps the app's own tokens, so every panel, chip, row and
   form field across /travel, /travel/[id] and the settings screen turns
   translucent at once.

   HEIGHT: `h-full`, never `min-h-screen` and never a dvh calc. The Hub shell
   already resolved the viewport maths — `.kx-shell-top` is the 100vh box and
   `#main-scroll-container` is the scroller inside it — so measuring the
   viewport a second time lands one header-height too tall and buys a phantom
   scrollbar on short pages.

   The PRINT route (/travel/[id]/print) is deliberately NOT under this layout:
   it renders paper, so it must not inherit a glass scope or a wave canvas.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the skin
   switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div
      className={`${aurora ? "kx-app kx-ground-host " : ""}relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}
    >
      {aurora && (
        /* fixed, never absolute, so the ground stays put while the page
           scrolls; inert so it never eats a click meant for the app. */
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}

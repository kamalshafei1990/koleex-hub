"use client";

/* ---------------------------------------------------------------------------
   /events/* layout — the Aurora scope + the ground, once for the segment
   (the same Scale Pattern as /travel: one `kx-app` here remaps the app's
   tokens so every card and field turns translucent at once).

   HEIGHT: `h-full`, never `min-h-screen` — the Hub shell already resolved
   the viewport maths; measuring it again buys a phantom scrollbar.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

/* ssr:false and mounted only under Aurora — a canvas is the one thing the
   skin switch cannot do in CSS, so Core renders zero canvases (canon B). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function EventsLayout({ children }: { children: React.ReactNode }) {
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

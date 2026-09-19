"use client";

/* ---------------------------------------------------------------------------
   /dashboard layout — the Aurora scope + the ground, once for the segment
   (the Scale Pattern: the scope goes on the segment layout, not per page).

   One `kx-app` here remaps the app's tokens (--bg-primary → transparent, the
   surface ramp → translucent tints), mounts the wavy ground under Aurora
   only, and any route added to this segment later is converted the day it is
   created. Core keeps the solid values it always had — zero canvases.

   HEIGHT: `h-full` — the Hub shell already resolved the viewport maths; a
   layout that measures the viewport again buys a phantom scrollbar.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        /* fixed, never absolute — the ground stays put while the page
           scrolls; inert so it never eats a click meant for the app. */
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}

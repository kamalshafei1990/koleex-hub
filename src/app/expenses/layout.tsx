"use client";

/* ---------------------------------------------------------------------------
   /expenses layout — the Aurora scope + the ground, once for the segment.

   Same shape as /sales/layout.tsx: one `kx-app` remaps the app's own tokens,
   so every panel, chip, row and hover turns translucent at once and the
   recessed-well field rules start matching every input/select/textarea
   unedited. Core keeps the solid values it always had.

   `min-h-full`, never `min-h-screen` — the Hub shell already resolved the
   viewport maths, and a 100vh floor in here is one header-height taller than
   the area that can show it. This is a flowing page, so it lets the Hub
   scroller do the scrolling.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
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

"use client";

/* ---------------------------------------------------------------------------
   /planning layout — the Aurora scope + the ground, once for the segment.

   One `kx-app` remaps the app's own tokens, so every panel, chip, row and
   hover turns translucent at once and the recessed-well field rules start
   matching every input/select/textarea unedited. Core keeps the solid values
   it always had, because every Aurora rule is scoped to the skin attribute.

   `h-full`: PlanningApp owns its own internal scrolling (`flex flex-col
   overflow-hidden` with its own scroller inside), so it fills the box the Hub
   shell gives it. The shell already resolved the viewport maths — measuring it
   again here would land one header-height too tall.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}

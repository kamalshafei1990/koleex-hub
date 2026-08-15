"use client";

/* ---------------------------------------------------------------------------
   /calendar layout — the Aurora scope + the ground.

   One `kx-app` remaps the app's own tokens, so its panels, rows and hovers turn
   translucent and the recessed-well field rules match its inputs unedited.
   Core keeps the solid values it always had.

   `min-h-full`, not `min-h-screen`: the shell already subtracted the header, so
   a 100vh floor in here is one header-height taller than the area that can show
   it. This page flows and lets the Hub scroller scroll it.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
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

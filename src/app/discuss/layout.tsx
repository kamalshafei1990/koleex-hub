"use client";

/* ---------------------------------------------------------------------------
   /discuss layout — the Aurora scope + the ground.

   DELIBERATELY NARROW. Discuss carries standing owner rules: the unified
   header was reverted and must never be re-proposed, the stale-response guard
   in loadMessages must never be removed, and the WeChat bubble design is
   approved as it stands. None of that is touched here — this file adds the
   scope and the ground, nothing else, and the conversion below it is limited
   to surfaces.

   The bubbles in particular stay solid: they are the most repeated element on
   the screen, and canon prices backdrop-filter per element (the same call the
   AI app's chat bubbles got).

   `h-full`: DiscussApp is `flex flex-col overflow-hidden` with its own
   scroller, so it fills the box the shell gives it.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function DiscussLayout({ children }: { children: React.ReactNode }) {
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

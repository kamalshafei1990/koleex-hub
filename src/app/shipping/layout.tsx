"use client";

/* ---------------------------------------------------------------------------
   AURORA SCOPE lives HERE, on the segment layout, not on each page — one
   ground canvas for the whole app, so navigating inside Shipping does not
   re-mount it. Same shape as the Contracts layout.

   `min-h-full`, never `min-h-screen`: the scroller is the shell's, not the
   window's, and min-h-screen makes the page taller than its own container.
   --------------------------------------------------------------------------- */

import { useSkin } from "@/lib/appearance";
import WavyBackground from "@/components/ui/WavyBackground";

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

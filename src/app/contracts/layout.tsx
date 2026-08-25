"use client";

/* ---------------------------------------------------------------------------
   /contracts/* layout.

   AURORA SCOPE lives HERE, on the segment layout, not on each page — every
   route in the segment inherits the var remap from one place, including any
   route added later. This app shipped without one at all, which is why it
   rendered as flat Core on a Hub that is otherwise glass: nothing carried the
   scope, so every Aurora rule in globals simply never matched.

   min-h-FULL, not min-h-screen. The Hub shell already resolved the viewport
   maths — `.kx-shell-top` is the 100vh box and `#main-scroll-container` sits
   inside it with the header height as padding. A 100vh floor in here is
   taller than the area that can show it, which is a phantom scrollbar on
   every screen whether the page has content or not.

   The contract editor manages its own height (toolbar, field bands, paper),
   so this layout only carries the scope and the ground.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

/* The Aurora ground. ssr:false and mounted only under Aurora — a canvas is
   the one thing the skin switch cannot do in CSS, so Core renders none. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div
      className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}
    >
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

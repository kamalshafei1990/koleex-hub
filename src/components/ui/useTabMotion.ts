"use client";

/* ---------------------------------------------------------------------------
   useTabMotion — the directional pane-swap class (owner pick 3A, motion
   system 2026-08-21). Give it the ACTIVE TAB INDEX; it returns the entrance
   class for the pane:

     const tabMotion = useTabMotion(currentStep);
     <div key={currentStep} className={tabMotion}>…

   Later tab → "kx-tab-fwd" (slides in from the end), earlier tab →
   "kx-tab-back" (from the start), first mount → the plain "kx-tab-in" rise.
   RTL flipping happens in CSS, not here. The pane must be keyed by the tab
   (as every existing kx-tab-in caller already is) so the node remounts and
   the animation restarts.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export function useTabMotion(index: number): string {
  /* Render-phase derived state — same pattern as usePresence. */
  const [prev, setPrev] = useState(index);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  if (prev !== index) {
    setPrev(index);
    setDir(index > prev ? 1 : -1);
  }

  /* While the 24px slide is in flight the pane pokes past the scroller's
     edge, and the scroller's overflow-y:auto forces overflow-x to auto —
     on visible-scrollbar platforms that flashed a horizontal scrollbar on
     every switch (the "dancing" family). Same cure as the Home door: clip
     X for the flight only, then release so nothing's paint is ever
     permanently clipped. */
  useEffect(() => {
    if (dir === 0) return;
    const root = document.documentElement;
    root.setAttribute("data-kx-tabslide", "1");
    const t = setTimeout(() => root.removeAttribute("data-kx-tabslide"), 420);
    return () => clearTimeout(t);
  }, [dir, index]);

  return dir === 0 ? "kx-tab-in" : dir > 0 ? "kx-tab-fwd" : "kx-tab-back";
}

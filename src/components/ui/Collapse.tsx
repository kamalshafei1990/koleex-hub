"use client";

/* ---------------------------------------------------------------------------
   Collapse — the accordion body that unfolds instead of snapping (owner-
   approved motion system, 2026-08-21). Drop-in replacement for the
   `{open && <div>…</div>}` pattern:

     <Collapse open={open}>…body…</Collapse>

   TWO HARD RULES, learned the painful way on day one:
   1. `overflow: hidden` exists ONLY while an animation is playing. A
      steady-state clip silently cut every inline-absolute dropdown inside
      the form sections (SelectWithCreate and friends are NOT portalled) —
      the exact "state class changed geometry" failure class the owner has
      named before. At rest the body clips nothing.
   2. The unfold plays ONLY on a real user toggle — never on mount. Tab
      switches remount every section; animating them all made the pane
      slide + section unfolds pile into visual noise.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { usePresence } from "@/components/kds/usePresence";

export default function Collapse({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { mounted, closing } = usePresence(open, 240);
  /* Render-phase edge detection: opening becomes true only when the OPEN
     PROP flips true after first render — a mount with open=true stays
     still. Cleared on animationend so the clip lifts at rest. */
  const [prevOpen, setPrevOpen] = useState(open);
  const [opening, setOpening] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setOpening(true);
  }
  if (!mounted) return null;
  const anim = closing ? "kx-collapse-closing" : opening ? "kx-collapse-opening" : "";
  return (
    <div
      className={`kx-collapse ${anim}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && opening) setOpening(false);
      }}
    >
      <div className={className}>{children}</div>
    </div>
  );
}

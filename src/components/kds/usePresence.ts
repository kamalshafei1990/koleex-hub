"use client";

/* ---------------------------------------------------------------------------
   usePresence — two-phase presence for overlays (owner-approved motion
   system, 2026-08-21). Every overlay in the Hub used to hard-unmount
   (`if (!open) return null`), so nothing could ever animate OUT. This keeps
   the node mounted while its exit animation plays:

     const { mounted, closing } = usePresence(open);
     if (!mounted) return null;
     <div className={`kx-glass-pop ${closing ? "kx-pop-closing" : ""}`} …

   Open/close transitions are detected with render-phase state adjustments
   (the React "derive state from props" pattern) — no synchronous setState
   inside effects. Unmount rides a timer, not animationend: under
   prefers-reduced-motion the exit animation is `none` and animationend never
   fires; the timer still unmounts, just imperceptibly later.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export function usePresence(open: boolean, exitMs = 160): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  /* Previous open, as STATE not a ref — the documented "derive state during
     render" pattern; the refs-during-render lint forbids the ref version. */
  const [prevOpen, setPrevOpen] = useState(open);

  /* Render-phase adjustments on the open↔closed edges. */
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      if (!mounted) setMounted(true);
      if (closing) setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }

  /* The only async part: after the exit animation's window, unmount. */
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setClosing(false);
      setMounted(false);
    }, exitMs);
    return () => clearTimeout(t);
  }, [closing, exitMs]);

  return { mounted, closing };
}

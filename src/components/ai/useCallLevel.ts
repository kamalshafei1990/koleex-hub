"use client";

/* Drive `--kx-call-level` on a node from a measured level, one frame at a
   time, with the attack/release shape in lib/voice/level.ts. Never touches
   React state: the rings read the variable in CSS, so a change of level is
   a style write and a composite, not a render. */

import { useEffect, useRef, type RefObject } from "react";
import { stepLevel } from "@/lib/voice/level";

export const CALL_LEVEL_VAR = "--kx-call-level";

/** `bindKey` — anything whose change means the ref now points at a NEW
 *  element. The call screen remounts its views with `key={view}`; read once
 *  on mount, the loop kept writing the variable to the detached orb after
 *  one round trip to the chat view, and the rings never moved again
 *  (audit, 2026-09-07). */
export function useCallLevel(ref: RefObject<HTMLElement | null>, level: number, active: boolean, bindKey?: unknown): void {
  const target = useRef(0);
  useEffect(() => {
    target.current = active ? level : 0;
  }, [level, active]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let current = 0;
    const tick = () => {
      current = stepLevel(current, target.current);
      el.style.setProperty(CALL_LEVEL_VAR, current.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty(CALL_LEVEL_VAR, "0");
    };
  }, [ref, bindKey]);
}

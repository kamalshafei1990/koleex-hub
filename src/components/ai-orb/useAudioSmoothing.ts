"use client";

/* Smooth a raw 0..1 audio level into --kx-orb-audio on the node.
   lerp factor keeps syllable energy without jitter; runs on rAF and
   never touches React state. */

import { useEffect, useRef, type RefObject } from "react";
import { clamp01 } from "./ai-orb-types";

export function useAudioSmoothing(
  ref: RefObject<HTMLElement | null>,
  level: number | undefined,
  active: boolean,
) {
  const target = useRef(0);
  useEffect(() => {
    target.current = clamp01(level);
  }, [level]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) {
      el.style.setProperty("--kx-orb-audio", "0");
      return;
    }
    let raf = 0;
    let current = 0;
    const step = () => {
      current += (target.current - current) * 0.14;
      el.style.setProperty("--kx-orb-audio", current.toFixed(3));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ref, active]);
}

"use client";

/* Pointer parallax → CSS custom properties, written directly on the node
   inside requestAnimationFrame. Zero React re-renders per pointer move. */

import { useEffect, type RefObject } from "react";

export function useOrbParallax(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  maxDeg: number,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = 0, ty = 0;          // current (smoothed)
    let gx = 0, gy = 0;          // goal
    let running = false;

    const step = () => {
      tx += (gx - tx) * 0.14;
      ty += (gy - ty) * 0.14;
      el.style.setProperty("--kx-orb-rx", `${ty.toFixed(2)}deg`);
      el.style.setProperty("--kx-orb-ry", `${tx.toFixed(2)}deg`);
      /* Specular highlight drifts with the cursor (percent offsets). */
      el.style.setProperty("--kx-orb-hx", `${(tx * 1.2).toFixed(2)}%`);
      el.style.setProperty("--kx-orb-hy", `${(ty * 1.2).toFixed(2)}%`);
      if (Math.abs(gx - tx) > 0.05 || Math.abs(gy - ty) > 0.05) {
        raf = requestAnimationFrame(step);
      } else {
        running = false;
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;   // -1..1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      gx = Math.max(-1, Math.min(1, nx)) * maxDeg;
      gy = Math.max(-1, Math.min(1, -ny)) * maxDeg;
      kick();
    };
    const onLeave = () => {
      gx = 0;
      gy = 0;
      kick();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled, maxDeg]);
}

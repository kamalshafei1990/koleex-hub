"use client";

/* ---------------------------------------------------------------------------
   WavyBackground — the sign-in screen's ground.

   Owner's pick. Ported from the Aceternity component he sent, with the palette
   changed to Koleex Hub Blue and four things done differently, because the
   original is written for a marketing hero that a person sees for six seconds
   and this runs while somebody types a password.

   1. THE BLUR MOVED OFF THE CANVAS. The original sets `ctx.filter = blur(10px)`
      and re-blurs five stroked paths in software on every single frame — the
      most expensive call a 2D context has. The paths are drawn crisp here and
      the CANVAS ELEMENT carries a CSS blur instead, so the GPU composites it
      once per frame. Pixel-for-pixel the same picture.

   2. 30fps, NOT 60. These waves take twelve seconds to cross the screen. Half
      the frames is invisible and halves the work.

   3. IT STOPS. On tab hidden, on unmount, and entirely under
      prefers-reduced-motion, where a single frame is painted and that is that.
      The original loops forever in a background tab.

   4. IT COSTS LESS ON A PHONE. Device pixel ratio is pinned to 1 and the wave
      count drops, so a mid-range Android paints a quarter of the pixels. On a
      390px screen nobody can tell.

   No simplex-noise dependency: layered sines with irrational frequency ratios
   are indistinguishable at this scale and are eight lines.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";

/* Hub Blue as a five-stop tonal ramp. The original ships sky / indigo /
   purple / fuchsia / cyan — a rainbow, and against everything the brand
   says. One hue, five values. */
/* Ordered by CONTRAST, not by value. The ramp in sequence — dark to light —
   blurs into one blue mass, because a single hue has nothing to separate the
   bands with. Alternating bright and dark makes the ribbons read. */
const WAVES = ["#8FB0D4", "#16222F", "#BCD8F0", "#1B2A3C", "#567FB2"] as const;

const FPS = 30;
const FRAME_MS = 1000 / FPS;

export default function WavyBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const dpr = small ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const count = small ? 3 : WAVES.length;

    let w = 0, h = 0;
    const size = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
    };

    /* Three sines whose periods never line up read as noise and cost three
       multiplications. */
    const wave = (x: number, i: number, t: number) =>
      Math.sin(x * 0.0034 + t + i * 1.7) * 78 +
      Math.sin(x * 0.0091 - t * 1.31 + i) * 34 +
      Math.sin(x * 0.0019 + t * 0.66 + i * 2.3) * 52;

    const paint = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05070C";
      ctx.fillRect(0, 0, w, h);
      /* Thick and nearly opaque: after a 34px CSS blur these read as bands of
         light, not as lines. The first pass used 54px at 0.55 and the vignette
         ate it — the ground looked like dirt on the screen rather than waves. */
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = small ? 92 : 108;
      ctx.lineCap = "round";
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.strokeStyle = WAVES[i];
        /* 14px steps, not 5 — at this blur radius the extra vertices are
           invisible and it is a third of the path work. */
        for (let x = -40; x <= w + 40; x += 14) {
          /* Spread WIDER than the stroke, or every band overlaps every other
             one and the blur finishes the job. */
          const y = h * 0.5 + wave(x, i, t) + (i - count / 2) * 132;
          if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    size();

    if (still) { paint(0); return; }

    let raf = 0, last = 0, t = 0, running = true;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      t += 0.0075;
      paint(t);
    };
    raf = requestAnimationFrame(loop);

    /* A login screen left open in a background tab was the worst of the
       original's habits. */
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", onVis);

    let rz = 0;
    const onResize = () => {
      window.clearTimeout(rz);
      rz = window.setTimeout(() => { size(); paint(t); }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(rz);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden
        /* The blur lives here, not in the draw call — one GPU composite per
           frame instead of a software blur per path per frame. */
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ filter: "blur(30px)", transform: "scale(1.1)" }}
      />
      {/* Contrast floor. Waves are pretty; a password field you cannot read
          is not, and the brightest stop is #BCD8F0 against white type. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(96% 84% at 50% 48%, rgba(5,7,12,.06) 0%, rgba(5,7,12,.42) 62%, rgba(5,7,12,.86) 100%)",
        }}
      />
    </>
  );
}

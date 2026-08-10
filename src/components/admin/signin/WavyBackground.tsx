"use client";

/* ---------------------------------------------------------------------------
   WavyBackground — the sign-in screen's ground.

   A faithful port of the Aceternity component the owner chose
   (ui.aceternity.com/components/wavy-background), read from its registry
   source rather than from memory. The draw loop is the original's:

     ctx.filter    = blur(10px)          set once in init, not per frame
     lineWidth     = 50
     for x += 5:   y = noise3D(x/800, 0.3*i, nt) * 100
     all five drawn at the SAME baseline h*0.5, so they cross and weave
     background filled at globalAlpha 0.5, which never fully clears the
       previous frame — that is where the softness comes from

   My first attempt got two things wrong and they were the whole look: layered
   sines instead of 3D simplex noise, which reads as corrugated iron rather
   than water, and the waves spread 132px apart, which turns weaving ribbons
   into parallel stripes.

   WHAT IS DELIBERATELY NOT THE ORIGINAL — none of it changes the picture:

   · 30fps. The waves take ten seconds to cross; half the frames is invisible.
   · It stops on tab hidden, on unmount, and under prefers-reduced-motion,
     where one frame is painted and the loop never starts. The original runs
     forever in a background tab, which on a login screen is the worst place
     to do it.
   · Device pixel ratio 1 on phones, so a mid-range Android paints a quarter
     of the pixels.
   · A removable resize listener. The original assigns window.onresize
     directly, which stamps on anything else in the app using it.
   · simplex-noise inlined rather than added as a dependency.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";

/* Hub Blue instead of the original's sky / indigo / purple / fuchsia / cyan —
   a rainbow, and against everything the brand says. */
const WAVE_COLORS = ["#BCD8F0", "#8FB0D4", "#567FB2", "#2E4B6B", "#1B2A3C"];

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const BLUR = 10;
const WAVE_WIDTH = 50;
const SPEED = 0.0018;
const WAVE_OPACITY = 0.5;
const BACKGROUND = "#05070C";

/* ── 3D simplex noise ────────────────────────────────────────────────────
   The same algorithm `simplex-noise` ships. Inlined because a dependency for
   one screen is a dependency to maintain forever — and this is the part of
   the component that cannot be approximated. Sines give you corrugated iron;
   noise gives you water. */
const GRAD3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

function buildNoise3D() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  /* Deterministic shuffle: a ground that differs on every load is a ground
     nobody can review. */
  let seed = 1337;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  const F3 = 1 / 3, G3 = 1 / 6;

  const corner = (gi: number, x: number, y: number, z: number) => {
    let t = 0.6 - x * x - y * y - z * z;
    if (t < 0) return 0;
    t *= t;
    const g = GRAD3[gi];
    return t * t * (g[0] * x + g[1] * y + g[2] * z);
  };

  return function noise3D(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    }

    const x1=x0-i1+G3,   y1=y0-j1+G3,   z1=z0-k1+G3;
    const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
    const x3=x0-1+3*G3,  y3=y0-1+3*G3,  z3=z0-1+3*G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    return 32 * (
      corner(permMod12[ii+perm[jj+perm[kk]]], x0,y0,z0) +
      corner(permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]], x1,y1,z1) +
      corner(permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]], x2,y2,z2) +
      corner(permMod12[ii+1+perm[jj+1+perm[kk+1]]], x3,y3,z3)
    );
  };
}

export default function WavyBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const noise3D = buildNoise3D();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* RESOLUTION IS BUDGETED IN PIXELS, NOT IN DEVICE RATIO.

       This used to be `small ? 1 : min(dpr, 2)` — device ratio 1 on anything
       under 768px. The intent was to spare a mid-range Android, but a phone
       screen is 3x, so it handed the compositor a 375x812 bitmap to stretch
       across 1125x2436 physical pixels. Three times up, on a picture made of
       soft gradients and a half-alpha trail that accumulates its own
       quantisation: it goes blocky and it bands. That is the glitch.

       Cost tracks the number of pixels painted, so budget that directly. At
       1.4M a 375x812 phone lands on ratio 2 and a 430x932 on 1.87 — sharp
       either way, and still under a fifth of the 7.5M the desktop already
       paints at a measured 8.3ms median.

       And it is computed INSIDE size(), not captured once outside it. Held in
       a closure it went stale the moment the viewport crossed the breakpoint —
       rotate a phone, or resize a window past 768px, and the canvas kept
       whichever ratio happened to be true when the effect first ran. */
    const scaleFor = () => {
      const raw = Math.min(window.devicePixelRatio || 1, 2);
      if (!window.matchMedia("(max-width: 767px)").matches) return raw;
      const area = Math.max(1, cv.clientWidth * cv.clientHeight);
      return Math.max(1, Math.min(raw, Math.sqrt(1_400_000 / area)));
    };

    let w = 0, h = 0, nt = 0;

    const size = () => {
      const dpr = scaleFor();
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Set ONCE, exactly as the original does — the context keeps it for
         every stroke that follows. */
      ctx.filter = `blur(${BLUR}px)`;
      ctx.lineWidth = WAVE_WIDTH;
    };

    const drawWave = (n: number) => {
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.strokeStyle = WAVE_COLORS[i % WAVE_COLORS.length];
        for (let x = 0; x < w; x += 5) {
          const y = noise3D(x / 800, 0.3 * i, nt) * 100;
          ctx.lineTo(x, y + h * 0.5);
        }
        ctx.stroke();
        ctx.closePath();
      }
    };

    const render = () => {
      /* globalAlpha on the FILL, never reset — the previous frame is only
         half covered, and that is the softness. */
      ctx.fillStyle = BACKGROUND;
      ctx.globalAlpha = WAVE_OPACITY;
      ctx.fillRect(0, 0, w, h);
      nt += SPEED;
      drawWave(5);
    };

    size();
    /* One opaque frame first, or the half-alpha fill reveals whatever was in
       the buffer before it. */
    ctx.globalAlpha = 1;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    render();

    if (still) return;

    let raf = 0, last = 0, running = true;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      render();
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", onVis);

    let rz = 0;
    const onResize = () => {
      window.clearTimeout(rz);
      rz = window.setTimeout(() => { size(); render(); }, 150);
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
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full pointer-events-none" />
      {/* Contrast floor. The waves cross the middle of the screen, which is
          exactly where the password field sits, and the brightest stop is
          #BCD8F0 under white type. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(72% 60% at 50% 50%, rgba(5,7,12,.55) 0%, rgba(5,7,12,.30) 56%, rgba(5,7,12,.74) 100%)",
        }}
      />
    </>
  );
}

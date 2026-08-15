"use client";

/* ---------------------------------------------------------------------------
   WavyBackground — the Hub's ground. Sign-in gate and Home.

   A faithful port of the Aceternity component the owner chose
   (ui.aceternity.com/components/wavy-background), read from its registry
   source rather than from memory. The draw loop is the original's:

     blur(10px)    on the canvas ELEMENT (CSS), one GPU composite per frame
     lineWidth     = 50
     for x += 5:   y = noise3D(x/800, 0.3*i, nt) * 100
     all five drawn at the SAME baseline h*0.5, so they cross and weave
     background filled at globalAlpha 0.5, which never fully clears the
       previous frame — that is where the softness comes from

   My first attempt got two things wrong and they were the whole look: layered
   sines instead of 3D simplex noise, which reads as corrugated iron rather
   than water, and the waves spread 132px apart, which turns weaving ribbons
   into parallel stripes.

   THE MOTION IS NOW THE ORIGINAL'S, EXACTLY. It was not, and the owner spotted
   all three: this ran at 30fps on speed 0.0018 (0.054 noise-units a second
   against the original's 0.12) and at device ratio 2 against the original's 1
   — measured on ui.aceternity.com, whose backing store is 910x792 for a
   910x792 box on a DPR-2 screen. Rendering at twice the resolution also
   halves `ctx.filter = blur(10px)`, which is applied in device pixels, so the
   picture came out roughly four times sharper than the thing it copied and
   the ends of the strokes became visible. Ratio 1 at 60fps is also HALF the
   pixels a second of ratio 2 at 30fps: closer to the source and cheaper.

   WHAT IS DELIBERATELY NOT THE ORIGINAL — none of it changes the picture:

   · The strokes are drawn past both edges. The original runs x from 0 to w,
     leaving a butt cap at each edge that its upscaling smears away; drawing
     wider is the fix that holds at any resolution.
   · It stops on tab hidden, on unmount, under prefers-reduced-motion, and on
     a machine with four cores or fewer — one frame painted, loop never
     started. The original runs forever in a background tab, which on a screen
     that stays open is the worst place to do it.
   · A removable resize listener. The original assigns window.onresize
     directly, which stamps on anything else in the app using it.
   · A second palette for light mode, and a `theme` prop so the sign-in gate
     can pin dark — the gate's card and lockup do not follow data-theme.
   · simplex-noise inlined rather than added as a dependency.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { useWallpaper } from "@/lib/useWallpaper";
import { isLive } from "@/lib/wallpaper";

/* Hub Blue instead of the original's sky / indigo / purple / fuchsia / cyan —
   a rainbow, and against everything the brand says.

   TWO PALETTES, because this now runs on Home as well as the gate and Home
   has a light theme. On white the dark set is invisible: the ground fill is
   what every stroke fades toward, so light-on-light leaves a blank page. The
   light set inverts that relationship — mid and deep blues over a near-white
   ground — rather than lightening the same colours. */
const PALETTES = {
  dark: {
    waves: ["#BCD8F0", "#8FB0D4", "#567FB2", "#2E4B6B", "#1B2A3C"],
    ground: "#05070C",
    floor: "radial-gradient(72% 60% at 50% 50%, rgba(5,7,12,.55) 0%, rgba(5,7,12,.30) 56%, rgba(5,7,12,.74) 100%)",
  },
  light: {
    waves: ["#567FB2", "#8FB0D4", "#3E6796", "#A9C4DE", "#7FA9D6"],
    ground: "#F4F7FA",
    floor: "radial-gradient(72% 60% at 50% 50%, rgba(247,249,252,.62) 0%, rgba(247,249,252,.34) 56%, rgba(247,249,252,.80) 100%)",
  },
} as const;

/* ── TINTING THE FIELD ITSELF ─────────────────────────────────────────────
   Owner: "when I press color the background color change — I mean the
   wallpaper CONTENT itself changes, not only the surface."

   Until now a colour swatch only tinted the 25 shader grounds. On the wave
   field — the DEFAULT, and the one he was looking at — pressing a colour did
   not recolour the wave at all: it REPLACED the wallpaper with a flat block
   of that colour. Hence "only the surface".

   The five stops above are not five arbitrary blues; they are one hue at five
   distances from white and black. Those distances are what makes the field
   read as depth, so a tint has to reproduce the RELATIONSHIP, not just swap
   the middle colour. Measured off the shipped Hub set against its own base
   #567FB2: +62% and +32% toward white, the base, then 42% and 65% toward
   black — and the light set is a different arrangement of the same idea, so it
   carries its own ratios rather than being the dark one lightened. */
const MIX = {
  dark: [0.62, 0.32, 0, -0.42, -0.65],
  light: [0, 0.32, -0.28, 0.52, 0.18],
} as const;

function mixHex(hex: string, t: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const target = t >= 0 ? 255 : 0, k = Math.abs(t);
  const to = (c: number) => Math.round(c + (target - c) * k);
  return "#" + [to(r), to(g), to(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** The field's five stops. No tint → the shipped Hub arrays, byte for byte, so
 *  the default ground is untouched by this. */
function waveColors(theme: "dark" | "light", tint?: string): readonly string[] {
  if (!tint) return PALETTES[theme].waves;
  return MIX[theme].map((t) => mixHex(tint, t));
}

const BLUR = 10;
const WAVE_WIDTH = 50;
/* The original's "fast" default, and it runs on an unthrottled rAF. Both
   numbers matter together: the waves advance SPEED per frame. This ran at
   0.0018 on a 30fps throttle — 0.054 noise-units a second against the
   original's 0.12 — and the owner was right that it did not look like the
   reference. The throttle also changed the picture, not just
   the speed: the ground is refilled at half alpha every frame and never
   fully clears, so at 30fps each trail survives twice as long in wall-clock
   and the ribbons read thicker and smearier than the original's. */
/* 0.0013, not the original's 0.002 — the owner asked for it slower after
   seeing the corrected version, so this is now a DELIBERATE deviation rather
   than the drift it was before. It only changes travel: the trail decay is a
   function of frame rate, which is still the original's unthrottled rAF, so
   the ribbons keep the same thickness and softness they just gained. */
const SPEED = 0.0013;
const WAVE_OPACITY = 0.5;

/* Draw past both edges so the strokes can never be seen ending. The original
   runs x from 0 to w, which leaves a butt cap at each edge; it gets away with
   it because it renders at ratio 1 and lets the browser upscale, which smears
   the ends into the blur. Overdrawing is the honest fix and it holds at any
   resolution. 80px clears half a 50px stroke plus the 10px blur with room. */
const OVERDRAW = 80;

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

export default function WavyBackground(
  { theme: forced, topLight }: { theme?: "dark" | "light"; topLight?: boolean } = {},
) {
  const ref = useRef<HTMLCanvasElement>(null);
  /* Follows the document by default — read once per mount and re-read on the
     app's own themechange event, which display-prefs already dispatches. No
     attribute at all means dark, the Hub's base theme.

     `forced` exists for the SIGN-IN GATE, which is dark-only by design: its
     card is a dark glass panel with white type and the lockup is the for-dark
     composite, none of which follow data-theme. Letting the ground follow it
     put a light background behind a dark card for every user whose theme is
     light — a bug this component introduced the moment it learned about
     themes, and one only visible if you actually switch. */
  const [auto, setAuto] = useState<"dark" | "light">(() =>
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  const theme = forced ?? auto;

  useEffect(() => {
    if (forced) return;
    const onTheme = () =>
      setAuto(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    onTheme();
    window.addEventListener("themechange", onTheme);
    return () => window.removeEventListener("themechange", onTheme);
  }, [forced]);

  /* THE GROUND SWITCH. This component is mounted by twenty pages, which makes
     it the only sane place to ask which wallpaper is chosen — the alternative
     was the same question answered in twenty files.

     The wave field is still the default and the code below is untouched. A
     different choice does not modify the field, it declines to mount it: the
     canvas is not rendered and the draw loop never starts, so a still
     wallpaper is strictly cheaper than the ground it replaces.

     The gate pins its theme with `forced`, and it has no account — the hook
     falls back to hub-live there, which is what the gate was signed off with. */
  const wallpaper = useWallpaper();
  /* THE WAVE FIELD, AND NOTHING ELSE. Every other wallpaper is painted by
     WallpaperApplier at SHELL level, because this component is mounted by
     twelve of the Hub's 251 pages — so a wallpaper living here appeared on
     twelve routes and nowhere else, which is what the owner saw as "it only
     shows in settings". Painting it in both places would be two copies of one
     picture, the lower of them invisible. */
  const showCanvas = isLive(wallpaper);

  useEffect(() => {
    if (!showCanvas) return;      // guard INSIDE the effect: hooks stay unconditional
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const { ground: BACKGROUND } = PALETTES[theme];
    const WAVE_COLORS = waveColors(theme, wallpaper?.tint);

    const noise3D = buildNoise3D();
    /* STILL, NOT ABSENT, on a weak machine. This used to run only on the gate,
       which is opened once; Home is opened dozens of times a day and stays
       open, so a permanent draw loop there has to be something the device can
       actually afford. Four cores or fewer gets one painted frame and no loop
       — the same picture, none of the cost. The Hub is opened from WeChat on
       mid-range Windows in China, where this is not a hypothetical.

       hardwareConcurrency is a crude proxy and it is the only one available
       without measuring frames and then reacting, which would itself cost the
       frames it is trying to save. */
    /* iOS CAPS hardwareConcurrency AT 4 for fingerprinting protection, so
       this heuristic classified every iPhone — some of the strongest GPUs
       shipping — as a weak machine and froze the ground ("in mobile version
       is not moving"). Apple devices are excluded; the gate still guards
       its actual target, mid-range Windows boxes opened from WeChat. */
    /* THE GATE IS FOR DESKTOPS. hardwareConcurrency is capped for privacy
       on iOS — which already froze every iPhone once ("in mobile version is
       not moving") — and several Android skins do the same: ColorOS reports
       4 on an eight-core phone, so the owner's Oppo was classified weak and
       the ground stopped ("the background solid not moving"). Excluding
       Apple by name only patched the first half of the same mistake.

       The target was never phones. It was mid-range WINDOWS boxes opened
       from WeChat, where a permanent draw loop genuinely hurts. So the gate
       now applies to non-touch machines only, and a phone always animates. */
    const mobile =
      /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent) ||
      navigator.maxTouchPoints > 1;
    const weak = !mobile && (navigator.hardwareConcurrency || 8) <= 4;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || weak;

    /* RATIO 1, WHICH IS WHAT THE ORIGINAL DOES.

       Measured on ui.aceternity.com: their backing store is 910x792 for a
       910x792 CSS box on a DPR-2 display. The browser upscales it, and that
       upscale is part of the look — it is where a good deal of the softness
       comes from. `ctx.filter = blur(10px)` is applied in device pixels, so
       drawing at ratio 2 also halves the blur relative to the picture: this
       was rendering roughly four times sharper than the thing it was copied
       from, which is why the ends of the strokes became visible at all.

       It is also cheaper than what it replaces. Ratio 2 at 30fps was 86.5M
       pixels a second; ratio 1 at 60fps is 43.2M — half the work AND the
       original's motion. The earlier "sharpen it on phones" change was
       solving the wrong problem: the artefact was the visible stroke ends,
       now fixed by overdrawing, not the resolution. */
    let w = 0, h = 0, nt = 0;

    const size = () => {
      /* One backing pixel per CSS pixel, so no transform and no scaling
         arithmetic — the same one line the original writes. Setting the
         width also resets the context, which is why filter and lineWidth are
         re-applied here rather than once at init. */
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, w);
      cv.height = Math.max(1, h);
      /* ONE BLUR PATH FOR EVERY ENGINE: CSS on the canvas element, always.
         ctx.filter is deleted from this file on purpose and must not come
         back. The history: WebKit rendered ctx.filter's blur wrong or not at
         all (the owner's Safari showed sharp bands twice, including after a
         write-and-read-back detection pass), and no amount of Chromium-side
         measurement can debug that. The element filter blurs the composed
         frame once on the GPU — the same picture on every engine BY
         CONSTRUCTION — and it is cheaper on Chromium too, where ctx.filter
         re-blurs every stroke and is the most expensive call in the 2D API.
         The box extends 48px past the viewport, so the CSS blur's edge
         falloff lives off-screen. */
      cv.style.filter = `blur(${BLUR}px)`;
      ctx.lineWidth = WAVE_WIDTH;
    };

    /* THE FIELD IS THE ORIGINAL'S AND STAYS THE ORIGINAL'S. All five ribbons
       weave around h*0.5 with a ±100px excursion — do not "grow" it to chase
       a dark area somewhere on a page. Tried on 2026-08-11 (bigger excursion,
       centres spread down the height) and reverted the same day: the owner
       did not ask for the ground to change, and it is signed-off artwork.
       A dark region at the top of an app screen is the FROSTED BAR's problem,
       not this file's. */
    const drawWave = (n: number) => {
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.strokeStyle = WAVE_COLORS[i % WAVE_COLORS.length];
        for (let x = -OVERDRAW; x < w + OVERDRAW; x += 5) {
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

    /* Unthrottled, like the original. The 30fps cap was a saving that changed
       the picture — see SPEED. The weak-machine case is handled by not
       starting the loop at all, which is a real saving rather than a
       half-speed version of the same cost. */
    let raf = 0, running = true;
    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      render();
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; raf = requestAnimationFrame(loop); }
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
  /* wallpaper?.tint IS A REAL DEPENDENCY, not a lint appeasement: the five wave
     colours are read once when the draw loop starts, so without it the canvas
     keeps painting the previous colour until something else happens to
     remount it — the swatch would look dead. */
  }, [theme, topLight, showCanvas, wallpaper?.tint]);

  return (
    <>
      {/* The box runs 48px past the viewport on every side — uniform across
          engines so both blur paths (ctx.filter / CSS element filter) render
          the same picture, and the CSS path's edge falloff stays off-screen. */}
      {showCanvas && (
      <canvas
        ref={ref}
        aria-hidden
        className="absolute pointer-events-none"
        style={{ inset: -48, width: "calc(100% + 96px)", height: "calc(100% + 96px)" }}
      />
      )}
      {/* Contrast floor. The waves cross the middle of the screen, which is
          exactly where the password field sits, and the brightest stop is
          #BCD8F0 under white type. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        /* topLight: pull the vignette's dark edge away from the TOP. The
           default floor reaches rgba(5,7,12,.74) at 100%, and the top of
           the viewport sits exactly on that outer stop — fine on Home,
           where only the 56px header covers it, but Product Data's frosted
           bar zone runs ~250px deep and lands entirely inside the darkest
           band, which reads as a black slab (owner, three times). Apps opt
           in; Home keeps the floor it was signed off with. */
        style={{
          /* A wallpaper brings its own scrim. The two floors below were tuned
             against the wave field's specific brightness and say nothing
             useful about someone's photograph, so a chosen ground computes its
             own from the catalogue's dim — with a hard floor for uploads,
             because we cannot know what is in them. topLight still applies:
             it is about where the header ramp sits, not what is underneath. */
          /* No floor when the field is not painting: the shell-level ground
             carries its own scrim, and a second one here would darken it
             twice. */
          background: !showCanvas
            ? "transparent"
            : topLight
            ? (theme === "light"
                ? "radial-gradient(120% 90% at 50% 78%, rgba(247,249,252,.30) 0%, rgba(247,249,252,.34) 56%, rgba(247,249,252,.72) 100%)"
                : "radial-gradient(120% 90% at 50% 78%, rgba(5,7,12,.22) 0%, rgba(5,7,12,.30) 56%, rgba(5,7,12,.66) 100%)")
            : PALETTES[theme].floor,
        }}
      />
    </>
  );
}

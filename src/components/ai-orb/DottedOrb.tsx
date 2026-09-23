"use client";

/* ---------------------------------------------------------------------------
   DottedOrb — the second drawing of the Koleex AI orb.

   A dotted thought-orb: a few hundred dots on a sphere, honestly 3D (rotated,
   depth-shaded, z-sorted), one motion per thing the assistant is doing. The
   geometry is the thinking-orbs engine (MIT, Jakub Antalik) — pure maths, no
   network, no WebGL, no filters; it runs the same on a phone in Shanghai as
   anywhere else. The drawing, the timing and the meaning are ours.

   WHY NOT THE LIBRARY'S OWN COMPONENT. <ThinkingOrb> ships two sizes, 64 and
   20, and nothing else — any other size has no tuning and does not draw. The
   Hub draws this orb at 30, 38, 40, 64, 72, 104 and 200. The engine takes any
   size (its geometry was tuned at 300pt and scales); only the TUNING (dot
   count, dot size, pace) is one of two, and dottedPreset() picks it. Drawing
   it ourselves also gives it what the aura orb has and the library does not:
   our state model, the voice level on a call, and the app's own theme and
   reduce-motion switches, not only the OS's.

   Same props as AIOrb, so <ChosenOrb> can hand either one the same call.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { MODE_FRAMES, resolvePreset } from "thinking-orbs/engine";
import type { AIOrbProps } from "./ai-orb-types";
import { clamp01, resolveOrbState } from "./ai-orb-types";
import { orbStatusLabel } from "./ai-orb-labels";
import { useAudioSmoothing } from "./useAudioSmoothing";
import { DOTTED_WANDER_MS, dottedLook, dottedPreset, nextWanderMotion, type DottedLook, type DottedMotion } from "./dotted-orb-map";
import { DOTTED_MORPH_MS, easeInOutCubic, morphDots, type MorphDot } from "./dotted-orb-morph";
import { auroraNoise, auroraTint, dottedFlows, dottedPalette, monoInk, tintedInk, type DottedPalette } from "./dotted-orb-ink";

export interface DottedOrbProps extends AIOrbProps {
  /** "dark" pins light dots — for surfaces that are dark in both themes
   *  (the call screen). "auto" follows the app's theme. */
  surface?: "auto" | "dark";
  /** At rest, drift through the nine shapes at random, one every
   *  DOTTED_WANDER_MS (the Home greeting). Any other state shows as usual. */
  wander?: boolean;
}

/** The app's own theme on <html>: light only when it says so; the Hub's
 *  default is dark. */
function appIsDark(): boolean {
  return document.documentElement.dataset.theme !== "light";
}

/** The Hub's style (Aurora or Core) on <html> — it decides the dots' colours. */
function appPalette(): DottedPalette {
  return dottedPalette(document.documentElement.dataset.kxSkin);
}

/** The Hub marked this machine low-power (display-prefs / the bootstrap). */
function appLowPower(): boolean {
  return document.documentElement.hasAttribute("data-kx-lowpower");
}

/** Either the OS or the Hub's own Display setting asks for stillness. */
function wantsStill(): boolean {
  if (document.documentElement.classList.contains("kx-reduce-motion")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export default function DottedOrb({
  state = "idle",
  activity = "none",
  result = "none",
  audioLevel = 0,
  size = 72,
  className = "",
  label,
  surface = "auto",
  wander = false,
}: DottedOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visual = resolveOrbState(state, result);
  const stateLook = dottedLook(state, activity, result, size);
  const audioActive = visual === "listening" || visual === "speaking";
  useAudioSmoothing(rootRef, clamp01(audioLevel), audioActive);

  /* Theme, style and stillness are read after mount (no SSR/hydration
     mismatch) and followed live: the header's theme toggle and the Display
     and Appearance tabs all change <html>, and an orb already on screen
     should follow without a reload. Style and low-power are also read on the
     first client render: they only ever reach the canvas, never the markup,
     so there is nothing to mismatch — and an Aurora orb never shows one grey
     frame first. */
  const [dark, setDark] = useState(true);
  const [still, setStill] = useState(false);
  const [palette, setPalette] = useState<DottedPalette>(() => (typeof document === "undefined" ? "mono" : appPalette()));
  const [lowPower, setLowPower] = useState(() => typeof document !== "undefined" && appLowPower());
  useEffect(() => {
    const read = () => {
      setDark(appIsDark());
      setStill(wantsStill());
      setPalette(appPalette());
      setLowPower(appLowPower());
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "data-kx-skin", "data-kx-lowpower"],
    });
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener("change", read);
    return () => { mo.disconnect(); mq?.removeEventListener("change", read); };
  }, []);
  const lightDots = surface === "dark" || dark;

  /* aria label follows the app language — the same source AIOrb reads. */
  const [lang, setLang] = useState("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("koleex-lang");
      if (saved) queueMicrotask(() => setLang(saved));
    } catch { /* ignore */ }
    const onLang = (e: Event) => setLang((e as CustomEvent<string>).detail || "en");
    window.addEventListener("langchange", onLang);
    return () => window.removeEventListener("langchange", onLang);
  }, []);
  const statusLabel = label ?? orbStatusLabel(visual, activity, lang);

  /* WANDERING: at rest only, and never for someone who asked for stillness.
     It starts in the resting shape and leaves it after the first dwell; the
     moment the state is anything but idle, the state's own look takes over
     (with a morph, like any other change). Paused while the tab is hidden —
     nothing is on screen to change. */
  const wandering = wander && visual === "idle";
  const [wanderMotion, setWanderMotion] = useState<DottedMotion | null>(null);
  useEffect(() => {
    if (!wandering || wantsStill()) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setWanderMotion((m) => nextWanderMotion(m ?? stateLook.motion, Math.random()));
    }, DOTTED_WANDER_MS);
    return () => {
      window.clearInterval(id);
      setWanderMotion(null);
    };
    // The resting motion is fixed per size; re-arming on it would restart the dwell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wandering]);
  const look: DottedLook = wandering && wanderMotion ? { motion: wanderMotion, speed: 1, ink: 1 } : stateLook;

  const { motion, speed, ink } = look;

  /* THE SHAPE CHANGES; IT DOES NOT CUT (owner, 2026-09-23, choosing MORPH
     from six live samples — see dotted-orb-morph.ts). The drawing loop no
     longer restarts when the state changes: it reads the current look from a
     ref, and a change of MOTION starts a morph from the old one. A change of
     PACE alone (resting → speaking share the sash) is not a morph: the loop's
     own clock just runs faster from where it is, so there is no jump. The
     old code rebuilt the loop and restarted time at the new pace, which is
     why every change used to snap. */
  const lookRef = useRef<DottedLook>(look);
  const clockRef = useRef<{ phase: number; last: number } | null>(null);
  const morphRef = useRef<{ from: DottedLook; start: number; phase: number } | null>(null);
  useEffect(() => {
    const prev = lookRef.current;
    lookRef.current = { motion, speed, ink };
    if (prev.motion !== motion && !wantsStill()) {
      morphRef.current = { from: prev, start: performance.now(), phase: clockRef.current?.phase ?? 0 };
      if (clockRef.current) clockRef.current.phase = 0;
    }
  }, [motion, speed, ink]);

  /* Stillness draws one representative frame, and draws it again when the
     state changes — that is its only way to show one. */
  const stillKey = still ? `${motion}|${speed}|${ink}` : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const preset = dottedPreset(size);
    const tuning = (l: DottedLook) => resolvePreset(l.motion, preset);
    const paceOf = (l: DottedLook) => tuning(l).speed * l.speed;
    const frameOf = (l: DottedLook, phase: number) => {
      const { mode, opts } = tuning(l);
      return MODE_FRAMES[mode](size, phase, opts);
    };

    /* COLOUR (see dotted-orb-ink.ts). Core: the original grey ink. Aurora:
       the field's blues, taken at each dot's PLACE on the orb, rippling with
       the field's noise while `flowT` runs — and held at one instant where
       dottedFlows() says the ripple is not worth drawing. */
    const ground = lightDots ? "dark" : "light";
    const flows = dottedFlows(palette, preset, still, lowPower);
    const noise = palette === "aurora" ? auroraNoise() : null;
    let flowT = flows ? performance.now() / 1000 : 0;
    const inkAt = (white: number, alpha: number, x: number, y: number) =>
      noise
        ? tintedInk(white, auroraTint(noise, x, y, size, flowT, ground), alpha, lightDots)
        : monoInk(white, alpha, lightDots);
    const paintLines = (lines: ReturnType<typeof frameOf>["lines"], ink: number) => {
      for (const l of lines) {
        ctx.strokeStyle = inkAt(l.white, (l.a ?? 1) * ink, (l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2);
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
    };
    const paintDots = (dots: readonly MorphDot[], ink: number) => {
      for (const d of dots) {
        ctx.fillStyle = inkAt(d.white, (d.a ?? 1) * ink, d.x, d.y);
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.2, d.r), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const begin = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
    };

    /* Stillness: one representative frame, the one the library itself uses. */
    if (still) {
      const f = frameOf(lookRef.current, 0.6);
      begin();
      paintLines(f.lines, lookRef.current.ink);
      paintDots(f.dots, lookRef.current.ink);
      return;
    }

    const draw = (now: number) => {
      const cur = lookRef.current;
      /* The phase starts where a shared clock would put it, so orbs mounted
         together begin in step; after that it advances by the CURRENT pace,
         which is what lets a change of pace be smooth. A pause (offscreen,
         hidden tab) is capped so the orb does not leap on return. */
      const clock = (clockRef.current ??= { phase: (now / 1000) * paceOf(cur), last: now });
      const dt = Math.min(0.1, Math.max(0, (now - clock.last) / 1000));
      clock.last = now;
      clock.phase += dt * paceOf(cur);
      if (flows) flowT = now / 1000;
      begin();
      const m = morphRef.current;
      if (m) {
        const p = (now - m.start) / DOTTED_MORPH_MS;
        if (p < 1) {
          m.phase += dt * paceOf(m.from);
          const e = easeInOutCubic(p);
          const from = frameOf(m.from, m.phase);
          const to = frameOf(cur, clock.phase);
          paintLines(from.lines, m.from.ink * (1 - e));
          paintLines(to.lines, cur.ink * e);
          paintDots(morphDots(from.dots, to.dots, size / 2, e), m.from.ink + (cur.ink - m.from.ink) * e);
          return;
        }
        morphRef.current = null;
      }
      const f = frameOf(cur, clock.phase);
      paintLines(f.lines, cur.ink);
      paintDots(f.dots, cur.ink);
    };

    let raf = 0;
    let running = false;
    const loop = (now: number) => { draw(now); if (running) raf = requestAnimationFrame(loop); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    /* Always one frame, even offscreen — an orb scrolled into view must not
       arrive blank. Then free whenever it cannot be seen. */
    draw(performance.now());
    let visible = true;
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = !!entry?.isIntersecting;
          if (visible && document.visibilityState !== "hidden") start(); else stop();
        })
      : null;
    io?.observe(canvas);
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!io) start();
    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size, lightDots, still, stillKey, palette, lowPower]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      data-orb-style="dots"
      className={`kx-dotted-orb relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          width: size,
          height: size,
          display: "block",
          /* The voice, on a call: the sphere breathes with it. Transform
             only — nothing here repaints anything but this canvas. */
          transform: audioActive ? "scale(calc(1 + var(--kx-orb-audio, 0) * 0.12))" : undefined,
          transformOrigin: "50% 50%",
        }}
      />
    </div>
  );
}

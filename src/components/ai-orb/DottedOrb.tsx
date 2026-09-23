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
import { dottedLook, dottedPreset } from "./dotted-orb-map";

export interface DottedOrbProps extends AIOrbProps {
  /** "dark" pins light dots — for surfaces that are dark in both themes
   *  (the call screen). "auto" follows the app's theme. */
  surface?: "auto" | "dark";
}

/** The app's own theme on <html>: light only when it says so; the Hub's
 *  default is dark. */
function appIsDark(): boolean {
  return document.documentElement.dataset.theme !== "light";
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
}: DottedOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visual = resolveOrbState(state, result);
  const look = dottedLook(state, activity, result, size);
  const audioActive = visual === "listening" || visual === "speaking";
  useAudioSmoothing(rootRef, clamp01(audioLevel), audioActive);

  /* Theme and stillness are read after mount (no SSR/hydration mismatch) and
     followed live: the header's theme toggle and the Display tab both change
     <html>, and an orb already on screen should follow without a reload. */
  const [dark, setDark] = useState(true);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const read = () => { setDark(appIsDark()); setStill(wantsStill()); };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
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

  const { motion, speed, ink } = look;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { mode, speed: tuned, opts } = resolvePreset(motion, dottedPreset(size));
    const frameAt = MODE_FRAMES[mode];
    const pace = tuned * speed;

    const draw = (tSec: number) => {
      const { dots, lines } = frameAt(size, tSec, opts);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      /* The engine's ink convention: `white` is the value on paper; on a
         dark ground it is mirrored so the near dots read bright. */
      for (const l of lines) {
        const w = Math.min(1, Math.max(0, l.white));
        const g = Math.round((lightDots ? 1 - w : w) * 255);
        ctx.strokeStyle = `rgba(${g},${g},${g},${(l.a ?? 1) * ink})`;
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
      for (const d of dots) {
        const w = Math.min(1, Math.max(0, d.white));
        const g = Math.round((lightDots ? 1 - w : w) * 255);
        ctx.fillStyle = `rgba(${g},${g},${g},${(d.a ?? 1) * ink})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /* Stillness: one representative frame, the one the library itself uses. */
    if (still) { draw(0.6); return; }

    /* One clock for every dotted orb on the page, so two of them side by
       side (a chat bubble and the header) move in step. */
    const now = () => (performance.now() / 1000) * pace;
    let raf = 0;
    let running = false;
    const loop = () => { draw(now()); if (running) raf = requestAnimationFrame(loop); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    /* Always one frame, even offscreen — an orb scrolled into view must not
       arrive blank. Then free whenever it cannot be seen. */
    draw(now());
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
  }, [motion, speed, ink, size, lightDots, still]);

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

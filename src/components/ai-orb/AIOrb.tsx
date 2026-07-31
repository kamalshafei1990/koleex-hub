"use client";

/* ---------------------------------------------------------------------------
   AIOrb — the Koleex AI face as a state-driven visual status system.

   Identity (unchanged, owner-approved): dark-glass sphere #0b0d11 with an
   ice rim, two vertical white indicators (blink + glance), and ALL Hub
   Blue color living BEHIND the ball as a breathing aura. This component
   extends that identity with semantic motion layers:

     aura        — Hub Blue glow behind the ball (state-paced)
     halo        — thin rotating tool ring (processing)
     particles   — 8 orbital points (thinking/processing families)
     sphere      — the glass ball: float, eyes, floor light
     spec        — moving specular highlight (parallax-driven)
     inner       — internal gradient circulation (thinking/analyzing)
     scan        — activity scans (arc / line / sweep families)
     streak      — occasional light streak while thinking
     ripple      — center-out construction ripple (generating/creating)
     ring        — one-shot success ripple
     tint        — amber/red wash for warning/error
     progress    — REAL-progress arc (never fake)

   All motion is CSS (transform/opacity/filter only); the two rAF loops
   (parallax, audio smoothing) write CSS variables on the root node and
   never touch React state. prefers-reduced-motion collapses everything
   to opacity. Authored at 200px, scaled via `size`.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import {
  ACTIVITY_FAMILY,
  clamp01,
  resolveOrbState,
  type AIOrbProps,
} from "./ai-orb-types";
import { orbStatusLabel } from "./ai-orb-labels";
import { useOrbParallax } from "./useOrbParallax";
import { useAudioSmoothing } from "./useAudioSmoothing";

export default function AIOrb({
  state = "idle",
  activity = "none",
  result = "none",
  audioLevel = 0,
  progress = null,
  interactive = false,
  compact: compactProp,
  size = 72,
  className = "",
  label,
}: AIOrbProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const s = size / 200;
  const compact = compactProp ?? size < 44;
  const visual = resolveOrbState(state, result);
  const family =
    visual === "processing" || visual === "thinking"
      ? ACTIVITY_FAMILY[activity]
      : null;
  const audioActive = visual === "listening" || visual === "speaking";

  useOrbParallax(rootRef, interactive && !compact, compact ? 3 : 6);
  useAudioSmoothing(rootRef, clamp01(audioLevel), audioActive);

  /* aria label follows the app language (koleex-lang + langchange). */
  const [lang, setLang] = useState("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("koleex-lang");
      if (saved) setLang(saved);
    } catch { /* ignore */ }
    const onLang = (e: Event) => setLang((e as CustomEvent<string>).detail || "en");
    window.addEventListener("langchange", onLang);
    return () => window.removeEventListener("langchange", onLang);
  }, []);
  const statusLabel = label ?? orbStatusLabel(visual, activity, lang);

  /* Pause the (many) CSS animations while the tab is hidden. */
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const prog = progress == null ? null : clamp01(progress);
  const C = 2 * Math.PI * 94;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      className={[
        "kx-aiorb",
        `is-${visual}`,
        family ? `fam-${family}` : "",
        compact ? "is-compact" : "",
        interactive ? "is-interactive" : "",
        hidden ? "is-paused" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    >
      <div className="k-tilt">
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${s})` }}>
          <div className="aura" />
          <div className="halo" />
          <div className="particles" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
          <div className="sphere">
            <div className="inner" />
            <div className="scan" />
            <div className="streak" />
            <div className="ripple" />
            <div className="spec" />
            <div className="tint" />
          </div>
          <div className="ring" />
          {prog !== null && (
            <svg className="prog" viewBox="0 0 200 200" aria-hidden>
              <circle
                cx="100" cy="100" r="94" fill="none"
                stroke="rgba(127,169,214,0.85)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(C * prog).toFixed(1)} ${C.toFixed(1)}`}
                transform="rotate(-90 100 100)"
              />
            </svg>
          )}
        </div>
      </div>

      <style>{`
        .kx-aiorb {
          position: relative;
          flex: none;
          transition: transform 0.3s cubic-bezier(0.34, 1.3, 0.4, 1);
        }
        .kx-aiorb.is-interactive { cursor: pointer; }
        .kx-aiorb.is-interactive:hover { transform: scale(1.035); }
        .kx-aiorb.is-interactive:active { transform: scale(0.96); }
        .kx-aiorb.is-paused *, .kx-aiorb.is-paused *::before, .kx-aiorb.is-paused *::after {
          animation-play-state: paused !important;
        }
        .kx-aiorb .k-tilt {
          position: absolute;
          inset: 0;
          transform:
            perspective(600px)
            rotateX(var(--kx-orb-rx, 0deg))
            rotateY(var(--kx-orb-ry, 0deg))
            scale(calc(1 + var(--kx-orb-audio, 0) * 0.055));
        }
        .kx-aiorb .stage {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 200px;
          height: 200px;
        }
        .kx-aiorb .aura,
        .kx-aiorb .halo,
        .kx-aiorb .sphere,
        .kx-aiorb .ring,
        .kx-aiorb .prog {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 100%;
        }

        /* ── Aura: ALL the Hub Blue lives back here — never over the face. ── */
        .kx-aiorb .aura {
          width: 214px;
          height: 214px;
          z-index: 5;
          filter: blur(24px);
          animation:
            kxA-spin 10s linear infinite,
            kxA-breathe 3.4s ease-in-out infinite alternate;
          background:
            radial-gradient(circle at 28% 70%, #567fb2 0%, rgba(86, 127, 178, 0.6) 30%, transparent 64%),
            radial-gradient(circle at 74% 28%, #7fa9d6 0%, rgba(127, 169, 214, 0.55) 26%, transparent 60%),
            radial-gradient(circle at 62% 84%, #bcd8f0 0%, transparent 52%);
        }
        .kx-aiorb.is-thinking .aura,
        .kx-aiorb.is-processing .aura,
        .kx-aiorb.is-transcribing .aura { animation-duration: 6s, 1.4s; filter: blur(20px); }
        .kx-aiorb.is-listening .aura,
        .kx-aiorb.is-speaking .aura {
          animation-duration: 8s, 2.6s;
          opacity: calc(0.72 + var(--kx-orb-audio, 0) * 0.28);
        }
        .kx-aiorb.is-sleeping .aura { animation-duration: 30s, 9s; opacity: 0.14; }
        .kx-aiorb.fam-counter-rotate .aura { animation-direction: reverse, normal; }

        /* ── Halo: thin rotating tool ring (processing only). ── */
        .kx-aiorb .halo {
          width: 206px;
          height: 206px;
          z-index: 8;
          opacity: 0;
          transition: opacity 0.4s ease;
          background: conic-gradient(
            from 0deg,
            rgba(127, 169, 214, 0.75) 0deg 40deg,
            transparent 52deg 360deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px));
          animation: kxA-rot 3.6s linear infinite;
        }
        .kx-aiorb.is-processing .halo { opacity: 1; }
        .kx-aiorb.fam-arc-scan .halo { animation-duration: 1.9s; }

        /* ── Particles: 8 soft points orbiting (thinking/processing). ── */
        .kx-aiorb .particles { position: absolute; inset: 0; z-index: 9; pointer-events: none; }
        .kx-aiorb .particles span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 5px;
          height: 5px;
          margin: -2.5px;
          border-radius: 100%;
          background: rgba(188, 216, 240, 0.85);
          opacity: 0;
          transform: rotate(calc(var(--i) * 45deg)) translateX(112px);
        }
        .kx-aiorb.is-thinking .particles span,
        .kx-aiorb.is-processing .particles span {
          opacity: 0.22;
          animation: kxA-orbit 9s linear infinite;
          animation-delay: calc(var(--i) * -1.125s);
        }
        .kx-aiorb.fam-ordered-orbit .particles span {
          opacity: 0.3;
          animation-duration: 3.2s;
          animation-delay: calc(var(--i) * -0.4s);
        }
        .kx-aiorb.is-compact .particles span:nth-child(n + 5) { display: none; }

        /* ── Sphere: the identity. Dark glass, ice rim, floor light. ── */
        .kx-aiorb .sphere {
          width: 200px;
          height: 200px;
          z-index: 50;
          overflow: hidden;
          background: #0b0d11;
          border: 2px solid rgba(188, 216, 240, 0.25);
          box-shadow:
            inset 0 3px 12px rgba(255, 255, 255, 0.16),
            inset 0 -12px 30px rgba(0, 0, 0, 0.55),
            inset 0 0 0 1px rgba(188, 216, 240, 0.06);
          animation: kxA-float 5s ease-in-out infinite;
          transition: filter 0.4s ease;
        }
        .kx-aiorb.is-processing .sphere { filter: brightness(1.06); }
        .kx-aiorb.is-sleeping .sphere { animation-duration: 14s; }
        .kx-aiorb.is-success .sphere { filter: brightness(1.14); }
        .kx-aiorb.is-error .sphere { animation: kxA-float 5s ease-in-out infinite, kxA-shake 0.42s ease-in-out 1; }

        /* Eyes: one bar + its box-shadow twin; blink + glance around. */
        .kx-aiorb .sphere::before {
          content: "";
          position: absolute;
          top: 44%;
          left: 47%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 48px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 40px 0 0 #fff;
          z-index: 60;
          animation:
            kxA-blink 6.4s infinite,
            kxA-look 7s infinite ease-in-out;
          transition: height 0.25s ease, opacity 0.4s ease;
        }
        .kx-aiorb.is-listening .sphere::before,
        .kx-aiorb.is-speaking .sphere::before {
          animation: none;
          height: calc(34px + var(--kx-orb-audio, 0) * 22px);
        }
        .kx-aiorb.is-transcribing .sphere::before {
          animation: kxA-scribe 1.1s ease-in-out infinite;
        }
        .kx-aiorb.is-sleeping .sphere::before { animation: none; height: 8px; opacity: 0.35; }
        .kx-aiorb.is-success .sphere::before { animation: none; height: 48px; box-shadow: 40px 0 0 #fff, 0 0 14px rgba(255,255,255,0.8), 40px 0 14px rgba(255,255,255,0.8); }
        .kx-aiorb.is-error .sphere::before { animation: none; height: 20px; }
        .kx-aiorb.is-awakening .sphere::before { animation: kxA-eyes-on 0.8s ease-out both; }

        /* Floor light inside the glass — keeps the ball 3D. */
        .kx-aiorb .sphere::after {
          content: "";
          position: absolute;
          left: 12%;
          right: 12%;
          bottom: -34%;
          height: 70%;
          border-radius: 100%;
          background: radial-gradient(closest-side, rgba(127, 169, 214, 0.55), transparent);
          filter: blur(10px);
        }

        /* Specular highlight — drifts with the cursor (fresnel-ish). */
        .kx-aiorb .spec {
          position: absolute;
          left: calc(22% + var(--kx-orb-hx, 0%));
          top: calc(10% + var(--kx-orb-hy, 0%));
          width: 44%;
          height: 30%;
          border-radius: 100%;
          background: radial-gradient(closest-side, rgba(255, 255, 255, 0.14), transparent 75%);
          filter: blur(6px);
          z-index: 55;
          pointer-events: none;
        }

        /* Internal gradient circulation — thinking looks computational. */
        .kx-aiorb .inner {
          position: absolute;
          inset: 8%;
          border-radius: 100%;
          opacity: 0;
          transition: opacity 0.5s ease;
          background:
            radial-gradient(circle at 30% 60%, rgba(86, 127, 178, 0.22), transparent 55%),
            radial-gradient(circle at 72% 34%, rgba(127, 169, 214, 0.16), transparent 50%);
          animation: kxA-rot 12s linear infinite;
          z-index: 52;
        }
        .kx-aiorb.is-thinking .inner { opacity: 1; }
        .kx-aiorb.fam-counter-rotate .inner { opacity: 1; animation-duration: 6s; }

        /* Scan element — one node, styled per activity family. */
        .kx-aiorb .scan {
          position: absolute;
          inset: 0;
          border-radius: 100%;
          opacity: 0;
          z-index: 56;
          pointer-events: none;
        }
        .kx-aiorb.is-transcribing .scan,
        .kx-aiorb.fam-sweep-lr .scan {
          opacity: 1;
          background: linear-gradient(90deg, transparent 0%, rgba(188, 216, 240, 0.14) 50%, transparent 100%);
          background-size: 60% 100%;
          background-repeat: no-repeat;
          animation: kxA-sweep 1.8s ease-in-out infinite alternate;
        }
        .kx-aiorb.fam-line-scan .scan {
          opacity: 1;
          background: linear-gradient(180deg, transparent 0%, rgba(188, 216, 240, 0.2) 50%, transparent 100%);
          background-size: 100% 22%;
          background-repeat: no-repeat;
          animation: kxA-read 2.2s ease-in-out infinite;
        }
        .kx-aiorb.fam-arc-scan .scan {
          opacity: 1;
          background: conic-gradient(from 0deg, rgba(188, 216, 240, 0.16) 0deg 26deg, transparent 34deg 360deg);
          animation: kxA-rot 1.9s linear infinite;
        }

        /* Occasional light streak while thinking. */
        .kx-aiorb .streak {
          position: absolute;
          inset: -10%;
          opacity: 0;
          background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.10) 50%, transparent 58%);
          z-index: 57;
          pointer-events: none;
        }
        .kx-aiorb.is-thinking .streak { animation: kxA-streak 7s ease-in-out infinite; }

        /* Center-out construction ripple (generating / creating-record). */
        .kx-aiorb .ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 30px;
          height: 30px;
          margin: -15px;
          border-radius: 100%;
          border: 1.5px solid rgba(188, 216, 240, 0.4);
          opacity: 0;
          z-index: 53;
          pointer-events: none;
        }
        .kx-aiorb.fam-ripple-out .ripple { animation: kxA-ripple 1.8s ease-out infinite; }

        /* One-shot success ring. */
        .kx-aiorb .ring {
          width: 200px;
          height: 200px;
          border: 2px solid rgba(220, 236, 250, 0.8);
          opacity: 0;
          z-index: 40;
          pointer-events: none;
        }
        .kx-aiorb.is-success .ring { animation: kxA-ring 0.7s ease-out 1; }

        /* Amber / red wash for warning / error — soft, never flashing. */
        .kx-aiorb .tint {
          position: absolute;
          inset: 0;
          border-radius: 100%;
          opacity: 0;
          z-index: 58;
          pointer-events: none;
          transition: opacity 0.35s ease;
        }
        .kx-aiorb.is-warning .tint {
          background: radial-gradient(circle at 50% 62%, rgba(255, 204, 0, 0.16), transparent 70%);
          animation: kxA-pulse 1.4s ease-in-out 2;
          opacity: 1;
        }
        .kx-aiorb.is-error .tint {
          background: radial-gradient(circle at 50% 62%, rgba(255, 51, 51, 0.18), transparent 70%);
          animation: kxA-pulse 0.9s ease-in-out 1;
          opacity: 1;
        }

        .kx-aiorb .prog { width: 200px; height: 200px; z-index: 42; }

        /* Awakening: glow turns on from the center, then settles. */
        .kx-aiorb.is-awakening .stage { animation: kxA-awaken 0.75s ease-out both; }

        /* ── Keyframes ── */
        @keyframes kxA-float {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(calc(-50% + 5px), calc(-50% - 10px)) rotate(2.5deg); }
          50% { transform: translate(-50%, calc(-50% - 15px)) rotate(0deg); }
          75% { transform: translate(calc(-50% - 5px), calc(-50% - 10px)) rotate(-2.5deg); }
        }
        @keyframes kxA-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes kxA-rot { to { transform: rotate(360deg); } }
        @keyframes kxA-breathe { from { opacity: 0.62; } to { opacity: 1; } }
        @keyframes kxA-blink {
          0%, 42% { height: 48px; }
          44% { height: 5px; }
          46%, 88% { height: 48px; }
          90% { height: 5px; }
          92% { height: 48px; }
          94% { height: 5px; }
          96%, 100% { height: 48px; }
        }
        @keyframes kxA-look {
          0%, 24% { left: 47%; top: 44%; }
          30%, 40% { left: 39%; top: 44%; }
          46%, 56% { left: 55%; top: 44%; }
          62%, 70% { left: 50%; top: 39%; }
          76%, 100% { left: 47%; top: 44%; }
        }
        @keyframes kxA-scribe {
          0%, 100% { height: 26px; width: 12px; }
          50% { height: 40px; width: 12px; }
        }
        @keyframes kxA-eyes-on {
          from { opacity: 0; height: 4px; }
          to { opacity: 1; height: 48px; }
        }
        @keyframes kxA-orbit {
          from { transform: rotate(calc(var(--i) * 45deg)) translateX(112px); }
          to { transform: rotate(calc(var(--i) * 45deg + 360deg)) translateX(112px); }
        }
        @keyframes kxA-sweep {
          from { background-position: -60% 0; }
          to { background-position: 160% 0; }
        }
        @keyframes kxA-read {
          0% { background-position: 0 -25%; }
          80% { background-position: 0 125%; }
          100% { background-position: 0 125%; }
        }
        @keyframes kxA-streak {
          0%, 78% { opacity: 0; transform: translateX(-30%); }
          86% { opacity: 1; }
          94%, 100% { opacity: 0; transform: translateX(30%); }
        }
        @keyframes kxA-ripple {
          0% { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(5.6); opacity: 0; }
        }
        @keyframes kxA-ring {
          0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1.45); opacity: 0; }
        }
        @keyframes kxA-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes kxA-shake {
          0%, 100% { margin-left: 0; }
          25% { margin-left: -2.5px; }
          50% { margin-left: 2.5px; }
          75% { margin-left: -1.5px; }
        }
        @keyframes kxA-awaken {
          from { opacity: 0; filter: brightness(0.4); }
          to { opacity: 1; filter: brightness(1); }
        }

        /* ── Accessibility: reduced motion keeps only opacity truth. ── */
        @media (prefers-reduced-motion: reduce) {
          .kx-aiorb *, .kx-aiorb *::before, .kx-aiorb *::after {
            animation: none !important;
            transition: opacity 0.3s ease !important;
          }
          .kx-aiorb .k-tilt { transform: none; }
          .kx-aiorb .particles { display: none; }
        }
      `}</style>
    </div>
  );
}

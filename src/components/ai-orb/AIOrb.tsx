"use client";

/* ---------------------------------------------------------------------------
   AIOrb — the Koleex AI face as an EMOTIVE, state-driven status system.

   Identity (unchanged): dark-glass sphere #0b0d11, ice rim, two white
   eyes, Hub Blue aura living BEHIND the ball.

   The emotion engine has two actors:

   · THE EYES — two real DOM capsules that MORPH between emotional
     shapes (open / happy arcs / sad slant / skeptical / focused slits /
     closed) through spring-eased transitions, plus continuous acting:
     blinking, glancing, scanning while searching, line-tracking while
     reading, looking up while thinking, swelling with audio.

   · THE BODY — the ball itself changes posture: bounces on success,
     shakes-and-droops on error, sways while thinking, leans in while
     listening, perks up when awakening, sags asleep. Posture changes
     ride one spring transition so every emotion flows into the next.

   Activity layers (halo, particles, scans, ripples, progress arc) sit
   around that living core. All continuous motion is CSS; the two rAF
   loops (parallax, audio) write CSS vars only. Authored at 200px.
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
          {/* body = continuous float · sphere = emotional posture */}
          <div className="body">
            <div className="sphere">
              <div className="inner" />
              <div className="scan" />
              <div className="streak" />
              <div className="ripple" />
              <div className="spec" />
              <div className="tint" />
              <div className="eyes">
                <span className="eye l" />
                <span className="eye r" />
              </div>
            </div>
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
        .kx-aiorb .body,
        .kx-aiorb .ring,
        .kx-aiorb .prog {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 100%;
        }

        /* ── Aura: ALL the Hub Blue lives behind — never over the face. ── */
        .kx-aiorb .aura {
          width: 214px;
          height: 214px;
          z-index: 5;
          filter: blur(24px);
          animation:
            kxA-spin 9s linear infinite,
            kxA-breathe 2.8s ease-in-out infinite alternate;
          background:
            radial-gradient(circle at 28% 70%, #567fb2 0%, rgba(86, 127, 178, 0.6) 30%, transparent 64%),
            radial-gradient(circle at 74% 28%, #7fa9d6 0%, rgba(127, 169, 214, 0.55) 26%, transparent 60%),
            radial-gradient(circle at 62% 84%, #bcd8f0 0%, transparent 52%);
          transition: opacity 0.5s ease, filter 0.5s ease;
        }
        .kx-aiorb.is-thinking .aura,
        .kx-aiorb.is-processing .aura,
        .kx-aiorb.is-transcribing .aura { animation-duration: 5s, 1.1s; filter: blur(19px); }
        .kx-aiorb.is-listening .aura,
        .kx-aiorb.is-speaking .aura {
          animation-duration: 7s, 2.2s;
          opacity: calc(0.72 + var(--kx-orb-audio, 0) * 0.28);
        }
        .kx-aiorb.is-success .aura { filter: blur(19px) brightness(1.35); }
        .kx-aiorb.is-error .aura { filter: blur(26px) brightness(0.6); }
        .kx-aiorb.is-sleeping .aura { animation-duration: 30s, 9s; opacity: 0.14; }
        .kx-aiorb.fam-counter-rotate .aura { animation-direction: reverse, normal; }

        /* ── Halo: rotating tool ring (processing). ── */
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
          animation: kxA-rot 3.2s linear infinite;
        }
        .kx-aiorb.is-processing .halo { opacity: 1; }
        .kx-aiorb.fam-arc-scan .halo { animation-duration: 1.7s; }

        /* ── Particles. ── */
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
          transition: opacity 0.5s ease;
        }
        .kx-aiorb.is-thinking .particles span,
        .kx-aiorb.is-processing .particles span {
          opacity: 0.22;
          animation: kxA-orbit 8s linear infinite;
          animation-delay: calc(var(--i) * -1s);
        }
        .kx-aiorb.fam-ordered-orbit .particles span {
          opacity: 0.3;
          animation-duration: 3s;
          animation-delay: calc(var(--i) * -0.375s);
        }
        .kx-aiorb.is-compact .particles span:nth-child(n + 5) { display: none; }

        /* ── Body: continuous float — always alive. ── */
        .kx-aiorb .body {
          width: 200px;
          height: 200px;
          z-index: 50;
          animation: kxA-float 5s ease-in-out infinite;
        }
        .kx-aiorb.is-sleeping .body { animation-duration: 12s; }
        .kx-aiorb.is-listening .body,
        .kx-aiorb.is-speaking .body { animation-duration: 3.6s; }

        /* ── Sphere: the glass + EMOTIONAL POSTURE. One spring transition
             carries every state-to-state posture change. ── */
        .kx-aiorb .sphere {
          position: absolute;
          inset: 0;
          border-radius: 100%;
          overflow: hidden;
          background: #0b0d11;
          border: 2px solid rgba(188, 216, 240, 0.25);
          box-shadow:
            inset 0 3px 12px rgba(255, 255, 255, 0.16),
            inset 0 -12px 30px rgba(0, 0, 0, 0.55),
            inset 0 0 0 1px rgba(188, 216, 240, 0.06);
          transition:
            transform 0.5s cubic-bezier(0.34, 1.45, 0.4, 1),
            filter 0.4s ease;
        }
        .kx-aiorb.is-thinking .sphere { animation: kxA-sway 5.5s ease-in-out infinite; }
        .kx-aiorb.is-processing .sphere { filter: brightness(1.06); transform: rotate(-2deg); }
        .kx-aiorb.is-listening .sphere { transform: translateY(3px) scale(1.03); }
        .kx-aiorb.is-transcribing .sphere { transform: rotate(2deg); }
        .kx-aiorb.is-speaking .sphere { transform: translateY(calc(var(--kx-orb-audio, 0) * -4px)); }
        .kx-aiorb.is-success .sphere { filter: brightness(1.14); animation: kxA-bounce 1.1s cubic-bezier(0.34, 1.4, 0.5, 1) 1; }
        .kx-aiorb.is-warning .sphere { transform: rotate(-3deg); }
        .kx-aiorb.is-error .sphere { animation: kxA-shake 0.55s ease-in-out 1; transform: translateY(10px) rotate(-3deg) scale(0.97); filter: brightness(0.88); }
        .kx-aiorb.is-sleeping .sphere { transform: translateY(8px) scale(0.97); filter: brightness(0.75); }
        .kx-aiorb.is-awakening .sphere { animation: kxA-wake 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 1; }

        /* ── EYES: two independent capsules that ACT. Every geometric
             property rides the spring so emotions morph, never snap. ── */
        .kx-aiorb .eyes {
          position: absolute;
          left: 57%;
          top: 44%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 24px;
          z-index: 60;
          transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.4, 1);
        }
        .kx-aiorb .eye {
          width: 16px;
          height: 48px;
          border-radius: 8px;
          background: #fff;
          transform-origin: center;
          transition:
            height 0.35s cubic-bezier(0.3, 1.6, 0.4, 1),
            width 0.35s cubic-bezier(0.3, 1.6, 0.4, 1),
            border-radius 0.35s ease,
            transform 0.4s cubic-bezier(0.3, 1.6, 0.4, 1),
            opacity 0.4s ease,
            box-shadow 0.4s ease;
          animation: kxA-blink 4.6s infinite;
        }

        /* idle: the LIFE loop — gaze wanders with anticipation while the
           body leans into each glance (see kxA-bodylife on the sphere). */
        .kx-aiorb.is-idle .eyes { animation: kxA-life 12s ease-in-out infinite; }
        .kx-aiorb.is-idle .sphere { animation: kxA-bodylife 12s ease-in-out infinite; }

        /* awakening: eyes stretch open wide, then settle. */
        .kx-aiorb.is-awakening .eye { animation: kxA-eyes-wake 0.9s ease-out both; }

        /* thinking: focused slits looking UP — actually pondering. */
        .kx-aiorb.is-thinking .eye { height: 28px; animation: none; }
        .kx-aiorb.is-thinking .eye.r { height: 38px; }
        .kx-aiorb.is-thinking .eyes { animation: kxA-ponder 5.5s ease-in-out infinite; }

        /* processing: narrowed, steady, looking slightly down at the work. */
        .kx-aiorb.is-processing .eye { height: 34px; animation: none; }
        .kx-aiorb.is-processing .eyes { transform: translate(-50%, -44%); }

        /* searching: eyes dart left-right hunting. */
        .kx-aiorb.fam-arc-scan .eyes { animation: kxA-hunt 1.5s ease-in-out infinite alternate; }

        /* reading: gaze tracks lines — small saccades stepping down. */
        .kx-aiorb.fam-line-scan .eyes { animation: kxA-trackline 2.2s ease-in-out infinite; }
        .kx-aiorb.fam-line-scan .eye { height: 26px; }

        /* translating/connecting: gaze crosses side to side with the energy. */
        .kx-aiorb.fam-sweep-lr .eyes { animation: kxA-crossgaze 1.8s ease-in-out infinite alternate; }

        /* listening: soft, attentive; height breathes with the voice. */
        .kx-aiorb.is-listening .eyes { transform: translate(-50%, -50%) rotate(4deg); }
        .kx-aiorb.is-listening .eye {
          animation: none;
          height: calc(36px + var(--kx-orb-audio, 0) * 20px);
        }
        /* speaking: syllables move the eyes. */
        .kx-aiorb.is-speaking .eye {
          animation: none;
          height: calc(28px + var(--kx-orb-audio, 0) * 26px);
        }

        /* transcribing: measured writing rhythm. */
        .kx-aiorb.is-transcribing .eye { animation: kxA-scribe 1s ease-in-out infinite; }

        /* SUCCESS: happy closed arcs (^ ^) + brighten. */
        .kx-aiorb.is-success .eye {
          animation: none;
          height: 48px;
          transform: translateY(-6px);
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.95);
        }
        .kx-aiorb.is-success .eyes { transform: translate(-50%, -52%); }
        /* ERROR: sad inward slant + droop. */
        .kx-aiorb.is-error .eye { animation: none; height: 32px; }
        .kx-aiorb.is-error .eye.l { transform: rotate(16deg) translateY(8px); }
        .kx-aiorb.is-error .eye.r { transform: rotate(-16deg) translateY(8px); }
        .kx-aiorb.is-error .eyes { transform: translate(-50%, -44%); }
        /* WARNING: skeptical — one brow raised. */
        .kx-aiorb.is-warning .eye { animation: none; }
        .kx-aiorb.is-warning .eye.l { height: 54px; transform: translateY(-5px); }
        .kx-aiorb.is-warning .eye.r { height: 28px; transform: translateY(5px); }
        /* SLEEPING: closed lines. */
        .kx-aiorb.is-sleeping .eye { animation: none; height: 5px; opacity: 0.45; }

        /* Floor light + specular keep the ball 3D. */
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

        /* Internal circulation (thinking looks computational). */
        .kx-aiorb .inner {
          position: absolute;
          inset: 8%;
          border-radius: 100%;
          opacity: 0;
          transition: opacity 0.5s ease;
          background:
            radial-gradient(circle at 30% 60%, rgba(86, 127, 178, 0.22), transparent 55%),
            radial-gradient(circle at 72% 34%, rgba(127, 169, 214, 0.16), transparent 50%);
          animation: kxA-rot 11s linear infinite;
          z-index: 52;
        }
        .kx-aiorb.is-thinking .inner { opacity: 1; }
        .kx-aiorb.fam-counter-rotate .inner { opacity: 1; animation-duration: 5.5s; }

        /* Activity scans. */
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
          animation: kxA-rot 1.7s linear infinite;
        }

        .kx-aiorb .streak {
          position: absolute;
          inset: -10%;
          opacity: 0;
          background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.10) 50%, transparent 58%);
          z-index: 57;
          pointer-events: none;
        }
        .kx-aiorb.is-thinking .streak { animation: kxA-streak 6s ease-in-out infinite; }

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
        .kx-aiorb.fam-ripple-out .ripple { animation: kxA-ripple 1.6s ease-out infinite; }

        .kx-aiorb .ring {
          width: 200px;
          height: 200px;
          border: 2px solid rgba(220, 236, 250, 0.8);
          opacity: 0;
          z-index: 40;
          pointer-events: none;
        }
        .kx-aiorb.is-success .ring { animation: kxA-ring 0.7s ease-out 1; }

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
        .kx-aiorb.is-awakening .stage { animation: kxA-awaken 0.75s ease-out both; }

        /* ── Keyframes ── */
        @keyframes kxA-float {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(calc(-50% + 6px), calc(-50% - 11px)) rotate(2.5deg); }
          50% { transform: translate(-50%, calc(-50% - 17px)) rotate(0deg); }
          75% { transform: translate(calc(-50% - 6px), calc(-50% - 11px)) rotate(-2.5deg); }
        }
        @keyframes kxA-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes kxA-rot { to { transform: rotate(360deg); } }
        @keyframes kxA-breathe { from { opacity: 0.6; } to { opacity: 1; } }
        @keyframes kxA-sway {
          0%, 100% { transform: rotate(-3.5deg); }
          50% { transform: rotate(3.5deg); }
        }
        @keyframes kxA-bounce {
          0% { transform: translateY(0) scale(1, 1); }
          12% { transform: translateY(4px) scale(1.06, 0.9); }
          32% { transform: translateY(-24px) scale(0.94, 1.1); }
          48% { transform: translateY(0) scale(1.1, 0.88); }
          62% { transform: translateY(-12px) scale(0.97, 1.05); }
          76% { transform: translateY(0) scale(1.05, 0.95); }
          88% { transform: translateY(-3px) scale(1, 1.01); }
          100% { transform: translateY(0) scale(1, 1); }
        }
        @keyframes kxA-shake {
          0%, 100% { transform: translate(0, 6px); }
          20% { transform: translate(-4px, 6px) rotate(-2deg); }
          40% { transform: translate(4px, 6px) rotate(2deg); }
          60% { transform: translate(-3px, 6px) rotate(-1.5deg); }
          80% { transform: translate(2px, 6px) rotate(1deg); }
        }
        @keyframes kxA-wake {
          0% { transform: scale(0.85) translateY(10px); }
          60% { transform: scale(1.06) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        /* eyes */
        @keyframes kxA-blink {
          0%, 38% { transform: scaleY(1); }
          41% { transform: scaleY(0.08); }
          44%, 68% { transform: scaleY(1); }
          /* curious half-squint — pure personality */
          72%, 78% { transform: scaleY(0.62); }
          82%, 90% { transform: scaleY(1); }
          92% { transform: scaleY(0.08); }
          94% { transform: scaleY(1); }
          96% { transform: scaleY(0.08); }
          98%, 100% { transform: scaleY(1); }
        }
        @keyframes kxA-life {
          0%, 14% { transform: translate(-50%, -50%); }
          /* dart LEFT with a tiny anticipation kick */
          17% { transform: translate(calc(-50% + 6px), -50%); }
          20%, 30% { transform: translate(calc(-50% - 24px), calc(-50% - 4px)); }
          34%, 40% { transform: translate(-50%, -50%); }
          /* dart RIGHT */
          43% { transform: translate(calc(-50% - 6px), -50%); }
          46%, 56% { transform: translate(calc(-50% + 24px), calc(-50% - 4px)); }
          60%, 68% { transform: translate(-50%, -50%); }
          /* look UP dreamily */
          72%, 80% { transform: translate(calc(-50% + 8px), calc(-50% - 14px)); }
          85%, 100% { transform: translate(-50%, -50%); }
        }
        @keyframes kxA-bodylife {
          0%, 14% { transform: rotate(0deg) translateY(0); }
          20%, 30% { transform: rotate(-5deg) translateY(1px); }
          34%, 40% { transform: rotate(0deg) translateY(0); }
          46%, 56% { transform: rotate(5deg) translateY(1px); }
          60%, 68% { transform: rotate(0deg) translateY(0); }
          72%, 80% { transform: rotate(2deg) translateY(-4px); }
          85%, 100% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes kxA-ponder {
          0%, 100% { transform: translate(calc(-50% - 10px), calc(-50% - 12px)); }
          50% { transform: translate(calc(-50% + 10px), calc(-50% - 12px)); }
        }
        @keyframes kxA-hunt {
          from { transform: translate(calc(-50% - 22px), -50%); }
          to { transform: translate(calc(-50% + 22px), -50%); }
        }
        @keyframes kxA-trackline {
          0% { transform: translate(calc(-50% - 12px), calc(-50% - 6px)); }
          40% { transform: translate(calc(-50% + 12px), calc(-50% - 6px)); }
          50% { transform: translate(calc(-50% - 12px), calc(-50% + 4px)); }
          90% { transform: translate(calc(-50% + 12px), calc(-50% + 4px)); }
          100% { transform: translate(calc(-50% - 12px), calc(-50% - 6px)); }
        }
        @keyframes kxA-crossgaze {
          from { transform: translate(calc(-50% - 14px), -50%); }
          to { transform: translate(calc(-50% + 14px), -50%); }
        }
        @keyframes kxA-scribe {
          0%, 100% { height: 24px; }
          50% { height: 40px; }
        }
        @keyframes kxA-eyes-wake {
          0% { height: 5px; opacity: 0.4; }
          45% { height: 5px; opacity: 0.9; }
          70% { height: 58px; opacity: 1; }
          100% { height: 48px; opacity: 1; }
        }
        /* layers */
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
          0%, 76% { opacity: 0; transform: translateX(-30%); }
          85% { opacity: 1; }
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
        @keyframes kxA-awaken {
          from { opacity: 0; filter: brightness(0.4); }
          to { opacity: 1; filter: brightness(1); }
        }

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

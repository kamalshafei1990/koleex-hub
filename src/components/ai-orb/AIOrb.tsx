"use client";

/* ---------------------------------------------------------------------------
   AIOrb — a calm, intelligent energy sphere with two FIXED identity
   indicators. Enterprise-grade status presence (ChatGPT Voice / Apple
   Intelligence discipline), NOT a cartoon character.

   Design law: "Energy moves; the face remains stable."

   · The two white center indicators are ONE element + its box-shadow twin
     (exactly the approved original from commit 49d60b0c: 16×48 r8, left
     bar centered at 47%, twin +40px, top 44%). Being a single node they
     are structurally synchronized and cannot move independently.

     ▍INDICATOR GEOMETRY LOCK ▍
     No state may change indicator width/height/radius/spacing/position.
     State classes may only touch: opacity, filter (brightness), and a
     synchronized vertical scale ≤ 5% (audio). validate:ai-orb statically
     asserts this against the source.

   · Every state/activity reads through ENERGY: aura pacing, internal
     light circulation, edge halo, sparse particles, scanning light,
     ripples, one clean success ring, restrained tints, and a REAL
     progress arc. The sphere itself drifts 2px, never performs.

   Perf tiers: interactive full-size = full effects; plain instances skip
   parallax; compact (<44px) drops particles/inner/streak/scan detail.
   Offscreen instances pause via IntersectionObserver. Audio rAF only
   runs in listening/speaking. Authored at 200px, scaled via `size`.
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

  useOrbParallax(rootRef, interactive && !compact, compact ? 1.5 : 3);
  useAudioSmoothing(rootRef, clamp01(audioLevel), audioActive);

  /* Irregular, synchronized blink: JS-scheduled every 6–14s so no loop is
     perceivable. Single indicator node → both bars compress together. */
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (!alive) return;
      t1 = setTimeout(() => {
        if (!alive) return;
        if (document.visibilityState === "hidden") { schedule(); return; }
        setBlink(true);
        t2 = setTimeout(() => { setBlink(false); schedule(); }, 130);
      }, 6000 + Math.random() * 8000);
    };
    schedule();
    return () => { alive = false; clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* aria label follows the app language. */
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

  /* Pause all animation when the tab is hidden OR the orb is offscreen. */
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    let offscreen = false;
    let tabHidden = document.visibilityState === "hidden";
    const apply = () => setPaused(tabHidden || offscreen);
    const onVis = () => { tabHidden = document.visibilityState === "hidden"; apply(); };
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        offscreen = !entries[0]?.isIntersecting;
        apply();
      });
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
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
        interactive ? "is-interactive" : "tier-lite",
        paused ? "is-paused" : "",
        blink ? "is-blink" : "",
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
            {/* THE indicators: one node + box-shadow twin — geometry locked. */}
            <div className="ind" />
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
          transition: transform 0.3s cubic-bezier(0.3, 1.1, 0.4, 1);
        }
        .kx-aiorb.is-interactive { cursor: pointer; }
        .kx-aiorb.is-interactive:hover { transform: scale(1.03); }
        .kx-aiorb.is-interactive:active { transform: scale(0.97); }
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
            scale(calc(1 + var(--kx-orb-audio, 0) * 0.03));
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

        /* ── Aura: the Hub Blue energy field, always behind. ── */
        .kx-aiorb .aura {
          width: 214px;
          height: 214px;
          z-index: 5;
          filter: blur(24px);
          animation:
            kxA-spin 14s linear infinite,
            kxA-breathe 4.5s ease-in-out infinite alternate;
          background:
            radial-gradient(circle at 28% 70%, #567fb2 0%, rgba(86, 127, 178, 0.6) 30%, transparent 64%),
            radial-gradient(circle at 74% 28%, #7fa9d6 0%, rgba(127, 169, 214, 0.55) 26%, transparent 60%),
            radial-gradient(circle at 62% 84%, #bcd8f0 0%, transparent 52%);
          transition: opacity 0.6s ease, filter 0.6s ease;
        }
        .kx-aiorb.is-thinking .aura { animation-duration: 9s, 2.6s; }
        .kx-aiorb.is-processing .aura,
        .kx-aiorb.is-transcribing .aura { animation-duration: 10s, 3s; }
        .kx-aiorb.is-listening .aura,
        .kx-aiorb.is-speaking .aura {
          animation-duration: 11s, 3.5s;
          opacity: calc(0.75 + var(--kx-orb-audio, 0) * 0.25);
        }
        .kx-aiorb.is-success .aura { filter: blur(22px) brightness(1.25); }
        .kx-aiorb.is-error .aura { filter: blur(26px) brightness(0.65); }
        .kx-aiorb.is-warning .aura { animation-duration: 16s, 5s; }
        .kx-aiorb.is-sleeping .aura { animation-duration: 40s, 12s; opacity: 0.12; }
        .kx-aiorb.is-awakening .aura { animation: kxA-aura-on 0.8s ease-out both, kxA-spin 14s linear infinite; }
        .kx-aiorb.fam-counter-rotate .aura { animation-direction: reverse, normal; }

        /* ── Halo: thin activity arc on the rim (processing). ── */
        .kx-aiorb .halo {
          width: 206px;
          height: 206px;
          z-index: 8;
          opacity: 0;
          transition: opacity 0.5s ease;
          background: conic-gradient(
            from 0deg,
            rgba(127, 169, 214, 0.7) 0deg 38deg,
            transparent 50deg 360deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px));
          animation: kxA-rot 4.5s linear infinite;
        }
        .kx-aiorb.is-processing .halo { opacity: 1; }
        .kx-aiorb.fam-arc-scan .halo { animation-duration: 2.6s; }

        /* ── Particles: sparse rim energy (thinking/processing only). ── */
        .kx-aiorb .particles { position: absolute; inset: 0; z-index: 9; pointer-events: none; }
        .kx-aiorb .particles span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4px;
          height: 4px;
          margin: -2px;
          border-radius: 100%;
          background: rgba(188, 216, 240, 0.8);
          opacity: 0;
          transform: rotate(calc(var(--i) * 45deg)) translateX(110px);
          transition: opacity 0.6s ease;
        }
        .kx-aiorb.is-thinking .particles span,
        .kx-aiorb.is-processing .particles span {
          opacity: 0.18;
          animation: kxA-orbit 12s linear infinite;
          animation-delay: calc(var(--i) * -1.5s);
        }
        .kx-aiorb.fam-ordered-orbit .particles span {
          opacity: 0.26;
          animation-duration: 4.5s;
          animation-delay: calc(var(--i) * -0.5625s);
        }
        .kx-aiorb.is-compact .particles { display: none; }
        .kx-aiorb.tier-lite .particles span:nth-child(odd) { display: none; }

        /* ── Sphere: stable body. Idle drift ±2px only. ── */
        .kx-aiorb .sphere {
          width: 200px;
          height: 200px;
          z-index: 50;
          overflow: hidden;
          background: #0b0d11;
          border: 2px solid rgba(188, 216, 240, 0.25);
          box-shadow:
            inset 0 3px 12px rgba(255, 255, 255, 0.16),
            inset 0 -12px 30px rgba(0, 0, 0, 0.55);
          animation: kxA-drift 10s ease-in-out infinite;
          transition: filter 0.5s ease;
        }
        .kx-aiorb.is-processing .sphere { filter: brightness(1.05); }
        .kx-aiorb.is-success .sphere { filter: brightness(1.1); animation: kxA-drift 10s ease-in-out infinite, kxA-settle 0.6s ease-out 1; }
        .kx-aiorb.is-error .sphere { filter: brightness(0.92); animation: kxA-drift 10s ease-in-out infinite, kxA-nudge 0.35s ease-in-out 1; }
        .kx-aiorb.is-sleeping .sphere { filter: brightness(0.75); animation-duration: 18s; }

        /* ── INDICATORS — geometry locked (see header). One node + twin. ── */
        .kx-aiorb .ind {
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
          transition:
            transform 0.14s ease,
            opacity 0.5s ease,
            filter 0.4s ease;
        }
        .kx-aiorb.is-blink .ind { transform: translate(-50%, -50%) scaleY(0.1); }
        .kx-aiorb.is-listening .ind,
        .kx-aiorb.is-speaking .ind {
          filter: brightness(calc(1 + var(--kx-orb-audio, 0) * 0.6));
          transform: translate(-50%, -50%) scaleY(calc(1 + var(--kx-orb-audio, 0) * 0.05));
        }
        .kx-aiorb.is-thinking .ind { opacity: 0.85; }
        .kx-aiorb.is-success .ind { filter: brightness(1.4) drop-shadow(0 0 10px rgba(255, 255, 255, 0.7)); }
        .kx-aiorb.is-warning .ind { filter: brightness(1.15); }
        .kx-aiorb.is-error .ind { opacity: 0.75; }
        .kx-aiorb.is-sleeping .ind { opacity: 0.4; }
        .kx-aiorb.is-awakening .ind { animation: kxA-ind-on 0.9s ease-out both; }

        /* Floor light + specular depth. */
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
          background: radial-gradient(closest-side, rgba(255, 255, 255, 0.13), transparent 75%);
          filter: blur(6px);
          z-index: 55;
          pointer-events: none;
          animation: kxA-specdrift 12s ease-in-out infinite alternate;
        }

        /* Internal energy circulation — computational, slow, layered. */
        .kx-aiorb .inner {
          position: absolute;
          inset: 8%;
          border-radius: 100%;
          opacity: 0;
          transition: opacity 0.6s ease;
          background:
            radial-gradient(circle at 30% 60%, rgba(86, 127, 178, 0.2), transparent 55%),
            radial-gradient(circle at 72% 34%, rgba(127, 169, 214, 0.14), transparent 50%);
          animation: kxA-rot 16s linear infinite;
          z-index: 52;
        }
        .kx-aiorb.is-thinking .inner,
        .kx-aiorb.is-listening .inner { opacity: 1; }
        .kx-aiorb.fam-counter-rotate .inner { opacity: 1; animation-duration: 8s; }
        .kx-aiorb.is-compact .inner { display: none; }

        /* Activity scans — signal, not gestures. */
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
          background: linear-gradient(90deg, transparent 0%, rgba(188, 216, 240, 0.12) 50%, transparent 100%);
          background-size: 55% 100%;
          background-repeat: no-repeat;
          animation: kxA-sweep 2.4s ease-in-out infinite alternate;
        }
        .kx-aiorb.fam-line-scan .scan {
          opacity: 1;
          background: linear-gradient(180deg, transparent 0%, rgba(188, 216, 240, 0.16) 50%, transparent 100%);
          background-size: 100% 20%;
          background-repeat: no-repeat;
          animation: kxA-read 2.8s ease-in-out infinite;
        }
        .kx-aiorb.fam-arc-scan .scan {
          opacity: 1;
          background: conic-gradient(from 0deg, rgba(188, 216, 240, 0.13) 0deg 24deg, transparent 32deg 360deg);
          animation: kxA-rot 2.6s linear infinite;
        }
        .kx-aiorb.is-compact .scan { display: none; }

        /* Occasional streak while thinking — controlled, rare. */
        .kx-aiorb .streak {
          position: absolute;
          inset: -10%;
          opacity: 0;
          background: linear-gradient(115deg, transparent 43%, rgba(255, 255, 255, 0.08) 50%, transparent 57%);
          z-index: 57;
          pointer-events: none;
        }
        .kx-aiorb.is-thinking .streak { animation: kxA-streak 9s ease-in-out infinite; }
        .kx-aiorb.is-compact .streak { display: none; }

        /* Center-out construction ripple (generating / creating). */
        .kx-aiorb .ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 30px;
          height: 30px;
          margin: -15px;
          border-radius: 100%;
          border: 1px solid rgba(188, 216, 240, 0.35);
          opacity: 0;
          z-index: 53;
          pointer-events: none;
        }
        .kx-aiorb.fam-ripple-out .ripple { animation: kxA-ripple 2.2s ease-out infinite; }

        /* One clean success ring. */
        .kx-aiorb .ring {
          width: 200px;
          height: 200px;
          border: 2px solid rgba(220, 236, 250, 0.75);
          opacity: 0;
          z-index: 40;
          pointer-events: none;
        }
        .kx-aiorb.is-success .ring { animation: kxA-ring 0.6s ease-out 1; }
        .kx-aiorb.is-awakening .ring { animation: kxA-ring 0.8s ease-out 1 0.3s; }

        /* Restrained token tints. */
        .kx-aiorb .tint {
          position: absolute;
          inset: 0;
          border-radius: 100%;
          opacity: 0;
          z-index: 58;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .kx-aiorb.is-warning .tint {
          background: radial-gradient(circle at 50% 62%, rgba(255, 204, 0, 0.13), transparent 70%);
          animation: kxA-pulse 1.8s ease-in-out 1;
          opacity: 1;
        }
        .kx-aiorb.is-error .tint {
          background: radial-gradient(circle at 50% 62%, rgba(255, 51, 51, 0.15), transparent 70%);
          animation: kxA-pulse 1.1s ease-in-out 1;
          opacity: 1;
        }

        .kx-aiorb .prog { width: 200px; height: 200px; z-index: 42; }

        /* ── Keyframes — all restrained. ── */
        @keyframes kxA-drift {
          0%, 100% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, calc(-50% - 2px)); }
        }
        @keyframes kxA-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes kxA-rot { to { transform: rotate(360deg); } }
        @keyframes kxA-breathe { from { opacity: 0.68; } to { opacity: 1; } }
        @keyframes kxA-settle {
          0% { transform: translate(-50%, -50%) scale(1); }
          40% { transform: translate(-50%, -50%) scale(1.02); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes kxA-nudge {
          0%, 100% { transform: translate(-50%, -50%); }
          30% { transform: translate(calc(-50% - 2px), -50%); }
          65% { transform: translate(calc(-50% + 2px), -50%); }
        }
        @keyframes kxA-aura-on {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kxA-ind-on {
          0% { opacity: 0.15; }
          60% { opacity: 0.15; }
          100% { opacity: 1; }
        }
        @keyframes kxA-specdrift {
          from { transform: translate(0, 0); }
          to { transform: translate(6px, 4px); }
        }
        @keyframes kxA-orbit {
          from { transform: rotate(calc(var(--i) * 45deg)) translateX(110px); }
          to { transform: rotate(calc(var(--i) * 45deg + 360deg)) translateX(110px); }
        }
        @keyframes kxA-sweep {
          from { background-position: -55% 0; }
          to { background-position: 155% 0; }
        }
        @keyframes kxA-read {
          0% { background-position: 0 -22%; }
          78% { background-position: 0 122%; }
          100% { background-position: 0 122%; }
        }
        @keyframes kxA-streak {
          0%, 82% { opacity: 0; transform: translateX(-25%); }
          89% { opacity: 1; }
          96%, 100% { opacity: 0; transform: translateX(25%); }
        }
        @keyframes kxA-ripple {
          0% { transform: scale(0.4); opacity: 0.6; }
          100% { transform: scale(5.6); opacity: 0; }
        }
        @keyframes kxA-ring {
          0% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
        }
        @keyframes kxA-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
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

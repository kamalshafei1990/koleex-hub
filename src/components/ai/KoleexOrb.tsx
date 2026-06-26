"use client";

/* ---------------------------------------------------------------------------
   KoleexOrb — the Koleex AI character (custom, fully code-controlled).

   Previously this wrapped a downloaded Rive file ("AI Orb Mascot"), but that
   .riv could only express one distinct reaction (a loader) and repositioned its
   artwork mid-animation. This is a hand-built orb with the SAME identity (a
   rainbow gradient ring + two eyes on a dark face) but crisp, perfectly-centred
   reactions we control completely:

     • idle    — slow ring drift, gentle breathing, occasional blink
     • loading — ring spins fast (thinking) + eyes glance around
     • typing  — ring spins medium + a soft bob
     • success — green glow + happy squint + a quick pop
     • error   — red glow + flat eyes + a shake
     • greet   — a one-shot bounce (via greetKey)

   Same props/signature as before, so it's a drop-in for every usage.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type OrbState = "idle" | "loading" | "typing" | "success" | "error";

const STYLE_ID = "kxorb-keyframes";
const KEYFRAMES = `
@keyframes kxorb-spin   { to { transform: rotate(360deg); } }
@keyframes kxorb-breathe{ 0%,100%{ transform: scale(1);} 50%{ transform: scale(1.035);} }
@keyframes kxorb-bob    { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6%);} }
@keyframes kxorb-pop    { 0%{ transform: scale(1);} 40%{ transform: scale(1.16);} 100%{ transform: scale(1);} }
@keyframes kxorb-shake  { 0%,100%{ transform: translateX(0);} 20%{ transform: translateX(-10%);} 40%{ transform: translateX(8%);} 60%{ transform: translateX(-6%);} 80%{ transform: translateX(4%);} }
@keyframes kxorb-jump   { 0%,100%{ transform: translateY(0);} 30%{ transform: translateY(-22%);} 55%{ transform: translateY(0);} 72%{ transform: translateY(-9%);} 88%{ transform: translateY(0);} }
@keyframes kxorb-look   { 0%,100%{ transform: translateX(0);} 25%{ transform: translateX(-22%);} 75%{ transform: translateX(22%);} }
@keyframes kxorb-blink  { 0%,90%,100%{ transform: scaleY(1);} 95%{ transform: scaleY(0.12);} }
`;

export default function KoleexOrb({
  state = "idle",
  greetKey,
  size = 96,
  className,
  animated = true,
}: {
  /** Drives the orb: idle · loading (thinking) · typing (streaming) · success · error. */
  state?: OrbState;
  /** Change this value (e.g. a counter) to fire a one-shot "jump" greet reaction. */
  greetKey?: number;
  /** Square pixel size of the orb. */
  size?: number;
  className?: string;
  /** When false, the orb renders fully static (no idle motion). */
  animated?: boolean;
}) {
  /* Inject the keyframes once (shared across every orb instance). */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);

  /* One-shot greet bounce when greetKey changes (skip first mount). */
  const [jumping, setJumping] = useState(false);
  const greetSeen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (greetKey === undefined) return;
    if (greetSeen.current === undefined) {
      greetSeen.current = greetKey;
      return;
    }
    if (greetKey !== greetSeen.current) {
      greetSeen.current = greetKey;
      setJumping(true);
      const t = setTimeout(() => setJumping(false), 900);
      return () => clearTimeout(t);
    }
  }, [greetKey]);

  /* ── Ring spin speed conveys "energy" ── */
  const ringAnim =
    state === "loading"
      ? "kxorb-spin 1.1s linear infinite"
      : state === "typing"
        ? "kxorb-spin 2.6s linear infinite"
        : animated
          ? "kxorb-spin 16s linear infinite"
          : "none";

  /* ── Whole-orb reaction motion ── */
  const orbAnim = jumping
    ? "kxorb-jump 0.9s ease"
    : state === "success"
      ? "kxorb-pop 0.6s ease"
      : state === "error"
        ? "kxorb-shake 0.5s ease"
        : state === "typing" && animated
          ? "kxorb-bob 1s ease-in-out infinite"
          : state === "idle" && animated
            ? "kxorb-breathe 4.5s ease-in-out infinite"
            : "none";

  /* ── Functional status glow (only success/error are coloured) ── */
  const glow =
    state === "success"
      ? "0 0 0 2px rgba(0,204,102,.55), 0 0 20px 5px rgba(0,204,102,.42)"
      : state === "error"
        ? "0 0 0 2px rgba(255,51,51,.55), 0 0 20px 5px rgba(255,51,51,.42)"
        : "0 0 16px 2px rgba(120,130,255,.10)";

  /* ── Eye shape + motion per state ── */
  const eyeShape: CSSProperties =
    state === "success"
      ? { transform: "scaleY(.45) translateY(-16%)" } // happy squint
      : state === "error"
        ? { transform: "scaleY(.3)" } // flat
        : {};
  const eyeAnim =
    state === "loading"
      ? "kxorb-look 1.2s ease-in-out infinite"
      : animated && (state === "idle" || state === "typing")
        ? "kxorb-blink 5s ease-in-out infinite"
        : "none";

  const RING_GRADIENT =
    "conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #22d3ee, #3b82f6)";
  const RING_MASK =
    "radial-gradient(farthest-side, transparent 76%, #000 78%)";

  return (
    <div
      className={className}
      style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
      aria-hidden
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          boxShadow: glow,
          animation: orbAnim,
          transition: "box-shadow .25s ease",
          willChange: "transform",
        }}
      >
        {/* Rainbow identity ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: RING_GRADIENT,
            WebkitMask: RING_MASK,
            mask: RING_MASK,
            animation: ringAnim,
          }}
        />
        {/* Dark face + eyes */}
        <div
          style={{
            position: "absolute",
            inset: "13%",
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 40%, #15151c, #0a0a0e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "13%",
          }}
        >
          {[0, 1].map((i) => (
            <span
              key={i}
              style={{
                width: "15%",
                height: "34%",
                borderRadius: "999px",
                background: "linear-gradient(180deg, #ffffff, #c7cedb)",
                display: "block",
                animation: eyeAnim,
                ...eyeShape,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

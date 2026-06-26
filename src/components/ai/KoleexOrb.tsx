"use client";

/* ---------------------------------------------------------------------------
   KoleexOrb — the Koleex AI character (custom, fully code-controlled).

   Hand-built SVG/CSS orb with the Koleex AI identity (rainbow conic-gradient
   ring + two eyes on a dark face) and rich, smooth, perfectly-centred
   reactions we control completely. All eye motion is transition-based with
   springy easing (no snapping); the orb also feels ALIVE when idle (random
   blinks / glances / winks).

   Reactions (state prop):
     • idle      — slow ring drift + breathing + random blink/glance/wink
     • loading   — fast ring spin + eyes scan side-to-side (thinking)
     • typing    — medium ring + gentle bob
     • success   — green glow + happy squint + pop
     • error     — red glow + flat eyes + shake
     • surprised — wide eyes + soft pop
     • wink      — one eye closes
     • celebrate — happy eyes + bounce + green glow
   Plus a one-shot greet bounce via `greetKey`.

   Drop-in: same props as the original, used everywhere unchanged.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type OrbState =
  | "idle"
  | "loading"
  | "typing"
  | "success"
  | "error"
  | "surprised"
  | "wink"
  | "celebrate";

type Expr =
  | "normal"
  | "happy"
  | "sad"
  | "surprised"
  | "wink"
  | "blink"
  | "look-left"
  | "look-right";

const STYLE_ID = "kxorb-keyframes";
const KEYFRAMES = `
@keyframes kxorb-spin    { to { transform: rotate(360deg); } }
@keyframes kxorb-breathe { 0%,100%{ transform: scale(1);} 50%{ transform: scale(1.04);} }
@keyframes kxorb-bob     { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-7%);} }
@keyframes kxorb-pop     { 0%{ transform: scale(1);} 35%{ transform: scale(1.18);} 70%{ transform: scale(.97);} 100%{ transform: scale(1);} }
@keyframes kxorb-shake   { 0%,100%{ transform: translateX(0) rotate(0);} 15%{ transform: translateX(-11%) rotate(-3deg);} 35%{ transform: translateX(9%) rotate(2deg);} 55%{ transform: translateX(-7%) rotate(-2deg);} 75%{ transform: translateX(5%) rotate(1deg);} }
@keyframes kxorb-jump    { 0%,100%{ transform: translateY(0) scale(1);} 28%{ transform: translateY(-24%) scale(1.05);} 52%{ transform: translateY(0) scale(.96);} 70%{ transform: translateY(-9%) scale(1.02);} 86%{ transform: translateY(0) scale(1);} }
@keyframes kxorb-glow    { 0%,100%{ opacity:.55;} 50%{ opacity:1;} }
`;

const EASE = "cubic-bezier(.34,1.5,.5,1)"; // springy

function eyeTransform(expr: Expr, eye: 0 | 1): string {
  switch (expr) {
    case "happy":
      return "translateY(-15%) scaleY(.5)";
    case "sad":
      return "translateY(8%) scaleY(.32)";
    case "surprised":
      return "scale(1.3)";
    case "blink":
      return "scaleY(.1)";
    case "look-left":
      return "translateX(-26%)";
    case "look-right":
      return "translateX(26%)";
    case "wink":
      return eye === 1 ? "scaleY(.1)" : "";
    default:
      return "";
  }
}

export default function KoleexOrb({
  state = "idle",
  greetKey,
  size = 96,
  className,
  animated = true,
}: {
  /** Drives the orb. */
  state?: OrbState;
  /** Change this value (e.g. a counter) to fire a one-shot "jump" greet reaction. */
  greetKey?: number;
  /** Square pixel size of the orb. */
  size?: number;
  className?: string;
  /** When false, the orb renders fully static (no motion). */
  animated?: boolean;
}) {
  /* Inject keyframes once (shared by every instance). */
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
      const t = setTimeout(() => setJumping(false), 950);
      return () => clearTimeout(t);
    }
  }, [greetKey]);

  /* Dynamic eye behaviour: alive-idle micro-expressions + the loading scan.
     All driven by timers + smooth CSS transitions (no jerky keyframes). */
  const [dynExpr, setDynExpr] = useState<Expr | null>(null);
  useEffect(() => {
    if (!animated) {
      setDynExpr(null);
      return;
    }
    let alive = true;
    let t: ReturnType<typeof setTimeout>;

    if (state === "loading") {
      let toggle = false;
      const loop = () => {
        if (!alive) return;
        toggle = !toggle;
        setDynExpr(toggle ? "look-left" : "look-right");
        t = setTimeout(loop, 620);
      };
      setDynExpr("look-left");
      t = setTimeout(loop, 620);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }

    if (state === "idle") {
      const tick = () => {
        if (!alive) return;
        const r = Math.random();
        const choice: Expr =
          r < 0.5 ? "blink" : r < 0.72 ? "look-left" : r < 0.9 ? "look-right" : "wink";
        setDynExpr(choice);
        t = setTimeout(
          () => {
            if (!alive) return;
            setDynExpr(null);
            t = setTimeout(tick, 1500 + Math.random() * 2600);
          },
          choice === "blink" ? 130 : 680,
        );
      };
      t = setTimeout(tick, 1100 + Math.random() * 1800);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }

    setDynExpr(null);
    return () => {
      alive = false;
    };
  }, [state, animated]);

  const baseExpr: Expr =
    state === "success" || state === "celebrate"
      ? "happy"
      : state === "error"
        ? "sad"
        : state === "surprised"
          ? "surprised"
          : state === "wink"
            ? "wink"
            : "normal";
  const expr: Expr = dynExpr ?? baseExpr;

  /* Ring spin speed conveys energy. */
  const ringAnim =
    state === "loading"
      ? "kxorb-spin 1.05s linear infinite"
      : state === "typing"
        ? "kxorb-spin 2.6s linear infinite"
        : animated
          ? "kxorb-spin 18s linear infinite"
          : "none";

  /* Whole-orb reaction motion (springy). */
  const orbAnim = jumping
    ? `kxorb-jump .95s ${EASE}`
    : state === "celebrate"
      ? `kxorb-jump .9s ${EASE}`
      : state === "success" || state === "surprised"
        ? `kxorb-pop .6s ${EASE}`
        : state === "error"
          ? "kxorb-shake .55s ease"
          : state === "typing" && animated
            ? "kxorb-bob 1.1s ease-in-out infinite"
            : state === "idle" && animated
              ? "kxorb-breathe 5s ease-in-out infinite"
              : "none";

  /* Functional status glow. */
  const glowColor =
    state === "success" || state === "celebrate"
      ? "0,204,102"
      : state === "error"
        ? "255,51,51"
        : null;
  const glow = glowColor
    ? `0 0 0 2px rgba(${glowColor},.55), 0 0 22px 6px rgba(${glowColor},.45)`
    : "0 0 16px 2px rgba(120,130,255,.10)";

  const RING_GRADIENT =
    "conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #22d3ee, #3b82f6)";
  const RING_MASK = "radial-gradient(farthest-side, transparent 76%, #000 78%)";

  const eyeBase: CSSProperties = {
    width: "15%",
    height: "34%",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #ffffff, #c7cedb)",
    display: "block",
    transformOrigin: "center",
    transition: `transform .26s ${EASE}`,
    willChange: "transform",
  };

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
          transition: "box-shadow .3s ease",
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
            willChange: "transform",
          }}
        />
        {/* Dark face + eyes */}
        <div
          style={{
            position: "absolute",
            inset: "13%",
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 38%, #16161f, #0a0a0e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "13%",
          }}
        >
          <span style={{ ...eyeBase, transform: eyeTransform(expr, 0) }} />
          <span style={{ ...eyeBase, transform: eyeTransform(expr, 1) }} />
        </div>
      </div>
    </div>
  );
}

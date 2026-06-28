"use client";

/* ---------------------------------------------------------------------------
   KoleexRobot — the Koleex AI character as a framed robot face.

   A silver "metal" frame (with the KOLEEX wordmark) housing a dark glossy lens
   and two glowing eyes that morph per expression. Fully code-controlled SVG +
   CSS — no image/runtime dependency — so it scales crisply and reacts live.

   Ported in spirit from the Figma "robo eyes expression" study; the eyes are
   redrawn natively so we can tune every reaction in the Reactions Lab.

   Usage:
     <KoleexRobot expression="happy" size={360} />
     <KoleexRobot state="loading" />   // map from the AI lifecycle
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import KoleexLogo from "@/components/layout/KoleexLogo";

export type RobotExpression =
  | "normal"
  | "happy"
  | "love"
  | "surprised"
  | "dizzy"
  | "angry"
  | "sleepy"
  | "wink"
  | "thinking"
  | "money"
  | "scared"
  | "cool"
  | "sad"
  | "crying"
  | "excited"
  | "suspicious"
  | "confused"
  | "bored"
  | "starstruck"
  | "mischievous"
  | "shocked"
  | "hypnotized";

export const ROBOT_EXPRESSIONS: RobotExpression[] = [
  "normal", "happy", "love", "surprised", "dizzy", "angry", "sleepy", "wink",
  "thinking", "money", "scared", "cool", "sad", "crying", "excited",
  "suspicious", "confused", "bored", "starstruck", "mischievous", "shocked",
  "hypnotized",
];

/* Map the AI lifecycle (shared with KoleexOrb's OrbState) to an expression. */
export type RobotState =
  | "idle" | "loading" | "typing" | "success" | "error"
  | "surprised" | "wink" | "celebrate";

export function expressionForState(state: RobotState): RobotExpression {
  switch (state) {
    case "loading": return "thinking";
    case "typing": return "happy";
    case "success": return "excited";
    case "error": return "sad";
    case "surprised": return "surprised";
    case "wink": return "wink";
    case "celebrate": return "love";
    default: return "normal";
  }
}

const STYLE_ID = "kxrobot-keyframes";
const KEYFRAMES = `
@keyframes kxrobot-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
@keyframes kxrobot-breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1.2%) scale(1.012); } }
@keyframes kxrobot-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-2.5%)} 40%{transform:translateX(2%)} 60%{transform:translateX(-1.5%)} 80%{transform:translateX(1%)} }
@keyframes kxrobot-spin { to { transform: rotate(360deg); } }
@keyframes kxrobot-tremble { 0%,100%{transform:translate(0,0)} 25%{transform:translate(.6px,-.6px)} 50%{transform:translate(-.5px,.5px)} 75%{transform:translate(.4px,.5px)} }
@media (prefers-reduced-motion: reduce){
  .kxr-anim { animation: none !important; }
}
`;

const EASE = "cubic-bezier(.45,0,.2,1)";

/* Eye geometry inside a 220×140 lens viewBox. */
const LX = 63;   // left eye centre x
const RX = 157;  // right eye centre x
const CY = 72;   // eye centre y
const R = 34;    // base eye radius

const GLOW: CSSProperties = { filter: "drop-shadow(0 0 7px rgba(255,255,255,.55))" };
const WHITE = "#ffffff";

/* ── Per-expression eye renderer ──────────────────────────────────────────
   Returns the SVG children that draw both eyes for an expression. Eyes are
   white with a soft glow; a few expressions add functional colour (tears,
   money, cool tint) which is acceptable for an AI character. */
function Eyes({ expr }: { expr: RobotExpression }) {
  // Glowing spherical eye: gradient orb (bright top hotspot → dim edge) + bloom
  // + a soft specular highlight, matching the Figma "glowing lens" look.
  const circle = (cx: number, cy: number, r: number, key: string, extra?: CSSProperties) => (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill="url(#kxr-eye)" style={{ ...GLOW, ...extra }} />
      <ellipse cx={cx} cy={cy - r * 0.34} rx={r * 0.44} ry={r * 0.3} fill="rgba(255,255,255,.92)" />
    </g>
  );

  switch (expr) {
    case "normal":
    case "thinking": {
      const dy = expr === "thinking" ? -8 : 0; // glance up when thinking
      const dx = expr === "thinking" ? 8 : 0;
      return <>{circle(LX + dx, CY + dy, R, "l")}{circle(RX + dx, CY + dy, R, "r")}</>;
    }

    case "surprised":
      return <>{circle(LX, CY, R + 5, "l")}{circle(RX, CY, R + 5, "r")}</>;

    case "shocked":
      return (
        <>
          {circle(LX, CY, R + 8, "l")}
          {circle(RX, CY, R + 8, "r")}
          <circle cx={LX} cy={CY} r={R - 6} fill="#10131a" />
          <circle cx={RX} cy={CY} r={R - 6} fill="#10131a" />
          {circle(LX, CY, R - 16, "lp")}
          {circle(RX, CY, R - 16, "rp")}
        </>
      );

    case "scared":
      return (
        <g className="kxr-anim" style={{ animation: "kxrobot-tremble .25s linear infinite" }}>
          {circle(LX, CY - 6, R - 8, "l")}
          {circle(RX, CY - 6, R - 8, "r")}
        </g>
      );

    case "happy":
    case "excited": {
      // upward "‿" arcs (smiling eyes)
      const lift = expr === "excited" ? 8 : 0;
      const arc = (cx: number, k: string) => (
        <path
          key={k}
          d={`M ${cx - 32} ${CY + 6 - lift} Q ${cx} ${CY + 40 - lift} ${cx + 32} ${CY + 6 - lift}`}
          fill="none" stroke={WHITE} strokeWidth="15" strokeLinecap="round" style={GLOW}
        />
      );
      return <>{arc(LX, "l")}{arc(RX, "r")}{expr === "excited" && (
        <>
          <Spark cx={LX + 30} cy={CY - 26} /><Spark cx={RX + 30} cy={CY - 26} />
        </>
      )}</>;
    }

    case "sad":
    case "crying": {
      // drooping "⌢" arcs
      const arc = (cx: number, k: string) => (
        <path
          key={k}
          d={`M ${cx - 30} ${CY + 14} Q ${cx} ${CY - 22} ${cx + 30} ${CY + 14}`}
          fill="none" stroke={WHITE} strokeWidth="14" strokeLinecap="round" style={GLOW}
        />
      );
      return (
        <>
          {arc(LX, "l")}{arc(RX, "r")}
          {expr === "crying" && (
            <g className="kxr-anim" style={{ animation: "kxrobot-tremble .9s linear infinite" }}>
              <Tear cx={LX} cy={CY + 22} /><Tear cx={RX} cy={CY + 22} />
            </g>
          )}
        </>
      );
    }

    case "angry": {
      // round eyes with angled inner brows (lens-coloured wedges)
      const brow = (cx: number, inner: number, k: string) => (
        <path key={k} d={`M ${cx - 36} ${CY - 40} L ${cx + 36} ${CY - 40} L ${inner > 0 ? cx + 38 : cx - 38} ${CY - 2} Z`}
          fill="#10131a" />
      );
      return (
        <>
          {circle(LX, CY + 4, R - 2, "l")}
          {circle(RX, CY + 4, R - 2, "r")}
          {/* inner-down brows */}
          <path d={`M ${LX - 38} ${CY - 34} L ${LX + 40} ${CY - 6} L ${LX + 40} ${CY - 44} Z`} fill="#10131a" />
          <path d={`M ${RX + 38} ${CY - 34} L ${RX - 40} ${CY - 6} L ${RX - 40} ${CY - 44} Z`} fill="#10131a" />
        </>
      );
    }

    case "suspicious": {
      // top lids lowered ~45%
      return (
        <>
          {circle(LX, CY, R, "l")}{circle(RX, CY, R, "r")}
          <rect x={LX - R - 2} y={CY - R - 2} width={(R + 2) * 2} height={R} rx="6" fill="#10131a" />
          <rect x={RX - R - 2} y={CY - R - 2} width={(R + 2) * 2} height={R} rx="6" fill="#10131a" />
        </>
      );
    }

    case "bored":
    case "sleepy": {
      const h = expr === "sleepy" ? 12 : 16;
      const cap = (cx: number, k: string) => (
        <rect key={k} x={cx - 32} y={CY - h / 2} width={64} height={h} rx={h / 2} fill={WHITE} style={GLOW} />
      );
      return <>{cap(LX, "l")}{cap(RX, "r")}</>;
    }

    case "wink":
      return (
        <>
          {circle(LX, CY, R, "l")}
          <rect x={RX - 32} y={CY - 7} width={64} height={14} rx={7} fill={WHITE} style={GLOW} />
        </>
      );

    case "mischievous": {
      // narrowed, slanted capsules
      const eye = (cx: number, rot: number, k: string) => (
        <g key={k} transform={`rotate(${rot} ${cx} ${CY})`}>
          <rect x={cx - 32} y={CY - 11} width={64} height={22} rx={11} fill={WHITE} style={GLOW} />
        </g>
      );
      return <>{eye(LX, 10, "l")}{eye(RX, -10, "r")}</>;
    }

    case "confused":
      return (
        <>
          {circle(LX, CY, R, "l")}
          <g transform={`rotate(-12 ${RX} ${CY})`}>
            <rect x={RX - 26} y={CY - 9} width={52} height={18} rx={9} fill={WHITE} style={GLOW} />
          </g>
        </>
      );

    case "cool": {
      // sunglasses bar over both eyes
      return (
        <>
          <rect x={LX - R - 6} y={CY - 20} width={RX - LX + (R + 6) * 2} height={40} rx={20} fill="#0b0d12" />
          <rect x={LX - R - 2} y={CY - 15} width={(R + 2) * 2} height={30} rx={15} fill="#161a22" />
          <rect x={RX - R - 2} y={CY - 15} width={(R + 2) * 2} height={30} rx={15} fill="#161a22" />
          {/* shine */}
          <rect x={LX - 24} y={CY - 11} width={26} height={6} rx={3} fill="rgba(255,255,255,.5)" transform={`rotate(-12 ${LX} ${CY})`} />
          <rect x={RX - 24} y={CY - 11} width={26} height={6} rx={3} fill="rgba(255,255,255,.5)" transform={`rotate(-12 ${RX} ${CY})`} />
        </>
      );
    }

    case "love":
      return <>{<Heart key="l" cx={LX} cy={CY} />}{<Heart key="r" cx={RX} cy={CY} />}</>;

    case "starstruck":
      return <>{<Star key="l" cx={LX} cy={CY} />}{<Star key="r" cx={RX} cy={CY} />}</>;

    case "money":
      return (
        <>
          {circle(LX, CY, R, "l")}{circle(RX, CY, R, "r")}
          <text x={LX} y={CY + 11} textAnchor="middle" fontSize="34" fontWeight="800" fill="#0b8a3e">$</text>
          <text x={RX} y={CY + 11} textAnchor="middle" fontSize="34" fontWeight="800" fill="#0b8a3e">$</text>
        </>
      );

    case "dizzy":
    case "hypnotized": {
      const spiral = (cx: number, k: string) => (
        <g key={k} className="kxr-anim" style={{ transformOrigin: `${cx}px ${CY}px`, animation: "kxrobot-spin 2.4s linear infinite" }}>
          <path
            d={`M ${cx} ${CY} m -28 0 a 28 28 0 1 1 12 24 a 18 18 0 1 1 -2 -30 a 9 9 0 1 1 6 12`}
            fill="none" stroke={WHITE} strokeWidth="6" strokeLinecap="round" style={GLOW}
          />
        </g>
      );
      return <>{spiral(LX, "l")}{spiral(RX, "r")}</>;
    }

    default:
      return <>{circle(LX, CY, R, "l")}{circle(RX, CY, R, "r")}</>;
  }
}

function Heart({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      transform={`translate(${cx - 30} ${cy - 28}) scale(2.5)`}
      d="M12 21s-7.5-4.6-10-9.2C.3 8.4 2 5 5.2 5c2 0 3.3 1.2 4.8 3 1.5-1.8 2.8-3 4.8-3 3.2 0 4.9 3.4 3.2 6.8C19.5 16.4 12 21 12 21z"
      fill="#ff4d6d" style={{ filter: "drop-shadow(0 0 6px rgba(255,77,109,.5))" }}
    />
  );
}

function Star({ cx, cy }: { cx: number; cy: number }) {
  const pts = starPoints(cx, cy, 32, 14, 5);
  return <polygon points={pts} fill="#ffd23f" style={{ filter: "drop-shadow(0 0 7px rgba(255,210,63,.55))" }} />;
}

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function Spark({ cx, cy }: { cx: number; cy: number }) {
  return <polygon points={starPoints(cx, cy, 9, 3.5, 4)} fill={WHITE} style={GLOW} />;
}

function Tear({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      transform={`translate(${cx - 7} ${cy})`}
      d="M7 0 C 11 9, 14 13, 7 18 C 0 13, 3 9, 7 0 Z"
      fill="#7fd1ff" style={{ filter: "drop-shadow(0 0 5px rgba(127,209,255,.5))" }}
    />
  );
}

export default function KoleexRobot({
  expression,
  state,
  size = 320,
  animated = true,
  className,
}: {
  /** Direct expression. Takes precedence over `state`. */
  expression?: RobotExpression;
  /** AI lifecycle state — mapped to an expression. */
  state?: RobotState;
  /** Width in px (height auto, ~1.4:1 frame). */
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);

  const expr: RobotExpression = expression ?? (state ? expressionForState(state) : "normal");

  /* Periodic blink while idle-ish (calm expressions only). */
  const [blinkOn, setBlinkOn] = useState(false);
  const calm = expr === "normal" || expr === "happy" || expr === "thinking" || expr === "bored";
  const blinkRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!animated || !calm) { setBlinkOn(false); return; }
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setBlinkOn(true);
      blinkRef.current = setTimeout(() => {
        setBlinkOn(false);
        blinkRef.current = setTimeout(loop, 2600 + Math.random() * 2800);
      }, 150);
    };
    blinkRef.current = setTimeout(loop, 1800 + Math.random() * 2000);
    return () => { alive = false; if (blinkRef.current) clearTimeout(blinkRef.current); };
  }, [animated, calm, expr]);

  const w = size;
  const h = Math.round(size / 1.4);
  const frameRadius = Math.round(h * 0.42);

  const faceAnim =
    !animated ? "none"
      : expr === "angry" || expr === "scared" ? "kxrobot-shake .5s ease-in-out"
        : "kxrobot-breathe 6s ease-in-out infinite";

  return (
    <div
      className={className}
      style={{ width: w, height: h, display: "inline-block", lineHeight: 0 }}
      aria-hidden
    >
      <div
        className={animated ? "kxr-anim" : undefined}
        style={{
          position: "relative", width: "100%", height: "100%",
          borderRadius: frameRadius,
          /* brushed-silver metal frame */
          background:
            "linear-gradient(150deg,#f4f6f9 0%,#d3d8df 22%,#aab0ba 48%,#cfd5dd 70%,#888f9a 100%)",
          padding: Math.round(h * 0.07),
          boxShadow:
            "0 22px 48px -16px rgba(0,0,0,.75), inset 0 2px 3px rgba(255,255,255,.85), inset 0 -6px 14px rgba(0,0,0,.35)",
          animation: faceAnim,
          willChange: "transform",
        }}
      >
        {/* Real KOLEEX wordmark embossed on the top bezel */}
        <div
          style={{
            position: "absolute", top: Math.round(h * 0.062), left: "50%",
            transform: "translateX(-50%)", width: Math.round(w * 0.26),
            color: "rgba(46,52,60,.7)", lineHeight: 0,
            filter: "drop-shadow(0 1px 0 rgba(255,255,255,.65))",
            pointerEvents: "none", userSelect: "none",
          }}
        >
          <KoleexLogo className="w-full h-auto" />
        </div>

        {/* dark glossy lens */}
        <div
          style={{
            position: "relative", width: "100%", height: "100%",
            borderRadius: Math.round(frameRadius * 0.82),
            background:
              "radial-gradient(120% 90% at 50% 8%, #2b2f3a 0%, #14171e 38%, #06070a 100%)",
            boxShadow:
              "inset 0 6px 18px rgba(0,0,0,.85), inset 0 -2px 6px rgba(255,255,255,.05), inset 0 0 0 2px rgba(0,0,0,.5)",
            overflow: "hidden",
          }}
        >
          {/* broad top-light reflection */}
          <div
            style={{
              position: "absolute", top: "-22%", left: "6%", right: "6%", height: "62%",
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(255,255,255,.20), rgba(255,255,255,0) 72%)",
              pointerEvents: "none",
            }}
          />
          {/* diagonal glossy streak (top-left sweep, like the Figma lens) */}
          <div
            style={{
              position: "absolute", top: "-30%", left: "-10%", width: "85%", height: "75%",
              transform: "rotate(-18deg)",
              background: "radial-gradient(closest-side, rgba(255,255,255,.16), rgba(255,255,255,0) 70%)",
              pointerEvents: "none",
            }}
          />
          {/* eyes */}
          <svg
            viewBox="0 0 220 140"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <defs>
              <radialGradient id="kxr-eye" cx="50%" cy="35%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="52%" stopColor="#fbfdff" />
                <stop offset="82%" stopColor="#e2e8f2" />
                <stop offset="100%" stopColor="#a8b4c6" />
              </radialGradient>
            </defs>
            <g
              className={blinkOn ? "kxr-anim" : undefined}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: `transform .35s ${EASE}`,
                transform: blinkOn ? "scaleY(.08)" : "scaleY(1)",
              }}
            >
              <Eyes expr={expr} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

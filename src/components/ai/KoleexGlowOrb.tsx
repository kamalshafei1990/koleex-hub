"use client";

/* ---------------------------------------------------------------------------
   KoleexGlowOrb — CSS-only AI face: pure dark-glass sphere with big blinking
   eyes, all the Hub Blue glow living BEHIND the ball as a breathing aura
   (variant "F" — owner-picked after the lava-inside versions washed the
   face out at 72px).

   Distantly adapted from "AI Glow Orb (CSS)" by Matthew G. (CodePen
   emOdgYa); colors are the Hub Blue family. Authored at 200px and scaled
   to `size` so proportions hold at any size.
   --------------------------------------------------------------------------- */

interface Props {
  /* Mirrors KoleexOrb's state prop so call sites can swap 1:1. "typing"
     makes the aura breathe faster/brighter; other states idle. */
  state?: string;
  greetKey?: number | string;
  size?: number;
  className?: string;
}

export default function KoleexGlowOrb({ state, size = 72, className = "" }: Props) {
  const s = size / 200;
  return (
    <div
      className={`kx-glow-orb ${state === "typing" ? "is-typing" : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${s})` }}>
        <div className="aura" />
        <div className="sphere" />
      </div>

      <style>{`
        .kx-glow-orb {
          position: relative;
          flex: none;
        }
        .kx-glow-orb .stage {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 200px;
          height: 200px;
        }
        .kx-glow-orb .aura,
        .kx-glow-orb .sphere {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 100%;
        }
        /* All the color lives back here — never over the face. */
        .kx-glow-orb .aura {
          width: 200px;
          height: 200px;
          z-index: 5;
          filter: blur(22px);
          animation: kx-orb-breathe 3s ease-in-out infinite alternate;
          background:
            radial-gradient(circle at 30% 70%, #567fb2 0%, transparent 55%),
            radial-gradient(circle at 72% 30%, #7fa9d6 0%, transparent 55%),
            radial-gradient(circle at 60% 80%, #bcd8f0 0%, transparent 45%);
        }
        .kx-glow-orb.is-typing .aura {
          animation-duration: 1.2s;
          filter: blur(18px);
        }
        .kx-glow-orb .sphere {
          width: 200px;
          height: 200px;
          z-index: 50;
          overflow: hidden;
          background: #0b0d11;
          border: 2px solid rgba(188, 216, 240, 0.25);
          box-shadow:
            inset 0 3px 12px rgba(255, 255, 255, 0.16),
            inset 0 -12px 30px rgba(0, 0, 0, 0.55);
          animation: kx-orb-float 6s ease-in-out infinite;
        }
        /* Eyes: one bar + its box-shadow twin; blink + glance around. */
        .kx-glow-orb .sphere::before {
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
            kx-orb-blink 4s infinite,
            kx-orb-look 10s infinite ease-in-out;
        }
        /* Faint floor light inside the glass so the ball reads 3D. */
        .kx-glow-orb .sphere::after {
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
        @keyframes kx-orb-float {
          0%, 100% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, calc(-50% - 8px)); }
        }
        @keyframes kx-orb-breathe {
          from { opacity: 0.75; }
          to { opacity: 1; }
        }
        @keyframes kx-orb-blink {
          0%, 96% { height: 48px; }
          98% { height: 5px; }
          100% { height: 48px; }
        }
        @keyframes kx-orb-look {
          0%, 40% { left: 47%; }
          45%, 55% { left: 40%; }
          60%, 70% { left: 54%; }
          75% { left: 47%; }
        }
      `}</style>
    </div>
  );
}

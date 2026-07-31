"use client";

/* ---------------------------------------------------------------------------
   KoleexGlowOrb — CSS-only AI face: a glassy sphere with blinking eyes that
   glance around, floating over a Hub Blue "lava" glow.

   Adapted from "AI Glow Orb (CSS)" by Matthew G. (codepen.io/HomesteadMovies/
   pen/emOdgYa). Changes for Koleex: the rainbow lava + hue-rotate cycle is
   replaced with the Hub Blue family (deep #3E6796 · steel #567FB2 · sky
   #7FA9D6 · ice #BCD8F0) slowly rotating instead of hue-shifting, so the
   face never leaves the brand palette. A solid dark base disc sits behind
   the lava so the screen-blended glow reads identically on light theme.

   The design is authored at 200px and scaled to `size`, so every shadow,
   eye and blur keeps its proportions at any size.
   --------------------------------------------------------------------------- */

interface Props {
  /* Mirrors KoleexOrb's state prop so call sites can swap 1:1. Only
     "typing" changes anything (faster, brighter lava); the rest idle. */
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
        <div className="base" />
        <div className="lava" />
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
        .kx-glow-orb .base {
          position: absolute;
          inset: 5px;
          border-radius: 100%;
          background: #0a0a0a;
        }
        .kx-glow-orb .sphere {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          border-radius: 100%;
          background: rgba(0, 0, 0, 0.15);
          box-shadow:
            0 0 40px 4px rgba(86, 127, 178, 0.28),
            inset 0 0 40px rgba(188, 216, 240, 0.4),
            inset 0 -20px 50px rgba(0, 0, 0, 0.25);
          z-index: 50;
          overflow: hidden;
          animation: kx-orb-float 6s ease-in-out infinite;
        }
        /* Eyes: one bar + its box-shadow twin; blink + glance around. */
        .kx-glow-orb .sphere::before {
          content: "";
          position: absolute;
          top: 45%;
          left: 47%;
          transform: translate(-50%, -50%);
          width: 10px;
          height: 30px;
          background: #fff;
          border-radius: 3px;
          box-shadow: 30px 0 0 #fff;
          z-index: 60;
          animation:
            kx-orb-blink 4s infinite,
            kx-orb-look 10s infinite ease-in-out;
        }
        .kx-glow-orb .sphere::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          animation: kx-orb-glow 2s ease-in-out infinite;
        }
        .kx-glow-orb .lava {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 190px;
          height: 190px;
          border-radius: 100%;
          filter: blur(25px);
          mix-blend-mode: screen;
          z-index: 10;
          animation: kx-orb-spin 22s linear infinite;
        }
        .kx-glow-orb.is-typing .lava {
          animation-duration: 6s;
          filter: blur(20px);
        }
        .kx-glow-orb .lava::before {
          content: "";
          position: absolute;
          left: -10%;
          top: -10%;
          width: 120%;
          height: 120%;
          background:
            radial-gradient(circle at 30% 30%, #567fb2 0%, transparent 45%),
            radial-gradient(circle at 70% 30%, #7fa9d6 0%, transparent 45%),
            radial-gradient(circle at 50% 60%, #bcd8f0 0%, transparent 45%),
            radial-gradient(circle at 80% 40%, #3e6796 0%, transparent 45%);
          filter: blur(8px);
          mix-blend-mode: screen;
        }
        .kx-glow-orb .lava::after {
          content: "";
          position: absolute;
          left: -10%;
          top: -10%;
          width: 120%;
          height: 120%;
          background:
            radial-gradient(circle at 40% 40%, #567fb2 0%, transparent 35%),
            radial-gradient(circle at 60% 40%, #bcd8f0 0%, transparent 35%),
            radial-gradient(circle at 50% 70%, #7fa9d6 0%, transparent 35%),
            radial-gradient(circle at 70% 50%, #3e6796 0%, transparent 35%);
          filter: blur(12px);
          mix-blend-mode: screen;
          animation: kx-orb-pulse 4s ease-in-out infinite alternate;
        }
        @keyframes kx-orb-float {
          0%, 100% { transform: translate(-50%, -50%); }
          50% { transform: translate(-50%, calc(-50% - 8px)); }
        }
        @keyframes kx-orb-spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes kx-orb-blink {
          0%, 96% { height: 30px; }
          98% { height: 3px; }
          100% { height: 30px; }
        }
        @keyframes kx-orb-look {
          0%, 40% { left: 47%; }
          45%, 55% { left: 40%; }
          60%, 70% { left: 54%; }
          75% { left: 47%; }
        }
        @keyframes kx-orb-glow {
          0%, 100% { box-shadow: 0 0 60px rgba(127, 169, 214, 0.12); }
          45% { box-shadow: 0 0 80px rgba(127, 169, 214, 0.22); }
          50% { box-shadow: 0 0 70px rgba(127, 169, 214, 0.16); }
          55% { box-shadow: 0 0 85px rgba(127, 169, 214, 0.22); }
          60% { box-shadow: 0 0 60px rgba(127, 169, 214, 0.12); }
        }
        @keyframes kx-orb-pulse {
          from { transform: scale(1); opacity: 0.9; }
          to { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

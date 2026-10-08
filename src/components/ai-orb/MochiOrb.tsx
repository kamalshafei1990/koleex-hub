"use client";

/* ---------------------------------------------------------------------------
   MochiOrb — the third Koleex AI orb: the Mochi character (vendored engine),
   driven through the same AIOrbProps contract as AIOrb and DottedOrb so
   <ChosenOrb> can hand it the same call as the other two.

   State mapping (the behavior plan's Phase-1 table):
     thinking/processing+thinking-family → thinking or searching (by activity)
     working  → working      approval → approval     question → question
     finished → finished     error    → error        sleeping → sleeping
     listening → wide attentive eyes + eye-scale up (the lab's Listen demo)
     speaking  → speakMode: the face mouth rides the REAL audioLevel
   The result (success/warning/error) wins through resolveOrbState, exactly
   like the other orbs.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import type { AIOrbProps } from "./ai-orb-types";
import { resolveOrbState, clamp01 } from "./ai-orb-types";
import { BotEngine } from "./mochi/engine";
import { MochiBehaviorDirector, type MochiSituation } from "./mochi/behavior-director";
import { applyMochiSoundFromStorage } from "./orb-sound";

function situationFromProps(props: AIOrbProps): MochiSituation {
  const visual = resolveOrbState(props.state ?? "idle", props.result ?? "none");
  switch (visual) {
    case "listening":
    case "transcribing": return "listening";
    case "speaking": return "speaking";
    case "success": return "finished";
    case "warning": return "ratelimit";
    case "error": return "error";
    case "thinking": return "thinking";
    case "processing": {
      const a = props.activity ?? "none";
      if (a === "searching" || a === "browsing" || a === "reading") return "searching";
      if (a === "requesting-permission") return "approval";
      if (a === "waiting-for-user") return "question";
      return "working";
    }
    case "awakening": return "finished";
    case "sleeping":
    case "idle":
    default: return "idle";
  }
}

export default function MochiOrb({
  state = "idle",
  activity = "none",
  result = "none",
  audioLevel = 0,
  size = 72,
  className = "",
  label,
}: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BotEngine | null>(null);
  const directorRef = useRef<MochiBehaviorDirector | null>(null);
  const [labelText] = useState(label ?? "Koleex AI");

  /* engine + behavior director + frame loop (paused offscreen / tab hidden, like AIOrb) */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const engine = new BotEngine();
    engineRef.current = engine;
    /* Sounds: the stored choice applies before the first frame — no waiting
       on the account bootstrap. */
    applyMochiSoundFromStorage();
    const director = new MochiBehaviorDirector(engine, {
      getOrbCenter: () => {
        const r = cv.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      /* The opening wave belongs to the orbs you actually look at — Home
         greeting, the AI welcome, the settings preview — not the 38px bubble
         dots. */
      intro: size >= 60,
    });
    directorRef.current = director;
    director.attach();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cv.width = size * dpr;
      cv.height = size * dpr;
    };
    resize();

    let raf = 0;
    let last = performance.now();
    let hidden = document.visibilityState === "hidden";
    let offscreen = false;
    const io = new IntersectionObserver((es) => { offscreen = !es[0]?.isIntersecting; });
    io.observe(cv);
    const onVis = () => { hidden = document.visibilityState === "hidden"; };
    document.addEventListener("visibilitychange", onVis);

    const ctx = cv.getContext("2d")!;
    /* The 1.3× boost exists for DISPLAY sizes — matching the aura orb's glow
       footprint in the Home greeting and the Settings preview. At icon sizes
       (<48px) the canvas shares a slot with line icons that occupy ~60-70% of
       their box, so the boost reads as "the AI icon is bigger than the others"
       (owner, 2026-10-07): there he draws at his natural lab size, slightly
       tucked to match the line icons' visual weight. */
    const baseBoost = size < 48 ? 0.92 : 1.3;
    let boost = baseBoost;
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      if (hidden || offscreen) return;
      engine.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      /* Except during the wave: the coucou hand sweeps out past the body, so
         the boost eases down to fit it inside the frame instead of cropping
         it (owner, 2026-10-06). */
      const n = nowMs / 1000;
      const waving = n > engine.waveStart - 0.2 && n < engine.waveUntil + 0.4;
      const boostTarget = waving ? Math.min(1.0, baseBoost) : baseBoost;
      boost += (boostTarget - boost) * Math.min(1, dt * 6);
      ctx.translate(size / 2, size / 2);
      ctx.scale(boost, boost);
      ctx.translate(-size / 2, -size / 2);
      engine.draw(ctx, size, size);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      director.detach();
      directorRef.current = null;
      engineRef.current = null;
    };
  }, [size]);

  /* props → behavior director (priority gate + cooldowns + attention cycle) */
  useEffect(() => {
    directorRef.current?.setSituation(situationFromProps({ state, activity, result }));
  }, [state, activity, result]);

  /* live audio level → mouth (speaking) / attention (listening) */
  useEffect(() => {
    directorRef.current?.setAudioLevel(clamp01(audioLevel));
  }, [audioLevel]);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={labelText}
      className={`inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onPointerDown={() => directorRef.current?.slap()}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />
    </span>
  );
}

"use client";

/* ---------------------------------------------------------------------------
   KoleexOrb — the Koleex AI character.

   A Rive state-machine character ("State Machine 1") that reacts to the AI
   conversation lifecycle. Driven declaratively by a single `state` prop plus
   an optional `greetKey` that fires a one-shot "jump" reaction.

   Rive inputs (confirmed from the .riv):
     • loadingBoolean (bool)  — thinking / waiting for the model
     • typingBoolean  (bool)  — streaming a reply
     • correct        (trig)  — reply finished OK
     • wrong          (trig)  — reply failed
     • jump           (trig)  — greet / react to a new message

   Asset: public/koleex-orb.riv — "AI Orb Mascot" by aln.omrv (Rive Marketplace,
   licensed CC BY). Attribution retained here per the license; file unmodified.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

export type OrbState = "idle" | "loading" | "typing" | "success" | "error";

const STATE_MACHINE = "State Machine 1";
const SRC = "/koleex-orb.riv";

export default function KoleexOrb({
  state = "idle",
  greetKey,
  size = 96,
  className,
  animated = true,
  emphasize = false,
}: {
  /** Drives the orb: idle · loading (thinking) · typing (streaming) · success · error. */
  state?: OrbState;
  /** Change this value (e.g. a counter) to fire a one-shot "jump" greet reaction. */
  greetKey?: number;
  /** Square pixel size of the orb. */
  size?: number;
  className?: string;
  /** When false, the orb renders once then freezes (no animation loop). */
  animated?: boolean;
  /** Amplify reactions with a state-coloured glow + motion so each reaction
      is unmistakable even though the .riv's own expressions are subtle.
      Status colours are used functionally only (thinking=blue, success=green,
      error=red). */
  emphasize?: boolean;
}) {
  const { rive, RiveComponent } = useRive({
    src: SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true, // always autoplay so the canvas initialises + sizes
  });

  /* Freeze for a static icon: let Rive paint + size a couple of frames, then
     pause. (autoplay:false leaves the canvas at 0×0, so we pause instead.) */
  useEffect(() => {
    if (!rive || animated) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        try { rive.pause(); } catch { /* noop */ }
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [rive, animated]);

  const loading = useStateMachineInput(rive, STATE_MACHINE, "loadingBoolean");
  const typing = useStateMachineInput(rive, STATE_MACHINE, "typingBoolean");
  const correct = useStateMachineInput(rive, STATE_MACHINE, "correct");
  const wrong = useStateMachineInput(rive, STATE_MACHINE, "wrong");
  const jump = useStateMachineInput(rive, STATE_MACHINE, "jump");

  /* Continuous booleans mirror the live state. */
  useEffect(() => {
    if (loading) loading.value = state === "loading";
    if (typing) typing.value = state === "typing";
  }, [loading, typing, state]);

  /* One-shot reactions fire only on entering success / error. */
  const prevState = useRef<OrbState>("idle");
  useEffect(() => {
    if (state === prevState.current) return;
    if (state === "success") correct?.fire();
    else if (state === "error") wrong?.fire();
    prevState.current = state;
  }, [state, correct, wrong]);

  /* Explicit greet — fire jump whenever greetKey changes (skip first mount). */
  const greetSeen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (greetKey === undefined) return;
    if (greetSeen.current === undefined) {
      greetSeen.current = greetKey;
      return;
    }
    if (greetKey !== greetSeen.current) {
      greetSeen.current = greetKey;
      jump?.fire();
    }
  }, [greetKey, jump]);

  /* Code-level reaction amplifier. The .riv's own expressions are subtle
     (small eye movements), so when `emphasize` is on we add a state-coloured
     halo + a brief scale bounce on transitions, making each reaction read
     clearly at a glance. */
  const glow = !emphasize
    ? "none"
    : state === "loading" || state === "typing"
      ? "0 0 0 2px rgba(0,102,255,.55), 0 0 22px 5px rgba(0,102,255,.40)"
      : state === "success"
        ? "0 0 0 2px rgba(0,204,102,.65), 0 0 24px 6px rgba(0,204,102,.45)"
        : state === "error"
          ? "0 0 0 2px rgba(255,51,51,.65), 0 0 24px 6px rgba(255,51,51,.45)"
          : "none";
  const pulse = emphasize && (state === "loading" || state === "typing");
  const bounce = emphasize && (state === "success" || state === "error");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        boxShadow: glow,
        transition: "box-shadow .25s ease, transform .25s ease",
        transform: bounce ? "scale(1.06)" : "scale(1)",
      }}
      className={
        (className ? className + " " : "") + (pulse ? "animate-pulse" : "")
      }
      aria-hidden
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

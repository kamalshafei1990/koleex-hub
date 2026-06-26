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
}: {
  /** Drives the orb: idle · loading (thinking) · typing (streaming) · success · error. */
  state?: OrbState;
  /** Change this value (e.g. a counter) to fire a one-shot "jump" greet reaction. */
  greetKey?: number;
  /** Square pixel size of the orb. */
  size?: number;
  className?: string;
  /** When false, the orb is frozen (static first frame) — no animation loop. */
  animated?: boolean;
}) {
  const { rive, RiveComponent } = useRive({
    src: SRC,
    stateMachines: STATE_MACHINE,
    autoplay: animated,
  });

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

  return (
    <div style={{ width: size, height: size }} className={className} aria-hidden>
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

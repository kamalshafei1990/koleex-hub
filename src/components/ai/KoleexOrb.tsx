"use client";

/* ---------------------------------------------------------------------------
   KoleexOrb — the Koleex AI character.

   A Rive character ("AI Orb Mascot") that reacts to the AI conversation
   lifecycle. Driven declaratively by a single `state` prop plus an optional
   `greetKey` that fires a one-shot "jump" reaction.

   IMPORTANT — this .riv drives its animations through DATA BINDING (ViewModel1),
   not plain state-machine inputs. So we set the ViewModel *properties*
   (loadingBoolean / typingBoolean / correct / wrong / jump). We also mirror the
   same values onto the matching state-machine inputs as a fallback, so the orb
   reacts regardless of how the artboard is wired.

   ViewModel1 / state-machine inputs (confirmed from the .riv):
     • loadingBoolean (bool)  — thinking / waiting for the model
     • typingBoolean  (bool)  — streaming a reply
     • correct        (trig)  — reply finished OK
     • wrong          (trig)  — reply failed
     • jump           (trig)  — greet / react to a new message

   Asset: public/koleex-orb.riv — "AI Orb Mascot" by aln.omrv (Rive Marketplace,
   CC BY). Attribution retained per the license; file unmodified.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import {
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceTrigger,
} from "@rive-app/react-canvas";

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
  /** When false, the orb renders once then freezes (no animation loop). */
  animated?: boolean;
}) {
  const { rive, RiveComponent } = useRive({
    src: SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true, // always autoplay so the canvas initialises + sizes
  });

  /* ── Data binding (primary driver) ──
     Resolve the default ViewModel instance and bind it to the artboard so the
     orb's bound animations (loader, typing, correct, wrong, jump) actually run. */
  const viewModel = useViewModel(rive, { useDefault: true });
  const vmi = useViewModelInstance(viewModel, { useDefault: true });
  useEffect(() => {
    if (rive && vmi) {
      try {
        rive.bindViewModelInstance(vmi);
      } catch {
        /* noop */
      }
    }
  }, [rive, vmi]);

  const { setValue: setLoadingVm } = useViewModelInstanceBoolean("loadingBoolean", vmi);
  const { setValue: setTypingVm } = useViewModelInstanceBoolean("typingBoolean", vmi);
  const { trigger: fireCorrectVm } = useViewModelInstanceTrigger("correct", vmi);
  const { trigger: fireWrongVm } = useViewModelInstanceTrigger("wrong", vmi);
  const { trigger: fireJumpVm } = useViewModelInstanceTrigger("jump", vmi);

  /* ── State-machine inputs (fallback) ── */
  const loadingInput = useStateMachineInput(rive, STATE_MACHINE, "loadingBoolean");
  const typingInput = useStateMachineInput(rive, STATE_MACHINE, "typingBoolean");
  const correctInput = useStateMachineInput(rive, STATE_MACHINE, "correct");
  const wrongInput = useStateMachineInput(rive, STATE_MACHINE, "wrong");
  const jumpInput = useStateMachineInput(rive, STATE_MACHINE, "jump");

  /* Freeze for a static icon: let Rive paint + size a couple of frames, then
     pause. (autoplay:false leaves the canvas at 0×0, so we pause instead.) */
  useEffect(() => {
    if (!rive || animated) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        try {
          rive.pause();
        } catch {
          /* noop */
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [rive, animated]);

  /* Continuous booleans mirror the live state (VM first, SM input as backup). */
  useEffect(() => {
    const loading = state === "loading";
    const typing = state === "typing";
    setLoadingVm?.(loading);
    setTypingVm?.(typing);
    if (loadingInput) loadingInput.value = loading;
    if (typingInput) typingInput.value = typing;
  }, [state, setLoadingVm, setTypingVm, loadingInput, typingInput]);

  /* One-shot reactions fire only on entering success / error. */
  const prevState = useRef<OrbState>("idle");
  useEffect(() => {
    if (state === prevState.current) return;
    if (state === "success") {
      fireCorrectVm?.();
      correctInput?.fire();
    } else if (state === "error") {
      fireWrongVm?.();
      wrongInput?.fire();
    }
    prevState.current = state;
  }, [state, fireCorrectVm, fireWrongVm, correctInput, wrongInput]);

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
      fireJumpVm?.();
      jumpInput?.fire();
    }
  }, [greetKey, fireJumpVm, jumpInput]);

  return (
    <div style={{ width: size, height: size }} className={className} aria-hidden>
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

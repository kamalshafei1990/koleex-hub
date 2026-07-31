"use client";

/* ---------------------------------------------------------------------------
   KoleexGlowOrb — back-compat wrapper over the AIOrb status system.

   Every existing call site (Home greeter, FloatingPanel, Koleex AI app,
   Discuss, launcher icon) speaks the legacy OrbState vocabulary
   ("idle"/"loading"/"typing"/...). This wrapper translates it into the
   typed AIOrb model (state + activity + result) so call sites did not
   have to change during the motion-system upgrade. New code should
   prefer <AIOrb> from components/ai-orb directly.
   --------------------------------------------------------------------------- */

import AIOrb from "@/components/ai-orb/AIOrb";
import type { AIOrbActivity, AIOrbResult, AIOrbState } from "@/components/ai-orb/ai-orb-types";

interface Props {
  state?: string;
  greetKey?: number | string;
  size?: number;
  className?: string;
  /** Optional passthroughs for tool-aware call sites (Koleex AI app). */
  activity?: AIOrbActivity;
  audioLevel?: number;
  progress?: number | null;
  interactive?: boolean;
}

function mapLegacy(state: string | undefined, activity: AIOrbActivity): {
  state: AIOrbState;
  result: AIOrbResult;
} {
  switch (state) {
    case "loading":
      /* Tool running → processing (activity picks the motion family);
         plain model latency → thinking. */
      return { state: activity !== "none" ? "processing" : "thinking", result: "none" };
    case "typing":
      /* Streaming tokens: the original face just quickened its aura —
         map to thinking (energy pace), no halo/ripple layers. */
      return { state: "thinking", result: "none" };
    case "success":
    case "celebrate":
      return { state: "idle", result: "success" };
    case "error":
      return { state: "idle", result: "error" };
    case "surprised":
    case "wink":
      return { state: "awakening", result: "none" };
    default:
      return { state: "idle", result: "none" };
  }
}

export default function KoleexGlowOrb({
  state,
  size = 72,
  className = "",
  activity = "none",
  audioLevel,
  progress = null,
  interactive,
}: Props) {
  const mapped = mapLegacy(state, activity);
  const act: AIOrbActivity = activity;
  return (
    <AIOrb
      state={mapped.state}
      result={mapped.result}
      activity={act}
      audioLevel={audioLevel}
      progress={progress}
      interactive={interactive}
      size={size}
      className={className}
    />
  );
}

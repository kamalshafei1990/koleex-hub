/* ---------------------------------------------------------------------------
   The dotted orb's vocabulary, read from ours.

   The Hub speaks the AIOrb model (state + activity + result — see
   ai-orb-types.ts). The dotted orb has nine motions of its own, each a verb.
   This file is the one translation between the two, so every surface that
   draws the dotted orb means the same thing by the same motion.

   The rules, in order:
     1. A live result wins, exactly as it does on the aura orb
        (resolveOrbState). The aura orb marks results with restraint — a
        brightness, a nudge, never a colour — and so does this one: success is
        the one playful motion (a shape that resolves), a warning or an error
        is the resting ring, slowed and dimmed.
     2. Voice: listening is the waveform; speaking is the sash.
     3. A tool at work picks its motion by the family the aura orb already
        groups activities into (ACTIVITY_FAMILY), so "searching" is the same
        idea on both orbs: the scan.
     4. Plain thinking is the orbits — the motion the dotted orb is known for.
     5. At rest it is the sash, at half pace. The slowed, dimmed ring is
        kept for a warning, an error, sleep and waiting on the user.

   Dependency-free and pure, so validate:ai-orb can exercise every state and
   every activity without a browser.
   --------------------------------------------------------------------------- */

import {
  ACTIVITY_FAMILY,
  resolveOrbState,
  type ActivityFamily,
  type AIOrbActivity,
  type AIOrbResult,
  type AIOrbState,
} from "./ai-orb-types";

/** The dotted orb's own motions (thinking-orbs `OrbState`). Spelled out here
 *  rather than imported so this file stays importable under plain tsx. */
export type DottedMotion =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";

export const DOTTED_MOTIONS: readonly DottedMotion[] = [
  "working", "searching", "solving", "listening", "connecting",
  "weaving", "composing", "breathing", "shaping",
] as const;

export interface DottedLook {
  motion: DottedMotion;
  /** Multiplier on the motion's own tuned speed. */
  speed: number;
  /** 0..1 multiplier on ink opacity — how present the orb is. */
  ink: number;
}

const FAMILY_MOTION: Record<ActivityFamily, DottedMotion> = {
  "arc-scan": "searching",
  "line-scan": "searching",
  "counter-rotate": "solving",
  "sweep-lr": "connecting",
  "ripple-out": "composing",
  "ordered-orbit": "weaving",
};

/* THINKING, SMALL (owner, 2026-09-23, from the live preview: "fix the
   thinking one"). The orbits are the dotted orb's signature motion and read
   well from 40 px up. Under that — beside a chat message (38 px), in Discuss
   (30 px) — the 20 px tuning leaves a few dozen dots scattered across tilted
   orbits, most of them on the far side and faint: it stops reading as an orb
   at all, and "thinking" is the state a chat bubble shows most. The solving
   sphere was the clearest candidate side by side at 38 and 30 px, on dark and
   light (working, solving, searching, listening, weaving compared): a whole
   dotted sphere whose bands keep resolving — and it already means "working
   something out". So small orbs think with it; large ones keep the orbits. */
const SMALL_WORKING: DottedMotion = "solving";

export function dottedLook(
  state: AIOrbState = "idle",
  activity: AIOrbActivity = "none",
  result: AIOrbResult = "none",
  size: number = 72,
): DottedLook {
  const look = baseLook(state, activity, result);
  if (look.motion === "working" && dottedPreset(size) === 20) return { ...look, motion: SMALL_WORKING };
  return look;
}

function baseLook(state: AIOrbState, activity: AIOrbActivity, result: AIOrbResult): DottedLook {
  const s = resolveOrbState(state, result);
  switch (s) {
    case "success":
      return { motion: "shaping", speed: 1, ink: 1 };
    case "warning":
    case "error":
      return { motion: "breathing", speed: 0.6, ink: 0.7 };
    case "listening":
    case "transcribing":
      return { motion: "listening", speed: 1, ink: 1 };
    case "speaking":
      return { motion: "composing", speed: 1, ink: 1 };
    case "thinking":
      return { motion: "working", speed: 1, ink: 1 };
    case "processing": {
      const family = ACTIVITY_FAMILY[activity];
      if (family) return { motion: FAMILY_MOTION[family], speed: 1, ink: 1 };
      /* Waiting on the user is not work; it is a pause. */
      if (activity === "waiting-for-user" || activity === "requesting-permission") {
        return { motion: "breathing", speed: 1, ink: 1 };
      }
      return { motion: "working", speed: 1, ink: 1 };
    }
    case "awakening":
      return { motion: "shaping", speed: 1.2, ink: 1 };
    case "sleeping":
      return { motion: "breathing", speed: 0.5, ink: 0.6 };
    /* AT REST: the sash, at half its pace (owner, 2026-09-23, choosing from
       all nine motions side by side at 104/72/38/30 px: "composing").
       The breathing ring it replaces is not a sphere, which is the one
       thing this orb is. Solving was the other candidate and was ruled out
       on purpose: it is what a small orb THINKS with, so beside a chat
       message a resting orb and a thinking one would have been the same
       picture. The sash is also the speaking motion, but speaking only
       happens on the call screen, and there it runs at full pace and swells
       with the voice; at rest it moves at half that and holds still in
       size. */
    case "idle":
    default:
      return { motion: "composing", speed: 0.5, ink: 1 };
  }
}

/** The engine ships two tunings — 64 px (avatar scale) and 20 px (inline) —
 *  as separate designs, not a scale factor. The geometry itself takes any
 *  size; the tuning decides how many dots and how big. Below 40 px the 64
 *  tuning crowds into grey noise, so the inline tuning takes over. */
export function dottedPreset(size: number): 64 | 20 {
  return size < 40 ? 20 : 64;
}

/* ── WANDERING (owner, 2026-09-23, on the Home greeting: "I want the orb
   more bigger and changed randomly with the orb motion shapes"). Where a
   surface asks for it, a resting dotted orb does not sit in one motion: it
   drifts from shape to shape on its own, each change a morph. Only at rest —
   the moment the assistant is actually doing something, the orb says what,
   exactly as everywhere else. */

/** How long the wandering orb stays in one shape before the next. Long
 *  enough to watch the shape move, short enough to be noticed changing. */
export const DOTTED_WANDER_MS = 6000;

/** The next shape to wander to: any of the nine except the one it is in,
 *  so every change is a visible change. `rand` in [0, 1). Pure. */
export function nextWanderMotion(current: DottedMotion, rand: number): DottedMotion {
  const others = DOTTED_MOTIONS.filter((m) => m !== current);
  const i = Math.min(others.length - 1, Math.max(0, Math.floor(rand * others.length)));
  return others[i];
}

/* ---------------------------------------------------------------------------
   AI Orb — typed visual state model.

   The orb is a STATUS SYSTEM, not a decoration: every class of motion maps
   to one of these states/activities. Keep this file dependency-free so the
   validate script can import it under tsx.
   --------------------------------------------------------------------------- */

export type AIOrbState =
  | "idle"
  | "awakening"
  | "listening"
  | "transcribing"
  | "thinking"
  | "processing"
  | "speaking"
  | "success"
  | "warning"
  | "error"
  | "sleeping";

export type AIOrbActivity =
  | "none"
  | "searching"
  | "browsing"
  | "reading"
  | "analyzing"
  | "reasoning"
  | "translating"
  | "generating"
  | "retrieving-data"
  | "executing-action"
  | "creating-record"
  | "updating-record"
  | "deleting-record"
  | "uploading"
  | "downloading"
  | "connecting"
  | "waiting-for-user"
  | "requesting-permission";

export type AIOrbResult = "none" | "success" | "warning" | "error";

export interface AIOrbProps {
  state?: AIOrbState;
  activity?: AIOrbActivity;
  result?: AIOrbResult;
  /** 0..1 input/output amplitude — clamped; drives listening/speaking. */
  audioLevel?: number;
  /** 0..1 REAL progress only (never fake) — renders the edge arc. null hides it. */
  progress?: number | null;
  interactive?: boolean;
  compact?: boolean;
  size?: number;
  className?: string;
  /** Optional visible label override; aria-label is always set. */
  label?: string;
}

/** Higher wins when several signals are alive at once. */
export const STATE_PRIORITY: Record<AIOrbState, number> = {
  error: 110,
  warning: 100,
  success: 90,
  speaking: 80,
  listening: 70,
  transcribing: 60,
  processing: 50,
  thinking: 40,
  awakening: 30,
  idle: 20,
  sleeping: 10,
};

export function clamp01(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Resolve the winning visual state. A live result pulse overrides the
    base state briefly (the CALLER owns the pulse timer and clears it). */
export function resolveOrbState(base: AIOrbState, result: AIOrbResult): AIOrbState {
  if (result === "error") return "error";
  if (result === "warning") return "warning";
  if (result === "success") return "success";
  return base;
}

/* Each activity renders through one of six motion families — distinct
   enough that searching ≠ reading ≠ executing, without 18 bespoke
   animation systems fighting each other on one 72px ball. */
export type ActivityFamily =
  | "arc-scan"      /* rotating edge arc — scanning for something        */
  | "line-scan"     /* top→bottom light line — consuming content         */
  | "sweep-lr"      /* side↔side energy — transfer between two spaces    */
  | "counter-rotate"/* opposed internal layers — comparison/deduction    */
  | "ripple-out"    /* center→edge growth — output being constructed     */
  | "ordered-orbit";/* precise clockwise edge motion — acting on systems */

export const ACTIVITY_FAMILY: Record<AIOrbActivity, ActivityFamily | null> = {
  none: null,
  searching: "arc-scan",
  browsing: "arc-scan",
  reading: "line-scan",
  analyzing: "counter-rotate",
  reasoning: "counter-rotate",
  translating: "sweep-lr",
  generating: "ripple-out",
  "retrieving-data": "ordered-orbit",
  "executing-action": "ordered-orbit",
  "creating-record": "ripple-out",
  "updating-record": "ordered-orbit",
  "deleting-record": "ordered-orbit",
  uploading: "ordered-orbit",
  downloading: "ordered-orbit",
  connecting: "sweep-lr",
  "waiting-for-user": null,
  "requesting-permission": null,
};

/* ===========================================================================
   Insight Memory  —  Phase 2.0.1

   Lightweight cross-run persistence so signals understand their own
   lifecycle: new, recurring, worsening, improving, resolved.

   Storage layout (one JSON object in localStorage):

     {
       version: 1,
       runs:   [ { ts, eventSeverities: { eventKey: severity, ... } } ]
                last 4 runs only
     }

   Pure functions accept and return state; only the helpers at the
   bottom read/write the browser. The intelligence layer's caller is
   responsible for stitching it into the React lifecycle, so this file
   stays SSR-safe.
   ========================================================================== */

import type { BusinessHealth, OperationalEvent, Severity, SignalState } from "./types";

const STORAGE_KEY = "koleex:intelligence:memory:v1";
const MAX_RUNS = 4;

interface RunSnapshot {
  ts: number;
  severities: Record<string, Severity>;
}

export interface MemoryState {
  version: 1;
  runs: RunSnapshot[];
  /** Last composite health score (for EMA smoothing — exposed via health.ts). */
  lastHealthScore?: number;
}

/* Severity rank — lower = worse. */
const SEV_RANK: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };

function emptyMemory(): MemoryState {
  return { version: 1, runs: [] };
}

/* ---------------------------------------------------------------------------
   Pure: annotate events with state + persistence given prior memory.

   Returns:
     · annotated events (new / recurring / worsening / improving)
     · "resolved" carry-over events surfaced briefly for one run
     · the next-memory snapshot to persist
   --------------------------------------------------------------------------- */

export interface AnnotatedRun {
  events: OperationalEvent[];
  /** Resolved carry-overs the dashboard may render with a quiet "resolved" tag. */
  resolved: OperationalEvent[];
  nextMemory: MemoryState;
}

export function annotateWithMemory(
  events: OperationalEvent[],
  prior: MemoryState | null,
  now: number = Date.now(),
): AnnotatedRun {
  const priorRuns = prior?.runs ?? [];
  const lastRun = priorRuns[priorRuns.length - 1];

  /* For each current event, look back over the last MAX_RUNS to count
     consecutive appearances. */
  const annotated: OperationalEvent[] = events.map((e) => {
    let persistence = 1;
    for (let i = priorRuns.length - 1; i >= 0; i--) {
      if (e.key in priorRuns[i].severities) persistence += 1;
      else break;
    }

    let state: SignalState = "new";
    if (lastRun && e.key in lastRun.severities) {
      const lastSeverity = lastRun.severities[e.key];
      if (SEV_RANK[e.severity] < SEV_RANK[lastSeverity]) state = "worsening";
      else if (SEV_RANK[e.severity] > SEV_RANK[lastSeverity]) state = "improving";
      else state = "recurring";
    }
    /* If persistence ≥ 2 but state ended up "new" (weird edge), prefer "recurring". */
    if (state === "new" && persistence >= 2) state = "recurring";

    return { ...e, state, persistence };
  });

  /* "Resolved" carry-overs — keys that existed in the most recent prior
     run but are absent now. These get a brief one-run echo with
     state="resolved" so the user can see "this pressure is gone". We
     keep them at low severity to avoid taking up real estate. */
  const currentKeys = new Set(events.map((e) => e.key));
  const resolved: OperationalEvent[] = [];
  if (lastRun) {
    for (const [key, severity] of Object.entries(lastRun.severities)) {
      if (currentKeys.has(key)) continue;
      /* Only carry over signals that were material (not info). */
      if (severity === "info") continue;
      resolved.push({
        key: `${key}-resolved`,
        source: "operations",
        kind: "deal_stalled", // generic carrier — UI keys on state
        severity: "info",
        label: "Resolved this period",
        detail: "A previously open pressure cleared this period.",
        ts: now,
        state: "resolved",
        persistence: 0,
      });
    }
  }

  /* Build next memory snapshot. */
  const currentSnapshot: RunSnapshot = {
    ts: now,
    severities: Object.fromEntries(events.map((e) => [e.key, e.severity])),
  };
  const nextRuns = [...priorRuns, currentSnapshot].slice(-MAX_RUNS);
  const nextMemory: MemoryState = {
    version: 1,
    runs: nextRuns,
    lastHealthScore: prior?.lastHealthScore,
  };

  return { events: annotated, resolved, nextMemory };
}

/* ---------------------------------------------------------------------------
   EMA smoothing for the health score — keeps the system from swinging.
   --------------------------------------------------------------------------- */

const HEALTH_EMA_ALPHA = 0.45; // weight on the new reading

export function smoothHealth(
  health: BusinessHealth,
  prior: MemoryState | null,
): BusinessHealth {
  const previous = prior?.lastHealthScore;
  if (previous == null) return health;
  const smoothed = Math.round(HEALTH_EMA_ALPHA * health.composite + (1 - HEALTH_EMA_ALPHA) * previous);
  /* Guardrail: one-period swing capped at 12 points. */
  const delta = smoothed - previous;
  const capped = previous + Math.max(-12, Math.min(12, delta));
  return { ...health, composite: Math.round(capped) };
}

export function withHealthScore(memory: MemoryState, health: BusinessHealth): MemoryState {
  return { ...memory, lastHealthScore: health.composite };
}

/* ---------------------------------------------------------------------------
   Browser-side helpers (SSR-safe).

   The dashboard calls these once per load to read prior memory before
   building intelligence, and writes the next memory after rendering.
   --------------------------------------------------------------------------- */

export function loadMemory(): MemoryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemoryState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.runs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMemory(memory: MemoryState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* swallow */
  }
}

export { emptyMemory };

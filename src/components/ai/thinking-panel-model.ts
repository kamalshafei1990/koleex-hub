/* ---------------------------------------------------------------------------
   components/ai/thinking-panel-model — what the Thinking panel shows, as data.

   Owner, 2026-09-26, looking at how other assistants show their work: the
   words a model said before a lookup "come quickly and remove quickly". The
   panel keeps them, with the lookups, above the answer, and folds to one line
   ("Thought for 23s") once the answer begins. This file is the panel's logic
   with no React in it, so the rules are testable:

   · a turn with no lookup and nothing said before one has no panel;
   · each lookup is a row in plain words: what was searched, which site was
     read, or the activity words the orb already uses for any other tool.
     Tool names never reach the screen;
   · a note sits before the lookup it preceded.
   --------------------------------------------------------------------------- */

import type { AgentStep, ThinkingRecord } from "@/components/ai/types";
import { lookupDetail as lookupDetailOf } from "@/lib/ai/thinking-record";

export type ThinkingRow =
  | { kind: "note"; text: string }
  | { kind: "lookup"; tool: string; done: boolean; detail: string | null };

/* The detail rules live with the saved shape, so the screen and the record
   can never disagree about what a lookup may show. */
export { siteOf } from "@/lib/ai/thinking-record";

/** What a lookup row says after its verb (see lib/ai/thinking-record.ts). */
export function lookupDetail(step: AgentStep): string | null {
  return lookupDetailOf(step.tool, step.payload);
}

/** Is there anything for the panel to show? */
export function hasThinking(steps: AgentStep[] | undefined, thinking: ThinkingRecord | undefined): boolean {
  return (
    (steps ?? []).some((s) => s.kind === "tool-call") ||
    (thinking?.notes.length ?? 0) > 0 ||
    (thinking?.lookups?.length ?? 0) > 0
  );
}

/** The panel's rows in the order they happened. A lookup is done once a
 *  result for the same tool follows it, or once the turn has moved on to its
 *  answer (`finished`). */
export function thinkingRows(steps: AgentStep[] | undefined, thinking: ThinkingRecord | undefined, finished: boolean): ThinkingRow[] {
  /* A live turn has its steps; a saved one has its lookups. */
  const all: AgentStep[] = (steps ?? []).some((s) => s.kind === "tool-call")
    ? (steps ?? [])
    : (thinking?.lookups ?? []).map((l) => ({ kind: "tool-call" as const, tool: l.tool, payload: savedPayload(l) }));
  const saved = !(steps ?? []).some((s) => s.kind === "tool-call") && (thinking?.lookups?.length ?? 0) > 0;
  const notes = thinking?.notes ?? [];
  const rows: ThinkingRow[] = [];
  let lookups = 0;
  const notesAt = (i: number) => {
    for (const n of notes) if (n.at === i) rows.push({ kind: "note", text: n.text });
  };
  all.forEach((step, idx) => {
    if (step.kind !== "tool-call" || !step.tool) return;
    notesAt(lookups);
    const done = finished || saved || all.slice(idx + 1).some((s) => s.kind === "tool-result" && s.tool === step.tool);
    rows.push({ kind: "lookup", tool: step.tool, done, detail: lookupDetail(step) });
    lookups++;
  });
  /* Notes said after the last lookup announced (or with no lookup at all). */
  for (const n of notes) if (n.at >= lookups) rows.push({ kind: "note", text: n.text });
  return rows;
}

/* A saved lookup keeps only its detail; rebuilt as the payload lookupDetail
   reads, so the same rule draws it. */
function savedPayload(l: { tool: string; detail: string | null }): Record<string, unknown> {
  if (!l.detail) return {};
  if (l.tool === "search_web") return { query: l.detail };
  if (l.tool === "read_page") return { url: `https://${l.detail}` };
  return {};
}

/** Whole seconds for "Thought for {s}s", never 0. */
export function thoughtSeconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000));
}

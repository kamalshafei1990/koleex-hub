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

export type ThinkingRow =
  | { kind: "note"; text: string }
  | { kind: "lookup"; tool: string; done: boolean; detail: string | null };

/** The longest query or site name a row shows. */
const DETAIL_MAX = 90;

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > DETAIL_MAX ? `${t.slice(0, DETAIL_MAX - 1).trimEnd()}…` : t;
}

/** The site a read opened, as its host name without "www.". */
export function siteOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host ? clip(host) : null;
  } catch {
    return null;
  }
}

/** What a lookup row says after its verb: the query for a search, the site
 *  for a read, nothing for any other tool (its arguments stay off screen). */
export function lookupDetail(step: AgentStep): string | null {
  const args = (step.payload ?? {}) as Record<string, unknown>;
  if (step.tool === "search_web") return typeof args.query === "string" && args.query.trim() ? clip(args.query) : null;
  if (step.tool === "read_page") return siteOf(args.url);
  return null;
}

/** Is there anything for the panel to show? */
export function hasThinking(steps: AgentStep[] | undefined, thinking: ThinkingRecord | undefined): boolean {
  return (steps ?? []).some((s) => s.kind === "tool-call") || (thinking?.notes.length ?? 0) > 0;
}

/** The panel's rows in the order they happened. A lookup is done once a
 *  result for the same tool follows it, or once the turn has moved on to its
 *  answer (`finished`). */
export function thinkingRows(steps: AgentStep[] | undefined, thinking: ThinkingRecord | undefined, finished: boolean): ThinkingRow[] {
  const all = steps ?? [];
  const notes = thinking?.notes ?? [];
  const rows: ThinkingRow[] = [];
  let lookups = 0;
  const notesAt = (i: number) => {
    for (const n of notes) if (n.at === i) rows.push({ kind: "note", text: n.text });
  };
  all.forEach((step, idx) => {
    if (step.kind !== "tool-call" || !step.tool) return;
    notesAt(lookups);
    const done = finished || all.slice(idx + 1).some((s) => s.kind === "tool-result" && s.tool === step.tool);
    rows.push({ kind: "lookup", tool: step.tool, done, detail: lookupDetail(step) });
    lookups++;
  });
  /* Notes said after the last lookup announced (or with no lookup at all). */
  for (const n of notes) if (n.at >= lookups) rows.push({ kind: "note", text: n.text });
  return rows;
}

/** Whole seconds for "Thought for {s}s", never 0. */
export function thoughtSeconds(ms: number): number {
  return Math.max(1, Math.round(ms / 1000));
}

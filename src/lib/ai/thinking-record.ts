/* ---------------------------------------------------------------------------
   lib/ai/thinking-record — the Thinking panel's saved shape, for server and
   browser alike.

   The panel (components/ai/ThinkingPanel.tsx) shows what Koleex AI did before
   it answered. Owner, 2026-09-26: keep it, so a reloaded thread shows it too.
   The server writes this record into ai_messages.thinking with the reply
   (migration ai_messages_thinking.sql); the browser reads it back. One module
   so both sides agree on what may be in it:

   · notes — what the model said before a lookup, already made safe by
     core/thinking-note.ts; at most THINKING_MAX_NOTES;
   · lookups — the tool and ONE detail: a search's query or a read page's
     site. Any other tool's arguments are never stored;
   · ms — how long it thought before the answer began.

   No React, no server-only import: pure data rules.
   --------------------------------------------------------------------------- */

export interface ThinkingNote {
  text: string;
  /** How many lookups had been announced when it was said. */
  at: number;
}

export interface ThinkingLookup {
  tool: string;
  detail: string | null;
}

export interface StoredThinking {
  v: 1;
  notes: ThinkingNote[];
  lookups: ThinkingLookup[];
  ms: number;
}

export const THINKING_MAX_NOTES = 8;
export const THINKING_MAX_LOOKUPS = 12;
const NOTE_MAX = 600;
const DETAIL_MAX = 90;

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** The site a read opened, as its host name without "www.". */
export function siteOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host ? clip(host, DETAIL_MAX) : null;
  } catch {
    return null;
  }
}

/** What a lookup row says after its verb: the query for a search, the site
 *  for a read, nothing for any other tool (its arguments stay off screen and
 *  out of the record). */
export function lookupDetail(tool: string | undefined, payload: unknown): string | null {
  const args = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  if (tool === "search_web") return typeof args.query === "string" && args.query.trim() ? clip(args.query, DETAIL_MAX) : null;
  if (tool === "read_page") return siteOf(args.url);
  return null;
}

/** The record to save with a reply, or null when there is nothing to show:
 *  no lookup and nothing said before one. */
export function buildThinkingRecord(input: {
  notes: ThinkingNote[];
  steps: Array<{ kind: string; tool?: string; payload?: unknown }>;
  ms: number;
}): StoredThinking | null {
  const lookups = input.steps
    .filter((s) => s.kind === "tool-call" && typeof s.tool === "string" && s.tool)
    .slice(0, THINKING_MAX_LOOKUPS)
    .map((s) => ({ tool: s.tool as string, detail: lookupDetail(s.tool, s.payload) }));
  const notes = input.notes
    .filter((n) => typeof n.text === "string" && n.text.trim())
    .slice(0, THINKING_MAX_NOTES)
    .map((n) => ({ text: clip(n.text, NOTE_MAX), at: Math.max(0, Math.floor(n.at)) }));
  if (lookups.length === 0 && notes.length === 0) return null;
  return { v: 1, notes, lookups, ms: Math.max(0, Math.round(input.ms)) };
}

/** A saved record read back from a row, or null when the value is missing
 *  or not the shape above — a bad value hides the panel, never breaks it. */
export function parseThinkingRecord(raw: unknown): StoredThinking | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.notes) || !Array.isArray(r.lookups) || typeof r.ms !== "number") return null;
  const notes = r.notes
    .filter((n): n is ThinkingNote => !!n && typeof (n as ThinkingNote).text === "string" && typeof (n as ThinkingNote).at === "number")
    .slice(0, THINKING_MAX_NOTES);
  const lookups = r.lookups
    .filter((l): l is ThinkingLookup => !!l && typeof (l as ThinkingLookup).tool === "string")
    .map((l) => ({ tool: l.tool, detail: typeof l.detail === "string" ? l.detail : null }))
    .slice(0, THINKING_MAX_LOOKUPS);
  if (notes.length === 0 && lookups.length === 0) return null;
  return { v: 1, notes, lookups, ms: r.ms };
}

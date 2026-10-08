import "server-only";

/* ---------------------------------------------------------------------------
   ai/calls — the caller's past calls, each by its summary.

   Roadmap D2. Every call that ended with a real exchange left a summary in
   its conversation (voice/summary.ts): one assistant message, source
   'voice', opening with the heading in the call's language. That message IS
   the record of the call — so the calls history is a read over messages the
   product already writes: no table of calls, nothing stored twice.

   Pure half here: which rows are summaries (the same test the summary
   module uses to recognise its own writing), and how they become a list.
   The route reads owner-scoped, like every conversation read.
   --------------------------------------------------------------------------- */

import { isSummaryMessage } from "@/lib/server/ai/voice/summary";

/** How many candidate rows the route reads, newest first. */
export const CALLS_SCAN_ROWS = 300;
/** How many calls the history shows. */
export const CALLS_MAX = 60;

export type CallRow = {
  id: string;
  conversation_id: string;
  role: string;
  source: string | null;
  content: string | null;
  created_at: string;
};

export type CallItem = {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  summary: string;
  created_at: string;
};

/** Rows (newest first) to calls: only assistant rows that are a summary,
 *  with the chat's title attached; capped. One summary is one call. */
export function collectCalls(
  rowsNewestFirst: readonly CallRow[],
  titles: ReadonlyMap<string, string | null>,
  max: number = CALLS_MAX,
): CallItem[] {
  const out: CallItem[] = [];
  for (const row of rowsNewestFirst) {
    if (out.length >= max) break;
    if (row.role !== "assistant" || row.source !== "voice") continue;
    if (typeof row.content !== "string" || !isSummaryMessage(row.content)) continue;
    out.push({
      message_id: row.id,
      conversation_id: row.conversation_id,
      conversation_title: titles.get(row.conversation_id) ?? null,
      summary: row.content.trim(),
      created_at: row.created_at,
    });
  }
  return out;
}

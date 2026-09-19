/* ---------------------------------------------------------------------------
   voice/summary — ask the server to write down what a call came to.

   The client's half of roadmap B1. When the caller hangs up on a call with a
   real exchange in it, the call button asks POST /api/ai/voice/summary for
   a summary of that call; the server reads the saved turns, decides for
   itself whether there is enough to summarise, writes the summary into the
   thread and returns the row, which lands in the message list like any
   other saved turn. Nothing here reads the transcript for the model — the
   server does, from what was actually saved.

   Pure where it can be: shouldSummarise is the client's cheap pre-check (so
   a two-second call never makes a request), requestCallSummary takes its
   fetch so the suite can drive it.
   --------------------------------------------------------------------------- */

import type { SavedTurn } from "./persist";

export const SUMMARY_PATH = "/api/ai/voice/summary";
/** Below this many settled caller turns nothing is asked for. Mirrors the
 *  server's MIN_USER_TURNS; the server is the one that decides. */
export const SUMMARY_MIN_USER_LINES = 2;

export type CallSummaryResult = {
  message: SavedTurn;
  conversation: { id: string; title: string | null };
};

/** Whether the call that just ended is worth a summary: at least two settled
 *  caller turns and one settled reply. A call that never got going is not. */
export function shouldSummarise(lines: readonly { role: string; text: string; final?: boolean }[]): boolean {
  const settled = lines.filter((l) => l.final !== false && l.text.trim().length > 0);
  const users = settled.filter((l) => l.role === "user").length;
  const assistants = settled.filter((l) => l.role === "assistant").length;
  return users >= SUMMARY_MIN_USER_LINES && assistants >= 1;
}

/** Ask for the summary. Null on any failure or when the server found too
 *  little to summarise — the caller shows nothing either way. Never throws. */
export async function requestCallSummary(
  conversationId: string,
  lang: string,
  fetchFn: typeof fetch = fetch,
): Promise<CallSummaryResult | null> {
  try {
    const res = await fetchFn(SUMMARY_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, lang }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { message?: SavedTurn | null; conversation?: { id: string; title: string | null } };
    if (!body.message || !body.conversation) return null;
    return { message: body.message, conversation: body.conversation };
  } catch {
    return null;
  }
}

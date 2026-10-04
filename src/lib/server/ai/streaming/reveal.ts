/* ---------------------------------------------------------------------------
   ai/streaming/reveal — how fast to reveal a reply that is ALREADY COMPLETE.

   Phase 5A. Deliberately has no `server-only`: it is arithmetic, and the
   validation suite imports it directly.

   WHAT THIS IS FOR, and what it is NOT for. When a turn streams genuinely —
   the provider hands us tokens as it produces them — none of this runs. The
   route only reaches here when the reply arrived as a finished string with no
   deltas emitted: a degraded turn, a local-knowledge answer, a rescue after a
   provider failure. In that case the text is already in memory and the only
   question is how to put it on screen.

   THE BUG THIS FIXES. The previous rule was a fixed 28-character chunk with a
   fixed 12 ms pause, and NO CEILING. The pause is real wall-clock time, and it
   sits in front of the `end` event, so it delays the turn itself and not just
   the animation. Measured from those two constants:

       reply length   chunks   pure artificial delay
          120 ch          5          48 ms
        1 200 ch         43         504 ms
        5 000 ch        179       2 136 ms
        9 000 ch        322       3 852 ms

   A long answer — a product comparison, a report — paid nearly FOUR SECONDS
   of invented waiting after it was fully computed. That is the "typewriter
   that isn't real" the plan set out to remove, and it is the one latency
   number that can be fixed without measuring anything, because it is not a
   property of the network or the model: it is two constants multiplied.

   THE RULE NOW: the whole reveal fits inside a fixed BUDGET, whatever the
   length. Long replies get bigger chunks rather than more waiting. The
   gradual reveal survives — that is what the pause is genuinely for, and
   dropping it entirely would just deliver every frame at once, which is a
   block of text with extra steps.

   THE BUDGET IS A CEILING, NOT A TARGET. A short reply keeps the pace it
   always had; only replies that would have OVERSHOT the budget are sped up.
   The first version of this file got that backwards and made 120-char replies
   eight times slower while fixing the long ones. Nothing here may slow a reply
   down at any length, and the suite asserts it at every length rather than
   only at the interesting ones.

   Three bounds are held:
     · never SLOWER than the budget, however long the reply
     · never so fine-grained that the pause drops under MIN_DELAY_MS, where
       frames coalesce in the browser and the animation is lost anyway
   --------------------------------------------------------------------------- */

/** Total wall-clock the progressive reveal may occupy, in ms.
 *
 *  400 ms is roughly the point where a reveal reads as deliberate rather than
 *  sluggish, and it is inside the §I budget for a simple chat turn with room
 *  left for the network. It is a UX constant, not a measurement — which is
 *  exactly why it is one named number rather than two multiplied constants
 *  whose product nobody had computed. */
export const REVEAL_BUDGET_MS = 400;

/** Below this the browser coalesces frames and the reveal stops being
 *  visible, so more chunks would cost scheduling work for no visual effect. */
export const MIN_DELAY_MS = 4;

/** The pause a SHORT reply gets — the pre-5A constant, unchanged.
 *
 *  This exists because the first version of this file got the fix backwards.
 *  It spread the budget across whatever chunks a reply happened to have, which
 *  turned REVEAL_BUDGET_MS into a TARGET rather than a CEILING: a 120-char
 *  reply went from 48 ms to 400 ms — eight times slower — while the long
 *  replies got faster. The suite caught it on the first run.
 *
 *  The budget may only ever make the reveal FASTER. Nothing here is allowed to
 *  slow a reply down, at any length. */
export const BASE_DELAY_MS = 12;

/** The finest chunk worth sending. Matches the pre-5A constant, so short
 *  replies reveal exactly as they always did. */
export const MIN_CHUNK_CHARS = 28;

export interface RevealPlan {
  /** Characters per chunk. */
  chunkChars: number;
  /** Pause between chunks, in ms. */
  delayMs: number;
  /** How many chunks the reply will be cut into. */
  chunks: number;
  /** Total artificial delay this plan will spend. */
  totalDelayMs: number;
}

/** Plan the reveal of an already-complete reply.
 *
 *  Pure. Given a length it returns the chunking and pacing, so the property
 *  that matters — "the artificial delay is bounded" — can be asserted across
 *  a range of lengths instead of read out of a for-loop and believed. */
export function planReveal(
  length: number,
  budgetMs: number = REVEAL_BUDGET_MS,
): RevealPlan {
  if (length <= 0) {
    return { chunkChars: MIN_CHUNK_CHARS, delayMs: 0, chunks: 0, totalDelayMs: 0 };
  }

  /* The most chunks worth cutting into: enough to keep every pause at or
     above MIN_DELAY_MS, and never finer than MIN_CHUNK_CHARS. */
  const byBudget = Math.max(1, Math.floor(budgetMs / MIN_DELAY_MS));
  const byLength = Math.max(1, Math.ceil(length / MIN_CHUNK_CHARS));
  const chunks = Math.min(byLength, byBudget);

  const chunkChars = Math.max(MIN_CHUNK_CHARS, Math.ceil(length / chunks));
  /* Recompute from the REAL chunk size: ceil() above can produce fewer chunks
     than planned, and pacing against a count the loop will not actually reach
     would overshoot the budget. */
  const actualChunks = Math.ceil(length / chunkChars);
  /* n chunks means n-1 pauses — the last chunk is not followed by a wait. */
  const gaps = Math.max(0, actualChunks - 1);
  /* The budget is a CEILING, never a target: take the pre-5A pace unless the
     budget demands something faster, and never go under the floor where the
     reveal stops being visible at all. */
  const paced = gaps === 0 ? 0 : Math.max(MIN_DELAY_MS, Math.floor(budgetMs / gaps));
  const delayMs = gaps === 0 ? 0 : Math.min(BASE_DELAY_MS, paced);

  return {
    chunkChars,
    delayMs,
    chunks: actualChunks,
    totalDelayMs: gaps * delayMs,
  };
}

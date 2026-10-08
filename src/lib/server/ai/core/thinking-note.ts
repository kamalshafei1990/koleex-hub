import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/thinking-note — what the model said before it looked something up.

   Owner, 2026-09-26: "the words come quickly and remove quickly". A model that
   narrates and then calls a tool used to have that narration streamed into
   the answer and then retracted. The screen now keeps it, in the Thinking
   panel above the answer, so this is the one place it is made safe to keep:

   · tool markup a model leaked into prose is cut, as it is from answers;
   · a note that states a price or cost is dropped whole. Answers carry a
     pricing seal that checks for tool evidence; a note is written before
     any evidence exists, so there is nothing to check it against;
   · it is capped, so a model that monologues cannot fill the panel.

   It is shown to the same caller who would have seen it stream a moment
   earlier, and it is not saved.
   --------------------------------------------------------------------------- */

import { cleanAssistantText, looksLikeDebug, scrubLeakedToolMarkup } from "@/lib/server/ai/seals";
import { containsPricingOutput } from "@/lib/server/ai/seals/pricing";

/** The longest note the panel will show. */
export const THINKING_NOTE_MAX = 600;

/** The narration as the panel may show it, or "" when there is nothing safe
 *  to show. */
export function thinkingNote(raw: string): string {
  const text = scrubLeakedToolMarkup(cleanAssistantText(raw ?? "")).trim();
  if (!text || looksLikeDebug(text)) return "";
  if (containsPricingOutput(text)) return "";
  if (text.length <= THINKING_NOTE_MAX) return text;
  const cut = text.slice(0, THINKING_NOTE_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > THINKING_NOTE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

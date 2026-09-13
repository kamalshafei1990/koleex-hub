/**
 * Which way a piece of text should be laid out.
 *
 * `dir="auto"` looks tempting and is wrong for AI replies. The HTML spec
 * has it use the FIRST STRONG CHARACTER of the paragraph and nothing else,
 * so an Arabic answer that opens with "Koleex Hub…" is treated as an
 * English paragraph and the whole thing renders reversed — which is
 * exactly the bug this replaces. `unicode-bidi: plaintext` has the same
 * flaw: it re-applies first-strong per paragraph and overrides whatever
 * `dir` says, so even an explicit dir="rtl" could not save it.
 *
 * Two things make this different:
 *   - it weighs the WHOLE string instead of stopping at the first letter,
 *     so a leading product name cannot decide the paragraph;
 *   - it leans RTL on a near-tie, because Arabic prose carrying English
 *     product names ("Koleex Hub", "CRM", model numbers) is the normal
 *     case here, while English prose carrying Arabic essentially never is.
 *
 * Measure the whole MESSAGE, not each block: a heading like
 * "ما يغطيه Koleex Hub" has more Latin letters than Arabic ones on its
 * own, and only resolves correctly when it inherits from the reply
 * around it.
 */
export type TextDir = "rtl" | "ltr";

/* Hebrew, Arabic, Syriac, Thaana, Arabic Supplement/Extended, and the
   Arabic presentation forms. */
const RTL_CHAR =
  /[֐-׿؀-ۿ܀-ݏݐ-ݿހ-޿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;
/* Latin, Latin Extended, Greek and Cyrillic. Digits and punctuation are
   deliberately excluded — they are bidi-neutral and would skew the count
   in a message full of prices and model numbers. */
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

export function textDirection(text: string, fallback: TextDir = "ltr"): TextDir {
  if (!text) return fallback;
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) rtl++;
    else if (LTR_CHAR.test(ch)) ltr++;
  }
  if (!rtl) return ltr ? "ltr" : fallback;
  return rtl * 3 >= ltr ? "rtl" : "ltr";
}

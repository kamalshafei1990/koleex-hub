/* ---------------------------------------------------------------------------
   lib/language/franco-converter — Phase 11 Franco Arabic (Arabizi)
                                   → proper Arabic script.

   Franco is Arabic written with Latin letters + numerals standing in
   for Arabic sounds that have no Latin equivalent:

     2 → ء   3 → ع   5 → خ   6 → ط   7 → ح   8 → ق   9 → ص

   Plus a letter-by-letter romanisation for the alphabet:

     a → ا   b → ب   c → ك   d → د   e → ي   f → ف   g → ج
     h → ه   i → ي   j → ج   k → ك   l → ل   m → م   n → ن
     o → و   p → ب   q → ق   r → ر   s → س   t → ت   u → و
     v → ف   w → و   x → كس   y → ي   z → ز

   Anti-goals:
     · We do NOT try to do full Arabic transliteration. Vowel
       placement, sun/moon letters, ta-marbuta vs ha, hamza seat
       selection — none of that. Users asking for this layer
       are OK with "close enough and legible".
     · We do NOT translate English technical terms that happen to
       live inside Franco text. "ana 3ayz a3rf margin" keeps
       "margin" in Latin, because "مارجين" is worse than "margin"
       for a user talking shop.
     · We do NOT touch numbers (quantities, prices, IDs) or already-
       Arabic text.

   Output is deterministic: same input → same output, always.
   Callers: the agent route rewrite layer, tests, future UI helpers.
   --------------------------------------------------------------------------- */

import { isPreservedTerm } from "./egyptian-profile";

/** Franco-specific digit substitutes. */
const DIGIT_MAP: Record<string, string> = {
  "2": "ء",
  "3": "ع",
  "5": "خ",
  "6": "ط",
  "7": "ح",
  "8": "ق",
  "9": "ص",
};

/** Latin → Arabic letter table (lowercase keys). */
const LETTER_MAP: Record<string, string> = {
  a: "ا", b: "ب", c: "ك", d: "د", e: "ي", f: "ف", g: "ج",
  h: "ه", i: "ي", j: "ج", k: "ك", l: "ل", m: "م", n: "ن",
  o: "و", p: "ب", q: "ق", r: "ر", s: "س", t: "ت", u: "و",
  v: "ف", w: "و", x: "كس", y: "ي", z: "ز",
};

const RE_ARABIC_LETTER = /[\u0600-\u06FF]/;
const RE_PURE_DIGITS   = /^\d+$/;
const RE_LATIN_ONLY    = /^[A-Za-z]+$/;

/** Convert a single token. Punctuation, whitespace, pure numbers,
 *  already-Arabic tokens, and preserved English terms are returned
 *  untouched. */
function convertToken(token: string): string {
  if (!token) return token;
  /* Leave pure whitespace / punctuation. */
  if (/^\s+$/.test(token)) return token;
  /* Leave numbers alone — "100 USD", "quantity 12". */
  if (RE_PURE_DIGITS.test(token)) return token;
  /* Leave already-Arabic tokens alone (mixed input is common). */
  if (RE_ARABIC_LETTER.test(token)) return token;
  /* Preserved English term (technical / brand / unit). */
  if (RE_LATIN_ONLY.test(token) && isPreservedTerm(token)) return token;

  /* Convert character-by-character. Franco digits and Latin letters
     both map; anything else (punctuation inside a token like an
     apostrophe, quote marks, emojis) passes through unchanged. */
  let out = "";
  for (const ch of token) {
    if (DIGIT_MAP[ch]) {
      out += DIGIT_MAP[ch];
      continue;
    }
    const low = ch.toLowerCase();
    if (LETTER_MAP[low]) {
      out += LETTER_MAP[low];
      continue;
    }
    out += ch;
  }
  return out;
}

/** Convert Franco Arabic (Arabizi) input to Arabic script. Preserves
 *  punctuation, whitespace, numbers, already-Arabic tokens, and a
 *  short whitelist of English technical terms ("margin", "RFQ",
 *  "FOB", etc.).
 *
 *  Example:
 *    "ana 3ayz a3rf margin" → "انا عايز اعرف margin"
 */
export function convertFrancoToArabic(input: string): string {
  if (!input) return input;
  /* Split on whitespace runs but keep the separators so we can put
     them back verbatim — avoids collapsing "\n\n" or double spaces. */
  return input
    .split(/(\s+)/)
    .map(convertToken)
    .join("");
}

/** True if the input looks like it contains Franco tokens (Latin
 *  letters + at least one Franco-specific digit). Cheap heuristic
 *  for routing callers; the main language detector is authoritative. */
export function looksLikeFranco(input: string): boolean {
  if (!input || !/[A-Za-z]/.test(input)) return false;
  return /\b[a-z]*[23567][a-z]+\b|\b[a-z]+[23567][a-z]*\b/i.test(input);
}

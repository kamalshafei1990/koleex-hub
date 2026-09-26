/* ---------------------------------------------------------------------------
   lib/text-fold — text folded the way a person searches it.

   Egyptian typing skips the hamza, writes ه for ة and ي for ى, and never
   types harakat; a title saved as "الأسعار" was not found by "اسعار", nor
   "مدرسة" by "مدرسه" (review, 2026-09-26). Both sides of a search — the
   query and the text — are folded to one spelling before they are compared:

   · أ إ آ ٱ → ا     · ة → ه     · ى → ي     · ؤ → و     · ئ → ي
   · harakat, the superscript alef and the tatweel are dropped
   · lower case, runs of whitespace as one space

   Pure, no imports: the sidebar filters with it in the browser, and the
   conversation search uses it on the server.
   --------------------------------------------------------------------------- */

const LETTER_FOLD: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي",
};
const LETTERS = /[أإآٱةىؤئ]/g;
/** Harakat (fathatan … sukun, and the Quranic marks after them), the
 *  superscript alef, and the tatweel. */
const MARKS = /[ً-ٰٟۖ-ۭـ]/g;

/** The text as a search compares it. */
export function foldForSearch(text: string): string {
  return text.replace(MARKS, "").replace(LETTERS, (c) => LETTER_FOLD[c] ?? c).replace(/\s+/g, " ").trim().toLowerCase();
}

/** The letters folded but nothing removed, so every index still points at
 *  the same character of the original — for finding where a match sits. */
export function foldLettersOnly(text: string): string {
  return text.replace(LETTERS, (c) => LETTER_FOLD[c] ?? c).toLowerCase();
}

/** Does `text` contain `query`, both folded? An empty query matches. */
export function foldedIncludes(text: string, query: string): boolean {
  const q = foldForSearch(query);
  return !q || foldForSearch(text).includes(q);
}

/** Every character a folded letter may have been typed as, so a database
 *  LIKE can find each spelling: the letter becomes a single-character
 *  wildcard. The caller filters the rows with foldedIncludes afterwards —
 *  the wildcard lets in a few rows that are not matches, never keeps out one
 *  that is. */
export const FOLDABLE = /[اأإآٱهةيىئوؤ]/;

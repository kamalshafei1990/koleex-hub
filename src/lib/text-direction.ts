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
 * Measure the whole MESSAGE for the bubble: a heading like
 * "ما يغطيه Koleex Hub" has more Latin letters than Arabic ones on its
 * own, and only resolves correctly when it inherits from the reply
 * around it. A block inside the reply may then differ from the bubble
 * only on clear evidence (blockDirection below) — an English paragraph
 * quoted inside an Arabic answer, or the other way round.
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

/* THE PROSE, NOT THE CODE. A fenced block, inline code and a URL are Latin
   by nature and say nothing about the language of the words around them;
   counted, a long code block outweighs the Arabic paragraph that introduces
   it and the whole reply is laid out as English — the owner's screenshot of
   2026-09-15 (an Arabic opening, then a full task prompt in a fence). Only
   the measurement ignores them; the text itself is untouched. */
export function proseOf(text: string): string {
  return (text ?? "")
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\]\([^)]*\)/g, "]");
}

function countScripts(text: string): { rtl: number; ltr: number } {
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) rtl++;
    else if (LTR_CHAR.test(ch)) ltr++;
  }
  return { rtl, ltr };
}

export function textDirection(text: string, fallback: TextDir = "ltr"): TextDir {
  if (!text) return fallback;
  const { rtl, ltr } = countScripts(proseOf(text));
  if (!rtl) return ltr ? "ltr" : fallback;
  return rtl * 3 >= ltr ? "rtl" : "ltr";
}

/* ONE BLOCK INSIDE A REPLY. A paragraph, heading or list item decides for
   itself only when it carries enough of one script to be sure; a short
   Latin line ("Claude Code:", a product name, a number) inside an Arabic
   reply follows the reply, as the doc above requires. Twelve Latin letters
   is a phrase, not a name. */
const BLOCK_LATIN_MIN = 12;

export function blockDirection(text: string, bubble: TextDir): TextDir {
  if (!text) return bubble;
  const { rtl, ltr } = countScripts(proseOf(text));
  if (rtl) return rtl * 3 >= ltr ? "rtl" : "ltr";
  return ltr >= BLOCK_LATIN_MIN ? "ltr" : bubble;
}

/* ---------------------------------------------------------------------------
   Which SCRIPT a piece of text is mostly in — for size and font, not layout.

   Direction answers "which way does this flow"; it cannot tell Chinese from
   English (both LTR), and Arabic and Chinese glyphs both sit small at the
   Latin sizes the app is drawn in (owner, 2026-09-13: "adjust the text
   size … specifically the Arabic and Chinese"). The answer is put on the
   element as a `lang` attribute so the stylesheet's :lang() rules pick the
   size and the font stack, and the browser picks the right CJK glyph
   variants. Same rule as textDirection: weigh the whole string, lean
   towards the non-Latin script on a near-tie, because Arabic or Chinese
   prose carrying English product names is the normal case here.
   --------------------------------------------------------------------------- */
export type TextScript = "ar" | "zh" | "latin" | "none";

/* Han ideographs (unified + extension A), CJK symbols and punctuation,
   fullwidth forms. Kana and Hangul are left out on purpose: this app speaks
   Chinese, and a Japanese line marked "zh" would pick the wrong glyphs. */
const CJK_CHAR = /[一-鿿㐀-䶿⺀-⻿⼀-⿟　-〿︰-﹏＀-￯]/;

export function textScript(text: string): TextScript {
  if (!text) return "none";
  let ar = 0;
  let zh = 0;
  let la = 0;
  for (const ch of proseOf(text)) {
    if (RTL_CHAR.test(ch)) ar++;
    else if (CJK_CHAR.test(ch)) zh++;
    else if (LTR_CHAR.test(ch)) la++;
  }
  if (!ar && !zh) return la ? "latin" : "none";
  /* One ideograph carries a word; one Arabic letter carries a fraction of
     one. Both leans mirror textDirection's 3:1 for Arabic; Chinese needs
     fewer characters to be the language of the line. */
  if (ar >= zh) return ar * 3 >= la ? "ar" : "latin";
  return zh * 4 >= la ? "zh" : "latin";
}

/** The `lang` attribute for a piece of content: "ar" / "zh" for the two
 *  scripts the stylesheet sizes on their own, "en" for Latin text so an
 *  English title inside an Arabic screen keeps its own size, and undefined
 *  (attribute omitted, language inherited) when the text says nothing. */
export function textLang(text: string): "ar" | "zh" | "en" | undefined {
  const s = textScript(text);
  if (s === "ar" || s === "zh") return s;
  if (s === "latin") return "en";
  return undefined;
}

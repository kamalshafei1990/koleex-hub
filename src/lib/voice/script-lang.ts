/* ---------------------------------------------------------------------------
   voice/script-lang — which of the three languages a piece of text is in,
   read from its SCRIPT. Pure, tiny, shared by the browser and the server.

   WHY SCRIPT AND NOT A LANGUAGE MODEL. The question this answers is "which
   transcriber should hear this caller", and the three candidates are written
   in three different alphabets. Arabic letters are Arabic; CJK ideographs are
   Chinese; Latin letters are English. A sentence of mixed script is whichever
   has the most letters. Nothing else is needed, and nothing else is as cheap
   or as certain.
   --------------------------------------------------------------------------- */

export type ScriptLang = "ar" | "en" | "zh";

const ARABIC = /[؀-ۿݐ-ݿ]/g;
const CJK = /[一-鿿㐀-䶿]/g;
const LATIN = /[A-Za-z]/g;

/** Null when the text has no letters to judge by. */
export function detectScriptLang(text: string | null | undefined): ScriptLang | null {
  if (!text) return null;
  const ar = (text.match(ARABIC) ?? []).length;
  const zh = (text.match(CJK) ?? []).length;
  const en = (text.match(LATIN) ?? []).length;
  if (ar === 0 && zh === 0 && en === 0) return null;
  if (ar >= zh && ar >= en) return "ar";
  if (zh >= en) return "zh";
  return "en";
}

/**
 * The language of a conversation, from both sides of it — weighed unequally.
 *
 * THE ASSISTANT'S REPLIES ALWAYS COUNT. Koleex AI hears the audio, not the
 * transcript, and answers in the language it heard — so its replies are one
 * honest record of the caller's language. THE CALLER'S TRANSCRIPT COUNTS ONLY
 * WHEN ITS SCRIPT CANNOT BE A HINT ARTEFACT. The transcript is written by a
 * transcriber that was TOLD a language, and a transcriber told the wrong one
 * writes nonsense IN THE SCRIPT IT WAS TOLD: Egyptian speech under an English
 * hint comes back as Latin letters, and — the audit's counter-case
 * (2026-09-07) — English or Chinese speech under an Arabic hint comes back
 * as Arabic letters. So a caller line votes only when its script is NOT the
 * hint that was in force when it was transcribed; when the hint is unknown,
 * a Latin line is the one that may be an artefact (the default hint is
 * English) and does not vote.
 *
 * WHY THE CALLER'S SIDE IS READ AT ALL (two saved calls, 2026-09-04): Koleex
 * AI answered "هلا و" with "Hello Kimo" and an Arabic question with an
 * English paragraph. Read from its replies alone, the conversation was
 * "English"; that was remembered on the device as the transcriber hint, and
 * the next Arabic call's transcript came back "شashawa". A wrong reply
 * taught a wrong hint, which no later turn could correct. The caller's
 * Arabic lines under an English hint now outvote the English replies.
 *
 * A TIE GOES TO THE MOST RECENT REPLY, never to a fixed language: a seeded
 * "Arabic wins ties" is how a wrong hint became permanent.
 */
export type DetectOptions = { hint?: ScriptLang | null; limit?: number };

export function detectConversationLang(
  turns: readonly { role: string; content: string }[],
  opts: number | DetectOptions = 12,
): ScriptLang | null {
  const limit = typeof opts === "number" ? opts : opts.limit ?? 12;
  const hint = typeof opts === "number" ? null : opts.hint ?? null;
  const votes: Record<ScriptLang, number> = { ar: 0, en: 0, zh: 0 };
  let seen = 0;
  let latestReply: ScriptLang | null = null;
  for (let i = turns.length - 1; i >= 0 && seen < limit; i--) {
    const t = turns[i];
    const lang = detectScriptLang(t.content);
    if (!lang) continue;
    if (t.role === "assistant") {
      votes[lang]++;
      seen++;
      if (!latestReply) latestReply = lang;
    } else if (t.role === "user") {
      const maybeArtefact = hint ? lang === hint : lang === "en";
      if (!maybeArtefact) {
        votes[lang]++;
        seen++;
      }
    }
  }
  if (seen === 0) return null;
  const top = Math.max(votes.ar, votes.en, votes.zh);
  if (latestReply && votes[latestReply] === top) return latestReply;
  return (["ar", "en", "zh"] as const).find((k) => votes[k] === top) ?? null;
}

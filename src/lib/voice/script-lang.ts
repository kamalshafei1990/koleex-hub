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
 * The language of a conversation, from the ASSISTANT's side of it.
 *
 * THE ASSISTANT, NOT THE CALLER — deliberately. The caller's transcript is
 * written by a transcriber that was TOLD a language, so when the hint is
 * wrong the transcript is wrong in the same direction (Egyptian speech under
 * an English hint comes back as English nonsense) and can never correct
 * itself. Koleex AI hears the audio, not the transcript, and answers in the
 * language it heard: its replies are the one honest record of what language
 * the caller speaks. Most recent turns weigh the same as older ones; a
 * caller who switches gets the new language once it is the majority.
 */
export function detectConversationLang(
  turns: readonly { role: string; content: string }[],
  limit = 12,
): ScriptLang | null {
  const votes: Record<ScriptLang, number> = { ar: 0, en: 0, zh: 0 };
  let seen = 0;
  for (let i = turns.length - 1; i >= 0 && seen < limit; i--) {
    const t = turns[i];
    if (t.role !== "assistant") continue;
    const lang = detectScriptLang(t.content);
    if (!lang) continue;
    votes[lang]++;
    seen++;
  }
  if (seen === 0) return null;
  return (Object.keys(votes) as ScriptLang[]).reduce((best, k) => (votes[k] > votes[best] ? k : best), "ar");
}

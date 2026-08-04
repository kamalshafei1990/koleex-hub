import "server-only";

/* ---------------------------------------------------------------------------
   reply-language — "always answer me in Arabic" has to OUTLIVE the sentence
   that said it.

   The system prompt already told the model to honour an explicit language
   override "for all subsequent replies", and that was never going to be
   enough for two reasons:

     · a new conversation starts with empty history, so the instruction is
       simply gone — which is exactly what "the AI has no memory" means;
     · the fast lanes run on a trimmed prompt that never carried the rule at
       all, and they answer most ordinary messages.

   So the preference is STORED, on the caller's own account, and applied to
   every turn before any prompt is built. Detection is deterministic rather
   than a tool the model may or may not decide to call — the fast lanes carry
   no tools, so a tool would miss the very messages most likely to contain the
   instruction.

   Stored in the existing accounts.preferences JSONB (no migration), the same
   place ai_memory lives.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";

export type ReplyLang = "en" | "zh" | "ar";

/** null = no directive in this message; "clear" = go back to auto-detect. */
export type LanguageDirective = ReplyLang | "clear" | null;

/* Each language is matched by (a) a word meaning "reply/answer/speak/write"
   and (b) a name for the target language — in ANY of the three interface
   languages, because people mix them: an Arabic speaker often types "always
   reply in Arabic" in English. The verb is required so that merely mentioning
   a language ("translate this to Arabic", "how do you say hello in Chinese")
   never silently changes the reply language. */
const SPEAK =
  /(reply|replies|respond|answer|answering|write|speak|talk|use)/i;
const ALWAYS = /(always|from now on|going forward|every time|all the time)/i;

const NAMES: Record<ReplyLang, RegExp> = {
  ar: /(arabic|arabe|العربية|عربي|بالعربية|بالعربي|阿拉伯语|阿拉伯文)/i,
  en: /(english|الانجليزية|الإنجليزية|بالانجليزي|بالإنجليزي|انجليزي|إنجليزي|英语|英文)/i,
  zh: /(chinese|mandarin|الصينية|بالصيني|صيني|中文|汉语|中国话)/i,
};

/* Arabic and Chinese rarely use the English verb, so each gets its own
   imperative forms. "رد بالعربي", "اتكلم عربي", "请用中文回答". */
const SPEAK_AR = /(رد|ردّ|جاوب|جاوبني|اجب|أجب|اكتب|تكلم|اتكلم|كلمني|استخدم)/;
const SPEAK_ZH = /(回答|回复|说|讲|用|写)/;
const ALWAYS_AR = /(دايما|دائما|دائمًا|دايماً|من الآن|من الان|من دلوقتي|كل مرة|على طول)/;
const ALWAYS_ZH = /(总是|以后|一直|每次|始终)/;

/**
 * Detect an explicit "answer me in <language>" instruction.
 *
 * Conservative by design: a false positive silently changes the language of
 * every future reply, which is far more annoying than a missed instruction the
 * user can simply repeat.
 */
export function detectLanguageDirective(raw: string): LanguageDirective {
  const msg = (raw ?? "").trim();
  if (!msg || msg.length > 400) return null;

  const hasVerb = SPEAK.test(msg) || SPEAK_AR.test(msg) || SPEAK_ZH.test(msg);
  if (!hasVerb) return null;

  /* "stop replying in Arabic", "go back to normal", "auto" */
  if (
    /(stop|no longer|don'?t)\s+\w*\s*(reply|respond|answer|writing|speaking)/i.test(msg) ||
    /(بطل|توقف|خلاص)\s*(الرد|ترد)/.test(msg)
  ) {
    return "clear";
  }

  /* Which language is named? If more than one is named the sentence is
     ambiguous ("translate my Arabic into English") — do nothing. */
  const named = (Object.keys(NAMES) as ReplyLang[]).filter((k) => NAMES[k].test(msg));
  if (named.length !== 1) return null;

  /* A bare "reply in Arabic" is a one-off; "ALWAYS reply in Arabic" is a
     standing order. Both set the preference — a user who says "reply in
     Arabic" and then gets English again reads it as the app ignoring them,
     which is the complaint this exists to fix. `always` is accepted purely
     so the wording feels natural either way. */
  void ALWAYS; void ALWAYS_AR; void ALWAYS_ZH;

  return named[0];
}

/** The caller's stored preference, or null when they've never set one. */
export async function getReplyLanguage(accountId: string): Promise<ReplyLang | null> {
  const { data } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", accountId)
    .maybeSingle();
  const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
  const v = prefs.ai_reply_language;
  return v === "en" || v === "zh" || v === "ar" ? v : null;
}

/** Persist (or clear) the preference. Read-modify-write on the JSONB column,
 *  the same pattern the AI memory tool uses, so sibling keys survive. */
export async function setReplyLanguage(
  accountId: string,
  lang: ReplyLang | null,
): Promise<void> {
  const { data } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", accountId)
    .maybeSingle();
  const prefs = { ...((data?.preferences ?? {}) as Record<string, unknown>) };
  if (lang) prefs.ai_reply_language = lang;
  else delete prefs.ai_reply_language;
  await supabaseServer.from("accounts").update({ preferences: prefs }).eq("id", accountId);
}

const LABEL: Record<ReplyLang, string> = {
  en: "English",
  ar: "Arabic",
  zh: "Chinese",
};

/**
 * The line appended to every system prompt while a preference is set.
 *
 * Blunt on purpose: the base prompt tells the model to mirror the language of
 * the incoming message, and this has to beat that instruction even when the
 * user writes in something else — which is the whole point of the setting.
 */
export function replyLanguageLock(lang: ReplyLang): string {
  return (
    `\n\nLANGUAGE LOCK — the user has asked you to always answer in ${LABEL[lang]}. ` +
    `Write EVERY reply in ${LABEL[lang]}, no matter which language their message is written in. ` +
    `This overrides any other instruction about mirroring the user's language. ` +
    `Keep product codes, model names and proper nouns in their original form. ` +
    `Only stop when they explicitly ask you to answer in another language.`
  );
}

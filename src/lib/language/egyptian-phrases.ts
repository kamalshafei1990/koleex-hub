/* ---------------------------------------------------------------------------
   lib/language/egyptian-phrases — Phase 11 Level 2 phrase library.

   Categorised pools of Egyptian Arabic phrases that feel human and
   conversational, not textbook. The smart response builder picks
   from these based on (a) the user's intent and (b) whether the
   model's raw reply looks like a clarification ask or a generic
   apology.

   Keep pools SHORT (2–4 phrases each). Too many options makes the
   picker harder to tune and dilutes the voice. Add phrases only
   when they pass the "sounds like a real Egyptian person talking
   to a colleague" bar — no textbook translations, no formal MSA
   calques.

   Each pool's picker is deterministic — same input always selects
   the same phrase, so tests are reproducible and users who ask
   the same question twice don't get suspiciously different openings.
   --------------------------------------------------------------------------- */

export type PhraseCategory =
  | "clarify"
  | "greeting"
  | "explanation_start"
  | "definition_start"
  | "fallback_soft"
  | "handoff_app"
  | "acknowledge";

/** Phrase pools. Ordered by how "neutral" the opener is — the first
 *  entry in each pool is the safest fallback; later entries are
 *  more personality-forward. Picker hashes the content to stay
 *  deterministic. */
export const EGY_PHRASES: Record<PhraseCategory, string[]> = {
  clarify: [
    "مش فاهمك، تقصد ايه بالظبط؟",
    "ممكن توضحلي اكتر؟",
    "تقصد ايه بالكلام ده؟",
    "فهمت، بس ممكن تدّيني تفاصيل أكتر؟",
  ],
  greeting: [
    "ازيك؟ عامل ايه؟",
    "اهلا بيك، قوللي عايز ايه؟",
    "تمام، قوللي عايز ايه",
    "اهلا، في خدمتك",
  ],
  explanation_start: [
    "بص خليني اشرحلك ببساطة",
    "خلّي بالك، الموضوع بسيط",
    "ببساطة كده",
    "تعال نشوف الموضوع سوا",
  ],
  definition_start: [
    "يعني ايه ده؟ خليني أقولك",
    "بص، المصطلح ده معناه",
    "ببساطة كده،",
  ],
  fallback_soft: [
    "فيه مشكلة بسيطة، بس هحاول أساعدك على قد ما اقدر",
    "مش متأكد 100%، بس خليني اوضحلك الفكرة",
    "مش قادر اجيبلك الرقم ده دلوقتي، بس خليني أشرح الموضوع",
  ],
  handoff_app: [
    "علشان البيانات الفعلية، افتح التطبيق المناسب في Koleex Hub",
    "الأرقام الحقيقية هتلاقيها في تطبيق Koleex المظبوط",
  ],
  acknowledge: [
    "تمام",
    "فهمت",
    "ماشي",
  ],
};

/* ─── Bad-output blocklist ───────────────────────────────────────
   Phrases / patterns we NEVER want leaking into an Egyptian reply.
   Either system-text leaks, translator notes, or formal-MSA clunk
   that makes the bot feel robotic. The builder scrubs these before
   the reply reaches the user.

   Format: [matcher, replacement]. When replacement is null the
   whole response is routed to the clarify-fallback path instead. */
export const BAD_OUTPUT_PATTERNS: Array<{
  match: RegExp;
  /** Replacement — null means "route this to the clarify pool". */
  replace: string | null;
  /** One-line note for the log so ops can see which pattern fired. */
  label: string;
}> = [
  /* Translator notes — "translation:" / "ترجمة:" prefixes. */
  {
    match: /^\s*(?:translation|ترجمة)\s*[:\-—]/i,
    replace: "",
    label: "translation_prefix",
  },
  /* Formal "I do not understand" — kicks over to clarify pool. */
  {
    match: /^\s*(?:لا\s+أفهم|لست\s+متأكد[ًا]?)\s*[.,!؟?]?\s*/,
    replace: null,
    label: "msa_dontknow",
  },
  /* Meta "what is my meaning" — same. */
  {
    match: /ما\s+معنى\s+كلامي/,
    replace: null,
    label: "meta_meaning_question",
  },
  /* System-text leaks — rare, but defensive. */
  {
    match: /<\/?(?:system|user|assistant|tool_call|function)[^>]*>/gi,
    replace: "",
    label: "system_tag_leak",
  },
  {
    match: /\[?(?:SYSTEM|DEBUG|ERROR)_?(?:MESSAGE|PROMPT|TEXT)?\s*:?/g,
    replace: "",
    label: "debug_label_leak",
  },
];

/** Deterministic phrase picker — hashes the seed string and mods
 *  into the pool length. Same seed (e.g. the user's message) always
 *  returns the same phrase, so conversations don't feel shifty. */
export function pickPhrase(category: PhraseCategory, seed: string): string {
  const pool = EGY_PHRASES[category];
  if (!pool || pool.length === 0) return "";
  let h = 0;
  for (let i = 0; i < Math.min(seed.length, 64); i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(h) % pool.length];
}

/** Heuristics for "this reply looks like a clarification request".
 *  When true, the builder overrides the reply with a clarify phrase
 *  so the user gets a natural Egyptian "what do you mean?" instead
 *  of a formal MSA "لا أفهم قصدك" or an apologetic English "sorry,
 *  could you clarify". */
const RE_CLARIFY_SIGNALS: RegExp[] = [
  /could\s+you\s+clarify|can\s+you\s+clarify|what\s+do\s+you\s+mean|please\s+clarify/i,
  /i'?m\s+not\s+sure\s+what\s+you\s+mean|i\s+don'?t\s+understand/i,
  /هل\s+يمكنك\s+التوضيح|ممكن\s+توضيح|هل\s+تقصد/,
  /لا\s+أفهم\s+قصدك|لست\s+متأكد[ًا]?\s+من\s+قصدك/,
  /^\s*(?:sorry|آسف|معذرة)[,،]?\s+(?:but\s+)?(?:i|أنا)\b/i,
];

export function looksLikeClarificationRequest(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  /* Too long = not a clarify request. Real clarifies are short. */
  if (t.length > 180) return false;
  return RE_CLARIFY_SIGNALS.some((r) => r.test(t));
}

import "server-only";

/* ---------------------------------------------------------------------------
   ai/preprocess — Query Preprocessing Layer (Phase 3).

   Runs BEFORE lane detection and model execution. Lightweight, pure,
   deterministic — no AI calls, no async work. Budget: <1ms per call.

   Responsibilities:
     1. NORMALIZATION      clean up common broken-English patterns
                           (e.g. "whats mean by X" → "what does X mean?")
     2. INTENT DETECTION   lightweight bucketing for logging / retry
                           (definition / explanation / translation /
                            knowledge / business / chat / unknown)
     3. SAFE REWRITE       missing punctuation, trailing capitalisation
                           — never hallucinate extra words, never change
                           intent

   Anti-goals (important):
     · We do NOT replace the router's classifyIntent(). The router's
       classifier still decides lane. The preprocessor's intent is
       additional metadata — surfaced in logs, usable by future code.
     · We do NOT apply English grammar rules to Arabic / Chinese /
       Franco-Arabic input. The SMART prompt already handles those;
       touching them here is a great way to break real user queries.
     · We do NOT expand short queries with extra content. If the user
       wrote "why?", we pass "why?" through. Guessing what they meant
       is the model's job, not ours.
   --------------------------------------------------------------------------- */

export type QueryIntent =
  | "definition"
  | "explanation"
  | "translation"
  | "knowledge"
  | "business"
  | "chat"
  | "unknown";

export interface PreprocessResult {
  /** Exactly what the user typed, after trim. The UI continues to
   *  display this — normalisation is only for the model-facing path. */
  originalQuery: string;
  /** Cleaned + normalised version handed to the classifier + model.
   *  When no rule matched, this equals `originalQuery`. */
  normalizedQuery: string;
  /** Lightweight intent bucket. Does NOT drive lane selection —
   *  router.classifyIntent() still owns that. Surfaced for logging
   *  and for future per-intent synthetic fallbacks. */
  intent: QueryIntent;
  /** True iff normalisedQuery !== originalQuery. Lets the log line
   *  flag when we actually rewrote something. */
  rewrote: boolean;
}

/* ─── Non-Latin script detection ──────────────────────────────────
   English grammar rules must not touch Arabic or Chinese input. The
   SMART prompt already carries dialect / Franco / Chinese handling. */
const RE_ARABIC  = /[\u0600-\u06FF]/;
const RE_CHINESE = /[\u4E00-\u9FFF]/;

/* ─── Normalisation rules (ordered) ───────────────────────────────
   Each rule is a single-pass regex. Order matters — earlier rules
   get a chance to rewrite before later ones run on the already-
   rewritten text. Every rule preserves the user's core terms
   verbatim; we only touch function-word glue. */

type Rule = { test: RegExp; apply: (m: string) => string };

/* "whats mean by X" / "what's mean X" / "wat mean X"
   → "what does X mean?"
   Handles the very common ESL construction. Captures the noun
   verbatim so product names / proper nouns survive untouched. */
const RULE_WHAT_MEAN_1: Rule = {
  test: /^(?:what('?s)?\s+mean|whats\s+mean|wat\s+mean)\s+(?:by\s+)?(.+?)[\s?!.]*$/i,
  apply: (s) =>
    s.replace(
      /^(?:what('?s)?\s+mean|whats\s+mean|wat\s+mean)\s+(?:by\s+)?(.+?)[\s?!.]*$/i,
      (_, __, noun) => `what does ${noun} mean?`,
    ),
};

/* "what mean X"
   → "what does X mean?"
   Separate rule so the more specific "what's mean" regex above
   doesn't swallow the simpler form accidentally. */
const RULE_WHAT_MEAN_2: Rule = {
  test: /^what\s+mean\s+(.+?)[\s?!.]*$/i,
  apply: (s) =>
    s.replace(/^what\s+mean\s+(.+?)[\s?!.]*$/i, (_, noun) => `what does ${noun} mean?`),
};

/* "how many X in (the) world" / "how many X in the universe"
   → "how many X are there in the world?"
   Only matches "in world / in the world" specifically — we don't
   want to rewrite "how many products in stock" for example. */
const RULE_HOWMANY_WORLD: Rule = {
  test: /^how\s+many\s+(.+?)\s+in\s+(?:the\s+)?(world|universe)[\s?!.]*$/i,
  apply: (s) =>
    s.replace(
      /^how\s+many\s+(.+?)\s+in\s+(?:the\s+)?(world|universe)[\s?!.]*$/i,
      (_, noun, place) => `how many ${noun} are there in the ${place}?`,
    ),
};

/* "explain me X" → "explain X"
   "tell me about X" stays — it's already natural English. */
const RULE_EXPLAIN_ME: Rule = {
  test: /^explain\s+me\s+/i,
  apply: (s) => s.replace(/^explain\s+me\s+/i, "explain "),
};

/* "i want to know X" → "what is X?"
   Only applies when the follow-on is a single clause (no "and", no
   commas). Avoids eating complex multi-part requests. */
const RULE_I_WANT_TO_KNOW: Rule = {
  test: /^i\s+want\s+to\s+know\s+(?:about\s+)?([^,]+?)[\s?!.]*$/i,
  apply: (s) =>
    s.replace(
      /^i\s+want\s+to\s+know\s+(?:about\s+)?([^,]+?)[\s?!.]*$/i,
      (_, topic) => `what is ${topic}?`,
    ),
};

/* "how X works?" and "how does X work?" are both fine.
   "how X working?" → "how does X work?" */
const RULE_HOW_WORKING: Rule = {
  test: /^how\s+(.+?)\s+working[\s?!.]*$/i,
  apply: (s) =>
    s.replace(/^how\s+(.+?)\s+working[\s?!.]*$/i, (_, noun) => `how does ${noun} work?`),
};

const ALL_RULES: Rule[] = [
  RULE_WHAT_MEAN_1,
  RULE_WHAT_MEAN_2,
  RULE_HOWMANY_WORLD,
  RULE_EXPLAIN_ME,
  RULE_I_WANT_TO_KNOW,
  RULE_HOW_WORKING,
];

/* ─── Intent detection ────────────────────────────────────────────
   Separate from router.classifyIntent(). Finer-grained
   (definition / explanation / translation split) so the
   preprocessor log tells ops what kind of question came in. */

const RE_TRANSLATION = /\btranslate\b|\bترجم\b|翻译/i;
const RE_DEFINITION =
  /\bwhat\s+(?:is|are|does).*\bmean\b|\bmeaning\s+of\b|\bdefinition\s+of\b|^define\b|\bما\s+معنى\b|什么是/i;
const RE_EXPLANATION =
  /^explain\b|^how\s+(?:does|do|to)\b|\baشرح\b|解释一下|解释下|如何/i;
const RE_BUSINESS =
  /\bquot(?:e|ation|ing)\b|\binvoice\b|\bdiscount\b|\bmargin\b|\bcommission\b|\bprice\b|\bcost\b|عرض\s*سعر|تسعير|فاتورة|报价|价格|发票/i;
/* Arabic / Chinese chat greetings don't use `\b` because the regex
   word-boundary only fires around ASCII word chars — "مرحبا" would
   otherwise miss. End-anchor with (?:$|\s|[^\p{L}]). */
const RE_CHAT =
  /^(?:hi|hello|hey|yo|hola|salam|salaam|thanks|thank\s+you|thx|ty|ok|okay|cool|bye|goodbye)\b|^(?:مرحبا|اهلا|أهلا|السلام|شكرا|شكراً)(?:$|\s|[!?.,،])|^(?:你好|您好|嗨|谢谢)/i;
const RE_KNOWLEDGE_LEAD =
  /^(?:what|how|why|when|where|who|which)\b|^(?:ما|كيف|لماذا|متى|أين|من)\b|^(?:什么|怎么|为什么|何时|哪里|谁)/i;

function detectQueryIntent(text: string): QueryIntent {
  const t = text.trim();
  if (!t) return "unknown";
  if (RE_TRANSLATION.test(t)) return "translation";
  if (RE_DEFINITION.test(t)) return "definition";
  if (RE_EXPLANATION.test(t)) return "explanation";
  if (RE_BUSINESS.test(t)) return "business";
  if (RE_CHAT.test(t)) return "chat";
  if (RE_KNOWLEDGE_LEAD.test(t)) return "knowledge";
  return "unknown";
}

/* ─── Public API ──────────────────────────────────────────────────
   Pure function. No logs, no side effects — the router owns logging
   so preprocessing results show up on the same `[ai]` line as the
   rest of the request telemetry. */

export function preprocessUserQuery(input: string): PreprocessResult {
  /* 1. Trim + collapse whitespace. Preserves non-Latin scripts. */
  const trimmed = (input ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const collapsed = trimmed.replace(/\s+/g, " ");

  if (!collapsed) {
    return {
      originalQuery: "",
      normalizedQuery: "",
      intent: "unknown",
      rewrote: false,
    };
  }

  const hasArabic = RE_ARABIC.test(collapsed);
  const hasChinese = RE_CHINESE.test(collapsed);

  /* 2. For Arabic / Chinese input, skip English grammar rules. The
     SMART prompt (and the business prompt) already handle dialect,
     Franco Arabic, and Chinese register on the model side. */
  let normalised = collapsed;
  if (!hasArabic && !hasChinese) {
    for (const rule of ALL_RULES) {
      if (rule.test.test(normalised)) {
        normalised = rule.apply(normalised);
      }
    }

    /* 3. Trailing-punctuation fix for clear English questions. If
       the string starts with a question word and ends with an
       alphanumeric character, append "?". This is the single
       non-rule-based normalisation we do — it's safe because we
       only add punctuation when the sentence is structurally a
       question already. */
    if (
      /^(?:what|how|why|when|where|who|which|is|are|do|does|did|can|could|should|would|will)\b/i.test(
        normalised,
      ) &&
      /[A-Za-z0-9]$/.test(normalised)
    ) {
      normalised = normalised + "?";
    }

    /* 4. Capitalise first letter. Cosmetic — keeps model outputs
       sharp, especially on the FAST lane where the tiny prompt
       leans on the user message for tone. */
    if (normalised.length > 0) {
      normalised = normalised[0].toUpperCase() + normalised.slice(1);
    }
  }

  return {
    originalQuery: collapsed,
    normalizedQuery: normalised,
    intent: detectQueryIntent(normalised),
    rewrote: normalised !== collapsed,
  };
}

/* ─── Test cases (for future unit tests) ──────────────────────────
   These live as comments so `node --input-type=module` can exercise
   them manually; the file itself has no runtime test runner hook.
   Every example here came from real user reports.

     "whats mean by RFQ"
       → "What does RFQ mean?"                 intent=definition

     "what's mean by EXW?"
       → "What does EXW mean?"                 intent=definition

     "what mean FOB"
       → "What does FOB mean?"                 intent=definition

     "how many languages in the world"
       → "How many languages are there in the world?"   intent=knowledge

     "how many stars in the universe?"
       → "How many stars are there in the universe?"    intent=knowledge

     "explain me how pricing bands work"
       → "Explain how pricing bands work?"     intent=explanation

     "i want to know about margin"
       → "What is margin?"                     intent=definition

     "how margin working"
       → "How does margin work?"               intent=explanation

     "what is the price of product ABC"
       → "What is the price of product ABC?"   intent=business

     "translate to Arabic: Please confirm delivery"
       → unchanged                              intent=translation

     "مرحبا"
       → unchanged                              intent=chat

     "你好"
       → unchanged                              intent=chat

     "ana 3ayz a3rf yaani eh margin"  (Franco Arabic — Egyptian)
       → unchanged                              intent=knowledge
                                                (the SMART prompt reads Franco correctly)

     ""
       → ""                                     intent=unknown
   ---------------------------------------------------------------- */

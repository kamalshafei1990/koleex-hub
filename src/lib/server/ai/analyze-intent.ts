import "server-only";

/* ---------------------------------------------------------------------------
   ai/analyze-intent — Phase 5 intent + complexity + format analyser.

   Richer downstream pair for the Phase 3 preprocessor. preprocess.ts
   emits a 7-bucket QueryIntent for routing / logging; analyzeIntent
   emits the 3-bucket IntentType the prompt builder uses to pick a
   response shape — plus complexity + expectedFormat so the prompt
   can tell the model whether to keep the reply to one sentence or
   structure it with a summary + bullets.

   Pure, deterministic, regex-based. No dependency on preprocess.ts —
   the router calls both and combines results in enrichedCtx.
   --------------------------------------------------------------------------- */

export type IntentType =
  | "definition"
  | "explanation"
  | "translation"
  | "chat"
  | "business";

export type Complexity = "simple" | "medium" | "deep";

export type ExpectedFormat = "short" | "structured" | "detailed";

export interface IntentAnalysis {
  type: IntentType;
  complexity: Complexity;
  expectedFormat: ExpectedFormat;
}

/* ─── Type detection ─────────────────────────────────────────────
   Ordered — more specific first. Translation is unambiguous when
   the marker is present, so it wins over generic "what is" patterns
   that might otherwise mis-route e.g. "translate what is X". */

const RE_TRANSLATION = /\btranslate\b|\bترجم\b|翻译/i;

const RE_DEFINITION =
  /\bwhat\s+(?:is|are|does).*\bmean\b|\bmeaning\s+of\b|\bdefinition\s+of\b|^define\b|\b\w+\s+definition\s*\??$|\bwhat\s+does\s+[\w\s]+\s+stand\s+for\b|ما\s+(?:هو|هي|معنى)\s+|يعني\s+ايه\s+|什么是/i;

const RE_EXPLANATION =
  /^(?:please\s+)?explain\b|^how\s+(?:does|do|to)\b|\bاشرح\b|解释|如何/i;

const RE_BUSINESS =
  /\bquot(?:e|ation|ing)\b|\binvoice\b|\bdiscount\b|\bmargin\b|\bcommission\b|\bprice\s+(?:of|for|list|per)\b|\bcost\s+(?:of|for|breakdown)\b|\bpricing\s+(?:strategy|plan|band|engine|breakdown)\b|\blanded\s+cost\b|\bfob\b|\bcif\b|\bexw\b|عرض\s*سعر|تسعير|فاتورة|خصم|هامش|عمولة|报价|价格|发票|折扣|佣金/i;

const RE_CHAT =
  /^(?:hi|hello|hey|yo|hola|salam|salaam|thanks|thank\s+you|thx|ty|ok|okay|cool|bye|goodbye|how\s+are\s+you)\b|^(?:مرحبا|اهلا|أهلا|السلام|شكرا|شكراً|ازيك|عامل\s+ايه)|^(?:你好|您好|嗨|谢谢)/i;

/* "What is/are X" reads as a DEFINITION question by default —
   except when X explicitly references a commercial figure (price,
   cost, total, commission amount, etc.), in which case it's really
   a business question asking for a number. This exclusion list
   keeps "what is margin?" → definition while "what is the price
   of product ABC?" → business. */
const RE_DEF_FALLBACK =
  /^what\s+(?:is|are)\s+(?:an?\s+|the\s+)?(?!.*\b(?:price|cost|total|amount|value|rate|discount\s+for|commission\s+for|margin\s+for|quot(?:e|ation)\s+for)\b).+\??$/i;

function detectType(text: string): IntentType {
  if (!text) return "chat";
  if (RE_TRANSLATION.test(text)) return "translation";
  if (RE_DEFINITION.test(text))  return "definition";
  if (RE_EXPLANATION.test(text)) return "explanation";

  /* "what is X" fallback runs BEFORE the business regex so single-
     noun definition questions about commercial terms ("what is
     margin?", "what is a quotation?") stay on the definition
     template instead of flipping to business. */
  if (RE_DEF_FALLBACK.test(text)) return "definition";

  if (RE_BUSINESS.test(text))    return "business";
  if (RE_CHAT.test(text))        return "chat";
  if (/^(?:why|when|where|who|which)\b/i.test(text)) return "explanation";
  return "chat";
}

/* ─── Complexity ────────────────────────────────────────────────
   Rule of thumb: longer question + analytical verbs → deeper answer
   needed. Keep thresholds conservative — "medium" is the default for
   any non-chat / non-definition query. */
const DEEP_MARKERS =
  /\b(?:strategy|strategies|strategic|compare|comparison|analysis|analyze|analyse|framework|approach|approaches|roadmap|optimi[sz]e|best\s+practice|trade[-\s]?offs?)\b/i;

function detectComplexity(text: string, type: IntentType): Complexity {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (type === "chat") return "simple";
  if (type === "definition") return "simple";
  if (type === "translation") return words > 40 ? "medium" : "simple";
  /* explanation / business */
  if (DEEP_MARKERS.test(text) || words > 25) return "deep";
  if (words > 12) return "medium";
  return "simple";
}

/* ─── Expected format ──────────────────────────────────────────
   Maps (type, complexity) → the response shape the prompt builder
   should request. "short" = 1–2 sentences; "structured" = summary +
   bullets; "detailed" = thorough prose. */
function detectFormat(type: IntentType, complexity: Complexity): ExpectedFormat {
  if (type === "chat") return "short";
  if (type === "translation") return "short";
  if (type === "definition") {
    return complexity === "deep" ? "structured" : "short";
  }
  /* explanation / business */
  if (complexity === "deep") return "detailed";
  if (complexity === "medium") return "structured";
  return "structured";
}

/* ─── Public API ─────────────────────────────────────────────── */

export function analyzeIntent(query: string): IntentAnalysis {
  const q = (query ?? "").trim();
  const type = detectType(q);
  const complexity = detectComplexity(q, type);
  const expectedFormat = detectFormat(type, complexity);
  return { type, complexity, expectedFormat };
}

/* ─── Test cases (for reference) ─────────────────────────────────
     "What is margin?"                       → definition / simple / short
     "Explain margin"                        → explanation / simple / structured
     "Explain how pricing bands work for distributors across multiple markets"
                                             → explanation / deep / detailed
     "Translate this to Chinese"             → translation / simple / short
     "Hello"                                 → chat / simple / short
     "Pricing strategy for distributors"     → business / deep / detailed
     "What is the price of product ABC?"     → business / simple / structured
     "Compare FOB vs CIF"                    → business / deep / detailed
     "How do I create a quotation?"          → explanation / simple / structured
     "ما معنى الهامش؟"                        → definition / simple / short
     "بص عايز اعرف يعني ايه margin"            → business / medium / structured
     "How are you?"                          → chat / simple / short
   ---------------------------------------------------------------- */

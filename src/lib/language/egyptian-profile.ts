/* ---------------------------------------------------------------------------
   lib/language/egyptian-profile — Phase 11 Egyptian Arabic persona.

   Source of truth for the Egyptian dialect rewriter and the Franco
   converter. Pure constants + a small whitelist; no runtime logic.

   Tone
     Friendly, conversational, explains-like-a-colleague. Not
     diminutive. Never dumbs the content down — just rephrases to
     feel natural instead of textbook.

   Replacements
     Formal MSA phrase / word  →  Egyptian equivalent.
     Applied at word boundaries only so compound Arabic words like
     "الإبهام" stay intact while "هذا" becomes "ده".

   Connectors
     Short Egyptian sentence openers. The rewriter may prepend one
     when a model reply lands with a stiff MSA opening (and only
     when the reply doesn't already start with a natural Egyptian
     phrase, to avoid doubling up).

   Preserve list
     Technical terms, product codes, Incoterms, acronyms, brand
     names — these NEVER get rewritten or transliterated. If a
     rewrite rule tries to touch them, the safety layer in
     rewriteToEgyptian rejects the change.
   --------------------------------------------------------------------------- */

export type EgyptianTone = "friendly" | "formal" | "casual";

/** Egyptian connectors — sentence openers the rewriter may prepend.
 *  Kept short; anything longer stops feeling like natural dialect. */
export const CONNECTORS = [
  "بص",
  "يعني",
  "خلّي بالك",
  "ببساطة",
  "مثال بسيط",
] as const;

/** Ordered replacements — longer keys first so "على سبيل المثال" wins
 *  over accidental "المثال"-only matches. The rewriter iterates this
 *  list in order and applies each with Arabic word-boundary anchors.
 *  Add conservatively: one wrong mapping in production can change
 *  meaning for thousands of replies. */
export const REPLACEMENTS: Array<[from: string, to: string]> = [
  ["على سبيل المثال", "مثال بسيط"],
  ["يؤدي إلى", "بيخلي"],
  ["من خلال", "عن طريق"],
  ["ما هو", "يعني ايه"],
  ["ما هي", "يعني ايه"],
  ["لذلك", "علشان كده"],
  ["بسبب", "علشان"],
  ["يمكن", "ممكن"],
  ["يتم", "بيتم"],
  ["هذه", "دي"],
  ["هذا", "ده"],
];

/** Preserve list — technical / brand / Incoterm / unit terms that
 *  must NEVER be rewritten. Lowercase comparison; the rewriter and
 *  Franco converter both honour this. Add new terms only when
 *  they're unambiguous commerce-language. */
export const PRESERVE_TERMS: ReadonlySet<string> = new Set([
  // Commerce
  "margin", "profit", "markup", "discount", "commission",
  "invoice", "quotation", "quote", "rfq", "po",
  "fob", "cif", "exw", "cogs", "landed",
  // Koleex
  "koleex", "koleex-hub", "hub", "ai",
  // Tech acronyms often used mid-sentence
  "erp", "crm", "api", "sdk", "sso", "url", "uri",
  "sku", "isbn", "eu", "us", "uk", "uae",
  // Units
  "kg", "g", "mg", "lb", "ml", "l", "m", "cm", "mm",
  "usd", "eur", "gbp", "sar", "aed", "egp", "cny",
  // Common English
  "ok", "okay", "yes", "no",
]);

/** Optional Franco "English technical term" detector. Used by the
 *  Franco converter — a lowercase token that matches one of these
 *  should stay in Latin script rather than being transliterated. */
export function isPreservedTerm(token: string): boolean {
  return PRESERVE_TERMS.has(token.toLowerCase());
}

/** Egyptian persona bundle exposed for callers that want the whole
 *  profile at once (logs, telemetry, tests). */
export const EGY_PROFILE = {
  tone: "friendly" as EgyptianTone,
  connectors: CONNECTORS,
  replacements: Object.fromEntries(REPLACEMENTS) as Record<string, string>,
  preserveTerms: Array.from(PRESERVE_TERMS),
} as const;

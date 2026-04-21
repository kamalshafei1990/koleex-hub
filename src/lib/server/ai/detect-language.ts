import "server-only";

/* ---------------------------------------------------------------------------
   ai/detect-language — Phase 4 language + dialect detector.

   Runs AFTER preprocessUserQuery() and BEFORE prompt build. The
   detected language decides which persona the model adopts — a
   casual Egyptian Arabic reply for Egyptian dialect input, formal
   MSA for formal Arabic, professional English for English, etc.
   Franco Arabic ("ana 3ayz a3rf") collapses into the Egyptian
   persona so replies come back in proper Arabic script.

   Pure, deterministic, regex-based. No AI calls. Budget: <0.5ms.

   Output types:
     EN       — English
     AR       — Formal / Modern Standard Arabic
     EGY      — Egyptian Arabic (dialect)
     ZH       — Simplified Chinese
     FRANCO   — Arabizi (Arabic written with Latin letters + digits)

   Anti-goal: do not attempt to detect every dialect (Levantine,
   Maghrebi, Khaleeji, etc.). The SMART prompt's dialect-mirroring
   rule handles those on the model side. We only call out Egyptian
   specifically because it's by far the most common dialect in
   Koleex's user base.
   --------------------------------------------------------------------------- */

export type DetectedLang = "EN" | "AR" | "EGY" | "ZH" | "FRANCO";

export interface LanguageDetection {
  language: DetectedLang;
  /** 0..1. ≥0.8 = strong signal; 0.5..0.8 = likely; <0.5 = default/guess. */
  confidence: number;
}

/* ─── Script ranges ─────────────────────────────────────────────── */
const RE_ARABIC_CHAR  = /[\u0600-\u06FF]/g;
const RE_CHINESE_CHAR = /[\u4E00-\u9FFF]/g;
const RE_LATIN_CHAR   = /[A-Za-z]/g;

/* ─── Egyptian Arabic dialect markers ───────────────────────────────
   Words + short phrases that almost never appear in formal MSA but
   are extremely common in Egyptian Arabic (Cairene register). One
   match is usually enough; we count matches to build confidence. */
/* Arabic word boundaries: \b only fires between ASCII word chars.
   We anchor tokens using lookarounds that treat anything that isn't
   an Arabic LETTER as a boundary. The exclusion must be letters
   only (U+0621–064A, U+0670–06D3, U+06FA–06FF) — if we used the
   whole 0600–06FF block, Arabic punctuation like ؟ U+061F would
   count as a letter and break the right-boundary match. */
const AR_LETTERS = "\\u0621-\\u064A\\u0670-\\u06D3\\u06FA-\\u06FF";
const AR_LB = `(?<=^|[^${AR_LETTERS}])`;
const AR_RB = `(?=$|[^${AR_LETTERS}])`;
const egy = (body: string): RegExp => new RegExp(AR_LB + body + AR_RB);

const EGY_MARKERS: RegExp[] = [
  egy("عامل\\s+ايه"),       // how are you (Egy)
  egy("ازيك"), egy("إزيك"), // hi (Egy)
  egy("إزاي"), egy("ازاي"), // how
  egy("عايز"), egy("عايزة"), // want
  egy("كده"), egy("كدا"),   // like this
  egy("ليه"),                // why (Egy)
  egy("فين"),                // where (Egy)
  egy("دلوقتي"),             // now
  egy("يا\\s*باشا"),         // hey boss (colloquial)
  egy("بقى"),                // well / then
  egy("خالص"),               // at all
  egy("أوي"), egy("اوي"),    // very
  egy("يعني"),               // meaning / like
  egy("امبارح"),             // yesterday (Egy)
  egy("لسه"),                // still
  egy("يا\\s*(?:م|ا)عل(?:م|ى)"), // ya m3alim / ya osta
  egy("حاجة"), egy("حاجه"),  // thing (Egy-marked spelling)
  egy("تعالى"),              // come (Egy imperative)
  egy("متقلقش"),             // don't worry
  egy("مش"),                 // not (Egy/Levantine)
  egy("بص"),                 // look (Egy)
];

/* ─── Franco Arabic (Arabizi) markers ───────────────────────────────
   Franco is Arabic written with Latin letters + numerals standing in
   for Arabic sounds that have no Latin equivalent:
     3 → ع    7 → ح    2 → ء    5/'7 → خ    6 → ط    9 → ص
   Detection strategy (two independent signals, either is enough):
     · franco-digit — a mid-word numeral (2/3/5/6/7/9) in an otherwise
       alphabetic token, e.g. "3ayz", "a3rf", "m7tag", "6ab", "ma9ary"
     · franco-keyword — one of a short whitelist of Arabizi words that
       are effectively never valid English
   The whitelist includes Egyptian, Levantine, and Gulf spellings so
   we catch Franco regardless of the writer's background — but we
   always respond in Egyptian Arabic per the spec. */
const FRANCO_DIGIT = /\b[a-z]*[23567][a-z]+\b|\b[a-z]+[23567][a-z]*\b/i;
const FRANCO_KEYWORDS = new RegExp(
  "\\b(?:" +
    [
      // pronouns / copulas
      "ana", "enta", "enti", "inta", "inti", "e7na", "ehna", "e7na",
      "howwa", "heyya",
      // wanting / asking
      "3ayz", "3ayza", "3ayez", "3aiza", "3aiz",
      "3aref", "3arif", "a3rf", "a3raf", "a3rafsh",
      "ba3ref", "b3ref",
      // how / where / what / why
      "izay", "ezay", "izzay", "ezzay", "izayak", "ezayek",
      "fen", "fein", "feen",
      "leh", "leeh",
      "eh", "ay",
      // dialect fillers
      "yaani", "ya3ni", "yani",
      "mesh", "mish", "msh",
      "kda", "keda", "kida", "kidda",
      "5alas", "5allas", "khalas", "5alli", "5ali",
      // common verbs / adjectives
      "ta3ala", "ta3al",
      "habibi", "7abibi", "7abiby",
      "momken", "mumken", "mumkin",
      "inshallah", "inshaAllah",
      "mafish", "mafesh", "mafeesh",
      "lazem", "lazm", "lazim",
      "3amel", "3amla", "3amal",
      // question openers
      "ezayak", "ezayik", "izayak",
      "so2al", "so2alak", "so2aly",
      "2oul", "2oulli", "2ololy",
      // common nouns
      "7aga", "haga", "5er",
      "3ala", "3al",
      "ba3d", "ba3dy",
    ].join("|") +
    ")\\b",
  "i",
);

/* ─── Confidence helpers ─────────────────────────────────────────── */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* ─── Public API ─────────────────────────────────────────────────── */

export function detectLanguage(input: string): LanguageDetection {
  const s = (input ?? "").trim();
  if (!s) return { language: "EN", confidence: 0 };

  const arabic  = (s.match(RE_ARABIC_CHAR)  || []).length;
  const chinese = (s.match(RE_CHINESE_CHAR) || []).length;
  const latin   = (s.match(RE_LATIN_CHAR)   || []).length;
  const total   = arabic + chinese + latin;
  if (total === 0) {
    /* Numbers / punctuation / emoji only — default to EN with low
       confidence so downstream can fall back to UI locale if set. */
    return { language: "EN", confidence: 0.2 };
  }

  /* ── Chinese ───────────────────────────────────────────────────── */
  if (chinese / total >= 0.3) {
    return {
      language: "ZH",
      confidence: clamp01(chinese / total + 0.2),
    };
  }

  /* ── Arabic script dominant → AR or EGY ────────────────────────── */
  if (arabic / total >= 0.3) {
    let egyHits = 0;
    for (const r of EGY_MARKERS) if (r.test(s)) egyHits++;
    if (egyHits >= 1) {
      /* Egyptian. Confidence scales with marker density — a single
         marker is enough to route to the Egyptian persona; multiple
         markers push us above 0.9. */
      const conf = clamp01(0.75 + 0.1 * (egyHits - 1));
      return { language: "EGY", confidence: conf };
    }
    return {
      language: "AR",
      confidence: clamp01(arabic / total + 0.2),
    };
  }

  /* ── Latin script dominant → EN or FRANCO ──────────────────────── */
  if (latin / total >= 0.3) {
    const hasDigitToken = FRANCO_DIGIT.test(s);
    const hasKeyword = FRANCO_KEYWORDS.test(s);
    if (hasDigitToken || hasKeyword) {
      /* Confidence: both signals → 0.95; either alone → 0.7-0.8. */
      const conf = clamp01(
        (hasDigitToken ? 0.5 : 0) +
          (hasKeyword ? 0.4 : 0) +
          0.15,
      );
      return { language: "FRANCO", confidence: conf };
    }
    return {
      language: "EN",
      confidence: clamp01(latin / total + 0.2),
    };
  }

  /* Mixed short input with no dominant script — default EN low-conf. */
  return { language: "EN", confidence: 0.3 };
}

/* ─── Test cases (kept as comments for reference) ────────────────
     "hello how are you"              → EN  ≥0.8
     "مرحبا كيف حالك"                  → AR  ≥0.8
     "عامل ايه يا باشا"                 → EGY ≥0.85
     "ana 3ayz a3rf"                   → FRANCO ≥0.9 (digit + keyword)
     "ana fahem"                       → FRANCO ~0.55 (keyword only)
     "I want 3 items"                  → EN  (digit not in word-middle
                                            of alpha token)
     "你好"                             → ZH  ≥0.8
     "请问"                             → ZH  ≥0.8
     "What is 价格?"                    → EN  (Latin dominant)
     "ازيك؟"                           → EGY ≥0.8
     "ما هو السعر؟"                     → AR  ≥0.8
     ""                                → EN  0
   ---------------------------------------------------------------- */

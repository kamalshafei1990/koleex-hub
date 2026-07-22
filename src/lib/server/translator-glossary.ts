import "server-only";

/* ---------------------------------------------------------------------------
   Translator glossary — makes the Hub's translator speak KOLEEX, not generic
   business English.

   Two jobs, both applied as a short instruction appended to the translation
   prompt:

     1. PROTECT identifiers. Model codes, SKUs and part numbers must survive a
        translation byte-for-byte. Left alone, a model will happily "translate"
        XSL-2200 into a localised string, transcribe it into another script, or
        helpfully insert a space. Any of those breaks a quotation.

     2. FIX industrial vocabulary. Garment-machinery terms are exactly where a
        general-purpose model drifts: "lockstitch" becomes 锁边 (which is
        actually overlock), "feed dog" becomes a literal dog. The table below
        pins the terms KOLEEX actually sells to the words the factories use.

   Deliberately NO database table. The term list is company vocabulary that
   belongs in the codebase (reviewable, versioned, no migration), and the code
   protection is a pattern — so this costs zero queries per translation.

   Only terms PRESENT in the source text are sent to the model, so the prompt
   stays small no matter how long the glossary grows.
   --------------------------------------------------------------------------- */

/** Identifier shapes that must be reproduced verbatim.
    Kept conservative: over-matching would freeze ordinary words. */
const CODE_PATTERNS: RegExp[] = [
  /\b[A-Z]{2,5}-\d{2,5}(?:-[A-Z0-9]{1,4})?\b/g,   // XSL-2200, KX-2291-A
  /\b[A-Z]{2,5}\d{3,5}[A-Z]?\b/g,                  // GC6180, DDL8700
  /\b\d{2,4}[A-Z]{1,3}-?\d{0,4}\b/g,               // 8700B, 20U33
];

/** Industrial sewing / garment machinery vocabulary.
    en → the term the trade actually uses in each language. Add rows freely;
    only matched terms reach the model. */
const INDUSTRY_TERMS: Array<{ en: string; zh?: string; ar?: string }> = [
  { en: "lockstitch",            zh: "平缝",       ar: "غرزة مقفلة" },
  { en: "overlock",              zh: "包缝",       ar: "سرفلة" },
  { en: "interlock",             zh: "绷缝",       ar: "غرزة متشابكة" },
  { en: "chainstitch",           zh: "链式线迹",   ar: "غرزة سلسلة" },
  { en: "coverstitch",           zh: "覆盖缝",     ar: "غرزة تغطية" },
  { en: "blindstitch",           zh: "暗缝",       ar: "غرزة خفية" },
  { en: "bartack",               zh: "打枣",       ar: "تثبيت" },
  { en: "buttonhole",            zh: "锁眼",       ar: "عروة" },
  { en: "button attaching",      zh: "钉扣",       ar: "تثبيت الأزرار" },
  { en: "feed dog",              zh: "送布牙",     ar: "أسنان التغذية" },
  { en: "presser foot",          zh: "压脚",       ar: "قدم الضاغط" },
  { en: "needle plate",          zh: "针板",       ar: "لوحة الإبرة" },
  { en: "rotary hook",           zh: "旋梭",       ar: "الخطاف الدوار" },
  { en: "bobbin",                zh: "梭芯",       ar: "بكرة" },
  { en: "direct drive",          zh: "直驱",       ar: "دفع مباشر" },
  { en: "servo motor",           zh: "伺服电机",   ar: "محرك سيرفو" },
  { en: "spreading machine",     zh: "拉布机",     ar: "ماكينة الفرد" },
  { en: "cutting machine",       zh: "裁剪机",     ar: "ماكينة القص" },
  { en: "fusing machine",        zh: "粘合机",     ar: "ماكينة اللصق" },
  { en: "heat press",            zh: "热压机",     ar: "مكبس حراري" },
  { en: "steam iron",            zh: "蒸汽熨斗",   ar: "مكواة بخار" },
  { en: "feed off the arm",      zh: "缝合机",     ar: "تغذية من الذراع" },
  { en: "walking foot",          zh: "综合送料",   ar: "قدم متحركة" },
  { en: "throat plate",          zh: "喉板",       ar: "لوحة العنق" },
  { en: "stitch per minute",     zh: "针/分钟",    ar: "غرزة في الدقيقة" },
  { en: "needle bar",            zh: "针杆",       ar: "قضيب الإبرة" },
  { en: "thread trimmer",        zh: "剪线",       ar: "قاطع الخيط" },
];

/** Terms whose translation we pin, indexed for cheap lookup. */
const TERM_INDEX = INDUSTRY_TERMS.map((t) => ({
  ...t,
  needle: new RegExp(`\\b${t.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
}));

/** Identifiers found in the text, de-duplicated and capped. */
export function findProtectedCodes(text: string, max = 25): string[] {
  const found = new Set<string>();
  for (const re of CODE_PATTERNS) {
    // Fresh lastIndex each pass — these are /g regexes reused across calls.
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      found.add(m[0]);
      if (found.size >= max) return [...found];
    }
  }
  return [...found];
}

/**
 * Build the glossary instruction for one translation, or "" when nothing in
 * the text matches. Appended to the system prompt by /api/translator.
 */
export function buildGlossaryHint(text: string, target: string): string {
  const codes = findProtectedCodes(text);

  const terms = TERM_INDEX
    .filter((t) => t.needle.test(text))
    .map((t) => {
      const translated = target === "zh" ? t.zh : target === "ar" ? t.ar : undefined;
      return translated ? `${t.en} → ${translated}` : null;
    })
    .filter(Boolean) as string[];

  if (!codes.length && !terms.length) return "";

  const lines: string[] = ["", "KOLEEX glossary — these override your defaults:"];
  if (codes.length) {
    lines.push(
      `- Reproduce these identifiers EXACTLY, unchanged, in the original Latin characters: ${codes.join(", ")}. Never translate, transliterate, re-space or re-order them.`,
    );
  }
  if (terms.length) {
    lines.push(`- Use these industry translations: ${terms.join("; ")}.`);
  }
  return lines.join("\n");
}

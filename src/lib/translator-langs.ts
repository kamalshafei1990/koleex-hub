/* ---------------------------------------------------------------------------
   Translator languages — the 18 targets the Hub's provider supports.

   Kept in lockstep with TRANSLATE_LANG_NAMES in src/lib/server/ai-provider.ts
   (the server whitelist). Adding a language means adding it in BOTH places:
   the server decides what's translatable, this file decides what the picker
   shows and how each language is labelled in each UI language.

   `native` is what the language calls itself — shown as a subtitle so a
   Spanish speaker recognises "Español" even when the Hub UI is in English.
   `speech` is the BCP-47 tag for Web Speech (voice input + read-aloud).
   --------------------------------------------------------------------------- */

import type { Lang as UiLang } from "@/lib/i18n";

export interface TranslatorLanguage {
  code: string;
  native: string;
  speech: string;
  /** Display name per Hub UI language. */
  label: Record<UiLang, string>;
  /** Right-to-left script — the pane flips direction for these. */
  rtl?: boolean;
}

export const LANGUAGES: TranslatorLanguage[] = [
  { code: "en", native: "English",    speech: "en-US", label: { en: "English",    zh: "英语",       ar: "الإنجليزية" } },
  { code: "zh", native: "中文（简体）", speech: "zh-CN", label: { en: "Chinese (Simplified)", zh: "中文（简体）", ar: "الصينية (المبسطة)" } },
  { code: "ar", native: "العربية",    speech: "ar-SA", label: { en: "Arabic",     zh: "阿拉伯语",   ar: "العربية" }, rtl: true },
  { code: "es", native: "Español",    speech: "es-ES", label: { en: "Spanish",    zh: "西班牙语",   ar: "الإسبانية" } },
  { code: "fr", native: "Français",   speech: "fr-FR", label: { en: "French",     zh: "法语",       ar: "الفرنسية" } },
  { code: "de", native: "Deutsch",    speech: "de-DE", label: { en: "German",     zh: "德语",       ar: "الألمانية" } },
  { code: "ru", native: "Русский",    speech: "ru-RU", label: { en: "Russian",    zh: "俄语",       ar: "الروسية" } },
  { code: "pt", native: "Português",  speech: "pt-PT", label: { en: "Portuguese", zh: "葡萄牙语",   ar: "البرتغالية" } },
  { code: "tr", native: "Türkçe",     speech: "tr-TR", label: { en: "Turkish",    zh: "土耳其语",   ar: "التركية" } },
  { code: "ja", native: "日本語",      speech: "ja-JP", label: { en: "Japanese",   zh: "日语",       ar: "اليابانية" } },
  { code: "ko", native: "한국어",      speech: "ko-KR", label: { en: "Korean",     zh: "韩语",       ar: "الكورية" } },
  { code: "hi", native: "हिन्दी",       speech: "hi-IN", label: { en: "Hindi",      zh: "印地语",     ar: "الهندية" } },
  { code: "ur", native: "اردو",       speech: "ur-PK", label: { en: "Urdu",       zh: "乌尔都语",   ar: "الأردية" }, rtl: true },
  { code: "id", native: "Indonesia",  speech: "id-ID", label: { en: "Indonesian", zh: "印尼语",     ar: "الإندونيسية" } },
  { code: "vi", native: "Tiếng Việt", speech: "vi-VN", label: { en: "Vietnamese", zh: "越南语",     ar: "الفيتنامية" } },
  { code: "th", native: "ไทย",        speech: "th-TH", label: { en: "Thai",       zh: "泰语",       ar: "التايلاندية" } },
  { code: "pl", native: "Polski",     speech: "pl-PL", label: { en: "Polish",     zh: "波兰语",     ar: "البولندية" } },
  { code: "nl", native: "Nederlands", speech: "nl-NL", label: { en: "Dutch",      zh: "荷兰语",     ar: "الهولندية" } },

  /* ── Second wave ──────────────────────────────────────────────────────
     Ordered by how much Koleex actually needs them, not by speaker count:
     garment-manufacturing countries first, then Taiwan/HK for machinery,
     then European production and buyer markets. */
  { code: "zh-TW", native: "中文（繁體）", speech: "zh-TW", label: { en: "Chinese (Traditional)", zh: "中文（繁體）", ar: "الصينية (التقليدية)" } },
  { code: "bn", native: "বাংলা",       speech: "bn-BD", label: { en: "Bengali",    zh: "孟加拉语",   ar: "البنغالية" } },
  { code: "ta", native: "தமிழ்",        speech: "ta-IN", label: { en: "Tamil",      zh: "泰米尔语",   ar: "التاميلية" } },
  { code: "km", native: "ខ្មែរ",         speech: "km-KH", label: { en: "Khmer",      zh: "高棉语",     ar: "الخميرية" } },
  { code: "my", native: "မြန်မာ",       speech: "my-MM", label: { en: "Burmese",    zh: "缅甸语",     ar: "البورمية" } },
  { code: "si", native: "සිංහල",       speech: "si-LK", label: { en: "Sinhala",    zh: "僧伽罗语",   ar: "السنهالية" } },
  { code: "am", native: "አማርኛ",       speech: "am-ET", label: { en: "Amharic",    zh: "阿姆哈拉语", ar: "الأمهرية" } },
  { code: "uz", native: "Oʻzbekcha",  speech: "uz-UZ", label: { en: "Uzbek",      zh: "乌兹别克语", ar: "الأوزبكية" } },
  { code: "ms", native: "Bahasa Melayu", speech: "ms-MY", label: { en: "Malay",   zh: "马来语",     ar: "الماليزية" } },
  { code: "tl", native: "Filipino",   speech: "fil-PH", label: { en: "Filipino",  zh: "菲律宾语",   ar: "الفلبينية" } },
  { code: "sw", native: "Kiswahili",  speech: "sw-KE", label: { en: "Swahili",    zh: "斯瓦希里语", ar: "السواحيلية" } },
  { code: "fa", native: "فارسی",      speech: "fa-IR", label: { en: "Persian",    zh: "波斯语",     ar: "الفارسية" }, rtl: true },
  { code: "he", native: "עברית",      speech: "he-IL", label: { en: "Hebrew",     zh: "希伯来语",   ar: "العبرية" }, rtl: true },
  { code: "it", native: "Italiano",   speech: "it-IT", label: { en: "Italian",    zh: "意大利语",   ar: "الإيطالية" } },
  { code: "ro", native: "Română",     speech: "ro-RO", label: { en: "Romanian",   zh: "罗马尼亚语", ar: "الرومانية" } },
  { code: "bg", native: "Български",  speech: "bg-BG", label: { en: "Bulgarian",  zh: "保加利亚语", ar: "البلغارية" } },
  { code: "uk", native: "Українська", speech: "uk-UA", label: { en: "Ukrainian",  zh: "乌克兰语",   ar: "الأوكرانية" } },
  { code: "cs", native: "Čeština",    speech: "cs-CZ", label: { en: "Czech",      zh: "捷克语",     ar: "التشيكية" } },
  { code: "el", native: "Ελληνικά",   speech: "el-GR", label: { en: "Greek",      zh: "希腊语",     ar: "اليونانية" } },
];

export const LANG_BY_CODE: Record<string, TranslatorLanguage> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

/** Quick-pick languages shown as inline tabs (the rest live in the dropdown).
    Ordered by how often Koleex actually needs them. */
export const QUICK_SOURCE = ["en", "zh", "ar"];
export const QUICK_TARGET = ["en", "zh", "ar"];

export function langLabel(code: string, ui: UiLang): string {
  const l = LANG_BY_CODE[code];
  if (!l) return code;
  return l.label[ui] ?? l.label.en;
}

export function isRtl(code: string): boolean {
  return LANG_BY_CODE[code]?.rtl === true;
}

/* ── Source-language detection ────────────────────────────────────────────
   Runs client-side on every keystroke, so it must be instant and allocation-
   cheap — no network. Two stages:

     1. SCRIPT. Arabic/Chinese/Japanese/Korean/Cyrillic/Thai/Devanagari are
        unambiguous from their code blocks alone.
     2. LATIN DISAMBIGUATION. Nine of our languages share the Latin alphabet,
        so script alone said "English" for Spanish, French, German, Portuguese,
        Dutch, Polish, Turkish, Indonesian and Vietnamese — the label was
        simply wrong. Those are separated by scoring characteristic letters
        (ñ, ß, ğ, ł, ơ…) and high-frequency function words, which is what
        actually distinguishes them in short business text.

   This only drives the LABEL shown next to "Detect language". The provider
   still performs its own detection when translating with source "auto", so a
   wrong guess here can never produce a wrong translation.
   ------------------------------------------------------------------------ */

/** Function words that are common in ONE Latin language and rare in the
    others. Words shared across siblings (de/que/para — Spanish, Portuguese and
    French all use them) are deliberately excluded: they add noise and let the
    first-listed language win ties. Portuguese vs Spanish in particular hangs
    on do/da/dos/das vs del/la/los/las. Kept short — runs per keystroke. */
const LATIN_MARKERS: Record<string, string[]> = {
  en: ["the", "and", "is", "for", "with", "you", "this", "that", "are", "please", "we", "of", "to"],
  es: ["el", "la", "los", "las", "del", "por", "con", "una", "es", "gracias", "fecha", "pero", "muy", "está", "usted"],
  fr: ["le", "les", "des", "une", "est", "pour", "avec", "vous", "nous", "dans", "merci", "du", "veuillez"],
  de: ["der", "die", "das", "und", "ist", "nicht", "mit", "wir", "sie", "für", "auf", "ein", "eine", "bitte"],
  pt: ["o", "os", "as", "do", "da", "dos", "das", "com", "uma", "não", "obrigado", "você", "é", "data", "prezado"],
  nl: ["het", "een", "en", "van", "niet", "wij", "voor", "met", "dat", "zijn", "op", "gelieve", "beste"],
  pl: ["nie", "jest", "się", "oraz", "dla", "przez", "który", "dziękuję", "proszę", "na", "zamówienia"],
  tr: ["ve", "bir", "için", "ile", "bu", "olarak", "var", "değil", "teşekkür", "lütfen", "olan"],
  id: ["dan", "yang", "untuk", "dengan", "tidak", "ini", "adalah", "dari", "kami", "terima", "kasih", "mohon"],
  vi: ["và", "của", "cho", "với", "không", "là", "các", "được", "này", "chúng", "tôi", "cảm", "ơn", "vui"],
  it: ["il", "che", "della", "sono", "con", "una", "grazie", "gentile", "spedizione", "consegna", "cordiali"],
  ro: ["și", "este", "pentru", "vă", "mulțumesc", "livrare", "comandă", "vă", "stimate"],
  cs: ["je", "pro", "děkuji", "prosím", "dodání", "objednávku", "vážený"],
  tl: ["ang", "mga", "sa", "po", "salamat", "kayo", "ito"],
  sw: ["asante", "tafadhali", "bidhaa", "tarehe", "kwa", "yako"],
  uz: ["uchun", "rahmat", "iltimos", "buyurtma", "sana"],
};

/** Letters that essentially only appear in one of the Latin languages.
    A single hit is strong evidence, so these outweigh function words. */
const LATIN_LETTER_HINTS: Array<[string, RegExp]> = [
  ["vi", /[ơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i],
  ["pl", /[ąćęłńśźż]/i],
  ["tr", /[ğışİ]/],
  ["es", /[ñ¿¡]/i],
  ["de", /[ßäöü]/i],
  ["pt", /[ãõ]/i],                                  // ã/õ are Portuguese-only here;
  ["fr", /[àâçéèêëîïôùûœ]/i],                       // á/â/ê/ç are shared with French

  ["ro", /[ăâîșț]/i],
  ["cs", /[ěščřůň]/i],
  ["uz", /ʻ/],

  ["nl", /\bij\b|ĳ/i],
];

export function guessLanguage(text: string): string | null {
  const s = text.slice(0, 400);
  if (!s.trim()) return null;

  /* ── 1. Unambiguous scripts ──
     Written as explicit \uXXXX ranges, not literal characters: a pasted
     literal range is easy to mistype and silently widens or narrows the
     block (a stray space inside one of these classes once made EVERY
     Arabic-script string match Urdu). */

  /* Arabic script splits three ways. Urdu's retroflexes (ٹ ڈ ڑ) plus ں ے are
     the giveaway; Persian is then flagged by پ چ ژ گ, which Arabic lacks. */
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(s)) {
    if (/[\u0679\u0688\u0691\u06BA\u06D2]/.test(s)) return "ur";
    /* \u067E \u0686 \u0698 \u06AF, plus Persian's own yeh (\u06CC U+06CC) and keheh (\u06A9 U+06A9) \u2014
       Arabic uses \u064A/\u0643 instead, and plenty of Persian sentences contain no
       \u067E\u0686\u0698\u06AF at all. Urdu shares these, which is why it is tested first. */
    if (/[\u067E\u0686\u0698\u06AF\u06CC\u06A9]/.test(s)) return "fa";
    return "ar";
  }
  if (/[\u3040-\u30FF]/.test(s)) return "ja";        // kana ⇒ Japanese even with kanji
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(s)) return "zh";
  if (/[\uAC00-\uD7AF]/.test(s)) return "ko";
  /* Cyrillic splits three ways: Ukrainian has і ї є ґ, Bulgarian keeps ъ but
     drops ы э ё, Russian is the remainder. */
  if (/[\u0400-\u04FF]/.test(s)) {
    if (/[\u0456\u0457\u0454\u0491]/i.test(s)) return "uk";
    if (/\u044A/i.test(s) && !/[\u044B\u044D\u0451]/i.test(s)) return "bg";
    return "ru";
  }
  /* One script, one language — no scoring needed. Bengali (0980) sits just
     above Devanagari (0900); they must be tested as separate ranges. */
  if (/[\u0980-\u09FF]/.test(s)) return "bn";
  if (/[\u0B80-\u0BFF]/.test(s)) return "ta";
  if (/[\u0D80-\u0DFF]/.test(s)) return "si";
  if (/[\u1780-\u17FF]/.test(s)) return "km";
  if (/[\u1000-\u109F]/.test(s)) return "my";
  if (/[\u1200-\u137F]/.test(s)) return "am";
  if (/[\u0370-\u03FF]/.test(s)) return "el";
  if (/[\u0590-\u05FF]/.test(s)) return "he";
  if (/[\u0E00-\u0E7F]/.test(s)) return "th";
  if (/[\u0900-\u097F]/.test(s)) return "hi";
  if (!/[A-Za-zÀ-ÿĀ-ſ]/.test(s)) return null;

  /* ── 2. Latin: score letters (weight 3) + function words (weight 1) ── */
  const scores: Record<string, number> = {};
  const bump = (code: string, n: number) => { scores[code] = (scores[code] ?? 0) + n; };

  for (const [code, re] of LATIN_LETTER_HINTS) if (re.test(s)) bump(code, 3);

  const words = s.toLowerCase().match(/[a-zà-ÿā-ſ]+/g) ?? [];
  if (words.length) {
    const seen = new Set(words);
    for (const [code, markers] of Object.entries(LATIN_MARKERS)) {
      for (const m of markers) if (seen.has(m)) bump(code, 1);
    }
  }

  let best: string | null = null;
  let bestScore = 0;
  for (const [code, score] of Object.entries(scores)) {
    if (score > bestScore) { best = code; bestScore = score; }
  }

  /* Nothing distinctive (a product code, a number, one unknown word) — English
     is the right default for this team's Latin-script text. */
  return bestScore > 0 ? best : "en";
}

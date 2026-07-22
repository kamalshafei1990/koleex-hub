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

  ["nl", /\bij\b|ĳ/i],
];

export function guessLanguage(text: string): string | null {
  const s = text.slice(0, 400);
  if (!s.trim()) return null;

  /* ── 1. Unambiguous scripts ── */
  if (/[؀-ۿ]/.test(s)) return /[ٹڈھہےڑں]/.test(s) ? "ur" : "ar";
  if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";          // kana ⇒ Japanese even with kanji
  if (/[一-鿿㐀-䶿]/.test(s)) return "zh";
  if (/[가-힯]/.test(s)) return "ko";
  if (/[Ѐ-ӿ]/.test(s)) return "ru";
  if (/[฀-๿]/.test(s)) return "th";
  if (/[ऀ-ॿ]/.test(s)) return "hi";
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

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

/* Script-based source detection — the same cheap heuristic the Hub's
   auto-translate uses. Good enough to label "Detected: Chinese" instantly
   without a server round-trip; the provider still does the real detection
   when translating with source "auto". */
export function guessLanguage(text: string): string | null {
  const s = text.slice(0, 300);
  if (!s.trim()) return null;
  if (/[؀-ۿ]/.test(s)) return /[ٹڈھہے]/.test(s) ? "ur" : "ar";
  if (/[一-鿿㐀-䶿]/.test(s)) {
    if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";
    return "zh";
  }
  if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";
  if (/[가-힯]/.test(s)) return "ko";
  if (/[Ѐ-ӿ]/.test(s)) return "ru";
  if (/[฀-๿]/.test(s)) return "th";
  if (/[ऀ-ॿ]/.test(s)) return "hi";
  if (/[A-Za-z]/.test(s)) return "en";
  return null;
}

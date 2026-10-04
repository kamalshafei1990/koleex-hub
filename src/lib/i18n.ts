"use client";

import { useState, useEffect, useCallback } from "react";

export type Lang = "en" | "zh" | "ar";
export type Translations = Record<string, Record<Lang, string>>;

/** Every language except the canonical English source. */
export type TranslatableLang = Exclude<Lang, "en">;

/* The languages content can be translated INTO, with the label an operator
   sees. More are coming, so per-language editors iterate this list instead
   of hardcoding zh/ar: adding a language is one entry here (plus its strings
   in the dictionaries), not an edit in every form.
   `satisfies` keeps it honest — a code that isn't a real Lang won't compile,
   and a new Lang left out of the list is caught by the exhaustiveness check
   below. */
export const TRANSLATABLE_LANGS = [
  { code: "zh", label: "Chinese", nativeLabel: "中文", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
] as const satisfies ReadonlyArray<{
  code: TranslatableLang;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
}>;

/* Compile-time guard: if a Lang is added and not listed above, this line
   errors — so a new language can never silently miss the content editors. */
type _MissingTranslatableLang = Exclude<TranslatableLang, (typeof TRANSLATABLE_LANGS)[number]["code"]>;
const _translatableLangsAreComplete: _MissingTranslatableLang[] = [];
void _translatableLangsAreComplete;

/**
 * Hook that syncs with the language selected in MainHeader.
 * Pass a translations dictionary; returns t(key) that resolves to the active language.
 */
export function useTranslation(translations: Translations) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("koleex-lang") as Lang | null;
    if (saved) setLang(saved);

    const handler = ((e: CustomEvent<Lang>) => setLang(e.detail)) as EventListener;
    window.addEventListener("langchange", handler);
    return () => window.removeEventListener("langchange", handler);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const entry = translations[key];
      if (!entry) return fallback ?? key;
      return entry[lang] ?? entry["en"] ?? fallback ?? key;
    },
    [lang, translations]
  );

  return { t, lang };
}

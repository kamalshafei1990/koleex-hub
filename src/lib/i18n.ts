"use client";

import { useState, useEffect, useCallback } from "react";

export type Lang = "en" | "zh" | "ar";
export type Translations = Record<string, Record<Lang, string>>;

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

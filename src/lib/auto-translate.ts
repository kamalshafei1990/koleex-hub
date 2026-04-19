"use client";

/* ---------------------------------------------------------------------------
   auto-translate — transparent text translation for Hub content.

     const { display, wasTranslated, original, loading } =
       useAutoTranslate(task.title);

   - Detects if `text` already matches the viewer's UI language. If so,
     no-op (returns the original).
   - Otherwise asks /api/ai/translate; caches the result in memory so
     switching views doesn't re-fetch.
   - Gracefully falls back to the original on any failure — the UI is
     never broken by translation problems.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export type AppLang = "en" | "zh" | "ar";

/** Tiny script-based detector — good enough to avoid round-tripping
 *  strings that are already in the target language. Returns null when
 *  we can't tell (mixed scripts, numbers only). */
function guessScript(text: string): AppLang | null {
  const sample = text.slice(0, 200);
  if (/[\u0600-\u06FF]/.test(sample)) return "ar";
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(sample)) return "zh";
  if (/[A-Za-z]/.test(sample)) return "en";
  return null;
}

const memCache = new Map<string, string>(); // key = `${targetLang}|${text}`

export function useAutoTranslate(text: string | null | undefined): {
  display: string;
  wasTranslated: boolean;
  original: string;
  loading: boolean;
} {
  // We piggyback on useTranslation just to subscribe to language
  // changes — we don't need its dictionary.
  const { lang } = useTranslation({}) as unknown as { lang: AppLang };
  const target = (lang ?? "en") as AppLang;
  const original = text ?? "";
  const guessed = original.trim() ? guessScript(original) : null;
  const sameLang = guessed === target;

  const cacheKey = `${target}|${original}`;
  const [display, setDisplay] = useState<string>(() => {
    if (!original || sameLang) return original;
    return memCache.get(cacheKey) ?? original;
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!original.trim() || sameLang) {
      setDisplay(original);
      return;
    }
    const cached = memCache.get(cacheKey);
    if (cached) {
      setDisplay(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/ai/translate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: original,
        target_lang: target,
        source_lang: guessed ?? undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { translated?: string; fallback?: boolean } | null) => {
        if (cancelled) return;
        const result = json?.translated ?? original;
        memCache.set(cacheKey, result);
        setDisplay(result);
      })
      .catch(() => {
        if (!cancelled) setDisplay(original);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [original, target, sameLang, cacheKey, guessed]);

  return {
    display,
    wasTranslated: display !== original && !sameLang,
    original,
    loading,
  };
}

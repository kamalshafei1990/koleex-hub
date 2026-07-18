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
// Coalesce identical concurrent requests. When a page switches language,
// EVERY <AutoTranslatedText> fires at once; without this, 15 rows sharing the
// same text (or a cold page) would open 15 sockets and hammer the auth layer,
// which intermittently 401s under that burst. One in-flight promise per unique
// (target|text) collapses the fan-out.
const inFlight = new Map<string, Promise<string | null>>();

/** Ask the server to translate one string. Resolves the translated text, or
 *  `null` on failure — callers keep the original and may retry. Deliberately
 *  does NOT fall back to the original on error, so a transient 401 never gets
 *  cached as "this text = its English original" forever. Retries transient
 *  failures with a short backoff so a cold-boot auth race self-heals. */
async function translateRemote(
  cacheKey: string,
  text: string,
  target: AppLang,
  source: AppLang | null,
): Promise<string | null> {
  const cached = memCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const run = (async (): Promise<string | null> => {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const r = await fetch("/api/ai/translate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            target_lang: target,
            source_lang: source ?? undefined,
          }),
        });
        if (r.ok) {
          const json = (await r.json()) as { translated?: string } | null;
          const translated = json?.translated;
          if (typeof translated === "string" && translated) {
            memCache.set(cacheKey, translated); // cache ONLY genuine results
            return translated;
          }
          return null; // 200 but empty → treat as no-op, don't poison cache
        }
        // 4xx that won't change on retry (e.g. 400 unsupported, 413 too long):
        // give up immediately. Only retry the transient burst-induced 401/5xx.
        if (r.status !== 401 && r.status < 500) return null;
      } catch {
        // network hiccup — fall through to retry
      }
      // Backoff before the next attempt (250ms, 750ms). By then the cold-boot
      // auth session has settled and the request succeeds.
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((res) => setTimeout(res, 250 * (attempt * 2 + 1)));
      }
    }
    return null;
  })();

  inFlight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    inFlight.delete(cacheKey); // allow a later re-render to retry if it failed
  }
}

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
    translateRemote(cacheKey, original, target, guessed)
      .then((translated) => {
        if (cancelled) return;
        // Only swap in a genuine translation; on failure keep the original
        // showing (and translateRemote left the cache clean so it retries).
        if (translated) setDisplay(translated);
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

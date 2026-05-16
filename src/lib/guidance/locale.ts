/* ===========================================================================
   Guidance locale — Phase 2.5

   Tiny, dependency-free helper for picking the language the help
   layer renders in. Reads from `koleex-locale` in localStorage when
   present; otherwise falls back to `navigator.language`. Defaults to
   English when neither hints at Chinese.

   The full Hub i18n system can layer on top later — this stays the
   minimal contract the guidance registry needs.
   ========================================================================== */

export type GuidanceLocale = "en" | "zh";

const STORAGE_KEY = "koleex-locale";

/* Server-safe — returns "en" during SSR. */
export function getGuidanceLocale(): GuidanceLocale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch { /* swallow */ }
  const nav = typeof navigator !== "undefined" ? (navigator.language ?? "") : "";
  if (nav.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}

export function setGuidanceLocale(locale: GuidanceLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
    /* Notify any mounted tip components so they re-render without a
       full page reload when the operator flips the language. */
    window.dispatchEvent(new CustomEvent("koleex:guidance-locale"));
  } catch { /* swallow */ }
}

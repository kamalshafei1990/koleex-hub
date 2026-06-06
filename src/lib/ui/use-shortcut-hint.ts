"use client";

/* ---------------------------------------------------------------------------
   useShortcutHint — single source of truth for the search "⌘K / Ctrl K"
   badge. Created because issue d54f3e66 was reopened: the badge had been
   fixed in ONE search bar (the shared HomeSearchBar) but several other
   search bars across the system still showed a bare, unexplained "⌘K"
   glyph. Centralizing the label + tooltip here means any search bar that
   uses this hook gets the same correct, platform-aware, explained badge —
   and a future search bar can't re-introduce the bug by hand-rolling its
   own ⌘K.

   Returns:
     • label — "⌘K" on Mac/iOS, "Ctrl K" everywhere else (so a Windows
       user sees a key that's actually on their keyboard).
     • hint  — localized tooltip text for title + aria-label, e.g.
       "Focus search — Ctrl + K".
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export interface ShortcutHint {
  label: string;
  hint: string;
}

const HINT_BY_LANG: Record<"en" | "zh" | "ar", string> = {
  en: "Focus search",
  zh: "聚焦搜索",
  ar: "تركيز البحث",
};

export function useShortcutHint(): ShortcutHint {
  // SSR-safe defaults; corrected on mount where navigator/document exist.
  const [state, setState] = useState<ShortcutHint>({ label: "Ctrl K", hint: "Focus search — Ctrl + K" });

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      "";
    const isMac = /Mac|iPhone|iPod|iPad/i.test(platform);
    const combo = isMac ? "⌘ + K" : "Ctrl + K";
    const label = isMac ? "⌘K" : "Ctrl K";

    let lang: "en" | "zh" | "ar" = "en";
    try {
      const l = (document.documentElement.lang || "en") as string;
      if (l === "zh" || l === "ar") lang = l;
    } catch { /* no-op */ }

    setState({ label, hint: `${HINT_BY_LANG[lang]} — ${combo}` });
  }, []);

  return state;
}

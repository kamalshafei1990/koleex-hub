"use client";

/* ---------------------------------------------------------------------------
   display-prefs — apply the user's Appearance / Accessibility / Region
   preferences (stored in accounts.preferences.display, a jsonb bag) to the
   live document, plus format helpers that read the region prefs.

   Visual prefs applied to <html>:
     · text_size          → --kx-font-scale CSS var. globals.css multiplies each
                            fixed-px / named text size by this var (the hub's type
                            is fixed-px, so rem/root font-size scaling wouldn't
                            touch it — and it's text-only, not a whole-page zoom)
     · density            → data-density attribute (compact tightens padding)
     · reduce_motion      → .kx-reduce-motion class (globals.css kills anim)
     · high_contrast      → .kx-high-contrast class
     · reduce_transparency→ .kx-reduce-transparency class
     · bold_text          → .kx-bold-text class (heavier weights)
     · underline_links    → .kx-underline-links class
     · focus_ring         → .kx-focus-ring class (always-visible focus outline)

   Theme is intentionally NOT handled here — it stays on the existing
   MainHeader localStorage("koleex-theme") mechanism so the header toggle and
   Settings stay in sync (see AppearanceTab).

   A localStorage mirror ("koleex-display") lets us apply instantly on first
   paint (before the account bootstrap resolves) to avoid a flash.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import { useCurrentAccount } from "@/lib/identity";
import { withDefaults } from "@/lib/access-control";
import type {
  DisplayPrefs,
  TextSizePref,
  DateFormatPref,
  TimeFormatPref,
  NumberFormatPref,
} from "@/lib/access-control";

const CACHE_KEY = "koleex-display";

export const TEXT_SCALE: Record<TextSizePref, number> = {
  small: 0.92,
  default: 1,
  large: 1.08,
  xlarge: 1.18,
};

/** Apply a full DisplayPrefs bag to <html>. Safe to call repeatedly. */
export function applyDisplayPreferences(d: DisplayPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--kx-font-scale", String(TEXT_SCALE[d.text_size] ?? 1));
  root.dataset.density = d.density;
  root.classList.toggle("kx-reduce-motion", !!d.reduce_motion);
  root.classList.toggle("kx-high-contrast", !!d.high_contrast);
  root.classList.toggle("kx-reduce-transparency", !!d.reduce_transparency);
  root.classList.toggle("kx-bold-text", !!d.bold_text);
  root.classList.toggle("kx-underline-links", !!d.underline_links);
  root.classList.toggle("kx-focus-ring", !!d.focus_ring);
}

export function cacheDisplayPreferences(d: DisplayPrefs): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

/* ── Theme ── the app's existing binary light/dark mechanism (localStorage
   "koleex-theme" + data-theme + a "themechange" event). Kept separate from the
   display bag so the header toggle and Settings drive the exact same switch. */
export type ThemeMode = "light" | "dark";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("koleex-theme") === "light" ? "light" : "dark";
}

export function setTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("koleex-theme", theme); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

function readCachedDisplay(): DisplayPrefs | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return withDefaults({ display: JSON.parse(raw) as DisplayPrefs }).display ?? null;
  } catch { return null; }
}

/**
 * Headless component mounted in RootShell. Applies cached prefs immediately,
 * then re-applies whenever the signed-in account's preferences change.
 */
export function DisplayPreferencesApplier() {
  const { account } = useCurrentAccount();

  /* First paint: apply whatever we cached last session (no flash). */
  useEffect(() => {
    const cached = readCachedDisplay();
    if (cached) applyDisplayPreferences(cached);
  }, []);

  /* Whenever the account (and thus its preferences) resolves or changes,
     apply + refresh the cache. */
  useEffect(() => {
    if (!account) return;
    const d = withDefaults(account.preferences).display;
    if (d) { applyDisplayPreferences(d); cacheDisplayPreferences(d); }
  }, [account]);

  return null;
}

/* ─────────────────────────── Format helpers ─────────────────────────── */

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }

export function formatDatePref(date: Date, fmt: DateFormatPref): string {
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  switch (fmt) {
    case "mdy": return `${m}/${d}/${y}`;
    case "iso": return `${y}-${m}-${d}`;
    case "dmy":
    default: return `${d}/${m}/${y}`;
  }
}

export function formatTimePref(date: Date, fmt: TimeFormatPref): string {
  if (fmt === "12h") {
    let h = date.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${pad(date.getMinutes())} ${ampm}`;
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const NUMBER_LOCALE: Record<NumberFormatPref, string> = {
  comma_dot: "en-US",   // 1,234.50
  dot_comma: "de-DE",   // 1.234,50
  space_comma: "fr-FR", // 1 234,50
};

export function formatNumberPref(
  n: number,
  fmt: NumberFormatPref,
  opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 },
): string {
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE[fmt], opts).format(n);
  } catch {
    return String(n);
  }
}

/** A one-line "this is how things will look" sample for the settings UI. */
export function displayPreviewSamples(d: DisplayPrefs, now: Date): {
  date: string; time: string; number: string;
} {
  return {
    date: formatDatePref(now, d.date_format),
    time: formatTimePref(now, d.time_format),
    number: formatNumberPref(1234.5, d.number_format),
  };
}

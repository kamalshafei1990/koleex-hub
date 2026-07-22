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

/* After a Settings tab saves, the account refetch that follows can still
   return the PRE-save snapshot, and the applier below would then re-apply and
   re-cache the old values — undoing what the user just chose. A short window
   where the local write wins closes that race without any of the callers
   needing to know about it. */
let localWriteUntil = 0;

/** Cache a locally-saved bag and let it outrank incoming account snapshots
 *  for a few seconds. Call this instead of cacheDisplayPreferences when the
 *  USER is the one who made the change. */
export function saveDisplayPreferencesLocally(d: DisplayPrefs): void {
  cacheDisplayPreferences(d);
  localWriteUntil = Date.now() + 8000;
}

/* ── Theme ────────────────────────────────────────────────────────────────
   Two values, deliberately:

     · koleex-theme       the RESOLVED appearance, always "light" | "dark".
                          This is what <html data-theme> carries and what the
                          "themechange" event announces, so MainHeader and
                          every other listener keep working unchanged.
     · koleex-theme-mode  what the USER chose — "light", "dark", or "system".
                          Only "system" behaves differently: it follows the
                          OS and re-resolves when the OS flips at sunset.

   Keeping them apart is what lets Auto exist without every consumer having
   to learn a third value. */
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

const MODE_KEY = "koleex-theme-mode";

/** What the OS is currently asking for. Defaults to dark off-browser. */
export function systemTheme(): ThemeMode {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** The user's CHOICE (may be "system"). */
export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(MODE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  /* No mode stored yet — infer it from the legacy resolved value so nobody's
     existing choice changes the first time they load this build. */
  return window.localStorage.getItem("koleex-theme") === "light" ? "light" : "dark";
}

/** The appearance actually in effect right now. */
export function getTheme(): ThemeMode {
  const pref = getThemePreference();
  return pref === "system" ? systemTheme() : pref;
}

/** Apply a resolved theme to the document + tell everyone. */
function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("koleex-theme", theme); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

/** Set the user's choice. Pass "system" to follow the OS from now on. */
export function setTheme(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  try { localStorage.setItem(MODE_KEY, pref); } catch { /* ignore */ }
  applyTheme(pref === "system" ? systemTheme() : pref);
  window.dispatchEvent(new CustomEvent("thememodechange", { detail: pref }));
}

/** Watch the OS and re-resolve while the user is on "system". Returns an
 *  unsubscribe. Mounted once by DisplayPreferencesApplier. */
function watchSystemTheme(): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    if (getThemePreference() === "system") applyTheme(systemTheme());
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
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

  /* Auto theme: resolve once on mount (the OS may have flipped while the tab
     was closed) and keep following it for as long as "system" is chosen. */
  useEffect(() => {
    if (getThemePreference() === "system") applyTheme(systemTheme());
    return watchSystemTheme();
  }, []);

  /* Whenever the account (and thus its preferences) resolves or changes,
     apply + refresh the cache. */
  useEffect(() => {
    if (!account) return;
    /* A just-made local choice outranks a possibly-stale server snapshot. */
    if (Date.now() < localWriteUntil) return;
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

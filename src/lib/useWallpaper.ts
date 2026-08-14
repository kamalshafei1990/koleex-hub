"use client";

/* useWallpaper — one subscription every ground shares.
   ---------------------------------------------------------------------------
   Twenty pages mount WavyBackground independently, so the wallpaper had two
   possible homes: a preference read in twenty files, or a preference read
   inside the ground itself. This is the second. Nothing outside
   WavyBackground and the picker needs to know a wallpaper exists.

   THREE SOURCES, IN THIS ORDER, AND THE ORDER IS THE POINT
     1. the localStorage mirror, read synchronously in useState's initialiser
        so the very first paint is already right;
     2. the account preference, which arrives later and wins;
     3. the broadcast, so the picker changes every mounted ground at once —
        including the one behind the picker itself.

   Without (1) the ground would paint the wave field and then swap to the
   chosen wallpaper a request later, which is a content shift after paint on
   the largest surface on screen. */

import { useEffect, useState } from "react";
import { useCurrentAccount } from "./identity";
import { useSkin } from "./appearance";
import { getTheme, type ThemeMode } from "./display-prefs";
import {
  DEFAULT_WALLPAPER_ID, WALLPAPER_EVENT, backgroundCss, cacheWallpaper, dimFor,
  fitStyle, readCachedWallpaper, type WallpaperFit, type WallpaperPref,
} from "./wallpaper";

const FALLBACK: WallpaperPref = { id: DEFAULT_WALLPAPER_ID };

/** Widen the loosely-typed jsonb shape back into ours. `fit` is a plain string
 *  in AccountPreferences (so reading an account does not drag the catalogue
 *  in), and an unrecognised value must not reach the style object. */
function fromPrefs(raw: unknown): WallpaperPref | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string") return null;
  const fit = p.fit;
  return {
    id: p.id,
    photoUrl: typeof p.photoUrl === "string" ? p.photoUrl : undefined,
    photoPath: typeof p.photoPath === "string" ? p.photoPath : undefined,
    fit: fit === "fill" || fit === "fit" || fit === "stretch" || fit === "center"
      ? (fit as WallpaperFit) : undefined,
    dim: typeof p.dim === "number" ? p.dim : undefined,
    tint: typeof p.tint === "string" ? p.tint : undefined,
  };
}

export function useWallpaper(): WallpaperPref {
  /* Lazy initialiser, not an effect: an effect would run after the first
     paint, which is exactly the shift this exists to avoid. */
  const [pref, setPref] = useState<WallpaperPref>(() => readCachedWallpaper() ?? FALLBACK);
  const [adopted, setAdopted] = useState("");
  const { account } = useCurrentAccount();

  const stored = account?.preferences?.wallpaper;
  const storedKey = stored ? JSON.stringify(stored) : "";

  /* Adopting the account's value ONCE, when it first arrives, and doing it
     during render rather than in an effect.

     Not a style preference — an effect that calls setState is a second render
     pass after paint, which on the largest surface on screen is a visible
     flash of the wrong ground. React's documented "adjust state when a prop
     changes" pattern re-renders before the browser sees anything.

     Once, because after the account lands the LOCAL choice is the newer one:
     the picker writes the mirror and broadcasts immediately, while the saved
     account round-trips. Re-adopting on every render would let a stale server
     copy overwrite the selection the user just made. */
  if (storedKey && storedKey !== adopted) {
    setAdopted(storedKey);
    const next = fromPrefs(stored);
    if (next && JSON.stringify(next) !== JSON.stringify(pref)) setPref(next);
  }

  /* Keep the mirror honest, so a choice made on another device is right from
     the next FIRST paint rather than one request later. */
  useEffect(() => { cacheWallpaper(pref); }, [pref]);

  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<WallpaperPref>).detail;
      if (detail?.id) setPref(detail);
    };
    /* `storage` covers the other-tab case: two Hub tabs open, choice made in
       one. The mirror is already written by then, so re-reading it is enough. */
    const onStorage = () => {
      const cached = readCachedWallpaper();
      if (cached) setPref(cached);
    };
    window.addEventListener(WALLPAPER_EVENT, onPick);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WALLPAPER_EVENT, onPick);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return pref;
}

/* ── Core ───────────────────────────────────────────────────────────────── */

/** Paints the wallpaper under the CORE skin, where there is no ground to paint
 *  it into.
 *
 *  Aurora mounts WavyBackground on twenty pages and the wallpaper lives inside
 *  it. Core mounts nothing — the pages read `{aurora && <WavyBackground/>}` —
 *  so a Core user could pick a wallpaper and watch nothing happen. That is the
 *  bug this closes, and the owner found it by doing exactly that.
 *
 *  It renders NO DOM. Editing twenty more files was the obvious fix and the
 *  wrong one; instead this writes custom properties on :root and lets one CSS
 *  rule paint `body`. The whole Core path is an attribute and three variables.
 *
 *  THE CANON IS KEPT, and it is kept by hub-live rather than by an exception.
 *  Core with the default choice resolves to no image, so the attribute is
 *  removed and Core renders byte-identical to what it always did. Only an
 *  explicit choice — a deliberate act by the person looking at the screen —
 *  changes anything. */
export function WallpaperApplier(): null {
  const pref = useWallpaper();
  const skin = useSkin();
  const hour = useHour(pref.id === "hub-dynamic");
  const [theme, setTheme] = useState<ThemeMode>(() => getTheme());

  useEffect(() => {
    const onTheme = () => setTheme(getTheme());
    window.addEventListener("themechange", onTheme);
    return () => window.removeEventListener("themechange", onTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    /* Aurora already has a ground; painting body underneath it would be a
       second copy nobody can see, and one more layer to composite. */
    const image = skin === "core" ? backgroundCss(pref, theme, hour) : null;

    const clear = () => {
      root.removeAttribute("data-kx-wallpaper");
      for (const v of ["--kx-wp-image", "--kx-wp-scrim", "--kx-wp-size"]) {
        root.style.removeProperty(v);
      }
    };
    if (!image) { clear(); return; }

    /* Core has no glass to frost, so the scrim is a flat wash rather than the
       radial floor — a vignette would read as a shadow on an opaque page. */
    const rgb = theme === "light" ? "247,249,252" : "5,7,12";
    const a = ((dimFor(pref) / 100) * 0.62).toFixed(3);
    root.style.setProperty("--kx-wp-image", image);
    root.style.setProperty("--kx-wp-scrim", `linear-gradient(rgba(${rgb},${a}), rgba(${rgb},${a}))`);
    root.style.setProperty("--kx-wp-size", fitStyle(pref.fit).backgroundSize);
    root.setAttribute("data-kx-wallpaper", "on");
    return clear;
  }, [pref, skin, theme, hour]);

  return null;
}

/** Current hour, re-read on a coarse timer for the dynamic wallpaper.
 *  Fifteen minutes because the four phases turn at hour boundaries and a
 *  wallpaper caught up a few minutes late is invisible, while a per-minute
 *  timer on twenty mounted grounds is not free. */
export function useHour(active: boolean): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setHour(new Date().getHours()), 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return hour;
}

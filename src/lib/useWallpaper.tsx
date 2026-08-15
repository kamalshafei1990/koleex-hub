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
import dynamic from "next/dynamic";
import { useCurrentAccount } from "./identity";
import { getTheme, type ThemeMode } from "./display-prefs";
import {
  DEFAULT_WALLPAPER_ID, WALLPAPER_EVENT, backgroundCss, cacheWallpaper, dimFor,
  fitStyle, isShader, readCachedWallpaper, type WallpaperFit, type WallpaperPref,
} from "./wallpaper";

/* Only downloaded when a live pattern is actually chosen. */
const ShaderWallpaper = dynamic(() => import("@/components/wallpapers/ShaderWallpaper"), { ssr: false });

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
  /* Once the person has picked something in this session, THEIR choice wins
     until the page reloads. See the note on the adopt block below — this flag
     is the whole fix for wallpapers reverting to the previous one. */
  const [chosenHere, setChosenHere] = useState(false);
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
  /* AND NOT AFTER A LOCAL CHOICE. This is the bug the owner hit as "changing
     the wallpaper from one to another": every second switch silently reverted.
     Traced, and the trace is the explanation —

       t=7480  broadcast fx-radar     the pick
       t=7520  mirror    fx-radar     applied
       t=8477  PATCH     fx-radar     saved, correctly
       t=9478  mirror    fx-plasma    reverted to the PREVIOUS wallpaper

     The revert is the refresh this file's own sibling asks for after a save:
     the account comes back still carrying the previous value, storedKey
     changes, and the adopt below trusted it over a choice made a second ago.
     The refresh exists to stop STALE WRITERS clobbering the wallpaper; it had
     quietly become the vehicle for a stale READ doing the same thing.

     There is no timestamp to compare, so the rule is the one that is true
     anyway: a person changes their wallpaper on this screen, and while they
     are doing it nothing the server says about it is newer than what they just
     tapped. Cross-device sync still works — it happens on the next load, where
     no local choice has been made yet. */
  if (!chosenHere && storedKey && storedKey !== adopted) {
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
      if (detail?.id) { setPref(detail); setChosenHere(true); }
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
export function WallpaperApplier() {
  const pref = useWallpaper();
  const hour = useHour(pref.id === "hub-dynamic");
  const [theme, setTheme] = useState<ThemeMode>(() => getTheme());

  useEffect(() => {
    const onTheme = () => setTheme(getTheme());
    window.addEventListener("themechange", onTheme);
    return () => window.removeEventListener("themechange", onTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    /* EVERY SKIN, EVERY ROUTE — and that change is the fix for the bug the
       owner hit as "it only shows in settings".

       The wallpaper used to live inside WavyBackground, which exactly TWELVE
       of 251 pages mount. So it appeared on twelve routes and nowhere else,
       which is not a wallpaper, it is a decoration on a handful of screens.
       Painting body here puts it under the whole shell, once, wherever the
       user goes.

       The wave field is the one exception and stays where it is: it is a live
       canvas, it is Aurora's identity, and the twelve pages that mount it were
       signed off with it. isLive() resolves to no image, so those pages keep
       painting it themselves and body stays clear. */
    const image = backgroundCss(pref, theme, hour);

    const clear = () => {
      root.removeAttribute("data-kx-wallpaper");
      for (const v of ["--kx-wp-image", "--kx-wp-scrim", "--kx-wp-size"]) {
        root.style.removeProperty(v);
      }
    };
    if (!image) { clear(); return; }

    /* A flat wash rather than the radial floor: the ground now sits under every
       route, and a vignette anchored to the viewport would read as a shadow
       falling across whatever page happens to be open. */
    const rgb = theme === "light" ? "247,249,252" : "5,7,12";
    const a = ((dimFor(pref) / 100) * 0.62).toFixed(3);
    root.style.setProperty("--kx-wp-image", image);
    root.style.setProperty("--kx-wp-scrim", `linear-gradient(rgba(${rgb},${a}), rgba(${rgb},${a}))`);
    root.style.setProperty("--kx-wp-size", fitStyle(pref.fit).backgroundSize);
    root.setAttribute("data-kx-wallpaper", "on");
    return clear;
  }, [pref, theme, hour]);

  /* A shader cannot be painted by CSS — it is a canvas — so the live patterns
     get a real layer, mounted ONCE here rather than by whichever pages happen
     to include a ground.

     z-index -1, NOT 0, and the difference is a page that works versus a page
     that vanishes. A fixed element at z-index 0 makes a stacking context and
     paints ABOVE static in-flow content, so the first version covered
     /quotations completely — wallpaper visible, application gone. At -1 the
     painting order is: body's background (the still fallback), then this
     layer, then every page's content on top of both. */
  if (!isShader(pref)) return null;
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }} aria-hidden>
      <ShaderWallpaper id={pref.id} tint={pref.tint} />
    </div>
  );
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

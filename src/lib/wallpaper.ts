/* Wallpaper — the Hub's ground, and the one preference that every screen sees.
   ---------------------------------------------------------------------------
   Organised after macOS System Settings → Wallpaper (owner reference,
   2026-08-15): a hero showing the current choice, then groups of thumbnails,
   then Your Photos, then Colors. Layout and organisation only.

   THE RULE THIS FILE EXISTS TO KEEP: the Aurora wave field is the default and
   its code is untouched. Choosing another ground does not modify the field —
   it declines to mount it. `hub-live` is the only id whose kind is "live", it
   is what `DEFAULT` resolves to, and nothing here can delete it.

   WHY EVERY BUILT-IN IS CSS AND NOT AN IMAGE
   Measured on the live Hub before any of this was written, because the owner
   asked whether a wallpaper would cost speed:

     wave field only .................. 8.3ms median / 9.4 p95 / 0 jank
     wave + 6MP photo behind .......... 8.3 / 9.3 / 0
     photo instead of the wave ........ 8.3 / 9.4 / 0
     wave + 24MP photo, WHILE SCROLLING 8.3 / 9.3 / 0

   Identical, and that is not luck. There are 52 backdrop-filter surfaces on
   Home (24 visible; the top ramp alone is four stacked layers at 3/7/14/28px)
   and a backdrop-filter blurs an already-rasterised texture — its cost is
   area times radius, NOT what the picture contains. We already pay for those
   blurs over an animated canvas. Changing what sits underneath is free.

   So rendering was never the risk. The three real costs are:
     1. NETWORK — an uploaded photo is one more request on every cold load,
        and our measured law is ~1s per request to any host. Built-ins are
        CSS strings: zero requests, zero bytes, forever.
     2. GPU MEMORY — a 24MP phone photo is 92MB decoded. Uploads are capped
        at MAX_UPLOAD_EDGE, which brings that to roughly 12MB.
     3. localStorage — the mirror below stores the CHOICE (a short JSON), not
        an image. A base64 wallpaper here would blow the quota and silently
        kill warm start, which has bitten this codebase before. Photos live in
        Storage and only their URL is ever written.

   Caveat kept with the numbers: they were taken on a DPR-2 120Hz Mac where
   all three cases sat at the display cap. They prove a wallpaper will not
   break a good machine; they do not describe a weak one. */

import type { ThemeMode } from "./display-prefs";

/* ── types ──────────────────────────────────────────────────────────────── */

/** live   — the Aurora wave field: an animated canvas, the Hub's identity.
 *  dynamic— shifts palette with the time of day, recomputed on a timer.
 *  still  — a fixed CSS gradient.
 *  color  — a flat brand or user colour.
 *  photo  — an uploaded image held in Storage. */
export type WallpaperKind = "live" | "dynamic" | "still" | "color" | "photo";

/** Groups are the picker's sections, in the order they are shown. */
export type WallpaperGroup = "koleex" | "dynamic" | "still" | "color";

/** How an uploaded photo fills the viewport. Named as macOS names them so the
 *  owner's reference and our UI agree. */
export type WallpaperFit = "fill" | "fit" | "stretch" | "center";

export interface Wallpaper {
  id: string;
  kind: WallpaperKind;
  group: WallpaperGroup;
  /** i18n key under the `wp.` namespace in translations/settings.ts. */
  nameKey: string;
  /** CSS `background` value per theme. Multi-layer gradients are fine — they
   *  rasterise once and cost nothing per frame. */
  dark: string;
  light: string;
  /** Scrim strength 0–100 that keeps glass readable over this ground. Tuned
   *  per wallpaper because a pale gradient needs far more than a near-black
   *  one; see FLOOR below for what the number does. */
  dim: number;
}

/** What we persist. Small on purpose — this rides in the preferences jsonb and
 *  is mirrored into localStorage for first paint. */
export interface WallpaperPref {
  id: string;
  /** Public URL of the uploaded image; only meaningful when id === "photo". */
  photoUrl?: string;
  /** Storage path, kept so the old object can be deleted when it is replaced. */
  photoPath?: string;
  fit?: WallpaperFit;
  /** User override of the catalogue's dim, 0–100. */
  dim?: number;
}

/* ── the catalogue ──────────────────────────────────────────────────────── */

/** The wave field's own palette, so the still Koleex grounds are demonstrably
 *  the same family rather than a designer's approximation of it. Kept in sync
 *  by hand with PALETTES in WavyBackground.tsx — five stops, brightest first. */
const HUB = ["#BCD8F0", "#8FB0D4", "#567FB2", "#2E4B6B", "#1B2A3C"] as const;

export const DEFAULT_WALLPAPER_ID = "hub-live";

export const WALLPAPERS: Wallpaper[] = [
  /* ── Koleex Hub ──────────────────────────────────────────────────────── */
  {
    /* THE DEFAULT, AND THE ONE THAT MUST NEVER LEAVE THIS LIST. Its dark and
       light values are only ever seen as the picker's thumbnail — when this id
       is active the canvas paints the real thing. */
    id: "hub-live", kind: "live", group: "koleex", nameKey: "wp.hubLive", dim: 0,
    /* The base layer is linear-gradient(c, c) and not the bare colour it looks
       like it wants to be. Every value in this file is consumed as
       background-IMAGE, where a bare colour is invalid — see asImage(). */
    dark: `radial-gradient(120% 90% at 50% 50%, ${HUB[2]}55 0%, ${HUB[3]}88 45%, #05070C 100%), linear-gradient(#05070C, #05070C)`,
    light: `radial-gradient(120% 90% at 50% 50%, ${HUB[1]}66 0%, ${HUB[3]}22 45%, #F4F7FA 100%), linear-gradient(#F4F7FA, #F4F7FA)`,
  },
  {
    id: "hub-deep", kind: "still", group: "koleex", nameKey: "wp.hubDeep", dim: 46,
    dark: `radial-gradient(90% 70% at 22% 18%, ${HUB[2]}66 0%, transparent 62%),
           radial-gradient(80% 65% at 82% 82%, ${HUB[3]}88 0%, transparent 60%),
           linear-gradient(160deg, #0A1220 0%, #05070C 100%)`,
    light: `radial-gradient(90% 70% at 22% 18%, ${HUB[0]}AA 0%, transparent 62%),
            radial-gradient(80% 65% at 82% 82%, ${HUB[1]}66 0%, transparent 60%),
            linear-gradient(160deg, #FFFFFF 0%, #E8F0F8 100%)`,
  },
  {
    id: "hub-dawn", kind: "still", group: "koleex", nameKey: "wp.hubDawn", dim: 52,
    dark: `radial-gradient(100% 80% at 50% 108%, ${HUB[0]}55 0%, ${HUB[2]}44 32%, transparent 68%),
           linear-gradient(180deg, #05070C 0%, #101B2C 100%)`,
    light: `radial-gradient(100% 80% at 50% 108%, ${HUB[0]}CC 0%, ${HUB[1]}77 34%, transparent 70%),
            linear-gradient(180deg, #FBFDFF 0%, #DCE9F6 100%)`,
  },
  {
    /* Monochrome, per the brand's monochrome-first rule — the one Koleex
       ground with no blue in it at all, for anyone who wants the chrome to
       carry the only colour on screen. */
    id: "hub-graphite", kind: "still", group: "koleex", nameKey: "wp.hubGraphite", dim: 40,
    dark: `radial-gradient(110% 85% at 30% 12%, #2A2F38 0%, transparent 60%),
           linear-gradient(155deg, #14171C 0%, #06080B 100%)`,
    light: `radial-gradient(110% 85% at 30% 12%, #FFFFFF 0%, transparent 60%),
            linear-gradient(155deg, #F2F4F7 0%, #D9DDE3 100%)`,
  },

  /* ── Dynamic — one wallpaper, four faces ─────────────────────────────── */
  {
    /* Resolved at paint time by dynamicCss(); the values here are the
       thumbnail and the fallback if the clock is somehow unavailable. */
    id: "hub-dynamic", kind: "dynamic", group: "dynamic", nameKey: "wp.hubDynamic", dim: 46,
    dark: `linear-gradient(150deg, #0B1830 0%, ${HUB[3]} 55%, #05070C 100%)`,
    light: `linear-gradient(150deg, #EAF2FB 0%, ${HUB[0]} 55%, #FFFFFF 100%)`,
  },

  /* ── Still — a starter set; the owner adds to each kind ──────────────── */
  {
    id: "still-tide", kind: "still", group: "still", nameKey: "wp.tide", dim: 48,
    dark: `radial-gradient(70% 55% at 12% 88%, #10394F 0%, transparent 62%),
           radial-gradient(75% 60% at 88% 16%, #1D5A6E 0%, transparent 58%),
           linear-gradient(145deg, #061119 0%, #04080D 100%)`,
    light: `radial-gradient(70% 55% at 12% 88%, #BEE3EE 0%, transparent 62%),
            radial-gradient(75% 60% at 88% 16%, #8FCADB 0%, transparent 58%),
            linear-gradient(145deg, #FBFEFF 0%, #DDEEF4 100%)`,
  },
  {
    id: "still-ember", kind: "still", group: "still", nameKey: "wp.ember", dim: 54,
    dark: `radial-gradient(80% 60% at 78% 96%, #6B2A2A 0%, transparent 60%),
           radial-gradient(70% 55% at 16% 10%, #3C2246 0%, transparent 58%),
           linear-gradient(160deg, #14090C 0%, #060406 100%)`,
    light: `radial-gradient(80% 60% at 78% 96%, #F7CFC2 0%, transparent 62%),
            radial-gradient(70% 55% at 16% 10%, #E2D2EE 0%, transparent 58%),
            linear-gradient(160deg, #FFFBFA 0%, #F2E3DE 100%)`,
  },
  {
    id: "still-moss", kind: "still", group: "still", nameKey: "wp.moss", dim: 46,
    dark: `radial-gradient(75% 60% at 24% 20%, #1E4034 0%, transparent 60%),
           radial-gradient(70% 58% at 84% 88%, #16303A 0%, transparent 58%),
           linear-gradient(150deg, #08120F 0%, #05080A 100%)`,
    light: `radial-gradient(75% 60% at 24% 20%, #CDE7DA 0%, transparent 60%),
            radial-gradient(70% 58% at 84% 88%, #BFDCE4 0%, transparent 58%),
            linear-gradient(150deg, #FAFEFC 0%, #E0EFE8 100%)`,
  },
  {
    id: "still-dusk", kind: "still", group: "still", nameKey: "wp.dusk", dim: 50,
    dark: `radial-gradient(90% 70% at 50% 104%, #4A2E63 0%, transparent 62%),
           radial-gradient(60% 50% at 14% 8%, #1B2B52 0%, transparent 58%),
           linear-gradient(170deg, #0A0A16 0%, #05050C 100%)`,
    light: `radial-gradient(90% 70% at 50% 104%, #DCCBEF 0%, transparent 64%),
            radial-gradient(60% 50% at 14% 8%, #C7D3EE 0%, transparent 58%),
            linear-gradient(170deg, #FDFBFF 0%, #E7E2F3 100%)`,
  },

  /* ── Colors ──────────────────────────────────────────────────────────── */
  ...([
    ["color-ink", "wp.ink", "#05070C", "#FFFFFF", 22],
    ["color-graphite", "wp.graphite", "#15181D", "#F2F4F7", 26],
    ["color-slate", "wp.slate", "#232830", "#DFE3E9", 30],
    ["color-hub", "wp.hubBlue", "#1B2A3C", "#BCD8F0", 34],
    ["color-steel", "wp.steel", "#2E4B6B", "#8FB0D4", 38],
    ["color-teal", "wp.teal", "#123A3E", "#B9DEDD", 34],
    ["color-moss", "wp.mossFlat", "#16301F", "#C9E2CE", 34],
    ["color-clay", "wp.clay", "#3A2420", "#EBD5CB", 36],
    ["color-plum", "wp.plum", "#2C1E3C", "#DCCBEF", 36],
    ["color-sand", "wp.sand", "#332B1F", "#EFE4CE", 36],
  ] as const).map(([id, nameKey, dark, light, dim]) => ({
    id, nameKey, dark, light, dim,
    kind: "color" as const, group: "color" as const,
  })),
];

const BY_ID = new Map(WALLPAPERS.map((w) => [w.id, w]));

/** The photo entry is not in WALLPAPERS — there is no fixed thumbnail for it
 *  and its appearance comes entirely from the preference. */
export const PHOTO_ID = "photo";

/** Uploads are downscaled to this longest edge before they leave the browser.
 *  A 24MP phone photo is 92MB of GPU memory; at 2560 it is about 12MB, and on
 *  a DPR-2 screen there is nothing on offer past that a viewer could see. */
export const MAX_UPLOAD_EDGE = 2560;

/* ── resolving a preference to CSS ──────────────────────────────────────── */

export function getWallpaper(id: string): Wallpaper | undefined {
  return BY_ID.get(id);
}

export function wallpapersInGroup(group: WallpaperGroup): Wallpaper[] {
  return WALLPAPERS.filter((w) => w.group === group);
}

/** Is this preference the animated canvas? Everything downstream branches on
 *  this one question, so it is asked in exactly one place. */
export function isLive(pref: WallpaperPref | null | undefined): boolean {
  return (pref?.id ?? DEFAULT_WALLPAPER_ID) === DEFAULT_WALLPAPER_ID;
}

/** Four faces of the dynamic wallpaper. Deliberately coarse: a wallpaper that
 *  visibly redraws while you look at it is a distraction, and a boundary you
 *  cross twice a day is a pleasant surprise. `hour` is injected so this is
 *  testable and so callers control the clock. */
export function dynamicCss(theme: ThemeMode, hour: number): string {
  const phase =
    hour >= 22 || hour < 5 ? "night" :
    hour < 8 ? "dawn" :
    hour < 17 ? "day" : "dusk";

  if (theme === "light") {
    return {
      night: `radial-gradient(100% 80% at 50% 0%, #C9D6EA 0%, transparent 62%), linear-gradient(180deg, #E9EEF7 0%, #FAFCFF 100%)`,
      dawn: `radial-gradient(100% 80% at 30% 104%, #F6D9C7 0%, transparent 60%), linear-gradient(170deg, #FFFDFB 0%, #DCE7F5 100%)`,
      day: `radial-gradient(110% 85% at 50% 8%, ${HUB[0]} 0%, transparent 64%), linear-gradient(180deg, #FFFFFF 0%, #DFEBF7 100%)`,
      dusk: `radial-gradient(100% 80% at 72% 100%, #E7C9DC 0%, transparent 60%), linear-gradient(165deg, #FFFCFD 0%, #D8DEF0 100%)`,
    }[phase];
  }
  return {
    night: `radial-gradient(100% 80% at 50% 0%, #16203A 0%, transparent 62%), linear-gradient(180deg, #080B14 0%, #04060A 100%)`,
    dawn: `radial-gradient(100% 80% at 30% 104%, #4A3350 0%, transparent 60%), linear-gradient(170deg, #0B0A14 0%, #0D1728 100%)`,
    day: `radial-gradient(110% 85% at 50% 8%, ${HUB[2]}88 0%, transparent 64%), linear-gradient(180deg, #071020 0%, #04070D 100%)`,
    dusk: `radial-gradient(100% 80% at 72% 100%, #4B2C4A 0%, transparent 60%), linear-gradient(165deg, #0C0912 0%, #060810 100%)`,
  }[phase];
}

/** Wrap a bare colour so it is a legal background-IMAGE.
 *
 *  Why everything here is an image and never the `background` shorthand: the
 *  shorthand RESETS background-size, -position and -repeat to their defaults.
 *  Setting it beside fitStyle()'s longhands in one style object is a race that
 *  React warns about by name — "Updating a style property during rerender when
 *  a conflicting property is set" — and the failure is silent and occasional:
 *  a photo's fill style quietly reverting to auto on some later render. The
 *  colour wallpapers are the only values that are not already images, so they
 *  become a two-stop gradient of themselves. */
export function asImage(v: string): string {
  const t = v.trim();
  return /^(#|rgb|hsl)/i.test(t) ? `linear-gradient(${t}, ${t})` : t;
}

/** The background-IMAGE for a preference, or null when the wave field should
 *  paint instead. Pair it with fitStyle(); never assign it to `background`.
 *  `hour` is only read for the dynamic wallpaper. */
export function backgroundCss(
  pref: WallpaperPref | null | undefined,
  theme: ThemeMode,
  hour: number,
): string | null {
  if (isLive(pref)) return null;

  if (pref?.id === PHOTO_ID) {
    if (!pref.photoUrl) return null;      // upload lost → fall back to the field
    /* url() is quoted because a Storage path can contain characters that end
       an unquoted url() early, and a broken background silently shows the
       page's own colour rather than erroring. */
    return `url("${pref.photoUrl.replace(/"/g, '%22')}")`;
  }

  const w = pref?.id ? BY_ID.get(pref.id) : undefined;
  if (!w) return null;
  if (w.kind === "dynamic") return asImage(dynamicCss(theme, hour));
  return asImage(theme === "light" ? w.light : w.dark);
}

/** background-size / position for photos; the gradients ignore it. */
export function fitStyle(fit: WallpaperFit | undefined): {
  backgroundSize: string; backgroundPosition: string; backgroundRepeat: string;
} {
  const size =
    fit === "fit" ? "contain" :
    fit === "stretch" ? "100% 100%" :
    fit === "center" ? "auto" : "cover";
  return { backgroundSize: size, backgroundPosition: "center", backgroundRepeat: "no-repeat" };
}

/** Scrim strength for a preference, 0–100. An uploaded photo gets a floor of
 *  PHOTO_MIN_DIM regardless of the catalogue, because we cannot know what is
 *  in it and white text on someone's beach holiday is unreadable. The user can
 *  still raise it; they cannot lower it past legibility by accident. */
export const PHOTO_MIN_DIM = 38;

export function dimFor(pref: WallpaperPref | null | undefined): number {
  if (isLive(pref)) return 0;                       // the field owns its floor
  const base = pref?.id === PHOTO_ID
    ? PHOTO_MIN_DIM
    : (pref?.id ? BY_ID.get(pref.id)?.dim ?? 44 : 44);
  const user = pref?.dim;
  if (typeof user !== "number") return base;
  return pref?.id === PHOTO_ID ? Math.max(PHOTO_MIN_DIM, user) : clamp(user);
}

function clamp(n: number): number { return Math.min(100, Math.max(0, n)); }

/** The readability scrim drawn over any non-live ground. Same shape as
 *  WavyBackground's contrast floor — brightest at the centre, heaviest at the
 *  edges, because that is where the header ramp and the letterbar sit. */
export function floorCss(theme: ThemeMode, dim: number): string {
  const a = clamp(dim) / 100;
  const rgb = theme === "light" ? "247,249,252" : "5,7,12";
  return `radial-gradient(120% 90% at 50% 62%,
            rgba(${rgb},${(a * 0.55).toFixed(3)}) 0%,
            rgba(${rgb},${(a * 0.72).toFixed(3)}) 54%,
            rgba(${rgb},${Math.min(0.94, a * 1.18).toFixed(3)}) 100%)`;
}

/* ── persistence ────────────────────────────────────────────────────────── */

/* The mirror exists so the ground is right on the FIRST paint rather than
   after the account request lands — the same trick display-prefs plays for
   text scale. It holds the choice only: an id, a URL, two numbers. */
const CACHE_KEY = "koleex-wallpaper";

export function readCachedWallpaper(): WallpaperPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as WallpaperPref;
    return p && typeof p.id === "string" ? p : null;
  } catch { return null; }
}

export function cacheWallpaper(pref: WallpaperPref | null): void {
  try {
    if (!pref) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(pref));
  } catch { /* quota or private mode — the account copy is the source of truth */ }
}

/** Broadcast name. The picker sets a preference and every mounted ground
 *  reacts, including the one behind the picker itself, so the choice is
 *  visible in place instead of after a reload. */
export const WALLPAPER_EVENT = "koleex:wallpaper";

export function announceWallpaper(pref: WallpaperPref): void {
  cacheWallpaper(pref);
  window.dispatchEvent(new CustomEvent<WallpaperPref>(WALLPAPER_EVENT, { detail: pref }));
}

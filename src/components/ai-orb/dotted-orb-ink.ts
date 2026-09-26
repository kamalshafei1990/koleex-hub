/* ---------------------------------------------------------------------------
   The dotted orb's colours.

   Owner, 2026-09-23, choosing from live samples drawn over the real Aurora
   ground: "Aurora flow" — the dots wear the wave field's own blues, and the
   colours ripple through the sphere with the field's own noise, so the orb
   and the ground behind it read as one picture. And: "this only for Aurora
   style — if I change the system style to Core, the orb becomes the basic
   one." So the palette follows the SKIN, nothing else:

     · Aurora skin → "aurora": the field's blues, rippling.
     · Core skin   → "mono":   the original grey ink, exactly as before.

   The ripple is calmer than the sample he saw (the owner agreed: the shape
   already changes, the colour must not compete with it), and it stands still
   wherever motion is unwelcome or unaffordable — see dottedFlows().

   Pure (no React, no DOM), so validate:ai-orb checks every rule here.
   --------------------------------------------------------------------------- */

import { buildNoise3D } from "@/lib/aurora-field";

export type DottedPalette = "mono" | "aurora";
export type RGB = readonly [number, number, number];

/** The skin decides — `data-kx-skin` on <html>. Anything but Aurora is the
 *  basic orb, so an unknown or missing skin can never dress it up. Pure. */
export function dottedPalette(skin: string | null | undefined): DottedPalette {
  return skin === "aurora" ? "aurora" : "mono";
}

/** Top of the sphere to the bottom, per GROUND (a dark ground carries light
 *  dots). Every stop is one of the Aurora field's own colours
 *  (AURORA_PALETTES — validate:ai-orb holds that): the ice blue at the top of
 *  the dark field down to its steel, and on a light ground the field's mid
 *  blues down to its deep one, so a dot is never paler than paper. */
export const AURORA_RAMP: Record<"dark" | "light", readonly string[]> = {
  dark: ["#BCD8F0", "#8FB0D4", "#567FB2", "#3E6796"],
  light: ["#7FA9D6", "#567FB2", "#3E6796", "#2E4B6B"],
};

/** How the colour field sits on the orb: 1.6 noise features across its
 *  width (one soft band or two, never speckle), spread wide enough to reach
 *  both ends of the ramp. */
export const AURORA_FLOW_SCALE = 1.6;
export const AURORA_FLOW_SPREAD = 0.9;
/** Noise units per second. The approved sample ran 0.25; this is the
 *  promised "a little slower", so the colour drifts while the shape moves. */
export const AURORA_FLOW_RATE = 0.15;

function hexRGB(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RAMP_RGB: Record<"dark" | "light", readonly RGB[]> = {
  dark: AURORA_RAMP.dark.map(hexRGB),
  light: AURORA_RAMP.light.map(hexRGB),
};

/** The ramp at `u` (0 = top stop, 1 = bottom), clamped. Pure. */
export function rampAt(ground: "dark" | "light", u: number): RGB {
  const stops = RAMP_RGB[ground];
  const v = (Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0.5) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(v));
  const f = v - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Does the colour ripple? Only on the full-size tuning (at 20-dot sizes a
 *  chat bubble's orb is too small for a ripple to read, so it would be cost
 *  with nothing to show), never in stillness, never on a machine the Hub has
 *  marked low-power. Where it does not ripple the colours are still there —
 *  the same field, held at one instant. Pure. */
export function dottedFlows(palette: DottedPalette, preset: 20 | 64, still: boolean, lowPower: boolean): boolean {
  return palette === "aurora" && preset === 64 && !still && !lowPower;
}

let sharedNoise: ((x: number, y: number, z: number) => number) | null = null;
/** One noise for every orb on the page — the field's own, built once. */
export function auroraNoise(): (x: number, y: number, z: number) => number {
  return (sharedNoise ??= buildNoise3D());
}

/** The Aurora colour at a point of the orb at time `t` (seconds; hold it at
 *  0 for the still field). Colour belongs to the PLACE, not to the dot, so
 *  dots travel through it as they turn and a morph needs nothing extra. */
export function auroraTint(
  noise: (x: number, y: number, z: number) => number,
  x: number, y: number, size: number, t: number, ground: "dark" | "light",
): RGB {
  const u = 0.5 + noise((x / size) * AURORA_FLOW_SCALE, (y / size) * AURORA_FLOW_SCALE, t * AURORA_FLOW_RATE) * AURORA_FLOW_SPREAD;
  return rampAt(ground, u);
}

/** The engine's ink convention: `white` is the value ON PAPER — 0 is the
 *  strongest ink (a near dot), 1 is none (a far one). */
function strength(white: number): number {
  return 1 - Math.min(1, Math.max(0, Number.isFinite(white) ? white : 1));
}

/** The original grey ink, byte for byte what the orb drew before colour:
 *  mirrored on a dark ground so the near dots read bright. Pure. */
export function monoInk(white: number, alpha: number, darkGround: boolean): string {
  const w = Math.min(1, Math.max(0, white));
  const g = Math.round((darkGround ? 1 - w : w) * 255);
  return `rgba(${g},${g},${g},${alpha})`;
}

/** A tinted dot that keeps the sphere's depth: strong ink is the colour
 *  itself — lifted toward white on a dark ground, deepened on a light one,
 *  so the nearest dots still sparkle — and weak ink sinks into the ground.
 *  Pure. */
export function tintedInk(white: number, tint: RGB, alpha: number, darkGround: boolean): string {
  const k = strength(white);
  const body = Math.min(1, (darkGround ? 0.2 : 0.15) + 1.6 * k);
  const top = Math.max(0, (k - 0.6) / 0.4) * (darkGround ? 0.45 : 0.3);
  const from = darkGround ? 10 : 255;
  const to = darkGround ? 255 : 0;
  const ch = (c: number) => {
    const b = from + (c - from) * body;
    return Math.round(b + (to - b) * top);
  };
  return `rgba(${ch(tint[0])},${ch(tint[1])},${ch(tint[2])},${alpha})`;
}

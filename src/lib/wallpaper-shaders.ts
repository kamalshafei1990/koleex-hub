/* Shader wallpapers — the animated grounds, and the one colour that drives them.
   ---------------------------------------------------------------------------
   Ported from React Bits (https://reactbits.dev), MIT + Commons Clause,
   Copyright (c) 2026 David Haz. Full licence text sits beside the components in
   components/wallpapers/reactbits/LICENSE.md. That licence permits use inside
   our own product and forbids reselling the components themselves, which is
   exactly what we are doing and not doing.

   WHY 25 AND NOT 53. The library ships 53 backgrounds on three different
   stacks. Thirteen of them need three.js + @react-three/fiber, whose unpacked
   size is 23MB against OGL's 423KB — fifty-five times the weight for the same
   job — so they are out. Of the OGL ones, these 25 expose a hex colour prop,
   which is the whole point: the owner asked for wallpapers whose colour
   follows the colour picked in Settings.

   ONE COLOUR IN, A PALETTE OUT. Every component names its colours differently
   — color1/color2/color3, colorStops, tint, eyeColor, gridColor, rayColor1.
   Asking someone to fill three colour slots per wallpaper would be a chore, so
   the picker offers ONE colour and `palette()` derives a light and a dark
   partner from it. Each entry's `tint` maps that trio onto its own prop names.
   Adding a 26th wallpaper is a file, a loader line and one entry.

   THE MAPPINGS WERE GENERATED, NOT TYPED. Twenty-five components with
   different prop names is exactly where a hand-written table grows a silent
   typo — a wrong key is not a type error, it is a prop React quietly ignores
   and a wallpaper that never changes colour. */

import type { ComponentType } from "react";

/** A colour trio derived from the single colour the user picked. */
export interface TintPalette { base: string; light: string; dark: string }

export interface ShaderWallpaper {
  id: string;
  /** Slot in public/wallpapers/shader-thumbs.webp.
   *
   *  PINNED, not derived from array position. The sheet was rendered from the
   *  full generated list; two entries were then removed because they never
   *  produced a canvas to capture. Deriving the offset from the index would
   *  have silently shifted every thumbnail after them onto the wrong
   *  wallpaper — a bug that looks like nothing at all until you notice the
   *  picture never matches the name. */
  sprite: number;
  /** The prop that turns cursor-following OFF, for the two components that
   *  have one. Named per entry rather than passed to everybody: several of
   *  these spread `...rest` onto their container, so an unknown prop lands on
   *  a real DOM node and React warns about it in the console. */
  mouseProp?: "mouseInteraction" | "mouseReact";
  /** File under components/wallpapers/reactbits — also the LOADERS key. */
  component: string;
  nameKey: string;
  /** Maps the derived palette onto this component's own colour props. */
  tint: (p: TintPalette) => Record<string, unknown>;
}

export const SHADER_WALLPAPERS: ShaderWallpaper[] = [
  { id: "fx-acid-squares", component: "AcidSquares", sprite: 0, nameKey: "wp.fx.acidSquares",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-aurora", component: "Aurora", sprite: 1, nameKey: "wp.fx.aurora",
    tint: (p) => ({ colorStops: [p.dark, p.base, p.light] }) },
  { id: "fx-balatro", component: "Balatro", sprite: 2, mouseProp: "mouseInteraction", nameKey: "wp.fx.balatro",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-evil-eye", component: "EvilEye", sprite: 3, nameKey: "wp.fx.evilEye",
    tint: (p) => ({ eyeColor: p.base, backgroundColor: p.dark }) },
  { id: "fx-faulty-terminal", component: "FaultyTerminal", sprite: 4, mouseProp: "mouseReact", nameKey: "wp.fx.faultyTerminal",
    tint: (p) => ({ tint: p.base }) },
  { id: "fx-ferrofluid", component: "Ferrofluid", sprite: 5, nameKey: "wp.fx.ferrofluid",
    tint: (p) => ({ colors: [p.dark, p.base, p.light] }) },
  { id: "fx-gradient-waves", component: "GradientWaves", sprite: 6, nameKey: "wp.fx.gradientWaves",
    tint: (p) => ({ horizonColor: p.base, waveColor: p.light, crestColor: p.dark }) },
  { id: "fx-grainient", component: "Grainient", sprite: 7, nameKey: "wp.fx.grainient",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-light-tunnel", component: "LightTunnel", sprite: 9, nameKey: "wp.fx.lightTunnel",
    tint: (p) => ({ cableColor: p.base, pulseColor: p.light, tunnelColor: p.dark }) },
  { id: "fx-lightfall", component: "Lightfall", sprite: 10, nameKey: "wp.fx.lightfall",
    tint: (p) => ({ colors: [p.dark, p.base, p.light] }) },
  { id: "fx-line-waves", component: "LineWaves", sprite: 11, nameKey: "wp.fx.lineWaves",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-molten-metal", component: "MoltenMetal", sprite: 12, nameKey: "wp.fx.moltenMetal",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-orb", component: "Orb", sprite: 13, nameKey: "wp.fx.orb",
    tint: (p) => ({ backgroundColor: p.base }) },
  { id: "fx-particles", component: "Particles", sprite: 14, nameKey: "wp.fx.particles",
    tint: (p) => ({ defaultColors: [p.dark, p.base, p.light] }) },
  { id: "fx-plasma", component: "Plasma", sprite: 15, nameKey: "wp.fx.plasma",
    tint: (p) => ({ color: p.base }) },
  { id: "fx-plasma-wave", component: "PlasmaWave", sprite: 16, nameKey: "wp.fx.plasmaWave",
    tint: (p) => ({ colors: [p.dark, p.base, p.light] }) },
  { id: "fx-radar", component: "Radar", sprite: 17, nameKey: "wp.fx.radar",
    tint: (p) => ({ color: p.base, backgroundColor: p.dark }) },
  { id: "fx-ripple-grid", component: "RippleGrid", sprite: 18, nameKey: "wp.fx.rippleGrid",
    tint: (p) => ({ gridColor: p.base }) },
  { id: "fx-scanner", component: "Scanner", sprite: 19, nameKey: "wp.fx.scanner",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-sliced-waves", component: "SlicedWaves", sprite: 21, nameKey: "wp.fx.slicedWaves",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
  { id: "fx-soft-aurora", component: "SoftAurora", sprite: 22, nameKey: "wp.fx.softAurora",
    tint: (p) => ({ color1: p.base, color2: p.dark }) },
  { id: "fx-topography", component: "Topography", sprite: 23, nameKey: "wp.fx.topography",
    tint: (p) => ({ lowColor: p.base, midColor: p.light, highColor: p.dark }) },
  { id: "fx-web-threads", component: "WebThreads", sprite: 24, nameKey: "wp.fx.webThreads",
    tint: (p) => ({ color1: p.base, color2: p.light, color3: p.dark }) },
];

const BY_ID = new Map(SHADER_WALLPAPERS.map((s) => [s.id, s]));

export function getShader(id: string): ShaderWallpaper | undefined {
  return BY_ID.get(id);
}

export function isShaderId(id: string): boolean {
  return BY_ID.has(id);
}

/* STATIC IMPORT PATHS, ONE PER COMPONENT. A template literal here would defeat
   the bundler: it cannot split what it cannot see, and every shader would land
   in one chunk that everybody downloads. Written out, exactly one shader's code
   is fetched, and only when it is chosen. */
type ShaderModule = { default: ComponentType<Record<string, unknown>> };

export const LOADERS = {
  AcidSquares: () => import("@/components/wallpapers/reactbits/AcidSquares.jsx"),
  Aurora: () => import("@/components/wallpapers/reactbits/Aurora.jsx"),
  Balatro: () => import("@/components/wallpapers/reactbits/Balatro.jsx"),
  EvilEye: () => import("@/components/wallpapers/reactbits/EvilEye.jsx"),
  FaultyTerminal: () => import("@/components/wallpapers/reactbits/FaultyTerminal.jsx"),
  Ferrofluid: () => import("@/components/wallpapers/reactbits/Ferrofluid.jsx"),
  GradientWaves: () => import("@/components/wallpapers/reactbits/GradientWaves.jsx"),
  Grainient: () => import("@/components/wallpapers/reactbits/Grainient.jsx"),
  LightTunnel: () => import("@/components/wallpapers/reactbits/LightTunnel.jsx"),
  Lightfall: () => import("@/components/wallpapers/reactbits/Lightfall.jsx"),
  LineWaves: () => import("@/components/wallpapers/reactbits/LineWaves.jsx"),
  MoltenMetal: () => import("@/components/wallpapers/reactbits/MoltenMetal.jsx"),
  Orb: () => import("@/components/wallpapers/reactbits/Orb.jsx"),
  Particles: () => import("@/components/wallpapers/reactbits/Particles.jsx"),
  Plasma: () => import("@/components/wallpapers/reactbits/Plasma.jsx"),
  PlasmaWave: () => import("@/components/wallpapers/reactbits/PlasmaWave.jsx"),
  Radar: () => import("@/components/wallpapers/reactbits/Radar.jsx"),
  RippleGrid: () => import("@/components/wallpapers/reactbits/RippleGrid.jsx"),
  Scanner: () => import("@/components/wallpapers/reactbits/Scanner.jsx"),
  SlicedWaves: () => import("@/components/wallpapers/reactbits/SlicedWaves.jsx"),
  SoftAurora: () => import("@/components/wallpapers/reactbits/SoftAurora.jsx"),
  Topography: () => import("@/components/wallpapers/reactbits/Topography.jsx"),
  WebThreads: () => import("@/components/wallpapers/reactbits/WebThreads.jsx"),
  /* ONE cast, at the boundary, rather than twenty-five. Four of these
     components declare narrower prop types than the generic host passes
     (Ferrofluid wants string[], FaultyTerminal a specific union), and the host
     cannot know any of them — it forwards whatever `tint` produced. Widening
     here keeps the ignorance in one place instead of sprinkling `any`. */
} as unknown as Record<string, () => Promise<ShaderModule>>;

/* ── colour ─────────────────────────────────────────────────────────────── */

function clamp255(n: number): number { return Math.min(255, Math.max(0, Math.round(n))); }

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
}

/** One picked colour becomes three.
 *
 *  Mixed toward white and toward black rather than shifted in HSL, because a
 *  saturated hue rotated in HSL drifts to a different colour and the result
 *  stops looking like the swatch the user tapped. Mixing keeps the hue and
 *  only moves the value, which is what "a lighter version of this" means to
 *  the person choosing. */
export function palette(hex: string): TintPalette {
  const [r, g, b] = toRgb(hex);
  const mix = (t: number, target: number) =>
    toHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
  return { base: toHex(r, g, b), light: mix(0.45, 255), dark: mix(0.55, 0) };
}

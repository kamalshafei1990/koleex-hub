/* ---------------------------------------------------------------------------
   brand-book/tokens — the brand colours as data.

   Only the HEX values are written by hand. RGB, CMYK and every contrast
   ratio the book prints are computed from them here, so a number on a page
   can never disagree with the colour beside it.

   CMYK values are a mathematical starting point (sRGB → CMYK, no ICC
   profile). They are labelled that way in the book: a printer matches them
   on a physical proof before a job runs.

   The identity (owner decisions, 27/09/2026, Apple direction):
     · black and white carry every piece;
     · four neutrals (Graphite, Gray, Mist, Cloud) do the quiet work;
     · SILVER is the premium material — one smooth, slightly shiny
       gradient on screen, real silver foil (Pantone 877 C) in print. It is
       never the colour of the logo;
     · HUB BLUE is the action — links and buttons only, never decoration;
     · status colours only show a state.
   Proportions in a layout: black or white 60 · neutrals 28 · silver 8 ·
   Hub Blue 4.
   --------------------------------------------------------------------------- */

export type ColorGroup = "core" | "neutral" | "silver" | "hub" | "status";

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  group: ColorGroup;
  role: string;
}

export const BRAND_COLORS: BrandColor[] = [
  { id: "black", name: "Black", hex: "#000000", group: "core", role: "The logo on light, the ground of heroes, product photos and covers." },
  { id: "white", name: "White", hex: "#FFFFFF", group: "core", role: "Paper, pages, the logo on dark, catalog photo backgrounds." },
  { id: "graphite", name: "Graphite", hex: "#1D1D1F", group: "neutral", role: "Headlines and body text on white; panels on black." },
  { id: "gray", name: "Gray", hex: "#6E6E73", group: "neutral", role: "Secondary text, captions and labels." },
  { id: "mist", name: "Mist", hex: "#D2D2D7", group: "neutral", role: "Hairlines, borders and table rules." },
  { id: "cloud", name: "Cloud", hex: "#F5F5F7", group: "neutral", role: "Light panels and tiles behind content." },
  { id: "silver", name: "Silver", hex: "#C7C7CC", group: "silver", role: "The premium material: big headlines on black, the machine finish, nameplates. The gradient below; foil in print." },
  { id: "deep", name: "Hub Blue Deep", hex: "#3E6796", group: "hub", role: "Links and buttons on white." },
  { id: "steel", name: "Hub Blue Steel", hex: "#567FB2", group: "hub", role: "The core Hub Blue: filled buttons and the Hub mark." },
  { id: "sky", name: "Hub Blue Sky", hex: "#7FA9D6", group: "hub", role: "Links and buttons on black." },
  { id: "ice", name: "Hub Blue Ice", hex: "#BCD8F0", group: "hub", role: "Pressed and selected states behind dark text." },
  { id: "success", name: "Status Green", hex: "#059669", group: "status", role: "Success and approval states only." },
  { id: "warning", name: "Status Amber", hex: "#D97706", group: "status", role: "Warnings and pending states only." },
  { id: "error", name: "Status Red", hex: "#DC2626", group: "status", role: "Errors and rejections only." },
];

/** Silver — one smooth gradient with a single soft highlight (owner,
 *  27/09/2026: "gradient, not wavy", "a little shiny"). */
export const SILVER = {
  stops: ["#AEAEB2", "#FFFFFF", "#D1D1D6", "#8E8E93"] as const,
  /** Surfaces, swatches, nameplates. */
  css: "linear-gradient(135deg, #AEAEB2 0%, #FFFFFF 38%, #D1D1D6 60%, #8E8E93 100%)",
  /** Headlines on black (use with background-clip: text). */
  cssText: "linear-gradient(170deg, #C7C7CC 0%, #FFFFFF 35%, #D1D1D6 60%, #8E8E93 100%)",
  /** The machine finish in photographs and stand-ins, lit from above. */
  cssFinish: "linear-gradient(180deg, #D1D1D6 0%, #FFFFFF 22%, #C7C7CC 55%, #8E8E93 100%)",
  pantone: "Pantone 877 C (metallic silver)",
  foil: "Silver hot-foil stamping",
} as const;

/** The Hub mark's own gradient. It belongs to the Koleex Hub mark and the
 *  Hub interface; it is not a decoration for KOLEEX layouts. */
export const HUB_GRADIENT = {
  from: "#567FB2",
  to: "#BCD8F0",
  css: "linear-gradient(180deg, #567FB2 0%, #BCD8F0 100%)",
  cssHorizontal: "linear-gradient(90deg, #567FB2 0%, #BCD8F0 100%)",
} as const;

/** Share of a layout, in percent (owner, 27/09/2026). */
export const PROPORTIONS = [
  { id: "base", label: "Black or white", pct: 60 },
  { id: "neutral", label: "Neutrals", pct: 28 },
  { id: "silver", label: "Silver", pct: 8 },
  { id: "hub", label: "Hub Blue", pct: 4 },
] as const;

export function color(id: string): BrandColor {
  const c = BRAND_COLORS.find((x) => x.id === id);
  if (!c) throw new Error(`brand-book: unknown colour ${id}`);
  return c;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbText(hex: string): string {
  return hexToRgb(hex).join(" · ");
}

/** Naive sRGB → CMYK, rounded to whole percents. A starting point for a proof. */
export function cmyk(hex: string): [number, number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return [c, m, y, k].map((v) => Math.round(v * 100)) as [number, number, number, number];
}

export function cmykText(hex: string): string {
  const [c, m, y, k] = cmyk(hex);
  return `C${c} M${m} Y${y} K${k}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, e.g. 21 for black on white. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "AA Large" | "Fail";

export function grade(ratio: number): ContrastGrade {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

export function ratioText(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

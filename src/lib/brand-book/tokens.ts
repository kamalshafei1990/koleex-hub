/* ---------------------------------------------------------------------------
   brand-book/tokens — the brand colours as data.

   Only the HEX values are written by hand. RGB, CMYK and every contrast
   ratio the book prints are computed from them here, so a number on a page
   can never disagree with the colour beside it.

   CMYK values are a mathematical starting point (sRGB → CMYK, no ICC
   profile). They are labelled that way in the book: a printer matches them
   on a physical proof before a job runs. No Pantone reference is claimed
   until one has been matched on press.

   Brand hierarchy (owner decision, 31/07/2026): black → white → Hub Blue.
   Hub Blue is used everywhere — the Hub, marketing and print (owner,
   27/09/2026) — as an accent, never as a flood.
   --------------------------------------------------------------------------- */

export type ColorGroup = "core" | "hub" | "neutral" | "status";

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  group: ColorGroup;
  role: string;
}

export const BRAND_COLORS: BrandColor[] = [
  { id: "black", name: "KOLEEX Black", hex: "#000000", group: "core", role: "The logo on light backgrounds. Pure black, nothing else." },
  { id: "ink", name: "Ink", hex: "#0A0A0A", group: "core", role: "Dark surfaces: covers, social posts, booth walls, app icon ground." },
  { id: "white", name: "White", hex: "#FFFFFF", group: "core", role: "Paper, documents, the logo on dark backgrounds." },
  { id: "deep", name: "Hub Blue Deep", hex: "#3E6796", group: "hub", role: "Blue text and links on white. Blue fields behind white type." },
  { id: "steel", name: "Hub Blue Steel", hex: "#567FB2", group: "hub", role: "The core Hub Blue: accents, highlights, the start of the gradient." },
  { id: "sky", name: "Hub Blue Sky", hex: "#7FA9D6", group: "hub", role: "Accents on dark backgrounds, charts, secondary highlights." },
  { id: "ice", name: "Hub Blue Ice", hex: "#BCD8F0", group: "hub", role: "The end of the gradient, tints, quiet fills behind dark text." },
  { id: "ink-soft", name: "Graphite", hex: "#1A1A1A", group: "neutral", role: "Body text on white in documents; secondary dark surface." },
  { id: "soft", name: "Slate", hex: "#4B5563", group: "neutral", role: "Secondary text, captions, labels on white." },
  { id: "ghost", name: "Silver", hex: "#9CA3AF", group: "neutral", role: "Hairlines, disabled states, text on dark backgrounds." },
  { id: "border", name: "Mist", hex: "#E5E7EB", group: "neutral", role: "Borders and table rules on white." },
  { id: "surface", name: "Cloud", hex: "#F5F5F5", group: "neutral", role: "Light panels, strips and table fills." },
  { id: "success", name: "Status Green", hex: "#059669", group: "status", role: "Success and approval states only." },
  { id: "warning", name: "Status Amber", hex: "#D97706", group: "status", role: "Warnings and pending states only." },
  { id: "error", name: "Status Red", hex: "#DC2626", group: "status", role: "Errors and rejections only." },
];

export const HUB_GRADIENT = {
  from: "#567FB2",
  to: "#BCD8F0",
  css: "linear-gradient(180deg, #567FB2 0%, #BCD8F0 100%)",
  cssHorizontal: "linear-gradient(90deg, #567FB2 0%, #BCD8F0 100%)",
} as const;

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

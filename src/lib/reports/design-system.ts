/* ===========================================================================
   Phase R — Enterprise Reporting Design System.

   The single source of truth for every visual decision in the report
   document layer:
     · typography scale + font stack + tabular numerics
     · spacing scale (rem-equivalent, expressed in px because we emit
       static HTML/PDF — no styled-components, no CSS variables that
       leak across documents)
     · grayscale palette (no chroma anywhere except the classification
       accent line — and even that is muted)
     · A4 page geometry with print margins
     · classification accent map (EXTERNAL / INTERNAL / EXECUTIVE)

   The rendering layers (layout, table, document) NEVER hardcode a
   colour or pixel value — they read from this module. That makes
   document tone consistent and any future "branded variant" a single-
   file change.

   Style anchors (Apple documentation + enterprise accounting + bank
   statement):
     · pure white background, black ink
     · no rounded cards, no gradients, no shadows, no neon, no glow
     · hairline borders, generous whitespace, tabular numerics
     · hierarchy through type weight + spacing, NOT colour
   ========================================================================== */

import type { ReportVisibility } from "./types";

/* ─── Typography ───────────────────────────────────────────────────── */

export const FONT_STACK = {
  /* Latin script default. Helvetica / SF are present on every device
     puppeteer is likely to encounter. Inter is the explicit Hub
     fallback for legacy systems. Phase R.3 adds CJK and Arabic
     system fallbacks at the end of the stack so a payload with
     locale="zh-CN" or "ar" renders correctly without us shipping any
     embedded fonts (huge PDF blow-up is the easy mistake here). */
  body: [
    "-apple-system",
    "BlinkMacSystemFont",
    '"Helvetica Neue"',
    "Helvetica",
    '"Inter"',
    "Arial",
    /* CJK system fallbacks — covered by macOS / Windows / Linux. */
    '"PingFang SC"',                /* macOS Chinese */
    '"Microsoft YaHei"',             /* Windows Chinese */
    '"Noto Sans CJK SC"',            /* Linux Chinese */
    '"Hiragino Sans"',               /* Japanese */
    /* Arabic system fallbacks. */
    '"SF Arabic"',
    '"Geeza Pro"',
    '"Tahoma"',
    "sans-serif",
  ].join(", "),
  /* Mono for numbers + report references. tabular-nums turned on at
     usage time so columns line up under different glyph widths. */
  mono: '"SF Mono", "ui-monospace", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

/* Locale → text-direction map. Architecture-ready for the AR ship in
   future phases; the renderer reads this when composing the <html
   dir="…"> attribute. */
const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);
export function directionForLocale(locale: string): "ltr" | "rtl" {
  const lang = (locale || "en").toLowerCase().split(/[-_]/)[0];
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

/* Type scale in pt — the same numbers map to px in CSS, but we
   author in pt so the relationship to paper output stays explicit. */
export const TYPE = {
  /* Headline of the document (e.g. "Customer Account Statement"). */
  documentTitle:    { size: 20, weight: 700, lineHeight: 1.15, tracking: "-0.01em" },
  /* Section headings inside the document. */
  sectionTitle:     {  size: 10, weight: 700, lineHeight: 1.4,  tracking: "0.08em",  upper: true },
  /* Recipient / company-block name. */
  partyName:        { size: 12, weight: 700, lineHeight: 1.3 },
  /* Body / paragraph copy. */
  body:             { size: 10, weight: 400, lineHeight: 1.5 },
  /* Small body for footers, captions. */
  caption:          { size: 8,  weight: 400, lineHeight: 1.4 },
  /* Labels above values in summary grids etc. */
  label:            { size: 8,  weight: 600, lineHeight: 1.3,  tracking: "0.10em", upper: true },
  /* Numeric display in summary grids. */
  summaryValue:     { size: 14, weight: 700, lineHeight: 1.2 },
  /* Numeric display in table cells. */
  tableNumber:      { size: 10, weight: 400, lineHeight: 1.3 },
  /* Table column header. */
  tableHeader:      { size: 8,  weight: 700, lineHeight: 1.3,  tracking: "0.08em", upper: true },
  /* Totals row label. */
  totalLabel:       { size: 10, weight: 600, lineHeight: 1.3 },
  /* Totals row value (the prominent final line). */
  totalValue:       { size: 12, weight: 700, lineHeight: 1.2 },
  /* The grand-total / balance-due row. */
  grandValue:       { size: 14, weight: 700, lineHeight: 1.2 },
  /* Meta strip in header — Report No, Generated, Period, Currency. */
  metaLabel:        { size: 7,  weight: 600, lineHeight: 1.3,  tracking: "0.10em", upper: true },
  metaValue:        { size: 9,  weight: 500, lineHeight: 1.3 },
  /* Classification chip. */
  classification:   { size: 8,  weight: 700, lineHeight: 1,    tracking: "0.18em", upper: true },
} as const;

export type TypeKey = keyof typeof TYPE;

/* ─── Spacing scale (pt-as-px) ────────────────────────────────────── */

/* 8pt grid. Use named tokens, not raw numbers, in every renderer. */
export const SPACE = {
  none: 0,
  xs:   4,
  sm:   6,
  md:   8,
  lg:   12,
  xl:   16,
  xxl:  20,
  xxxl: 28,
  /* Section gap — the visual rhythm between major blocks of a report.
     A real enterprise document leans on whitespace; cramming sections
     together is what makes the legacy renderer look like a dashboard. */
  section: 24,
  /* Document-edge inner padding inside the page <main>. */
  pageInner: 0,
} as const;

/* ─── Grayscale palette ───────────────────────────────────────────── */

/* No chroma anywhere except the classification accent. */
export const COLOR = {
  paper:      "#ffffff",
  ink:        "#0a0a0a",
  inkSoft:    "#262626",
  ink2:       "#404040",
  muted:      "#6b7280",
  mutedSoft:  "#9ca3af",
  zebra:      "#fafafa",     // even-row tint, deliberately near-white
  hairline:   "#d4d4d4",     // table dividers, hairline rules
  hairlineHard: "#0a0a0a",   // thead bottom border, totals top border
} as const;

/* Classification accent — a single muted line + a small chip.
   NEVER a giant warning band. The point is to label, not alarm. */
export const CLASSIFICATION_ACCENT: Record<ReportVisibility, { accent: string; label: string }> = {
  external: { accent: "#525252", label: "OFFICIAL · EXTERNAL" },
  internal: { accent: "#7f1d1d", label: "INTERNAL · CONFIDENTIAL" },
} as const;

/* Some reports are flagged "EXECUTIVE" in their internal_warning. We
   detect it by string match so existing builders don't have to opt
   in to a new field. */
export function classificationFor(
  visibility: ReportVisibility,
  warning: string | undefined,
): { accent: string; label: string } {
  if (visibility === "internal" && warning && warning.toLowerCase().includes("executive")) {
    return { accent: "#1e3a8a", label: "EXECUTIVE · CONFIDENTIAL" };
  }
  return CLASSIFICATION_ACCENT[visibility];
}

/* ─── A4 page geometry ────────────────────────────────────────────── */

/* Real paper. Width/height in mm; CSS uses mm directly via @page. */
export const PAGE = {
  size: "A4",
  /* Wider top margin than bottom so the document breathes from the
     header; bottom margin houses the page number footer. */
  margin: {
    top:    "18mm",
    right:  "16mm",
    bottom: "20mm",
    left:   "16mm",
  },
  /* Outer width that content lays out into (210mm − 32mm side
     margins). Tables and grids respect this. */
  contentWidthMm: 178,
} as const;

/* ─── Border weights ──────────────────────────────────────────────── */

export const BORDER = {
  hairline: `1px solid ${COLOR.hairline}`,
  hard:     `1px solid ${COLOR.hairlineHard}`,
  double:   `3px double ${COLOR.hairlineHard}`,
} as const;

/* ─── Compose a CSS declaration block for a TYPE token. ───────────── */
/* Returns a string fragment usable inside any `style="…"` attribute
   or inside a stylesheet declaration block. Keeping it one place
   means typography is consistent — every "section title" looks the
   same regardless of which renderer wrote it. */
export function typeCss(key: TypeKey): string {
  const t = TYPE[key];
  const parts: string[] = [
    `font-size:${t.size}pt`,
    `font-weight:${t.weight}`,
    `line-height:${t.lineHeight}`,
  ];
  if ("tracking" in t && t.tracking) parts.push(`letter-spacing:${t.tracking}`);
  if ("upper" in t && t.upper) parts.push("text-transform:uppercase");
  return parts.join(";");
}

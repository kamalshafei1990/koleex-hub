/* ---------------------------------------------------------------------------
   mock-products — v30 demo dataset for the "Real products using this
   configuration" section on every BreakdownCard. Pure mock data; in
   production this would come from the products table filtered by
   axis-vector match. Each fingerprint maps segment index → expected
   value; segments not listed in the fingerprint are treated as
   wildcards for matching.
   --------------------------------------------------------------------------- */

export type ProductFingerprint = {
  /** Subcategory prefix the product is built on (XSL / XSO / XSI). */
  prefix: string;
  /** Map of axis index → expected segment value. */
  segments: Record<number, string>;
};

export type MockProduct = {
  id: string;
  /** The canonical full SKU of the product, e.g. "XSL-Q10-5-E-560-M". */
  sku: string;
  /** Display name. Kept in English; translated via the LBL map if needed. */
  name: string;
  /** One-line summary used by the product card. */
  summary: string;
  /** Highlight chips — short tags shown beneath the summary. */
  highlights: string[];
  fingerprint: ProductFingerprint;
};

export const MOCK_PRODUCTS: MockProduct[] = [
  // ── XSL — Lockstitch ────────────────────────────────────────
  {
    id: "xsl-q10-5-e-560-m",
    sku: "XSL-Q10-5-E-560-M",
    name: "KOLEEX Q-Series Lockstitch · 560",
    summary: "Single-needle lockstitch · single stepper · long-arm bed",
    highlights: ["Single stepper", "Servo motor", "560 mm bed", "Medium material"],
    fingerprint: {
      prefix: "XSL",
      segments: { 1: "Q10", 2: "5", 4: "E", 5: "560", 6: "M" },
    },
  },
  {
    id: "xsl-q10-3-e-360-m",
    sku: "XSL-Q10-3-E-360-M",
    name: "KOLEEX Q-Series Lockstitch · 360",
    summary: "Single-needle lockstitch · 3-auto · standard length",
    highlights: ["3-auto", "Servo motor", "360 mm bed", "Medium material"],
    fingerprint: {
      prefix: "XSL",
      segments: { 1: "Q10", 2: "3", 4: "E", 5: "360", 6: "M" },
    },
  },
  {
    id: "xsl-a05-5-e-560-h",
    sku: "XSL-A05-5-E-560-H",
    name: "KOLEEX A-Series Heavy Lockstitch",
    summary: "A-line lockstitch · single stepper · heavy-material build",
    highlights: ["A-line", "Servo motor", "560 mm bed", "Heavy material"],
    fingerprint: {
      prefix: "XSL",
      segments: { 1: "A05", 2: "5", 4: "E", 5: "560", 6: "H" },
    },
  },
  {
    id: "xsl-q10-4-e-270-s",
    sku: "XSL-Q10-4-E-270-S",
    name: "KOLEEX Q-Series Thin-fabric Lockstitch",
    summary: "Single-needle lockstitch · 4-auto · short-arm · thin-fabric tuning",
    highlights: ["4-auto", "Servo motor", "270 mm bed", "Thin material"],
    fingerprint: {
      prefix: "XSL",
      segments: { 1: "Q10", 2: "4", 4: "E", 6: "S" },
    },
  },
  {
    id: "xsl-b00-5-e-560-m-hj",
    sku: "XSL-B00-5-E-560-M-HJ",
    name: "KOLEEX B-Series Premium Lockstitch · DLC",
    summary: "B-line lockstitch · single stepper · long-arm · DLC hook",
    highlights: ["Single stepper", "Servo motor", "560 mm bed", "DLC hook"],
    fingerprint: {
      prefix: "XSL",
      segments: { 1: "B00", 2: "5", 4: "E", 5: "560", 6: "M", 7: "HJ" },
    },
  },

  // ── XSO — Overlock ───────────────────────────────────────────
  {
    id: "xso-981-1-e-s-4-q",
    sku: "XSO-981-1-E-S-4-Q",
    name: "KOLEEX 981 Overlock · Pneumatic",
    summary: "Direct-drive overlock · stepping-auto · 4-thread · pneumatic",
    highlights: ["Stepping-auto", "4-thread", "Servo motor", "Pneumatic"],
    fingerprint: {
      prefix: "XSO",
      segments: { 1: "981", 2: "1", 3: "E", 4: "S", 5: "4", 6: "Q" },
    },
  },
  {
    id: "xso-851-1-e-a-5-bk",
    sku: "XSO-851-1-E-A-5-Bk",
    name: "KOLEEX 851 Overlock · 5-thread Reverse",
    summary: "Mix-type overlock · normal-auto · 5-thread · reverse seaming",
    highlights: ["Normal-auto", "5-thread", "Servo motor", "Reverse seaming"],
    fingerprint: {
      prefix: "XSO",
      segments: { 1: "851", 2: "1", 3: "E", 4: "A", 5: "5", 6: "Bk" },
    },
  },
  {
    id: "xso-747-1-e-d-3-cx",
    sku: "XSO-747-1-E-D-3-Cx",
    name: "KOLEEX 747F Overlock · Suction Trimmer",
    summary: "747F-type overlock · direct-drive · 3-thread · side-suction trimmer",
    highlights: ["Direct-drive", "3-thread", "Servo motor", "Side suction trimmer"],
    fingerprint: {
      prefix: "XSO",
      segments: { 1: "747", 2: "1", 3: "E", 4: "D", 5: "3", 6: "Cx" },
    },
  },

  // ── XSI — Interlock ─────────────────────────────────────────
  {
    id: "xsi-150-d-01-v",
    sku: "XSI-150-D-01-V",
    name: "KOLEEX 150 Interlock · Basic",
    summary: "Direct-drive interlock · basic stitch · upper trimmer",
    highlights: ["Direct-drive", "Basic stitch", "Upper trimmer"],
    fingerprint: {
      prefix: "XSI",
      segments: { 1: "150", 2: "D", 3: "01", 4: "V" },
    },
  },
  {
    id: "xsi-150-a-03-w",
    sku: "XSI-150-A-03-W",
    name: "KOLEEX 150 Interlock · Cover-seam",
    summary: "Normal-auto interlock · cover-seam · wiper",
    highlights: ["Normal-auto", "Cover-seam", "Wiper"],
    fingerprint: {
      prefix: "XSI",
      segments: { 1: "150", 2: "A", 3: "03", 4: "W" },
    },
  },
  {
    id: "xsi-150-s-31-q",
    sku: "XSI-150-S-31-Q",
    name: "KOLEEX 150 Interlock · All-in-one",
    summary: "Stepping-auto interlock · 01+02+03 combo · pneumatic",
    highlights: ["Stepping-auto", "All-in-one", "Pneumatic"],
    fingerprint: {
      prefix: "XSI",
      segments: { 1: "150", 2: "S", 3: "31", 4: "Q" },
    },
  },
];

/* Match score = matchingSegments / totalAxesPresentInFingerprint.
   1.0 = exact match across the product's defining axes. 0 = nothing in
   common. Returns null when the prefix doesn't match (we never show
   cross-prefix products on a card). */
export function scoreProduct(
  product: MockProduct,
  prefix: string,
  sel: Record<number, string>,
): number | null {
  if (product.fingerprint.prefix !== prefix) return null;
  const fp = product.fingerprint.segments;
  const axes = Object.keys(fp).map(Number);
  if (axes.length === 0) return 1;
  let hits = 0;
  for (const ax of axes) {
    const expected = fp[ax];
    const actual = sel[ax] ?? "";
    if (actual === expected) hits++;
  }
  return hits / axes.length;
}

/* Returns matches sorted by score desc. Threshold defaults to 0.4 so
   "no matches" only fires when the user has picked something genuinely
   incompatible. Capped to keep the panel scannable. */
export function findMatches(
  prefix: string,
  sel: Record<number, string>,
  threshold = 0.4,
  cap = 6,
): Array<{ product: MockProduct; score: number }> {
  const out: Array<{ product: MockProduct; score: number }> = [];
  for (const p of MOCK_PRODUCTS) {
    const s = scoreProduct(p, prefix, sel);
    if (s === null) continue;
    if (s < threshold) continue;
    out.push({ product: p, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, cap);
}

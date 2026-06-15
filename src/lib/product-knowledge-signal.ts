/* ---------------------------------------------------------------------------
   Product Knowledge Signal  (Phase 1 — first visible Product Knowledge UX)
   ---------------------------------------------------------------------------

   A lightweight, data-presence completeness + maturity signal computed
   PURELY from the fields the product list already has in memory — no new
   API, no schema change, no migration. It turns the list from a row of
   identical cards into a knowledge-health roster.

   This is the "data presence, not validation" completeness the Product
   Knowledge Audit + P0-UX Experience Blueprint asked to make visible, and
   the L1–L3 slice of the P0-UX maturity model that list data can honestly
   prove. (L4 Connected / L5 Complete need relationships + full knowledge,
   which are not on the list — so they are intentionally not surfaced here.)

   Weights (data presence, sum = 100):
     Identity (descriptive name)   25
     Media (hero image)            25
     Type (category + subcategory) 20
     Models / governed code        20
     Commercial (brand / supplier) 10
   --------------------------------------------------------------------------- */

export interface ProductSignalInput {
  hasName: boolean;       // a real descriptive name (not just the model code)
  hasImage: boolean;      // a hero / main image
  hasType: boolean;       // classified to category + subcategory
  hasModels: boolean;     // ≥ 1 model / governed primary code
  hasCommercial: boolean; // a brand or at least one supplier
}

export interface ProductSignal {
  pct: number;                 // 0–100 structural completeness (data presence)
  level: 1 | 2 | 3;            // maturity tier surfaced from list data
  levelLabel: string;          // "Record" | "Structured" | "Knowledge"
  levelCode: string;           // "L1" | "L2" | "L3"
  missing: string[];           // human labels of absent groups (for "Add: …")
  tone: "low" | "mid" | "high"; // calm color band for the ring
}

const WEIGHTS: { key: keyof ProductSignalInput; label: string; w: number }[] = [
  { key: "hasName", label: "name", w: 25 },
  { key: "hasImage", label: "image", w: 25 },
  { key: "hasType", label: "type", w: 20 },
  { key: "hasModels", label: "model", w: 20 },
  { key: "hasCommercial", label: "brand", w: 10 },
];

export function computeProductSignal(input: ProductSignalInput): ProductSignal {
  let pct = 0;
  const missing: string[] = [];
  for (const { key, label, w } of WEIGHTS) {
    if (input[key]) pct += w;
    else missing.push(label);
  }

  const level: 1 | 2 | 3 = pct < 30 ? 1 : pct < 65 ? 2 : 3;
  const levelLabel = level === 1 ? "Record" : level === 2 ? "Structured" : "Knowledge";
  const levelCode = `L${level}`;
  const tone: ProductSignal["tone"] = pct < 30 ? "low" : pct < 65 ? "mid" : "high";

  return { pct, level, levelLabel, levelCode, missing, tone };
}

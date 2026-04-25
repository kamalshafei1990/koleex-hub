/* ---------------------------------------------------------------------------
   Pattern Sewing — Tacking — Tier 3

   Programmable bartack-style station — sews short reinforcement
   tacks (belt loop ends, pocket corners, fly closures, decorative
   bartacks). Differentiates from cycle bartack heads by being able
   to sew programmable shapes (not just a fixed bar).
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const TACKING_FIELDS: SpecField[] = [
  {
    key: "ps_tk_max_stitches_per_tack",
    label: "Max Stitches per Tack",
    type: "number",
    placeholder: "e.g. 100",
    tier: "essential",
    group: "Tacking Station",
  },
  {
    key: "ps_tk_max_tack_length",
    label: "Max Tack Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 20",
    tier: "essential",
    group: "Tacking Station",
  },
  {
    key: "ps_tk_max_tack_width",
    label: "Max Tack Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 10",
    tier: "essential",
    group: "Tacking Station",
  },
  {
    key: "ps_tk_pattern_count",
    label: "Built-in Tack Patterns",
    type: "number",
    placeholder: "e.g. 50",
    tier: "recommended",
    group: "Tacking Station",
    helpText: "Pre-programmed tack shapes (bar / cross / diamond / round / decorative).",
  },
];

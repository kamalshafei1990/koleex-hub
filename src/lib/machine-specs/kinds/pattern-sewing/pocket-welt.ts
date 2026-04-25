/* ---------------------------------------------------------------------------
   Pattern Sewing — Pocket Welt — Tier 3

   Specialized programmable station that cuts + sews jetted (welted)
   pockets in a single cycle. Used on jackets, suits, trousers,
   uniforms. Single welt = one pocket lip; double welt = two parallel
   lips with a vertical cut between. Both share the same field shape
   so this kind-extras file is registered against both single-welt
   and double-welt slugs.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const POCKET_WELT_FIELDS: SpecField[] = [
  {
    key: "ps_pw_max_pocket_length",
    label: "Max Pocket Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 220",
    tier: "essential",
    group: "Pocket Welt Station",
  },
  {
    key: "ps_pw_min_pocket_length",
    label: "Min Pocket Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 60",
    tier: "recommended",
    group: "Pocket Welt Station",
  },
  {
    key: "ps_pw_max_flap_thickness",
    label: "Max Flap Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Pocket Welt Station",
    helpText: "Combined thickness of body fabric + flap + welt strip.",
  },
  {
    key: "ps_pw_corner_knife",
    label: "Corner Knife",
    type: "boolean",
    tier: "essential",
    group: "Pocket Welt Station",
    helpText: "Auto-trims pocket corners — required for clean welt openings.",
  },
  {
    key: "ps_pw_dart_function",
    label: "Dart / Bias Function",
    type: "boolean",
    tier: "advanced",
    group: "Pocket Welt Station",
    helpText: "Sews bias / angled welts in the same cycle.",
  },
];

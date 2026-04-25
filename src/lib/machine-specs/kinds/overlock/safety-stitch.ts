/* ---------------------------------------------------------------------------
   Overlock 5-Thread Safety-Stitch — Tier 3

   Combines a 3-thread overlock with a separate 2-thread chain stitch
   on the same head — produces a high-strength seam in one pass.
   Spec sheet exposes the chain-stitch geometry that distinguishes
   safety-stitch heads from a plain 4-thread overlock.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_SAFETY_STITCH_FIELDS: SpecField[] = [
  {
    key: "ov_ss_chain_gauge",
    label: "Chain Stitch Gauge",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    step: 0.1,
    tier: "essential",
    group: "Safety-Stitch Geometry",
    helpText: "Distance between chain-stitch needle and overlock cluster.",
  },
  {
    key: "ov_ss_chain_stitch_length",
    label: "Chain Stitch Length",
    type: "text",
    placeholder: "e.g. 1.4 – 4.2 mm",
    tier: "recommended",
    group: "Safety-Stitch Geometry",
  },
  {
    key: "ov_ss_independent_tension",
    label: "Independent Chain Tension",
    type: "boolean",
    tier: "recommended",
    group: "Safety-Stitch Geometry",
    helpText: "Separate tension dials for chain vs. overlock threads.",
  },
];

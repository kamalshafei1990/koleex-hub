/* ---------------------------------------------------------------------------
   Double Needle Chainstitch — Tier 3

   Distinct from regular double-needle lockstitch: produces TWO
   parallel CHAIN stitches (Class 401) instead of two parallel
   lockstitches. No bobbin thread — looper(s) underneath form the
   chain. Used for denim waistbands and workwear where the
   chainstitch's elasticity matters.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const DOUBLE_NEEDLE_CHAINSTITCH_FIELDS: SpecField[] = [
  {
    key: "dn_cs_looper_count",
    label: "Looper Count",
    type: "select",
    options: [
      { value: "2", label: "2 Loopers (One per Needle)" },
      { value: "1-shared", label: "1 Shared Looper" },
    ],
    tier: "essential",
    group: "Chainstitch Geometry",
    helpText: "Two-looper heads have independent thread paths — cleaner chain on heavy fabrics.",
  },
  {
    key: "dn_cs_chain_stitch_length_min",
    label: "Chain Stitch Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1.4",
    step: 0.1,
    tier: "essential",
    group: "Chainstitch Geometry",
  },
  {
    key: "dn_cs_chain_stitch_length_max",
    label: "Chain Stitch Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4.2",
    step: 0.1,
    tier: "essential",
    group: "Chainstitch Geometry",
  },
  {
    key: "dn_cs_independent_tension",
    label: "Independent Per-Needle Tension",
    type: "boolean",
    tier: "recommended",
    group: "Chainstitch Geometry",
    helpText: "Separate tension dials for each needle thread.",
  },
];

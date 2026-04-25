/* ---------------------------------------------------------------------------
   Interlock Cylinder-Bed — Tier 3

   Tubular coverstitch for cuffs, neckbands, and sleeve openings.
   Cylinder dims drive what diameter of tube the head can run —
   smaller cylinder = tighter cuffs, longer cylinder = larger tubes
   (sleeves) reachable.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_CYLINDER_BED_FIELDS: SpecField[] = [
  {
    key: "il_cb_cylinder_diameter",
    label: "Cylinder Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 80",
    tier: "essential",
    group: "Cylinder Bed Geometry",
  },
  {
    key: "il_cb_cylinder_length",
    label: "Cylinder Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 280",
    tier: "essential",
    group: "Cylinder Bed Geometry",
  },
  {
    key: "il_cb_post_clearance",
    label: "Post Clearance",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 110",
    tier: "recommended",
    group: "Cylinder Bed Geometry",
    helpText: "Vertical distance from cylinder top to looper post.",
  },
];

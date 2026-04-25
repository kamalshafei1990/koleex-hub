/* ---------------------------------------------------------------------------
   Overlock Cylinder-Bed — Tier 3

   Tubular-arm overlock for small round parts (socks, gloves, cuffs).
   Buyer cares about cylinder DIAMETER (smaller = tighter parts) and
   LENGTH (longer = larger tube circumference reach).
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_CYLINDER_BED_FIELDS: SpecField[] = [
  {
    key: "ov_cb_cylinder_diameter",
    label: "Cylinder Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 70",
    tier: "essential",
    group: "Cylinder Bed Geometry",
    helpText: "Smaller diameters reach into tighter tubes.",
  },
  {
    key: "ov_cb_cylinder_length",
    label: "Cylinder Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 280",
    tier: "essential",
    group: "Cylinder Bed Geometry",
  },
  {
    key: "ov_cb_post_clearance",
    label: "Post Clearance",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 90",
    tier: "recommended",
    group: "Cylinder Bed Geometry",
    helpText: "Vertical distance from cylinder top to looper post.",
  },
];

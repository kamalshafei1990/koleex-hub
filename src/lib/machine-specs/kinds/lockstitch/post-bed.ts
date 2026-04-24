/* ---------------------------------------------------------------------------
   Post-Bed Lockstitch — Kind Extras (Tier 3)

   Post-bed machines sew from above a vertical post — used for 3D
   curved parts (shoes, caps, structured leather goods). Post height
   and diameter control what 3D shapes fit.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const POST_BED_FIELDS: SpecField[] = [
  {
    key: "pb_post_height",
    label: "Post Height",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 180",
    required: true,
    tier: "essential",
    group: "Post-Bed Geometry",
    helpText: "Height of the vertical post from table surface to the needle head.",
  },
  {
    key: "pb_post_diameter",
    label: "Post Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 40",
    tier: "recommended",
    group: "Post-Bed Geometry",
  },
];

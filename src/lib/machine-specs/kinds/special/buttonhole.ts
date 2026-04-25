/* ---------------------------------------------------------------------------
   Special — Buttonhole — Tier 3

   Used by both kinds:
     · sp-buttonhole-shirt   (straight bar — light apparel)
     · sp-buttonhole-eyelet  (eyelet / keyhole — jeans, coats)

   The two share the same field shape; the variant is captured by
   the `sp_bh_buttonhole_type` option and by the kind itself.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const BUTTONHOLE_FIELDS: SpecField[] = [
  {
    key: "sp_bh_buttonhole_type",
    label: "Buttonhole Type",
    type: "select",
    options: [
      { value: "straight", label: "Straight Bar (Shirt)" },
      { value: "eyelet", label: "Eyelet / Keyhole" },
      { value: "rounded", label: "Rounded End" },
      { value: "decorative", label: "Decorative" },
    ],
    required: true,
    tier: "essential",
    group: "Buttonhole Cycle",
  },
  {
    key: "sp_bh_length_min",
    label: "Buttonhole Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6",
    tier: "essential",
    group: "Buttonhole Cycle",
  },
  {
    key: "sp_bh_length_max",
    label: "Buttonhole Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 38",
    tier: "essential",
    group: "Buttonhole Cycle",
  },
  {
    key: "sp_bh_stitch_density",
    label: "Stitch Density",
    type: "text",
    placeholder: "e.g. 0.2 – 2.0 mm",
    tier: "recommended",
    group: "Buttonhole Cycle",
    helpText: "Adjustable density determines how tightly the satin bar packs.",
  },
  {
    key: "sp_bh_knife_action",
    label: "Knife Action",
    type: "select",
    options: [
      { value: "before", label: "Cut Before Stitching" },
      { value: "after", label: "Cut After Stitching" },
      { value: "no-cut", label: "No-Knife (Manual cut)" },
    ],
    tier: "recommended",
    group: "Buttonhole Cycle",
  },
  {
    key: "sp_bh_taping",
    label: "Gimp / Taping",
    type: "boolean",
    tier: "advanced",
    group: "Buttonhole Cycle",
    helpText: "Reinforces the buttonhole edge with a gimp cord under the satin stitch.",
  },
];

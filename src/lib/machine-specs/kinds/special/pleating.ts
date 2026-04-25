/* ---------------------------------------------------------------------------
   Special — Pleating — Tier 3

   Folds and stitches pleats automatically. Used for skirts, kilts,
   curtains, decorative pillow flanges. Buyer cares about pleat
   depth, pleat spacing, and whether the head supports knife / box /
   accordion variants.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const PLEATING_FIELDS: SpecField[] = [
  {
    key: "sp_pl_pleat_type",
    label: "Pleat Type",
    type: "multi-select",
    options: [
      { value: "knife", label: "Knife Pleat" },
      { value: "box", label: "Box Pleat" },
      { value: "inverted", label: "Inverted Box Pleat" },
      { value: "accordion", label: "Accordion / Sunburst" },
      { value: "rolled", label: "Rolled / Cartridge" },
    ],
    tier: "essential",
    group: "Pleating Mechanism",
  },
  {
    key: "sp_pl_pleat_depth_max",
    label: "Pleat Depth Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 25",
    tier: "essential",
    group: "Pleating Mechanism",
  },
  {
    key: "sp_pl_pleat_spacing",
    label: "Pleat Spacing Range",
    type: "text",
    placeholder: "e.g. 10 – 30 mm",
    tier: "recommended",
    group: "Pleating Mechanism",
  },
  {
    key: "sp_pl_max_fabric_width",
    label: "Max Fabric Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1500",
    tier: "recommended",
    group: "Pleating Mechanism",
  },
];

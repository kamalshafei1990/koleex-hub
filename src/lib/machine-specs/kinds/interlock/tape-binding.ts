/* ---------------------------------------------------------------------------
   Interlock Tape-Binding Coverstitch — Tier 3

   Distinct from rib-binding: takes a FLAT (woven or knit) binding
   tape and folds + applies it around an edge in one operation.
   T-shirt necks, lingerie trims, sportswear edges. The folder
   geometry + max tape width define which garment this head fits.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_TAPE_BINDING_FIELDS: SpecField[] = [
  {
    key: "il_tb_max_tape_width",
    label: "Max Tape Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 32",
    tier: "essential",
    group: "Binding Folder",
  },
  {
    key: "il_tb_folder_type",
    label: "Folder Type",
    type: "select",
    options: [
      { value: "single-fold", label: "Single Fold" },
      { value: "double-fold", label: "Double Fold (Bias)" },
      { value: "interchangeable", label: "Interchangeable Folder Set" },
    ],
    tier: "essential",
    group: "Binding Folder",
    helpText: "Double-fold folders give a clean wrapped edge on T-shirt necks.",
  },
  {
    key: "il_tb_finished_width",
    label: "Finished Bind Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    step: 0.1,
    tier: "recommended",
    group: "Binding Folder",
    helpText: "Visible width of the binding after wrapping + sewing.",
  },
  {
    key: "il_tb_quick_change",
    label: "Quick-Change Folder",
    type: "boolean",
    tier: "advanced",
    group: "Binding Folder",
    helpText: "Operator changes folders without tools between SKUs.",
  },
];

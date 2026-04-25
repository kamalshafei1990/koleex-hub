/* ---------------------------------------------------------------------------
   Overlock Towel & Washcloth — Tier 3

   Loop-pile fabric (terry, fleece, washcloth) overlocks need:
     · dust extraction so loop fibers don't clog the head
     · a presser foot designed for loop pile so it doesn't drag
     · wider feed pitch for thicker stacks
   Buyers comparing terry overlocks specifically look for these.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_TOWEL_FIELDS: SpecField[] = [
  {
    key: "ov_tw_dust_extraction",
    label: "Dust Extraction Port",
    type: "boolean",
    tier: "essential",
    group: "Towel Specifics",
    helpText: "Built-in port for an external vacuum to clear loop fibers.",
  },
  {
    key: "ov_tw_loop_pile_height",
    label: "Max Loop Pile Height",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Towel Specifics",
    helpText: "Maximum terry loop height the foot clears without flattening.",
  },
  {
    key: "ov_tw_foot_type",
    label: "Loop-Pile Foot",
    type: "select",
    options: [
      { value: "standard", label: "Standard" },
      { value: "raised", label: "Raised / Loop-Friendly" },
      { value: "interchangeable", label: "Interchangeable Set" },
    ],
    tier: "recommended",
    group: "Towel Specifics",
  },
];

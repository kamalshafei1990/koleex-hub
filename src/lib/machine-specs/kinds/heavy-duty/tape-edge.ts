/* ---------------------------------------------------------------------------
   Heavy-Duty Tape-Edge — Tier 3

   Mattress / bedding tape-edge closer. The head rotates on a turret
   around the mattress perimeter, sewing the binding tape that closes
   the seam between the panel quilt and the side panel. Buyer cares
   about max mattress dimensions, turret radius, edge-binding tape
   width, and whether the head auto-handles corners.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const HD_TAPE_EDGE_FIELDS: SpecField[] = [
  {
    key: "hd_te_max_mattress_width",
    label: "Max Mattress Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 2200",
    tier: "essential",
    group: "Tape-Edge Station",
  },
  {
    key: "hd_te_max_mattress_length",
    label: "Max Mattress Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 2400",
    tier: "essential",
    group: "Tape-Edge Station",
  },
  {
    key: "hd_te_max_mattress_height",
    label: "Max Mattress Height",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 450",
    tier: "essential",
    group: "Tape-Edge Station",
    helpText: "Maximum mattress profile height the turret accommodates.",
  },
  {
    key: "hd_te_tape_width",
    label: "Edge Tape Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 50",
    tier: "recommended",
    group: "Tape-Edge Station",
  },
  {
    key: "hd_te_auto_corner",
    label: "Auto Corner Handling",
    type: "boolean",
    tier: "recommended",
    group: "Tape-Edge Station",
    helpText: "Turret + tape feed auto-pivot through the four corners without operator intervention.",
  },
];

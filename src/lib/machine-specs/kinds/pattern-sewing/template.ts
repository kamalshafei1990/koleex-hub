/* ---------------------------------------------------------------------------
   Pattern Sewing — Template-Based — Tier 3

   Uses physical templates (acrylic / steel jigs) that snap onto the
   clamp. The pattern data is encoded in the template shape itself
   (or a barcode on the template). Lower setup time per pattern but
   more upfront work to make each template.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const TEMPLATE_FIELDS: SpecField[] = [
  {
    key: "ps_t_template_count",
    label: "Template Count",
    type: "number",
    placeholder: "e.g. 32",
    tier: "essential",
    group: "Template System",
    helpText: "Number of unique templates the controller recognises out of the box.",
  },
  {
    key: "ps_t_swap_mechanism",
    label: "Template Swap Mechanism",
    type: "select",
    options: [
      { value: "manual", label: "Manual Snap-In" },
      { value: "magnetic", label: "Magnetic Quick-Lock" },
      { value: "barcode", label: "Barcode-Recognised" },
      { value: "rfid", label: "RFID-Tagged" },
    ],
    tier: "recommended",
    group: "Template System",
  },
  {
    key: "ps_t_template_swap_time",
    label: "Template Swap Time",
    type: "text",
    placeholder: "e.g. < 5 s",
    tier: "advanced",
    group: "Template System",
  },
];

/**
 * Shared spec groups for garment-machinery schemas.
 *
 * The first seven schemas each carried their own copy of Electrical /
 * Physical / Packing & Shipping / Safety & Compliance — identical fields,
 * identical keys. The 2026-08-05 finishing-equipment batch adds seven more
 * schemas at once, and seven more copies would have meant ~1,400 duplicated
 * lines whose only future is to drift apart. These factories return the
 * exact field set the existing schemas use (same ids, same keys, same
 * computed formulas), so spec-i18n already covers every label and the
 * mirror/readiness logic sees nothing new.
 *
 * Existing schemas are deliberately NOT rewritten to use these factories —
 * they are live and untouched; only new schemas compose from here.
 */

import type { SpecGroup } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";

const pub = DEFAULT_PUBLIC_VISIBILITY;

/** Standard / Optional, printed literally in every automation catalogue read
 *  so far. Shared so the option VALUES stay identical across templates — a
 *  filter for "machines with a standard thread trimmer" must not miss rows
 *  because one template spelled the value differently. */
export const FITMENT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "optional", label: "Optional" },
];

export function electricalGroup(order: number, opts?: { motorLabel?: string }): SpecGroup {
  return {
    id: "electrical",
    title: "Electrical & Utilities",
    order,
    fields: [
      {
        id: "phase", key: "phase", label: "Power Phase", order: 10,
        fieldType: "select", dataType: "string", required: false,
        description: "Electrical supply phase.",
        options: [
          { value: "single_phase", label: "Single Phase (1PH)" },
          { value: "three_phase", label: "Three Phase (3PH)" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
      {
        id: "voltage_options", key: "voltage_options", label: "Voltage", order: 20,
        fieldType: "select", dataType: "string", required: false,
        description: "Rated supply voltage.",
        options: [
          { value: "220v", label: "220 V" },
          { value: "380v", label: "380 V" },
        ],
        ...pub, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "power_consumption_w", key: "power_consumption_w",
        label: opts?.motorLabel ?? "Total Power", order: 30,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "Rated total power consumption.",
        suggestions: [1, 4.5, 6.5, 12, 16, 19, 20, 26, 27],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "frequency_hz", key: "frequency_hz", label: "Frequency", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "Hz", required: false,
        description: "Rated supply frequency.",
        suggestions: [50, 60],
        ...pub, visualRenderType: "spec_card",
      },
    ],
  };
}

export function physicalGroup(order: number): SpecGroup {
  return {
    id: "physical",
    title: "Physical",
    order,
    formTab: "logistics",
    fields: [
      {
        id: "machine_dimensions", key: "machine_dimensions",
        label: "Machine Dimensions (L×W×H)", order: 10,
        fieldType: "dimension", dataType: "string", unit: "mm", required: false,
        description: "Overall machine dimensions in mm (L×W×H).",
        ...pub, visualRenderType: "packing_block",
      },
      {
        id: "machine_weight_kg", key: "machine_weight_kg",
        label: "Machine Weight", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "kg", required: false,
        description: "Net weight of the machine.",
        suggestions: [100, 200, 350, 500, 800],
        ...pub, visualRenderType: "spec_card",
      },
    ],
  };
}

/* packingShippingGroup() — REMOVED 2026-09-13. Packing stopped being a
   template question: a crate is a crate whatever the machine inside it does,
   so the Hub asks it of EVERY product from one fixed section on the Packing &
   Logistics tab (src/components/admin/form-sections/LogisticsBlocks.tsx),
   stored in products.logistics. As a template field it reached 7 subcategories
   out of 25, with two different option lists. Do not reinstate it here. */

export function safetyComplianceGroup(
  order: number,
  extraSafetyOptions: Array<{ value: string; label: string }> = [],
): SpecGroup {
  return {
    id: "safety-compliance",
    title: "Safety & Compliance",
    order,
    fields: [
      {
        id: "safety_features", key: "safety_features", label: "Safety Features", order: 10,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "Built-in operator- and machine-safety systems.",
        options: [
          { value: "emergency_stop", label: "Emergency Stop" },
          { value: "guard_covers", label: "Guard Covers" },
          { value: "overload_protection", label: "Motor Overload Protection" },
          ...extraSafetyOptions,
        ],
        ...pub, visualRenderType: "icon_chip",
      },
      {
        id: "certifications", key: "certifications", label: "Certifications", order: 20,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "Quality and compliance certifications.",
        options: [
          { value: "ce", label: "CE" },
          { value: "iso9001", label: "ISO 9001" },
        ],
        ...pub, filterVisible: true, visualRenderType: "technical_badge",
      },
    ],
  };
}

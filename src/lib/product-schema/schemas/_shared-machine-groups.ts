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

export function packingShippingGroup(order: number): SpecGroup {
  return {
    id: "packing-shipping",
    title: "Packing & Shipping",
    order,
    formTab: "logistics",
    fields: [
      {
        id: "packing_type", key: "packing_type", label: "Packing Type", order: 10,
        fieldType: "select", dataType: "string", required: false,
        description: "How the machine is packed for shipment.",
        options: [
          { value: "wooden_case", label: "Wooden Case" },
          { value: "plywood_crate", label: "Plywood Crate" },
          { value: "carton", label: "Carton" },
          { value: "pallet_film", label: "Pallet + Stretch Film" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
      {
        id: "packing_dimensions", key: "packing_dimensions",
        label: "Packing Dimensions (L×W×H)", order: 20,
        fieldType: "dimension", dataType: "string", unit: "mm", required: false,
        description: "Packed crate dimensions in mm (L×W×H).",
        ...pub, visualRenderType: "packing_block",
      },
      {
        id: "cbm", key: "cbm", label: "CBM", order: 30,
        fieldType: "unit_number", dataType: "number", unit: "m³", required: false,
        description: "Packed volume in cubic metres.",
        ...pub,
        computed: { from: "packing_dimensions", formula: "cbm_m3_from_mm_dimensions" },
        visualRenderType: "spec_card",
      },
      {
        id: "net_weight", key: "net_weight", label: "Net Weight (N.W.)", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "kg", required: false,
        description: "Net shipping weight on the packing list.",
        ...pub,
        computed: { from: "machine_weight_kg", formula: "copy_number" },
        visualRenderType: "spec_card",
      },
      {
        id: "gross_weight", key: "gross_weight", label: "Gross Weight", order: 50,
        fieldType: "unit_number", dataType: "number", unit: "kg", required: false,
        description: "Gross shipping weight.",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "container_20ft_qty", key: "container_20ft_qty",
        label: "Qty per 20ft Container", order: 60,
        fieldType: "unit_number", dataType: "number", unit: "units", required: false,
        description: "How many units load into one 20ft container.",
        ...pub,
        computed: { from: "cbm", formula: "qty_per_20ft_from_cbm" },
        visualRenderType: "spec_card",
      },
      {
        id: "container_40ft_qty", key: "container_40ft_qty",
        label: "Qty per 40ft Container", order: 70,
        fieldType: "unit_number", dataType: "number", unit: "units", required: false,
        description: "How many units load into one 40ft STANDARD container.",
        ...pub,
        computed: { from: "cbm", formula: "qty_per_40ft_from_cbm" },
        visualRenderType: "spec_card",
      },
      {
        id: "container_40hq_qty", key: "container_40hq_qty",
        label: "Qty per 40HQ Container", order: 80,
        fieldType: "unit_number", dataType: "number", unit: "units", required: false,
        description: "How many units load into one 40ft High-Cube container.",
        ...pub,
        computed: { from: "cbm", formula: "qty_per_40hq_from_cbm" },
        visualRenderType: "spec_card",
      },
    ],
  };
}

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

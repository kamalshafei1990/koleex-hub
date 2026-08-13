/**
 * XABA · Button Attaching Machines — spec template.
 *
 * Template seven in `Automatic Sewing Systems`. Until now the subcategory
 * rendered a form with no fields.
 *
 * SOURCE — S-GEMSY, SG 1903B SERIES, the same 20-page catalogue that supplied
 * XABH and XABT. Two models: SG1903B-K (standard) and SG1903B-997S (automatic
 * button feeding). Its spec tables are IMAGES with pictogram headers, read by
 * rendering the page — see buttonhole-bartack-2026-08-13.ts for the full note
 * on that; a text-only extraction of this catalogue yields no numbers at all.
 *
 * VALUES READ FROM THE PRINTED TABLE:
 *   flat button ⌀8–⌀20 mm · shank button ⌀10–⌀20 mm (-K only)
 *   speed 2500 rpm · needle bar stroke 41.2 mm · stitch length 0.1–10 mm
 *   presser foot lift 14 mm · needle DBX17 #14 · 550 W
 *   -K      805×370×725 mm · 56/68 kg
 *   -997S  1330×800×1300 mm · 175/183 kg
 *
 * ⚠️ THE TWO MODELS ARE NOT A TRIM DIFFERENCE. Automatic button feeding makes
 * the machine THREE TIMES the weight and nearly twice the footprint — 175 kg
 * against 56, on a 1330 mm bench instead of 805. Anyone quoting from the -K
 * figures and shipping a -997S has the wrong crate, the wrong bench and the
 * wrong freight. That is why dimensions and weight are recorded per model and
 * not once per series.
 *
 * ⚠️ BUTTON SIZE IS TWO FIELDS, NOT ONE. The table prints ⌀8–⌀20 for flat
 * (sew-through) buttons and a SEPARATE ⌀10–⌀20 for shank buttons, and the
 * -997S prints a dash in the second column — it does not take shank buttons at
 * all. Collapsing them into one range would silently promise a capability the
 * auto-feed machine does not have.
 *
 * WHAT IS DELIBERATELY NOT HERE — button MATERIAL and hole count. Neither is
 * printed; a two-hole and a four-hole button are a pattern selection on the
 * panel, not a machine specification.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  electricalGroup,
  packingShippingGroup,
  physicalGroup,
  safetyComplianceGroup,
  FITMENT_OPTIONS,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

export const BUTTON_ATTACHING_SCHEMA: ProductSchemaDefinition = {
  id: "button-attaching.v1",
  name: "Button Attaching Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XABA",
  version: "1",
  groups: [
    {
      id: "button-capability",
      title: "Button Capability",
      order: 10,
      fields: [
        {
          id: "flat_button_diameter_range", key: "flat_button_diameter_range", label: "Flat Button Diameter", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⌀8–⌀20 mm, printed as a range for sew-through (flat) buttons. Text because the pair IS the specification — a machine that takes only ⌀8–⌀12 is a different machine, and a single number cannot say that.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "shank_button_diameter_range", key: "shank_button_diameter_range", label: "Shank Button Diameter", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⌀10–⌀20 mm on the SG1903B-K, and a DASH on the auto-feeding -997S — that model does not take shank buttons at all. Kept as its own field for exactly that reason: folded into the flat-button range it would silently promise a capability the auto-feed machine lacks. Blank means UNKNOWN; a dash on the sheet means NOT SUPPORTED and belongs in the model's notes.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "button_feeding_mode", key: "button_feeding_mode", label: "Button Feeding", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "manual_button_place", label: "Manual Placement" },
            { value: "auto_button_feed", label: "Automatic Feeding" },
          ],
          description: "The -K suffix is manual placement; -997S is automatic feeding. This single choice is what separates a 56 kg bench machine from a 175 kg one, and it is the field that decides operator count per machine — one operator can tend several auto-feeders and only one manual machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "button-head-stitch",
      title: "Sewing Head & Stitch",
      order: 20,
      fields: [
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
          description: "2500 rpm on both models — the slowest of the three GEMSY special machines (bartack 3200, buttonhole 4200), because the needle must find a hole in a rigid button rather than a point on cloth.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_bar_stroke", key: "needle_bar_stroke", label: "Needle Bar Stroke", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "41.2 mm — the same stroke as the SG 1900B bartacker, which is expected: the two share a head casting.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Printed as a 0.1–10 mm range; record the maximum. On this machine the setting is really the hole spacing of the button.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_system", key: "needle_system", label: "Needle System", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "DBX17 #14 on both models.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 50,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "14 mm, the same as the rest of the series.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Thread Trimmer", order: 60,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "Marked ★ (standard) on both models.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "electronic_thread_clipper", key: "electronic_thread_clipper", label: "Electronic Thread Clipper", order: 70,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          description: "Listed as a distinct feature from the trimmer. On a button it matters more than elsewhere: a long tail under a button shows through the garment face.",
          options: FITMENT_OPTIONS,
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const BUTTON_ATTACHING_SCHEMAS: ProductSchemaDefinition[] = [BUTTON_ATTACHING_SCHEMA];

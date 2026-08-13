/**
 * XAPW · Pocket Welting  and  XAPP · Placket Sewing Units — spec templates.
 *
 * The second and third templates in `Automatic Sewing Systems`, after XAPT.
 * Before these, both subcategories rendered a form with no fields at all.
 *
 * SOURCES — two catalogues, cross-read so no field rests on a single sheet:
 *   · S-FDK, 90-page bilingual automation catalogue. Prints a real
 *     技术参数 / PARAMETERS table on 65 of 90 pages.
 *       pocket welting  MS-03-HP2 · MS-03-HP3 · MS-03-B326 · MS-688B-9 (+ p.86)
 *       placket units   MS-03-HF2 · MS-23 · MS-9600 · MS-7A001 · MS-7A003 · MS-7A004
 *   · S-JOOKE, the 62-page catalogue inventoried in
 *     docs/product-data-v2/reference-data/jooke-2026-07-catalog-inventory.md
 *       pocket welting  pp.23–24    placket units  pp.17, 20, 26
 *
 * ⚠️ A KEYWORD COUNT IS NOT A SOURCE COUNT, and this file nearly proved it the
 * expensive way. Scanning 75 catalogues by keyword reported 8 catalogues for
 * buttonholes and 6 for bartacking — but Feiyue's 37 "buttonhole" hits are a
 * STITCH FUNCTION on household machines, Durkopp's are a 2009 program index
 * with no tables at all, and most "bartack" hits are the model name of a
 * bought-in sewing HEAD quoted inside another machine's description. Likewise
 * FDK's MS-12 pages matched "placket" only in their application prose: they are
 * template machines and belong to XAPT. Every page below was opened and its
 * title read before a single field was written. XABH, XABT, XACL, XASL and XASS
 * are therefore still untemplated — deliberately, for want of a real table.
 *
 * VALUES OBSERVED, so units and bounds are measured rather than assumed:
 *   welting  pocket range X:210–300 × Y:30–200 mm · speed 2700–3000 rpm
 *            stitch 0.05–12.7 mm · needle DP×17 (11#–18#) · foot lift 23–28 mm
 *            laser 80 / 120 W · cycle 13–26 s per pocket · memory 999 + USB
 *   placket  sewing range X ≤ 700–850 mm, 30×190 mm · speed 2700–3500 rpm
 *            stitch 0.1–5 mm · needle DB×1, DP×17 (11#–14#)
 *            air 10 / 180 L/min · output 240–1100 pieces per shift
 *
 * WHAT IS DELIBERATELY NOT HERE — machine_dimensions, machine_weight_kg,
 * net/gross weight, packing and voltage. Those are the shared groups appended
 * at the end of each schema; re-minting them per subcategory is how a Hub ends
 * up unable to compare two machines on weight.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  electricalGroup,
  packingShippingGroup,
  physicalGroup,
  safetyComplianceGroup,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

/* Both machine classes are built around a bought-in sewing head — FDK quotes
   "brother 7300A / JUKI DDL-8000A", "688B-9", "342 AF pattern head". On a
   dedicated automation unit the head decides the stitch quality, the spare
   parts channel and half the price, so it is a first-class field on both, not
   a note. Shared definition so the two templates cannot drift apart. */
const sewingHeadField = {
  id: "sewing_head_model", key: "sewing_head_model", label: "Sewing Head", order: 10,
  fieldType: "text" as const, dataType: "string" as const, required: false,
  description: "The bought-in head the unit is built around (\"brother 7300A / JUKI DDL-8000A\", \"688B-9\", \"342 AF pattern head\"). On a dedicated automation unit this decides stitch quality, the spare-parts channel and a large share of the price — it is not a footnote, and two units with the same frame and different heads are not the same machine.",
  ...pub, visualRenderType: "spec_card" as const,
};

export const POCKET_WELTING_SCHEMA: ProductSchemaDefinition = {
  id: "pocket-welting.v1",
  name: "Pocket Welting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XAPW",
  version: "1",
  groups: [
    {
      id: "welt-pocket-work",
      title: "Pocket Work Envelope",
      order: 10,
      fields: [
        {
          id: "pocket_sewing_range", key: "pocket_sewing_range", label: "Pocket Sewing Range", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as X × Y (X:300 Y:200 mm on the MS-688B-9; X:210 Y:30 mm in the narrow standard configuration). Kept as the printed pair: on a welting machine this is the largest pocket the unit can make, which is the buying decision.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "welt_type_support", key: "welt_type_support", label: "Welt Types Supported", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Single lip, double lip, line/jetted, zipper and flap pockets — the catalogue lists them per machine. Free text because the list is a capability set that differs machine by machine, and a closed option list would be reopened by every new source.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "pocket_folding_method", key: "pocket_folding_method", label: "Pocket Folding Method", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Double opening, 4-direction synchronised pneumatic folding\". This is what removes the ironing and marking steps, and it is the distinguishing mechanism between welting units.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cycle_time_per_piece", key: "cycle_time_per_piece", label: "Cycle Time per Pocket", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "13–26 seconds per pocket. Text because the sheet prints a range, and the range is the honest figure — the low end assumes a simple pocket.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "welt-laser",
      title: "Laser Cutting",
      order: 20,
      fields: [
        {
          id: "laser_power_w", key: "laser_power_w", label: "Laser Power", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "80 W or 120 W, printed as an option on the MS-03 series and fixed at 120 W on the MS-688B-9. The laser replaces manual notching, so its absence is a materially different machine — leave blank on non-laser welting units rather than entering 0.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "laser_cutting_range", key: "laser_cutting_range", label: "Laser Cutting Range", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed separately from the sewing range and SMALLER than it (250×200 vs 350×200 mm on the MS-03-HF2). Recording only one of the two would overstate what the machine can cut.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "laser_head_type", key: "laser_head_type", label: "Laser Head Type", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            /* NOT the bare value "fixed": that already means "Fixed Speed" on
               speed_control, and one value meaning two things is what gate C
               refuses — the same collision that produced `needle_fixed`. */
            { value: "laser_head_fixed", label: "Fixed" },
            { value: "moving", label: "Moving / Galvo" },
          ],
          description: "\"固定式 Fixed type\" on the MS-03 series. A fixed head cuts within the frame; a moving head follows the pattern.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "welt-sewing-head",
      title: "Sewing Head & Stitch",
      order: 30,
      fields: [
        sewingHeadField,
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
          description: "2700–3000 rpm across the range. Reused from the shared sewing vocabulary.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Upper bound of the printed range — 12.7 mm on pattern-head units, 2.7 mm on the MS-688B-9. Record the maximum.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_stitches_per_pattern", key: "max_stitches_per_pattern", label: "Max Stitches per Pattern", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "stitches", required: false,
          description: "20,000 on the MS-03 series — an order of magnitude below the 100,000 of a CNC template machine, which is the honest difference between a dedicated unit and a programmable one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_system", key: "needle_system", label: "Needle System", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "DP×17, quoted with its size range (11#–18#). Text because the sheet gives system and sizes together.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hook_type", key: "hook_type", label: "Hook / Shuttle Type", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"双倍大摆梭 Double large oscillating shuttle\", \"双倍大旋梭 double large rotary hook\". Text rather than a select: the catalogues distinguish oscillating from rotary AND their size multiplier in one printed phrase.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 70,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "23 mm on the MS-03-B326, 28 mm on the MS-688B-9. How much bulk the machine will clear.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "middle_presser_foot_travel", key: "middle_presser_foot_travel", label: "Middle Presser Foot Travel", order: 80,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as a range (4–10 mm). Text because it is a span.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "welt-control",
      title: "Control & Programming",
      order: 40,
      fields: [
        {
          id: "control_system_brand", key: "control_system_brand", label: "Control System", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"大豪或上亿 DAHAO / SYSTEMTOP\". The control brand determines which pattern files and spare boards fit, so it is quoted on the sheet and belongs on the record.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "pattern_storage_capacity", key: "pattern_storage_capacity", label: "Pattern Storage", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "patterns", required: false,
          description: "\"999 + USB memory\". Record 999 — the USB extension is unbounded and belongs in the input method, not the count.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "drive_motor_type", key: "drive_motor_type", label: "Drive Motor", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"台达伺服电机 Delta servo motor\" — the brand is printed, and on these units it is a serviceability fact, not marketing.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_air_pressure", key: "working_air_pressure", label: "Working Air Pressure", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"> 0.4 MPa\" / \"> 0.5 MPa\", quoted with air consumption where the sheet gives it. Kept as the printed phrase because it is a MINIMUM, and recording it as a bare number loses the \"greater than\".",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "emergency_stop", key: "emergency_stop", label: "Emergency Stop", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "fitted", label: "Fitted" },
            { value: "not_fitted", label: "Not Fitted" },
          ],
          description: "Printed \"有 Have\". Recorded because on a laser machine it is a safety fact, and blank must mean UNKNOWN rather than absent.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(50),
    physicalGroup(60),
    packingShippingGroup(70),
    safetyComplianceGroup(80),
  ],
};

export const PLACKET_UNIT_SCHEMA: ProductSchemaDefinition = {
  id: "placket-unit.v1",
  name: "Placket Sewing Unit",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XAPP",
  version: "1",
  groups: [
    {
      id: "placket-work",
      title: "Placket Work Envelope",
      order: 10,
      fields: [
        {
          id: "sewing_range", key: "sewing_range", label: "Sewing Range", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed either as a single axis limit (\"X:≤850 mm\", \"X:≤700 mm\") or as a pair (\"30×190 mm W×L\"). Text because the catalogues genuinely print two different shapes of the same fact, and normalising them would invent precision the sheet does not give.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "placket_type_support", key: "placket_type_support", label: "Placket Types Supported", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Single and double placket, front placket (门襟), under-placket (里襟), sleeve placket (袖衩). These are distinct garment operations and a unit usually does one or two — this is the field that says which.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "applicable_fabric", key: "applicable_fabric", label: "Applicable Fabric", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Men's shirt, women's chiffon, knitwear\" — printed per unit. A placket unit is folded and clamped around a specific cloth weight, so this is a fitment fact rather than a marketing line.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "production_capacity", key: "production_capacity", label: "Production Capacity", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Quoted per hour or per shift and with its own basis — \"3000 pcs/12h\", \"720~1100 (6 buttonholes per piece / 8 hours)\", \"240~360 fronts/h\". Kept as the printed phrase INCLUDING the basis: a bare number here would compare a 6-buttonhole piece against a plain front and be silently wrong.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "placket-sewing-head",
      title: "Sewing Head & Stitch",
      order: 20,
      fields: [
        sewingHeadField,
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
          description: "2700–3500 rpm across the range. Note the sheets print it as \"work speed (MAX)\" on some units — the same fact.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Upper bound of the printed range — 3 mm on the sleeve-placket unit, 5 mm on the polo placket unit.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_system", key: "needle_system", label: "Needle System", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "DB×1 on lockstitch-head units, DP×17 (11#–14#) on pattern-head units.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "placket-handling",
      title: "Handling & Pneumatics",
      order: 30,
      fields: [
        {
          id: "air_consumption", key: "air_consumption", label: "Air Consumption", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "10 L/min on the buttonholing placket unit against 180 L/min on the under-placket unit — an eighteenfold spread that decides whether the customer's compressor can run it. Some sheets quote it per piece (\"1 L/pcs\") instead, which is why this is the printed phrase and not a number.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "air_suction_motor_power", key: "air_suction_motor_power", label: "Suction Motor Power", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "750 W on the MS-23. Vacuum holds the placket flat while it is folded; where a unit prints this, it has powered suction rather than clamps alone.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "table_height", key: "table_height", label: "Table Height", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "820–830 mm where printed. An ergonomics and line-integration fact — a unit that does not match the line's table height needs a platform.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(40),
    physicalGroup(50),
    packingShippingGroup(60),
    safetyComplianceGroup(70),
  ],
};

export const AUTOMATION_UNIT_SCHEMAS: ProductSchemaDefinition[] = [
  POCKET_WELTING_SCHEMA,
  PLACKET_UNIT_SCHEMA,
];

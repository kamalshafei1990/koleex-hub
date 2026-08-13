/**
 * XAPT · Programmable / CNC Sewing — spec template.
 *
 * WHY THIS FILE. `Automatic Sewing Systems` has ELEVEN subcategories and, until
 * this file, ZERO spec templates — the Hub's 26 templates were all XF* / XP* /
 * XS*. Entering a CNC template machine produced a form with no fields at all,
 * which is why the largest and fastest-growing machine family in the catalogue
 * had nowhere to put its numbers. XAPT is the densest of the eleven, so it goes
 * first.
 *
 * SOURCE — the S-JOOKE 62-page English catalogue (2026-07-22), inventoried in
 * docs/product-data-v2/reference-data/jooke-2026-07-catalog-inventory.md. Its
 * template/CNC family prints ONE consistent parameter table across 14 machines,
 * and every field below is a column of it. Occurrence counts (out of 14) are
 * recorded per field so a future reader can see which are load-bearing and
 * which are occasional — they are measured, not assumed.
 *
 * VALUES OBSERVED, so the units and option sets below are evidence:
 *   sewing area        80×45 · 80×60 · 100×75 · 110×80 · 130×95 · 250×150 cm
 *   max speed          2800 · 3000 · 3500 r/min
 *   stitch length      0.05–12.7 mm (printed as 0.1~12.7 on older models)
 *   max stitches       100,000 per pattern, throughout
 *   hook               1.6× small · 2.0× large · small & large
 *   needle             DPx5 and DPx17, 7#–22# / 7#–23#
 *   outer foot stroke  15 mm · middle foot height 20 mm · follow-up 0–12 mm
 *   air                0.4–0.6 MPa at 1.7 / 10 / 20 / 50 L/min
 *   power              600 · 750 · 1000 · 2500 · 5000 W, single-phase 220 V
 *   weight             260 – 1500 kg
 *
 * ⚠️ THE PRESENCE FIELDS ARE THREE-STATE, NOT BOOLEAN. The catalogue prints
 * "Standard" or "Optional" for the trimmer, wiper, tensioner, break detection,
 * bobbin counter and middle presser foot. A checkbox would collapse those into
 * one bit and silently turn every OPTIONAL feature into a promise the machine
 * does not keep as quoted. Each is a select with Standard / Optional, and blank
 * where a model does not print it — blank means UNKNOWN, never "absent".
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *   · Bed shape and duty. `bed_type` and `fabric_weight_class` are facets that
 *     reach the form through the Machine Kind (CL-0020). The catalogue's
 *     "Application: medium-thick / medium-heavy material" is exactly the duty
 *     facet and must not be re-minted as a field.
 *   · Station count and self-circulation (single / dual / robotic four-station,
 *     pp.15-16). Those separate MACHINE KINDS, not models within a series.
 *   · Ultrasonic variants (JKC-DC…-WK-DST). They are a different joining
 *     PROCESS with no needle, pending the owner's decision on the needle-free
 *     family — see §4 G1 of the inventory. Filing them here would be wrong.
 *
 * Shared vocabulary is REUSED, not re-minted: max_sewing_speed,
 * stitch_length_max, needle_system, hook_size, presser_foot_lift,
 * auto_thread_trimmer, net_weight, motor_power_w and the shared electrical /
 * physical / packing / compliance groups already carry these exact meanings.
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

export const PROGRAMMABLE_CNC_SCHEMA: ProductSchemaDefinition = {
  id: "programmable-cnc.v1",
  name: "Programmable / CNC Sewing Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XAPT",
  version: "1",
  groups: [
    {
      id: "cnc-sewing-field",
      title: "Sewing Field & Speed",
      order: 10,
      fields: [
        {
          id: "sewing_area", key: "sewing_area", label: "Sewing Area", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as X×Y in cm (80×45 … 250×150) — 7 of 14 machines. Kept as text because the page gives one paired string, and because the pair IS the buying decision on this machine class: it is the size of template the machine can run.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
          description: "Printed \"Max. Sewing Speed (r/min)\" — 2800 to 3500 across the range (9 of 14). Reused from the shared sewing vocabulary.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "The upper bound of the printed range (0.05–12.7 mm, older sheets 0.1~12.7) — 12 of 14. Record the maximum; the lower bound is 0.05 throughout.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_stitches_per_pattern", key: "max_stitches_per_pattern", label: "Max Stitches per Pattern", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "stitches", required: false,
          description: "100,000 on every machine that prints it (14 of 14 — the single most consistent column). Printed variously as \"stitches\" or \"needles\"; the number is the same.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-pattern-control",
      title: "Pattern & Template Control",
      order: 20,
      fields: [
        {
          id: "pattern_input_method", key: "pattern_input_method", label: "Pattern Input", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "How a pattern reaches the machine — \"USB Flash Drive, PC USB Cable\" throughout (9 of 14). Text rather than a select: this list grows with network and IoT transfer, and a closed option set would have to be reopened for each.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "pattern_storage_capacity", key: "pattern_storage_capacity", label: "Pattern Storage", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "patterns", required: false,
          description: "\"≥999 Patterns\" on the touch screen (8 of 14). Record 999 — the printed value is a floor, not a measured ceiling.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "template_switching_mode", key: "template_switching_mode", label: "Template Switching", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "rfid_card", label: "RFID Card (automatic)" },
            { value: "manual_select", label: "Manual Selection" },
          ],
          description: "\"RFID Card Intelligent Switching\" on 8 of 14 — the machine reads the template's tag and loads its pattern with no operator input. This is the headline feature of the class and the reason it is a group of its own, not a line in a features list.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operation_interface", key: "operation_interface", label: "Operation Interface", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"7\\\" Color Touch Screen + Keypad\" throughout (10 of 14). Text because the screen size varies by generation and the keypad is not always present.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-drive",
      title: "Axis Drive & Transmission",
      order: 30,
      fields: [
        {
          id: "x_axis_drive_type", key: "x_axis_drive_type", label: "X-Axis Drive", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "timing_belt", label: "Timing Belt" },
            { value: "lead_screw", label: "Lead Screw" },
            { value: "servo_motor", label: "Servo Motor" },
            { value: "stepper_motor", label: "Stepper Motor" },
            { value: "closed_loop_stepper", label: "Closed-Loop Stepper" },
          ],
          description: "The catalogue distinguishes belt from screw drive per axis and sells on it: NS1 uses a belt X-axis with a screw-rod Y, the DS series uses screw rods on both. Screw rods hold accuracy on large fields; belts are faster and cheaper.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "y_axis_drive_type", key: "y_axis_drive_type", label: "Y-Axis Drive", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "timing_belt", label: "Timing Belt" },
            { value: "lead_screw", label: "Lead Screw" },
            { value: "servo_motor", label: "Servo Motor" },
            { value: "stepper_motor", label: "Stepper Motor" },
            { value: "closed_loop_stepper", label: "Closed-Loop Stepper" },
          ],
          description: "Printed \"Y Axis Drive Type\" on 8 of 14 — closed-loop stepper, servo or stepper. The Y axis carries the table, so this is the axis that limits speed on a large machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "table_drive_configuration", key: "table_drive_configuration", label: "Table Drive Configuration", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Dual Y + Single X\", \"X&Y-axis Lead Screws\", \"three screw rods\". Free text on purpose: this is a mechanical layout the catalogue describes in prose, and forcing it into options would lose the distinction the three-screw-rod models are sold on.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-sewing-head",
      title: "Sewing Head & Presser",
      order: 40,
      fields: [
        {
          id: "needle_system", key: "needle_system", label: "Needle System", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"DPx5 (7#–22#)\", often with DPx17 alongside (11 of 14). Text because the sheet gives system AND size range together, and machines list two systems.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hook_size", key: "hook_size", label: "Hook Specification", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "small_1_6x", label: "1.6× Small Hook" },
            { value: "large_2_0x", label: "2.0× Large Hook" },
            { value: "small_and_large", label: "Small & Large Hook" },
          ],
          description: "10 of 14. A larger hook holds more bobbin thread, so it decides how long the machine runs between bobbin changes — on an automatic machine that is throughput, not a detail. Some sheets print it as \"(2.0× Large Hook Optional)\": record the fitted hook and set the fitment note on the model.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "outer_presser_foot_stroke", key: "outer_presser_foot_stroke", label: "Outer Presser Foot Stroke", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "15 mm on every machine that prints it (10 of 14). The height the outer frame lifts to clear the template.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "middle_presser_foot_height", key: "middle_presser_foot_height", label: "Middle Presser Foot Height", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "20 mm where printed. Distinct from the outer frame above — this is the foot that holds the fabric at the needle.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "presser_foot_follow_stroke", key: "presser_foot_follow_stroke", label: "Presser Foot Follow-up Stroke", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as a range (0–12 mm). Text because it is a span, and the useful fact is the span, not either end alone.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "motor_driven_middle_foot", key: "motor_driven_middle_foot", label: "Motor-Driven Middle Presser Foot", order: 60,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "Standard or Optional (7 of 14). A motor-driven middle foot changes height under program control, which is what lets one template run material of varying thickness.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-thread-automation",
      title: "Thread Handling & Detection",
      order: 50,
      fields: [
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Thread Trimmer", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "motor_rotary", label: "Motor-Driven Rotary Cutter" },
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "Printed \"Motor-driven Rotary Cutter\" on the higher models and \"(Motor-driven Trimming Optional)\" on others. Reused key from the shared vocabulary, but as a SELECT here rather than a boolean because the catalogue distinguishes the mechanism, not merely its presence.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "electronic_thread_tensioner", key: "electronic_thread_tensioner", label: "Electronic Thread Tensioner", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "13 of 14 — the second most consistent column after max stitches. Tension set per pattern segment instead of by hand, which is what makes an unattended run repeatable.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "thread_break_detection", key: "thread_break_detection", label: "Thread Break Detection", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "10 of 14. On an unattended machine this is the difference between a stopped machine and a whole template sewn without thread.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "bobbin_thread_counter", key: "bobbin_thread_counter", label: "Bobbin Thread Counter", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "10 of 14, printed \"Standard\" or \"Standard configuration\". Warns before the bobbin runs out rather than after.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "thread_wiper", key: "thread_wiper", label: "Thread Wiper", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "8 of 14.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "air_blow_presser_foot", key: "air_blow_presser_foot", label: "Air-Blow Presser Foot", order: 60,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "6 of 14. Air lifts and releases the work so it does not stick to the foot on light material.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-pneumatics",
      title: "Pneumatics & Environment",
      order: 60,
      fields: [
        {
          id: "working_air_pressure", key: "working_air_pressure", label: "Working Air Pressure", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0.4–0.6 MPa throughout, but the AIR VOLUME beside it ranges 1.7 to 50 L/min — a fiftyfold difference that decides whether the customer's existing compressor can run the machine. Kept as the printed pair for exactly that reason; splitting out pressure alone would drop the number that matters.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operating_temperature", key: "operating_temperature", label: "Operating Temperature", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as a range (9 of 14). Text because it is a span.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(70),
    physicalGroup(80),
    packingShippingGroup(90),
    safetyComplianceGroup(100),
  ],
};

export const PROGRAMMABLE_CNC_SCHEMAS: ProductSchemaDefinition[] = [PROGRAMMABLE_CNC_SCHEMA];

/**
 * XCL · Laser Cutting · XCC · CNC Cutting · XCT · Strip Cutting ·
 * XCE · End Cutters · XCP · Tape Cutting — spec templates.
 *
 * Templates 3–7 in `Cutting Equipment`, after XCS and XCR. The category had
 * ZERO templates when this began and was the Hub's largest single gap (9 coded
 * subcategories); it closes here at **7 of 9**.
 *
 * NOT BUILT, AND NOT FOR WANT OF TRYING:
 *   · `XCB` Band Knife Cutting — the catalogue has no band-knife page at all.
 *   · `XCD` Fabric Drilling — drilling appears only as an OPTION on the CNC
 *     machines ("T" drilling device), never as a machine with its own sheet.
 * Both stay empty rather than invented.
 *
 * SOURCE — the Koleex 2025 catalogue's cutting section (PDF pages 40, 42–46),
 * read by RENDERING; the file has no extractable text. Its model codes are the
 * OLD edition and are being renumbered, so only the FIELDS are taken from it.
 *
 * ⚠️ ONE PRINTED UNITS ERROR, CARRIED THROUGH CORRECTED. Every laser sheet
 * prints "Laser wavelength: 10.6mm". A CO2 laser emits at 10.6 MICROMETRES;
 * 10.6 mm would be a radio wave. The field below is µm and says so. This is the
 * second units misprint found in this catalogue family — the first was hem
 * width in cm against mm — so read units, never assume them.
 *
 * VALUES OBSERVED:
 *   laser   80–150 W tube · 1–6 heads · working range 1300×2500 … 1800×1000 mm
 *           ≤1200 mm/s · line 0.1 mm · accuracy ±0.1 mm · machine 3000–3500 W
 *   CNC     working width 1600–2200 mm (custom 1700–3200) · cut height 50/80/90
 *           mm, option to 110 · machine length 5237/6237 mm
 *   strip   cutting width 570/1150 mm · blade ⌀200 / ⌀350–400 mm · 4.3 kW
 *   end     130–190 W · knife 1500–2000 rpm · travel 15 m/min · DC36V or 220V
 *   tape    cut width 98/112/138 mm · length 0–9999 mm · 120–500 pcs/min · 260 W
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

/* Every powered cutter in this catalogue publishes a sharpening arrangement,
   and on all of them it is the consumable story rather than a convenience. */
const sharpeningField = {
  id: "knife_sharpening", key: "knife_sharpening", label: "Knife Sharpening", order: 80,
  fieldType: "select" as const, dataType: "string" as const, required: false,
  options: [
    { value: "sharpening_automatic", label: "Automatic" },
    { value: "sharpening_manual", label: "Manual" },
  ],
  description: "\"Fully automatic sharpening system\" on the strip cutters, \"disc-type sharpening mechanism\" on the CNC. A blade that dulls mid-lay drags the fabric, so this is what decides whether a long run needs an operator standing over it.",
  ...pub, visualRenderType: "spec_card" as const,
};

/* ── XCL · Laser ───────────────────────────────────────────────────────── */

export const LASER_CUTTING_SCHEMA: ProductSchemaDefinition = {
  id: "laser-cutting.v1",
  name: "Laser Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCL",
  version: "1",
  groups: [
    {
      id: "laser-source",
      title: "Laser Source",
      order: 10,
      fields: [
        {
          id: "laser_power_w", key: "laser_power_w", label: "Laser Power", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "The TUBE's power — 80/100/120/130/150 W. Not to be confused with the machine's total draw (3000–3500 W) which is a separate field: the chiller, the blower and the conveyor account for nearly all of the difference.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "laser_head_count", key: "laser_head_count", label: "Laser Heads", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "heads", required: false,
          description: "1 to 6. More heads cut more pieces at once ONLY when the layout allows it; the catalogue is explicit that the twin-head machines run \"asynchronously\", i.e. each head works its own region. Record the count, and put the sync behaviour in the model notes.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "laser_wavelength_um", key: "laser_wavelength_um", label: "Laser Wavelength", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "µm", required: false,
          description: "10.6 µm — a CO2 laser. ⚠️ THE CATALOGUE PRINTS \"10.6mm\", WHICH IS WRONG BY A FACTOR OF A THOUSAND: 10.6 mm would be a radio wave, not light. Enter 10.6 as MICROMETRES and do not \"correct\" this field back to the printed unit.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "total_machine_power_w", key: "total_machine_power_w", label: "Total Machine Power", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "3000–3500 W for the whole machine. This is the figure the customer's electrician needs, and it is 20× the tube rating — quoting the tube power as the supply requirement is a wiring error waiting to happen.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "laser-work",
      title: "Work Area & Precision",
      order: 20,
      fields: [
        {
          id: "working_range", key: "working_range", label: "Working Range", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1300×2500, 1600×3000, 1600×1000 or 1800×1000 mm. Kept as the printed pair: on a conveyor machine the SHORT axis is the real limit — the long axis just feeds through.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_speed_max", key: "working_speed_max", label: "Max Working Speed", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm/s", required: false,
          description: "≤1200 mm/s throughout — a ceiling the head can travel, not a cutting speed. Actual cutting speed falls with material thickness and the catalogue does not publish that curve.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "min_line_width", key: "min_line_width", label: "Min Line Width", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "0.1 mm — the narrowest kerf. With min character size below it, this is what decides whether small logos and lace detail come out legible.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "min_character_size", key: "min_character_size", label: "Min Character Size", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "2 mm. Twenty times the line width, because a character needs several strokes and a gap between them to stay readable.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "positioning_accuracy", key: "positioning_accuracy", label: "Positioning Accuracy", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "±0.1 mm. Kept as text because the ± is the specification — recorded as a bare 0.1 it reads as a tolerance band half the true width.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "laser-handling",
      title: "Table, Feeding & Utilities",
      order: 30,
      fields: [
        {
          id: "working_table_type", key: "working_table_type", label: "Working Table", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "table_knife_strip", label: "Knife Strip" },
            { value: "table_wire_conveyor", label: "Wire Conveyor" },
            { value: "table_mesh_belt", label: "Wire Mesh Belt Conveyor" },
          ],
          description: "A knife-strip bed is a FIXED table — you load, cut, unload. A conveyor bed runs continuously off a roll. That single choice decides whether the machine suits piece work or roll work, and it cannot be changed after purchase.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "material_feeding_mode", key: "material_feeding_mode", label: "Material Feeding", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "feeding_manual", label: "Manual" },
            { value: "feeding_auto_conveying", label: "Automatic Conveying" },
          ],
          description: "Follows the table type and is printed separately, so both are recorded: \"automatic conveying material\" is what makes the machine unattended, and it is the line the catalogue sells the conveyor models on.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cooling_method", key: "cooling_method", label: "Cooling", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Constant temperature water chiller\" on every model. A CO2 tube's output drifts with temperature, so the chiller is not an accessory — an unchilled tube loses power and then cracks.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "protection_mode", key: "protection_mode", label: "Protection", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Water lack protecting, power-off protection\" — the machine stops if the chiller loses flow and resumes the job after a power cut. Both protect the tube, which is the expensive consumable.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "file_formats_supported", key: "file_formats_supported", label: "File Formats", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "AI, BMP, PLT, DXF, DST. This is the compatibility question the customer's pattern room actually asks, and the list differs between machines — never assume it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "standard_collocation", key: "standard_collocation", label: "Standard Collocation", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Mini air compressor, bottom exhaust fans.\" Recorded because these ship WITH the machine and a quotation that omits them looks cheaper than a competitor's that includes them.",
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

/* ── XCC · CNC ─────────────────────────────────────────────────────────── */

export const CNC_CUTTING_SCHEMA: ProductSchemaDefinition = {
  id: "cnc-cutting.v1",
  name: "CNC Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCC",
  version: "1",
  groups: [
    {
      id: "cnc-capacity",
      title: "Cutting Capacity",
      order: 10,
      fields: [
        {
          id: "working_width", key: "working_width", label: "Working Width", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1600 / 1800 / 2000 / 2200 mm standard, and the sheet states the frame can be built anywhere from 1700 to 3200 mm to suit the customer's marker width. Kept as text so a custom width can be recorded as what it is rather than forced onto the standard ladder.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_cutting_thickness", key: "max_cutting_thickness", label: "Max Cutting Thickness", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "50 / 80 / 90 mm compressed, extendable to 110 mm on request — and the channel-type machines quote only 10 mm because an oscillating knife in a channel is a different job. Text, because the number is meaningless without knowing which of the two it is.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "machine_length", key: "machine_length", label: "Machine Length", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "5237 or 6237 mm, and the catalogue says the bed can be lengthened further \"to adapt to longer layouts\". This is the floor space question, and on a 6 m machine it is usually the constraint that decides the sale.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "conveyor_length", key: "conveyor_length", label: "Conveyor Length", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "2000 / 2500 mm, printed separately from the machine length because it is the part that moves the cut work OUT — a short conveyor on a long bed means an operator standing at the end.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "cnc-tooling",
      title: "Tooling & Motion",
      order: 20,
      fields: [
        {
          id: "axis_configuration", key: "axis_configuration", label: "Axis Configuration", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"X, Y, Z, C four-axis\" — C is the knife's own rotation, which is what lets it follow a curve without dragging. A three-axis machine cuts the same shapes worse, so the count alone is a capability statement.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cutting_tool_types", key: "cutting_tool_types", label: "Cutting Tools", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Oscillating knife, drilling head, punching head. The catalogue sells drilling and punching as OPTIONAL devices (\"T\" drilling, \"M\" mobile), so a machine quoted without them cannot do those jobs — which is also why `XCD` Fabric Drilling has no machine of its own in this catalogue.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cutting_head_count", key: "cutting_head_count", label: "Cutting Heads", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "heads", required: false,
          description: "One on the standard machines, two on the channel-type. Two independent heads with double crossbeams roughly double throughput on small pieces and do nothing at all on one large one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "vacuum_system", key: "vacuum_system", label: "Vacuum System", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Frequency conversion vacuum adsorption, constant pressure.\" Variable-speed vacuum holds the lay flat while drawing far less power than a fixed pump, which on a machine that runs all shift is most of its electricity bill.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        sharpeningField,
      ],
    },
    {
      id: "cnc-control",
      title: "Control & Software",
      order: 30,
      fields: [
        {
          id: "file_formats_supported", key: "file_formats_supported", label: "File Formats", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "What the pattern room can send it. The compatibility question that decides whether the machine drops into an existing CAD workflow or forces a new one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "remote_diagnostics", key: "remote_diagnostics", label: "Remote Diagnostics", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Cutting system with remote diagnosis, remote assistance function.\" On an export machine this is the difference between a service visit and a phone call, so it belongs in the quotation.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "optional_devices", key: "optional_devices", label: "Optional Devices", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Cooling device (for low-melting fabrics), knife intelligent device (multi-layer and high-pile), \"M\" mobile device, \"T\" drilling device, bed-based adsorption, automatic pressure supplement. Kept as one text field: the sheet lists them as a menu and which ones a customer took is a quotation fact, not a machine fact.",
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

/* ── XCT · Strip ───────────────────────────────────────────────────────── */

export const STRIP_CUTTING_SCHEMA: ProductSchemaDefinition = {
  id: "strip-cutting.v1",
  name: "Strip Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCT",
  version: "1",
  groups: [
    {
      id: "strip-capacity",
      title: "Cutting Capacity",
      order: 10,
      fields: [
        {
          id: "cutting_width", key: "cutting_width", label: "Cutting Width", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "570 mm on the single-servo machine, 1150 mm on the dual-servo — the width of roll it will take. This is the first number a binding-tape buyer checks and it doubles between the two models.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_cutting_thickness", key: "max_cutting_thickness", label: "Max Roll Thickness", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "130 mm to 280 mm — the DIAMETER of the wound roll the machine will slice through, not a fabric thickness. A strip cutter cuts a whole roll at once, which is why this number is so much larger than any other cutter's in this category.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "blade_diameter_mm", key: "blade_diameter_mm", label: "Blade Diameter", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⌀200 mm, or ⌀350–400 mm on the heavier machine. Kept as text because the sheet quotes a range on the larger frame — it takes more than one blade size.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        sharpeningField,
      ],
    },
    {
      id: "strip-control",
      title: "Control & Feeding",
      order: 20,
      fields: [
        {
          id: "control_system_brand", key: "control_system_brand", label: "Control System", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "PLC with a bilingual Chinese/English LCD touch screen. The bilingual screen is worth recording for export: a Chinese-only panel is a training cost the customer pays after delivery.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "feeding_speed_stages", key: "feeding_speed_stages", label: "Feeding Speed Stages", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Three stages of feeding speed can be set freely\" on the dual-servo machine. Multiple stages let the machine slow into the cut and speed up between them, which is where the finish quality on soft tape comes from.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "remote_diagnostics", key: "remote_diagnostics", label: "Remote Diagnostics", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Link wireless network can remote diagnosis and modify parameters\" — printed only on the dual-servo model, so it is a real difference between the two and not a family feature.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "dust_extraction", key: "dust_extraction", label: "Cooling & Dust Removal", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Cooling device and dust removal system can be installed as required.\" Optional, and the word matters: slicing a synthetic roll generates heat and fibre dust, so a quotation without it is a different machine in the same casing.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "safety_cover", key: "safety_cover", label: "Safety Cover", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Closed safety cover (removable)\" on the high-precision model. On a machine with a 400 mm exposed blade this is a CE question before it is a comfort one.",
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

/* ── XCE · End cutters ─────────────────────────────────────────────────── */

export const END_CUTTER_SCHEMA: ProductSchemaDefinition = {
  id: "end-cutter.v1",
  name: "End Cutter",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCE",
  version: "1",
  groups: [
    {
      id: "end-cutter-class",
      title: "Automation & Capacity",
      order: 10,
      fields: [
        {
          id: "automation_level", key: "automation_level", label: "Automation Level", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "cutter_fully_automatic", label: "Fully Automatic" },
            { value: "cutter_semi_automatic", label: "Semi-Automatic" },
            { value: "cutter_manual", label: "Manual" },
          ],
          description: "The whole product line is arranged on this one axis — fully automatic, semi-auto, or manual with a digital display. It is the first thing that separates a 190 W powered head from a hand-pulled one, and the price follows it directly.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cutting_width", key: "cutting_width", label: "Cutting Width", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as \"as required\" on the automatic machines — the rail is cut to the customer's table — and 1.2 m on the manual one. Text for exactly that reason: \"as required\" is the honest answer and no number can stand for it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_cutting_thickness", key: "max_cutting_thickness", label: "Max Cutting Thickness", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "≤4 mm to 8.6 mm. An end cutter squares off the end of a spread rather than cutting a lay, so these numbers are an order of magnitude below the straight knife's — do not compare them.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "end-cutter-drive",
      title: "Drive & Power",
      order: 20,
      fields: [
        {
          id: "motor_power_w", key: "motor_power_w", label: "Motor Power", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "130 W semi-auto, 180 W manual-digital, 190 W fully automatic.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "power_source", key: "power_source", label: "Power Source", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "mains_corded", label: "Mains (corded)" },
            { value: "lithium_battery", label: "Lithium Battery" },
          ],
          description: "The automatic machines are \"wireless\", running a DC 36 V pack while the table supply is 220 V. On a cutter that travels the full width of a spreading table, a trailing lead is the thing being designed out.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_cutting_speed", key: "max_cutting_speed", label: "Knife Speed", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1500 rpm, or 1500/2000 as a two-speed option. Kept as text so a two-speed machine is not recorded as a single-speed one at its maximum.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "traverse_speed", key: "traverse_speed", label: "Traverse Speed", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "15 m/min — how fast the head crosses the table, which on this machine is the cycle time. Distinct from knife speed and easily confused with it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_return_counter", key: "auto_return_counter", label: "Auto Return & Ply Counter", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Automatic rebound and counter: the head returns and counts the cutting layers automatically after finishing.\" The ply count is what the cut-order paperwork needs, so a machine that counts for you removes a manual tally and its errors.",
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

/* ── XCP · Tape ────────────────────────────────────────────────────────── */

export const TAPE_CUTTING_SCHEMA: ProductSchemaDefinition = {
  id: "tape-cutting.v1",
  name: "Tape Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCP",
  version: "1",
  groups: [
    {
      id: "tape-cut",
      title: "Cut Geometry & Output",
      order: 10,
      fields: [
        {
          id: "cutting_width", key: "cutting_width", label: "Max Tape Width", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "98, 112 or 138 mm — the widest tape, ribbon or webbing the throat will take. It is the ONLY difference between the three models of the 988 series; everything else on their row is identical.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cutting_length_range", key: "cutting_length_range", label: "Cutting Length Range", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–9999 mm, set on the panel. The upper bound is a counter limit rather than a mechanical one, which is why it is a suspiciously round number.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cutting_output_rate", key: "cutting_output_rate", label: "Output Rate", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Always quoted WITH the length it was measured at: \"120 pcs/min\", \"150 pcs/min at 50 mm\", \"500 pcs/min at 40 mm\". A bare rate compares a 40 mm label against a 500 mm strap and flatters the wrong machine — record the printed phrase including its basis.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "cut_angle_capability", key: "cut_angle_capability", label: "Cut Angle Capability", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Multi-angle: parallelogram, rhombic, trapezoid\" on the bevel cutter, square only on the rest. Bias-cut binding is a different product from square-cut, so this decides what the machine can actually make.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "tape-knife",
      title: "Knife & Sealing",
      order: 20,
      fields: [
        {
          id: "tape_knife_type", key: "tape_knife_type", label: "Knife Type", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "knife_cold", label: "Cold Knife" },
            { value: "knife_hot", label: "Hot Knife" },
            { value: "knife_ultrasonic", label: "Ultrasonic" },
          ],
          description: "THE defining choice, and the model suffix carries it (L = cold, H = hot). A cold knife leaves a raw edge that frays; a hot knife melts and seals it; ultrasonic seals without scorching. On synthetic webbing the wrong one produces a product that fails in the wash.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "punching_device", key: "punching_device", label: "Punching Device", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Can punch different sizes of the diameter of the holes\" — fitted to order. A punched tape is a different SKU from a plain one, so this belongs on the machine record and not in a note.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "colour_mark_sensor", key: "colour_mark_sensor", label: "Colour-Mark Sensor", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "A photoelectric sensor that reads the printed mark so every cut lands in the same place on a repeating pattern. Without it a printed label tape is cut to LENGTH, not to the artwork, and every piece drifts.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "memory_function", key: "memory_function", label: "Memory Function", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Before the switch is turned off, the cut length, cut quantity and cut speed of the set value are automatically stored.\" Small, and it is what stops the first run after every break being scrap.",
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

export const CUTTING_SYSTEM_SCHEMAS: ProductSchemaDefinition[] = [
  LASER_CUTTING_SCHEMA,
  CNC_CUTTING_SCHEMA,
  STRIP_CUTTING_SCHEMA,
  END_CUTTER_SCHEMA,
  TAPE_CUTTING_SCHEMA,
];

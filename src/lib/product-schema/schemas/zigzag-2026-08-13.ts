/**
 * XSZ · Zigzag Machines — spec template.
 *
 * CL-0020 minted XSZ as a genuinely new stitch type but shipped no template
 * with it (step 4 covered XSO / XSI / XSC only, and XSL already had one). Until
 * this file, entering any zigzag model produced a form with ZERO fields.
 *
 * SOURCE — Yuegong / SEASTAR (Zhejiang Yuegong Sewing Equipment Co., Ltd.),
 * "HELLO ZIGZAG" catalogue, 27 items over 17 spreads. Unlike the S-001 icon
 * bars, this catalogue prints ONE consistent spec table under every model, and
 * every field below is a column of it:
 *
 *   needle · stitch width (mm) · stitch length (mm) · s.p.m · zigzag bight (mm)
 *   · presser foot lift (mm, printed as two numbers) · motor (W)
 *   · net/gross weight (kg) · carton size (cm) · auto trimmer (✓/✗)
 *
 * Ranges observed across the 24 zigzag models, so the units and bounds below
 * are measured rather than assumed:
 *   needle      DPx5 (most), DPX17 (post-bed GG9530/GG9630)
 *   stitch width  4 · 4.5 · 5 · 6 mm
 *   stitch length 4 · 5 · 6 mm
 *   speed       1800 – 4000 s.p.m
 *   bight       0-5 · 0-9 · 0-10 · 0-11 · 0-12 mm
 *   foot lift   6/10 · 6/12 · 8/13 mm
 *   motor       550 W throughout
 *
 * WHAT IS DELIBERATELY NOT HERE — bed shape. GG9530 is POST BED, GG2312 is
 * CYLINDRICAL, GG8530 is BENDING ARM, GG591 is a PILLAR machine. Those are
 * `bed_type` facet values reaching the form through the Machine Kind, exactly
 * as CL-0020 ruled. `bending-arm` and `pillar` were added to the facet
 * registry in the same change (dictionary §10); `post` and `cylinder` already
 * existed.
 *
 * WHAT *IS* HERE AND MIGHT LOOK LIKE A FACET — `zigzag_pattern`. The catalogue
 * prints 一步两点 / 二步三点 / 三步四点 (1-step-2-point, 2-step-3-point,
 * 3-step-4-point), and those separate MODELS inside one series: GG20U457A is
 * 3-step-4-point, 457B is 2-step-3-point, 457D is the double-needle
 * 3-step-4-point. A facet distinguishes KINDS of machine; a difference between
 * models in the same series belongs on the model. So it is a field, not a
 * facet — and the dictionary records that reasoning too.
 *
 * Shared vocabulary is REUSED, not re-minted: max_sewing_speed,
 * stitch_length_max, presser_foot_lift, needle_system, net_weight,
 * gross_weight, packing_dimensions, motor_power_w, auto_thread_trimmer,
 * lubrication_system and hook_size already carry these exact meanings.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
/* The four shared groups were imported here and never used — this template
   spells out its own Weight & Packing group instead, because the catalogue
   prints net/gross as one pair and a carton size in cm, which the shared
   packing group does not model. The dead imports are removed; the template's
   shape is deliberately left as built. */

const pub = DEFAULT_PUBLIC_VISIBILITY;

export const ZIGZAG_SCHEMA: ProductSchemaDefinition = {
  id: "zigzag.v1",
  name: "Zigzag Machine",
  divisionCode: "garment-machinery",
  categoryCode: "industrial-sewing-machines",
  subcategoryCode: "XSZ",
  version: "1",
  groups: [
    {
      id: "zigzag-stitch",
      title: "Zigzag Stitch Configuration",
      order: 10,
      fields: [
        {
          id: "zigzag_bight_max", key: "zigzag_bight_max", label: "Max Zigzag Bight", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "The sideways swing of the needle — the column printed as a range (0-5 … 0-12). This is what makes the machine a zigzag; it is NOT the stitch width of a straight seam.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "zigzag_pattern", key: "zigzag_pattern", label: "Step / Point Pattern", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "1_step_2_point", label: "1-Step 2-Point" },
            { value: "2_step_3_point", label: "2-Step 3-Point" },
            { value: "3_step_4_point", label: "3-Step 4-Point" },
          ],
          description: "Printed as 一步两点 / 二步三点 / 三步四点. It separates models inside one series (GG20U457A vs 457B vs 457D), which is why it lives on the model and not on the Machine Kind.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_width_max", key: "stitch_width_max", label: "Max Stitch Width", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Second column of the printed bar (4 – 6 mm across the range).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Third column (4 – 6 mm). Reused from the shared sewing vocabulary.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_positions", key: "needle_positions", label: "Needle Position Adjustment", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "left_right_centre", label: "Left / Right / Centre" },
            { value: "needle_fixed", label: "Fixed Needle Position" },
          ],
          description: "GG20U33/43/53/63 states the needle position can be set left, right or centre. Left blank where a model does not print it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "zigzag-pattern-control",
      title: "Pattern Control",
      order: 20,
      fields: [
        {
          id: "pattern_control_type", key: "pattern_control_type", label: "Pattern Control", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "cam", label: "Mechanical (Cam)" },
            { value: "computerized", label: "Computerized" },
            { value: "single_step_motor", label: "Single Step Motor" },
            { value: "double_step_motor", label: "Double Step Motor" },
          ],
          description: "The catalogue's own top-level split: cam-changed models (GG2284, 'different stitch designs by changing the optional cams') vs single/double step-motor decorative heads vs computerized 20U series.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "built_in_patterns", key: "built_in_patterns", label: "Built-in Patterns", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "pcs", required: false,
          description: "Advertised on the page, not in the table: 190 (GG20U-A/C), 240 (GG20U-B), 200+ (YG1996-A4), 700+ (YG1996-B5 / GG5530-B4).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "pattern_programmable", key: "pattern_programmable", label: "User-Programmable Patterns", order: 30,
          fieldType: "boolean" as const, dataType: "boolean" as const, required: false,
          description: "Whether the operator can author and download patterns. True on A3/A4, B3/B4, C3/C4 and the 700-design heads; false on the plain cam models.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "control_panel_type", key: "control_panel_type", label: "Control Panel", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "none", label: "None" },
            { value: "key_panel", label: "Key Panel" },
            { value: "touch_screen", label: "Touch Screen" },
          ],
          description: "Several heads print 可选配触摸屏款 — touch screen optional. Record what the quoted configuration actually ships with.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "zigzag-machine",
      title: "Machine & Drive",
      order: 30,
      fields: [
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "s.p.m", required: false,
          description: "Fourth column. 1800 – 4000 s.p.m across this catalogue.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_system", key: "needle_system", label: "Needle System", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "First column. DPx5 on most heads; DPX17 on the post-bed GG9530/GG9630.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as a PAIR (6/10, 6/12, 8/13) — hand lift / knee lift. Kept as text so both numbers survive; splitting them would invent a precision the page does not give.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hook_size", key: "hook_size", label: "Hook Size", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "large", label: "Large Hook" },
          ],
          description: "'LARGE HOOK' is called out in the model titles (GG5530-DZ, GG652-XL, GG1530, GG2530) because it is a buying decision.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "motor_power_w", key: "motor_power_w", label: "Motor Power", order: 50,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
          description: "550 W on every zigzag model in this catalogue; the pillar/edge-trimming machines print a clutch motor in HP instead.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "drive_system", key: "drive_system", label: "Drive System", order: 60,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "clutch", label: "Clutch Motor" },
            { value: "servo", label: "Servo Motor" },
            { value: "direct_drive", label: "Direct Drive" },
          ],
          description: "The -DZ suffix throughout this catalogue means direct drive.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "zigzag-automation",
      title: "Automation & Lubrication",
      order: 40,
      fields: [
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Auto Thread Trimmer", order: 10,
          fieldType: "boolean" as const, dataType: "boolean" as const, required: false,
          description: "Last column of the printed table, shown as ✓ or ✗.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_presser_foot_lift", key: "auto_presser_foot_lift", label: "Auto Presser Foot Lift", order: 20,
          fieldType: "boolean" as const, dataType: "boolean" as const, required: false,
          description: "Listed in the prose for the trimmer-equipped heads (自动抬压脚).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_back_tacking", key: "auto_back_tacking", label: "Auto Back-Tacking", order: 30,
          fieldType: "boolean" as const, dataType: "boolean" as const, required: false,
          description: "自动倒缝 — reverse stitching at the seam ends without the operator touching the lever.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "lubrication_system", key: "lubrication_system", label: "Lubrication System", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "manual", label: "Manual" },
            { value: "auto_oil", label: "Automatic Oil Supply" },
            { value: "dry_head", label: "Dry Head (Oil-Free)" },
          ],
          description: "AUTO-OIL is in the model titles (自动加油); the sealed-ridge note on GG9530 is about preventing oil leaking onto the work.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "zigzag-logistics",
      title: "Weight & Packing",
      order: 50,
      fields: [
        {
          id: "net_weight", key: "net_weight", label: "Net Weight", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "kg", required: false,
          description: "Printed as a net/gross pair (e.g. 45/40, 24/21) — the FIRST number.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "gross_weight", key: "gross_weight", label: "Gross Weight", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "kg", required: false,
          description: "The SECOND number of the same pair.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "packing_dimensions", key: "packing_dimensions", label: "Packing Dimensions", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Carton a×b×c in cm (67x25x57, 54.5x24x36.5 …). Kept as text because the page gives one string, not three measured axes.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
  ],
};

export const ZIGZAG_SCHEMAS: ProductSchemaDefinition[] = [ZIGZAG_SCHEMA];

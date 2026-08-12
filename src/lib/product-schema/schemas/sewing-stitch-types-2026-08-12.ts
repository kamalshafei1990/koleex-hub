/**
 * Sewing stitch-type templates — CL-0020 step 4 (2026-08-12).
 *
 *   XSO · Overlock Machines
 *   XSI · Coverstitch (Flatlock) Machines   — renamed from "Interlock" by CL-0020
 *   XSC · Chainstitch Machines
 *
 * These are the three true stitch types that survived the CL-0020 audit
 * alongside XSL, which already had a template. Everything the retired shelves
 * used to say — bed, feed, needle count, duty — is NOT here: it lives on the
 * facet axis (`src/lib/product-facets.ts`) and reaches the form through the
 * Machine-Kind attributes. This file carries only what belongs to the STITCH.
 *
 * SOURCE — S-001 Koleex Catalog 2025, read off the printed spec bars:
 *   Overlock  (PDF p060, XSO-C9A-4UT and the whole XSO range) — a nine-column
 *             bar: needle count · thread count · needle gauge · stitch length ·
 *             differential feed ratio · overedging width · presser foot lift ·
 *             needle system · max speed.
 *   Coverstitch (PDF p067, XSI-360S-33WP) — an eleven-column bar: needle system ·
 *             needle count · thread count · needle gauge · stitch length ·
 *             presser foot lift · two columns printed as "–" on this model ·
 *             max speed · packing dimensions · gross/net weight.
 *   Chainstitch (PDF p064, XSO-GN1 series) — a plain white table: working speed ·
 *             foot height · needle model · max stitch length · motor power ·
 *             weight · carton size.
 *
 * TWO COLUMNS ARE DELIBERATELY NOT MODELLED. The coverstitch bar prints "–" for
 * two icons on every model I could read, so I could not tell what they measure.
 * Guessing a field is worse than leaving it out — a wrong label gets filled in
 * with real data and then it is wrong forever. They stay unmodelled until a page
 * prints a value for them.
 *
 * Shared vocabulary is REUSED, not re-minted: max_sewing_speed, stitch_length_*,
 * presser_foot_lift, needle_system, needle_size_range, motor_type,
 * feed_mechanism, bed_type, material_weight, suitable_fabrics,
 * auto_thread_trimmer and lubrication_system all already exist with these exact
 * meanings in spec-i18n.
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

/* Fields every stitch type shares, spelled once. Each already exists in
   spec-i18n with exactly this meaning — reusing them is what keeps a machine
   comparable across stitch types on a quote. */
const sewingCoreGroup = (order: number) => ({
  id: "sewing-core",
  title: "Stitch & Speed",
  order,
  fields: [
    {
      id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 10,
      fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
      description: "Rated maximum stitches per minute, as printed on the spec bar.",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "stitch_length_min", key: "stitch_length_min", label: "Stitch Length (Min)", order: 20,
      fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
      description: "Low end of the printed stitch-length range.",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "stitch_length_max", key: "stitch_length_max", label: "Stitch Length (Max)", order: 30,
      fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
      description: "High end of the printed stitch-length range.",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 40,
      fieldType: "text" as const, dataType: "string" as const, unit: "mm", required: false,
      description: "Printed as a single value or a range (5.5, or 5–12), so it is text.",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "needle_system", key: "needle_system", label: "Needle System", order: 50,
      fieldType: "text" as const, dataType: "string" as const, required: false,
      description: "The needle class the machine takes — DCx27, UY128GAS, DPx5. Printed with the size on the same column.",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "needle_size_range", key: "needle_size_range", label: "Needle Size Range", order: 60,
      fieldType: "text" as const, dataType: "string" as const, required: false,
      description: "Needle sizes the machine is rated for (e.g. 11#, 8#–18#).",
      ...pub, visualRenderType: "spec_card" as const,
    },
    {
      id: "motor_type", key: "motor_type", label: "Motor Type", order: 70,
      fieldType: "select" as const, dataType: "string" as const, required: false,
      description: "Printed in the model caption: mechanical (clutch), direct-drive, or a stepper/servo intelligent head.",
      options: [
        { value: "clutch", label: "Clutch Motor" },
        { value: "servo", label: "Servo Motor" },
        { value: "direct-drive", label: "Direct Drive" },
      ],
      ...pub, visualRenderType: "icon_chip" as const,
    },
    {
      id: "lubrication_system", key: "lubrication_system", label: "Lubrication System", order: 80,
      fieldType: "select" as const, dataType: "string" as const, required: false,
      description: "Automatic, semi-dry or dry head — decides what the machine may sew without staining.",
      options: [
        { value: "automatic", label: "Automatic Lubrication" },
        { value: "semi_dry", label: "Semi-Dry (Hook Only)" },
        { value: "dry_head", label: "Dry Head (Oil-Free)" },
        { value: "manual", label: "Manual Oiling" },
      ],
      ...pub, visualRenderType: "icon_chip" as const,
    },
  ],
});

const materialGroup = (order: number) => ({
  id: "material-capability",
  title: "Material Capability",
  order,
  fields: [
    {
      id: "material_weight", key: "material_weight", label: "Material Weight", order: 10,
      fieldType: "multi_select" as const, dataType: "json" as const, required: false,
      description: "Fabric weight classes the head is built for. This is the FACET the retired XSH shelf used to be.",
      options: [
        { value: "light", label: "Light" },
        { value: "medium", label: "Medium" },
        { value: "heavy", label: "Heavy" },
        { value: "extra-heavy", label: "Extra Heavy" },
      ],
      ...pub, visualRenderType: "icon_chip" as const,
    },
    {
      id: "suitable_fabrics", key: "suitable_fabrics", label: "Suitable Fabrics", order: 20,
      fieldType: "multi_select" as const, dataType: "json" as const, required: false,
      description: "Fabric families the catalogue names for this machine.",
      options: [
        { value: "woven", label: "Woven" },
        { value: "knitted", label: "Knitted Fabric" },
        { value: "denim", label: "Denim" },
        { value: "leather", label: "Leather" },
        { value: "technical", label: "Technical" },
      ],
      ...pub, visualRenderType: "icon_chip" as const,
    },
  ],
});

/* ─────────────────────────────────────────────────────────────────────────
   1 · OVERLOCK (XSO) — ISO 500-series. Loopers and an edge trimmer, no bobbin.
   ───────────────────────────────────────────────────────────────────────── */
export const OVERLOCK_SCHEMA: ProductSchemaDefinition = {
  id: "overlock.v1",
  name: "Overlock Machine",
  divisionCode: "garment-machinery",
  categoryCode: "industrial-sewing-machines",
  subcategoryCode: "XSO",
  version: "1",
  groups: [
    {
      id: "overlock-stitch",
      title: "Overlock Stitch Configuration",
      order: 10,
      fields: [
        {
          id: "needle_count", key: "needle_count", label: "Needles", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "First column of the printed bar. 1 or 2 on an overlock — with the thread count it is what names the machine (2-thread, 4-thread, 5-thread safety).",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "thread_count", key: "thread_count", label: "Threads", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Second column of the printed bar — 2 to 6. The number buyers actually ask for.",
          suggestions: [2, 3, 4, 5, 6], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "needle_gauge", key: "needle_gauge", label: "Needle Gauge", order: 30,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Distance between needles. Printed as '–' on single-needle models, which is why this is text and not a number.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "overedging_width", key: "overedging_width", label: "Overedging Width", order: 40,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "How wide a bite the stitch takes over the edge — printed as a range (0.6–4.2).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "differential_feed_ratio", key: "differential_feed_ratio", label: "Differential Feed Ratio", order: 50,
          fieldType: "text", dataType: "string", required: false,
          description: "Printed as a range (0.7–1.7). Below 1 gathers, above 1 stretches — the control that makes knits sew flat.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "edge_trimmer", key: "edge_trimmer", label: "Edge Trimmer", order: 60,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "The knife that trims the seam allowance ahead of the loopers. Standard on overlock; called out because it is what the class is defined by.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Auto Thread Trimmer", order: 70,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Automatic chain cutting at the end of a seam — printed in the caption as 'UT' on the model code.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    sewingCoreGroup(20),
    materialGroup(30),
    electricalGroup(40),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   2 · COVERSTITCH / FLATLOCK (XSI) — ISO 602/406/407.
   The token stays XSI (CL-0018: the token is the identity); only the label
   was corrected, because "Interlock" is a knit fabric, not a stitch.
   ───────────────────────────────────────────────────────────────────────── */
export const COVERSTITCH_SCHEMA: ProductSchemaDefinition = {
  id: "coverstitch.v1",
  name: "Coverstitch (Flatlock) Machine",
  divisionCode: "garment-machinery",
  categoryCode: "industrial-sewing-machines",
  subcategoryCode: "XSI",
  version: "1",
  groups: [
    {
      id: "coverstitch-stitch",
      title: "Coverstitch Configuration",
      order: 10,
      fields: [
        {
          id: "coverstitch_type", key: "coverstitch_type", label: "Cover Type", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "Which faces of the fabric the cover thread lands on. Top-and-bottom is what the trade calls flatlock, and it is a different machine to buy.",
          options: [
            { value: "bottom_cover", label: "Bottom Cover" },
            { value: "top_and_bottom", label: "Top and Bottom (Flatlock)" },
            { value: "top_cover_only", label: "Top Cover Only" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "needle_count", key: "needle_count", label: "Needles", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Printed on the bar — 2, 3 or 4. Sets how many cover rows the stitch lays.",
          suggestions: [2, 3, 4], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "thread_count", key: "thread_count", label: "Threads", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Printed on the bar — 4, 5 or 6.",
          suggestions: [3, 4, 5, 6], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "needle_gauge", key: "needle_gauge", label: "Needle Gauge", order: 40,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Printed as a pair on multi-needle heads (5.6/6.4) — the spacing between adjacent needles.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "elastic_band_range", key: "elastic_band_range", label: "Elastic Band Range", order: 50,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Printed in the model description where the machine attaches elastic — 'application range: 14–37mm'.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "puller_device", key: "puller_device", label: "Puller Device", order: 60,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Rear puller that keeps long knit seams feeding straight. Printed in the caption as 'with puller'.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "thread_wiper", key: "thread_wiper", label: "Thread Wiper", order: 70,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Printed in the caption as 'with thread wiper' — clears the tail after trimming.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Auto Thread Trimmer", order: 80,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Printed in the caption as 'with thread trimming'.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    sewingCoreGroup(20),
    materialGroup(30),
    electricalGroup(40),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   3 · CHAINSTITCH (XSC) — ISO 101 (single-thread) / 401 (double-locked).
   ───────────────────────────────────────────────────────────────────────── */
export const CHAINSTITCH_SCHEMA: ProductSchemaDefinition = {
  id: "chainstitch.v1",
  name: "Chainstitch Machine",
  divisionCode: "garment-machinery",
  categoryCode: "industrial-sewing-machines",
  subcategoryCode: "XSC",
  version: "1",
  groups: [
    {
      id: "chainstitch-stitch",
      title: "Chainstitch Configuration",
      order: 10,
      fields: [
        {
          id: "stitch_class", key: "stitch_class", label: "ISO Stitch Class", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "101 unravels when pulled from the right end — which is exactly why bag-closing machines use it. 401 does not. Getting this wrong sells the wrong machine.",
          options: [
            { value: "101", label: "101 — Single Thread Chainstitch" },
            { value: "401", label: "401 — Double-Locked Chainstitch" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "needle_count", key: "needle_count", label: "Needles", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "1 on a bag closer, up to 12 on a multi-needle elastic or smocking head.",
          suggestions: [1, 2, 3, 4], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "thread_count", key: "thread_count", label: "Threads", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "1 for class 101; 2 per needle for class 401.",
          suggestions: [1, 2, 4], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "needle_gauge", key: "needle_gauge", label: "Needle Gauge", order: 40,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Spacing between needles on multi-needle heads.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "looper_type", key: "looper_type", label: "Looper Type", order: 50,
          fieldType: "select", dataType: "string", required: false,
          description: "A chainstitch has no bobbin — the looper is what forms the stitch, so it is the mechanism to record.",
          options: [
            { value: "single_looper", label: "Single Looper" },
            { value: "double_locked", label: "Double-Locked Looper" },
            { value: "spreader", label: "Looper with Spreader" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Auto Thread Trimmer", order: 60,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Chain cutting at the end of a seam.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    sewingCoreGroup(20),
    materialGroup(30),
    electricalGroup(40),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

export const SEWING_STITCH_TYPE_SCHEMAS: ProductSchemaDefinition[] = [
  OVERLOCK_SCHEMA,
  COVERSTITCH_SCHEMA,
  CHAINSTITCH_SCHEMA,
];

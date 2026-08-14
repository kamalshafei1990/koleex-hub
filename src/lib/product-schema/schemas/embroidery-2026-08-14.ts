/**
 * XES · Single Head Embroidery Machines  and  XEM · Multi Head Embroidery
 * Machines — spec templates.
 *
 * THE FIRST TEMPLATES IN EMBROIDERY EQUIPMENT, which had five coded
 * subcategories and none.
 *
 * SOURCE — `FNZ (芬瓷)` / Hangzhou Fenci Technology, 6 pages, image-only,
 * surfaced by the cover triage. Small but dense: **five series, every one with a
 * printed spec table sharing the same seven columns** — series · model · head
 * count · needle count · embroidery area (Y×X mm) · gross weight · overall size.
 *
 * ONE TABLE, TWO CODES — the same reasoning as XSES/XSEB. The catalogue prints
 * the SAME seven-column table across everything from a 1-head desktop to a
 * 12-head gantry; head count is one column of it, not a different document. So
 * the FIELDS are shared and registered under both codes, and `head_count` is the
 * field that decides which shelf a machine sits on.
 *
 * ⚠️ THE FIELD KEY IS `embroidery_head_count`, NOT `head_count`. `f:head_count`
 * already exists on the needle-detector template meaning **"Detection Heads"**
 * (探头层数) — the layers of a detector coil, nothing to do with embroidery. The
 * budget gate caught the collision as a duplicate translation key, and the naive
 * fix (drop the duplicate) would have left this field silently rendering as
 * "Detection Heads" in all three languages. **A key is shared only if the
 * MEANING is shared** — the same rule that renamed `fit_interlock` on XSPP.
 *
 * ⚠️ "体积(mm)" IS LABELLED *VOLUME* AND IS NOT A VOLUME. The column prints
 * `1120*880*910` — that is length × width × height in millimetres, an overall
 * SIZE. Reading it as a volume (and dividing, or converting to m³) produces
 * nonsense. The catalogue's own English header says "volume"; the numbers say
 * otherwise, and the numbers win.
 *
 * ⚠️ THE MODEL CODE ENCODES THE SPEC, AND IT IS A USEFUL CHECK. `M106` = 1 head,
 * 06 needles. `M1215` = 12 heads, 15 needles. `P109 plus` = 1 head, 9 needles,
 * long-travel. If the code and the head/needle columns disagree, the row was
 * mis-transcribed — this is the cheapest proofread available on these sheets.
 * One row breaks the pattern deliberately: `M130` is listed at **30 needles**,
 * which is not a typo for 3 heads — it appears on the single-head block.
 *
 * ⚠️ WHAT IS *NOT* BUILT HERE, AND A TAXONOMY FLAG THE OWNER SHOULD SEE.
 * Embroidery Equipment's five codes are `XES` single-head · `XEM` multi-head ·
 * `XEC` computerized · `XEB` cording/beading · `XEQ` sequin. `XEB` and `XEQ` are
 * genuinely different devices and this catalogue prints neither. **`XEC` is the
 * problem: "computerized" is a CONTROL attribute, and every machine in this
 * catalogue is computerized — so XEC overlaps XES and XEM completely rather than
 * sitting beside them.** That is the same shape of defect CL-0020 removed from
 * sewing, where `needle_count` and `duty` were demoted from subcategories to
 * facets. It is NOT fixed here: retiring a live code is an owner decision, and
 * this template deliberately does not register under `XEC`.
 *
 * VALUES OBSERVED (five series):
 *   PRINCIPAL 马头机  P106–P115 · 1 head · 6/9/12/15 needles
 *                     300×(400–600) → 500×(500–800) · 150–210 kg
 *   CLASSICAL 铝盆机  C106–C115 · 1 head · 500×1200, 500×800 · 210 kg
 *                     brushed stainless tabletop
 *   MAESTRO 龙门机    M106–M130 (1 head) · M206–M215 (2) · M312/M315 (3) ·
 *                     M412/M415 (4) · M512–M1215 (5,6,8,10,12 heads)
 *                     400×500 → 800×1600 · 220–1500 kg
 *   PRINCIPAL PLUS    P106–P115 plus · 500×(500–800) → 1000×2000 · 200–430 kg
 *   SOLO 桌面台式机   S106–S115 · 200×360 → 400×600 · 120 kg (desktop)
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

function embroideryConfigGroup(order: number, headHint: string): NonNullable<ProductSchemaDefinition["groups"]>[number] {
  return {
    id: "emb-config",
    title: "Embroidery Configuration",
    order,
    fields: [
      {
        id: "embroidery_head_count", key: "embroidery_head_count", label: "Head Count", order: 10,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: headHint,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needles_per_head", key: "needles_per_head", label: "Needles per Head", order: 20,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "Printed as a set — 6/9/12/15 across almost every series, meaning the same frame is sold in four needle counts. Needles per head IS the colour capacity: a 6-needle machine changes thread by hand past six colours, and that is the practical ceiling a customer buys against. One row breaks the pattern: M130 is listed at 30 needles.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "embroidery_area", key: "embroidery_area", label: "Embroidery Area (Y × X)", order: 30,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "⭐ The defining specification, and note the order: the catalogue prints **Y×X**, not X×Y. Values run from 200×360 mm on the desktop machine to 1000×2000 mm on the long-travel head. Some rows print a RANGE in the second figure — \"300*(400-600)\" — because the X travel depends on the frame fitted; keep the printed form, brackets and all, rather than picking one number out of it.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "machine_series_class", key: "machine_series_class", label: "Series / Body Type", order: 40,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "emb_body_horsehead", label: "Horse-Head (cantilever)" },
          { value: "emb_body_gantry", label: "Gantry" },
          { value: "emb_body_basin", label: "Aluminium Basin" },
          { value: "emb_body_desktop", label: "Desktop / Benchtop" },
          { value: "emb_body_long_travel", label: "Long-Travel Cantilever" },
        ],
        description: "The catalogue's own five series, and they are BODY types rather than marketing names: 马头机 horse-head is a cantilever, 龙门机 is a gantry, 铝盆机 an aluminium-basin frame, 桌面台式机 a benchtop, and 大行程 the long-travel cantilever. Two machines with the same head count and the same area are still different products if the body differs, because the body sets the footprint and what can be hooped.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

function driveFrameGroup(order: number): NonNullable<ProductSchemaDefinition["groups"]>[number] {
  return {
    id: "emb-drive-frame",
    title: "Drive & Frame",
    order,
    fields: [
      {
        id: "x_axis_drive", key: "x_axis_drive", label: "X-Axis Drive", order: 10,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "\"Rack and pinion + linear guide rail transmission\" on the gantry series. The X axis carries the whole frame across the widest span, so how it is driven is what the accuracy claim rests on — a belt and a rack are not interchangeable at 1600 mm of travel.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "y_axis_drive", key: "y_axis_drive", label: "Y-Axis Drive", order: 20,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "Linear guide rails on Y, combined with rack-and-pinion on X on the long-travel machine — printed as \"an industry-first design\". Recorded separately from X because the two axes are genuinely built differently on these machines.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "colour_change_drive", key: "colour_change_drive", label: "Colour-Change Drive", order: 30,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "\"Ball screw for colour changing.\" On a 15-needle head the colour change runs thousands of times a shift, so its mechanism is a wear item and a service cost, not a convenience feature.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "shuttle_bed_bearings", key: "shuttle_bed_bearings", label: "Shuttle Bed Bearings", order: 40,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "The catalogue prints a direct comparison: a traditional shuttle bed carries **2** bearings, this one **4**, with 4–6 shaft holes wire-cut vertically in one pass. It is claimed to raise coaxiality and cut the risk of the shuttle shaft seizing. Record the count — it is the one number on the page that distinguishes the mechanism rather than the marketing.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "tabletop_type", key: "tabletop_type", label: "Tabletop Type", order: 50,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "Three printed kinds and they are a real operating difference: NON-DETACHABLE (principal series, \"saves time and effort\"), BRUSHED STAINLESS (classical, \"rust-free\"), and SPRING-BUTTON FLIP-UP, where the board releases in seconds to switch between flat and cap/tubular work. Frame-change time is the hidden cost in embroidery, and this field is what predicts it.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "frame_construction", key: "frame_construction", label: "Frame Construction", order: 60,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "\"The machine body can be separated, easy to move, with reinforced large frame\", and a windproof/dustproof wire frame on the gantry series. Separability matters on the multi-head machines: a 5420 mm 12-head cannot enter most workshops assembled.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

export const SINGLE_HEAD_EMBROIDERY_SCHEMA: ProductSchemaDefinition = {
  id: "single-head-embroidery.v1",
  name: "Single Head Embroidery Machine",
  divisionCode: "garment-machinery",
  categoryCode: "embroidery-equipment",
  subcategoryCode: "XES",
  version: "1",
  groups: [
    embroideryConfigGroup(10, "1 on every machine that belongs here. Enter it anyway rather than leaving it blank: head count is the field that decides between this subcategory and XEM, and a blank reads as unknown rather than as one. The model code carries it too — M106 is 1 head, 06 needles."),
    driveFrameGroup(20),
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const MULTI_HEAD_EMBROIDERY_SCHEMA: ProductSchemaDefinition = {
  id: "multi-head-embroidery.v1",
  name: "Multi Head Embroidery Machine",
  divisionCode: "garment-machinery",
  categoryCode: "embroidery-equipment",
  subcategoryCode: "XEM",
  version: "1",
  groups: [
    embroideryConfigGroup(10, "2, 3, 4, 5, 6, 8, 10 or 12 — the printed steps. It is the field that decides between this subcategory and XES, and it drives everything commercial about the machine: gross weight runs 310 kg at 2 heads to 1500 kg at 12, and the overall length from 1380 mm to 5420 mm. The model code carries it — M1215 is 12 heads, 15 needles — so use the code to proofread the row."),
    driveFrameGroup(20),
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const EMBROIDERY_SCHEMAS: ProductSchemaDefinition[] = [
  SINGLE_HEAD_EMBROIDERY_SCHEMA,
  MULTI_HEAD_EMBROIDERY_SCHEMA,
];

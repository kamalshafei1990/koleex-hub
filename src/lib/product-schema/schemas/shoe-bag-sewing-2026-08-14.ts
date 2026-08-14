/**
 * XSES · Shoe Sewing Machines  and  XSEB · Bag Sewing Machines — spec templates.
 *
 * THE FIRST TWO TEMPLATES IN LEATHER & FOOTWEAR MACHINERY, which had 6 coded
 * subcategories and ZERO templates — the Hub's largest untouched gap, and the
 * only category that had no source catalogue at all.
 *
 * SOURCE — S-GOLDSEW (`金梭样册定稿文件.pdf`, Zhejiang Zojin / GOLDSEW·CADDIE·
 * JINMING), 52 pages, ~150 models, declared scope "shoes, luggage, bags, sofa,
 * gloves". Series 双线座式内线机 / 缝包机 — *Double Thread Side Seam Shoe /
 * Bag Sewing Machine*: SR-168 · 168S · 168-1 · 168W · 168H · 169 · 2169 (shoe)
 * and SR-5168 · 6168 · 6168D (bag). Full inventory at
 * `docs/product-data-v2/reference-data/goldsew-2026-08-catalog-inventory.md`.
 *
 * ⚠️ IT WAS INVISIBLE TO EVERY SEARCH. `pdftotext` returns ZERO characters —
 * one of 51 image-only files out of 76 in the library. The gap memo had recorded
 * leather/footwear as "searched and confirmed empty"; that was a keyword sweep
 * over the 25 readable files. Read by rendering.
 *
 * ONE SHEET, TWO CODES, AND THAT IS DELIBERATE. The shoe and bag machines are
 * the same mechanism sold to two trades — the bag models are printed inside the
 * same series with the same spec header. So the FIELDS are shared here, exactly
 * as XCS/XCR share a motor group. What is NOT shared is the data: the printed
 * table covers SR-168/168S/168-1 only, and the bag models have no weights or
 * dimensions of their own in the catalogue. **Do not copy the shoe figures onto
 * a bag machine** — leave the field blank until a bag sheet prints one.
 *
 * ⚠️ THE NUMBERS THAT IDENTIFY THIS CLASS LOOK LIKE MISTAKES NEXT TO A NORMAL
 * LOCKSTITCH, AND THEY ARE NOT:
 *   · **800 s.p.m.** — roughly a third of the 2,500 rpm post-bed on page 17 of
 *     the same catalogue. A side-seam machine drives a curved awl through an
 *     assembled shoe; speed is not what it is bought for.
 *   · **needle CP×5, not DP×5 or DP×17.** Every other series in this catalogue
 *     prints a DP system. CP×5 is the shoe-machine needle, and it is the fastest
 *     way to tell this class from a heavy lockstitch on a spec sheet.
 *   · **stitch length 1–12 mm** where the lockstitch series prints 1–6.
 *   · **needle bar stroke 46 mm** and **presser foot lift 17 mm** — both roughly
 *     a quarter more than the post-bed machines.
 *   · **120/135 kg net/gross** against 37.5/44 kg for the post bed. A machine
 *     three times the weight at a third of the speed is a different class, not a
 *     heavy-duty option on the same one.
 * Anyone reading 800 and "correcting" it to 8000 destroys the record.
 *
 * WHAT IS DELIBERATELY NOT HERE — bed shape, feed type, needle count and duty.
 * They live on the facet axis and reach the form through the Machine-Kind
 * attributes; the material column on this very sheet marks **H only**, with L
 * and M dashed, which is `fabric_weight_class`, not a field. That exclusion is
 * the two-axis model in practice (CL-0020).
 *
 * VALUES OBSERVED (SR-168 / 168S / 168-1, the only rows printed):
 *   800 s.p.m · CP×5 · stitch length 1–12 mm · 1 needle · 2 threads
 *   needle bar stroke 46 mm · presser foot lift 17 mm · 750 W
 *   N.W./G.W. 120/135 kg · packing 1030×550×1290 mm · heavy material only
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

/* ── Shared: the printed spec bar ────────────────────────────────────────────
   Eleven icon columns, decoded against the catalogue's own symbols page (the
   last spread prints 40 icons with Chinese + English labels). Three of those
   columns are facets, not fields, and are excluded above. */
function stitchAndNeedleGroup(order: number): NonNullable<ProductSchemaDefinition["groups"]>[number] {
  return {
    id: "shoe-stitch-needle",
    title: "Stitch & Needle",
    order,
    fields: [
      {
        id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 10,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "800 s.p.m. across the whole family. Read that twice before entering it: the post-bed series in the same catalogue prints 2,500. This machine drives a curved needle through an assembled shoe or bag, and it is not bought for speed — a figure near 2,000 here almost certainly belongs to a different class of machine.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needle_system", key: "needle_system", label: "Needle System", order: 20,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "CP×5. This is the single fastest way to identify the class from a spec sheet — every other series in this catalogue prints a DP system (DP×5, DP×17). A machine quoting DP×17 is a heavy lockstitch, not a side-seam machine, however similar the photograph looks.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "stitch_length_max", key: "stitch_length_max", label: "Stitch Length", order: 30,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "Printed as a range, 1–12 mm. Kept as the printed phrase rather than a single maximum: the whole band is the specification, and the lockstitch series in the same catalogue prints 1–6, so the range itself distinguishes the machine.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "thread_count", key: "thread_count", label: "Number of Threads", order: 40,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "2 — a needle thread and a bobbin thread locking together. The series name 双线 (\"double thread\") refers to this, NOT to two needles. A two-needle model (SR-169 / SR-2169) still runs two threads per needle, so this column and the needle count move independently.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needle_gauge", key: "needle_gauge", label: "Needle Gauge", order: 50,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "The distance between needles on a two-needle model. Dashed on the single-needle rows, and a dash means NOT APPLICABLE — leave it blank rather than entering 0, which would read as two needles touching.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needle_bar_stroke", key: "needle_bar_stroke", label: "Needle Bar Stroke", order: 60,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "46 mm. Together with the presser foot lift this is what lets the machine clear an assembled upper; the post-bed machines in the same catalogue print 37 mm. It is a fixed mechanical property, not an adjustment.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 70,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "17 mm — the thickness of assembled work the machine will take under the foot. This is the number a footwear customer checks first, because it decides whether a lasted upper fits at all.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "hook_size", key: "hook_size", label: "Hook Size", order: 80,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "hook_standard_shoe", label: "Standard" },
          { value: "hook_small_shoe", label: "Small Hook" },
          { value: "hook_large_shoe", label: "Large Hook" },
        ],
        description: "The S suffix in the range is the small hook (小梭) — SR-168S differs from SR-168 in this and nothing else on the printed table. A larger hook holds more bobbin thread and means fewer changes on a long perimeter seam, which is the whole economics of this machine.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

/* ── Shared: the frame, which is what the suffixes in the range actually mean ── */
function frameAndFeedGroup(order: number, workpieceHint: string): NonNullable<ProductSchemaDefinition["groups"]>[number] {
  return {
    id: "shoe-frame-feed",
    title: "Frame & Feed",
    order,
    fields: [
      {
        id: "work_surface_geometry", key: "work_surface_geometry", label: "Work Surface Geometry", order: 10,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "What the suffixes in the range mean: the W model is a bevelled surface (斜面车缝), the H a raised one. The catalogue prints these as separate models rather than as options, so record the printed description — the operator chooses a machine by the shape the work sits on.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "feed_drive_type", key: "feed_drive_type", label: "Feed Drive", order: 20,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "feed_drive_gear", label: "Gear Drive" },
          { value: "feed_drive_sync_belt", label: "Synchronous Belt" },
        ],
        description: "\"Gear drive or synchronous belt feeding mechanism, combined with high-grip feed dogs.\" The catalogue offers both and does not treat them as equivalent — a gear train survives more abuse, a belt runs quieter. This is a build difference, not a setting.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "thread_tension_system", key: "thread_tension_system", label: "Thread Tension System", order: 30,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "tension_independent", label: "Independent (needle + bobbin)" },
          { value: "tension_common", label: "Common" },
        ],
        description: "\"The needle thread and bobbin thread tension can be adjusted separately.\" Printed as a headline advantage, because leather and canvas of different thicknesses need different balances and a common tension forces one compromise across the seam.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "body_construction", key: "body_construction", label: "Body Construction", order: 40,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "body_cast_iron", label: "Cast Iron" },
          { value: "body_alloy", label: "Alloy" },
        ],
        description: "\"Cast iron or alloy base.\" On a 120 kg machine this is not trim — the mass IS the vibration control that keeps the stitch clean through several layers, which is why the catalogue prints it before any electronics.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "worktable_profile", key: "worktable_profile", label: "Worktable Profile", order: 50,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "worktable_low_profile", label: "Low-Profile" },
          { value: "worktable_standard", label: "Standard Height" },
        ],
        description: "\"Low-profile worktable design facilitates handling of heavy or oversized workpieces.\" It is an ergonomic fact with a production consequence: the operator manoeuvres a bulky assembled piece rather than feeding flat panels.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "workpiece_applications", key: "workpiece_applications", label: "Applicable Workpieces", order: 60,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: workpieceHint,
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

export const SHOE_SEWING_SCHEMA: ProductSchemaDefinition = {
  id: "shoe-sewing.v1",
  name: "Shoe Sewing Machine",
  divisionCode: "garment-machinery",
  categoryCode: "leather-footwear-machinery",
  subcategoryCode: "XSES",
  version: "1",
  groups: [
    stitchAndNeedleGroup(10),
    frameAndFeedGroup(20, "The catalogue prints \"shoe upper assembly\" first, then automotive seat upholstery, tent manufacturing and luggage frames. Record what the sheet claims, not what the machine could conceivably do — the list is what the maker will support."),
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const BAG_SEWING_SCHEMA: ProductSchemaDefinition = {
  id: "bag-sewing.v1",
  name: "Bag Sewing Machine",
  divisionCode: "garment-machinery",
  categoryCode: "leather-footwear-machinery",
  subcategoryCode: "XSEB",
  version: "1",
  groups: [
    stitchAndNeedleGroup(10),
    frameAndFeedGroup(20, "Luggage and bag bodies, and the frame seams that close them. ⚠️ The bag models (SR-5168 / 6168 / 6168D) are printed inside the SHOE series and share its spec header — but no weights, dimensions or speeds of their own are published. Leave a figure blank rather than copying it from the shoe rows."),
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const SHOE_BAG_SEWING_SCHEMAS: ProductSchemaDefinition[] = [
  SHOE_SEWING_SCHEMA,
  BAG_SEWING_SCHEMA,
];

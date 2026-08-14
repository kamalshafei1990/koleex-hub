/**
 * XPCF · Folding Machines (garment folding & packing) — spec template.
 *
 * SOURCE — Koleex 2025 Packing Equipment section (PDF page 127), read by
 * rendering. Four machines, each with its own parameter table:
 *   XPL-1   full folding & packing LINE
 *   XPS-1   folding & packing machine, small footprint
 *   XPS-2   folding & packing machine, larger frame
 *   XS-1    automatic packing & SEALING machine
 * Model codes are the OLD edition and are being renumbered; only the FIELDS
 * are taken from the sheet.
 *
 * WHY THIS ONE AND NOT ITS NEIGHBOURS. `Packing & Inspection` has eight coded
 * subcategories and one template (`XPCN` needle detectors). Of the seven gaps,
 * this is the ONLY one with a printed spec table anywhere in the library:
 *   · `XPCC` carton sealing, `XPCH` garment hanging, `XPCT` packing tables —
 *     no machine sheet in any catalogue.
 *   · `XPCM` metal detectors, `XPCX` X-ray inspection — nothing at all.
 *   · `XPCI` final fabric inspection — machines exist in the Pre-Sewing
 *     section, but they belong to `Fabric Preparation`, which is already
 *     complete; filing them here would duplicate a templated class.
 *
 * ⚠️ TWO SEPARATE MACHINES HIDE UNDER ONE CATEGORY NAME, and the template says
 * so with `machine_function`. A FOLDER folds and stacks; a PACKER puts the
 * folded piece in a bag and seals it. The XPL-1 line does both, the XPS pair
 * offers "pack with bag OR stack without bag" as a MODE, and the XS-1 only
 * bags and seals. Recording throughput without recording which of the three a
 * machine is makes the numbers incomparable.
 *
 * VALUES OBSERVED:
 *   folded size 25×40 cm · fold length 20–40 cm · 300–500 pcs/h (line)
 *   300–360 pcs/h (single) · 220 V 50 Hz · 0.7–4 kW · 0.6 MPa
 *   footprint 1120×910×840 mm (single) to 6800×1100×1500 mm (line)
 *   bag range 22–25 × 15–16 cm · sealing tear-sticker / two-tape / heat-cut
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

export const FOLDING_PACKING_SCHEMA: ProductSchemaDefinition = {
  id: "folding-packing.v1",
  name: "Folding & Packing Machine",
  divisionCode: "garment-machinery",
  categoryCode: "packing-inspection",
  subcategoryCode: "XPCF",
  version: "1",
  groups: [
    {
      id: "fold-function",
      title: "Function & Garment Range",
      order: 10,
      fields: [
        {
          id: "machine_function", key: "machine_function", label: "Machine Function", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "fold_only", label: "Folding Only" },
            { value: "fold_and_pack", label: "Folding & Packing" },
            { value: "pack_seal_only", label: "Packing & Sealing Only" },
          ],
          description: "Fill this FIRST. A folder folds and stacks; a packer bags and seals; the line does both. The XPS machines offer \"pack with bag or stack without bag\" as a switchable MODE, and the XS-1 does not fold at all. Two machines quoted at 300 pcs/h are not comparable until this field says what each of them was counting.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "folded_size", key: "folded_size", label: "Folded Size", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "The finished stack, e.g. 25×40 cm, or a settable band (\"W 30 cm × 15–32 cm\"). This is what has to fit the customer's carton, so it is the number the packing spec is written against — not the garment size.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "fold_length_range", key: "fold_length_range", label: "Fold Length Range", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "20–40 cm on the line. Distinct from folded size: this is how much garment each fold takes in, so a long coat and a T-shirt need different settings on the same machine. Both width and length are adjustable on the XPS pair.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "garment_applications", key: "garment_applications", label: "Applicable Garments", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"T-shirt, polo shirt, underwear, thermal underwear, thin coat, trousers.\" Every sheet stops at THIN coat — a folder is defined by the bulk it can compress, and a padded jacket is a different machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "fold-throughput",
      title: "Throughput & Handling",
      order: 20,
      fields: [
        {
          id: "cutting_output_rate", key: "cutting_output_rate", label: "Output Rate", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "300–500 pcs/h on the line, 300–360 on a single machine. Kept as the printed phrase: the line's figure includes bagging and the single machine's may not, which is exactly why `machine_function` has to be read alongside it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operation_mode", key: "operation_mode", label: "Operation Mode", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "op_fully_automatic", label: "Fully Automatic" },
            { value: "op_semi_automatic", label: "Semi-Automatic" },
          ],
          description: "The XPS machines are printed \"semi-automatic\" — an operator loads each piece — while the line and the XS-1 run automatically. On a machine sold on labour saving, this is the specification.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stacking_method", key: "stacking_method", label: "Stacking Method", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Horizontal\" on the line, \"drawer\" on the bench machines. It decides where the operator stands and how the finished stack leaves the machine, which is a line-layout fact rather than a feature.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "touch_screen_control", key: "touch_screen_control", label: "Touch Screen Control", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Adjust specifications quickly via touch screen.\" On a folder, changeover between garment types IS the setup cost, so a screen that stores specifications is what makes short runs viable.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "data_acquisition", key: "data_acquisition", label: "Data Acquisition", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Real-time data acquisition connects to the enterprise's existing systems\" — printed only on the XPL-1 line. Worth recording because a customer with an MES will ask, and only one machine in the family answers yes.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "fold-bagging",
      title: "Bagging & Sealing",
      order: 30,
      fields: [
        {
          id: "bag_size_range", key: "bag_size_range", label: "Bag Size Range", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "22–25 × 15–16 cm (W×L) on the XS-1, and the sheet adds that \"the width and length of bags are adjustable\". Leave BLANK on a fold-only machine rather than entering zero — blank means the machine does not bag.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "sealing_method", key: "sealing_method", label: "Sealing Method", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Three printed options: tear sticker, two-tape, heat-cut. They are not interchangeable — a heat-cut seal is permanent, a tear sticker is meant to be opened in the shop — so the choice follows the retail channel, not the machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_air_pressure", key: "working_air_pressure", label: "Working Air Pressure", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0.6 MPa across the family. Kept as the printed phrase, consistent with every other pneumatic machine in the Hub.",
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

export const FOLDING_PACKING_SCHEMAS: ProductSchemaDefinition[] = [FOLDING_PACKING_SCHEMA];

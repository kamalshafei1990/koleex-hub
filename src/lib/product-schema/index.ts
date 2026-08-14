import { LOCKSTITCH_SCHEMA } from "./schemas/lockstitch";
import { SPREADING_MACHINES_SCHEMA } from "./schemas/spreading-machines";
import { FABRIC_RELAXING_SCHEMA } from "./schemas/fabric-relaxing";
import { FABRIC_INSPECTION_SCHEMA } from "./schemas/fabric-inspection";
import { FABRIC_ROLLING_SCHEMA } from "./schemas/fabric-rolling";
import { FABRIC_CUTTING_TABLE_SCHEMA } from "./schemas/fabric-cutting-table";
import { FABRIC_PRESHRINK_SCHEMA } from "./schemas/fabric-preshrink";
import {
  FUSING_MACHINE_SCHEMA,
  FUSING_MACHINE_FABRIC_PREP_SCHEMA,
  IRONING_TABLE_SCHEMA,
  VACUUM_IRONING_TABLE_SCHEMA,
  TROUSER_PRESSING_SCHEMA,
  STEAM_GENERATOR_SCHEMA,
  FORM_FINISHING_SCHEMA,
  NEEDLE_DETECTOR_SCHEMA,
  GARMENT_REVERSING_SCHEMA,
  IRONING_SYSTEMS_BINDINGS,
} from "./schemas/finishing-batch-2026-08";
import { YILI_BATCH_SCHEMAS } from "./schemas/yili-batch-2026-08-12";
import { IRONING_HEATPRESS_BATCH_SCHEMAS } from "./schemas/ironing-heatpress-batch-2026-08-12";
import { SEWING_STITCH_TYPE_SCHEMAS } from "./schemas/sewing-stitch-types-2026-08-12";
import { ZIGZAG_SCHEMAS } from "./schemas/zigzag-2026-08-13";
import { PROGRAMMABLE_CNC_SCHEMAS } from "./schemas/programmable-cnc-2026-08-13";
import { AUTOMATION_UNIT_SCHEMAS } from "./schemas/automation-units-2026-08-13";
import { BUTTONHOLE_BARTACK_SCHEMAS } from "./schemas/buttonhole-bartack-2026-08-13";
import { BUTTON_ATTACHING_SCHEMAS } from "./schemas/button-attaching-2026-08-13";
import { HEMMING_SCHEMAS } from "./schemas/hemming-2026-08-13";
import { KNIFE_CUTTING_SCHEMAS } from "./schemas/knife-cutting-2026-08-14";
import { registerSchema } from "./registry";

registerSchema(LOCKSTITCH_SCHEMA);
registerSchema(SPREADING_MACHINES_SCHEMA);
/* XPR fabric-preparation family — owner's XPR templates, organized (see
   docs/product-data-v2/spec-templates/xpr-fabric-preparation-spec-templates.md) */
registerSchema(FABRIC_RELAXING_SCHEMA);
registerSchema(FABRIC_INSPECTION_SCHEMA);
registerSchema(FABRIC_ROLLING_SCHEMA);
registerSchema(FABRIC_CUTTING_TABLE_SCHEMA);
registerSchema(FABRIC_PRESHRINK_SCHEMA);

/* Finishing-equipment batch (2026-08-05, owner-approved) — the YILI catalog
   audit found 18 live fusing products and a whole finishing catalog with no
   structured spec home. Nine registrations, seven families (XFFP binds under
   both its live categories; XFVT shares the XFIT family). */
registerSchema(FUSING_MACHINE_SCHEMA);
registerSchema(FUSING_MACHINE_FABRIC_PREP_SCHEMA);
registerSchema(IRONING_TABLE_SCHEMA);
registerSchema(VACUUM_IRONING_TABLE_SCHEMA);
registerSchema(TROUSER_PRESSING_SCHEMA);
registerSchema(STEAM_GENERATOR_SCHEMA);
registerSchema(FORM_FINISHING_SCHEMA);
registerSchema(NEEDLE_DETECTOR_SCHEMA);
registerSchema(GARMENT_REVERSING_SCHEMA);

/* YILI catalog batch (2026-08-12, owner-approved) — the two subcategories
   that hold live YILI products and still had no spec template: XFSP Spotting
   Machines (catalog pp. 81–82) and XFTS Thread Sucking / Brushing (pp. 87–88).
   Every field is traceable to a printed column on those pages. */
for (const schema of YILI_BATCH_SCHEMAS) registerSchema(schema);

/* Ironing + Heat-Press batch (2026-08-12, owner-approved) — the four
   subcategories that held live products and still had no template:
   XFSI Steam Irons, XFCP Collar & Cuff Press (both Ironing Systems), and
   XPDH Double Station + XPPH Pneumatic Heat Press (Printing & Heat Press).
   Built from TWO registered sources per family, because they are
   complementary: S-001 (Koleex 2025) prints one model per page in one
   column, S-003 (supplier library) prints a model matrix and the fields
   S-001 omits. On XFSI the union is 8 fields where each source alone is 6–7.
   See docs/product-data-v2/reference-data/source-catalogs.md. */
for (const schema of IRONING_HEATPRESS_BATCH_SCHEMAS) registerSchema(schema);

/* CL-0020 step 4 — the three stitch types that survived the audit next to XSL,
   which already had a template: XSO Overlock, XSI Coverstitch (renamed from
   "Interlock"), XSC Chainstitch. Bed / feed / needle count / duty are NOT in
   these schemas — they live on the facet axis and reach the form through the
   Machine-Kind attributes, which is the whole point of the two-axis model. */
for (const schema of SEWING_STITCH_TYPE_SCHEMAS) registerSchema(schema);

/* XSZ Zigzag — CL-0020 minted the token but shipped no template, so the form
   rendered zero fields for every zigzag model. Built 2026-08-13 off the
   Yuegong/SEASTAR printed spec table. */
for (const schema of ZIGZAG_SCHEMAS) registerSchema(schema);

/* XAPT Programmable / CNC Sewing — the FIRST template in Automatic Sewing
   Systems, a category of eleven subcategories that had none, so every
   automation machine rendered an empty form. Built 2026-08-13 off the S-JOOKE
   printed parameter table (14 machines, one consistent column set). */
for (const schema of PROGRAMMABLE_CNC_SCHEMAS) registerSchema(schema);

/* XAPW Pocket Welting + XAPP Placket Sewing Units — the second and third
   templates in Automatic Sewing Systems. Cross-read from the S-FDK and
   S-JOOKE printed parameter tables so no field rests on a single sheet. */
for (const schema of AUTOMATION_UNIT_SCHEMAS) registerSchema(schema);

/* XABH Buttonhole + XABT Bartacking. Source is S-GEMSY, whose spec tables are
   IMAGES with pictogram headers — a text-only read finds no numbers at all.
   See the file header before extending either. */
for (const schema of BUTTONHOLE_BARTACK_SCHEMAS) registerSchema(schema);

/* XABA Button Attaching — S-GEMSY SG 1903B, same image-table caveat. */
for (const schema of BUTTON_ATTACHING_SCHEMAS) registerSchema(schema);

/* XAHM Hemming — S-JOOKE. The LAST subcategory in Automatic Sewing Systems the
   current catalogue library can support: XACL, XASL and XASS have no source
   with a printed spec table and stay empty rather than invented. */
for (const schema of HEMMING_SCHEMAS) registerSchema(schema);

/* XCS Straight Knife + XCR Round Knife — the first two templates in Cutting
   Equipment, measured as the Hub's largest single gap (9 subcategories, zero
   templates). Read from the Koleex catalogue by RENDERING; it has no text. */
for (const schema of KNIFE_CUTTING_SCHEMAS) registerSchema(schema);

/* CL-0018 — ironing family re-bound under the new "ironing-systems"
   category (tokens unchanged; see finishing-batch-2026-08.ts). */
for (const binding of IRONING_SYSTEMS_BINDINGS) registerSchema(binding);

export {
  registerSchema,
  resolveSchema,
  listSchemas,
  clearSchemas,
  getSchemaById,
} from "./registry";

export {
  DEFAULT_PUBLIC_VISIBILITY,
  DEFAULT_INTERNAL_VISIBILITY,
  DEFAULT_COMMERCIAL_VISIBILITY,
  DEFAULT_TECHNICAL_VISIBILITY,
  SURFACE_TO_FLAG,
  isVisibleIn,
  filterFieldsForSurface,
  filterKnowledgeForSurface,
} from "./visibility";

export {
  VISUAL_OPTIONS,
  FIELD_VISUAL_DOMAIN,
  GROUP_EMPHASIS,
  domainForField,
  resolveOptionVisual,
  emphasisForGroup,
  collectAnchors,
} from "./visual-options";
export type {
  OptionVisual,
  GroupEmphasis,
  ProductAnchor,
  AnchorKind,
  AnchorType,
  CollectAnchorsOptions,
} from "./visual-options";

export { computeReadiness } from "./readiness";
export type {
  ReadinessDimension,
  ReadinessScore,
  ReadinessReport,
  ReadinessInput,
} from "./readiness";

export { LOCKSTITCH_SCHEMA };

export type {
  ProductSchemaDefinition,
  SpecGroup,
  SpecField,
  VisibilityFlags,
  SpecFieldType,
  VisualRenderType,
  ProductKnowledgeBlock,
  ProductSchemaResolution,
  ProductSchemaSurface,
  SpecFieldOption,
  OptionVisualType,
} from "@/types/product-schema";

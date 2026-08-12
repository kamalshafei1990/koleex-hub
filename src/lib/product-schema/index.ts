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

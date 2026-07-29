import { LOCKSTITCH_SCHEMA } from "./schemas/lockstitch";
import { SPREADING_MACHINES_SCHEMA } from "./schemas/spreading-machines";
import { FABRIC_RELAXING_SCHEMA } from "./schemas/fabric-relaxing";
import { FABRIC_INSPECTION_SCHEMA } from "./schemas/fabric-inspection";
import { FABRIC_ROLLING_SCHEMA } from "./schemas/fabric-rolling";
import { FABRIC_CUTTING_TABLE_SCHEMA } from "./schemas/fabric-cutting-table";
import { FABRIC_PRESHRINK_SCHEMA } from "./schemas/fabric-preshrink";
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

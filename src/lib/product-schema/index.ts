import { LOCKSTITCH_SCHEMA } from "./schemas/lockstitch";
import { registerSchema } from "./registry";

registerSchema(LOCKSTITCH_SCHEMA);

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
  domainForField,
  resolveOptionVisual,
} from "./visual-options";
export type { OptionVisual } from "./visual-options";

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

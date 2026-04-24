/* Barrel for the new three-tier machine-specs module. Consumers
   should import from here, not reach into the internal folders. */

export type {
  FieldType,
  SpecTier,
  SpecSource,
  FieldOption,
  SpecField,
  SpecCard,
  ResolvedSpecs,
} from "./types";

export { COMMON_FIELDS } from "./common";
export { resolveSpecs, hasNewSpecSystem } from "./resolver";
export {
  FIELD_ICONS,
  GROUP_ICONS,
  CARD_ICONS,
  getFieldIcon,
  getGroupIcon,
  getCardIcon,
  type SpecIconComponent,
} from "./icons";

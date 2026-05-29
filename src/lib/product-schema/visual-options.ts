/* ---------------------------------------------------------------------------
   Visual Option Registry
   ---------------------------------------------------------------------------
   Central, reusable source of visual metadata for schema option VALUES. The
   schema only needs to store option { value, label }; this registry supplies
   the swatch / glyph / description / region for known values so every schema
   (and every surface — preview, website, brochure, quote, AI) renders the
   same visual language without re-declaring it.

   Resolution order for an option's visual:
     1. inline override on the SpecFieldOption (option.swatch / option.icon …)
     2. registry entry for (domain, value)
   where `domain` comes from field.optionSet, else from FIELD_VISUAL_DOMAIN
   (keyed by the field's `key`), else inferred from visualRenderType.

   Pure data + pure functions. No React, no Supabase. Colors are intentionally
   MUTED / desaturated industrial tones — material character, not marketplace
   rainbow. They sit quietly on the monochrome KOLEEX surface.
   --------------------------------------------------------------------------- */

import type { OptionVisualType, SpecField, SpecFieldOption } from "@/types/product-schema";

export interface OptionVisual {
  /** Muted material tone for material-style swatches (CSS color). */
  swatch?: string;
  /** Glyph token resolved by <VisualGlyph/> (e.g. "motor-servo", "plug"). */
  icon?: string;
  /** One-line explanation — shown on cards, tooltips, and read by AI later. */
  description?: string;
  /** Short region / class label (e.g. plug region "EU"). */
  badge?: string;
  visualType?: OptionVisualType;
}

type DomainMap = Record<string, OptionVisual>;

/* ── Materials — muted, woven-fabric tones ─────────────────────── */
const FABRIC: DomainMap = {
  cotton:    { swatch: "#D8D0C0", description: "Soft woven natural fiber", visualType: "material" },
  denim:     { swatch: "#46586B", description: "Heavy twill cotton weave", visualType: "material" },
  silk:      { swatch: "#CFC6BC", description: "Fine delicate filament weave", visualType: "material" },
  wool:      { swatch: "#8A8074", description: "Warm napped animal fiber", visualType: "material" },
  polyester: { swatch: "#AEB4BA", description: "Durable synthetic filament", visualType: "material" },
  linen:     { swatch: "#CcC4B0", description: "Crisp natural bast fiber", visualType: "material" },
  knit:      { swatch: "#B6ADA2", description: "Stretch looped construction", visualType: "material" },
  leather:   { swatch: "#5E4F40", description: "Tanned hide, heavy seams", visualType: "material" },
  canvas:    { swatch: "#BCB29A", description: "Stiff heavy plain weave", visualType: "material" },
  nylon:     { swatch: "#9AA0A6", description: "Tough synthetic filament", visualType: "material" },
};

/* ── Applications / garments — line-glyph tokens ───────────────── */
const APPLICATION: DomainMap = {
  apparel:       { icon: "app-apparel", description: "General garment production", visualType: "application" },
  denim_jeans:   { icon: "app-jeans",   description: "Jeans and denim assembly", visualType: "application" },
  shirts:        { icon: "app-shirt",   description: "Shirts and blouses", visualType: "application" },
  suits:         { icon: "app-suit",    description: "Tailored suiting", visualType: "application" },
  sportswear:    { icon: "app-sport",   description: "Activewear and sports", visualType: "application" },
  lingerie:      { icon: "app-lingerie",description: "Light intimate apparel", visualType: "application" },
  uniforms:      { icon: "app-uniform", description: "Workwear and uniforms", visualType: "application" },
  leather_goods: { icon: "app-leather", description: "Bags and leather goods", visualType: "application" },
};

const GARMENT: DomainMap = {
  shirts:   { icon: "app-shirt",   visualType: "garment" },
  trousers: { icon: "app-trouser", visualType: "garment" },
  jackets:  { icon: "app-jacket",  visualType: "garment" },
  dresses:  { icon: "app-dress",   visualType: "garment" },
  jeans:    { icon: "app-jeans",   visualType: "garment" },
  workwear: { icon: "app-uniform", visualType: "garment" },
};

/* ── Motor types ───────────────────────────────────────────────── */
const MOTOR: DomainMap = {
  servo:        { icon: "motor-servo",  description: "Energy-saving brushless servo", visualType: "motor" },
  clutch:       { icon: "motor-clutch", description: "Constant-run clutch motor", visualType: "motor" },
  direct_drive: { icon: "motor-direct", description: "Integrated direct-drive head", visualType: "motor" },
  integrated:   { icon: "motor-direct", description: "Integrated motor head", visualType: "motor" },
};

/* ── Feed mechanism ────────────────────────────────────────────── */
const FEED: DomainMap = {
  drop_feed:     { icon: "feed-drop",     description: "Bottom feed-dog transport", visualType: "feed" },
  compound_feed: { icon: "feed-compound", description: "Needle + foot + dog feed", visualType: "feed" },
  unison_feed:   { icon: "feed-compound", description: "Triple synchronized feed", visualType: "feed" },
  walking_foot:  { icon: "feed-walking",  description: "Alternating walking foot", visualType: "feed" },
};

/* ── Hook / looper ─────────────────────────────────────────────── */
const HOOK: DomainMap = {
  rotary:      { icon: "hook-rotary",  description: "Full-rotary hook", visualType: "hook" },
  oscillating: { icon: "hook-osc",     description: "Oscillating shuttle", visualType: "hook" },
  vertical:    { icon: "hook-vert",    description: "Vertical-axis hook", visualType: "hook" },
};

/* ── Plug types — region-labelled socket silhouettes ───────────── */
const PLUG: DomainMap = {
  A: { icon: "plug", badge: "US/JP", description: "Type A — North America / Japan", visualType: "plug" },
  B: { icon: "plug", badge: "US",    description: "Type B — North America (grounded)", visualType: "plug" },
  C: { icon: "plug", badge: "EU",    description: "Type C — Europe (Europlug)", visualType: "plug" },
  D: { icon: "plug", badge: "IN",    description: "Type D — India", visualType: "plug" },
  E: { icon: "plug", badge: "FR",    description: "Type E — France / Belgium", visualType: "plug" },
  F: { icon: "plug", badge: "EU",    description: "Type F — Schuko (Europe)", visualType: "plug" },
  G: { icon: "plug", badge: "UK",    description: "Type G — UK / Ireland", visualType: "plug" },
  H: { icon: "plug", badge: "IL",    description: "Type H — Israel", visualType: "plug" },
  I: { icon: "plug", badge: "AU/CN", description: "Type I — Australia / China", visualType: "plug" },
  J: { icon: "plug", badge: "CH",    description: "Type J — Switzerland", visualType: "plug" },
  K: { icon: "plug", badge: "DK",    description: "Type K — Denmark", visualType: "plug" },
  L: { icon: "plug", badge: "IT",    description: "Type L — Italy", visualType: "plug" },
  M: { icon: "plug", badge: "ZA",    description: "Type M — South Africa", visualType: "plug" },
};

/* ── Material weight class ─────────────────────────────────────── */
const WEIGHT: DomainMap = {
  light:       { icon: "weight-light",  description: "Light fabric (shirting, lining)", visualType: "weight" },
  medium:      { icon: "weight-medium", description: "Medium fabric (general apparel)", visualType: "weight" },
  heavy:       { icon: "weight-heavy",  description: "Heavy fabric (denim, canvas)", visualType: "weight" },
  extra_heavy: { icon: "weight-heavy",  description: "Extra-heavy (webbing, leather)", visualType: "weight" },
};

export const VISUAL_OPTIONS: Record<OptionVisualType, DomainMap> = {
  material: FABRIC,
  application: APPLICATION,
  garment: GARMENT,
  motor: MOTOR,
  feed: FEED,
  hook: HOOK,
  plug: PLUG,
  weight: WEIGHT,
  automation: {},
  generic: {},
};

/* Field-key → visual domain. Reusable config: any sewing schema that uses
   these conventional keys inherits the visuals automatically. A field can
   override by setting `optionSet` directly on the SpecField. */
export const FIELD_VISUAL_DOMAIN: Record<string, OptionVisualType> = {
  suitable_fabrics: "material",
  thread_type_supported: "material",
  industry_applications: "application",
  suitable_garments: "garment",
  motor_type: "motor",
  feed_mechanism: "feed",
  hook_looper_type: "hook",
  plug_types: "plug",
  material_weight: "weight",
};

/* ── Product Intelligence Anchors ──────────────────────────────────
   Collects the fields that deserve hero-level priority into an ordered
   list, regardless of whether they are numeric. A field is an anchor if:
     • field.anchor === true, OR
     • field.importance is "critical" | "high", OR
     • (back-compat) field.visualRenderType === "metric_block".
   A field with anchor === false is always excluded. Booleans only anchor
   when their value is true; everything else needs a non-empty value.

   Each anchor is classified into a render `kind`:
     • "metric"  — a number (+ unit): big figure treatment
     • "boolean" — a true flag: glyph + the field label
     • "badge"   — a selected option: glyph/swatch + the option label
   Ordering: anchorPriority (if set) else an importance weight; metric
   back-compat anchors sit mid-pack. Pure function, reusable by any
   surface (preview, brochure, compare). */
export type AnchorKind = "metric" | "boolean" | "badge";

/* Semantic category of an anchor — lets surfaces cluster / label anchors
   (technical, automation, material, …) without hardcoding field keys.
   Derived from field.anchorGroup, else the group id, else the visual
   domain. Presentational treatment stays driven by `kind`. */
export type AnchorType =
  | "performance"
  | "technical"
  | "automation"
  | "material"
  | "application"
  | "intelligence"
  | "commercial"
  | "generic";

export interface ProductAnchor {
  field: SpecField;
  kind: AnchorKind;
  type: AnchorType;
  priority: number;
}

export interface CollectAnchorsOptions {
  limit?: number;
  /** Map a field key to its group id (enables type + quiet-group guard). */
  groupOf?: (fieldKey: string) => string | undefined;
  /** True when the field's group is low-emphasis (compliance/fulfillment/…).
      Quiet-group fields never anchor UNLESS field.anchor === true. */
  isQuietGroup?: (fieldKey: string) => boolean;
}

function anchorTypeOf(field: SpecField, groupId: string | undefined): AnchorType {
  const g = (field.anchorGroup ?? groupId ?? "").toLowerCase();
  if (g.includes("automation")) return "automation";
  if (g.includes("material")) return "material";
  if (g.includes("application")) return "application";
  if (g.includes("performance")) return "performance";
  if (g.includes("intelligence") || g.includes("smart") || g.includes("ai")) return "intelligence";
  if (g.includes("commercial") || g.includes("series")) return "commercial";
  const dom = domainForField(field);
  if (dom === "material" || dom === "weight") return "material";
  if (dom === "application" || dom === "garment") return "application";
  if (dom === "motor" || dom === "feed" || dom === "hook" || dom === "plug") return "technical";
  return "generic";
}

function importanceWeight(field: SpecField): number {
  switch (field.importance) {
    case "critical": return 0;
    case "high": return 10;
    case "normal": return 50;
    case "quiet": return 90;
    default: return field.visualRenderType === "metric_block" ? 40 : 60;
  }
}

function isAnchorValueFilled(field: SpecField, raw: unknown): boolean {
  if (field.fieldType === "boolean") return raw === true;
  if (raw === null || raw === undefined) return false;
  if (typeof raw === "string") return raw.trim() !== "";
  if (Array.isArray(raw)) return raw.length > 0;
  return true;
}

function anchorKindOf(field: SpecField): AnchorKind {
  if (field.fieldType === "boolean") return "boolean";
  if (
    field.fieldType === "number" ||
    field.fieldType === "unit_number" ||
    field.visualRenderType === "metric_block"
  )
    return "metric";
  return "badge";
}

export function collectAnchors(
  fields: SpecField[],
  values: Record<string, unknown>,
  opts: CollectAnchorsOptions = {},
): ProductAnchor[] {
  const { limit = 8, groupOf, isQuietGroup } = opts;
  const out: ProductAnchor[] = [];
  for (const field of fields) {
    if (field.anchor === false) continue;
    const explicit = field.anchor === true;
    const qualifies =
      explicit ||
      field.importance === "critical" ||
      field.importance === "high" ||
      field.visualRenderType === "metric_block";
    if (!qualifies) continue;
    // Quiet groups (compliance / customs / fulfillment / …) never auto-anchor;
    // only an explicit anchor:true can elevate a field from a quiet group.
    if (!explicit && isQuietGroup?.(field.key)) continue;
    if (!isAnchorValueFilled(field, values[field.key])) continue;
    out.push({
      field,
      kind: anchorKindOf(field),
      type: anchorTypeOf(field, groupOf?.(field.key)),
      priority: field.anchorPriority ?? importanceWeight(field),
    });
  }
  out.sort((a, b) => a.priority - b.priority || (a.field.order ?? 0) - (b.field.order ?? 0));
  return out.slice(0, limit);
}

/* ── Spec-group emphasis ───────────────────────────────────────────
   Not all groups deserve equal visual weight. Selling-relevant groups
   (performance, automation, materials, applications, mechanical) get a
   prominent treatment; commodity/compliance groups (electrical, physical,
   compliance, customs, purchase, fulfillment) recede into a quiet
   key-value list. Keyed by the conventional group id so any schema
   reusing these ids inherits the tiering. Default is 'standard'. */
export type GroupEmphasis = "primary" | "standard" | "quiet";

export const GROUP_EMPHASIS: Record<string, GroupEmphasis> = {
  performance: "primary",
  automation: "primary",
  material: "primary",
  application: "primary",
  "needle-thread": "standard",
  mechanical: "standard",
  "lockstitch-config": "standard",
  "stitch-feed": "standard",
  electrical: "quiet",
  physical: "quiet",
  compliance: "quiet",
  customs: "quiet",
  "purchase-options": "quiet",
  fulfillment: "quiet",
};

export function emphasisForGroup(groupId: string): GroupEmphasis {
  return GROUP_EMPHASIS[groupId] ?? "standard";
}

/* Resolve the visual domain for a field. */
export function domainForField(field: Pick<SpecField, "key" | "optionSet">): OptionVisualType | null {
  if (field.optionSet) return field.optionSet;
  return FIELD_VISUAL_DOMAIN[field.key] ?? null;
}

/* Resolve the visual for one option value of a field. Inline option
   overrides win; otherwise the registry entry for the field's domain. */
export function resolveOptionVisual(
  field: Pick<SpecField, "key" | "optionSet">,
  option: SpecFieldOption | undefined,
  value: string,
): OptionVisual {
  const inline: OptionVisual = {};
  if (option?.swatch) inline.swatch = option.swatch;
  if (option?.icon) inline.icon = option.icon;
  if (option?.description) inline.description = option.description;
  if (option?.badge) inline.badge = option.badge;
  if (option?.visualType) inline.visualType = option.visualType;

  const domain = domainForField(field);
  const base = domain ? (VISUAL_OPTIONS[domain]?.[value] ?? {}) : {};

  // inline overrides take precedence over the registry base
  return { ...base, ...inline };
}

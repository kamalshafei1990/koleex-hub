import type {
  SpecField,
  VisibilityFlags,
  ProductKnowledgeBlock,
  ProductSchemaSurface,
} from "@/types/product-schema";

/**
 * Default visibility for public-facing, non-sensitive fields.
 * Shown on the website, in quotes, and in brochures, but NOT on invoices.
 * AI-readable so the assistant can reference it.
 */
export const DEFAULT_PUBLIC_VISIBILITY: VisibilityFlags = {
  internalOnly: false,
  publicVisible: true,
  websiteVisible: true,
  quoteVisible: true,
  invoiceVisible: false,
  brochureVisible: true,
  aiReadable: true,
  comparable: false,
  filterVisible: false,
  searchable: false,
  translatable: false,
};

/**
 * Default visibility for internal-only fields (cost, margin, supplier notes, etc.).
 * Never leaves the admin surface.
 */
export const DEFAULT_INTERNAL_VISIBILITY: VisibilityFlags = {
  internalOnly: true,
  publicVisible: false,
  websiteVisible: false,
  quoteVisible: false,
  invoiceVisible: false,
  brochureVisible: false,
  aiReadable: false,
  comparable: false,
  filterVisible: false,
  searchable: false,
  translatable: false,
};

/**
 * Default visibility for commercial fields (price, SKU, lead time).
 * Visible everywhere a customer transacts: website, quote, invoice, brochure.
 */
export const DEFAULT_COMMERCIAL_VISIBILITY: VisibilityFlags = {
  internalOnly: false,
  publicVisible: true,
  websiteVisible: true,
  quoteVisible: true,
  invoiceVisible: true,
  brochureVisible: true,
  aiReadable: true,
  comparable: false,
  filterVisible: false,
  searchable: false,
  translatable: false,
};

/**
 * Default visibility for technical specs (dimensions, materials, performance).
 * Visible on website + brochure, comparable across products, but not on quotes/invoices.
 */
export const DEFAULT_TECHNICAL_VISIBILITY: VisibilityFlags = {
  internalOnly: false,
  publicVisible: true,
  websiteVisible: true,
  quoteVisible: false,
  invoiceVisible: false,
  brochureVisible: true,
  aiReadable: true,
  comparable: true,
  filterVisible: false,
  searchable: false,
  translatable: false,
};

/**
 * Maps a product schema surface to the corresponding visibility flag key.
 * The `internal` surface is handled specially in `isVisibleIn` and intentionally
 * maps to `internalOnly`.
 */
export const SURFACE_TO_FLAG: Record<ProductSchemaSurface, keyof VisibilityFlags> = {
  internal: "internalOnly",
  public: "publicVisible",
  website: "websiteVisible",
  quote: "quoteVisible",
  invoice: "invoiceVisible",
  brochure: "brochureVisible",
  ai: "aiReadable",
  comparison: "comparable",
  filters: "filterVisible",
};

/**
 * Determines whether a target (field or knowledge block visibility) should be
 * shown on a given surface.
 *
 * - For the `internal` surface (admin view), admins see everything: any target
 *   that is either marked internal-only OR has at least one visibility flag
 *   enabled is shown.
 * - For all other surfaces, internal-only targets are hidden, and visibility
 *   is determined by the corresponding flag.
 */
export function isVisibleIn(
  target: VisibilityFlags,
  surface: ProductSchemaSurface,
): boolean {
  if (surface === "internal") {
    if (target.internalOnly) return true;
    return (
      target.publicVisible ||
      target.websiteVisible ||
      target.quoteVisible ||
      target.invoiceVisible ||
      target.brochureVisible ||
      target.aiReadable ||
      target.comparable ||
      target.filterVisible ||
      target.searchable ||
      target.translatable
    );
  }

  if (target.internalOnly) return false;
  return Boolean(target[SURFACE_TO_FLAG[surface]]);
}

/**
 * Filters a list of spec fields down to those visible on the given surface.
 */
export function filterFieldsForSurface(
  fields: SpecField[],
  surface: ProductSchemaSurface,
): SpecField[] {
  /* SpecField extends VisibilityFlags directly — the flags ARE on the field,
     not behind a `.visibility` property. (Knowledge blocks DO use
     `.visibility` because they're separate concerns.) */
  return fields.filter((field) => isVisibleIn(field, surface));
}

/**
 * Filters a list of knowledge blocks down to those visible on the given surface.
 * Note: visibility lives on `block.visibility`, not on the block itself.
 */
export function filterKnowledgeForSurface(
  blocks: ProductKnowledgeBlock[],
  surface: ProductSchemaSurface,
): ProductKnowledgeBlock[] {
  return blocks.filter((block) => isVisibleIn(block.visibility, surface));
}

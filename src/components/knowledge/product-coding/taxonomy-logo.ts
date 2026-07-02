/* ---------------------------------------------------------------------------
   taxonomy-logo — single helper that builds a public Supabase Storage
   URL for division / category / subcategory logos.

   The icons themselves live in the `media` bucket under
   divisions/, categories/, subcategories/ folders — exactly the same
   storage the Product Data UI reads via fetchTaxonomyLogos(). Same
   pictures, same source, same canonical assets.

   We build the URL directly from the slug instead of listing the
   bucket at runtime (Product Data does list because it needs to
   discover new uploads). Listing is overkill for a knowledge page
   with a known taxonomy.
   --------------------------------------------------------------------------- */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";

export type TaxonomyFolder =
  | "divisions"
  | "categories"
  | "subcategories"
  | "machines";

/**
 * Returns the public URL for a taxonomy / machine asset, or null when
 * the NEXT_PUBLIC_SUPABASE_URL env var is missing (e.g. local dev
 * without .env set — the caller should fall back to text in that case).
 */
export function taxonomyLogoUrl(
  folder: TaxonomyFolder,
  slug: string,
  ext: "svg" | "png" = "svg",
): string | null {
  if (!SUPABASE_URL || !slug) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${folder}/${encodeURIComponent(slug)}.${ext}`;
}

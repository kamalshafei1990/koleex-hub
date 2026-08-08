import "server-only";

/* ---------------------------------------------------------------------------
   product-search-reach — give the server-side product search the same REACH
   the browser search has today.

   The catalogue's client search does not only look at the products row. Its
   haystack also carries model codes, the Koleex SKU, supplier names, the
   models' i18n names (this is where the Chinese product names actually live —
   NOT in products.alternate_names, which is empty on all 121 rows), and the
   division / category / subcategory names in all three languages.

   None of that is reachable with an ilike over the products table, so moving
   the list to the server would have quietly broken searching by model code or
   by supplier — a trade that is not worth any amount of speed.

   It does NOT need a schema change, which is what it first looked like. Every
   one of those values already lives in a table we can ask directly: two small
   lookups resolve the query to a set of product ids and taxonomy slugs, and
   the main list query ORs those in beside its own columns.

   Cost: two indexed lookups over small tables (168 models, 451 taxonomy rows),
   and they run in parallel with each other. Measured in-function database time
   for three taxonomy tables was 56 ms, so this is not where the time goes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

/* A query matching more products-by-model than this stops being a search and
   starts being a browse — and the id list would bloat the PostgREST URL. The
   product's OWN columns still match independently past the cap, so results
   degrade rather than disappear. Logged, never silent. */
const MAX_IDS = 500;

/** PostgREST `in.()` needs its values double-quoted so a comma or parenthesis
 *  inside one can't break out of the list. */
function inList(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;
}

export interface SearchReach {
  /** or-terms to hand to applyServerList. Empty when nothing matched. */
  terms: string[];
  /** True when the model-id list hit MAX_IDS and results are approximate. */
  capped: boolean;
}

/**
 * Resolve `q` against the tables the products row cannot see, and return
 * or-terms for the main list query.
 */
export async function resolveProductSearchReach(q: string, tenantId: string): Promise<SearchReach> {
  const like = `%${q}%`;
  const terms: string[] = [];
  let capped = false;

  const [models, modelsI18n, divisions, categories, subcategories] = await Promise.all([
    /* Model code (model_name), Koleex SKU, model slug, supplier name. */
    supabaseServer
      .from("product_models")
      .select("product_id")
      .or(
        [
          `model_name.ilike.${like}`,
          `sku.ilike.${like}`,
          `slug.ilike.${like}`,
          `supplier.ilike.${like}`,
        ].join(","),
      )
      .limit(MAX_IDS + 1),
    /* The models' Chinese / other-language names, in a query of their OWN.
       name_i18n is jsonb, Postgres has no `jsonb ILIKE text`, and PostgREST's
       logic-tree parser rejects a `::text` cast INSIDE an or() — put one there
       and the whole or-expression fails to parse, so the lookup returns
       nothing and the search quietly loses model codes and supplier names
       rather than erroring. That happened here twice before this split: a real
       SKU returned 0 hits while the row plainly existed. A cast is legal on a
       standalone filter, so this term gets its own request. */
    supabaseServer
      .from("product_models")
      .select("product_id")
      .filter("name_i18n::text", "ilike", like)
      .limit(MAX_IDS + 1),
    supabaseServer.from("divisions").select("slug").or(taxonomyOr(like)),
    supabaseServer.from("categories").select("slug").or(taxonomyOr(like)),
    supabaseServer.from("subcategories").select("slug").or(taxonomyOr(like)),
  ]);

  /* A failed lookup must be LOUD. Silently returning no terms degrades the
     search back to products-only columns, which looks like "the search just
     doesn't find model codes" — the exact failure this module exists to
     prevent, and the one the jsonb cast above already caused once. */
  for (const [name, res] of [
    ["product_models", models], ["product_models.name_i18n", modelsI18n],
    ["divisions", divisions], ["categories", categories], ["subcategories", subcategories],
  ] as const) {
    if (res.error) console.error(`[product-search] ${name} lookup failed:`, res.error.message);
  }

  const modelRows = [
    ...((models.data ?? []) as { product_id: string | null }[]),
    ...((modelsI18n.data ?? []) as { product_id: string | null }[]),
  ];
  const modelIds = Array.from(
    new Set(modelRows.map((r) => r.product_id).filter(Boolean) as string[]),
  );
  if (modelIds.length > MAX_IDS) {
    capped = true;
    modelIds.length = MAX_IDS;
    console.warn(`[product-search] "${q}" matched more than ${MAX_IDS} products by model — id list capped`);
  }
  if (modelIds.length) terms.push(`id.in.${inList(modelIds)}`);

  const slugTerm = (rows: { slug: string | null }[] | null, column: string) => {
    const slugs = (rows ?? []).map((r) => r.slug).filter(Boolean) as string[];
    if (slugs.length) terms.push(`${column}.in.${inList(slugs)}`);
  };
  slugTerm(divisions.data as { slug: string | null }[] | null, "division_slug");
  slugTerm(categories.data as { slug: string | null }[] | null, "category_slug");
  slugTerm(subcategories.data as { slug: string | null }[] | null, "subcategory_slug");

  /* tenantId is not used to filter the lookups: product_models and the
     taxonomy are not tenant-scoped, and the MAIN query is already scoped to
     the caller's tenant — so a model id from elsewhere simply matches nothing.
     Kept in the signature so a future tenant-scoped models table has an
     obvious place to use it. */
  void tenantId;

  return { terms, capped };
}

/** Taxonomy rows are searched by their name in every language the Hub shows,
 *  so typing a Chinese or Arabic category name finds its products. */
function taxonomyOr(like: string): string {
  return [`name.ilike.${like}`, `name_zh.ilike.${like}`, `name_ar.ilike.${like}`, `slug.ilike.${like}`].join(",");
}

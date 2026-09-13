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

   Still true after the `products.search_text` migration. That generated column
   flattens the PRODUCTS ROW — including the `tags` and `alternate_names`
   arrays, which ilike could never reach — but model codes, SKUs, supplier
   names and taxonomy names live in OTHER tables, so they still come from here.

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

  const [models, divisions, categories, subcategories, suppliers, supplierWords, translations] = await Promise.all([
    /* Model code, primary model, Koleex SKU, slug AND the models' Chinese /
       other-language names — all of it in ONE indexed column that the database
       maintains (migration `product_models_search_text_generated_column`).

       This replaced two queries and a live defect. name_i18n is jsonb, and the
       previous `.filter("name_i18n::text", "ilike", …)` was not applying the
       cast: every search logged `operator does not exist: jsonb ~~* unknown`
       and silently returned nothing, so 45 models with Chinese names — 14 of
       them matching 蒸汽 — could not be found in Chinese at all. Casting once
       at write time puts it somewhere PostgREST never has to parse. */
    supabaseServer
      .from("product_models")
      .select("product_id")
      .ilike("search_text", like)
      .limit(MAX_IDS + 1),
    supabaseServer.from("divisions").select("slug").or(taxonomyOr(like)),
    supabaseServer.from("categories").select("slug").or(taxonomyOr(like)),
    supabaseServer.from("subcategories").select("slug").or(taxonomyOr(like)),
    /* THE SUPPLIER, from where the supplier actually is.
       `product_models.supplier` is a legacy text column and it is NULL on all
       168 rows — so the supplier term above has never matched anything, and
       searching the catalogue by supplier name silently returned zero. The
       real link is product_suppliers.supplier_id -> contacts. Verified: the
       supplier linked to all 121 products returned 0 hits before this. */
    supabaseServer
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("contact_type", "supplier")
      .or([`display_name.ilike.${like}`, `company_name.ilike.${like}`, `legal_name.ilike.${like}`].join(","))
      .limit(MAX_IDS),
    /* THE SUPPLIER TAB'S OWN WORDS (owner request 2026-08-29): the supplier's
       model code, their product name and its translations, the price notes,
       and the price-ladder notes — one generated column, one trigram index
       (migration supplier_translations_search_text). Typing "Raised Height"
       or the supplier's A7 code now finds the product. */
    supabaseServer
      .from("product_suppliers")
      .select("product_id")
      .ilike("search_text", like)
      .limit(MAX_IDS + 1),
    /* THE HERO TAB'S TRANSLATED WORDS: per-locale product name, tagline,
       excerpt and description live in product_translations — this is where
       the Chinese/Arabic product names actually are. Same migration. */
    supabaseServer
      .from("product_translations")
      .select("product_id")
      .ilike("search_text", like)
      .limit(MAX_IDS + 1),
  ]);

  /* One dependent hop, and only when a supplier name actually matched — a
     search for "ironing" pays nothing for it. */
  const supplierIds = ((suppliers.data ?? []) as { id: string }[]).map((r) => r.id);
  const supplierLinks = supplierIds.length
    ? await supabaseServer
        .from("product_suppliers")
        .select("product_id")
        .in("supplier_id", supplierIds)
        .limit(MAX_IDS + 1)
    : null;

  /* A failed lookup must be LOUD. Silently returning no terms degrades the
     search back to products-only columns, which looks like "the search just
     doesn't find model codes" — the exact failure this module exists to
     prevent, and the one the jsonb cast above already caused once. */
  for (const [name, res] of [
    ["product_models", models],
    ["divisions", divisions], ["categories", categories], ["subcategories", subcategories],
    ["contacts(supplier)", suppliers], ["product_suppliers", supplierLinks],
    ["product_suppliers(words)", supplierWords], ["product_translations", translations],
  ] as const) {
    if (res?.error) console.error(`[product-search] ${name} lookup failed:`, res.error.message);
  }

  const modelRows = [
    ...((models.data ?? []) as { product_id: string | null }[]),
    ...((supplierLinks?.data ?? []) as { product_id: string | null }[]),
    ...((supplierWords.data ?? []) as { product_id: string | null }[]),
    ...((translations.data ?? []) as { product_id: string | null }[]),
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

  /* product_models and the taxonomy are not tenant-scoped, and the MAIN query
     is already scoped to the caller's tenant, so a model id from elsewhere
     simply matches nothing. The CONTACTS lookup above is scoped explicitly —
     contacts are tenant data, and resolving a supplier name across tenants
     would leak the existence of another tenant's supplier through a hit count. */

  return { terms, capped };
}

/** Taxonomy rows are searched by their name in every language the Hub shows,
 *  so typing a Chinese or Arabic category name finds its products. */
function taxonomyOr(like: string): string {
  return [`name.ilike.${like}`, `name_zh.ilike.${like}`, `name_ar.ilike.${like}`, `slug.ilike.${like}`].join(",");
}

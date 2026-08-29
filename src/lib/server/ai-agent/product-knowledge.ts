import "server-only";

/* ---------------------------------------------------------------------------
   product-knowledge — WHAT Koleex AI is allowed to know about a product,
   organised the way the operator thinks about it: by Product Data tab.

   Owner classification (2026-08-29), given tab by tab:

     Classify              A — public: anyone, including anonymous visitors
     Supplier              I — internal only, AND subject to cost permission
     Hero                  B — internal + signed-in customers
     Highlights            B
     Specs                 B
     Variants              B
     Price                 I — internal only, subject to cost permission
     Options               B
     Packing & Logistics   B

   THREE AUDIENCES, not two. "public" is the anonymous catalogue reader,
   "customer" is a signed-in customer account, "internal" is a Koleex
   employee account. Koleex AI is currently gated to internal accounts
   (requireInternalUser), so today only the internal path can ever run —
   the classification is encoded now so that opening the customer portal
   later is a configuration change here, not a hunt through query code.

   WHY A TAB MAP AND NOT ad-hoc checks: the same fact (a model's cost) lives
   in several tables, and every place that forgets a check is a leak. One
   map, one assembly function, one place to audit.

   FRESHNESS: everything below is read LIVE from Postgres on each call. There
   is no embedding, index or snapshot, so an edit saved in Product Data is
   visible to the very next question — that is a property of this design and
   must survive any future caching work (cache the SHAPE, never the values).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";
import type { ServerAuthContext } from "../auth";

export type Audience = "public" | "customer" | "internal";

/** The owner's A / I / B, expressed as the audiences each tab may reach. */
export const TAB_AUDIENCE: Record<string, Audience[]> = {
  classify: ["public", "customer", "internal"],            // A
  supplier: ["internal"],                                   // I (+ cost permission)
  hero: ["customer", "internal"],                           // B
  highlights: ["customer", "internal"],                     // B
  specs: ["customer", "internal"],                          // B
  variants: ["customer", "internal"],                       // B
  price: ["internal"],                                      // I (+ cost permission)
  options: ["customer", "internal"],                        // B
  packing: ["customer", "internal"],                        // B
};

export function audienceOf(auth: ServerAuthContext): Audience {
  return auth.user_type === "internal" ? "internal" : "customer";
}

export function tabAllowed(tab: string, who: Audience): boolean {
  return (TAB_AUDIENCE[tab] ?? ["internal"]).includes(who);
}

/* Columns that carry a MODEL's commercial secrets. Superset of the legacy
   SECRET_MODEL_FIELDS: the cost provenance columns (who set it, from where,
   when) are as internal as the number itself — knowing "cost set by X from
   supplier quote" tells a customer everything but the digits. */
export const MODEL_INTERNAL_FIELDS = [
  "cost_price", "supplier", "moq",
  "cost_source", "cost_updated_at", "cost_updated_by", "cost_updated_by_name",
  "supplier_overrides", "reference_model",
] as const;

/* ── Tab readers ─────────────────────────────────────────────────────────
   Each returns the tab's OWN content. They never decide who may see it —
   that is buildProductKnowledge's job, so the rule lives in one place. */

async function readTranslations(productId: string) {
  const { data } = await supabaseServer
    .from("product_translations")
    .select("locale, product_name, tagline, excerpt, description")
    .eq("product_id", productId);
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function readOptions(productId: string) {
  const { data: groups } = await supabaseServer
    .from("product_options")
    .select("id, title, title_i18n, kind, required, sort_order, active")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  const list = (groups ?? []) as Array<Record<string, unknown>>;
  if (list.length === 0) return [];
  const { data: values } = await supabaseServer
    .from("product_option_values")
    .select("option_id, label, label_i18n, price_delta_cny, weight_delta_kg, cbm_delta, is_default, sort_order, active, linked_product_id, linked_model_id")
    .in("option_id", list.map((g) => g.id as string))
    .order("sort_order", { ascending: true });
  const byGroup = new Map<string, Array<Record<string, unknown>>>();
  for (const v of (values ?? []) as Array<Record<string, unknown>>) {
    const k = String(v.option_id);
    const arr = byGroup.get(k) ?? [];
    arr.push(v);
    byGroup.set(k, arr);
  }
  return list.map((g) => ({ ...g, values: byGroup.get(String(g.id)) ?? [] }));
}

/* Specs live in two places on the products row: `schema_specs` (the
   subcategory schema's answers, the modern path) and `specs` (the older
   free-form map). Both are returned — an operator asking "what are its
   specs" means whichever one was filled. */
function readSpecs(product: Record<string, unknown>) {
  const schema = (product.schema_specs ?? {}) as Record<string, unknown>;
  const legacy = (product.specs ?? {}) as Record<string, unknown>;
  return {
    schema_id: product.schema_id ?? null,
    schema_version: product.schema_version ?? null,
    schema_specs: schema,
    legacy_specs: legacy,
    filled_count: Object.keys(schema).length + Object.keys(legacy).length,
  };
}

const PACKING_PRODUCT_FIELDS = [
  "hs_code", "country_of_origin", "machine_weight_kg",
  "cbm", "carton_dimensions", "packing_type",
] as const;

const PACKING_MODEL_FIELDS = [
  "model_name", "primary_model", "weight", "cbm", "packing_type",
  "box_include", "extra_accessories", "barcode",
] as const;

function pick(row: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in row) out[k] = row[k];
  return out;
}

export function stripInternalModelFields(model: Record<string, unknown>) {
  const clean = { ...model };
  for (const k of MODEL_INTERNAL_FIELDS) delete clean[k];
  return clean;
}

/**
 * Assemble the tabs the caller's audience is allowed to know, live.
 *
 * `costOk` is the Product Data cost permission (roles & permissions), which
 * gates the two internal tabs on top of the audience test — an internal user
 * without it gets everything EXCEPT Supplier and Price, and is told so.
 */
export async function buildProductTabs(opts: {
  productId: string;
  product: Record<string, unknown>;
  models: Array<Record<string, unknown>>;
  who: Audience;
  costOk: boolean;
}): Promise<{ tabs: Record<string, unknown>; withheld: string[] }> {
  const { productId, product, models, who, costOk } = opts;
  const withheld: string[] = [];
  const tabs: Record<string, unknown> = {};

  /* Reads that are worth doing only if the audience may see the result. */
  const wantsHero = tabAllowed("hero", who);
  const wantsOptions = tabAllowed("options", who);
  const [translations, options] = await Promise.all([
    wantsHero ? readTranslations(productId) : Promise.resolve([]),
    wantsOptions ? readOptions(productId) : Promise.resolve([]),
  ]);

  /* Classify — A. */
  if (tabAllowed("classify", who)) {
    tabs.classify = pick(product, [
      "division_slug", "category_slug", "subcategory_slug", "family", "level", "brand",
    ]);
  }

  /* Hero — B. Name/tagline/excerpt/description + every translated copy,
     which is where the Chinese and Arabic product names actually live. */
  if (wantsHero) {
    tabs.hero = {
      ...pick(product, ["product_name", "slug", "tagline", "excerpt", "description"]),
      translations,
    };
  } else withheld.push("hero");

  /* Specs — B. */
  if (tabAllowed("specs", who)) tabs.specs = readSpecs(product);
  else withheld.push("specs");

  /* Variants — B, with the model's commercial columns removed unless the
     account holds cost permission. The tab is customer-visible; the cost
     columns that physically live in that table are not. */
  if (tabAllowed("variants", who)) {
    tabs.variants = models.map((m) => (costOk && who === "internal" ? m : stripInternalModelFields(m)));
  } else withheld.push("variants");

  /* Options — B. Deltas are COST deltas in CNY; a customer-facing answer
     must speak in the SELLING delta the pricing engine derives, never in
     these numbers. */
  if (wantsOptions) tabs.options = options;
  else withheld.push("options");

  /* Packing & Logistics — B, from the product row plus each model's own
     packing figures (they differ per variant). */
  if (tabAllowed("packing", who)) {
    tabs.packing = {
      product: pick(product, PACKING_PRODUCT_FIELDS),
      per_model: models.map((m) => pick(m, PACKING_MODEL_FIELDS)),
    };
  } else withheld.push("packing");

  /* Supplier / Price — I, and only with the cost permission. The caller
     supplies the actual supplier payload; this function records the
     decision so one place explains every omission. */
  if (!tabAllowed("supplier", who) || !costOk) withheld.push("supplier");
  if (!tabAllowed("price", who) || !costOk) withheld.push("price");

  return { tabs, withheld };
}

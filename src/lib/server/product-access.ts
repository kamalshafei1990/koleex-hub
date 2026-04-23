import "server-only";

/* ---------------------------------------------------------------------------
   product-access — shared helpers for every /api/products* route.

   Single place that defines:
     · Which columns are safe to send to a customer (PUBLIC_PRODUCT_COLUMNS
       / PUBLIC_MODEL_COLUMNS).
     · Which columns are internal (SECRET_PRODUCT_FIELDS /
       SECRET_MODEL_FIELDS) — used when we need to strip fields from an
       already-fetched row instead of re-projecting at the DB layer.
     · A cheap boolean `hasProductDataAccess(auth)` check so each route
       can decide whether to fetch the full shape or the stripped one.

   Why a dedicated file: scattering this across three routes would let
   one forget to hide a field. One source of truth, one bug surface.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";
import type { ServerAuthContext } from "./auth";

/** Columns safe to return on /products (public catalog). Anything NOT
 *  in this list becomes admin-only. Order doesn't matter; the list is
 *  joined into a PostgREST select string. */
export const PUBLIC_PRODUCT_COLUMNS = [
  "id",
  "product_name",
  "slug",
  "division_slug",
  "category_slug",
  "subcategory_slug",
  "brand",
  "family",
  "level",
  "tags",
  "description",
  "specs",
  "voltage",
  "plug_types",
  "watt",
  "colors",
  "supports_head_only",
  "supports_complete_set",
  "warranty",
  "visible",
  "featured",
  "status",
  "country_of_origin",
  "lead_time",          // customer-friendly — delivery expectation
  "created_at",
  "updated_at",
].join(", ");

/** Fields on the products table that are internal-only. Used for
 *  stripping when a row was fetched with `*` (e.g. joined query) and
 *  needs to be sanitised after the fact. Keep in sync with
 *  PUBLIC_PRODUCT_COLUMNS — anything here must NOT appear above. */
export const SECRET_PRODUCT_FIELDS: readonly string[] = [
  "hs_code",          // customs classification — not for public
  "moq",              // minimum order qty — supplier term
];

/** Columns safe to return on /product-models (public catalog). */
export const PUBLIC_MODEL_COLUMNS = [
  "id",
  "product_id",
  "model_name",
  "slug",
  "sku",
  "tagline",
  "global_price",
  "head_only_price",
  "complete_set_price",
  "supports_head_only",
  "supports_complete_set",
  "weight",
  "cbm",
  "packing_type",
  "box_include",
  "extra_accessories",
  "order",
  "visible",
  "status",
  "lead_time",
  "barcode",
  "reference_model",
  "created_at",
  "updated_at",
].join(", ");

/** Fields on product_models that are internal-only. */
export const SECRET_MODEL_FIELDS: readonly string[] = [
  "cost_price",   // purchase price from supplier
  "supplier",     // supplier name on the model row itself
  "moq",          // supplier minimum order qty
];

/** Strip a list of keys from any row/object. Safe on null. */
export function stripSecrets<T extends Record<string, unknown>>(
  row: T | null,
  secretFields: readonly string[],
): T | null {
  if (!row) return row;
  const clone = { ...row } as Record<string, unknown>;
  for (const k of secretFields) delete clone[k];
  return clone as T;
}

/** Does the caller see internal product data?
 *  - Super admin → always yes
 *  - Role with "Product Data" can_view = true → yes
 *  - Account with a can_view=true override on "Product Data" → yes
 *  - Everything else → no (customers, minimal internal roles, etc.)
 */
export async function hasProductDataAccess(auth: ServerAuthContext): Promise<boolean> {
  if (auth.is_super_admin) return true;
  if (!auth.role_id) return false;

  const [rolePerm, override] = await Promise.all([
    supabaseServer
      .from("koleex_permissions")
      .select("can_view")
      .eq("role_id", auth.role_id)
      .ilike("module_name", "Product Data")
      .maybeSingle(),
    supabaseServer
      .from("account_permission_overrides")
      .select("can_view")
      .eq("account_id", auth.account_id)
      .ilike("module_key", "Product Data")
      .maybeSingle(),
  ]);

  /* Override takes precedence (can both allow when role denies AND
     deny when role allows). This matches requireModuleAccess's
     semantics exactly — same gate, different return shape. */
  if (override.data !== null) return override.data?.can_view === true;
  return rolePerm.data?.can_view === true;
}

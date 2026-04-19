import "server-only";

/* ---------------------------------------------------------------------------
   Product tools — agent-facing read operations on the products catalog.

   Koleex products are a shared catalog (no tenant_id on the products
   table), but cost_price / supplier_price / margin ARE sensitive fields
   and only users with can_view_private see them.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { filterFieldsMany } from "../permissions";

const PRODUCT_MODULE = "Products";

/* Columns we select. Sensitive cost-side fields (cost_price,
   supplier_price, landed_cost, margin, internal_notes) live on other
   tables (product_suppliers, landed_cost_calculations, etc.) — they're
   NOT on the products row, so SELECTing them would error. We expose
   the neutral catalog fields here and keep cost joins as future tools. */
const PRODUCT_SELECT = `id, product_name, slug, brand, division_slug,
  category_slug, subcategory_slug, family, level, description, hs_code,
  voltage, plug_types, watt, colors, warranty, moq, lead_time,
  country_of_origin, status, visible, featured, updated_at`;

const searchProducts: ToolDef<
  { query?: string; limit?: number },
  { total: number; products: Array<Record<string, unknown>> }
> = {
  name: "searchProducts",
  description: "Search catalog by name/slug/brand/family. Empty query = recent products + total count.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search text. Optional." },
      limit: { type: "integer", description: "Max rows. Default 6, cap 20." },
    },
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<{ total: number; products: Array<Record<string, unknown>> }>> => {
    const q = String(args.query ?? "").trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 20);

    /* Total visible products — independent of the search term so the
       AI can answer "how many products do we have?" even if the user
       phrases it as a search. */
    const totalRes = await supabaseServer
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("visible", true);
    const total = totalRes.count ?? 0;

    let rowsQuery = supabaseServer
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("visible", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q) {
      /* PostgREST `.or()` uses commas + parens as structural syntax —
         raw user input has to be sanitised before embedding or Supabase
         builds an invalid URL and throws "string did not match pattern". */
      const safeQ = sanitizePostgrestLike(q);
      rowsQuery = rowsQuery.or(
        `product_name.ilike.%${safeQ}%,slug.ilike.%${safeQ}%,brand.ilike.%${safeQ}%,family.ilike.%${safeQ}%,description.ilike.%${safeQ}%`,
      );
    }

    const { data, error } = await rowsQuery;
    if (error) {
      console.error("[tool.searchProducts]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't search products right now.",
      };
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const { filtered, stripped } = filterFieldsMany(ctx, "products", rows);

    return {
      ok: true,
      permissionStatus: stripped.length > 0 ? "limited" : "allowed",
      data: {
        total,
        products: filtered as Array<Record<string, unknown>>,
      },
      message: q
        ? `Found ${filtered.length} of ${total} visible products matching "${q}".`
        : `Showing ${filtered.length} most recent of ${total} visible products.`,
      sources: ["products(catalog)"],
      filteredFields: stripped,
    };
  },
};

const countProducts: ToolDef<
  { brand?: string; family?: string },
  { total: number; brand?: string; family?: string }
> = {
  name: "countProducts",
  description: "Count visible products in the catalog. Optional filters: brand, family.",
  parameters: {
    type: "object",
    properties: {
      brand: { type: "string", description: "Optional brand filter." },
      family: { type: "string", description: "Optional family filter." },
    },
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (_ctx, args): Promise<ToolResult<{ total: number; brand?: string; family?: string }>> => {
    let query = supabaseServer
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("visible", true);
    const brand = (args.brand as string | undefined)?.trim();
    const family = (args.family as string | undefined)?.trim();
    if (brand) query = query.ilike("brand", sanitizePostgrestLike(brand));
    if (family) query = query.ilike("family", sanitizePostgrestLike(family));
    const { count, error } = await query;
    if (error) {
      console.error("[tool.countProducts]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't count products right now.",
      };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total: count ?? 0, brand, family },
      message: `${count ?? 0} visible product(s)${brand ? ` (brand: ${brand})` : ""}${family ? ` (family: ${family})` : ""}.`,
      sources: ["products(count)"],
    };
  },
};

const getCatalogStats: ToolDef<
  Record<string, never>,
  { total_products: number; brands: Array<{ brand: string; count: number }>; families: Array<{ family: string; count: number }> }
> = {
  name: "getCatalogStats",
  description: "Catalog overview: total products + breakdown by brand and family.",
  parameters: { type: "object", properties: {} },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (): Promise<ToolResult<{ total_products: number; brands: Array<{ brand: string; count: number }>; families: Array<{ family: string; count: number }> }>> => {
    const { data, error } = await supabaseServer
      .from("products")
      .select("brand, family")
      .eq("visible", true);
    if (error || !data) {
      console.error("[tool.getCatalogStats]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't load catalog stats.",
      };
    }
    const brands = new Map<string, number>();
    const families = new Map<string, number>();
    for (const row of data) {
      if (row.brand) brands.set(row.brand, (brands.get(row.brand) ?? 0) + 1);
      if (row.family) families.set(row.family, (families.get(row.family) ?? 0) + 1);
    }
    const topBrands = [...brands.entries()]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const topFamilies = [...families.entries()]
      .map(([family, count]) => ({ family, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        total_products: data.length,
        brands: topBrands,
        families: topFamilies,
      },
      message: `Catalog: ${data.length} products across ${brands.size} brands and ${families.size} families.`,
      sources: ["products(stats)"],
    };
  },
};

const getProductByCode: ToolDef<
  { code: string },
  Record<string, unknown> | null
> = {
  name: "getProductByCode",
  description: "Fetch one product by exact slug/name (e.g. KX-9000). Null if no match.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "Slug or product name." },
    },
    required: ["code"],
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | null>> => {
    const code = String(args.code ?? "").trim();
    if (!code) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Please provide a product code or name.",
      };
    }

    const safeCode = sanitizePostgrestLike(code);
    const { data, error } = await supabaseServer
      .from("products")
      .select(PRODUCT_SELECT)
      .or(`slug.eq.${safeCode},product_name.ilike.${safeCode}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[tool.getProductByCode]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't fetch that product right now.",
      };
    }
    if (!data) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: null,
        message: `No product matched "${code}".`,
      };
    }
    const { filtered, stripped } = filterFieldsMany(ctx, "products", [
      data as Record<string, unknown>,
    ]);
    return {
      ok: true,
      permissionStatus: stripped.length > 0 ? "limited" : "allowed",
      data: filtered[0] as Record<string, unknown>,
      message: `Product "${code}" found.`,
      sources: [`products(code=${code})`],
      filteredFields: stripped,
    };
  },
};

/** Strip PostgREST metacharacters before embedding user input into a
 *  .or() filter — see customers.ts for the full rationale. */
function sanitizePostgrestLike(input: string, maxLen = 80): string {
  return input
    .replace(/[,()"'?#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export const productTools: ToolDef[] = [
  searchProducts as unknown as ToolDef,
  getProductByCode as ToolDef,
  countProducts as unknown as ToolDef,
  getCatalogStats as unknown as ToolDef,
];

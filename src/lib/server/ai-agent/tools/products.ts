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
  { query: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "searchProducts",
  description:
    "Search the Koleex product catalog by name, slug, brand, or family. " +
    "Returns a short list of matching products with specs. Use this when " +
    "the user asks 'what products do we have for X', 'find the X lamp', or " +
    "before drafting a quotation so you know the real catalog entries.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search across name, slug, brand, family, description." },
      limit: { type: "integer", description: "Max rows to return. Default 6, max 20." },
    },
    required: ["query"],
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const q = String(args.query ?? "").trim();
    if (!q) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Please provide a search query.",
      };
    }
    const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 20);

    const { data, error } = await supabaseServer
      .from("products")
      .select(PRODUCT_SELECT)
      .or(
        `product_name.ilike.%${q}%,slug.ilike.%${q}%,brand.ilike.%${q}%,family.ilike.%${q}%,description.ilike.%${q}%`,
      )
      .eq("visible", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

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
      data: filtered as Array<Record<string, unknown>>,
      message: `Found ${filtered.length} product(s) matching "${q}".`,
      sources: ["products(catalog)"],
      filteredFields: stripped,
    };
  },
};

const getProductByCode: ToolDef<
  { code: string },
  Record<string, unknown> | null
> = {
  name: "getProductByCode",
  description:
    "Fetch one product by exact slug or product name. Returns null if not " +
    "found. Use when the user references a specific product like 'KX-9000'.",
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

    const { data, error } = await supabaseServer
      .from("products")
      .select(PRODUCT_SELECT)
      .or(`slug.eq.${code},product_name.ilike.${code}`)
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

export const productTools: ToolDef[] = [
  searchProducts as ToolDef,
  getProductByCode as ToolDef,
];

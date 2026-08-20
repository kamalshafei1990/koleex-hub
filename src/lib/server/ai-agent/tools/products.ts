import "server-only";

/* ---------------------------------------------------------------------------
   Product tools — agent-facing read operations on the products catalog.

   Koleex products are a shared catalog (no tenant_id on the products
   table), but cost_price / supplier_price / margin ARE sensitive fields
   and only users with can_view_private see them.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { hasProductCostAccess, stripSecrets, SECRET_MODEL_FIELDS } from "../../product-access";
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

/* ── FULL DETAILS — the owner's "AI knows EVERYTHING in Product Data"
   directive (2026-08-07), with the app's EXACT permission scoping:
   · any internal account with Products·view → identity, classification,
     specs (schema + legacy columns), family members with overrides,
     packing/logistics, selling prices, media/docs/certifications.
   · costs + supplier identity + supplier links + price options are
     COST-SIDE data: included ONLY when hasProductCostAccess(auth) —
     the same check the Products app itself uses. Otherwise the payload
     says explicitly that this account has no permission, so the AI
     answers "you don't have permission to see the cost/supplier",
     never "unknown". */
const getProductFullDetails: ToolDef<
  { code: string },
  Record<string, unknown> | null
> = {
  name: "getProductFullDetails",
  description:
    "EVERYTHING Product Data knows about ONE product. Accepts a KOLEEX code (XPRS-190S), supplier model, slug or name — family member codes resolve to their family. Returns identity, classification, full specs (schema + technical columns), every family member with its overrides, packing & logistics, selling prices, media/documents/certifications — plus cost prices and supplier identity ONLY when this account holds Product Data cost permission (otherwise the result explicitly says the account lacks that permission; report that to the user instead of guessing). Use this for ANY detailed question about a saved product.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "KOLEEX code, member/supplier model code, slug or product name." },
    },
    required: ["code"],
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | null>> => {
    const code = sanitizePostgrestLike(String(args.code ?? ""));
    if (!code) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Provide a product code or name." };
    }

    /* Resolve product id: product slug/name first, then any MODEL code
       (KOLEEX primary_model, model_name, or the supplier's reference). */
    let productId: string | null = null;
    let matchedModel: string | null = null;
    const { data: pHit } = await supabaseServer
      .from("products")
      .select("id")
      .or(`slug.ilike.%${code}%,product_name.ilike.%${code}%`)
      .limit(1)
      .maybeSingle();
    if (pHit) productId = pHit.id as string;
    if (!productId) {
      const { data: mHit } = await supabaseServer
        .from("product_models")
        .select("product_id, primary_model")
        .or(`primary_model.ilike.%${code}%,model_name.ilike.%${code}%,reference_model.ilike.%${code}%`)
        .limit(1)
        .maybeSingle();
      if (mHit) { productId = mHit.product_id as string; matchedModel = (mHit.primary_model as string) ?? null; }
    }
    if (!productId) {
      return { ok: true, permissionStatus: "allowed", data: null, message: `No saved product matched "${code}".` };
    }

    const canSeeCosts = await hasProductCostAccess(ctx.auth);

    const [prodRes, modelsRes, mediaRes, docsRes, certsRes, linksRes] = await Promise.all([
      supabaseServer.from("products").select("*").eq("id", productId).maybeSingle(),
      supabaseServer.from("product_models").select("*").eq("product_id", productId).order("order", { ascending: true }),
      supabaseServer.from("product_media").select("type, model_id, url").eq("product_id", productId),
      supabaseServer.from("product_documents").select("doc_type, title, language, version").eq("product_id", productId),
      supabaseServer.from("product_certifications").select("cert_type, certified_standard, cert_number, issuer, expiry_date, status").eq("product_id", productId),
      canSeeCosts
        ? supabaseServer
            .from("product_suppliers")
            .select("supplier_id, is_primary, supplier_product_code, unit_cost_cny, currency, cost_basis, cost_includes_tax, moq, lead_time_days, payment_terms, notes, price_options, supplier_product_name, incoterms, sample_cost, supplier_warranty_months, price_tiers, sourcing_status")
            .eq("product_id", productId)
        : Promise.resolve({ data: null }),
    ]);

    const product = prodRes.data as Record<string, unknown> | null;
    if (!product) {
      return { ok: true, permissionStatus: "allowed", data: null, message: "Product row disappeared." };
    }

    let models = ((modelsRes.data ?? []) as Array<Record<string, unknown>>);
    let suppliers: Array<Record<string, unknown>> | null = null;
    if (canSeeCosts) {
      const links = ((linksRes.data ?? []) as Array<Record<string, unknown>>) || [];
      const supIds = links.map((l) => l.supplier_id as string).filter(Boolean);
      const nameById = new Map<string, { name: string | null; cn: string | null }>();
      if (supIds.length) {
        const { data: sups } = await supabaseServer
          .from("contacts")
          .select("id, company_name_en, company_name_cn, display_name")
          .in("id", supIds);
        for (const c of (sups ?? []) as Array<Record<string, unknown>>) {
          nameById.set(c.id as string, {
            name: (c.company_name_en as string) || (c.display_name as string) || null,
            cn: (c.company_name_cn as string) || null,
          });
        }
      }
      suppliers = links.map((l) => ({
        ...l,
        supplier_name: nameById.get(l.supplier_id as string)?.name ?? null,
        supplier_name_cn: nameById.get(l.supplier_id as string)?.cn ?? null,
      }));
    } else {
      /* No cost permission: strip every cost/supplier-side field from the
         models too (cost_price, supplier text, supplier_overrides carry
         supplier codes & costs). */
      models = models.map((m) => {
        const clean = stripSecrets(m, SECRET_MODEL_FIELDS) as Record<string, unknown>;
        delete clean.supplier_overrides;
        delete clean.reference_model;
        return clean;
      });
    }

    const media = ((mediaRes.data ?? []) as Array<Record<string, unknown>>);
    const mediaSummary: Record<string, number> = {};
    for (const m of media) {
      const t = String(m.type ?? "other");
      mediaSummary[t] = (mediaSummary[t] ?? 0) + 1;
    }

    const payload: Record<string, unknown> = {
      matched_model: matchedModel,
      product: canSeeCosts ? product : (() => { const c = { ...product }; delete c.moq; return c; })(),
      family: {
        is_family: models.length > 1,
        member_count: models.length,
        member_codes: models.map((m) => (m.primary_model as string) || (m.model_name as string)).filter(Boolean),
      },
      models,
      media_summary: mediaSummary,
      documents: docsRes.data ?? [],
      certifications: certsRes.data ?? [],
      ...(canSeeCosts
        ? { suppliers }
        : {
            cost_and_supplier_data: "RESTRICTED — this account does not have Product Data cost permission. Costs, supplier identities, supplier model codes and purchasing terms are hidden. Tell the user they lack this permission; do NOT guess or say the data is missing.",
          }),
    };

    return {
      ok: true,
      permissionStatus: canSeeCosts ? "allowed" : "limited",
      data: payload,
      message: canSeeCosts
        ? `Full Product Data record loaded (${models.length} model(s), ${suppliers?.length ?? 0} supplier link(s)).`
        : `Product record loaded (${models.length} model(s)). Cost & supplier data withheld — the account lacks Product Data cost permission; say so explicitly if asked about costs or suppliers.`,
      sources: [`product-data(${(product.product_name as string) ?? productId})`],
      ...(canSeeCosts ? {} : { filteredFields: ["cost_price", "suppliers", "supplier_overrides", "moq"] }),
    };
  },
};

/* ── DATA-COMPLETENESS AUDIT — the owner's question the agent could not
   answer (2026-08-20): "how many products have no price?" The agent sampled
   and apologised because no tool aggregates across the catalog. This one
   does, server-side, over ALL products (Product Data's own view — drafts
   included, which is why it gates on the Product Data module, not the
   ACTIVE-only Products lens).

   Money scoping, same as the app: SELLING price presence is neutral catalog
   data. COST-side completeness (model cost_price, supplier unit_cost_cny)
   is included ONLY with hasProductCostAccess — otherwise the payload says
   RESTRICTED explicitly so the AI reports the permission, never guesses. */
const auditProductData: ToolDef<
  { examples_limit?: number },
  Record<string, unknown>
> = {
  name: "auditProductData",
  description:
    "AGGREGATE data-completeness audit across the WHOLE Product Data catalog (all statuses, drafts included). Answers any 'how many products have no / are missing X' question with exact counts and example product names: selling price (global_price on models), media/photos, description, HS code, certifications, plus status breakdown. Cost-side completeness (cost prices, supplier costs) is included only for accounts with Product Data cost permission. ALWAYS use this instead of sampling products one by one.",
  parameters: {
    type: "object",
    properties: {
      examples_limit: { type: "integer", description: "Max example product names per gap list. Default 15, cap 40." },
    },
  },
  requiredModule: "Product Data",
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown>>> => {
    const exLimit = Math.min(Math.max(Number(args.examples_limit ?? 15) || 15, 1), 40);
    const canSeeCosts = await hasProductCostAccess(ctx.auth);

    const [prodRes, modelRes, mediaRes, certRes, linkRes] = await Promise.all([
      supabaseServer.from("products").select("id, product_name, status, description, hs_code"),
      supabaseServer.from("product_models").select("product_id, global_price" + (canSeeCosts ? ", cost_price" : "")),
      supabaseServer.from("product_media").select("product_id"),
      supabaseServer.from("product_certifications").select("product_id"),
      canSeeCosts
        ? supabaseServer.from("product_suppliers").select("product_id, unit_cost_cny")
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (prodRes.error || modelRes.error || mediaRes.error || certRes.error || linkRes.error) {
      console.error("[tool.auditProductData]", prodRes.error ?? modelRes.error ?? mediaRes.error ?? certRes.error ?? linkRes.error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't run the product data audit right now." };
    }

    const products = (prodRes.data ?? []) as Array<{ id: string; product_name: string | null; status: string | null; description: string | null; hs_code: string | null }>;
    /* the conditional select string defeats supabase's inference — cast
       through unknown; the columns are exactly what the string names */
    const models = (modelRes.data ?? []) as unknown as Array<{ product_id: string; global_price: unknown; cost_price?: unknown }>;

    const hasSelling = new Set<string>();
    const hasCost = new Set<string>();
    const modelsOf = new Map<string, number>();
    for (const m of models) {
      modelsOf.set(m.product_id, (modelsOf.get(m.product_id) ?? 0) + 1);
      if (m.global_price !== null && m.global_price !== undefined && Number(m.global_price) > 0) hasSelling.add(m.product_id);
      if (canSeeCosts && m.cost_price !== null && m.cost_price !== undefined && Number(m.cost_price) > 0) hasCost.add(m.product_id);
    }
    if (canSeeCosts) {
      for (const l of ((linkRes.data ?? []) as Array<{ product_id: string; unit_cost_cny: unknown }>)) {
        if (l.unit_cost_cny !== null && l.unit_cost_cny !== undefined && Number(l.unit_cost_cny) > 0) hasCost.add(l.product_id);
      }
    }
    const hasMedia = new Set(((mediaRes.data ?? []) as Array<{ product_id: string }>).map((m) => m.product_id));
    const hasCert = new Set(((certRes.data ?? []) as Array<{ product_id: string }>).map((c) => c.product_id));

    const byStatus: Record<string, number> = {};
    const gap = (pred: (p: (typeof products)[number]) => boolean) => {
      const missing = products.filter(pred);
      return {
        count: missing.length,
        examples: missing.slice(0, exLimit).map((p) => p.product_name ?? p.id),
      };
    };
    for (const p of products) {
      const st = (p.status ?? "draft").toLowerCase();
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }

    const payload: Record<string, unknown> = {
      total_products: products.length,
      by_status: byStatus,
      no_selling_price: gap((p) => !hasSelling.has(p.id)),
      no_media: gap((p) => !hasMedia.has(p.id)),
      no_description: gap((p) => !p.description || !String(p.description).trim()),
      no_hs_code: gap((p) => !p.hs_code || !String(p.hs_code).trim()),
      no_certifications: gap((p) => !hasCert.has(p.id)),
      no_models_at_all: gap((p) => !modelsOf.has(p.id)),
      ...(canSeeCosts
        ? { no_cost_price: gap((p) => !hasCost.has(p.id)) }
        : { cost_completeness: "RESTRICTED — this account lacks Product Data cost permission; cost-side completeness is hidden. Say so if asked about costs." }),
    };

    const noPrice = (payload.no_selling_price as { count: number }).count;
    return {
      ok: true,
      permissionStatus: canSeeCosts ? "allowed" : "limited",
      data: payload,
      message: `Audited ${products.length} products: ${noPrice} have no selling price` +
        (canSeeCosts ? `, ${(payload.no_cost_price as { count: number }).count} have no cost price` : "") +
        `. Full gap counts with examples included.`,
      sources: ["product-data(audit)"],
      ...(canSeeCosts ? {} : { filteredFields: ["cost_price", "unit_cost_cny"] }),
    };
  },
};

export const productTools: ToolDef[] = [
  getProductFullDetails as ToolDef,
  auditProductData as unknown as ToolDef,
  searchProducts as unknown as ToolDef,
  getProductByCode as ToolDef,
  countProducts as unknown as ToolDef,
  getCatalogStats as unknown as ToolDef,
];

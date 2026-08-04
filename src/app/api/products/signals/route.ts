import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, requireProductDataAction } from "@/lib/server/product-access";
import { resolveSchema, computeReadiness } from "@/lib/product-schema";
import type { ProductKnowledgeBlock } from "@/types/product-schema";

/* ---------------------------------------------------------------------------
   GET /api/products/signals — INTERNAL work signals for the Product Data
   grid. One round-trip returning, per product id:

     readiness  — 0-100, the SAME computeReadiness engine the editor uses,
                  so the card and the detail page never disagree
     missing    — up to 3 actionable gap keys (photo/specs/cost/desc/code)
     cost       — primary model cost in CNY (cost-permission gated)
     visible    — customers can see it (distinct from status)
     updatedAt  — staleness
     supplier   — primary supplier {name, logo} (link first, else the
                  model's supplier text matched by name)

   Deliberately a SEPARATE endpoint, not extra weight on
   /api/products?view=list: the public /products catalogue must keep its
   slim, fast payload — only /product-data asks for signals.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string;
  division_slug: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  product_name: string | null;
  schema_specs: Record<string, unknown> | null;
  schema_knowledge: unknown[] | null;
  excerpt: string | null;
  description: string | null;
  warranty: string | null;
  moq: string | number | null;
  lead_time: string | null;
  visible: boolean | null;
  updated_at: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Work signals expose completeness + cost posture — Product Data only. */
  const denied = await requireProductDataAction(auth, "view");
  if (denied) return denied;
  const canSeeCosts = await hasProductCostAccess(auth);

  const [prodRes, subRes, mediaRes, modelRes, supRes, linkRes] = await Promise.all([
    supabaseServer
      .from("products")
      .select(
        "id, division_slug, category_slug, subcategory_slug, product_name, schema_specs, schema_knowledge, excerpt, description, warranty, moq, lead_time, visible, updated_at",
      ),
    supabaseServer.from("subcategories").select("slug, code"),
    supabaseServer
      .from("product_media")
      .select('product_id, type, url, "order"')
      .order("order", { ascending: true }),
    supabaseServer
      .from("product_models")
      .select('product_id, primary_model, model_name, cost_price, global_price, supplier, pricing_mode, price_note, "order"')
      .order("order", { ascending: true }),
    /* Supplier directory — 145 rows, logo columns are URLs (verified: 0
       base64), so shipping them in a bulk payload is safe. */
    supabaseServer
      .from("contacts")
      .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url")
      .eq("contact_type", "supplier")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer.from("product_suppliers").select("product_id, supplier_id, is_primary, unit_cost_cny"),
  ]);

  if (prodRes.error) {
    console.error("[api/products/signals]", prodRes.error.message);
    return NextResponse.json({ error: "Failed to load signals" }, { status: 500 });
  }

  const subCode = new Map<string, string>();
  for (const s of (subRes.data ?? []) as Array<{ slug: string | null; code: string | null }>) {
    if (s.slug && s.code) subCode.set(s.slug, s.code);
  }

  /* media counts by product + type, plus the first main image per product.
     The thumbnail map rides along because this endpoint already reads the
     whole media table — see the round-trip note at the bottom. */
  const media = new Map<string, { main: number; gallery: number; packing: number; manual: number; video: number }>();
  const mainImages: Record<string, string> = {};
  for (const m of (mediaRes.data ?? []) as Array<{ product_id: string; type: string; url: string | null }>) {
    const b = media.get(m.product_id) ?? { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
    if (m.type === "main_image") {
      b.main += 1;
      if (m.url && !mainImages[m.product_id]) mainImages[m.product_id] = m.url;
    }
    else if (m.type === "gallery") b.gallery += 1;
    else if (m.type === "packing") b.packing += 1;
    else if (m.type === "manual") b.manual += 1;
    else if (m.type === "video") b.video += 1;
    media.set(m.product_id, b);
  }

  /* Supplier lookup — by id AND by every name variant, because most
     products carry the supplier as free TEXT on the model rather than a
     product_suppliers link (only a handful are linked today). */
  interface SupLite { name: string; logo: string | null }
  const supById = new Map<string, SupLite>();
  const supByName = new Map<string, SupLite>();
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  for (const c of (supRes.data ?? []) as Array<{
    id: string;
    company_name_en: string | null;
    company_name_cn: string | null;
    display_name: string | null;
    photo_url: string | null;
    logo_url: string | null;
  }>) {
    const name = c.company_name_en || c.display_name || c.company_name_cn || "";
    if (!name) continue;
    const lite: SupLite = { name, logo: c.photo_url || c.logo_url || null };
    supById.set(c.id, lite);
    for (const variant of [c.company_name_en, c.company_name_cn, c.display_name]) {
      if (variant && variant.trim()) supByName.set(norm(variant), lite);
    }
  }
  const linkedSupplier = new Map<string, string>();
  /* Cost can be recorded in EITHER place: on the variant (Price tab) or on
     the supplier link (Supplier tab). The grid only ever read the variant, so
     a product priced through its supplier showed "Cost not set" and carried a
     "No cost" gap chip while the cost was sitting right there on the record.
     Primary link wins, else the first link with a figure. */
  const linkCost = new Map<string, number>();
  for (const l of (linkRes.data ?? []) as Array<{ product_id: string; supplier_id: string | null; is_primary: boolean | null; unit_cost_cny: number | string | null }>) {
    const c = l.unit_cost_cny == null ? null : Number(l.unit_cost_cny);
    if (c != null && Number.isFinite(c) && (l.is_primary || !linkCost.has(l.product_id))) {
      linkCost.set(l.product_id, c);
    }
    if (!l.supplier_id) continue;
    if (l.is_primary || !linkedSupplier.has(l.product_id)) linkedSupplier.set(l.product_id, l.supplier_id);
  }

  /* Model summary — the exact shape /api/product-models?summary=1 returns,
     including its permission rule: supplier names are COST-side data and
     only ship when the caller passes hasProductCostAccess. */
  const counts: Record<string, number> = {};
  const suppliersByProduct: Record<string, string[]> = {};
  const supplierSet = new Set<string>();
  const primaryModelNames: Record<string, string> = {};

  /* first model per product (rows pre-sorted by order) */
  const primary = new Map<
    string,
    { primary_model: string | null; model_name: string | null; cost_price: number | null; global_price: number | null; supplier: string | null; pricing_mode: string | null; price_note: string | null }
  >();
  for (const m of (modelRes.data ?? []) as Array<{
    product_id: string;
    primary_model: string | null;
    model_name: string | null;
    cost_price: number | null;
    global_price: number | null;
    supplier: string | null;
    pricing_mode: string | null;
    price_note: string | null;
  }>) {
    if (!primary.has(m.product_id)) primary.set(m.product_id, m);
    counts[m.product_id] = (counts[m.product_id] || 0) + 1;
    const label = m.primary_model?.trim() || m.model_name;
    if (label && !primaryModelNames[m.product_id]) primaryModelNames[m.product_id] = label;
    if (canSeeCosts && m.supplier) {
      if (!suppliersByProduct[m.product_id]) suppliersByProduct[m.product_id] = [];
      if (!suppliersByProduct[m.product_id].includes(m.supplier)) {
        suppliersByProduct[m.product_id].push(m.supplier);
      }
      supplierSet.add(m.supplier);
    }
  }

  const signals: Record<
    string,
    {
      readiness: number | null;
      missing: string[];
      cost: number | null;
      pricingMode: "fixed" | "from" | "on_request";
      priceNote: string | null;
      visible: boolean;
      updatedAt: string | null;
      supplier: { name: string; logo: string | null } | null;
    }
  > = {};

  for (const p of (prodRes.data ?? []) as unknown as ProductRow[]) {
    const mediaCounts = media.get(p.id) ?? { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
    const model = primary.get(p.id);
    const values = (p.schema_specs ?? {}) as Record<string, unknown>;
    /* One definition of "this product's cost", used by all three consumers
       below so the bar, the chip and the number can never disagree. */
    const effectiveCost = model?.cost_price ?? linkCost.get(p.id) ?? null;
    const { schema } = resolveSchema({
      divisionCode: p.division_slug || "",
      categoryCode: p.category_slug || "",
      subcategoryCode: subCode.get(p.subcategory_slug || "") || "",
    });

    /* HONESTY GUARD: computeReadiness scores a dimension with zero
       applicable items as 100 ("nothing missing"). For a product with no
       spec template resolved that inflates the overall to ~70% while the
       record is actually empty — exactly the lie a readiness bar must
       never tell. No template → no percentage, and the template itself
       becomes the first gap chip. */
    const report = schema ? computeReadiness({
      schema,
      values,
      media: mediaCounts,
      commercial: {
        product_name: p.product_name,
        primary_model: model?.primary_model ?? null,
        supplier_model: model?.model_name ?? null,
        cost_price: effectiveCost,
        global_price: model?.global_price ?? null,
        pricing_mode: (model?.pricing_mode as "fixed" | "from" | "on_request" | null) ?? "fixed",
        warranty: p.warranty,
        moq: p.moq == null ? null : String(p.moq),
        lead_time: p.lead_time,
      },
      knowledge: (p.schema_knowledge ?? []) as ProductKnowledgeBlock[],
    }) : null;

    /* Actionable gaps, ordered by how much they block publishing.
       Only the first three reach the card — a wall of chips is noise. */
    const missing: string[] = [];
    if (!schema) missing.push("template");
    if (mediaCounts.main === 0 && mediaCounts.gallery === 0) missing.push("photo");
    if (Object.values(values).filter((v) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)).length === 0)
      missing.push("specs");
    if (!model?.primary_model) missing.push("code");
    /* Only a FIXED-price model can be "missing" its cost. A machine quoted
       per configuration has no cost to fill in, and flagging it forever was
       what buried the products that genuinely are unfinished. */
    if (effectiveCost == null && (model?.pricing_mode ?? "fixed") === "fixed") missing.push("cost");
    if (!(p.excerpt || "").trim() && !(p.description || "").trim()) missing.push("description");

    signals[p.id] = {
      readiness: report ? report.overall : null,
      missing: missing.slice(0, 3),
      cost: canSeeCosts ? effectiveCost : null,
      pricingMode: (model?.pricing_mode as "fixed" | "from" | "on_request" | null) ?? "fixed",
      priceNote: model?.price_note ?? null,
      visible: p.visible === true,
      updatedAt: p.updated_at,
      supplier: (() => {
        const linkId = linkedSupplier.get(p.id);
        if (linkId && supById.has(linkId)) return supById.get(linkId)!;
        const txt = (model?.supplier || "").trim();
        if (!txt) return null;
        /* Known supplier → real logo; unknown free text → name only. */
        return supByName.get(norm(txt)) ?? { name: txt, logo: null };
      })(),
    };
  }

  /* ROUND-TRIP BUDGET: on the operators' network a single request costs
     ~1-2s before any work happens (a static edge asset measures the same),
     and parallel requests contend with each other. This endpoint already
     reads product_models and product_media in full, so it also returns the
     model summary and the thumbnail map — three requests collapse into one
     for the Product Data grid. The public catalogue still calls the
     separate endpoints, which are unchanged.

     Private SWR cache: signals move at data-entry speed, not per click.
     30s fresh / 5min stale keeps repeat opens instant without ever
     serving another account's view (private). */
  return NextResponse.json(
    {
      signals,
      costVisible: canSeeCosts,
      models: {
        counts,
        suppliers: suppliersByProduct,
        allSuppliers: Array.from(supplierSet).sort(),
        primaryModelNames,
      },
      mainImages,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

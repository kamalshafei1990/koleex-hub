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
    supabaseServer.from("product_media").select("product_id, type"),
    supabaseServer
      .from("product_models")
      .select('product_id, primary_model, model_name, cost_price, global_price, supplier, "order"')
      .order("order", { ascending: true }),
    /* Supplier directory — 145 rows, logo columns are URLs (verified: 0
       base64), so shipping them in a bulk payload is safe. */
    supabaseServer
      .from("contacts")
      .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url")
      .eq("contact_type", "supplier")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer.from("product_suppliers").select("product_id, supplier_id, is_primary"),
  ]);

  if (prodRes.error) {
    console.error("[api/products/signals]", prodRes.error.message);
    return NextResponse.json({ error: "Failed to load signals" }, { status: 500 });
  }

  const subCode = new Map<string, string>();
  for (const s of (subRes.data ?? []) as Array<{ slug: string | null; code: string | null }>) {
    if (s.slug && s.code) subCode.set(s.slug, s.code);
  }

  /* media counts by product + type */
  const media = new Map<string, { main: number; gallery: number; packing: number; manual: number; video: number }>();
  for (const m of (mediaRes.data ?? []) as Array<{ product_id: string; type: string }>) {
    const b = media.get(m.product_id) ?? { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
    if (m.type === "main_image") b.main += 1;
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
  for (const l of (linkRes.data ?? []) as Array<{ product_id: string; supplier_id: string | null; is_primary: boolean | null }>) {
    if (!l.supplier_id) continue;
    if (l.is_primary || !linkedSupplier.has(l.product_id)) linkedSupplier.set(l.product_id, l.supplier_id);
  }

  /* first model per product (rows pre-sorted by order) */
  const primary = new Map<
    string,
    { primary_model: string | null; model_name: string | null; cost_price: number | null; global_price: number | null; supplier: string | null }
  >();
  for (const m of (modelRes.data ?? []) as Array<{
    product_id: string;
    primary_model: string | null;
    model_name: string | null;
    cost_price: number | null;
    global_price: number | null;
    supplier: string | null;
  }>) {
    if (!primary.has(m.product_id)) primary.set(m.product_id, m);
  }

  const signals: Record<
    string,
    {
      readiness: number | null;
      missing: string[];
      cost: number | null;
      visible: boolean;
      updatedAt: string | null;
      supplier: { name: string; logo: string | null } | null;
    }
  > = {};

  for (const p of (prodRes.data ?? []) as unknown as ProductRow[]) {
    const mediaCounts = media.get(p.id) ?? { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
    const model = primary.get(p.id);
    const values = (p.schema_specs ?? {}) as Record<string, unknown>;
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
        cost_price: model?.cost_price ?? null,
        global_price: model?.global_price ?? null,
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
    if (model?.cost_price == null) missing.push("cost");
    if (!(p.excerpt || "").trim() && !(p.description || "").trim()) missing.push("description");

    signals[p.id] = {
      readiness: report ? report.overall : null,
      missing: missing.slice(0, 3),
      cost: canSeeCosts ? (model?.cost_price ?? null) : null,
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

  /* Private SWR cache: signals move at data-entry speed, not per click.
     30s fresh / 5min stale keeps repeat opens instant without ever
     serving another account's view (private). */
  return NextResponse.json(
    { signals, costVisible: canSeeCosts },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

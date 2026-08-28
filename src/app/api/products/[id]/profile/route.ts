import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/products/[id]/profile — everything Product Data knows about one
   product, in ONE round trip.

   The internal detail view used to be the customer-facing product page with
   internal blocks bolted on. That page is a showroom: it hides empty fields,
   because a customer must never see a gap. Product Data needs the opposite —
   an operator opens a product precisely to find what is missing, so blanks
   have to be visible.

   One endpoint rather than eight parallel fetches: on the operators'
   connection a request costs ~1-2s of latency regardless of its size, so the
   round trips were the expensive part (same reasoning as /api/products/signals).

   Auth: Product Data access. Cost figures are additionally gated behind
   hasProductCostAccess, mirroring every other internal surface.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, requireProductDataAction } from "@/lib/server/product-access";
import { resolveSchema, computeReadiness } from "@/lib/product-schema";
import type { ProductKnowledgeBlock } from "@/types/product-schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cost-bearing columns on a variant — stripped when the caller can't see cost. */
const COST_KEYS = ["cost_price", "head_only_price", "complete_set_price", "supplier"] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "view");
  if (denied) return denied;
  const canSeeCosts = await hasProductCostAccess(auth);

  const { id: handle } = await params;

  /* The grid links by slug, the editor by uuid — accept either. */
  const base = supabaseServer.from("products").select("*").eq("tenant_id", auth.tenant_id);
  const { data: bySlug } = await base.eq("slug", handle).maybeSingle();
  let product = bySlug as Record<string, unknown> | null;
  if (!product && UUID_RE.test(handle)) {
    const { data: byId } = await supabaseServer
      .from("products").select("*").eq("tenant_id", auth.tenant_id).eq("id", handle).maybeSingle();
    product = (byId as Record<string, unknown> | null) ?? null;
  }
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pid = product.id as string;

  const [models, media, translations, suppliers, certs, docs, related, subRow] = await Promise.all([
    supabaseServer.from("product_models").select("*").eq("product_id", pid).order("order", { ascending: true }),
    supabaseServer.from("product_media").select("*").eq("product_id", pid).order("order", { ascending: true }),
    supabaseServer.from("product_translations").select("*").eq("product_id", pid),
    supabaseServer.from("product_suppliers").select("*").eq("product_id", pid),
    supabaseServer.from("product_certifications").select("*").eq("product_id", pid),
    supabaseServer.from("product_documents").select("*").eq("product_id", pid).order("sort_order", { ascending: true }),
    supabaseServer.from("related_products").select("*").eq("product_id", pid),
    supabaseServer.from("subcategories").select("slug, code, name").eq("slug", (product.subcategory_slug as string) || "").maybeSingle(),
  ]);

  /* Supplier identity is master data in the Suppliers app — resolve names for
     display only, never copy them into Product Data (binding rule). */
  const supplierIds = ((suppliers.data ?? []) as Array<{ supplier_id: string | null }>)
    .map((r) => r.supplier_id).filter((v): v is string => !!v);
  const supplierNames = new Map<string, { name: string; logo: string | null; supply_type: string | null; incoterms: string | null }>();
  if (supplierIds.length) {
    const { data } = await supabaseServer
      .from("contacts")
      .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url, supplier_type, incoterms")
      .in("id", supplierIds);
    for (const c of (data ?? []) as Array<Record<string, string | null>>) {
      supplierNames.set(c.id as string, {
        name: c.company_name_en || c.display_name || c.company_name_cn || "—",
        logo: c.photo_url || c.logo_url || null,
        /* Supply type & incoterms live on the supplier record (Suppliers
           app; the contacts column is spelled supplier_type) — the link
           table's columns of the same name are legacy (incoterms removed
           from the form by owner, 2026-07-31), so the profile view reads
           these instead of the always-empty link ones. */
        supply_type: c.supplier_type || null,
        incoterms: c.incoterms || null,
      });
    }
  }

  /* Related products get a readable label rather than a bare uuid. */
  const relatedIds = ((related.data ?? []) as Array<{ related_id: string }>).map((r) => r.related_id);
  const relatedNames = new Map<string, { name: string; slug: string | null }>();
  if (relatedIds.length) {
    const { data } = await supabaseServer.from("products").select("id, product_name, slug").in("id", relatedIds);
    for (const r of (data ?? []) as Array<{ id: string; product_name: string | null; slug: string | null }>) {
      relatedNames.set(r.id, { name: r.product_name || "—", slug: r.slug });
    }
  }

  const modelRows = (models.data ?? []) as Array<Record<string, unknown>>;
  const mediaRows = (media.data ?? []) as Array<Record<string, unknown>>;

  /* Same readiness engine as the grid and the editor, so the three can never
     disagree about how complete a product is. */
  const { schema } = resolveSchema({
    divisionCode: (product.division_slug as string) || "",
    categoryCode: (product.category_slug as string) || "",
    subcategoryCode: (subRow.data as { code?: string } | null)?.code || "",
  });
  const counts = { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
  for (const m of mediaRows) {
    const t = m.type as string;
    if (t === "main_image") counts.main += 1;
    else if (t === "gallery") counts.gallery += 1;
    else if (t === "packing") counts.packing += 1;
    else if (t === "manual") counts.manual += 1;
    else if (t === "video") counts.video += 1;
  }
  const primary = modelRows[0];
  const readiness = schema
    ? computeReadiness({
        schema,
        values: (product.schema_specs as Record<string, unknown>) ?? {},
        media: counts,
        commercial: {
          product_name: product.product_name as string | null,
          primary_model: (primary?.primary_model as string) ?? null,
          supplier_model: (primary?.model_name as string) ?? null,
          cost_price: (primary?.cost_price as number) ?? null,
          global_price: (primary?.global_price as number) ?? null,
          pricing_mode: ((primary?.pricing_mode as string) ?? "fixed") as "fixed" | "from" | "on_request",
          warranty: product.warranty as string | null,
          moq: product.moq == null ? null : String(product.moq),
          lead_time: product.lead_time as string | null,
        },
        knowledge: ((product.schema_knowledge as ProductKnowledgeBlock[]) ?? []),
      })
    : null;

  return NextResponse.json(
    {
      product,
      subcategory: subRow.data ?? null,
      schema: schema ? { name: schema.name, version: schema.version, groups: schema.groups ?? [] } : null,
      models: canSeeCosts
        ? modelRows
        : modelRows.map((m) => { const c = { ...m }; for (const k of COST_KEYS) delete c[k]; return c; }),
      media: mediaRows,
      translations: translations.data ?? [],
      suppliers: ((suppliers.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        supplier: s.supplier_id ? supplierNames.get(s.supplier_id as string) ?? null : null,
      })),
      certifications: certs.data ?? [],
      documents: docs.data ?? [],
      related: ((related.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        product: relatedNames.get(r.related_id as string) ?? null,
      })),
      readiness,
      costVisible: canSeeCosts,
    },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=120" } },
  );
}

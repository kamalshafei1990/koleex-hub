import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, requireProductDataAction } from "@/lib/server/product-access";
import { resolveSchema, computeReadiness } from "@/lib/product-schema";
import { inChunks } from "@/lib/server/in-chunks";
import type { ProductKnowledgeBlock } from "@/types/product-schema";

/* ---------------------------------------------------------------------------
   POST /api/products/signals — INTERNAL work signals for the Product Data
   grid, for a LIST of product ids. Per product:

     readiness  — 0-100, the SAME computeReadiness engine the editor uses,
                  so the card and the detail page never disagree
     missing    — up to 3 actionable gap keys (photo/specs/cost/desc/code)
     cost       — effective cost in CNY (cost-permission gated)
     visible    — customers can see it (distinct from status)
     updatedAt  — staleness
     supplier   — { id } into the `suppliers` dictionary, or { id: null,
                  name } when the model row carries free text

   WHY IDS, NOT THE WHOLE CATALOGUE (22 Sep 2026). The GET version read every
   product, every model, every media row, every supplier link, every
   translation and EVERY contact on every open, then shipped 408 KB back:
   190 KB of signals (each carrying a full supplier object with a 200-byte
   logo URL — the same eight suppliers, repeated 394 times), 158 KB of model
   maps the list response already delivers with each page, and 60 KB of
   thumbnails. That was for 394 products; at the owner's 3,000 it is ~3 MB
   per open, and the grid only ever shows one page at a time. The list is
   paged; this now follows the page. Same discipline as /api/products/
   fob-prices: the client posts the ids it is holding and merges.

   WHAT LEFT THE PAYLOAD, AND WHERE IT WENT:
     · models (counts / codes / rosters) — ride with each list page.
     · supplier objects — one `suppliers` dictionary per response; the
       signal carries the id.
     · every other per-product field is unchanged, so the card is unchanged.

   COST SOURCE (owner's source-of-truth rule): the SUPPLIER LINK is the
   record; the variant's cost_price is the fallback. The profile's Price tab
   reads them in the same order — the GET version read the variant first,
   and the same product could show "Not set" on one screen and ¥6,554 on
   the other.

   Deliberately a SEPARATE endpoint, not extra weight on /api/products: the
   public /products catalogue must keep its slim, fast payload — only
   /product-data asks for signals.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const MAX_IDS = 500;

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

interface ModelRow {
  product_id: string;
  primary_model: string | null;
  model_name: string | null;
  cost_price: number | null;
  global_price: number | null;
  supplier: string | null;
  pricing_mode: string | null;
  price_note: string | null;
}

interface LinkRow {
  product_id: string;
  supplier_id: string | null;
  is_primary: boolean | null;
  unit_cost_cny: number | string | null;
  notes?: string | null;
  price_options?: Array<{ price?: unknown; note?: unknown }> | null;
}

interface ContactRow {
  id: string;
  company_name_en: string | null;
  company_name_cn: string | null;
  display_name: string | null;
  photo_url: string | null;
  logo_url: string | null;
}

export interface SignalsSupplier { name: string; cn: string | null; logo: string | null }

/* THE TENANT'S LINKED SUPPLIERS, memoised for a minute per tenant.
   The supplier FILTER lists every supplier with a product in this tenant,
   not only the ones on this page — otherwise the dropdown would grow as the
   operator scrolled. The first version asked PostgREST for that with an
   embedded-resource filter (`products!inner(tenant_id)`), which the HTTP
   client refused outright; this reads the two small tables it needs —
   supplier contacts of the tenant, and the distinct supplier ids that hold a
   product link — and intersects them. Eight rows today, tens later; the memo
   keeps it off the hot path. A link edit shows here within a minute, which
   is the freshness the signals themselves already advertise. */
interface SupplierMemo { at: number; dict: Record<string, SignalsSupplier> }
const gs = globalThis as typeof globalThis & { __kxSignalSuppliers?: Map<string, SupplierMemo> };
const SUPPLIER_MEMO_MS = 60_000;

async function tenantLinkedSuppliers(tenantId: string): Promise<Record<string, SignalsSupplier>> {
  const store = (gs.__kxSignalSuppliers ??= new Map());
  const hit = store.get(tenantId);
  if (hit && Date.now() - hit.at < SUPPLIER_MEMO_MS) return hit.dict;
  const [contactsRes, linksRes] = await Promise.all([
    supabaseServer
      .from("contacts")
      .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url")
      .eq("tenant_id", tenantId)
      .eq("contact_type", "supplier"),
    supabaseServer.from("product_suppliers").select("supplier_id"),
  ]);
  const linked = new Set<string>();
  for (const r of (linksRes.data ?? []) as Array<{ supplier_id: string | null }>) if (r.supplier_id) linked.add(r.supplier_id);
  const dict: Record<string, SignalsSupplier> = {};
  for (const c of (contactsRes.data ?? []) as ContactRow[]) {
    if (!linked.has(c.id)) continue;
    const name = c.company_name_en || c.display_name || c.company_name_cn || "";
    if (!name) continue;
    dict[c.id] = { name, cn: c.company_name_cn, logo: c.photo_url || c.logo_url || null };
  }
  /* Only a complete answer is memoised — a failed read must not pin an
     empty filter for a minute. */
  if (!contactsRes.error && !linksRes.error) store.set(tenantId, { at: Date.now(), dict });
  return dict;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Work signals expose completeness + cost posture — Product Data only. */
  const denied = await requireProductDataAction(auth, "view");
  if (denied) return denied;
  const canSeeCosts = await hasProductCostAccess(auth);

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  ids = Array.from(new Set(ids)).slice(0, MAX_IDS);

  const empty = { signals: {}, suppliers: {}, allSuppliers: [] as string[], nameAlts: {}, mainImages: {}, costVisible: canSeeCosts };
  if (ids.length === 0) return NextResponse.json(empty);

  /* Every per-product read is scoped to the posted ids and goes through
     inChunks (see in-chunks.ts: 394 ids in one `.in()` URL is a `fetch
     failed`, not a slow query). The subcategory code map is the one read
     that is not per product — one short row per taxonomy node, and only
     the code it maps to is used. */
  const [prodRes, subRes, mediaRes, modelRes, linkRes, trRes, supplierDict] = await Promise.all([
    inChunks<ProductRow>(ids, (chunk) =>
      supabaseServer
        .from("products")
        .select(
          "id, division_slug, category_slug, subcategory_slug, product_name, schema_specs, schema_knowledge, excerpt, description, warranty, moq, lead_time, visible, updated_at",
        )
        .eq("tenant_id", auth.tenant_id)
        .in("id", chunk)),
    supabaseServer.from("subcategories").select("slug, code"),
    inChunks<{ product_id: string; type: string; url: string | null }>(ids, (chunk) =>
      supabaseServer
        .from("product_media")
        .select('product_id, type, url, "order"')
        .in("product_id", chunk)
        .order("order", { ascending: true })),
    inChunks<ModelRow>(ids, (chunk) =>
      supabaseServer
        .from("product_models")
        .select('product_id, primary_model, model_name, cost_price, global_price, supplier, pricing_mode, price_note, visible, status, "order"')
        .in("product_id", chunk)
        .order("order", { ascending: true })),
    inChunks<LinkRow>(ids, (chunk) =>
      supabaseServer
        .from("product_suppliers")
        .select("product_id, supplier_id, is_primary, unit_cost_cny, notes, price_options")
        .in("product_id", chunk)),
    inChunks<{ product_id: string; product_name: string | null }>(ids, (chunk) =>
      supabaseServer.from("product_translations").select("product_id, product_name").in("product_id", chunk)),
    tenantLinkedSuppliers(auth.tenant_id),
  ]);

  if (prodRes.error) {
    console.error("[api/products/signals]", prodRes.error.message);
    return NextResponse.json({ error: "Failed to load signals" }, { status: 500 });
  }

  const subCode = new Map<string, string>();
  for (const s of (subRes.data ?? []) as Array<{ slug: string | null; code: string | null }>) {
    if (s.slug && s.code) subCode.set(s.slug, s.code);
  }

  /* media counts by product + type, plus the first main image per product. */
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

  /* Supplier links for THIS page: cost, annotations, and the linked id.
     Primary link wins, else the first link with a figure. */
  const linkCost = new Map<string, number>();
  const linkNote = new Map<string, string>();
  const linkExtras = new Map<string, { price: number | null; note: string }[]>();
  const linkedSupplier = new Map<string, string>();
  for (const l of (linkRes.data ?? []) as LinkRow[]) {
    const c = l.unit_cost_cny == null || l.unit_cost_cny === "" ? null : Number(l.unit_cost_cny);
    if (c != null && Number.isFinite(c) && (l.is_primary || !linkCost.has(l.product_id))) {
      linkCost.set(l.product_id, c);
    }
    if (l.is_primary || !linkNote.has(l.product_id)) {
      if (l.notes && String(l.notes).trim()) linkNote.set(l.product_id, String(l.notes).trim());
      if (Array.isArray(l.price_options) && l.price_options.length) {
        linkExtras.set(l.product_id, l.price_options.map((o) => ({
          price: o.price == null || o.price === "" ? null : Number(o.price),
          note: String(o.note ?? "").trim(),
        })).filter((o) => o.price !== null || o.note));
      }
    }
    if (!l.supplier_id) continue;
    if (l.is_primary || !linkedSupplier.has(l.product_id)) linkedSupplier.set(l.product_id, l.supplier_id);
  }

  /* First model per product (rows pre-sorted by order). */
  const primary = new Map<string, ModelRow>();
  const freeTextSuppliers = new Set<string>();
  for (const m of (modelRes.data ?? []) as ModelRow[]) {
    if (!primary.has(m.product_id)) primary.set(m.product_id, m);
    if (canSeeCosts && m.supplier && m.supplier.trim()) freeTextSuppliers.add(m.supplier.trim());
  }

  /* The supplier dictionary is the tenant's linked suppliers (memoised);
     the GET version read the entire contacts table — 347 rows, customers
     and employees included — on every open to resolve eight of them. A
     supplier linked seconds ago and not yet in the memo still resolves:
     the page's own link ids are looked up directly below. */
  const suppliers: Record<string, SignalsSupplier> = { ...supplierDict };
  const missingSup = Array.from(new Set(Array.from(linkedSupplier.values()).filter((id) => !suppliers[id])));
  if (missingSup.length) {
    const { data: fresh } = await supabaseServer
      .from("contacts")
      .select("id, company_name_en, company_name_cn, display_name, photo_url, logo_url")
      .eq("tenant_id", auth.tenant_id)
      .in("id", missingSup.slice(0, 150));
    for (const c of (fresh ?? []) as ContactRow[]) {
      const name = c.company_name_en || c.display_name || c.company_name_cn || "";
      if (name) suppliers[c.id] = { name, cn: c.company_name_cn, logo: c.photo_url || c.logo_url || null };
    }
  }
  const supByName = new Map<string, string>();
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [id, sup] of Object.entries(suppliers)) {
    for (const variant of [sup.name, sup.cn]) {
      if (variant && variant.trim()) supByName.set(norm(variant), id);
    }
  }
  /* The filter's option list: every linked supplier's display name, plus
     any free-text supplier a model row still carries. Names are cost-side
     data (who we buy from), so they ship only with cost access — the
     dictionary itself is needed by every card and always ships. */
  const allSuppliers = canSeeCosts
    ? Array.from(new Set([
        ...Object.values(suppliers).map((s) => s.name),
        ...Array.from(freeTextSuppliers),
      ])).sort()
    : [];

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
      supplier: { id: string | null; name?: string } | null;
      costNote: string | null;
      costExtras: { price: number | null; note: string }[];
    }
  > = {};

  for (const p of (prodRes.data ?? []) as unknown as ProductRow[]) {
    const mediaCounts = media.get(p.id) ?? { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 };
    const model = primary.get(p.id);
    const values = (p.schema_specs ?? {}) as Record<string, unknown>;
    /* One definition of "this product's cost", used by all three consumers
       below so the bar, the chip and the number can never disagree — and the
       same order the Price tab uses: link first, variant as fallback. */
    const effectiveCost = linkCost.get(p.id) ?? model?.cost_price ?? null;
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
      costNote: canSeeCosts ? (linkNote.get(p.id) ?? null) : null,
      costExtras: canSeeCosts ? (linkExtras.get(p.id) ?? []) : [],
      supplier: (() => {
        const linkId = linkedSupplier.get(p.id);
        if (linkId && suppliers[linkId]) return { id: linkId };
        const txt = (model?.supplier || "").trim();
        if (!txt) return null;
        /* Free text that names a known supplier resolves to it (logo, deep
           link); anything else stays a bare name. */
        const byName = supByName.get(norm(txt));
        return byName ? { id: byName } : { id: null, name: txt };
      })(),
    };
  }

  /* Translated names for THIS page's products — the browser-side haystack
     uses them so 熔接机 narrows the loaded rows on the keystroke, before the
     server search confirms. */
  const nameAlts: Record<string, string> = {};
  for (const t of (trRes.data ?? []) as Array<{ product_id: string; product_name: string | null }>) {
    if (!t.product_name) continue;
    nameAlts[t.product_id] = nameAlts[t.product_id] ? nameAlts[t.product_id] + " " + t.product_name : t.product_name;
  }

  /* POST responses are not cached by the browser, and this one should not
     be: signals move at data-entry speed, and the page-level warm start
     (thumbnails in localStorage) already covers the repeat open. */
  return NextResponse.json(
    { signals, suppliers, allSuppliers, nameAlts, mainImages, costVisible: canSeeCosts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

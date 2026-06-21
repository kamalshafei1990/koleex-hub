import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-set-templates

   CS-3: named complete-set bundles (Economy / Standard / Premium) per machine
   class (subcategory_slug). A template references existing accessory products;
   applying one in the Price-tab configurator auto-selects them. Pricing stays
   the same sum-of-components rule.

   GET  ?subcategory=<slug> → { templates: [{ id, name, tier, sort_order,
                                              items:[{accessory_product_id, role}] }] }
   PUT  { subcategory, templates:[...] } → replaces the full set for that
        subcategory. Product Data / SA only. Tenant-scoped.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = new Set(["economy", "standard", "premium"]);
const ROLES = new Set(["stand", "table"]);

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const subcategory = (new URL(req.url).searchParams.get("subcategory") || "").trim();
  if (!subcategory) return NextResponse.json({ templates: [] });

  const { data: tpls } = await supabaseServer
    .from("product_set_templates")
    .select("id, name, tier, sort_order")
    .eq("tenant_id", auth.tenant_id)
    .eq("subcategory_slug", subcategory)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const list = tpls ?? [];
  if (!list.length) return NextResponse.json({ templates: [] });

  const { data: items } = await supabaseServer
    .from("product_set_template_items")
    .select("set_template_id, accessory_product_id, role")
    .in("set_template_id", list.map((t) => (t as { id: string }).id));

  const byTpl = new Map<string, { accessory_product_id: string; role: string }[]>();
  for (const it of items ?? []) {
    const r = it as { set_template_id: string; accessory_product_id: string; role: string };
    if (!byTpl.has(r.set_template_id)) byTpl.set(r.set_template_id, []);
    byTpl.get(r.set_template_id)!.push({ accessory_product_id: r.accessory_product_id, role: r.role });
  }

  return NextResponse.json(
    { templates: list.map((t) => ({ ...(t as object), items: byTpl.get((t as { id: string }).id) ?? [] })) },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Only Product Data admins can edit set templates." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subcategory?: string;
    templates?: Array<{ name?: string; tier?: string; sort_order?: number; items?: Array<{ accessory_product_id?: string; role?: string }> }>;
  };
  const subcategory = (body.subcategory || "").trim();
  if (!subcategory) return NextResponse.json({ error: "A subcategory slug is required." }, { status: 400 });

  const incoming = Array.isArray(body.templates) ? body.templates : [];

  // Validate referenced accessory products are tenant-owned.
  const allIds = [...new Set(incoming.flatMap((t) => (t.items ?? []).map((i) => i.accessory_product_id)).filter((v): v is string => typeof v === "string" && UUID_RE.test(v)))];
  let validIds = new Set<string>();
  if (allIds.length) {
    const { data: owned } = await supabaseServer.from("products").select("id").eq("tenant_id", auth.tenant_id).in("id", allIds);
    validIds = new Set((owned ?? []).map((p) => (p as { id: string }).id));
  }

  // Replace the set: delete existing templates for this subcategory (items
  // cascade), then insert the new ones + their items.
  const del = await supabaseServer
    .from("product_set_templates")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("subcategory_slug", subcategory);
  if (del.error) {
    console.error("[api/product-set-templates PUT delete]", del.error.message);
    return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  }

  let created = 0;
  for (let i = 0; i < incoming.length; i++) {
    const t = incoming[i];
    const name = (t.name || "").trim();
    if (!name) continue;
    const tier = TIERS.has(t.tier as string) ? (t.tier as string) : "standard";
    const { data: ins, error: insErr } = await supabaseServer
      .from("product_set_templates")
      .insert({ tenant_id: auth.tenant_id, subcategory_slug: subcategory, name, tier, sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : i })
      .select("id")
      .single();
    if (insErr || !ins) {
      console.error("[api/product-set-templates PUT insert tpl]", insErr?.message);
      return NextResponse.json({ error: humanizeError(insErr) }, { status: 500 });
    }
    const itemRows = (t.items ?? [])
      .filter((it) => validIds.has(it.accessory_product_id as string))
      .map((it) => ({ set_template_id: (ins as { id: string }).id, accessory_product_id: it.accessory_product_id as string, role: ROLES.has(it.role as string) ? (it.role as string) : "stand" }));
    if (itemRows.length) {
      const itemIns = await supabaseServer.from("product_set_template_items").insert(itemRows);
      if (itemIns.error) {
        console.error("[api/product-set-templates PUT insert items]", itemIns.error.message);
        return NextResponse.json({ error: humanizeError(itemIns.error) }, { status: 500 });
      }
    }
    created++;
  }

  return NextResponse.json({ ok: true, count: created });
}

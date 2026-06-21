import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-accessory-options

   Complete-set: which accessory PRODUCTS (stands / tables) are compatible with
   a machine class. Mapping is keyed on `subcategory_slug` (the machine class),
   NOT per product — one mapping serves every machine in that subcategory.

   Each accessory is a normal product with its own cost, so the complete-set
   price = head + selected accessories, each priced through the canonical engine
   and summed. No price-bearing variants (deferred to PD-V2).

   GET  ?subcategory=<slug>            → { options: AccessoryOptionRow[] }
   PUT  { subcategory, options: [...] } → replaces the full set for that
        subcategory (delete-missing + insert-provided). Product Data / SA only.

   Tenant: rows carry tenant_id; scoped to the caller's tenant.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set(["stand", "table"]);

const COLS =
  "id, tenant_id, subcategory_slug, accessory_product_id, role, is_default, sort_order, created_at";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const subcategory = (new URL(req.url).searchParams.get("subcategory") || "").trim();
  if (!subcategory) return NextResponse.json({ options: [] });

  const { data, error } = await supabaseServer
    .from("product_accessory_options")
    .select(COLS)
    .eq("tenant_id", auth.tenant_id)
    .eq("subcategory_slug", subcategory)
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[api/product-accessory-options GET]", error.message);
    return NextResponse.json({ error: "Failed to load accessory options" }, { status: 500 });
  }
  return NextResponse.json(
    { options: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit accessory options." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    subcategory?: string;
    options?: Array<Record<string, unknown>>;
  };
  const subcategory = (body.subcategory || "").trim();
  if (!subcategory) {
    return NextResponse.json({ error: "A subcategory slug is required." }, { status: 400 });
  }

  const incoming = Array.isArray(body.options) ? body.options : [];

  // Only keep rows pointing at a real product owned by this tenant — prevents
  // mapping an accessory from another tenant or a deleted product.
  const candidateIds = [
    ...new Set(
      incoming
        .map((r) => r.accessory_product_id)
        .filter((v): v is string => typeof v === "string" && UUID_RE.test(v)),
    ),
  ];
  let validIds = new Set<string>();
  if (candidateIds.length) {
    const { data: owned } = await supabaseServer
      .from("products")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .in("id", candidateIds);
    validIds = new Set((owned ?? []).map((p) => (p as { id: string }).id));
  }

  const rows = incoming
    .filter((r) => validIds.has(r.accessory_product_id as string))
    .map((r, i) => ({
      tenant_id: auth.tenant_id,
      subcategory_slug: subcategory,
      accessory_product_id: r.accessory_product_id as string,
      role: ROLES.has(r.role as string) ? (r.role as string) : "stand",
      is_default: !!r.is_default,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : i,
    }));

  // Replace-the-set for this subcategory (the mapping carries no history).
  const del = await supabaseServer
    .from("product_accessory_options")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("subcategory_slug", subcategory);
  if (del.error) {
    console.error("[api/product-accessory-options PUT delete]", del.error.message);
    return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  }
  if (rows.length) {
    const ins = await supabaseServer.from("product_accessory_options").insert(rows);
    if (ins.error) {
      console.error("[api/product-accessory-options PUT insert]", ins.error.message);
      return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

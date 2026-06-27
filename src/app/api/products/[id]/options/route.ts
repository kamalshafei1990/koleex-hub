import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/[id]/options

   Configurable option VALUES for a Stand/Table product (ST-2). Each row is one
   selectable value on an axis, with a price delta added to the product's base
   cost when chosen. Drives the complete-set configurator.

   GET  → { options: AccessoryOptionValue[] }   (any authed user)
   PUT  { options: [...] } → replaces the full set for this product. PD/SA only.

   Tenant: scoped through the owning product (the table has no tenant_id).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AXES = new Set(["shape", "type", "size", "quality", "thickness", "lifting", "wheels", "wheel_size"]);
const COLS = "id, product_id, axis, value, price_delta_cny, affects_price, is_default, sort_order";

async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  return !!data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id) || !(await tenantOwnsProduct(id, auth.tenant_id))) {
    return NextResponse.json({ options: [] });
  }
  const { data, error } = await supabaseServer
    .from("accessory_option_values")
    .select(COLS)
    .eq("product_id", id)
    .order("axis", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[api/products/[id]/options GET]", error.message);
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 });
  }
  return NextResponse.json(
    { options: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  if (!(await tenantOwnsProduct(id, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { options?: Array<Record<string, unknown>> };
  const incoming = Array.isArray(body.options) ? body.options : [];

  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const rows = incoming
    .filter((r) => AXES.has(r.axis as string) && typeof r.value === "string" && (r.value as string).trim() !== "")
    .map((r, i) => ({
      product_id: id,
      axis: r.axis as string,
      value: (r.value as string).trim(),
      price_delta_cny: num(r.price_delta_cny),
      affects_price: r.affects_price === undefined ? true : !!r.affects_price,
      is_default: !!r.is_default,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : i,
    }));

  const del = await supabaseServer.from("accessory_option_values").delete().eq("product_id", id);
  if (del.error) {
    console.error("[api/products/[id]/options PUT delete]", del.error.message);
    return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  }
  if (rows.length) {
    const ins = await supabaseServer.from("accessory_option_values").insert(rows);
    if (ins.error) {
      console.error("[api/products/[id]/options PUT insert]", ins.error.message);
      return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

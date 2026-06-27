import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   /api/products/[id]/sewing-specs — P0-A.
   GET — the product's legacy sewing-machine template specs (no secrets;
         any authenticated user, same as the catalog page that renders them).
   PUT — upsert { template_slug, common_specs, template_specs } keyed on
         product_id. DELETE — remove the row. Product Data / SA only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("product_sewing_specs")
    .select("*")
    .eq("product_id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  return NextResponse.json({ specs: data ?? null });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  body.product_id = id; // path wins
  const { error } = await supabaseServer
    .from("product_sewing_specs")
    .upsert(body, { onConflict: "product_id" });
  if (error) {
    console.error("[api/products sewing-specs PUT]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "delete");
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from("product_sewing_specs")
    .delete()
    .eq("product_id", id);
  if (error) return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}

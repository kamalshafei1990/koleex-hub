import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/[id]/market-prices — P0-A.
   Market prices are commercial data tied to models/suppliers, so BOTH
   read and write require Product Data access (only the admin form uses
   them today; nothing public renders market prices).
   GET — prices for all models of the product.
   PUT — { upserts?: Row[], deletes?: string[] }; upsert conflict key is
         (model_id, country_code), matching the legacy lib.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gateProductData(id: string) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Market prices require Product Data access." },
      { status: 403 },
    );
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deny = await gateProductData(id);
  if (deny) return deny;

  const mRes = await supabaseServer.from("product_models").select("id").eq("product_id", id);
  if (mRes.error) return NextResponse.json({ error: mRes.error.message }, { status: 500 });
  const modelIds = ((mRes.data ?? []) as { id: string }[]).map((m) => m.id);
  if (!modelIds.length) return NextResponse.json({ prices: [] });

  const { data, error } = await supabaseServer
    .from("product_market_prices")
    .select("*")
    .in("model_id", modelIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prices: data ?? [] });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deny = await gateProductData(id);
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as {
    upserts?: Record<string, unknown>[];
    deletes?: string[];
  };

  const errors: string[] = [];
  for (const p of body.upserts ?? []) {
    const { error } = await supabaseServer
      .from("product_market_prices")
      .upsert(p, { onConflict: "model_id,country_code" });
    if (error) errors.push(error.message);
  }
  for (const delId of body.deletes ?? []) {
    if (!UUID_RE.test(delId)) continue;
    const { error } = await supabaseServer
      .from("product_market_prices")
      .delete()
      .eq("id", delId);
    if (error) errors.push(error.message);
  }

  if (errors.length) {
    console.error("[api/products market-prices PUT]", errors.join("; "));
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

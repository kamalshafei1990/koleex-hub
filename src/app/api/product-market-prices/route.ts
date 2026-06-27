import "server-only";

/* /api/product-market-prices — P0-B flat resource (keyed by model).
   Market prices are commercial data → PD/SA for BOTH read and write.
   GET  ?model_ids=<uuid,…> → rows.
   POST → upsert one row (onConflict model_id,country_code).
   DELETE on /[id]. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function gatePD(action: "view" | "create") {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (action === "view") {
    if (!(await hasProductDataAccess(auth))) {
      return NextResponse.json({ error: "Market prices require Product Data access." }, { status: 403 });
    }
    return null;
  }
  return requireProductDataAction(auth, action);
}

export async function GET(req: Request) {
  const deny = await gatePD("view");
  if (deny) return deny;
  const raw = new URL(req.url).searchParams.get("model_ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  if (!ids.length) return NextResponse.json({ prices: [] });
  const { data, error } = await supabaseServer
    .from("product_market_prices")
    .select("*")
    .in("model_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(req: Request) {
  const deny = await gatePD("create");
  if (deny) return deny;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { error } = await supabaseServer
    .from("product_market_prices")
    .upsert(body, { onConflict: "model_id,country_code" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* /api/product-translations — P0-B flat resource.
   GET  ?product_id=<uuid> → rows. Public catalog text → any authed user.
   POST → upsert one row (onConflict product_id,locale). PD/SA.
   DELETE on /[id]. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const productId = new URL(req.url).searchParams.get("product_id");
  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("product_translations")
    .select("*")
    .eq("product_id", productId);
  if (error) return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  return NextResponse.json({ translations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Only Product Data admins can edit translations." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { error } = await supabaseServer
    .from("product_translations")
    .upsert(body, { onConflict: "product_id,locale" });
  if (error) return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}

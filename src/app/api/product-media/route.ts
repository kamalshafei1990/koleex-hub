import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-media — P0-B flat media-record resource (mirrors
   /api/product-models). Lets the admin lib keep its granular signatures
   while routing off the anon client.

   GET  ?product_id=<uuid>  → flat rows for one product (ordered by "order")
        ?main_images=1      → { product_id: url } map for type='main_image'
        Media has no secret columns → any authenticated user.
   POST                     → create a row (body carries product_id). PD/SA.
   PATCH/DELETE live on /[id].
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);

  if (url.searchParams.get("main_images") === "1") {
    const { data, error } = await supabaseServer
      .from("product_media")
      .select("product_id, url")
      .eq("type", "main_image")
      .order("order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map: Record<string, string> = {};
    for (const row of (data ?? []) as { product_id: string; url: string }[]) {
      if (!map[row.product_id]) map[row.product_id] = row.url;
    }
    return NextResponse.json(
      { mainImages: map },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
    );
  }

  const productId = url.searchParams.get("product_id");
  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "create");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  if (!body.product_id || typeof body.product_id !== "string") {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("product_media")
    .insert(body)
    .select()
    .single();
  if (error) {
    console.error("[api/product-media POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ media: data });
}

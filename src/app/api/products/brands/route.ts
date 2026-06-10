import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/brands — P0-A.
   Brands are derived data: distinct products.brand values + logo files in
   storage. There is no brands table.

   GET    — distinct brand names + per-brand product counts. Any authed user.
   PATCH  — rename a brand across all products: { from, to }. PD / SA only.
   DELETE — clear a brand from all products: { name }. PD / SA only.
   (Logo upload/remove stays on the /api/storage proxy.)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseServer
    .from("products")
    .select("brand")
    .not("brand", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { brand: string | null }[]) {
    const b = (row.brand ?? "").trim();
    if (b) counts[b] = (counts[b] || 0) + 1;
  }
  const brands = Object.keys(counts).sort();
  return NextResponse.json(
    { brands, counts },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

async function gatePD() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit brands." },
      { status: 403 },
    );
  }
  return null;
}

export async function PATCH(req: Request) {
  const deny = await gatePD();
  if (deny) return deny;
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  const from = (body.from ?? "").trim();
  const to = (body.to ?? "").trim();
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });
  const { error } = await supabaseServer
    .from("products")
    .update({ brand: to })
    .eq("brand", from);
  if (error) {
    console.error("[api/products brands PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const deny = await gatePD();
  if (deny) return deny;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const { error } = await supabaseServer
    .from("products")
    .update({ brand: null })
    .eq("brand", name);
  if (error) {
    console.error("[api/products brands DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

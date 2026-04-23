import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/[id]

   GET    — fetch by UUID or slug. Authenticated users all reach it;
            customers + anyone without "Product Data" see the PUBLIC
            column set only.
   PATCH  — update. Requires "Product Data".
   DELETE — remove. Requires "Product Data".
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, PUBLIC_PRODUCT_COLUMNS } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: handle } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const canSeeSecrets = await hasProductDataAccess(auth);
  const cols = canSeeSecrets ? "*" : PUBLIC_PRODUCT_COLUMNS;

  /* Same slug-first-then-UUID lookup as the old anon-client version —
     keeps public URLs (/products/my-machine) working alongside UUID
     links in admin tools. */
  let row: Record<string, unknown> | null = null;

  const { data: bySlug } = await supabaseServer
    .from("products")
    .select(cols)
    .eq("slug", handle)
    .maybeSingle();
  row = (bySlug as Record<string, unknown> | null) ?? null;

  if (!row && UUID_RE.test(handle)) {
    const { data: byId } = await supabaseServer
      .from("products")
      .select(cols)
      .eq("id", handle)
      .maybeSingle();
    row = (byId as Record<string, unknown> | null) ?? null;
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { product: row },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit products." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  /* PATCH accepts either a UUID or a slug; we normalise to UUID
     before updating so the .eq("id", …) can match. */
  const isUuid = UUID_RE.test(id);
  let targetId = id;
  if (!isUuid) {
    const { data: row } = await supabaseServer
      .from("products")
      .select("id")
      .eq("slug", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    targetId = (row as { id: string }).id;
  }

  const { error } = await supabaseServer
    .from("products")
    .update(body)
    .eq("id", targetId);
  if (error) {
    console.error("[api/products/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can delete products." },
      { status: 403 },
    );
  }

  const { error } = await supabaseServer
    .from("products")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/products/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

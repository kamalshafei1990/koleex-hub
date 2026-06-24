import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

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
import { logAudit } from "@/lib/server/audit";
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
    .eq("tenant_id", auth.tenant_id)
    .eq("slug", handle)
    .maybeSingle();
  row = (bySlug as Record<string, unknown> | null) ?? null;

  if (!row && UUID_RE.test(handle)) {
    const { data: byId } = await supabaseServer
      .from("products")
      .select(cols)
      .eq("tenant_id", auth.tenant_id)
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
  const auth = await requireAuth(req);
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
      .eq("tenant_id", auth.tenant_id)
      .eq("slug", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    targetId = (row as { id: string }).id;
  }

  const { error } = await supabaseServer
    .from("products")
    .update(body)
    .eq("tenant_id", auth.tenant_id)
    .eq("id", targetId);
  if (error) {
    console.error("[api/products/[id] PATCH]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }

  // A price/cost touch is a sensitive change; flag it as such for the feed.
  const touchesMoney = Object.keys(body).some((k) => /price|cost/i.test(k));
  await logAudit({
    auth,
    action_type: touchesMoney ? "change_price" : "update",
    entity_type: "product",
    entity_id: targetId,
    entity_label: typeof body.product_name === "string" ? body.product_name : undefined,
    new_values: body,
    severity: touchesMoney ? "warning" : "info",
    module: "Product Data",
    route: "/product-data",
    req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
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
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id);
  if (error) {
    console.error("[api/products/[id] DELETE]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }

  await logAudit({
    auth,
    action_type: "delete",
    entity_type: "product",
    entity_id: id,
    severity: "critical",
    module: "Product Data",
    route: "/product-data",
    req,
  });

  return NextResponse.json({ ok: true });
}

import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   /api/product-models/[id] — P0-A model writes.

   PATCH  — update one model (Product Data / SA only).
   DELETE — delete one model (Product Data / SA only).

   Reads live on /api/product-models (list + summary, secret-stripped).
   Part of the P0 security lockdown: gives the admin UI a server path for
   model writes so direct browser table access can be removed (P0-B) and
   RLS locked to service-role-only (P0-C).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid model id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  const { error } = await supabaseServer
    .from("product_models")
    .update(body)
    .eq("id", id);
  if (error) {
    console.error("[api/product-models PATCH]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
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
  const denied = await requireProductDataAction(auth, "delete");
  if (denied) return denied;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid model id" }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from("product_models")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/product-models DELETE]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

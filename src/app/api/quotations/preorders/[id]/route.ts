import "server-only";

/* Preorder persistence — read / update / delete a single preorder. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const str = (v: unknown, n: number): string | null =>
  typeof v === "string" ? v.slice(0, n) : null;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const { data, error } = await supabaseServer
    .from("quotation_preorders")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/quotations/preorders/[id] GET]", error.message);
    return NextResponse.json({ error: "Read failed." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ preorder: data });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.doc && typeof body.doc === "object" && !Array.isArray(body.doc)) patch.doc = body.doc;
  if ("title" in body) patch.title = str(body.title, 200);
  if ("customer_ar" in body) patch.customer_ar = str(body.customer_ar, 200);
  if ("reference" in body) patch.reference = str(body.reference, 200);
  if ("currency" in body) patch.currency = str(body.currency, 10);
  if ("status" in body) patch.status = str(body.status, 30);

  const { error } = await supabaseServer
    .from("quotation_preorders")
    .update(patch)
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id);
  if (error) {
    console.error("[api/quotations/preorders/[id] PUT]", error.message);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const { error } = await supabaseServer
    .from("quotation_preorders")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id);
  if (error) {
    console.error("[api/quotations/preorders/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

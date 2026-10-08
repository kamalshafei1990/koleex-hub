import "server-only";

/* Preorder persistence — read / update / delete a single preorder. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* Trim, and treat blank as absent — identical to the create route's helper.
   This copy used to keep whitespace and turn "" into "", so a title cleared
   on update was stored differently from one never set on create. */
const str = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

/* Same ceiling as the create route (see DOC_MAX_BYTES there). */
const DOC_MAX_BYTES = 2 * 1024 * 1024;

/* The page never sends `status` today; the list is here so an API caller
   cannot write an arbitrary string into a column the list view filters on. */
const PREORDER_STATUSES = ["draft", "sent", "closed"] as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;
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
  const deny = await requireModuleAction(auth, "Quotations", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  const raw = await req.text().catch(() => "");
  if (raw.length > DOC_MAX_BYTES) {
    return NextResponse.json({ error: "Preorder is too large to save (limit 2 MB)." }, { status: 413 });
  }
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.doc && typeof body.doc === "object" && !Array.isArray(body.doc)) patch.doc = body.doc;
  if ("title" in body) patch.title = str(body.title, 200);
  if ("customer_ar" in body) patch.customer_ar = str(body.customer_ar, 200);
  if ("reference" in body) patch.reference = str(body.reference, 200);
  if ("currency" in body) patch.currency = str(body.currency, 10);
  if ("status" in body) {
    const s = str(body.status, 30);
    if (!s || !(PREORDER_STATUSES as readonly string[]).includes(s)) {
      return NextResponse.json(
        { error: `Unknown status. Expected one of: ${PREORDER_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.status = s;
  }

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
  const deny = await requireModuleAction(auth, "Quotations", "delete");
  if (deny) return deny;
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

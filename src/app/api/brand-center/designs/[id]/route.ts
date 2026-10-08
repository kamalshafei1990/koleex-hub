import "server-only";

/* /api/brand-center/designs/<id>
     PATCH   { name?, kind?, status?, isDefault?, notes? } · "edit".
             Making one design the default clears the others of its item.
     DELETE  retires the design (kept, hidden from readers) · "delete" */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { DESIGN_KIND, DESIGN_STATUS, oneOf, text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function own(tenantId: string, id: string) {
  const { data } = await supabaseServer.from("brand_designs").select("id, item_id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  return data as { id: string; item_id: string } | null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "edit");
  if (deny) return deny;
  const { id } = await params;
  const design = await own(auth.tenant_id, id);
  if (!design) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("name" in body) { const v = text(body.name, 200); if (!v) return NextResponse.json({ error: "name_required" }, { status: 400 }); patch.name = v; }
  if ("notes" in body) patch.notes = text(body.notes, 2000) ?? null;
  if ("kind" in body) { const v = oneOf(body.kind, DESIGN_KIND); if (!v) return NextResponse.json({ error: "bad_kind" }, { status: 400 }); patch.kind = v; }
  if ("status" in body) { const v = oneOf(body.status, DESIGN_STATUS); if (!v) return NextResponse.json({ error: "bad_status" }, { status: 400 }); patch.status = v; }
  if (body.isDefault === true) {
    const { error } = await supabaseServer.from("brand_designs").update({ is_default: false }).eq("item_id", design.item_id).neq("id", id);
    if (error) return NextResponse.json({ error: "Could not save the design." }, { status: 500 });
    patch.is_default = true;
  } else if (body.isDefault === false) patch.is_default = false;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_change" }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  const { error } = await supabaseServer.from("brand_designs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save the design." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "delete");
  if (deny) return deny;
  const { id } = await params;
  const design = await own(auth.tenant_id, id);
  if (!design) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { error } = await supabaseServer.from("brand_designs")
    .update({ status: "retired", is_default: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not retire the design." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import "server-only";

/* /api/brand-center/items/<id>
     GET     the item, its types and options, its designs and their files
             (anyone who may read Brand Center) + canEdit for this reader
     PATCH   { name?, use?, importance?, decision?, status?, note?, ownerNote?, rules? }
             (Brand Center "edit")
     DELETE  retires the item — it leaves the library but nothing is lost
             (Brand Center "delete") */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { DECISION, IMPORTANCE, ITEM_STATUS, loadItem, oneOf, text } from "@/lib/server/brand-center/library";
import { cleanRules } from "@/lib/brand-center/rules";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const { id } = await params;
  try {
    const data = await loadItem(auth.tenant_id, id);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const canEdit = (await brandCenterGate(auth, "edit")) === null;
    return NextResponse.json({ ...data, canEdit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/brand-center/item GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not load the item." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "edit");
  if (deny) return deny;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("name" in body) { const v = text(body.name, 200); if (!v) return NextResponse.json({ error: "name_required" }, { status: 400 }); patch.name = v; }
  if ("use" in body) patch.use_text = text(body.use, 600) ?? null;
  if ("note" in body) patch.note = text(body.note, 2000) ?? null;
  if ("ownerNote" in body) patch.owner_note = text(body.ownerNote, 2000) ?? null;
  /* the item's rules (C19–C39): kept to their shape and sizes */
  if ("rules" in body) { const r = cleanRules(body.rules); if (!r) return NextResponse.json({ error: "bad_rules" }, { status: 400 }); patch.rules = r; }
  for (const [k, list, col] of [["importance", IMPORTANCE, "importance"], ["decision", DECISION, "decision"], ["status", ITEM_STATUS, "status"]] as const) {
    if (k in body) { const v = oneOf(body[k], list); if (!v) return NextResponse.json({ error: `bad_${k}` }, { status: 400 }); patch[col] = v; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_change" }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer.from("brand_items").update(patch)
    .eq("tenant_id", auth.tenant_id).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("[api/brand-center/item PATCH]", error.message);
    return NextResponse.json({ error: "Could not save the item." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "delete");
  if (deny) return deny;
  const { id } = await params;
  const { data, error } = await supabaseServer.from("brand_items")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .eq("tenant_id", auth.tenant_id).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not retire the item." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

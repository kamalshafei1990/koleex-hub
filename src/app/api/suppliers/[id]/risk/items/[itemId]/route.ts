import "server-only";

/* ---------------------------------------------------------------------------
   PATCH  /api/suppliers/[id]/risk/items/[itemId] — edit / resolve / mitigate.
   DELETE /api/suppliers/[id]/risk/items/[itemId] — remove a risk item.

   Resolving a risk (status→resolved) stamps resolved_at and emits a
   risk_resolved timeline event. Tenant + supplier scoped, module gated,
   blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

type Params = { params: Promise<{ id: string; itemId: string }> };

const SEV = new Set(["low", "medium", "high", "critical"]);
const STATUS = new Set(["open", "mitigating", "resolved"]);
const VIS = new Set(["public", "internal", "procurement", "finance", "management"]);

async function guard(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return { auth: null as never, res: auth };
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return { auth: null as never, res: deny };
  return { auth, res: null };
}

export async function PATCH(req: Request, ctx: Params) {
  const { auth, res } = await guard(req);
  if (res) return res;
  const { id, itemId } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if ("description" in body) patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if ("mitigation" in body) patch.mitigation = typeof body.mitigation === "string" && body.mitigation.trim() ? body.mitigation.trim() : null;
  if (typeof body.severity === "string" && SEV.has(body.severity)) patch.severity = body.severity;
  if (typeof body.visibility_tier === "string" && VIS.has(body.visibility_tier)) patch.visibility_tier = body.visibility_tier;
  let resolving = false;
  if (typeof body.status === "string" && STATUS.has(body.status)) {
    patch.status = body.status;
    if (body.status === "resolved") { patch.resolved_at = new Date().toISOString(); resolving = true; }
    else patch.resolved_at = null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabaseServer
    .from("supplier_risk_items")
    .update(patch)
    .eq("id", itemId).eq("tenant_id", tid).eq("supplier_id", id)
    .select("title, visibility_tier")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (resolving && updated) {
    await logSupplierEvent({
      tenant_id: tid, supplier_id: id,
      event_type: "risk_resolved", event_category: "procurement",
      title: `Risk resolved: ${updated.title}`,
      actor_id: auth.account_id ?? null, actor_name: actorName(auth),
      source_module: "suppliers",
      visibility_tier: typeof updated.visibility_tier === "string" ? updated.visibility_tier : "procurement",
      related_entity_id: itemId, related_entity_type: "supplier_risk_items",
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Params) {
  const { auth, res } = await guard(req);
  if (res) return res;
  const { id, itemId } = await ctx.params;
  const tid = auth.tenant_id;

  const { error } = await supabaseServer
    .from("supplier_risk_items")
    .delete()
    .eq("id", itemId).eq("tenant_id", tid).eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

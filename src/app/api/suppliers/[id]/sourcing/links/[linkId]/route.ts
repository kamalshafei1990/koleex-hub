import "server-only";

/* ---------------------------------------------------------------------------
   PATCH  /api/suppliers/[id]/sourcing/links/[linkId] — edit sourcing role/terms.
   DELETE /api/suppliers/[id]/sourcing/links/[linkId] — clear the sourcing role.

   DELETE only nulls the sourcing fields (the underlying component-supply link is
   owned by Product Data and preserved). Tenant + supplier scoped, module gated,
   blocked while viewing-as. Role changes emit a sourcing timeline event.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { logSupplierEvent, actorName, type TimelineEventInput } from "@/lib/suppliers/timeline";
import { sourcingRoleLabel } from "@/lib/suppliers/intelligence";

type Params = { params: Promise<{ id: string; linkId: string }> };
const ROLES = new Set(["preferred", "approved", "backup", "experimental", "blocked"]);
const QUALITY = new Set(["low", "medium", "high"]);

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
  const { id, linkId } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  let roleChanged: string | undefined;
  if ("sourcing_role" in body) {
    if (body.sourcing_role === "" || body.sourcing_role == null) patch.sourcing_role = null;
    else if (typeof body.sourcing_role === "string" && ROLES.has(body.sourcing_role)) { patch.sourcing_role = body.sourcing_role; roleChanged = body.sourcing_role; }
    else return NextResponse.json({ error: "Invalid sourcing_role" }, { status: 400 });
  }
  if ("sourcing_priority" in body) patch.sourcing_priority = body.sourcing_priority === "" || body.sourcing_priority == null ? null : Math.round(Number(body.sourcing_priority));
  if ("lead_time_days" in body) patch.lead_time_days = body.lead_time_days === "" || body.lead_time_days == null ? null : Math.round(Number(body.lead_time_days));
  for (const k of ["target_price", "moq", "risk_notes", "notes"]) {
    if (k in body) patch[k] = typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null;
  }
  if ("quality_level" in body) patch.quality_level = typeof body.quality_level === "string" && QUALITY.has(body.quality_level) ? body.quality_level : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { error } = await supabaseServer.from("supplier_product_links")
    .update(patch).eq("id", linkId).eq("tenant_id", tid).eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (roleChanged) {
    const type = roleChanged === "approved" ? "supplier_approved" : roleChanged === "blocked" ? "supplier_blocked" : roleChanged === "backup" ? "backup_assigned" : "sourcing_role_changed";
    const ev: TimelineEventInput = {
      tenant_id: tid, supplier_id: id, event_type: type, event_category: "procurement",
      title: `Sourcing role set to ${sourcingRoleLabel(roleChanged)}`,
      actor_id: auth.account_id ?? null, actor_name: actorName(auth), source_module: "sourcing",
      visibility_tier: roleChanged === "blocked" ? "management" : "procurement",
      importance: roleChanged === "blocked" ? "high" : "normal",
      related_entity_id: linkId, related_entity_type: "supplier_product_links",
      metadata: { sourcing_role: roleChanged },
    };
    await logSupplierEvent(ev);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Params) {
  const { auth, res } = await guard(req);
  if (res) return res;
  const { id, linkId } = await ctx.params;
  const tid = auth.tenant_id;

  // Clear sourcing fields only — keep the underlying component-supply link.
  const { error } = await supabaseServer.from("supplier_product_links")
    .update({ sourcing_role: null, sourcing_priority: null, target_price: null, quality_level: null, lead_time_days: null, moq: null, risk_notes: null, updated_at: new Date().toISOString() })
    .eq("id", linkId).eq("tenant_id", tid).eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/sourcing/links — assign a product sourcing role.

   Writes a sourcing role + terms onto the EXISTING supplier_product_links
   relationship (one row per supplier+product). Emits a sourcing timeline event
   (supplier_approved / supplier_blocked / backup_assigned / sourcing_role_changed).
   Whitelisted, tenant + supplier scoped, Suppliers-module gated, blocked while
   viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";
import { sourcingRoleLabel } from "@/lib/suppliers/intelligence";

const ROLES = new Set(["preferred", "approved", "backup", "experimental", "blocked"]);
const QUALITY = new Set(["low", "medium", "high"]);

function buildLinkPatch(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (typeof body.sourcing_role === "string" && ROLES.has(body.sourcing_role)) row.sourcing_role = body.sourcing_role;
  if ("sourcing_priority" in body) row.sourcing_priority = body.sourcing_priority === "" || body.sourcing_priority == null ? null : Math.round(Number(body.sourcing_priority));
  if ("lead_time_days" in body) row.lead_time_days = body.lead_time_days === "" || body.lead_time_days == null ? null : Math.round(Number(body.lead_time_days));
  for (const k of ["target_price", "moq", "capacity", "capacity_unit", "risk_notes", "notes"]) {
    if (k in body) row[k] = typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null;
  }
  if ("quality_level" in body) row.quality_level = typeof body.quality_level === "string" && QUALITY.has(body.quality_level) ? body.quality_level : null;
  return row;
}

async function emitRoleEvent(tid: string, id: string, role: string | undefined, productLabel: string, auth: { account_id: string | null; username: string; login_email: string }) {
  if (!role) return;
  const type = role === "approved" ? "supplier_approved" : role === "blocked" ? "supplier_blocked" : role === "backup" ? "backup_assigned" : "sourcing_role_changed";
  await logSupplierEvent({
    tenant_id: tid, supplier_id: id,
    event_type: type, event_category: "procurement",
    title: `${sourcingRoleLabel(role)} for ${productLabel}`,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth as never),
    source_module: "sourcing",
    visibility_tier: role === "blocked" ? "management" : "procurement",
    importance: role === "blocked" ? "high" : "normal",
    related_entity_type: "supplier_product_links",
    metadata: { sourcing_role: role },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "create");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const productId = typeof body.product_id === "string" ? body.product_id : "";
  if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  if (typeof body.sourcing_role !== "string" || !ROLES.has(body.sourcing_role)) {
    return NextResponse.json({ error: "Invalid sourcing_role" }, { status: 400 });
  }

  // Verify supplier + product belong to this tenant.
  const [{ data: sup }, { data: prod }] = await Promise.all([
    supabaseServer.from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle(),
    supabaseServer.from("products").select("id, product_name").eq("id", productId).eq("tenant_id", tid).maybeSingle(),
  ]);
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  if (!prod) return NextResponse.json({ error: "Product not found" }, { status: 400 });

  // One link row per supplier+product: update if present, else insert.
  const { data: existing } = await supabaseServer
    .from("supplier_product_links").select("id")
    .eq("tenant_id", tid).eq("supplier_id", id).eq("product_id", productId).maybeSingle();

  const patch = buildLinkPatch(body);
  patch.updated_at = new Date().toISOString();

  let linkId = existing?.id ?? null;
  if (existing) {
    const { error } = await supabaseServer.from("supplier_product_links").update(patch).eq("id", existing.id).eq("tenant_id", tid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await supabaseServer.from("supplier_product_links")
      .insert({ tenant_id: tid, supplier_id: id, product_id: productId, ...patch })
      .select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    linkId = data?.id ?? null;
  }

  await emitRoleEvent(tid, id, body.sourcing_role, String((prod as { product_name?: string }).product_name ?? "a product"), auth);

  return NextResponse.json({ ok: true, id: linkId });
}

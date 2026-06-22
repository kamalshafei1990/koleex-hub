import "server-only";

/* ===========================================================================
   PATCH  /api/inventory/warehouses/[id]   limited update + default management
   DELETE /api/inventory/warehouses/[id]   archive (refused while stock > 0)

   INV-H2 Scope 7 — Warehouse guards:
     · cannot archive while qty_on_hand > 0 at the warehouse
     · cannot drop default flag if this is the only active warehouse
     · changing default doesn't rewrite historical movements
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  guardWarehouseArchivable,
  guardWarehouseDefaultRemoval,
} from "@/lib/inventory/discipline";
import { logInventoryAudit } from "@/lib/inventory/audit";

const MODULE = "Inventory";

const PATCHABLE = new Set([
  "name", "location", "is_default", "is_active",
  "contact_person", "contact_phone", "address", "notes",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const patch = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!patch) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE.has(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "No patchable fields supplied" }, { status: 400 });
  }

  /* Default-flag transition guard. */
  if ("is_default" in filtered) {
    const guard = await guardWarehouseDefaultRemoval({
      tenant_id: auth.tenant_id,
      warehouse_id: id,
      next_is_default: filtered.is_default === true,
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error, code: guard.code }, { status: 422 });
    }
    /* Promoting another to default? Demote everyone else first. */
    if (filtered.is_default === true) {
      await supabaseServer
        .from("inventory_warehouses")
        .update({ is_default: false })
        .eq("tenant_id", auth.tenant_id)
        .neq("id", id);
    }
  }

  /* Soft-archive via is_active=false — block when stock > 0. */
  if (filtered.is_active === false) {
    const guard = await guardWarehouseArchivable({
      tenant_id: auth.tenant_id,
      warehouse_id: id,
    });
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: guard.ok ? "warehouse_archive_attempt" : "warehouse_archive_blocked",
      entity_type: "warehouse",
      entity_id: id,
      metadata: { reason: guard.code ?? null, result: guard.ok ? "allowed" : "blocked" },
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error, code: guard.code }, { status: 422 });
    }
  }

  const { data, error } = await supabaseServer
    .from("inventory_warehouses")
    .update(filtered)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ warehouse: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "delete");
  if (deny) return deny;

  /* Both archivability + only-default guard must pass. */
  const stockGuard = await guardWarehouseArchivable({
    tenant_id: auth.tenant_id,
    warehouse_id: id,
  });
  await logInventoryAudit({
    tenant_id: auth.tenant_id,
    actor_id: auth.account_id,
    action: stockGuard.ok ? "warehouse_archive_attempt" : "warehouse_archive_blocked",
    entity_type: "warehouse",
    entity_id: id,
    metadata: { result: stockGuard.ok ? "allowed" : "blocked", reason: stockGuard.code ?? null },
  });
  if (!stockGuard.ok) {
    return NextResponse.json({ error: stockGuard.error, code: stockGuard.code }, { status: 422 });
  }
  const defaultGuard = await guardWarehouseDefaultRemoval({
    tenant_id: auth.tenant_id,
    warehouse_id: id,
    next_is_default: false,
  });
  if (!defaultGuard.ok) {
    return NextResponse.json({ error: defaultGuard.error, code: defaultGuard.code }, { status: 422 });
  }

  const { error } = await supabaseServer
    .from("inventory_warehouses")
    .update({ deleted_at: new Date().toISOString(), is_active: false, is_default: false })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

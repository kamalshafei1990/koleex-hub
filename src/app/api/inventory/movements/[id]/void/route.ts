import "server-only";

/* ===========================================================================
   POST /api/inventory/movements/[id]/void
   Void a posted movement via a reversing entry.

   INV-H2 Scope 5 — Void discipline:
     · void_reason (>= 3 chars) is mandatory
     · caller must be super_admin OR have can_void_movements
     · for system-generated movements (source_type set) voided directly
       from this endpoint (i.e. NOT from the source document), the API
       returns ok=true but attaches a warning telling the user to void
       from the source document next time
     · idempotent: already-voided returns ok=true
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { voidInventoryMovement } from "@/lib/inventory/posting";
import { supabaseServer } from "@/lib/server/supabase-server";
import { guardMovementVoid } from "@/lib/inventory/discipline";
import { loadInventoryPermissions } from "@/lib/inventory/permissions";
import { logInventoryAudit } from "@/lib/inventory/audit";
import type { MovementType } from "@/lib/inventory/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as
    | { reason?: string; from_source_document?: boolean }
    | null;
  const reason = (body?.reason ?? "").trim();
  const fromSourceDocument = body?.from_source_document === true;

  const { data: row } = await supabaseServer
    .from("inventory_stock_movements")
    .select("movement_type, source_type, source_id, status, metadata")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const m = row as {
    movement_type: MovementType;
    source_type: string | null;
    source_id: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
  } | null;

  if (!m) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const perms = await loadInventoryPermissions(auth);
  const guard = guardMovementVoid({
    movement_type: m.movement_type,
    source_type: m.source_type,
    source_id: m.source_id,
    status: m.status,
    void_reason: reason,
    is_super_admin: auth.is_super_admin,
    can_void: perms.can_void,
    from_source_document: fromSourceDocument,
  });

  if (!guard.ok) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "restricted_action_blocked",
      entity_type: "movement",
      entity_id: id,
      metadata: { reason: guard.code ?? "void_blocked" },
    });
    return NextResponse.json(
      { ok: false, error: guard.error, code: guard.code },
      { status: guard.code === "INV_H2_VOID_PERMISSION_DENIED" ? 403 : 422 },
    );
  }

  /* Block if a posted journal entry already references this movement.
     For now we surface the warning only — finance posting is a future
     phase. */
  const accountingEntryId =
    typeof m.metadata?.accounting_entry_id === "string"
      ? (m.metadata.accounting_entry_id as string)
      : null;

  if (guard.warn) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "movement_void_warning",
      entity_type: "movement",
      entity_id: id,
      metadata: {
        warning: guard.warning,
        source_type: m.source_type,
        accounting_entry_id: accountingEntryId,
      },
    });
  }

  const r = await voidInventoryMovement(
    id,
    auth.tenant_id,
    auth.account_id,
    reason,
  );
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 409 });

  return NextResponse.json({
    ...r,
    warning: guard.warning ?? null,
    accounting_entry_id: accountingEntryId,
  });
}

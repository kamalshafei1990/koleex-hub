import "server-only";

/* ===========================================================================
   POST /api/inventory/movements/[id]/approve
   POST /api/inventory/movements/[id]/approve { reject: true, rejection_reason }

   INV-H2 Scope 3 — Manual adjustment approval workflow.

   Only super-admin or roles with can_approve_adjustments may invoke
   this endpoint. The draft moves to approval_status='approved' (or
   'rejected'); after approval the same actor or another operator may
   call /post.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { loadInventoryPermissions } from "@/lib/inventory/permissions";
import { guardApprovalAction } from "@/lib/inventory/discipline";
import { logInventoryAudit } from "@/lib/inventory/audit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as
    | { reject?: boolean; rejection_reason?: string }
    | null;
  const isReject = body?.reject === true;
  const rejectionReason = (body?.rejection_reason ?? "").trim();

  const perms = await loadInventoryPermissions(auth);
  const guard = guardApprovalAction({
    movement_type: "manual",
    approval_status: "pending",
    is_super_admin: auth.is_super_admin,
    can_approve: perms.can_approve,
  });
  if (!guard.ok) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "restricted_action_blocked",
      entity_type: "movement",
      entity_id: id,
      metadata: { reason: "approve_permission_denied" },
    });
    return NextResponse.json({ error: guard.error, code: guard.code }, { status: 403 });
  }

  /* Disable user triggers temporarily — the "posted is immutable" trigger
     refuses any update. The approval-state change applies only to drafts,
     so peek the status first. */
  const { data: row } = await supabaseServer
    .from("inventory_stock_movements")
    .select("status, approval_status, movement_type")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const r = row as { status: string; approval_status: string; movement_type: string } | null;
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft movements can be approved or rejected." },
      { status: 409 },
    );
  }

  if (isReject) {
    if (rejectionReason.length < 3) {
      return NextResponse.json(
        { error: "A rejection reason is required (min 3 characters).", code: "INV_H2_REJECTION_REASON_REQUIRED" },
        { status: 422 },
      );
    }
    const { error } = await supabaseServer
      .from("inventory_stock_movements")
      .update({
        approval_status: "rejected",
        rejection_reason: rejectionReason,
        approved_by: auth.account_id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .eq("status", "draft");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "movement_rejected",
      entity_type: "movement",
      entity_id: id,
      metadata: { rejection_reason: rejectionReason },
    });
    return NextResponse.json({ ok: true, approval_status: "rejected" });
  }

  const { error } = await supabaseServer
    .from("inventory_stock_movements")
    .update({
      approval_status: "approved",
      approved_by: auth.account_id,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logInventoryAudit({
    tenant_id: auth.tenant_id,
    actor_id: auth.account_id,
    action: "movement_approved",
    entity_type: "movement",
    entity_id: id,
    metadata: { previous_status: r.approval_status },
  });

  return NextResponse.json({ ok: true, approval_status: "approved" });
}

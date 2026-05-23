import "server-only";

/* ===========================================================================
   POST /api/inventory/movements/[id]/post
   Promote a draft movement to posted.

   INV-H2 — Posting is blocked when the draft requires approval and
   approval_status != 'approved'. Super-admins and roles with
   can_approve_adjustments may also call /approve first; this route
   never approves on the caller's behalf.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { postInventoryMovement } from "@/lib/inventory/posting";
import { supabaseServer } from "@/lib/server/supabase-server";
import { guardPostingApproval } from "@/lib/inventory/discipline";
import { logInventoryAudit } from "@/lib/inventory/audit";
import type { MovementType } from "@/lib/inventory/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  /* INV-H2 — Approval gate (route layer). Loading the draft once here
     lets us emit a precise error code and audit entry. The library
     enforces the same rule for any non-route caller. */
  const { data: draft } = await supabaseServer
    .from("inventory_stock_movements")
    .select("movement_type, approval_status, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const d = draft as { movement_type: MovementType; approval_status: string; status: string } | null;
  if (d && d.status === "draft") {
    const g = guardPostingApproval({
      movement_type: d.movement_type,
      approval_status: d.approval_status ?? "not_required",
      is_super_admin: auth.is_super_admin,
      can_approve: false, // post != approve; SA already short-circuits inside the guard
    });
    if (!g.ok && !auth.is_super_admin) {
      await logInventoryAudit({
        tenant_id: auth.tenant_id,
        actor_id: auth.account_id,
        action: "restricted_action_blocked",
        entity_type: "movement",
        entity_id: id,
        metadata: { reason: g.code ?? "approval_required" },
      });
      return NextResponse.json({ ok: false, error: g.error, code: g.code }, { status: 409 });
    }
  }

  const r = await postInventoryMovement(id, auth.tenant_id, auth.account_id);
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 409 });
  return NextResponse.json(r);
}

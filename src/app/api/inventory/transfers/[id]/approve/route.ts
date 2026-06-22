import "server-only";

/* POST /api/inventory/transfers/[id]/approve — pending → approved.
   Requires super-admin OR can_approve_adjustments (re-uses inventory perms). */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { transitionTransfer } from "@/lib/inventory/transfers";
import { loadInventoryPermissions } from "@/lib/inventory/permissions";
import { logInventoryAudit } from "@/lib/inventory/audit";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const perms = await loadInventoryPermissions(auth);
  if (!auth.is_super_admin && !perms.can_approve) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "restricted_action_blocked",
      entity_type: "transfer" as never,
      entity_id: id,
      metadata: { reason: "approve_transfer_permission_denied" },
    });
    return NextResponse.json(
      { error: "You don't have permission to approve transfers." },
      { status: 403 },
    );
  }

  const r = await transitionTransfer(auth.tenant_id, id, "approved", auth.account_id);
  if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Approve failed.") }, { status: 422 });
  return NextResponse.json({ transfer: r.transfer });
}

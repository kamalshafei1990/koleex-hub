import "server-only";

/* POST /api/inventory/returns/[id]/void — received/shipped/completed → voided.
   Reverses every posted movement attached to the return. Requires
   super-admin OR can_void_movements. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { voidReturn } from "@/lib/inventory/returns";
import { loadInventoryPermissions } from "@/lib/inventory/permissions";
import { logInventoryAudit } from "@/lib/inventory/audit";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const perms = await loadInventoryPermissions(auth);
  if (!auth.is_super_admin && !perms.can_void) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "restricted_action_blocked",
      entity_type: "return" as never,
      entity_id: id,
      metadata: { reason: "void_return_permission_denied" },
    });
    return NextResponse.json(
      { error: "You don't have permission to void returns." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const r = await voidReturn(auth.tenant_id, id, auth.account_id, body?.reason ?? "");
  if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Void failed.") }, { status: 422 });
  return NextResponse.json({ ok: true });
}

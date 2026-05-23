import "server-only";

/* POST /api/inventory/returns/[id]/cancel — draft/pending/approved → cancelled.
   For after-receive/ship cleanup, use /void. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { transitionReturn } from "@/lib/inventory/returns";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const r = await transitionReturn(auth.tenant_id, id, "cancelled", auth.account_id);
  if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Cancel failed.") }, { status: 422 });
  return NextResponse.json({ return: r.return_ });
}

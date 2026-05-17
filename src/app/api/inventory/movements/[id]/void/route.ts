import "server-only";

/* ===========================================================================
   POST /api/inventory/movements/[id]/void
   Void a posted movement via a reversing entry. Idempotent.
   Body: { reason?: string }
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { voidInventoryMovement } from "@/lib/inventory/posting";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const r = await voidInventoryMovement(
    id,
    auth.tenant_id,
    auth.account_id,
    body?.reason ?? null,
  );
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 409 });
  return NextResponse.json(r);
}

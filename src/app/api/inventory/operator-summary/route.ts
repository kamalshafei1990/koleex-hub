import "server-only";

/* ===========================================================================
   GET /api/inventory/operator-summary
   INV-H5A — operator-first dashboard payload (alerts + today + intel).
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildInventoryOperatorSummary } from "@/lib/inventory/queries";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const summary = await buildInventoryOperatorSummary(auth.tenant_id);
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

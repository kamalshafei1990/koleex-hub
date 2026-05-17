import "server-only";

/* ===========================================================================
   GET /api/finance/setup/status — onboarding snapshot per card.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildSetupSnapshot } from "@/lib/finance/onboarding";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  try {
    const snapshot = await buildSetupSnapshot(auth.tenant_id);
    return NextResponse.json({ snapshot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

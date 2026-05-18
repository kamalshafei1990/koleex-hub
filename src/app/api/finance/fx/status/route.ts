import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildFxStatus } from "@/lib/finance/fx-status";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const status = await buildFxStatus(auth.tenant_id);
  return NextResponse.json({ status });
}

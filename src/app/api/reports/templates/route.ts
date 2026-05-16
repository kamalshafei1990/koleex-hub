import "server-only";

/* ===========================================================================
   GET /api/reports/templates
   Returns the descriptor for every report the operator is allowed
   to generate. Authn-gated to Finance module — anyone without Finance
   sees an empty list (so the picker on /finance/reports renders
   nothing rather than a 403).
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listReportTemplates } from "@/lib/reports/registry";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  return NextResponse.json({ templates: listReportTemplates() });
}

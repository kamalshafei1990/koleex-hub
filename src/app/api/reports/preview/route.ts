import "server-only";

/* ===========================================================================
   POST /api/reports/preview
   Body: { type: ReportType, filters: ReportFilters }
   Returns: { payload: ReportPayload } — pure data, no audit row.

   The /finance/reports UI calls this on every filter change so the
   operator sees the report take shape live. To avoid filling the
   audit table with every keystroke, this route passes skipAudit=true
   to the builder. Audit rows are only written when the operator
   actually clicks "Print" or "Download PDF".
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { buildAndAudit } from "@/lib/reports/build";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

interface Body {
  type?: ReportType;
  filters?: ReportFilters;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const res = await buildAndAudit({
    auth,
    type: body.type,
    filters: body.filters ?? {},
    channel: "preview",
    skipAudit: true,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({ payload: res.result.payload });
}

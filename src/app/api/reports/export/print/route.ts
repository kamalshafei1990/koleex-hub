import "server-only";

/* ===========================================================================
   POST /api/reports/export/print
   Body: { type: ReportType, filters: ReportFilters }
   Returns: { export_id }

   The browser then opens /finance/reports/[export_id]/print which
   renders the report fresh and auto-fires window.print(). The export
   row records the print event for audit; the actual rendering uses
   the same builder + renderer as the PDF route, so what the user
   prints matches the audit row exactly.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildAndAudit } from "@/lib/reports/build";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

interface Body {
  type?: ReportType;
  filters?: ReportFilters;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const res = await buildAndAudit({
    auth,
    type: body.type,
    filters: body.filters ?? {},
    channel: "print",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({
    export_id: res.result.exportId,
    report_no: res.result.payload.meta.report_no,
  });
}

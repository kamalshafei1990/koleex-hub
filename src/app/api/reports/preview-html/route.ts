import "server-only";

/* ===========================================================================
   POST /api/reports/preview-html
   Body: { type: ReportType, filters: ReportFilters }
   Returns: text/html — the rendered report document.

   Single source of truth for the in-app preview. Same renderer, same
   document chrome, same enterprise table — operators see the
   document exactly as it will look when downloaded or printed.

   Skips audit logging (preview only). Authn-gated to Finance.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildAndAudit } from "@/lib/reports/build";
import { renderReportHtml } from "@/lib/reports/html-renderer";
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
    channel: "preview",
    skipAudit: true,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const html = renderReportHtml(res.result.payload, { autoPrint: false });
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

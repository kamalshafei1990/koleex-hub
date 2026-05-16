import "server-only";

/* ===========================================================================
   GET /api/reports/exports/[id]/html
   Returns the rendered HTML for a previously-recorded export. Used by
   the in-app print page — fetches the export row, re-builds the report
   from its filters (so the data is fresh), and returns the renderer's
   HTML output.

   Tenant scoping is enforced: the route only returns an export owned
   by the caller's tenant. Cross-tenant lookups 404.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { renderReportHtml } from "@/lib/reports/html-renderer";
import { buildAndAudit } from "@/lib/reports/build";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { id } = await ctx.params;

  const { data } = await supabaseServer
    .from("finance_report_exports")
    .select("id, tenant_id, report_type, filters, channel")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = data as { id: string; tenant_id: string; report_type: ReportType; filters: ReportFilters; channel: string };

  /* Rebuild fresh — this is intentional. The audit row remembers what
     was asked; the print page renders the live answer. The previous
     audit row stays; we don't add a second one (skipAudit). */
  const built = await buildAndAudit({
    auth,
    type: row.report_type,
    filters: row.filters,
    channel: "print",
    skipAudit: true,
  });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

  const autoPrint = (new URL(req.url).searchParams.get("auto") ?? "0") === "1";
  const html = renderReportHtml(built.result.payload, { autoPrint });
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

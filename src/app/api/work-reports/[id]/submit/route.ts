import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/submit — the author sends a draft.

   Refused while a required section is empty or nobody is in "To". Sending a
   new version retires the one it replaces (superseded), so a reader always
   lands on the latest. The claim is conditional (status = draft), so a double
   click sends once. Its numbers blocks (Phase 4B) are computed here, by the
   server, and frozen into the report: every reader sees what was true when
   it was sent.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { missingSections, normalizeSections, reportLinks, reportTemplate } from "@/lib/reports/templates";
import { syncReportLinks } from "@/lib/server/reports/links";
import { REPORT_COLS, listPeople, loadForViewer, requireReportsUser, type ReportRow } from "@/lib/server/reports/core";
import { notifyReportSubmitted } from "@/lib/server/reports/notify";
import { markRequestSent } from "@/lib/server/reports/events";
import { loadReportData } from "@/lib/server/reports/report-data";
import { withBlockData } from "@/lib/reports/report-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { row, recipients } = loaded;
  if (row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const tpl = reportTemplate(row.template_key);
  if (!tpl) return NextResponse.json({ error: "unknown_template" }, { status: 400 });

  const typed = normalizeSections(tpl, row.sections);
  const missing = missingSections(tpl, typed);
  if (missing.length) return NextResponse.json({ error: "missing_sections", missing }, { status: 400 });
  if (tpl.customTitle && !row.title.trim()) return NextResponse.json({ error: "missing_title" }, { status: 400 });
  if (!recipients.some((r) => r.role === "to")) return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  const sections = withBlockData(typed, await loadReportData(row, auth));

  const now = new Date().toISOString();
  const { data: sent, error } = await supabaseServer.from("work_reports")
    .update({ status: "submitted", submitted_at: now, updated_at: now, sections })
    .eq("id", row.id).eq("status", "draft").select(REPORT_COLS).maybeSingle();
  if (error) {
    console.error("[api/work-reports submit]", error.message);
    return NextResponse.json({ error: "Could not send the report." }, { status: 500 });
  }
  if (!sent) return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const report = sent as ReportRow;

  if (report.previous_id) {
    await supabaseServer.from("work_reports").update({ superseded: true, updated_at: now })
      .eq("id", report.previous_id).eq("author_account_id", auth.account_id);
  }
  /* Written for what an event asked (Phase 3D): the request is now sent.
     And the records it is about (4A), rewritten whole on send. */
  await Promise.all([
    markRequestSent(report.period_key, report.id, auth.account_id, now),
    syncReportLinks(report.id, report.tenant_id, null, reportLinks(sections)),
  ]);

  const people = await listPeople(auth.tenant_id);
  const authorName = people.find((p) => p.id === auth.account_id)?.name ?? "A colleague";
  const ids = recipients.map((r) => r.account_id);
  after(() => notifyReportSubmitted(report, ids, authorName));
  return NextResponse.json({ ok: true, submittedAt: now });
}

import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/decision — a reader answers a report.

   { action: "acknowledge" }            any recipient: "seen, fine"
   { action: "approve", note? }         a "To" recipient, when the type needs
   { action: "return",  note }          a review and the report is open.
   Approve/return claim the report (status = submitted) so two reviewers
   cannot both decide; the decision lands in the thread as a comment and the
   author is told.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { REPORT_LIMITS } from "@/lib/reports/templates";
import { REPORT_COLS, loadForViewer, requireReportsUser, type ReportRow } from "@/lib/server/reports/core";
import { notifyReportDecided } from "@/lib/server/reports/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { row, recipients } = loaded;
  const me = auth.account_id;
  const mine = recipients.find((r) => r.account_id === me);
  if (!mine || row.author_account_id === me || row.status === "draft") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { action?: unknown; note?: unknown } | null;
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, REPORT_LIMITS.comment) : "";
  const now = new Date().toISOString();

  if (action === "acknowledge") {
    await supabaseServer.from("work_report_recipients").update({ acknowledged_at: now, read_at: mine.read_at ?? now })
      .eq("report_id", row.id).eq("account_id", me).is("acknowledged_at", null);
    return NextResponse.json({ ok: true, acknowledgedAt: now });
  }

  if (action !== "approve" && action !== "return") return NextResponse.json({ error: "bad_action" }, { status: 400 });
  if (!row.review_required || mine.role !== "to" || row.superseded) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (action === "return" && note.length < 3) return NextResponse.json({ error: "note_required" }, { status: 400 });

  const status = action === "approve" ? "approved" : "returned";
  const { data: claimed, error } = await supabaseServer.from("work_reports")
    .update({ status, decided_at: now, decided_by: me, updated_at: now })
    .eq("id", row.id).eq("status", "submitted").select(REPORT_COLS).maybeSingle();
  if (error) {
    console.error("[api/work-reports decision]", error.message);
    return NextResponse.json({ error: "Could not save the decision." }, { status: 500 });
  }
  if (!claimed) return NextResponse.json({ error: "already_decided" }, { status: 409 });

  await supabaseServer.from("work_report_comments").insert({
    /* The decision itself is the kind; the body is only what the reviewer
       wrote (empty on a plain approval), so nothing prints twice. */
    report_id: row.id, account_id: me, kind: status, body: note,
  });
  await supabaseServer.from("work_report_recipients").update({ acknowledged_at: now })
    .eq("report_id", row.id).eq("account_id", me).is("acknowledged_at", null);
  after(() => notifyReportDecided(claimed as ReportRow, status, me, note || null));
  return NextResponse.json({ ok: true, status });
}

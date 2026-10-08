import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/comments { body } — anyone who may read a sent
   report may comment on it. The author and every recipient hear about it
   (never the commenter).
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { REPORT_LIMITS } from "@/lib/reports/templates";
import { listPeople, loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { notifyReportComment } from "@/lib/server/reports/notify";

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
  if (row.status === "draft") return NextResponse.json({ error: "not_sent" }, { status: 409 });

  const body = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, REPORT_LIMITS.comment) : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const { data, error } = await supabaseServer.from("work_report_comments")
    .insert({ report_id: row.id, account_id: auth.account_id, body: text, kind: "comment" })
    .select("id, created_at").single();
  if (error || !data) {
    console.error("[api/work-reports comments]", error?.message);
    return NextResponse.json({ error: "Could not add the comment." }, { status: 500 });
  }
  const people = await listPeople(auth.tenant_id);
  const me = people.find((p) => p.id === auth.account_id);
  const participants = Array.from(new Set([row.author_account_id, ...recipients.map((r) => r.account_id)])).filter((x) => x !== auth.account_id);
  after(() => notifyReportComment(row, participants, auth.account_id, me?.name ?? "A colleague", text));
  const c = data as { id: string; created_at: string };
  return NextResponse.json({
    comment: { id: c.id, author: { id: auth.account_id, name: me?.name ?? "—", nameAlt: me?.nameAlt ?? null, avatar: me?.avatar ?? null }, body: text, kind: "comment", createdAt: c.created_at },
  }, { status: 201 });
}

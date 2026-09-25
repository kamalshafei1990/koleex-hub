import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/revise — the author edits a SENT report as a
   new version (owner decision 4). The new draft copies the text, the
   recipients, the photos and files (the same stored objects) and the
   settings, and points at the one it replaces; that one
   stays exactly as it was read until the new version is sent. Asking twice
   returns the same open draft.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { copyAttachments } from "@/lib/server/reports/attachments";

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
  if (row.status === "draft" || row.superseded) return NextResponse.json({ error: "not_revisable" }, { status: 409 });

  const { data: open } = await supabaseServer.from("work_reports").select("id")
    .eq("previous_id", row.id).eq("status", "draft").limit(1).maybeSingle();
  if (open) return NextResponse.json({ id: (open as { id: string }).id, existing: true });

  const { data: created, error } = await supabaseServer.from("work_reports").insert({
    tenant_id: row.tenant_id, template_key: row.template_key, author_account_id: row.author_account_id, title: row.title,
    period_start: row.period_start, period_end: row.period_end, period_key: row.period_key, sections: row.sections,
    status: "draft", confidential: row.confidential, review_required: row.review_required,
    version: row.version + 1, previous_id: row.id,
  }).select("id").single();
  if (error || !created) {
    console.error("[api/work-reports revise]", error?.message);
    return NextResponse.json({ error: "Could not start a new version." }, { status: 500 });
  }
  const newId = (created as { id: string }).id;
  await Promise.all([
    recipients.length
      ? supabaseServer.from("work_report_recipients").insert(recipients.map((r) => ({ report_id: newId, account_id: r.account_id, role: r.role })))
      : Promise.resolve(null),
    copyAttachments(row.id, newId),
  ]);
  return NextResponse.json({ id: newId, existing: false }, { status: 201 });
}

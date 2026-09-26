import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/tasks — a To-do task from a report
   (Phase 6A, owner's picks 27 Sep 2026)

   { title?, people: [accountId…], due?: "YYYY-MM-DD", priority?,
     line?: { section, item }, share?: boolean }

   Anyone who can read a sent report and may create To-do tasks turns a
   line of it (`line` — the title defaults to the line's words) or anything
   they write into a task for someone. The task is To-do's own: its
   assignment notice, its approval loop, its scope — and it says which
   report it came from (source 'report'). From a confidential report a task
   goes only to someone who can already read it, unless its author makes
   it. `share` also forwards the report to an assignee who cannot read it
   yet, where this viewer may forward it.

   → { id, shared: [accountId…] }. The report page reloads itself to show
   the task in place.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { isUuid, loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { makeReportTask } from "@/lib/server/reports/follow-up";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ERRORS = {
  forbidden: 403, bad_line: 400, bad_title: 400, bad_people: 400, people_not_allowed: 403,
} as const;

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const loaded = await loadForViewer(id, auth);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  try {
    const done = await makeReportTask(auth, loaded, body);
    if (typeof done === "string") return NextResponse.json({ error: done }, { status: ERRORS[done] });
    return NextResponse.json(done, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/work-reports tasks]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

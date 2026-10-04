import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/forward — { people: [accountId…], note? }
   (Phase 6A, owner's picks 27 Sep 2026)

   Someone who can read the report sends it on: each new person becomes a
   copy reader (reads, comments, acknowledges — never approves or returns)
   and is told, with the note. A confidential report is forwarded by its
   author only; a draft or a replaced version never. Known staff only; the
   author and people already on it are skipped.

   → { recipients } as GET /api/work-reports/[id] shows them.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { isUuid, listPeople, loadForViewer, loadRecipients, requireReportsUser, toClientRecipient } from "@/lib/server/reports/core";
import { forwardReport } from "@/lib/server/reports/follow-up";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const loaded = await loadForViewer(id, auth);
  if (!loaded) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { people?: unknown; note?: unknown } | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  try {
    const done = await forwardReport(auth, loaded, body);
    if (done === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (done === "nobody") return NextResponse.json({ error: "nobody" }, { status: 400 });
    if (done === "full") return NextResponse.json({ error: "too_many_readers" }, { status: 400 });
    const [recipients, people] = await Promise.all([loadRecipients(id), listPeople(auth.tenant_id)]);
    const nameOf = new Map(people.map((p) => [p.id, p]));
    const person = (pid: string) => ({ id: pid, name: nameOf.get(pid)?.name ?? "—", nameAlt: nameOf.get(pid)?.nameAlt ?? null, avatar: nameOf.get(pid)?.avatar ?? null });
    return NextResponse.json({ recipients: recipients.map((r) => toClientRecipient(r, person)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/work-reports forward]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

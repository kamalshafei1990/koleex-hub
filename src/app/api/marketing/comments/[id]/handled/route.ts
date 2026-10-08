import "server-only";

/* POST /api/marketing/comments/[id]/handled — «No reply needed» for the
   comment's thread, or back on the list: { handled: boolean }. "edit" on the
   account's space. A newer comment in the thread brings it back anyway. */

import { NextResponse } from "next/server";
import { isError, setThreadHandled } from "@/lib/server/marketing/comments";
import { gateComment } from "@/lib/server/marketing/comment-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateComment(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const body = (await req.json().catch(() => ({}))) as { handled?: unknown };
    if (typeof body.handled !== "boolean") return NextResponse.json({ error: "Say whether it needs a reply." }, { status: 400 });
    const r = await setThreadHandled(g.auth.tenant_id, g.comment.id, body.handled, g.auth.account_id);
    if (isError(r)) return NextResponse.json({ error: r.error, code: r.code ?? null }, { status: r.status });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/marketing/comments/handled]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not change the comment." }, { status: 500 });
  }
}

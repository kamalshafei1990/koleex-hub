import "server-only";

/* POST /api/marketing/posts/[id]/schedule — a scheduled post, by an approver:
   { version, scheduled_at: "<ISO>" } moves it to another time;
   { version, scheduled_at: null } publishes it now instead (60 s at most).
   The author hears either after the response (marketing/notify). */

import { after, NextResponse } from "next/server";
import { isError, publishScheduledNow, reschedulePost } from "@/lib/server/marketing/posts";
import { publishPost } from "@/lib/server/marketing/publish";
import { notifyPostDecided } from "@/lib/server/marketing/notify";
import { gatePost, notApprover, readVersion, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (!g.approver) return notApprover();
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    if (typeof v.body.scheduled_at === "string") {
      const moved = await reschedulePost(g.auth.tenant_id, id, v.version, v.body.scheduled_at);
      if (!isError(moved)) after(() => notifyPostDecided(g.auth, id, "scheduled"));
      return reply(moved);
    }
    const now = await publishScheduledNow(g.auth.tenant_id, id, v.version, g.auth.account_id);
    if (isError(now)) return reply(now);
    after(() => notifyPostDecided(g.auth, id, "approved"));
    const out = await publishPost(g.auth.tenant_id, id, { budgetMs: 45_000, actorId: g.auth.account_id });
    return NextResponse.json({ version: now.version, status: out.status, busy: out.busy });
  } catch (e) {
    console.error("[api/marketing/posts/schedule]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not change the schedule." }, { status: 500 });
  }
}

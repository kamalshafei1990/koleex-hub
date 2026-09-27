import "server-only";

/* POST /api/marketing/posts/[id]/unschedule — take a scheduled post off the
   schedule: back to draft, to be edited and approved again. { version }.
   Approvers only. */

import { NextResponse } from "next/server";
import { unschedulePost } from "@/lib/server/marketing/posts";
import { gatePost, notApprover, readVersion, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (!g.approver) return notApprover();
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    return reply(await unschedulePost(g.auth.tenant_id, id, v.version));
  } catch (e) {
    console.error("[api/marketing/posts/unschedule]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not change the schedule." }, { status: 500 });
  }
}

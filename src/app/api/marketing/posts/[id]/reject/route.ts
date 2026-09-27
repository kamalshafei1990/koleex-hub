import "server-only";

/* POST /api/marketing/posts/[id]/reject — send a post in review back to its
   author with what should change: { version, note }. Approvers only. */

import { NextResponse } from "next/server";
import { rejectPost } from "@/lib/server/marketing/posts";
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
    const note = typeof v.body.note === "string" ? v.body.note : "";
    return reply(await rejectPost(g.auth.tenant_id, id, v.version, g.auth.account_id, note));
  } catch (e) {
    console.error("[api/marketing/posts/reject]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not send the post back." }, { status: 500 });
  }
}

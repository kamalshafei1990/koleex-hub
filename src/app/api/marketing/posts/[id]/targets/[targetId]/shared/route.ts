import "server-only";

/* POST /api/marketing/posts/[id]/targets/[targetId]/shared — a person shared
   an approved post on a hand-shared account (WeChat, WhatsApp, Douyin). "edit". */

import { NextResponse } from "next/server";
import { markShared } from "@/lib/server/marketing/publish";
import { gatePost } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string; targetId: string }> }) {
  const { id, targetId } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (!UUID_RE.test(targetId)) return NextResponse.json({ error: "Invalid account." }, { status: 400 });
    const out = await markShared(g.auth.tenant_id, id, targetId, g.auth.account_id);
    if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (e) {
    console.error("[api/marketing/posts/shared]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not mark it as shared." }, { status: 500 });
  }
}

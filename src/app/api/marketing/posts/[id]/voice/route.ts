import "server-only";

/* GET /api/marketing/posts/[id]/voice — a five-minute link to a CEO Brand
   capture's recording (kept in the PRIVATE bucket marketing-voice), for
   whoever may view the post ("view" on its space). 404 when it has none. */

import { NextResponse } from "next/server";
import { captureOf, voiceLink } from "@/lib/server/marketing/capture";
import { gatePost } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(null, id, "view");
    if (g instanceof NextResponse) return g;
    const capture = await captureOf(g.auth.tenant_id, id);
    const url = await voiceLink(capture?.audio_path, g.auth.tenant_id);
    if (!url) return NextResponse.json({ error: "This post has no recording." }, { status: 404 });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts/voice]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not open the recording." }, { status: 500 });
  }
}

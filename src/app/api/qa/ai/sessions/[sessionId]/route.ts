import "server-only";

/* GET /api/qa/ai/sessions/[sessionId] — fetch one stored AI session by id
   (admin-only, tenant-scoped). No AI call here. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getAiSession } from "@/lib/qa/ai/analyze";

export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { sessionId } = await ctx.params;
  const session = await getAiSession(auth.tenant_id, sessionId);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ session }, { headers: { "Cache-Control": "private, no-store" } });
}

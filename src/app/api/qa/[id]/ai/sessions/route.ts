import "server-only";

/* GET /api/qa/[id]/ai/sessions — list stored AI analysis sessions for an
   issue (admin-only, tenant-scoped, newest first). No AI call here. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { listAiSessions } from "@/lib/qa/ai/analyze";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const sessions = await listAiSessions(auth.tenant_id, id);
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
}

import "server-only";

/* POST /api/qa/[id]/investigation/regenerate — force-rebuild analysis (admin). */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { loadOrGenerateInvestigation } from "@/lib/qa/investigation-engine";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const investigation = await loadOrGenerateInvestigation(auth.tenant_id, id, { force: true });
  if (!investigation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ investigation });
}

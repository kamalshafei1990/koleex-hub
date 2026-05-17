import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getTraceability, type DocKind } from "@/lib/traceability";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { kind, id } = await ctx.params;
  const allowed: DocKind[] = ["so", "po", "invoice", "bill"];
  if (!allowed.includes(kind as DocKind)) {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }
  try {
    const trace = await getTraceability(auth.tenant_id, kind as DocKind, id);
    return NextResponse.json({ trace });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
  }
}

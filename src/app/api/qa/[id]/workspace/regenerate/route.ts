import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/[id]/workspace/regenerate — force-rebuild the Debug Workspace.

   Admin-only. Re-runs the deterministic aggregation, overwrites the cache, and
   returns the freshly-signed payload.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aggregateWorkspace, persistWorkspace, buildWorkspacePayload } from "@/lib/qa/debug-workspace";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const data = await aggregateWorkspace(auth.tenant_id, id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await persistWorkspace(auth.tenant_id, id, auth.account_id, data);
  const workspace = await buildWorkspacePayload(auth.tenant_id, data);
  return NextResponse.json({ workspace, cached: false });
}

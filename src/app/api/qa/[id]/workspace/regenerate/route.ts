import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/[id]/workspace/regenerate — force-rebuild the Debug Workspace.

   Admin-only. Re-runs the deterministic aggregation + investigation, overwrites
   both caches, and returns the freshly-signed payload.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { aggregateWorkspace, persistWorkspace, buildWorkspacePayload } from "@/lib/qa/debug-workspace";
import { loadOrGenerateInvestigation, renderInvestigationPromptSection } from "@/lib/qa/investigation-engine";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const data = await aggregateWorkspace(auth.tenant_id, id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await persistWorkspace(auth.tenant_id, id, auth.account_id, data);
  const { data: wsRow } = await supabaseServer
    .from("qa_debug_workspaces").select("id").eq("tenant_id", auth.tenant_id).eq("issue_id", id).maybeSingle();

  const base = await buildWorkspacePayload(auth.tenant_id, data);
  // Regenerating the workspace also refreshes the investigation.
  const investigation = await loadOrGenerateInvestigation(auth.tenant_id, id, { force: true, workspaceId: (wsRow as { id: string } | null)?.id ?? null });
  if (investigation) base.generated_prompt = `${base.generated_prompt}\n\n${renderInvestigationPromptSection(investigation)}`;

  return NextResponse.json({ workspace: { ...base, investigation }, cached: false });
}

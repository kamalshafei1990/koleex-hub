import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/qa/[id]/workspace — Claude Debug Workspace (Phase 6).

   Admin-only. Compute-on-read + cache: returns the cached workspace if present,
   otherwise generates it once and stores it. Attachment URLs are signed fresh
   on every read and the prompt is re-rendered with those live URLs (the cache
   stores only stable storage paths).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  aggregateWorkspace, dataFromRow, persistWorkspace, buildWorkspacePayload,
} from "@/lib/qa/debug-workspace";
import { loadOrGenerateInvestigation, renderInvestigationPromptSection } from "@/lib/qa/investigation-engine";

/* Attach the deterministic investigation to a workspace payload: append its
   section to the Claude prompt and expose it on the payload for the UI tab. */
async function withInvestigation(tenantId: string, issueId: string, workspaceId: string | null, workspace: Awaited<ReturnType<typeof buildWorkspacePayload>>) {
  const investigation = await loadOrGenerateInvestigation(tenantId, issueId, { workspaceId });
  if (investigation) {
    workspace.generated_prompt = `${workspace.generated_prompt}\n\n${renderInvestigationPromptSection(investigation)}`;
  }
  return { ...workspace, investigation };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;

  // Existing cached workspace?
  const { data: cached } = await supabaseServer
    .from("qa_debug_workspaces").select("*").eq("tenant_id", auth.tenant_id).eq("issue_id", id).maybeSingle();

  if (cached) {
    const row = cached as Record<string, unknown>;
    void supabaseServer.from("qa_debug_workspaces")
      .update({ last_opened_at: new Date().toISOString() }).eq("id", row.id as string);
    const base = await buildWorkspacePayload(auth.tenant_id, dataFromRow(row), {
      created_at: row.created_at as string, updated_at: row.updated_at as string, generation_version: row.generation_version as string,
    });
    const workspace = await withInvestigation(auth.tenant_id, id, row.id as string, base);
    return NextResponse.json({ workspace, cached: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Generate + cache on first read.
  const data = await aggregateWorkspace(auth.tenant_id, id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await persistWorkspace(auth.tenant_id, id, auth.account_id, data);
  const { data: wsRow } = await supabaseServer
    .from("qa_debug_workspaces").select("id").eq("tenant_id", auth.tenant_id).eq("issue_id", id).maybeSingle();
  const base = await buildWorkspacePayload(auth.tenant_id, data);
  const workspace = await withInvestigation(auth.tenant_id, id, (wsRow as { id: string } | null)?.id ?? null, base);
  return NextResponse.json({ workspace, cached: false }, { headers: { "Cache-Control": "private, no-store" } });
}

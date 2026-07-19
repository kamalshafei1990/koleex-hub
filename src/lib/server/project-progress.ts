import "server-only";

/* ---------------------------------------------------------------------------
   project-progress — keeps projects.progress_pct in sync with task reality.
   Called fire-and-forget after any task insert / status change / delete:
   pct = done / (all non-cancelled). Projects with zero tasks keep whatever
   manual value they had (so the field still works as a hand-set estimate
   until the first task exists). Never throws.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export async function recomputeProjectProgress(
  tenantId: string,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;
  try {
    const { data } = await supabaseServer
      .from("project_tasks")
      .select("status")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .neq("status", "cancelled")
      .limit(2000);
    const rows = (data ?? []) as { status: string }[];
    if (rows.length === 0) return;
    const done = rows.filter((r) => r.status === "done").length;
    const pct = Math.round((done / rows.length) * 100);
    await supabaseServer
      .from("projects")
      .update({ progress_pct: pct })
      .eq("id", projectId)
      .eq("tenant_id", tenantId);
  } catch (e) {
    console.error("[project-progress]", e);
  }
}

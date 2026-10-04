import "server-only";

/* ---------------------------------------------------------------------------
   project-progress — keeps projects.progress_pct in sync with task reality.
   Called (via after()) following any task insert / status change / delete.
   The rule lives in src/lib/project-progress.ts so the card and Reporting
   compute the identical number: top-level, non-cancelled tasks; 0 when
   there are none. Two HEAD count queries — no rows are downloaded.
   Never throws.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { progressPct } from "@/lib/project-progress";

export async function recomputeProjectProgress(
  tenantId: string,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;
  try {
    const base = () =>
      supabaseServer
        .from("project_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .is("parent_task_id", null);
    const [totalRes, doneRes] = await Promise.all([
      base().neq("status", "cancelled"),
      base().eq("status", "done"),
    ]);
    if (totalRes.error || doneRes.error) {
      console.error("[project-progress]", totalRes.error?.message ?? doneRes.error?.message);
      return;
    }
    const pct = progressPct(doneRes.count ?? 0, totalRes.count ?? 0);
    const { error } = await supabaseServer
      .from("projects")
      .update({ progress_pct: pct })
      .eq("id", projectId)
      .eq("tenant_id", tenantId);
    if (error) console.error("[project-progress]", error.message);
  } catch (e) {
    console.error("[project-progress]", e);
  }
}

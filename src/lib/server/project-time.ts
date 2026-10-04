import "server-only";

/* ---------------------------------------------------------------------------
   project-time — the ONE writer of project_tasks.logged_hours.

   logged_hours is DERIVED: the sum of the task's project_time_entries,
   converted from the table's `minutes` column to hours (2 dp). The Planning
   write-back inserts time-entry rows and recomputes with this same formula,
   so both paths always agree. The task form no longer edits the value and
   the task PATCH whitelist no longer accepts it.

   Awaited, never `void`: a Supabase query builder is lazy and only runs when
   awaited/then'd, so the old `void supabaseServer.from(...).update(...)`
   never executed at all.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export async function recomputeLoggedHours(tenantId: string, taskId: string): Promise<number | null> {
  const { data, error } = await supabaseServer
    .from("project_time_entries")
    .select("minutes")
    .eq("tenant_id", tenantId)
    .eq("task_id", taskId);
  if (error) {
    console.error("[project-time] sum:", error.message);
    return null;
  }
  const minutes = (data ?? []).reduce((s, r) => s + (Number((r as { minutes: number }).minutes) || 0), 0);
  const hours = Math.round((minutes / 60) * 100) / 100;
  const { error: upErr } = await supabaseServer
    .from("project_tasks")
    .update({ logged_hours: hours })
    .eq("id", taskId)
    .eq("tenant_id", tenantId);
  if (upErr) {
    console.error("[project-time] update:", upErr.message);
    return null;
  }
  return hours;
}

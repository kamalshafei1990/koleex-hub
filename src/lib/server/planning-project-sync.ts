import "server-only";

/* ---------------------------------------------------------------------------
   planning-project-sync — completing a planning item that a project task
   is linked to (project_tasks.linked_planning_item_id) logs its hours on
   that task.

   It used to add straight onto project_tasks.logged_hours. Two bugs:
     · Projects' time routes RECOMPUTE logged_hours as the sum of
       project_time_entries, so the next manual time entry silently wiped
       every hour Planning had added;
     · completed → draft → completed added the hours a second time.

   Now the hours are a real project_time_entries row keyed by
   planning_item_id (unique where not null — see
   supabase/migrations/20260925_planning_audit.sql), and logged_hours is
   recomputed from the entries exactly the way Projects does it:
     · on completion: insert the row once (skip when it already exists);
     · on un-completion: delete it;
     · then logged_hours = round(sum(minutes) / 60, 2).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { recomputeLoggedHours as recomputeProjectLoggedHours } from "@/lib/server/project-time";

interface ItemLike {
  id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  allocated_hours: number | null;
  resource_id: string | null;
}

async function linkedTask(tenantId: string, itemId: string): Promise<{ id: string; project_id: string } | null> {
  const { data } = await supabaseServer
    .from("project_tasks")
    .select("id, project_id")
    .eq("tenant_id", tenantId)
    .eq("linked_planning_item_id", itemId)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; project_id: string } | null) ?? null;
}

/* One writer of logged_hours for both apps (lib/server/project-time), so the
   Planning and Projects formulas cannot drift apart. */
async function recomputeLoggedHours(tenantId: string, taskId: string): Promise<void> {
  if ((await recomputeProjectLoggedHours(tenantId, taskId)) === null) {
    throw new Error("logged_hours recompute failed");
  }
}

/** Item just became completed → one time entry on the linked task. */
export async function logPlanningHoursOnTask(
  auth: { account_id: string; tenant_id: string },
  item: ItemLike,
): Promise<void> {
  try {
    const task = await linkedTask(auth.tenant_id, item.id);
    if (!task) return;

    const spanH = (new Date(item.end_at).getTime() - new Date(item.start_at).getTime()) / 3_600_000;
    const hours = item.allocated_hours ?? Math.round(spanH * 10) / 10;
    const minutes = Math.round((Number(hours) || 0) * 60);
    if (minutes <= 0) return;

    const { data: existing, error: exErr } = await supabaseServer
      .from("project_time_entries")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("planning_item_id", item.id)
      .limit(1);
    if (exErr) throw new Error(exErr.message);

    if (!existing || existing.length === 0) {
      /* The worker is the account behind the item's resource; fall back to
         whoever completed it (rooms, vehicles, open shifts). */
      let accountId = auth.account_id;
      if (item.resource_id) {
        const { data: res } = await supabaseServer
          .from("planning_resources")
          .select("account_id")
          .eq("id", item.resource_id)
          .eq("tenant_id", auth.tenant_id)
          .maybeSingle();
        const a = (res as { account_id: string | null } | null)?.account_id;
        if (a) accountId = a;
      }
      const { error } = await supabaseServer.from("project_time_entries").insert({
        tenant_id: auth.tenant_id,
        project_id: task.project_id,
        task_id: task.id,
        account_id: accountId,
        minutes,
        entry_date: item.start_at.slice(0, 10),
        note: `Planning: ${(item.title || "").slice(0, 480)}`.trim(),
        planning_item_id: item.id,
      });
      /* 23505 = the unique index caught a concurrent completion — fine. */
      if (error && error.code !== "23505") throw new Error(error.message);
    }

    await recomputeLoggedHours(auth.tenant_id, task.id);
  } catch (e) {
    console.error("[planning-project-sync] log:", e instanceof Error ? e.message : e);
  }
}

/** Item left the completed state → remove its time entry again. */
export async function unlogPlanningHoursOnTask(
  auth: { tenant_id: string },
  itemId: string,
): Promise<void> {
  try {
    const task = await linkedTask(auth.tenant_id, itemId);
    const { error } = await supabaseServer
      .from("project_time_entries")
      .delete()
      .eq("tenant_id", auth.tenant_id)
      .eq("planning_item_id", itemId);
    if (error) throw new Error(error.message);
    if (task) await recomputeLoggedHours(auth.tenant_id, task.id);
  } catch (e) {
    console.error("[planning-project-sync] unlog:", e instanceof Error ? e.message : e);
  }
}

import "server-only";

/* Phase C — recurring to-do engine.

   A recurring task is created like any other task, but with `recurrence` set
   to 'daily' | 'weekly' | 'monthly'. That first row IS the template AND its own
   first occurrence. On each cron tick this engine looks at every active
   template and, if we have rolled into a new period since the template was
   created (and no instance yet exists for the current period), spawns a fresh
   copy of the task for that period — carrying the same assignees, priority and
   assignment metadata. Spawned instances have recurrence=null (they are plain
   tasks) and point back to the template via recurrence_parent_id.

   Dedup is guaranteed at the DB level by the partial unique index
   uq_koleex_todos_recurrence_instance (recurrence_parent_id, recurrence_spawned_for),
   so even concurrent cron runs cannot double-spawn. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

type Cadence = "daily" | "weekly" | "monthly";

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  label: string | null;
  recurrence: Cadence;
  recurrence_until: string | null;
  created_at: string;
  start_date: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  assigned_department: string | null;
  assign_to_all: boolean;
  is_private: boolean;
  tenant_id: string;
  metadata: Record<string, unknown> | null;
}

/* Return the period-start date (UTC, YYYY-MM-DD) that `d` falls into for the
   given cadence. Daily = that day; weekly = Monday of that ISO week; monthly =
   the 1st of that month. */
function periodStart(d: Date, cadence: Cadence): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  let dt: Date;
  if (cadence === "daily") {
    dt = new Date(Date.UTC(y, m, day));
  } else if (cadence === "weekly") {
    // getUTCDay: 0=Sun..6=Sat → shift so Monday is the week start.
    const dow = d.getUTCDay();
    const backToMonday = (dow + 6) % 7;
    dt = new Date(Date.UTC(y, m, day - backToMonday));
  } else {
    dt = new Date(Date.UTC(y, m, 1));
  }
  return dt.toISOString().slice(0, 10);
}

/* End-of-period date (inclusive) used as the spawned task's due_date, so the
   assignee has until the end of the day/week/month to finish it. */
function periodDue(startIso: string, cadence: Cadence): string {
  const [y, m, d] = startIso.split("-").map(Number);
  let end: Date;
  if (cadence === "daily") {
    end = new Date(Date.UTC(y, m - 1, d, 23, 59, 0));
  } else if (cadence === "weekly") {
    end = new Date(Date.UTC(y, m - 1, d + 6, 23, 59, 0));
  } else {
    // last day of the month
    end = new Date(Date.UTC(y, m, 0, 23, 59, 0));
  }
  return end.toISOString();
}

export async function spawnDueRecurringTodos(now: Date = new Date()): Promise<number> {
  const { data: rows, error } = await supabaseServer
    .from("koleex_todos")
    .select(
      "id, title, description, priority, label, recurrence, recurrence_until, created_at, start_date, created_by_account_id, assigned_by_account_id, assigned_department, assign_to_all, is_private, tenant_id, metadata",
    )
    .not("recurrence", "is", null)
    .limit(500);

  if (error) {
    console.error("[todo-recurrence] fetch templates:", error.message);
    return 0;
  }
  const templates = (rows ?? []) as TemplateRow[];
  if (templates.length === 0) return 0;

  const todayKey = now.toISOString().slice(0, 10);
  let spawned = 0;

  for (const t of templates) {
    const cadence = t.recurrence;

    // Respect an optional end date.
    if (t.recurrence_until && todayKey > t.recurrence_until) continue;

    const currentStart = periodStart(now, cadence);
    // The template covers the period it was created in — anchor off start_date
    // if present, otherwise created_at.
    const anchor = t.start_date ? new Date(t.start_date + "T00:00:00Z") : new Date(t.created_at);
    const templateStart = periodStart(anchor, cadence);

    // Only spawn for periods strictly after the template's own period.
    if (currentStart <= templateStart) continue;

    // Insert the instance. The unique index makes this idempotent: a second
    // run for the same period fails silently on conflict.
    const { data: inserted, error: insErr } = await supabaseServer
      .from("koleex_todos")
      .insert({
        title: t.title,
        description: t.description,
        completed: false,
        status: "todo",
        priority: t.priority,
        label: t.label,
        due_date: periodDue(currentStart, cadence),
        created_by_account_id: t.created_by_account_id,
        assigned_by_account_id: t.assigned_by_account_id,
        assigned_department: t.assigned_department,
        assign_to_all: t.assign_to_all,
        is_private: t.is_private,
        tenant_id: t.tenant_id,
        source: "manual",
        recurrence: null,
        recurrence_parent_id: t.id,
        recurrence_spawned_for: currentStart,
        metadata: t.metadata && typeof t.metadata === "object" ? t.metadata : {},
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      // 23505 = unique_violation → an instance for this period already exists.
      if (insErr.code !== "23505") {
        console.error("[todo-recurrence] insert:", insErr.message);
      }
      continue;
    }
    if (!inserted) continue;
    const newId = (inserted as { id: string }).id;

    // Carry over the template's assignees.
    const { data: assignees } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("account_id")
      .eq("todo_id", t.id);
    const assigneeIds = (assignees ?? [])
      .map((a) => (a as { account_id: string }).account_id)
      .filter(Boolean);
    if (assigneeIds.length > 0) {
      await supabaseServer
        .from("koleex_todo_assignees")
        .insert(assigneeIds.map((account_id) => ({ todo_id: newId, account_id })));
    }

    // Notify everyone who needs to act on today's recurring task.
    const recipients = Array.from(
      new Set(
        [...assigneeIds, t.created_by_account_id].filter(Boolean) as string[],
      ),
    );
    if (recipients.length > 0) {
      await supabaseServer.from("inbox_messages").insert(
        recipients.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: null,
          category: "task",
          subject: `🔁 ${t.title}`,
          body: t.description || t.title,
          link: `/todo?task=${newId}`,
          metadata: { type: "todo_recurring", todo_id: newId, cadence },
        })),
      );
      await sendPushToAccounts(recipients, {
        title: `🔁 ${t.title}`,
        body: t.description || "Recurring task",
        url: `/todo?task=${newId}`,
        tag: `todo-recurring-${newId}`,
      }).catch((e) => console.error("[todo-recurrence] push:", e));
    }

    spawned += 1;
  }

  return spawned;
}

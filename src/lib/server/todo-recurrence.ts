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

   Each tick reads which current periods already exist (one query) and
   inserts only the missing ones; the partial unique index
   uq_koleex_todos_recurrence_instance (recurrence_parent_id,
   recurrence_spawned_for) still guarantees that overlapping cron runs
   cannot double-spawn. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { prepareTpl } from "@/lib/notification-templates";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { pingTodosChanged } from "@/lib/server/todo-notify";
import { ESCALATION_MARK } from "@/lib/server/todo-escalation";
import { TENANT_UTC_OFFSET_HOURS, tenantDateKey } from "@/lib/todo-series";

type Cadence = "daily" | "weekly" | "monthly";

/* Period math runs on the business clock (lib/todo-series.ts: Asia/Shanghai,
   a fixed UTC+8 with no DST), not UTC — keyed to UTC, a "daily" task did not
   start its next run until 08:00 local. */
function toTenantClock(d: Date): Date {
  return new Date(d.getTime() + TENANT_UTC_OFFSET_HOURS * 3600_000);
}

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

/* Return the period-start date (tenant-local, YYYY-MM-DD) that `d` falls into
   for the given cadence. Daily = that day; weekly = Monday of that ISO week;
   monthly = the 1st of that month. */
function periodStart(instant: Date, cadence: Cadence): string {
  const d = toTenantClock(instant);
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

/* End-of-period instant (inclusive) used as the spawned task's due_date, so
   the assignee has until the end of the local day/week/month to finish it.
   23:59 tenant-local, expressed back in UTC (so daily = 15:59Z). */
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
  return new Date(end.getTime() - TENANT_UTC_OFFSET_HOURS * 3600_000).toISOString();
}

const TEMPLATE_COLS =
  "id, title, description, priority, label, recurrence, recurrence_until, created_at, start_date, created_by_account_id, assigned_by_account_id, assigned_department, assign_to_all, is_private, tenant_id, metadata";

/* A period starts clean. The template's metadata carries its PEOPLE and its
   REFERENCES (observers, mentions, attachments, products, project, the
   checklist's items) into each period — never its STATE:
     · the overdue stamp (ESCALATION_MARK, and any other private `__` key) —
       copied, it silenced escalation for every future period;
     · a send-back reason (`rejection`) and any approval notes;
     · ticked checklist items — copied, tomorrow's list arrived done.
   Approval and completion live in columns, which the insert sets fresh. */
function periodMetadata(meta: Record<string, unknown> | null): Record<string, unknown> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k.startsWith("__") || k === ESCALATION_MARK) continue;
    if (k === "rejection" || k === "approval" || k === "completion") continue;
    out[k] = v;
  }
  if (Array.isArray(out.checklist)) {
    out.checklist = (out.checklist as unknown[]).map((c) =>
      c && typeof c === "object" ? { ...(c as Record<string, unknown>), done: false } : c,
    );
  }
  return out;
}

/** Every active template, paged in a stable order — the old unordered
 *  `.limit(500)` left any template past the 500th never spawning. Templates
 *  whose end date has passed are excluded in the query. */
async function loadActiveTemplates(todayKey: string): Promise<TemplateRow[]> {
  const out: TemplateRow[] = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseServer
      .from("koleex_todos")
      .select(TEMPLATE_COLS)
      .not("recurrence", "is", null)
      .or(`recurrence_until.is.null,recurrence_until.gte.${todayKey}`)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[todo-recurrence] fetch templates:", error.message);
      break;
    }
    const page = (data ?? []) as TemplateRow[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

export async function spawnDueRecurringTodos(now: Date = new Date()): Promise<number> {
  // Local calendar date — recurrence_until means "through this day in China".
  const todayKey = tenantDateKey(now);
  const templates = await loadActiveTemplates(todayKey);
  if (templates.length === 0) return 0;

  /* Templates that have rolled into a NEW period — strictly after the
     template's own, which it covers itself (anchored on start_date, else
     created_at). */
  const candidates: Array<{ t: TemplateRow; period: string }> = [];
  for (const t of templates) {
    const cadence = t.recurrence;
    if (cadence !== "daily" && cadence !== "weekly" && cadence !== "monthly") continue;
    const anchor = t.start_date ? new Date(`${t.start_date.slice(0, 10)}T00:00:00Z`) : new Date(t.created_at);
    if (Number.isNaN(anchor.getTime())) continue;
    const currentStart = periodStart(now, cadence);
    if (currentStart <= periodStart(anchor, cadence)) continue;
    candidates.push({ t, period: currentStart });
  }
  if (candidates.length === 0) return 0;

  /* ONE read of which of those periods already exist, instead of an insert
     per template per tick that the unique index rejected. The index still
     guards two overlapping ticks (the loser's insert fails with 23505). */
  const existing = new Set<string>();
  const periods = Array.from(new Set(candidates.map((c) => c.period)));
  for (let i = 0; i < candidates.length; i += 200) {
    const { data, error } = await supabaseServer
      .from("koleex_todos")
      .select("recurrence_parent_id, recurrence_spawned_for")
      .in("recurrence_parent_id", candidates.slice(i, i + 200).map((c) => c.t.id))
      .in("recurrence_spawned_for", periods);
    if (error) {
      console.error("[todo-recurrence] existing periods:", error.message);
      return 0;
    }
    ((data ?? []) as Array<{ recurrence_parent_id: string; recurrence_spawned_for: string }>)
      .forEach((r) => existing.add(`${r.recurrence_parent_id}|${r.recurrence_spawned_for}`));
  }
  const toSpawn = candidates.filter((c) => !existing.has(`${c.t.id}|${c.period}`));
  if (toSpawn.length === 0) return 0;

  // The templates' assignees, in one round trip per 200.
  const assigneesOf = new Map<string, string[]>();
  for (let i = 0; i < toSpawn.length; i += 200) {
    const { data } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id, account_id")
      .in("todo_id", toSpawn.slice(i, i + 200).map((c) => c.t.id));
    ((data ?? []) as Array<{ todo_id: string; account_id: string }>).forEach((r) => {
      const arr = assigneesOf.get(r.todo_id) ?? [];
      arr.push(r.account_id);
      assigneesOf.set(r.todo_id, arr);
    });
  }

  let spawned = 0;
  const touchedTenants = new Set<string>();
  for (const { t, period: currentStart } of toSpawn) {
    const cadence = t.recurrence;
    const { data: inserted, error: insErr } = await supabaseServer
      .from("koleex_todos")
      .insert({
        title: t.title,
        description: t.description,
        completed: false,
        status: "todo",
        approval_state: null,
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
        metadata: periodMetadata(t.metadata),
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      // 23505 = unique_violation → an overlapping tick spawned it first.
      if (insErr.code !== "23505") console.error("[todo-recurrence] insert:", insErr.message);
      continue;
    }
    if (!inserted) continue;
    const newId = (inserted as { id: string }).id;

    // Carry over the template's assignees.
    const assigneeIds = assigneesOf.get(t.id) ?? [];
    if (assigneeIds.length > 0) {
      const { error: asgErr } = await supabaseServer
        .from("koleex_todo_assignees")
        .insert(assigneeIds.map((account_id) => ({ todo_id: newId, account_id })));
      if (asgErr) console.error("[todo-recurrence] assignees:", asgErr.message);
    }

    // Notify everyone who needs to act on this period's task.
    const recipients = Array.from(
      new Set([...assigneeIds, t.created_by_account_id].filter(Boolean) as string[]),
    );
    if (recipients.length > 0) {
      /* SUPERSEDE, don't stack: this period's notification REPLACES an
         unread older copy of the same recurring task's (one per day,
         forever, was the biggest source of a flooded panel). A copy the
         user already read is history and stays. */
      const text = prepareTpl({ k: "todo_recurring", p: { title: t.title } });
      await supersedeUnread({ recipients, category: "task", subject: text.subject });
      const { error: inboxErr } = await supabaseServer.from("inbox_messages").insert(
        recipients.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: null,
          tenant_id: t.tenant_id,
          category: "task",
          subject: text.subject,
          body: t.description || t.title,
          link: `/todo?task=${newId}`,
          metadata: { type: "todo_recurring", todo_id: newId, cadence, ...(text.tpl ? { tpl: text.tpl } : {}) },
        })),
      );
      if (inboxErr) console.error("[todo-recurrence] inbox:", inboxErr.message);
      await emitPings(recipients.map((rid) => ({ topic: rtTopic.inbox(rid) })));
      await sendPushToAccounts(recipients, {
        title: text.subject,
        body: t.description || t.title,
        url: `/todo?task=${newId}`,
        tag: `todo-recurring-${newId}`,
        kind: "todo_recurring",
        tpl: text.tpl,
      }).catch((e) => console.error("[todo-recurrence] push:", e));
    }

    /* ── The spawn cleans up after itself ─────────────────────────────────
       An untouched superseded period — still 'todo', never completed, never
       sent to approval, no notes — carries nothing the new period doesn't,
       so it is DELETED the moment it becomes dead (owner sign-off
       2026-08-27: this data is disposable). Assignee rows go with it via FK
       cascade; its inbox rows were superseded above.

       NEVER the template: every row here has recurrence_parent_id = t.id.
       The untouched state is re-checked INSIDE the delete, so a period
       someone started on between the read and the delete survives. A note
       added in that gap is the one case the delete cannot see (notes are
       another table); the window is milliseconds. */
    try {
      const { data: deadCandidates } = await supabaseServer
        .from("koleex_todos")
        .select("id")
        .eq("recurrence_parent_id", t.id)
        .neq("id", newId)
        .eq("status", "todo")
        .eq("completed", false)
        .is("approval_state", null);
      const deadIds = (deadCandidates ?? []).map((d) => (d as { id: string }).id);
      if (deadIds.length) {
        const { data: noted } = await supabaseServer
          .from("koleex_todo_notes")
          .select("todo_id")
          .in("todo_id", deadIds);
        const keep = new Set((noted ?? []).map((n) => (n as { todo_id: string }).todo_id));
        const purge = deadIds.filter((id) => !keep.has(id));
        if (purge.length) {
          const { error: delErr } = await supabaseServer
            .from("koleex_todos")
            .delete()
            .in("id", purge)
            .eq("recurrence_parent_id", t.id)
            .eq("status", "todo")
            .eq("completed", false)
            .is("approval_state", null);
          if (delErr) console.error("[todo-recurrence] purge:", delErr.message);
        }
      }
    } catch (e) {
      /* Best-effort: a failed purge must never fail the spawn. */
      console.error("[todo-recurrence] purge superseded periods:", e instanceof Error ? e.message : e);
    }

    spawned += 1;
    touchedTenants.add(t.tenant_id);
  }

  // One realtime ping per tenant, not one per spawned task.
  await Promise.all(Array.from(touchedTenants).map((tid) => pingTodosChanged(tid)));
  return spawned;
}

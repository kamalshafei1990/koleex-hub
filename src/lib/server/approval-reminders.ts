import "server-only";

/* ---------------------------------------------------------------------------
   approval-reminders — a request that has waited a day on its approver comes
   back to them; one that has waited three days reaches the Super Admins.

   Owner, 26/09: "لو طلب موافقة فضل مستني أكتر من ٢٤ ساعة، اللي عليه الموافقة
   ياخد تذكير مرة واحدة في اليوم … لو عدّى ٣ أيام، الـ Super Admin يتبلّغ".

   Run hourly (/api/cron/approval-reminders). For every live request row of
   the types below:

   · STILL WAITING? Asked of the request itself, never of the notification:
     a row the approver read and then decided in the app stays unarchived
     (the lifecycle verbs clear UNREAD copies only), so "not archived" is not
     "not decided". A request no longer waiting whose row is still unread is
     archived here (a missing clearer, healed); a read one is left alone.
   · REMINDED once it has sat REMIND_AFTER_H since it last reached the
     approver, inside their working hours (their calendar's zone): the SAME
     row comes back to the top as new (lib/server/inbox-resurface), and a
     push says it is still waiting since the day it was first sent.
   · ESCALATED once, when it has waited ESCALATE_AFTER_H in all: every
     Super Admin who is not already an approver on it gets a copy of the
     request — the same type and keys, so the decision clears theirs too and
     the bell's DecisionBar works for whoever may decide — saying whom it
     waits on. Copies are never reminded or escalated again.

   A snoozed row is left to its snooze: the approver chose when.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { INBOX_ROW_COLS, firstAt, resurface, type InboxRow } from "@/lib/server/inbox-resurface";
import { superAdminAccountIds } from "@/lib/server/sa-notify";
import { accountTimezones } from "@/lib/server/calendar-notify";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { readTpl } from "@/lib/notification-templates";
import { dmyDate } from "@/lib/work-reports";

const HOUR = 3_600_000;
/** A request comes back once it has sat this long since it last reached
 *  the approver: a day, less the hourly run's drift. */
export const REMIND_AFTER_H = 23;
/** The Super Admins hear of it once it has waited this long in all. */
export const ESCALATE_AFTER_H = 72;
/** Reminders land inside the approver's working day, on their clock. */
const WORK_FROM = 9;
const WORK_TO = 18;

type Meta = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/* Where each request type says whether it is still waiting. */
type Check = {
  table: string;
  cols: string;
  id: (m: Meta) => string | null;
  waiting: (entity: Record<string, unknown>, m: Meta) => boolean;
};
const CHECKS: Record<string, Check> = {
  todo_approval_request: {
    table: "koleex_todos", cols: "id, approval_state, completed",
    id: (m) => str(m.todo_id),
    waiting: (e) => e.approval_state === "pending" && e.completed !== true,
  },
  /* The manager's step waits while the request is pending; HR's while it
     is pending or past the manager (lib/server/leave-review). */
  leave_approval_request: {
    table: "hr_leave_requests", cols: "id, status",
    id: (m) => str(m.leave_request_id),
    waiting: (e, m) => (m.step === "hr" ? e.status === "pending" || e.status === "manager_approved" : e.status === "pending"),
  },
  attendance_correction_approval_request: {
    table: "hr_attendance_corrections", cols: "id, status",
    id: (m) => str(m.attendance_correction_id),
    waiting: (e) => e.status === "pending",
  },
  attendance_overtime_approval_request: {
    table: "hr_attendance_records", cols: "id, overtime_status",
    id: (m) => str(m.attendance_record_id),
    waiting: (e) => e.overtime_status == null,
  },
  expense_approval_request: {
    table: "finance_expenses", cols: "id, approval_status",
    id: (m) => str(m.expense_id),
    waiting: (e) => e.approval_status === "submitted",
  },
  membership_request: {
    table: "membership_requests", cols: "id, status",
    id: (m) => str(m.membership_request_id) ?? str(m.request_id),
    waiting: (e) => e.status === "pending",
  },
};
export const REMINDED_TYPES = Object.keys(CHECKS);

const typeOf = (r: InboxRow) => str(r.metadata?.type) ?? "";
const idOf = (r: InboxRow) => CHECKS[typeOf(r)]?.id(r.metadata ?? {}) ?? null;
const ageH = (r: InboxRow, now: number) => (now - Date.parse(firstAt(r))) / HOUR;

/** The local hour in a zone (the Hub's default when the zone is unknown). */
function hourIn(tz: string, now: Date): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(now));
  } catch {
    return now.getUTCHours();
  }
}

/** Which of these requests are still waiting, by type → id. A failed read
 *  answers "unknown" for that type: nothing is reminded, settled or
 *  escalated on a guess. */
async function stillWaiting(rows: InboxRow[]): Promise<Map<string, Map<string, boolean>>> {
  const out = new Map<string, Map<string, boolean>>();
  for (const [type, check] of Object.entries(CHECKS)) {
    const ofType = rows.filter((r) => typeOf(r) === type);
    const ids = [...new Set(ofType.map(idOf).filter(Boolean) as string[])];
    if (ids.length === 0) continue;
    const found = new Map<string, Record<string, unknown>>();
    let failed = false;
    for (let i = 0; i < ids.length && !failed; i += 100) {
      const { data, error } = await supabaseServer.from(check.table).select(check.cols).in("id", ids.slice(i, i + 100));
      if (error) { console.error("[approval-reminders] read", check.table, error.message); failed = true; break; }
      for (const e of (data ?? []) as unknown as Array<Record<string, unknown>>) found.set(String(e.id), e);
    }
    if (failed) continue;
    const verdicts = new Map<string, boolean>();
    for (const r of ofType) {
      const id = idOf(r);
      if (!id) continue;
      const e = found.get(id);
      /* Gone (deleted) is not waiting. The step lives on the row. */
      verdicts.set(`${id}|${r.id}`, !!e && check.waiting(e, r.metadata ?? {}));
    }
    out.set(type, verdicts);
  }
  return out;
}

/** Account display names: the person's name, else the username. */
async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabaseServer
    .from("accounts")
    .select("id, username, person:people ( full_name )")
    .in("id", ids);
  type Row = { id: string; username: string | null; person: { full_name: string | null } | Array<{ full_name: string | null }> | null };
  for (const r of (data ?? []) as unknown as Row[]) {
    const p = Array.isArray(r.person) ? r.person[0] : r.person;
    out.set(r.id, p?.full_name?.trim() || r.username || "—");
  }
  return out;
}

/** The tenant a row belongs to: its own, else its reader's (the to-do
 *  fan-out and the crons write rows without one). */
async function tenantsOf(rows: InboxRow[]): Promise<Map<string, string | null>> {
  const need = [...new Set(rows.filter((r) => !r.tenant_id).map((r) => r.recipient_account_id))];
  const byAccount = new Map<string, string | null>();
  if (need.length) {
    const { data } = await supabaseServer.from("accounts").select("id, tenant_id").in("id", need);
    for (const a of (data ?? []) as Array<{ id: string; tenant_id: string | null }>) byAccount.set(a.id, a.tenant_id);
  }
  return new Map(rows.map((r) => [r.id, r.tenant_id ?? byAccount.get(r.recipient_account_id) ?? null]));
}

export async function runApprovalReminders(now: Date = new Date()): Promise<{ reminded: number; escalated: number; settled: number }> {
  const nowMs = now.getTime();
  const { data, error } = await supabaseServer
    .from("inbox_messages")
    .select(`${INBOX_ROW_COLS}, sender_account_id, category`)
    .in("metadata->>type", REMINDED_TYPES)
    .is("archived_at", null)
    .is("snoozed_until", null)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) { console.error("[approval-reminders]", error.message); return { reminded: 0, escalated: 0, settled: 0 }; }
  type Row = InboxRow & { sender_account_id: string | null; category: string };
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return { reminded: 0, escalated: 0, settled: 0 };

  const verdicts = await stillWaiting(rows);
  const verdict = (r: Row): boolean | undefined => {
    const id = idOf(r);
    return id ? verdicts.get(typeOf(r))?.get(`${id}|${r.id}`) : undefined;
  };

  /* Decided elsewhere, and the row never read: finished business. */
  const settle = rows.filter((r) => verdict(r) === false && !r.read_at).map((r) => r.id);
  if (settle.length) {
    const at = now.toISOString();
    for (let i = 0; i < settle.length; i += 100) {
      const { error: e } = await supabaseServer.from("inbox_messages")
        .update({ read_at: at, archived_at: at }).in("id", settle.slice(i, i + 100)).is("read_at", null);
      if (e) console.error("[approval-reminders] settle:", e.message);
    }
  }

  const waiting = rows.filter((r) => verdict(r) === true);

  /* ── Escalation (first: the reminders below write the same rows) ── */
  const groups = new Map<string, Row[]>();
  for (const r of waiting) {
    if (r.metadata?.escalated) continue;
    const k = `${typeOf(r)}|${idOf(r)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const ripe = [...groups.values()].filter((g) =>
    g.some((r) => ageH(r, nowMs) >= ESCALATE_AFTER_H) && !g.some((r) => r.metadata?.escalated_at));
  let escalated = 0;
  if (ripe.length) {
    const tenants = await tenantsOf(ripe.flat());
    const names = await namesOf([...new Set(ripe.flat().map((r) => r.recipient_account_id))]);
    const adminsBy = new Map<string, string[]>();
    for (const g of ripe) {
      const first = g.reduce((a, b) => (Date.parse(firstAt(a)) <= Date.parse(firstAt(b)) ? a : b));
      const tenant = tenants.get(first.id) ?? null;
      const key = tenant ?? "";
      if (!adminsBy.has(key)) adminsBy.set(key, await superAdminAccountIds(tenant));
      const approvers = new Set(g.map((r) => r.recipient_account_id));
      const to = adminsBy.get(key)!.filter((id) => !approvers.has(id));
      const who = [...approvers].map((id) => names.get(id) ?? "—").join(", ").slice(0, 120);
      const since = firstAt(first);
      const at = now.toISOString();
      /* Marked first: a failure below never makes the next run tell them
         twice. In memory too — a reminder below writes the row's metadata
         from this copy. */
      for (const r of g) {
        r.metadata = { ...(r.metadata ?? {}), first_at: firstAt(r), escalated_at: at };
        await supabaseServer.from("inbox_messages").update({ metadata: r.metadata }).eq("id", r.id);
      }
      if (to.length === 0) continue;
      const base = first.metadata ?? {};
      const { reminders: _r, reminded_at: _ra, ...keep } = base as Meta;
      void _r; void _ra;
      const { error: insErr } = await supabaseServer.from("inbox_messages").insert(to.map((sa) => ({
        recipient_account_id: sa,
        sender_account_id: first.sender_account_id,
        tenant_id: tenant,
        category: first.category,
        subject: first.subject,
        body: first.body,
        link: first.link,
        metadata: { ...keep, first_at: since, escalated: true, escalated_for: who, escalated_at: at },
      })));
      if (insErr) { console.error("[approval-reminders] escalate:", insErr.message); continue; }
      escalated += 1;
      await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
      const sinceDay = dmyDate(since);
      await sendPushToAccounts(to, {
        title: `Waiting for a decision since ${sinceDay} · ${who}`,
        body: first.subject,
        url: first.link ?? "/",
        tag: `escalate:${typeOf(first)}:${idOf(first)}`,
        kind: "approval_reminder",
        tpl: { k: "approval_reminder.escalated", p: { since: sinceDay, who } },
        bodyTpl: readTpl(first.metadata),
      }).catch((e) => console.error("[approval-reminders] escalate push:", e instanceof Error ? e.message : e));
    }
  }

  /* ── Reminders ─────────────────────────────────────────────────────── */
  const due = waiting.filter((r) => !r.metadata?.escalated && nowMs - Date.parse(r.created_at) >= REMIND_AFTER_H * HOUR);
  const tz = await accountTimezones(due.map((r) => r.recipient_account_id));
  const inHours = due.filter((r) => {
    const h = hourIn(tz.get(r.recipient_account_id) ?? "UTC", now);
    return h >= WORK_FROM && h < WORK_TO;
  });
  const reminded = await resurface(inHours, {
    meta: (r) => ({ reminders: (Number(r.metadata?.reminders) || 0) + 1, reminded_at: now.toISOString() }),
    push: (r) => {
      const since = dmyDate(firstAt(r));
      return {
        title: `Still waiting for your decision · since ${since}`,
        body: r.subject,
        url: r.link ?? "/",
        tag: `remind:${r.id}`,
        kind: "approval_reminder",
        tpl: { k: "approval_reminder", p: { since } },
        bodyTpl: readTpl(r.metadata),
      };
    },
  });

  return { reminded: reminded.length, escalated, settled: settle.length };
}

import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — reminders and escalation (Phase 3B, owner's rule
   25 Sep 2026). Run by /api/cron/report-reminders every 15 minutes.

   For every tenant that has STARTED counting (work_report_settings with a
   tracking_from), for each person who owes a report:
     · reminder    an hour before an unsent report's deadline → the author
     · escalation  still missing — the daily 2 hours after the deadline, the
                   weekly and monthly at the end of the next working day →
                   the author's manager (the super admins when they have
                   none; never the author themself)
   Timing is the pure nudgesDue() on each person's own calendar.

   ONCE, whatever happens: each nudge is CLAIMED by inserting its ledger row
   (work_report_nudges, unique per person × report × period × kind) and only
   the run whose insert landed notifies — two overlapping runs, a retry, or a
   stranger calling the job's URL cannot send anything twice. What a run
   claimed is grouped: one notification per person told, listing every
   report it is about. Either switch (reminders / escalations) pauses its
   kind; nothing is sent at all before tracking starts.

   `dryRun` (a super admin's preview) claims and sends nothing and says who
   would be told what; `onlyAuthors` narrows a run to some people (tests).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { listPeople, loadOrgTree, superAdminIds } from "@/lib/server/reports/core";
import { escalationRecipients, loadClocks, loadOwners, loadSent, loadSettings, obligationClock } from "@/lib/server/reports/obligations";
import { addDays, effectiveObliged, nudgesDue, type Nudge } from "@/lib/reports/obligations";
import { REQUEST_COLS, requestNudges, type RequestRow } from "@/lib/reports/events";
import { reportsT } from "@/lib/translations/reports";

/** A request's nudge (Phase 3D) also names what it is about and is claimed
 *  on its own row, not in the ledger. */
export interface PlannedNudge extends Nudge { authorId: string; authorName: string; recipients: string[]; requestId?: string; subject?: string }
export interface NudgeRun { tenants: number; reminders: number; escalations: number; planned?: PlannedNudge[] }

const typeName = (key: string) => (reportsT[`tpl.${key}.name`]?.en as string | undefined) ?? "Report";
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
/** "Daily report 25/09" · "Weekly report 21/09–27/09" · "Monthly report 09/2026" */
function periodText(n: Nudge & { subject?: string }): string {
  if (n.subject !== undefined) return `${typeName(n.key)} — ${n.subject}`;
  if (n.key === "daily") return `${typeName("daily")} ${dm(n.periodKey)}`;
  if (n.key === "monthly") return `${typeName("monthly")} ${n.periodKey.slice(5, 7)}/${n.periodKey.slice(0, 4)}`;
  return `${typeName("weekly")} (due ${dm(n.dueDay)})`;
}
const clock = (iso: string, tz: string) => {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)); } catch { return iso.slice(11, 16); }
};

export async function runReportNudges(opts: { now?: string; dryRun?: boolean; onlyAuthors?: Set<string>; tenantId?: string | null } = {}): Promise<NudgeRun> {
  const now = opts.now ?? new Date().toISOString();
  let q = supabaseServer.from("work_report_settings").select("tenant_id").not("tracking_from", "is", null);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data: tenants, error } = await q;
  if (error) { console.error("[reports.nudges] settings:", error.message); return { tenants: 0, reminders: 0, escalations: 0 }; }
  const run: NudgeRun = { tenants: 0, reminders: 0, escalations: 0, planned: opts.dryRun ? [] : undefined };
  for (const { tenant_id: tenantId } of (tenants ?? []) as Array<{ tenant_id: string }>) {
    run.tenants++;
    await runTenant(tenantId, now, opts, run).catch((e: unknown) => console.error("[reports.nudges] tenant:", e instanceof Error ? e.message : e));
  }
  return run;
}

async function runTenant(tenantId: string, now: string, opts: { dryRun?: boolean; onlyAuthors?: Set<string> }, run: NudgeRun): Promise<void> {
  const settings = await loadSettings(tenantId);
  if (!settings.trackingFrom || (!settings.reminders && !settings.escalations)) return;
  const tree = await loadOrgTree(tenantId);
  const owners = await loadOwners(tree, opts.onlyAuthors);
  if (!owners.length) return;
  const today = now.slice(0, 10);
  const from = addDays(today, -45);
  const to = addDays(today, 10);
  const [clocks, { sent }, people, admins] = await Promise.all([
    loadClocks(tenantId, owners, from, to, settings.trackingFrom),
    loadSent(owners.map((o) => o.accountId), from, to),
    listPeople(tenantId),
    superAdminIds(tenantId),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const isAdmin = new Set(owners.filter((o) => o.isSuperAdmin).map((o) => o.accountId));
  const escalateTo = (author: string) => escalationRecipients(tree, admins, author);

  /* Everything due now, with who is told. */
  const planned: PlannedNudge[] = [];
  for (const o of owners) {
    const clockOf = clocks.get(o.accountId);
    if (!clockOf) continue;
    const obliged = effectiveObliged(o, o.exceptions);
    const due = nudgesDue({ obliged, clock: clockOf }, (k, pk) => sent.get(`${o.accountId}|${k}|${pk}`) ?? null, now, obligationClock);
    for (const n of due) {
      if (n.kind === "reminder" && !settings.reminders) continue;
      if (n.kind === "escalation" && !settings.escalations) continue;
      const recipients = n.kind === "reminder" ? [o.accountId] : escalateTo(o.accountId);
      if (!recipients.length) continue;
      planned.push({ ...n, authorId: o.accountId, authorName: nameOf.get(o.accountId) ?? "—", recipients });
    }
  }

  /* The reports events asked for (Phase 3D): the same two nudges, on the
     writer's clock. A super admin writing one (a probation review) is
     reminded but never escalated — there is no one above. */
  const planReq: PlannedNudge[] = [];
  if (settings.reminders || settings.escalations) {
    let rq = supabaseServer.from("work_report_requests").select(`${REQUEST_COLS}, account_id`)
      .eq("tenant_id", tenantId).eq("status", "open").is("sent_at", null)
      .gte("due_at", new Date(Date.parse(now) - 4 * 86_400_000).toISOString()).lte("due_at", new Date(Date.parse(now) + 2 * 3_600_000).toISOString()).limit(2000);
    if (opts.onlyAuthors) rq = rq.in("account_id", Array.from(opts.onlyAuthors));
    const { data: reqs, error: reqErr } = await rq;
    if (reqErr) console.error("[reports.nudges] requests:", reqErr.message);
    for (const r of ((reqs ?? []) as Array<RequestRow & { account_id: string }>)) {
      const clockOf = clocks.get(r.account_id);
      if (!clockOf) continue;
      for (const n of requestNudges(r, clockOf, now, obligationClock)) {
        if (n.kind === "reminder" && !settings.reminders) continue;
        if (n.kind === "escalation" && (!settings.escalations || isAdmin.has(r.account_id))) continue;
        const recipients = n.kind === "reminder" ? [r.account_id] : escalateTo(r.account_id);
        if (!recipients.length) continue;
        planReq.push({
          key: r.template_key as Nudge["key"], periodKey: `req:${r.id}`, kind: n.kind, at: n.at, dueAt: r.due_at, dueDay: String(r.due_day).slice(0, 10),
          authorId: r.account_id, authorName: nameOf.get(r.account_id) ?? "—", recipients, requestId: r.id, subject: r.subject,
        });
      }
    }
  }
  if (opts.dryRun) { run.planned!.push(...planned, ...planReq); return; }
  if (!planned.length && !planReq.length) return;

  /* CLAIM, then tell: only the run whose insert landed sends. */
  let mine: PlannedNudge[] = [];
  if (planned.length) {
    const { data: claimed, error } = await supabaseServer.from("work_report_nudges")
      .upsert(planned.map((n) => ({
        tenant_id: tenantId, account_id: n.authorId, template_key: n.key, period_key: n.periodKey, kind: n.kind, notified: n.recipients,
      })), { onConflict: "account_id,template_key,period_key,kind", ignoreDuplicates: true })
      .select("account_id, template_key, period_key, kind");
    if (error) console.error("[reports.nudges] claim:", error.message);
    else {
      const won = new Set(((claimed ?? []) as Array<{ account_id: string; template_key: string; period_key: string; kind: string }>)
        .map((r) => `${r.account_id}|${r.template_key}|${r.period_key}|${r.kind}`));
      mine = planned.filter((n) => won.has(`${n.authorId}|${n.key}|${n.periodKey}|${n.kind}`));
    }
  }
  /* A request's nudge is claimed on its row: stamped only where still
     empty, and only the run whose update landed sends it. */
  for (const n of planReq) {
    const claim = n.kind === "reminder"
      ? supabaseServer.from("work_report_requests").update({ reminded_at: now }).eq("id", n.requestId!).is("reminded_at", null).is("sent_at", null).eq("status", "open")
      : supabaseServer.from("work_report_requests").update({ escalated_at: now, escalated_to: n.recipients }).eq("id", n.requestId!).is("escalated_at", null).is("sent_at", null).eq("status", "open");
    const { data: got, error: claimErr } = await claim.select("id");
    if (claimErr) { console.error("[reports.nudges] request claim:", claimErr.message); continue; }
    if ((got ?? []).length) mine.push(n);
  }
  if (!mine.length) return;

  /* One notification per person told. */
  const byRecipient = new Map<string, PlannedNudge[]>();
  for (const n of mine) for (const r of n.recipients) byRecipient.set(r, [...(byRecipient.get(r) ?? []), n]);
  const tz = (id: string) => clocks.get(id)?.tz ?? "Asia/Shanghai";
  /* Templated (translations/notif-templates/reports.ts): one report or
     several are different sentences; a list of several stays the stored body
     (data). The period labels are English words from the reports dictionary
     and the due time an HH:MM on the reader's clock — plain values. */
  for (const [recipient, list] of byRecipient) {
    const reminders = list.filter((n) => n.kind === "reminder");
    const escalations = list.filter((n) => n.kind === "escalation");
    if (reminders.length) {
      const first = reminders[0];
      await notifyLite({
        tenantId, recipients: [recipient], senderId: null,
        tpl: reminders.length === 1
          ? { k: "report_reminder.one", p: { report: periodText(first).replace(/^(\w)/, (c) => c.toLowerCase()), time: clock(first.dueAt, tz(recipient)) } }
          : { k: "report_reminder.many", p: { count: reminders.length } },
        body: reminders.length > 1 ? reminders.map((n) => `${periodText(n)} — due ${clock(n.dueAt, tz(recipient))}`).join("\n") : undefined,
        link: reminders.length === 1 && first.requestId ? `/reports?write=${first.key}&request=${first.requestId}` : "/reports",
        type: "report_reminder",
        metadata: { reminders: reminders.map((n) => ({ key: n.key, period_key: n.periodKey })) },
        tag: `report-reminder-${recipient}-${now.slice(0, 13)}`,
      });
      run.reminders += reminders.length;
    }
    if (escalations.length) {
      const people = Array.from(new Set(escalations.map((n) => n.authorName)));
      await notifyLite({
        tenantId, recipients: [recipient], senderId: null,
        tpl: escalations.length === 1
          ? { k: "report_escalation.one", p: { author: escalations[0].authorName, report: periodText(escalations[0]) } }
          : people.length === 1
            ? { k: "report_escalation.many.person", p: { count: escalations.length, author: people[0] } }
            : { k: "report_escalation.many.people", p: { count: escalations.length, people: people.length } },
        body: escalations.map((n) => `${n.authorName} — ${periodText(n)}`).join("\n"),
        link: "/reports?tab=compliance",
        type: "report_escalation",
        metadata: { escalations: escalations.map((n) => ({ author: n.authorId, key: n.key, period_key: n.periodKey })) },
        tag: `report-escalation-${recipient}-${now.slice(0, 13)}`,
      });
      run.escalations += escalations.length;
    }
  }
}

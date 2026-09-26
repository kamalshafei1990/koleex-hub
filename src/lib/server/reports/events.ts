import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the reports events ask for (Phase 3D, owner's picks
   25 Sep 2026). Run by /api/cron/report-reminders every 15 minutes, before
   the nudges. The rules are the pure src/lib/reports/events.ts.

   For every tenant that has STARTED counting (work_report_settings with a
   tracking_from), it reads each source for its window —
     approved leave of 3+ days · CRM meetings marked done · issued invitations
     whose visitors have left · late and absent days AS HR'S SHEET READS THEM
     (buildAttendanceSheet, the one reading of attendance) · probations ending
     within two weeks
   — works out who writes what by when on the WRITER's own calendar, and:
     · CREATES each request once (work_report_requests, unique per rule ×
       event × person; only the rows this run inserted are announced), one
       notification per person listing what they now owe;
     · CANCELS an open, unsent request whose event stopped being true (leave
       cancelled, a day corrected, a meeting un-done) — but only for a source
       that was read successfully in this run and only inside its window, so
       a failed read or an old request never cancels anything.
   Super admins owe nothing (as for the daily) — except a probation review:
   that is the manager's duty whoever they are.

   `dryRun` claims and sends nothing and returns the plan; `onlyAccounts`
   narrows it to some writers; `trackingFrom` stands in for the tenant's
   setting in a dry run only (tests — the real start date is the owner's).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { listPeople, loadOrgTree } from "@/lib/server/reports/core";
import { loadClocks, loadOwners, obligationClock, type Owner } from "@/lib/server/reports/obligations";
import { buildAttendanceSheet } from "@/lib/server/attendance-sheet";
import { wallClock } from "@/lib/server/work-calendar";
import { addDays, localDayOf, type PersonClock } from "@/lib/reports/obligations";
import {
  EVENT_LIMITS, EVENT_TEMPLATE, dm, eventDayOf, eventDue, nextWorkdayAfter, requestIdOf, requestSubject,
  type EventDue, type EventRuleKey, type RequestFacts,
} from "@/lib/reports/events";
import { reportsT } from "@/lib/translations/reports";

export interface PlannedRequest {
  accountId: string;
  rule: EventRuleKey;
  template: string;
  sourceKey: string;
  subject: string;
  subjectAccountId: string | null;
  eventDay: string;
  due: EventDue;
  facts: RequestFacts;
}
export interface EventRun { tenants: number; created: number; cancelled: number; planned?: PlannedRequest[]; failed?: string[] }

type Candidate = Omit<PlannedRequest, "due" | "template" | "subject" | "eventDay">;

export async function runReportEvents(opts: { now?: string; dryRun?: boolean; onlyAccounts?: Set<string>; tenantId?: string | null; trackingFrom?: string } = {}): Promise<EventRun> {
  const now = opts.now ?? new Date().toISOString();
  const run: EventRun = { tenants: 0, created: 0, cancelled: 0, planned: opts.dryRun ? [] : undefined, failed: [] };
  let q = supabaseServer.from("work_report_settings").select("tenant_id, tracking_from");
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data, error } = await q;
  if (error) { console.error("[reports.events] settings:", error.message); return run; }
  const rows = (data ?? []) as Array<{ tenant_id: string; tracking_from: string | null }>;
  /* A dry run may stand in a start date for the tenant it is asked about. */
  const tenants = opts.dryRun && opts.trackingFrom && opts.tenantId && !rows.some((r) => r.tenant_id === opts.tenantId)
    ? [{ tenant_id: opts.tenantId, tracking_from: null }]
    : rows;
  for (const t of tenants) {
    const trackingFrom = opts.dryRun && opts.trackingFrom ? opts.trackingFrom : t.tracking_from ? String(t.tracking_from).slice(0, 10) : null;
    if (!trackingFrom) continue;
    run.tenants++;
    await runTenant(t.tenant_id, trackingFrom, now, opts, run).catch((e: unknown) => console.error("[reports.events] tenant:", e instanceof Error ? e.message : e));
  }
  return run;
}

async function runTenant(tenantId: string, trackingFrom: string, now: string, opts: { dryRun?: boolean; onlyAccounts?: Set<string> }, run: EventRun): Promise<void> {
  const tree = await loadOrgTree(tenantId);
  const all = await loadOwners(tree);
  if (!all.length) return;
  const today = now.slice(0, 10);
  const [clocks, people] = await Promise.all([
    loadClocks(tenantId, all, addDays(today, -40), addDays(today, 75), trackingFrom),
    listPeople(tenantId),
  ]);
  const byAccount = new Map(all.map((o) => [o.accountId, o]));
  const byEmployee = new Map(all.map((o) => [o.employeeId, o]));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const wanted = (accountId: string | null | undefined): accountId is string => !!accountId && byAccount.has(accountId) && (!opts.onlyAccounts || opts.onlyAccounts.has(accountId));

  /* Each source on its own: a failure is logged and leaves its rules out of
     this run's cancellations. */
  const candidates: Candidate[] = [];
  const scanned = new Set<EventRuleKey>();
  const source = async (rules: EventRuleKey[], read: () => Promise<Candidate[]>) => {
    try { candidates.push(...(await read())); rules.forEach((r) => scanned.add(r)); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); console.error(`[reports.events] ${rules.join("/")}:`, m); run.failed?.push(rules.join("/")); }
  };
  await Promise.all([
    source(["leave_handover", "leave_return"], () => readLeave(all, clocks, now, wanted)),
    source(["crm_meeting"], () => readCrm(clocks, now, trackingFrom, wanted, byAccount)),
    source(["invitation_visit"], () => readInvitations(tenantId, clocks, now, trackingFrom, wanted)),
    source(["attendance"], () => readAttendance(tenantId, all, clocks, now, trackingFrom, wanted)),
    source(["probation"], () => readProbation(tree, byEmployee, nameOf, now, wanted)),
  ]);

  /* Who owes it, and by when on their clock. */
  const planned: PlannedRequest[] = [];
  for (const c of candidates) {
    const writer = byAccount.get(c.accountId);
    const clock = clocks.get(c.accountId);
    if (!writer || !clock) continue;
    if (writer.isSuperAdmin && c.rule !== "probation") continue;
    const eventDay = eventDayOf(c.facts);
    if (c.rule !== "leave_handover" && c.rule !== "probation" && eventDay < trackingFrom) continue;
    const due = eventDue(c.facts, clock, now, obligationClock);
    if (!due) continue;
    planned.push({ ...c, template: EVENT_TEMPLATE[c.rule], subject: requestSubject(c.facts), eventDay, due });
  }
  if (opts.dryRun) { run.planned!.push(...planned); return; }

  /* CREATE once: only what this run inserted is announced. */
  if (planned.length) {
    const { data: inserted, error } = await supabaseServer.from("work_report_requests")
      .upsert(planned.map((p) => ({
        tenant_id: tenantId, account_id: p.accountId, template_key: p.template, rule_key: p.rule, source_key: p.sourceKey,
        subject: p.subject.slice(0, 200), subject_account_id: p.subjectAccountId, event_day: p.eventDay,
        due_day: p.due.day, due_at: p.due.at, prefill: p.facts,
      })), { onConflict: "rule_key,source_key,account_id", ignoreDuplicates: true })
      .select("id, account_id, template_key, subject, event_day, due_at");
    if (error) console.error("[reports.events] create:", error.message);
    else {
      const rows = (inserted ?? []) as Array<{ id: string; account_id: string; template_key: string; subject: string; event_day: string; due_at: string }>;
      run.created += rows.length;
      await announce(tenantId, rows, clocks, now);
    }
  }

  /* CANCEL what stopped being true — read sources only, inside their windows. */
  if (scanned.size) {
    const keep = new Set(planned.map((p) => `${p.rule}|${p.sourceKey}|${p.accountId}`));
    /* A candidate dropped only for its timing (too late to ask) still exists. */
    for (const c of candidates) keep.add(`${c.rule}|${c.sourceKey}|${c.accountId}`);
    const { data: open } = await supabaseServer.from("work_report_requests")
      .select("id, account_id, rule_key, source_key, event_day")
      .eq("tenant_id", tenantId).eq("status", "open").is("sent_at", null)
      .in("rule_key", Array.from(scanned)).gte("event_day", addDays(today, -EVENT_LIMITS.lookbackDays)).limit(2000);
    const gone = ((open ?? []) as Array<{ id: string; account_id: string; rule_key: EventRuleKey; source_key: string; event_day: string }>)
      .filter((r) => (!opts.onlyAccounts || opts.onlyAccounts.has(r.account_id)) && !keep.has(`${r.rule_key}|${r.source_key}|${r.account_id}`))
      .filter((r) => inWindow(r.rule_key, String(r.event_day).slice(0, 10), today));
    if (gone.length) {
      const { data: done } = await supabaseServer.from("work_report_requests")
        .update({ status: "cancelled", updated_at: now }).in("id", gone.map((r) => r.id)).eq("status", "open").is("sent_at", null).select("id");
      run.cancelled += (done ?? []).length;
    }
  }
}

/** Whether a request's event still falls inside the window its source is
 *  read over — only then can its absence mean the event stopped being true. */
function inWindow(rule: EventRuleKey, eventDay: string, today: string): boolean {
  const back = addDays(today, -EVENT_LIMITS.lookbackDays);
  switch (rule) {
    case "leave_handover": return eventDay >= back && eventDay <= addDays(today, 60);
    case "leave_return": return eventDay >= back && eventDay <= today;
    case "crm_meeting": return eventDay >= back && eventDay <= today;
    case "invitation_visit": return eventDay >= back && eventDay < today;
    case "attendance": return eventDay >= addDays(today, -EVENT_LIMITS.attendanceLookbackDays) && eventDay <= today;
    case "probation": return eventDay >= today && eventDay <= addDays(today, EVENT_LIMITS.probationLeadDays);
  }
}

/* ── The sources ─────────────────────────────────────────────────────── */

async function readLeave(all: Owner[], clocks: Map<string, PersonClock>, now: string, wanted: (a: string) => boolean): Promise<Candidate[]> {
  const today = now.slice(0, 10);
  const { data, error } = await supabaseServer.from("hr_leave_requests")
    .select("id, employee_id, start_date, end_date, days, status")
    .eq("status", "approved").in("employee_id", all.map((o) => o.employeeId))
    .gte("end_date", addDays(today, -EVENT_LIMITS.lookbackDays)).lte("start_date", addDays(today, 60)).limit(1000);
  if (error) throw new Error(error.message);
  const byEmployee = new Map(all.map((o) => [o.employeeId, o]));
  const out: Candidate[] = [];
  for (const l of (data ?? []) as Array<{ id: string; employee_id: string; start_date: string; end_date: string; days: number | string }>) {
    const o = byEmployee.get(l.employee_id);
    const days = Number(l.days);
    if (!o || !wanted(o.accountId) || !(days >= EVENT_LIMITS.leaveMinDays)) continue;
    const clock = clocks.get(o.accountId);
    if (!clock) continue;
    const from = String(l.start_date).slice(0, 10), to = String(l.end_date).slice(0, 10);
    const local = localDayOf(now, clock.tz);
    const base = { accountId: o.accountId, sourceKey: `leave:${l.id}`, subjectAccountId: null };
    /* The handover while the leave is ahead or running (it is ASKED only
       before its deadline — eventDue says when it is too late); the return
       plan once they are back. */
    if (to >= local) out.push({ ...base, rule: "leave_handover", facts: { rule: "leave_handover", from, to, days } });
    const back = nextWorkdayAfter(clock, to);
    if (back && back <= local && to >= addDays(local, -EVENT_LIMITS.lookbackDays)) out.push({ ...base, rule: "leave_return", facts: { rule: "leave_return", from, to, days } });
  }
  return out;
}

async function readCrm(clocks: Map<string, PersonClock>, now: string, trackingFrom: string, wanted: (a: string | null | undefined) => boolean, byAccount: Map<string, Owner>): Promise<Candidate[]> {
  const since = [trackingFrom, addDays(now.slice(0, 10), -EVENT_LIMITS.lookbackDays)].sort().at(-1)!;
  const { data, error } = await supabaseServer.from("crm_activities")
    .select("id, title, done_at, assignee_account_id, created_by_account_id, opportunity:opportunity_id ( name, company_name, contact_name )")
    .eq("type", "meeting").not("done_at", "is", null).gte("done_at", `${since}T00:00:00Z`).limit(1000);
  if (error) throw new Error(error.message);
  const out: Candidate[] = [];
  for (const a of (data ?? []) as Array<{ id: string; title: string | null; done_at: string; assignee_account_id: string | null; created_by_account_id: string | null; opportunity?: { name?: string | null; company_name?: string | null; contact_name?: string | null } | Array<{ name?: string | null; company_name?: string | null; contact_name?: string | null }> | null }>) {
    const writer = a.assignee_account_id ?? a.created_by_account_id;
    if (!wanted(writer) || !byAccount.has(writer!)) continue;
    const clock = clocks.get(writer!);
    if (!clock) continue;
    const opp = Array.isArray(a.opportunity) ? a.opportunity[0] : a.opportunity;
    const customer = (opp?.company_name || opp?.contact_name || opp?.name || a.title || "—").trim();
    const contact = opp?.company_name && opp?.contact_name ? opp.contact_name.trim() : undefined;
    const day = localDayOf(a.done_at, clock.tz);
    out.push({ accountId: writer!, rule: "crm_meeting", sourceKey: `crm:${a.id}`, subjectAccountId: null, facts: { rule: "crm_meeting", customer, contact, title: a.title?.trim() || undefined, day } });
  }
  return out;
}

async function readInvitations(tenantId: string, clocks: Map<string, PersonClock>, now: string, trackingFrom: string, wanted: (a: string | null | undefined) => boolean): Promise<Candidate[]> {
  const since = [trackingFrom, addDays(now.slice(0, 10), -EVENT_LIMITS.lookbackDays)].sort().at(-1)!;
  const { data, error } = await supabaseServer.from("invitation_letters")
    .select("id, status, arrival_date, departure_date, visitor_name, visitor_company, exhibition_name, created_by")
    .eq("tenant_id", tenantId).eq("status", "issued").gte("departure_date", since).lte("departure_date", now.slice(0, 10)).limit(500);
  if (error) throw new Error(error.message);
  const out: Candidate[] = [];
  for (const l of (data ?? []) as Array<{ id: string; arrival_date: string | null; departure_date: string; visitor_name: string | null; visitor_company: string | null; exhibition_name: string | null; created_by: string | null }>) {
    if (!wanted(l.created_by)) continue;
    const clock = clocks.get(l.created_by!);
    if (!clock) continue;
    const to = String(l.departure_date).slice(0, 10);
    if (to >= localDayOf(now, clock.tz)) continue; // still here
    const from = l.arrival_date ? String(l.arrival_date).slice(0, 10) : to;
    const customer = (l.visitor_company || l.visitor_name || "—").trim();
    out.push({
      accountId: l.created_by!, rule: "invitation_visit", sourceKey: `invitation:${l.id}`, subjectAccountId: null,
      facts: { rule: "invitation_visit", customer, visitor: l.visitor_company && l.visitor_name ? l.visitor_name.trim() : undefined, from, to, exhibition: l.exhibition_name?.trim() || undefined },
    });
  }
  return out;
}

/** Late and absent days exactly as HR's attendance sheet reads them — the
 *  one reading of attendance (policy lateness, leave, holidays, HR's own
 *  tracking start and the hire date all included). */
async function readAttendance(tenantId: string, all: Owner[], clocks: Map<string, PersonClock>, now: string, trackingFrom: string, wanted: (a: string) => boolean): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const jobs: Array<() => Promise<void>> = [];
  for (const o of all) {
    if (o.isSuperAdmin || !wanted(o.accountId)) continue;
    const clock = clocks.get(o.accountId);
    if (!clock) continue;
    const today = localDayOf(now, clock.tz);
    const first = [trackingFrom, addDays(today, -EVENT_LIMITS.attendanceLookbackDays)].sort().at(-1)!;
    if (first > today) continue;
    const months = Array.from(new Set([first.slice(0, 7), today.slice(0, 7)]));
    for (const m of months) jobs.push(async () => {
      const sheet = await buildAttendanceSheet({ employeeId: o.employeeId, tenantId, year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)), today });
      for (const d of sheet.days) {
        if (d.date < first || d.date > today) continue;
        if (d.status === "late") {
          out.push({ accountId: o.accountId, rule: "attendance", sourceKey: `attendance:${o.employeeId}:${d.date}`, subjectAccountId: null,
            facts: { rule: "attendance", kind: "late", day: d.date, clockIn: d.clockIn ? wallClock(d.clockIn, sheet.policy.timezone) : undefined, lateMin: d.lateMin } });
        } else if (d.status === "absent" && d.date < today) {
          out.push({ accountId: o.accountId, rule: "attendance", sourceKey: `attendance:${o.employeeId}:${d.date}`, subjectAccountId: null,
            facts: { rule: "attendance", kind: "absent", day: d.date } });
        }
      }
    });
  }
  /* A few people at a time — each sheet is several reads. */
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => j()));
  return out;
}

async function readProbation(tree: Awaited<ReturnType<typeof loadOrgTree>>, byEmployee: Map<string, Owner>, nameOf: Map<string, string>, now: string, wanted: (a: string) => boolean): Promise<Candidate[]> {
  const today = now.slice(0, 10);
  const members = tree.members();
  const accountOf = new Map(members.map((m) => [m.employeeId, m.accountId]));
  const { data, error } = await supabaseServer.from("koleex_employees")
    .select("id, probation_end_date, employment_status")
    .in("id", members.map((m) => m.employeeId))
    .gte("probation_end_date", today).lte("probation_end_date", addDays(today, EVENT_LIMITS.probationLeadDays)).limit(500);
  if (error) throw new Error(error.message);
  const out: Candidate[] = [];
  for (const e of (data ?? []) as Array<{ id: string; probation_end_date: string; employment_status: string | null }>) {
    if (e.employment_status && !["active", "on_leave"].includes(e.employment_status)) continue;
    const employee = accountOf.get(e.id);
    if (!employee || !byEmployee.has(e.id)) continue;
    const manager = tree.chainOf(employee)[0];
    if (!manager || !wanted(manager)) continue;
    const endDay = String(e.probation_end_date).slice(0, 10);
    out.push({ accountId: manager, rule: "probation", sourceKey: `probation:${e.id}:${endDay}`, subjectAccountId: employee,
      facts: { rule: "probation", employee: nameOf.get(employee) ?? "—", endDay } });
  }
  return out;
}

/* ── Telling the writer ──────────────────────────────────────────────── */

const typeName = (key: string) => (reportsT[`tpl.${key}.name`]?.en as string | undefined) ?? "Report";
/** The due moment on the writer's clock, in pieces — "Fri" (an en-GB short
 *  weekday: the template's weekdayShort code), "26/09", "18:00". null when
 *  the zone cannot be read. */
const dueParts = (iso: string, tz: string) => {
  try {
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(iso));
    return { day, date: dm(localDayOf(iso, tz)), time: wallClock(iso, tz) };
  } catch { return null; }
};
const whenText = (iso: string, tz: string) => {
  const w = dueParts(iso, tz);
  return w ? `${w.day} ${w.date} at ${w.time}` : iso.slice(0, 16).replace("T", " ");
};

async function announce(tenantId: string, rows: Array<{ id: string; account_id: string; template_key: string; subject: string; event_day: string; due_at: string }>, clocks: Map<string, PersonClock>, now: string): Promise<void> {
  const byWriter = new Map<string, typeof rows>();
  for (const r of rows) byWriter.set(r.account_id, [...(byWriter.get(r.account_id) ?? []), r]);
  for (const [writer, list] of byWriter) {
    const tz = clocks.get(writer)?.tz ?? "Asia/Shanghai";
    const one = list.length === 1 ? list[0] : null;
    const due = one ? dueParts(one.due_at, tz) : null;
    /* Templated (translations/notif-templates/reports.ts). One request: its
       type (the English label) and what it is about, plain; its due moment
       in the reader's words — or, when the zone cannot be read, the raw
       instant as the stored body. Several: the subject counts them, and the
       list stays the stored body (data). */
    await notifyLite({
      tenantId, recipients: [writer], senderId: null,
      tpl: !one
        ? { k: "report_request.many", p: { count: list.length } }
        : due
          ? { k: "report_request.one", p: { type: typeName(one.template_key), subject: one.subject, ...due } }
          : { k: "report_request.one.raw", p: { type: typeName(one.template_key), subject: one.subject } },
      body: !one
        ? list.map((r) => `${typeName(r.template_key)} — ${r.subject} (due ${whenText(r.due_at, tz)})`).join("\n")
        : due ? undefined : `Due ${whenText(one.due_at, tz)}.`,
      link: one ? `/reports?write=${one.template_key}&date=${String(one.event_day).slice(0, 10)}&request=${one.id}` : "/reports",
      type: "report_request",
      metadata: { requests: list.map((r) => r.id) },
      tag: `report-request-${writer}-${now.slice(0, 13)}`,
    });
  }
}

/* ── Reading requests ────────────────────────────────────────────────── */

/** A report sent for a request: the first send decides on time or late, the
 *  link follows the newest version. Called by the submit route. */
export async function markRequestSent(periodKey: string | null, reportId: string, authorId: string, at: string): Promise<void> {
  const id = requestIdOf(periodKey);
  if (!id) return;
  const base = () => supabaseServer.from("work_report_requests").update({ report_id: reportId, updated_at: at }).eq("id", id).eq("account_id", authorId);
  const [, first] = await Promise.all([
    base(),
    supabaseServer.from("work_report_requests").update({ sent_at: at }).eq("id", id).eq("account_id", authorId).is("sent_at", null),
  ]);
  if (first.error) console.error("[reports.events] mark sent:", first.error.message);
}

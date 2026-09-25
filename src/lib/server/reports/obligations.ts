import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the facts behind obligations (Phase 3A): who can owe a
   report (active employees with an active staff account), their country's
   calendar and attendance policy (end of day, timezone), their approved
   leave, the per-person exceptions, when tracking starts, and what they
   sent. The rules themselves are the pure src/lib/reports/obligations.ts.

   Scope: the compliance board shows a super admin and HR (HR·view)
   everyone; a manager their own people (every level below them); anyone
   else nothing. It shows WHETHER a report was sent, never its text — a
   confidential daily is counted, not linked.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { listPeople, loadOrgTree, type OrgTree, type PersonLite } from "@/lib/server/reports/core";
import { loadPolicyRows, loadWorkCalendar, pickPolicy, resolveEmployeeCountries, wallClockToIso } from "@/lib/server/work-calendar";
import { isoWeekKey } from "@/lib/reports/templates";
import { EVENT_LIMITS, REQUEST_COLS, requestIsOwed, requestState, type RequestRow, type RequestState } from "@/lib/reports/events";
import {
  OBLIGATION_KEYS, addDays, boardRow, deadlinesIn, dueList, effectiveObliged, mondayOf, summarize, weekDays,
  type BoardRow, type BoardSummary, type Clock, type Deadline, type DueItem, type ObligationKey, type Obliged, type PersonClock, type Sent,
} from "@/lib/reports/obligations";

export const obligationClock: Clock = (day, hhmm, tz) => wallClockToIso(day, hhmm, tz);

export interface Owner {
  accountId: string;
  employeeId: string;
  isSuperAdmin: boolean;
  hasTeam: boolean;
  hireDate: string | null;
  exceptions: Partial<Obliged>;
}

/** Who can owe a report: employees that resolve to an ACTIVE STAFF account
 *  and are not marked as having left. */
export async function loadOwners(tree: OrgTree, only?: Set<string>): Promise<Owner[]> {
  const members = tree.members().filter((m) => !only || only.has(m.accountId));
  if (!members.length) return [];
  const accountIds = members.map((m) => m.accountId);
  const [accounts, emps, exceptions] = await Promise.all([
    supabaseServer.from("accounts").select("id, is_super_admin, status, user_type").in("id", accountIds),
    supabaseServer.from("koleex_employees").select("id, hire_date, employment_status").in("id", members.map((m) => m.employeeId)),
    supabaseServer.from("work_report_obligations").select("account_id, template_key, required").in("account_id", accountIds),
  ]);
  const acc = new Map(((accounts.data ?? []) as Array<{ id: string; is_super_admin: boolean | null; status: string | null; user_type: string | null }>).map((a) => [a.id, a]));
  const emp = new Map(((emps.data ?? []) as Array<{ id: string; hire_date: string | null; employment_status: string | null }>).map((e) => [e.id, e]));
  const exc = new Map<string, Partial<Obliged>>();
  for (const r of (exceptions.data ?? []) as Array<{ account_id: string; template_key: ObligationKey; required: boolean }>) {
    exc.set(r.account_id, { ...(exc.get(r.account_id) ?? {}), [r.template_key]: r.required });
  }
  const out: Owner[] = [];
  for (const m of members) {
    const a = acc.get(m.accountId);
    const e = emp.get(m.employeeId);
    if (!a || a.status !== "active" || a.user_type !== "internal") continue;
    if (e?.employment_status && !["active", "probation"].includes(e.employment_status)) continue;
    out.push({
      accountId: m.accountId, employeeId: m.employeeId, isSuperAdmin: !!a.is_super_admin,
      hasTeam: tree.descendantsOf(m.accountId).length > 0, hireDate: e?.hire_date ? String(e.hire_date).slice(0, 10) : null,
      exceptions: exc.get(m.accountId) ?? {},
    });
  }
  return out;
}

export interface ReportSettings { trackingFrom: string | null; reminders: boolean; escalations: boolean }

/** The tenant's settings: when counting starts, and the two Phase 3B
 *  switches (both on unless paused). */
export async function loadSettings(tenantId: string | null): Promise<ReportSettings> {
  if (!tenantId) return { trackingFrom: null, reminders: true, escalations: true };
  const { data } = await supabaseServer.from("work_report_settings").select("tracking_from, reminders, escalations").eq("tenant_id", tenantId).maybeSingle();
  const row = data as { tracking_from?: string | null; reminders?: boolean | null; escalations?: boolean | null } | null;
  return {
    trackingFrom: row?.tracking_from ? String(row.tracking_from).slice(0, 10) : null,
    reminders: row?.reminders !== false,
    escalations: row?.escalations !== false,
  };
}

export async function loadTrackingFrom(tenantId: string | null): Promise<string | null> {
  return (await loadSettings(tenantId)).trackingFrom;
}

/** Each owner's calendar and clock over [from, to]. */
export async function loadClocks(tenantId: string | null, owners: Owner[], from: string, to: string, trackingFrom: string | null): Promise<Map<string, PersonClock>> {
  const [countries, policies, leaveRes] = await Promise.all([
    resolveEmployeeCountries(owners.map((o) => o.employeeId)),
    loadPolicyRows(),
    owners.length
      ? supabaseServer.from("hr_leave_requests").select("employee_id, start_date, end_date").in("employee_id", owners.map((o) => o.employeeId))
        .eq("status", "approved").lte("start_date", to).gte("end_date", from)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const byCountry = new Map<string, Promise<{ weekend: number[]; holidays: string[] }>>();
  const calendarOf = (country: string | null) => {
    const key = country ?? "-";
    if (!byCountry.has(key)) byCountry.set(key, loadWorkCalendar(tenantId, country, from, to, pickPolicy(policies, country)));
    return byCountry.get(key)!;
  };
  const leave = new Map<string, Set<string>>();
  for (const r of (leaveRes.data ?? []) as Array<{ employee_id: string; start_date: string; end_date: string }>) {
    const set = leave.get(r.employee_id) ?? new Set<string>();
    const end = String(r.end_date).slice(0, 10);
    for (let d = String(r.start_date).slice(0, 10), i = 0; d <= end && i < 400; d = addDays(d, 1), i++) set.add(d);
    leave.set(r.employee_id, set);
  }
  const out = new Map<string, PersonClock>();
  await Promise.all(owners.map(async (o) => {
    const country = countries.get(o.employeeId) ?? null;
    const policy = pickPolicy(policies, country);
    const cal = await calendarOf(country);
    const starts = [trackingFrom, o.hireDate].filter((x): x is string => !!x);
    out.set(o.accountId, {
      weekend: cal.weekend, holidays: new Set(cal.holidays), leave: leave.get(o.employeeId) ?? new Set(),
      tz: policy.timezone, workEnd: policy.workEnd,
      from: trackingFrom ? starts.sort().at(-1)! : null,
    });
  }));
  return out;
}

type SentRow = { id: string; author_account_id: string; template_key: ObligationKey; period_key: string | null; status: string; submitted_at: string | null; superseded: boolean; confidential: boolean };

/** What was sent (first send per period; the newest version to open) and
 *  which drafts are open, keyed author|type|period. */
export async function loadSent(authorIds: string[], from: string, to: string): Promise<{ sent: Map<string, Sent>; drafts: Map<string, Sent> }> {
  const sent = new Map<string, Sent>();
  const drafts = new Map<string, Sent>();
  if (!authorIds.length) return { sent, drafts };
  const { data, error } = await supabaseServer.from("work_reports")
    .select("id, author_account_id, template_key, period_key, status, submitted_at, superseded, confidential")
    .in("author_account_id", authorIds).in("template_key", OBLIGATION_KEYS)
    .gte("period_start", from).lte("period_start", to).limit(5000);
  if (error) { console.error("[reports] obligations sent:", error.message); return { sent, drafts }; }
  for (const r of (data ?? []) as SentRow[]) {
    if (!r.period_key) continue;
    const key = `${r.author_account_id}|${r.template_key}|${r.period_key}`;
    if (r.status === "draft") { drafts.set(key, { at: "", id: r.id }); continue; }
    if (!r.submitted_at) continue;
    /* The FIRST send decides on time or late; the link opens the newest
       version; a confidential report is counted, never linked (id ""). */
    const cur = sent.get(key) ?? { at: r.submitted_at, id: "" };
    if (Date.parse(r.submitted_at) < Date.parse(cur.at)) cur.at = r.submitted_at;
    if (!r.superseded) cur.id = r.confidential ? "" : r.id;
    sent.set(key, cur);
  }
  return { sent, drafts };
}

export interface BoardPersonRow extends BoardRow { person: PersonLite }
export interface ComplianceBoard {
  week: { key: string; start: string; days: string[] };
  trackingFrom: string | null;
  canSetUp: boolean;
  rows: BoardPersonRow[];
  summary: BoardSummary;
}

export async function canSeeEveryone(auth: ServerAuthContext): Promise<boolean> {
  return auth.is_super_admin || (await requireModuleAction(auth, "HR", "view")) === null;
}
export async function canSetUp(auth: ServerAuthContext): Promise<boolean> {
  return auth.is_super_admin || (await requireModuleAction(auth, "HR", "edit")) === null;
}

/** The compliance board for one ISO week, in the viewer's scope. */
export async function loadBoard(auth: ServerAuthContext, anyDay: string): Promise<ComplianceBoard> {
  const monday = mondayOf(anyDay);
  const days = weekDays(monday);
  const [tree, everyone, setUp, trackingFrom, people] = await Promise.all([
    loadOrgTree(auth.tenant_id), canSeeEveryone(auth), canSetUp(auth), loadTrackingFrom(auth.tenant_id), listPeople(auth.tenant_id),
  ]);
  const scope = everyone ? undefined : new Set(tree.descendantsOf(auth.account_id));
  const owners = scope && scope.size === 0 ? [] : await loadOwners(tree, scope);
  const from = addDays(monday, -40);
  const to = addDays(monday, 60);
  const [clocks, { sent }] = await Promise.all([
    loadClocks(auth.tenant_id, owners, from, to, trackingFrom),
    loadSent(owners.map((o) => o.accountId), from, to),
  ]);
  const now = new Date().toISOString();
  const nameOf = new Map(people.map((p) => [p.id, p]));
  const rows: BoardPersonRow[] = [];
  for (const o of owners) {
    const obliged = effectiveObliged(o, o.exceptions);
    if (!obliged.daily && !obliged.weekly && !obliged.monthly) continue;
    const clock = clocks.get(o.accountId);
    if (!clock) continue;
    const row = boardRow({ obliged, clock }, monday, (k, pk) => sent.get(`${o.accountId}|${k}|${pk}`) ?? null, now, obligationClock);
    const p = nameOf.get(o.accountId);
    rows.push({ ...row, person: p ?? { id: o.accountId, name: "—", nameAlt: null, avatar: null, position: null } });
  }
  rows.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return { week: { key: isoWeekKey(monday), start: monday, days }, trackingFrom, canSetUp: setUp, rows, summary: summarize(rows) };
}

/** What the viewer owes now (the Reports home's "Due from you", the Home
 *  greeting): the routine reports, then what events asked them for. */
export async function loadMyDue(auth: ServerAuthContext, tree?: OrgTree): Promise<DueItem[]> {
  const [t, trackingFrom] = await Promise.all([tree ?? loadOrgTree(auth.tenant_id), loadTrackingFrom(auth.tenant_id)]);
  /* Before tracking starts nothing is owed — the person and their calendar
     are not even read (the work snapshot asks this on every screen). */
  if (!trackingFrom) return [];
  const [me] = await loadOwners(t, new Set([auth.account_id]));
  if (!me) return [];
  const now = new Date().toISOString();
  const [routine, asked] = await Promise.all([loadRoutineDue(auth, me, trackingFrom, now), loadRequestsDue(me.accountId, now)]);
  return [...routine, ...asked].sort((a, b) => (a.state !== b.state ? (a.state === "missing" ? -1 : 1) : Date.parse(a.dueAt) - Date.parse(b.dueAt)));
}

async function loadRoutineDue(auth: ServerAuthContext, me: Owner, trackingFrom: string, now: string): Promise<DueItem[]> {
  const obliged = effectiveObliged(me, me.exceptions);
  if (!obliged.daily && !obliged.weekly && !obliged.monthly) return [];
  const today = now.slice(0, 10);
  const from = addDays(today, -45);
  const to = addDays(today, 10);
  const [clocks, { sent, drafts }] = await Promise.all([
    loadClocks(auth.tenant_id, [me], from, to, trackingFrom),
    loadSent([me.accountId], from, to),
  ]);
  const clock = clocks.get(me.accountId);
  if (!clock) return [];
  const key = (k: ObligationKey, pk: string) => `${me.accountId}|${k}|${pk}`;
  return dueList({ obliged, clock }, (k, pk) => sent.get(key(k, pk)) ?? null, (k, pk) => drafts.get(key(k, pk)) ?? null, now, obligationClock);
}

/** The requests events made of this person (Phase 3D) that "Due from you"
 *  lists: due within a few days, or missing for up to two weeks. */
async function loadRequestsDue(accountId: string, now: string): Promise<DueItem[]> {
  const t = Date.parse(now);
  const { data, error } = await supabaseServer.from("work_report_requests").select(REQUEST_COLS)
    .eq("account_id", accountId).eq("status", "open").is("sent_at", null)
    .gte("due_at", new Date(t - EVENT_LIMITS.missingDays * 86_400_000).toISOString())
    .lte("due_at", new Date(t + EVENT_LIMITS.soonDays * 86_400_000).toISOString()).limit(50);
  if (error) { console.error("[reports] requests due:", error.message); return []; }
  const rows = ((data ?? []) as RequestRow[]).filter((r) => requestIsOwed(r, now));
  if (!rows.length) return [];
  const { data: drafts } = await supabaseServer.from("work_reports").select("id, period_key")
    .eq("author_account_id", accountId).eq("status", "draft").in("period_key", rows.map((r) => `req:${r.id}`));
  const draftOf = new Map(((drafts ?? []) as Array<{ id: string; period_key: string }>).map((d) => [d.period_key, d.id]));
  return rows.map((r) => ({
    key: r.template_key, periodKey: `req:${r.id}`, date: String(r.event_day).slice(0, 10), dueAt: r.due_at,
    state: requestState(r, now) === "missing" ? "missing" : "due",
    draftId: draftOf.get(`req:${r.id}`), request: r.id, subject: r.subject,
  }));
}

/** One person's report deadlines whose moment falls in [fromIso, toIso) —
 *  the Calendar's mirror (Phase 3C). Empty until tracking starts, and for
 *  someone who owes no report (a super admin, unless an exception says so). */
export async function loadDeadlines(tenantId: string | null, accountId: string, fromIso: string, toIso: string): Promise<Deadline[]> {
  const [settings, tree] = await Promise.all([loadSettings(tenantId), loadOrgTree(tenantId)]);
  if (!settings.trackingFrom || addDays(toIso.slice(0, 10), 1) < settings.trackingFrom) return [];
  const [me] = await loadOwners(tree, new Set([accountId]));
  if (!me) return [];
  const obliged = effectiveObliged(me, me.exceptions);
  if (!obliged.daily && !obliged.weekly && !obliged.monthly) return [];
  /* From two months back (a monthly report's own month), to a little past
     the window (a deadline read on the person's clock). */
  const from = addDays(fromIso.slice(0, 10), -62);
  const to = addDays(toIso.slice(0, 10), 2);
  const [clocks, { sent, drafts }] = await Promise.all([
    loadClocks(tenantId, [me], from, to, settings.trackingFrom),
    loadSent([me.accountId], from, to),
  ]);
  const clock = clocks.get(me.accountId);
  if (!clock) return [];
  const key = (k: ObligationKey, pk: string) => `${me.accountId}|${k}|${pk}`;
  return deadlinesIn({ obliged, clock }, fromIso, toIso, (k, pk) => sent.get(key(k, pk)) ?? null, (k, pk) => drafts.get(key(k, pk)) ?? null, new Date().toISOString(), obligationClock);
}

/** What events asked one person for (Phase 3D) whose deadline falls in
 *  [fromIso, toIso) — the calendar shows them beside the routine reports.
 *  Cancelled ones never; a sent one keeps its place, marked sent or late. */
export async function loadRequestDeadlines(accountId: string, fromIso: string, toIso: string): Promise<Array<RequestRow & { state: RequestState; draftId?: string }>> {
  const { data, error } = await supabaseServer.from("work_report_requests").select(REQUEST_COLS)
    .eq("account_id", accountId).eq("status", "open").gte("due_at", fromIso).lt("due_at", toIso).limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RequestRow[];
  const owed = rows.filter((r) => !r.sent_at);
  const { data: drafts } = owed.length
    ? await supabaseServer.from("work_reports").select("id, period_key").eq("author_account_id", accountId).eq("status", "draft").in("period_key", owed.map((r) => `req:${r.id}`))
    : { data: [] as Array<{ id: string; period_key: string }> };
  const draftOf = new Map(((drafts ?? []) as Array<{ id: string; period_key: string }>).map((d) => [d.period_key, d.id]));
  const now = new Date().toISOString();
  return rows.map((r) => ({ ...r, state: requestState(r, now), draftId: r.sent_at ? undefined : draftOf.get(`req:${r.id}`) }));
}

export interface SetupRow { person: PersonLite; isSuperAdmin: boolean; hasTeam: boolean; defaults: Obliged; exceptions: Partial<Obliged> }

/** Who writes what, for the setup screen: every owner, the default and the
 *  exceptions. */
export async function loadSetup(auth: ServerAuthContext): Promise<ReportSettings & { rows: SetupRow[] }> {
  const [tree, settings, people] = await Promise.all([loadOrgTree(auth.tenant_id), loadSettings(auth.tenant_id), listPeople(auth.tenant_id)]);
  const owners = await loadOwners(tree);
  const nameOf = new Map(people.map((p) => [p.id, p]));
  const rows = owners.map((o) => ({
    person: nameOf.get(o.accountId) ?? { id: o.accountId, name: "—", nameAlt: null, avatar: null, position: null },
    isSuperAdmin: o.isSuperAdmin, hasTeam: o.hasTeam,
    defaults: effectiveObliged(o, {}), exceptions: o.exceptions,
  }));
  rows.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return { ...settings, rows };
}

/** The accounts that may carry an exception: the tenant's owners only. */
export async function ownerIds(auth: ServerAuthContext): Promise<Set<string>> {
  const tree = await loadOrgTree(auth.tenant_id);
  return new Set((await loadOwners(tree)).map((o) => o.accountId));
}

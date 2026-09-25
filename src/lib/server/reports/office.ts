import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the CEO office's numbers (Phase 5B, owner's picks
   25 Sep 2026). The rows are the pure src/lib/reports/office.ts; this file
   gathers the facts.

   «CEO Office» in Roles (a capability row under Reports, closed by default;
   super admins always) lets its holder START the office's types, and read
   company-wide INSIDE a report — and nothing more (OFFICE_READS):
     follow-ups   open / overdue / finished work per department — numbers,
                  never a title; the tasks and the to-dos someone assigned
                  (a person's own to-dos stay theirs, a private one never
                  counts — the 5A rule)
     occasions    birthdays and work anniversaries — a name, a day, the
                  years of service; never a birth year, never an age
     visitors     the invitation letters — visitor, company, country, dates,
                  purpose, whether the letter is issued yet; never a passport
   Without the row each keeps its own right: the writer's team (a super
   admin, everyone), HR, Travel.

   The calendar is always the WRITER's own — their events and the ones they
   are invited to (a declined one left out; a private one only as time).
   The CEO's assistant sees the meetings she booked for him, never his
   calendar (no delegation — owner, 25 Sep 2026).

   «Waiting for your decision» is computed for WHOEVER OPENS the report
   (LIVE_SOURCES), each kind by its own rule:
     leave        a request of someone whose manager they are, still
                  pending; with HR·edit, one the manager approved — or one
                  of someone with no manager
     overtime     with HR·edit: a closed day of the last 62 days with
                  overtime and no decision (the HR queue's own rule)
     correction   with HR·edit: an attendance correction still pending
     finance      the approvals queue's own rule: through its door
                  (lib/approvals/gate — internal, Finance · create) AND an
                  approver (super admin, CEO or accountant): an expense or
                  payment submitted for approval — a bill or a journal entry
                  only for whoever sees cost data
     to-do        a task they assigned that is waiting for their approval
     report       a report sent to them (To) that asks for their review
   A kind that cannot be read fails the whole block — said as such, never
   passed off as "nothing waiting".
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";
import { COST_SENSITIVE_KINDS, canApprove, listPending } from "@/lib/approvals";
import { requireApprovalsAccess } from "@/lib/approvals/gate";
import { feedWindow, loadCalendarFeed } from "@/lib/server/calendar-feed";
import { accountTimezone } from "@/lib/server/calendar-notify";
import { zonedToUtc } from "@/lib/calendar-tz";
import { loadPolicyRows, overtimeMinutes, pickPolicy, resolveEmployeeCountries } from "@/lib/server/work-calendar";
import { employeeNames } from "@/lib/server/attendance-records";
import { listPeople, loadOrgTree } from "@/lib/server/reports/core";
import { loadOwners } from "@/lib/server/reports/obligations";
import { loadTeamScope, teamWorkload } from "@/lib/server/reports/team";
import { OFFICE_MODULE } from "@/lib/reports/report-data";
import type { CalendarFact, DecisionItem, OccasionPerson, VisitorLetter } from "@/lib/reports/office";
import type { TeamWorkload } from "@/lib/reports/team";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const chunks = <T,>(xs: T[], n = 100): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const dmy = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "");
const span = (a: string | null, b: string | null) => (!a ? "" : !b || a === b ? dmy(a) : `${dmy(a)} → ${dmy(b)}`);
const addDay = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
function rows<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

/** Holds «CEO Office» (or is a super admin). */
export async function officeAllowed(auth: ServerAuthContext): Promise<boolean> {
  return auth.is_super_admin || (await requireModuleAction(auth, OFFICE_MODULE, "create")) === null;
}

/* ── Waiting for a decision (for the one who opens the report) ──────── */

/** The viewer's own employee row (the direct link first, then the person). */
async function myEmployeeId(auth: ServerAuthContext): Promise<string | null> {
  const { data: acct } = await supabaseServer.from("accounts").select("person_id").eq("id", auth.account_id).maybeSingle();
  const person = (acct as { person_id?: string | null } | null)?.person_id;
  const { data } = await supabaseServer.from("koleex_employees").select("id")
    .or(person ? `account_id.eq.${auth.account_id},person_id.eq.${person}` : `account_id.eq.${auth.account_id}`).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

type Leave = { id: string; employee_id: string; start_date: string; end_date: string; status: string; created_at: string | null };

async function leaveWaiting(auth: ServerAuthContext, me: string | null, hr: boolean): Promise<DecisionItem[]> {
  const out: DecisionItem[] = [];
  const cols = "id, employee_id, start_date, end_date, status, created_at";
  /* The manager step: requests of the people who list me as their manager. */
  if (me) {
    const team = rows<{ id: string }>(await supabaseServer.from("koleex_employees").select("id").eq("manager_id", me).neq("id", me).limit(500), "team");
    for (const part of chunks(team.map((t) => t.id))) {
      for (const r of rows<Leave>(await supabaseServer.from("hr_leave_requests").select(cols).in("employee_id", part).eq("status", "pending").limit(200), "leave")) {
        out.push({ kind: "leave", link: "leave_manager", id: r.id, item: span(r.start_date, r.end_date), from: r.employee_id, since: day(r.created_at) });
      }
    }
  }
  /* The HR step: approved by the manager, or filed by someone with none. */
  if (hr) {
    const list = rows<Leave>(await supabaseServer.from("hr_leave_requests").select(cols).in("status", ["pending", "manager_approved"]).limit(300), "leave (HR)");
    const pendingEmp = Array.from(new Set(list.filter((r) => r.status === "pending").map((r) => r.employee_id)));
    const managed = new Set<string>();
    for (const part of chunks(pendingEmp)) {
      for (const e of rows<{ id: string; manager_id: string | null }>(await supabaseServer.from("koleex_employees").select("id, manager_id").in("id", part), "managers")) {
        if (e.manager_id && e.manager_id !== e.id) managed.add(e.id);
      }
    }
    const mine = new Set(out.map((x) => x.id));
    for (const r of list) {
      if (r.employee_id === me || mine.has(r.id)) continue;
      if (r.status === "pending" && managed.has(r.employee_id)) continue;
      out.push({ kind: "leave", link: "leave_hr", id: r.id, item: span(r.start_date, r.end_date), from: r.employee_id, since: day(r.created_at) });
    }
  }
  return out;
}

/** HR's overtime queue, by its own rule (the policy's end time). */
async function overtimeWaiting(): Promise<DecisionItem[]> {
  const since = new Date(Date.now() - 62 * 86_400_000).toISOString().slice(0, 10);
  type Rec = { id: string; employee_id: string; date: string; clock_in: string | null; clock_out: string | null };
  const recs = rows<Rec>(await supabaseServer.from("hr_attendance_records").select("id, employee_id, date, clock_in, clock_out")
    .gte("date", since).not("clock_out", "is", null).is("overtime_status", null).limit(500), "overtime");
  if (!recs.length) return [];
  const [policies, countries] = await Promise.all([loadPolicyRows(), resolveEmployeeCountries(recs.map((r) => r.employee_id))]);
  const out: DecisionItem[] = [];
  for (const r of recs) {
    const minutes = overtimeMinutes(r.clock_in, r.clock_out, r.date, pickPolicy(policies, countries.get(r.employee_id) ?? null));
    if (minutes <= 0) continue;
    out.push({ kind: "overtime", link: "overtime", id: r.id, item: `${dmy(r.date)} · +${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, from: r.employee_id, since: r.date });
  }
  return out;
}

async function correctionsWaiting(): Promise<DecisionItem[]> {
  type C = { id: string; employee_id: string; date: string | null; created_at: string | null };
  return rows<C>(await supabaseServer.from("hr_attendance_corrections").select("id, employee_id, date, created_at").eq("status", "pending").limit(200), "corrections")
    .map((c) => ({ kind: "correction" as const, link: "correction", id: c.id, item: dmy(day(c.date)), from: c.employee_id, since: day(c.created_at) }));
}

/** Finance's queue — never a draft (the queue's own list counts drafts). */
async function financeWaiting(auth: ServerAuthContext, costs: boolean): Promise<DecisionItem[]> {
  if (!auth.tenant_id) return [];
  const items = await listPending(auth.tenant_id);
  return items
    .filter((i) => i.status !== "draft" && (costs || !COST_SENSITIVE_KINDS.has(i.kind)))
    .map((i) => ({ kind: i.kind, link: i.kind, id: i.id, item: i.ref || "—", from: i.party_name ?? "", since: day(i.submitted_at), amount: Number.isFinite(i.amount) ? i.amount : null, currency: i.currency || null }));
}

/** The to-dos they assigned that wait for their approval. */
async function todosWaiting(auth: ServerAuthContext): Promise<DecisionItem[]> {
  type Td = { id: string; title: string | null; updated_at: string | null; assigned_by_account_id: string | null; created_by_account_id: string | null };
  let q = supabaseServer.from("koleex_todos").select("id, title, updated_at, assigned_by_account_id, created_by_account_id")
    .eq("approval_state", "pending").or(`assigned_by_account_id.eq.${auth.account_id},and(assigned_by_account_id.is.null,created_by_account_id.eq.${auth.account_id})`).limit(200);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const list = rows<Td>(await q, "to-dos");
  if (!list.length) return [];
  const who = rows<{ todo_id: string; account_id: string }>(await supabaseServer.from("koleex_todo_assignees").select("todo_id, account_id").in("todo_id", list.map((x) => x.id)).limit(1000), "assignees");
  const by = new Map<string, string>();
  for (const w of who) if (!by.has(w.todo_id) && w.account_id !== auth.account_id) by.set(w.todo_id, w.account_id);
  return list.map((x) => ({ kind: "todo" as const, link: "todo", id: x.id, item: x.title?.trim() || "—", from: by.get(x.id) ?? "", since: day(x.updated_at) }));
}

/** The reports sent to them (To) that ask for their review. */
async function reportsWaiting(auth: ServerAuthContext): Promise<DecisionItem[]> {
  const mine = rows<{ report_id: string }>(await supabaseServer.from("work_report_recipients").select("report_id").eq("account_id", auth.account_id).eq("role", "to").limit(1000), "recipients");
  const out: DecisionItem[] = [];
  for (const part of chunks(mine.map((m) => m.report_id))) {
    type W = { id: string; author_account_id: string; period_start: string | null; period_end: string | null; submitted_at: string | null };
    for (const r of rows<W>(await supabaseServer.from("work_reports").select("id, author_account_id, period_start, period_end, submitted_at")
      .in("id", part).eq("status", "submitted").eq("review_required", true).eq("superseded", false), "reports")) {
      if (r.author_account_id === auth.account_id) continue;
      out.push({ kind: "report", link: "report", id: r.id, item: span(r.period_start, r.period_end), from: r.author_account_id, since: day(r.submitted_at) });
    }
  }
  return out;
}

/** Everything that waits for the viewer's decision, across the apps. */
export async function loadDecisions(auth: ServerAuthContext): Promise<DecisionItem[]> {
  const [me, hrEdit, exp, financeDoor] = await Promise.all([
    myEmployeeId(auth),
    requireModuleAction(auth, "HR", "edit").then((d) => d === null),
    getUserExperience(auth),
    requireApprovalsAccess(auth, "create").then((d) => d === null),
  ]);
  /* Only whoever may decide it: the queue's door (Finance · create) and an approver. */
  const finance = financeDoor && canApprove(exp.dashboard_role, exp.is_super_admin);
  const parts = await Promise.all([
    leaveWaiting(auth, me, hrEdit),
    hrEdit ? overtimeWaiting() : Promise.resolve([]),
    hrEdit ? correctionsWaiting() : Promise.resolve([]),
    finance ? financeWaiting(auth, exp.can_see_cost_data) : Promise.resolve([]),
    todosWaiting(auth),
    reportsWaiting(auth),
  ]);
  const items = parts.flat();
  /* "From": an employee (leave, attendance) or an account (to-do, report). */
  const [emps, people] = await Promise.all([
    employeeNames(items.filter((x) => x.kind === "leave" || x.kind === "overtime" || x.kind === "correction").map((x) => x.from)),
    listPeople(auth.tenant_id),
  ]);
  const acct = new Map(people.map((p) => [p.id, p.name]));
  return items.map((x) => ({
    ...x,
    from: x.kind === "leave" || x.kind === "overtime" || x.kind === "correction" ? emps.get(x.from) ?? "—"
      : x.kind === "todo" || x.kind === "report" ? acct.get(x.from) ?? "—" : x.from,
  }));
}

/* ── The writer's calendar ──────────────────────────────────────────── */

type FeedEvent = {
  id: string; title?: string | null; event_type?: string | null; start_at: string; end_at: string; all_day?: boolean | null;
  start_date?: string; end_date?: string; is_private?: boolean | null; location?: string | null; meeting_url?: string | null;
  source?: string | null; invite_status?: string | null;
};

/** The writer's own events in [from, to] (their timezone's days): real
 *  events only — never the mirrors of to-dos, tasks, leave or reports —
 *  and not an invitation they declined. */
export async function loadCalendarFacts(auth: ServerAuthContext, from: string, to: string): Promise<{ events: CalendarFact[]; tz: string; winFrom: number; winTo: number }> {
  const tz = await accountTimezone(auth.account_id);
  const ymd = (s: string) => [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))] as const;
  const [fy, fm, fd] = ymd(from);
  const [ty, tm, td] = ymd(addDay(to, 1));
  const winFrom = zonedToUtc(fy, fm, fd, 0, 0, 0, 0, tz);
  const winTo = zonedToUtc(ty, tm, td, 0, 0, 0, 0, tz);
  const feed = (await loadCalendarFeed(auth, auth.account_id, feedWindow(new Date(winFrom), new Date(winTo)))) as unknown as FeedEvent[];
  const real = feed.filter((e) => !e.source && e.invite_status !== "declined");
  const base = (id: string) => id.split("~")[0];
  const guests = new Map<string, number>();
  for (const part of chunks(Array.from(new Set(real.map((e) => base(e.id)))))) {
    for (const a of rows<{ event_id: string }>(await supabaseServer.from("koleex_calendar_event_attendees").select("event_id").in("event_id", part).neq("status", "declined").limit(5000), "guests")) {
      guests.set(a.event_id, (guests.get(a.event_id) ?? 0) + 1);
    }
  }
  const events: CalendarFact[] = real.map((e) => ({
    id: e.id, title: (e.title ?? "").trim(), kind: e.event_type ?? "event",
    start: e.all_day ? (e.start_date ?? e.start_at.slice(0, 10)) : e.start_at, end: e.all_day ? (e.end_date ?? e.end_at.slice(0, 10)) : e.end_at,
    allDay: !!e.all_day, private: !!e.is_private, location: e.location ?? null, url: e.meeting_url ?? null, guests: guests.get(base(e.id)) ?? 0,
  }));
  return { events, tz, winFrom, winTo };
}

/* ── Follow-ups per department ──────────────────────────────────────── */

/** Each person's open / overdue / finished work in [from, to], and their
 *  department. Whose: everyone (with «CEO Office», or a super admin), else
 *  the writer's team. */
export async function loadFollowups(auth: ServerAuthContext, office: boolean, from: string, to: string): Promise<{ work: Map<string, TeamWorkload>; deptOf: Map<string, string> }> {
  const everyone = office || auth.is_super_admin;
  const ids = everyone
    ? (await loadOwners(await loadOrgTree(auth.tenant_id))).map((o) => o.accountId)
    : (await loadTeamScope(auth)).owners.map((o) => o.accountId);
  if (!ids.length) return { work: new Map(), deptOf: new Map() };
  const today = new Date().toISOString().slice(0, 10);
  const [work, deptOf] = await Promise.all([teamWorkload(auth, ids, from, to, today), departmentsOf(ids)]);
  return { work, deptOf };
}

/** Each account's department: its person's primary active assignment. */
async function departmentsOf(accountIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const accts: Array<{ id: string; person_id: string | null }> = [];
  for (const part of chunks(accountIds)) accts.push(...rows<{ id: string; person_id: string | null }>(await supabaseServer.from("accounts").select("id, person_id").in("id", part), "accounts"));
  const persons = Array.from(new Set(accts.map((a) => a.person_id).filter((p): p is string => !!p)));
  if (!persons.length) return out;
  const [asg, depts] = await Promise.all([
    (async () => { const all: Array<{ person_id: string; department_id: string | null }> = []; for (const part of chunks(persons)) all.push(...rows<{ person_id: string; department_id: string | null }>(await supabaseServer.from("koleex_assignments").select("person_id, department_id").in("person_id", part).eq("is_active", true).eq("is_primary", true), "assignments")); return all; })(),
    supabaseServer.from("koleex_departments").select("id, name").limit(500).then((r) => rows<{ id: string; name: string }>(r, "departments")),
  ]);
  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const deptOfPerson = new Map(asg.filter((a) => a.department_id).map((a) => [a.person_id, deptName.get(a.department_id!) ?? ""]));
  for (const a of accts) { const d = a.person_id ? deptOfPerson.get(a.person_id) : ""; if (d) out.set(a.id, d); }
  return out;
}

/* ── Birthdays and work anniversaries ───────────────────────────────── */

/** Active staff (and those on leave): a name and the two dates, nothing
 *  else. With «CEO Office» or HR (the report route decides). */
export async function loadOccasionPeople(auth: ServerAuthContext): Promise<OccasionPerson[]> {
  type E = { id: string; employment_status: string | null; birth_date: string | null; hire_date: string | null; people?: { full_name?: string | null } | { full_name?: string | null }[] | null };
  const list = rows<E>(await supabaseServer.from("koleex_employees").select("id, employment_status, birth_date, hire_date, people(full_name)")
    .or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null").limit(3000), "employees");
  return list.filter((e) => e.employment_status === "active" || e.employment_status === "on_leave" || e.employment_status === "probation")
    .map((e) => ({ id: e.id, name: one(e.people)?.full_name?.trim() || "—", birth: day(e.birth_date), hire: day(e.hire_date) }));
}

/* ── Visitors ───────────────────────────────────────────────────────── */

/** The invitation letters whose stay meets [from, to] — issued, or still a
 *  draft (the row says which: a draft's visitor may not come). */
export async function loadVisitorLetters(auth: ServerAuthContext, from: string, to: string): Promise<VisitorLetter[]> {
  type L = { id: string; visitor_name: string; visitor_company: string | null; visitor_country: string | null; arrival_date: string; departure_date: string; purpose: string; status: string };
  let q = supabaseServer.from("invitation_letters").select("id, visitor_name, visitor_company, visitor_country, arrival_date, departure_date, purpose, status")
    .lte("arrival_date", to).gte("departure_date", from).limit(300);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  return rows<L>(await q, "invitation letters").map((l) => ({
    id: l.id, visitor: l.visitor_name, company: l.visitor_company, country: l.visitor_country, arrival: l.arrival_date.slice(0, 10), departure: l.departure_date.slice(0, 10), purpose: l.purpose, status: l.status,
  }));
}

/** Whether the writer may read a source that «CEO Office» opens, without the row. */
export async function ownRight(auth: ServerAuthContext, module: "HR" | "Travel"): Promise<boolean> {
  return module === "HR" ? (await requireModuleAction(auth, "HR", "view")) === null : (await requireModuleAccess(auth, "Travel")) === null;
}

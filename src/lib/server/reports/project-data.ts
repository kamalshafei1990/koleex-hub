import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the Projects numbers (Phase 5C, owner's picks 26 Sep
   2026). The counting is the pure src/lib/reports/numbers-5c.ts.

   Whose projects: the Projects app's own rule — a super admin every
   project; anyone else the projects they manage, created, are a member of
   or hold a task in (involvedProjectsOr). Templates never count. A block
   about one project (DATA_ABOUT) reads it only when the writer can see it;
   without one, a block covers every project the writer can see. A project's
   expenses also need the Expenses app. Nothing here writes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { involvedProjectsOr } from "@/lib/server/project-access";
import { listPeople } from "@/lib/server/reports/core";
import type { ReportDataRow } from "@/lib/reports/templates";
import { DATA_ABOUT, type ProjectSource } from "@/lib/reports/report-data";
import { budgetRows, daysUntil, projectHealth, riskReasons, scheduleRows, type PlanStep, type ProjectFact } from "@/lib/reports/numbers-5c";

export interface ProjectCtx { auth: ServerAuthContext; start: string; end: string; today: string; about: (type: "project") => string | null }
type Answer = { rows: ReportDataRow[] } | "denied" | "about";

const chunks = <T,>(xs: T[], n = 100): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}
const memo = <T,>(f: () => Promise<T>): (() => Promise<T>) => { let p: Promise<T> | null = null; return () => (p ??= f()); };

type Proj = {
  id: string; name: string | null; code: string | null; status: string; manager_account_id: string | null;
  planned_start: string | null; planned_end: string | null; budget_hours: unknown; budget_amount: unknown; billing_rate: unknown; currency: string | null;
  progress_pct: unknown; archived_at: string | null;
};
type Task = {
  id: string; project_id: string; parent_task_id: string | null; title: string | null; status: string | null; priority: string | null;
  assignee_account_id: string | null; due_date: string | null; closed_at: string | null; blocked_by_task_ids: string[] | null;
};

export interface ProjectShared {
  projects: () => Promise<Proj[]>;
  tasks: () => Promise<Task[]>;
  hours: () => Promise<Array<{ project_id: string; account_id: string | null; minutes: number; entry_date: string | null }>>;
  names: () => Promise<Map<string, string>>;
}

/** The projects the writer can see, their tasks and time — read once for
 *  all of a report's Projects blocks. */
export function projectShared(auth: ServerAuthContext): ProjectShared {
  const projects = memo(async () => {
    let q = supabaseServer.from("projects").select("id, name, code, status, manager_account_id, planned_start, planned_end, budget_hours, budget_amount, billing_rate, currency, progress_pct, archived_at").eq("is_template", false);
    if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
    if (!auth.is_super_admin) q = q.or(await involvedProjectsOr(auth.tenant_id ?? "", auth.account_id));
    return listOf<Proj>(await q.order("name", { ascending: true }).limit(1000), "projects");
  });
  const tasks = memo(async () => {
    const ids = (await projects()).map((p) => p.id);
    const out: Task[] = [];
    for (const part of chunks(ids)) {
      let q = supabaseServer.from("project_tasks").select("id, project_id, parent_task_id, title, status, priority, assignee_account_id, due_date, closed_at, blocked_by_task_ids").in("project_id", part).limit(5000);
      if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
      out.push(...listOf<Task>(await q, "project tasks"));
    }
    return out;
  });
  const hours = memo(async () => {
    const ids = (await projects()).map((p) => p.id);
    const out: Array<{ project_id: string; account_id: string | null; minutes: number; entry_date: string | null }> = [];
    for (const part of chunks(ids)) {
      let q = supabaseServer.from("project_time_entries").select("project_id, account_id, minutes, entry_date").in("project_id", part).limit(10000);
      if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
      out.push(...listOf<typeof out[number]>(await q, "time entries"));
    }
    return out;
  });
  const names = memo(async () => new Map((await listPeople(auth.tenant_id)).map((p) => [p.id, p.name])));
  return { projects, tasks, hours, names };
}

const isOpen = (t: Task) => t.status === "open";
const isDone = (t: Task) => t.status === "done";

/** A project's numbers, as the portfolio and its health read them. */
function factOf(p: Proj, tasks: Task[], minutes: number, today: string): ProjectFact {
  const mine = tasks.filter((t) => t.project_id === p.id);
  return {
    id: p.id, name: p.name || p.code || "—", status: p.status, progress: num(p.progress_pct), plannedStart: day(p.planned_start), plannedEnd: day(p.planned_end),
    budgetHours: num(p.budget_hours), loggedHours: Math.round((minutes / 60) * 10) / 10,
    open: mine.filter(isOpen).length, overdue: mine.filter((t) => isOpen(t) && !!t.due_date && t.due_date.slice(0, 10) < today).length, done: mine.filter(isDone).length,
  };
}

export async function projectData(src: ProjectSource, x: ProjectCtx, sh: ProjectShared): Promise<Answer> {
  const about = DATA_ABOUT[src];
  const subject = about ? x.about("project") : null;
  if (about?.required && !subject) return "about";
  const visible = await sh.projects();
  if (subject && !visible.some((p) => p.id === subject)) return "denied";
  const inScope = subject ? visible.filter((p) => p.id === subject) : visible.filter((p) => !p.archived_at);
  const scopeIds = new Set(inScope.map((p) => p.id));
  const { start: from, end: to, today } = x;
  /* A report of one day that is not a daily (a charter, a plan, a closure,
     a team's evaluation) is about the whole project: what was finished and
     the hours logged count from its start, not that one day. */
  const allTime = from === to;
  const inDays = (d: string | null) => allTime || (!!d && d >= from && d <= to);
  const projName = new Map(visible.map((p) => [p.id, p.name || p.code || "—"]));

  if (src === "project_expenses") {
    if (await requireModuleAccess(x.auth, "Expenses")) return "denied";
    let q = supabaseServer.from("finance_expenses").select("id, title, category_id, expense_date, amount, currency, approval_status").eq("linked_project_id", subject!).neq("approval_status", "rejected");
    if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
    const rows = listOf<{ id: string; title: string | null; category_id: string | null; expense_date: string | null; amount: unknown; currency: string | null; approval_status: string | null }>(await q.order("expense_date", { ascending: true }).limit(101), "project expenses");
    const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter((c): c is string => !!c)));
    const cats = catIds.length ? new Map(listOf<{ id: string; name: string | null }>(await supabaseServer.from("finance_expense_categories").select("id, name").in("id", catIds), "expense categories").map((c) => [c.id, c.name ?? ""])) : new Map<string, string>();
    return { rows: rows.map((e) => ({ key: e.id, currency: e.currency ?? undefined, cells: { title: e.title || "—", category: (e.category_id && cats.get(e.category_id)) || "", date: day(e.expense_date), amount: num(e.amount), status: e.approval_status } })) };
  }

  const [tasks, names] = await Promise.all([sh.tasks(), sh.names()]);
  const mine = tasks.filter((t) => scopeIds.has(t.project_id));
  const person = (id: string | null) => (id ? names.get(id) ?? "—" : "—");
  const taskKey = (t: Task) => `${t.project_id}:${t.id}`;

  switch (src) {
    case "project_overview": case "portfolio": case "projects_at_risk": case "project_budget": {
      const hours = await sh.hours();
      const minutesOf = (pid: string) => hours.filter((h) => h.project_id === pid).reduce((a, h) => a + (Number(h.minutes) || 0), 0);
      if (src === "project_budget") {
        const p = inScope[0];
        return { rows: budgetRows({ budgetHours: num(p.budget_hours), loggedHours: Math.round((minutesOf(p.id) / 60) * 10) / 10, budgetAmount: num(p.budget_amount), rate: num(p.billing_rate), currency: p.currency }) };
      }
      const facts = inScope.map((p) => factOf(p, tasks, minutesOf(p.id), today));
      if (src === "project_overview") {
        const f = facts[0];
        return { rows: [{ key: f.id, cells: { project: f.name, starts: f.plannedStart, ends: f.plannedEnd, progress: f.progress, open_work: f.open, overdue_work: f.overdue, done_work: f.done, logged_h: f.loggedHours, budget_h: f.budgetHours } }] };
      }
      if (src === "portfolio") {
        return { rows: facts.map((f) => ({ key: f.id, cells: { project: f.name, status: f.status, progress: f.progress, open_work: f.open, overdue_work: f.overdue, ends: f.plannedEnd, health: projectHealth(f, today) } })) };
      }
      return { rows: facts.map((f) => ({ f, r: riskReasons(f, today) })).filter(({ r }) => r.reasons.length)
        .sort((a, b) => b.r.daysOver - a.r.daysOver || b.f.overdue - a.f.overdue)
        .map(({ f, r }) => ({ key: f.id, cells: { project: f.name, reasons: r.reasons.join("|"), overdue_work: f.overdue, days_over: r.daysOver } })) };
    }
    case "project_done":
      return { rows: mine.filter((t) => isDone(t) && t.closed_at && inDays(day(t.closed_at)))
        .sort((a, b) => (allTime ? String(b.closed_at).localeCompare(String(a.closed_at)) : String(a.closed_at).localeCompare(String(b.closed_at))))
        .map((t) => ({ key: taskKey(t), cells: { task: t.title || "—", project: projName.get(t.project_id) ?? "—", person: person(t.assignee_account_id), closed: day(t.closed_at) } })) };
    case "project_overdue":
      return { rows: mine.filter((t) => isOpen(t) && t.due_date && t.due_date.slice(0, 10) < today)
        .map((t) => ({ t, late: daysUntil(t.due_date!.slice(0, 10), today) })).sort((a, b) => b.late - a.late)
        .map(({ t, late }) => ({ key: taskKey(t), cells: { task: t.title || "—", project: projName.get(t.project_id) ?? "—", person: person(t.assignee_account_id), due: day(t.due_date), late, priority: t.priority } })) };
    case "project_blocked": {
      const byId = new Map(tasks.map((t) => [t.id, t]));
      return { rows: mine.filter((t) => isOpen(t) && (t.blocked_by_task_ids ?? []).some((b) => { const bt = byId.get(b); return !!bt && isOpen(bt); }))
        .map((t) => ({ key: taskKey(t), cells: {
          task: t.title || "—", project: projName.get(t.project_id) ?? "—",
          waits_for: (t.blocked_by_task_ids ?? []).map((b) => byId.get(b)).filter((bt): bt is Task => !!bt && isOpen(bt)).map((bt) => bt.title || "—").join(", "),
          person: person(t.assignee_account_id), due: day(t.due_date),
        } })) };
    }
    case "project_milestones": case "project_schedule": {
      const ms: Array<{ id: string; project_id: string; name: string | null; due_date: string | null; is_reached: boolean | null }> = [];
      for (const part of chunks(Array.from(scopeIds))) {
        let q = supabaseServer.from("project_milestones").select("id, project_id, name, due_date, is_reached").in("project_id", part).order("due_date", { ascending: true }).limit(1000);
        if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
        ms.push(...listOf<typeof ms[number]>(await q, "milestones"));
      }
      if (src === "project_schedule") {
        const steps: PlanStep[] = [
          ...ms.map((m) => ({ key: `m:${m.id}`, title: m.name || "—", kind: "milestone" as const, due: day(m.due_date), done: null, reached: !!m.is_reached })),
          ...mine.filter((t) => !t.parent_task_id && t.status !== "cancelled").map((t) => ({ key: `t:${t.id}`, title: t.title || "—", kind: "task" as const, due: day(t.due_date), done: isDone(t) ? day(t.closed_at) : null, reached: isDone(t) })),
        ];
        return { rows: scheduleRows(steps, today) };
      }
      /* Without a project: those falling due in the report's days or the
         month after, and those past their date and not reached. */
      const soon = subject ? null : new Date(Date.parse(`${to}T00:00:00Z`) + 31 * 86_400_000).toISOString().slice(0, 10);
      return { rows: ms.filter((m) => subject || (m.due_date && ((m.due_date >= from && m.due_date <= soon!) || (!m.is_reached && m.due_date < today))))
        .map((m) => ({ key: m.id, cells: {
          milestone: m.name || "—", project: projName.get(m.project_id) ?? "—", due: day(m.due_date), state: m.is_reached ? "reached" : "open",
          late: !m.is_reached && m.due_date && m.due_date.slice(0, 10) < today ? daysUntil(m.due_date.slice(0, 10), today) : null,
        } })) };
    }
    case "project_team": {
      const hours = await sh.hours();
      const members: Array<{ project_id: string; account_id: string; role: string }> = [];
      for (const part of chunks(Array.from(scopeIds))) {
        let q = supabaseServer.from("project_members").select("project_id, account_id, role").in("project_id", part);
        if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
        const res = await q;
        /* A missing members table (migration pending) reads as no members. */
        if (!res.error) members.push(...((res.data ?? []) as typeof members));
      }
      const roleOf = new Map<string, string>();
      for (const p of inScope) if (p.manager_account_id) roleOf.set(p.manager_account_id, "manager");
      for (const m of members) if (!roleOf.has(m.account_id)) roleOf.set(m.account_id, m.role);
      for (const t of mine) if (t.assignee_account_id && !roleOf.has(t.assignee_account_id)) roleOf.set(t.assignee_account_id, "assignee");
      return { rows: Array.from(roleOf, ([acc, role]) => {
        const theirs = mine.filter((t) => t.assignee_account_id === acc);
        const minutes = hours.filter((h) => scopeIds.has(h.project_id) && h.account_id === acc && inDays(h.entry_date)).reduce((a, h) => a + (Number(h.minutes) || 0), 0);
        return { key: acc, cells: {
          person: person(acc), role, open_work: theirs.filter(isOpen).length,
          done_work: theirs.filter((t) => isDone(t) && t.closed_at && inDays(day(t.closed_at))).length,
          logged_h: Math.round((minutes / 60) * 10) / 10,
        } };
      }).sort((a, b) => String(a.cells.person).localeCompare(String(b.cells.person))) };
    }
  }
  return { rows: [] };
}

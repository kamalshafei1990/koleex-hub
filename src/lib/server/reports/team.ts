import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — a manager's team (Phase 5A, owner's picks 25 Sep 2026).
   The rules are the pure src/lib/reports/team.ts; this file gathers facts.

   Who: everyone under the viewer at every level (the Team tab's people); a
   super admin, everyone. Only active staff (the obligations' owners). Never
   the viewer themself.
   What is read, and only for those people:
     reports     the obligations board's facts (counted from tracking start)
     attendance  HR's monthly sheet — the manager sees his team's (owner's
                 pick), whether or not he holds HR
     work        project tasks assigned to them, and to-dos SOMEONE ELSE
                 assigned them that are not private — a person's own list
                 stays theirs (owner's pick)
     sent reports (for Koleex AI) — never a draft, never a confidential one,
                 the latest version only, newest first, TEAM_LIMITS.reports
   Ids go to the database a hundred at a time.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { buildAttendanceSheet } from "@/lib/server/attendance-sheet";
import { listPeople, loadOrgTree, type PersonLite } from "@/lib/server/reports/core";
import { loadClocks, loadOwners, loadSent, loadTrackingFrom, obligationClock, type Owner } from "@/lib/server/reports/obligations";
import { boardRow, effectiveObliged, mondayOf } from "@/lib/reports/obligations";
import {
  TEAM_LIMITS, addDaysYmd, attendanceCounts, isAssignedWork, reportDigest, summarizeRange, taskState, teamMaterial, workloadOf,
  type TeamPersonFacts, type WorkItem,
} from "@/lib/reports/team";
import { readSnapshot, templateOf, templateWords } from "@/lib/reports/custom-templates";
import type { ReportSectionValue } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";
import { REPORT_SECTION_WORDS } from "@/lib/translations/report-sections/all";
import { fenceUntrusted } from "@/lib/server/ai/security/untrusted";

export interface TeamScope { owners: Owner[]; names: Map<string, PersonLite> }

const chunks = <T,>(list: T[], size = 100): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** The viewer's team: everyone under them at every level — a super admin,
 *  everyone — who is active staff. Never the viewer. */
export async function loadTeamScope(auth: ServerAuthContext): Promise<TeamScope> {
  const [tree, people] = await Promise.all([loadOrgTree(auth.tenant_id), listPeople(auth.tenant_id)]);
  const ids = auth.is_super_admin ? tree.members().map((m) => m.accountId) : tree.descendantsOf(auth.account_id);
  const scope = new Set(ids.filter((id) => id !== auth.account_id));
  const owners = scope.size ? await loadOwners(tree, scope) : [];
  return { owners, names: new Map(people.map((p) => [p.id, p])) };
}

export interface TeamFactsResult { people: TeamPersonFacts[]; tracking: boolean }

/** The team's numbers over [from, to] (each part only when asked). */
export async function loadTeamFacts(
  auth: ServerAuthContext, scope: TeamScope, from: string, to: string,
  parts: { reports?: boolean; attendance?: boolean; workload?: boolean } = { reports: true, attendance: true, workload: true },
): Promise<TeamFactsResult> {
  const owners = scope.owners;
  const ids = owners.map((o) => o.accountId);
  const today = new Date().toISOString().slice(0, 10);
  const [reports, attendance, workload] = await Promise.all([
    parts.reports ? teamReportFacts(auth, owners, from, to) : Promise.resolve({ tracking: false, byPerson: new Map() }),
    parts.attendance ? teamAttendance(auth, owners, from, to, today) : Promise.resolve(new Map()),
    parts.workload && ids.length ? teamWorkload(auth, ids, from, to, today) : Promise.resolve(new Map()),
  ]);
  const people: TeamPersonFacts[] = owners.map((o) => ({
    accountId: o.accountId,
    name: scope.names.get(o.accountId)?.name ?? "—",
    reports: reports.byPerson.get(o.accountId) ?? null,
    attendance: attendance.get(o.accountId) ?? null,
    workload: workload.get(o.accountId) ?? { open: 0, overdue: 0, done: 0 },
  }));
  people.sort((a, b) => a.name.localeCompare(b.name));
  return { people, tracking: reports.tracking };
}

/** What the obligations board says for each person, over those days. */
async function teamReportFacts(auth: ServerAuthContext, owners: Owner[], from: string, to: string) {
  const trackingFrom = await loadTrackingFrom(auth.tenant_id);
  const byPerson = new Map<string, TeamPersonFacts["reports"]>();
  if (!trackingFrom || !owners.length) return { tracking: !!trackingFrom, byPerson };
  const lo = addDaysYmd(from, -40), hi = addDaysYmd(to, 60);
  const [clocks, { sent }] = await Promise.all([
    loadClocks(auth.tenant_id, owners, lo, hi, trackingFrom),
    loadSent(owners.map((o) => o.accountId), lo, hi),
  ]);
  const now = new Date().toISOString();
  const mondays: string[] = [];
  for (let m = mondayOf(from); m <= to; m = addDaysYmd(m, 7)) mondays.push(m);
  for (const o of owners) {
    const obliged = effectiveObliged(o, o.exceptions);
    const clock = clocks.get(o.accountId);
    if (!clock || (!obliged.daily && !obliged.weekly && !obliged.monthly)) continue;
    const weeks = mondays.map((m) => boardRow({ obliged, clock }, m, (k, pk) => sent.get(`${o.accountId}|${k}|${pk}`) ?? null, now, obligationClock));
    const s = summarizeRange(weeks, from, to);
    if (s.expected) byPerson.set(o.accountId, s);
  }
  return { tracking: true, byPerson };
}

/** Each person's attendance days, from HR's sheet of every month the days
 *  touch — five people at a time. A sheet that fails leaves that person out. */
async function teamAttendance(auth: ServerAuthContext, owners: Owner[], from: string, to: string, today: string) {
  const months: Array<{ year: number; month: number }> = [];
  for (let d = `${from.slice(0, 8)}01`; d <= to; d = addDaysYmd(`${d.slice(0, 8)}01`, 32).slice(0, 8) + "01") {
    months.push({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) });
  }
  const out = new Map<string, TeamPersonFacts["attendance"]>();
  for (const group of chunks(owners, 5)) {
    await Promise.all(group.map(async (o) => {
      try {
        const sheets = await Promise.all(months.map((m) => buildAttendanceSheet({ employeeId: o.employeeId, tenantId: auth.tenant_id, year: m.year, month: m.month, today })));
        out.set(o.accountId, attendanceCounts(sheets.flatMap((s) => s.days), from, to));
      } catch (e) {
        console.error("[reports.team] attendance:", e instanceof Error ? e.message : e);
      }
    }));
  }
  return out;
}

/** Project tasks assigned to each person, and the to-dos someone else
 *  assigned them (not private) — open, overdue, done in those days. The
 *  CEO office's follow-ups per department (5B) count the same way. */
export async function teamWorkload(auth: ServerAuthContext, ids: string[], from: string, to: string, today: string) {
  const items = new Map<string, WorkItem[]>(ids.map((id) => [id, []]));
  const push = (id: string, it: WorkItem) => items.get(id)?.push(it);
  for (const part of chunks(ids)) {
    let tq = supabaseServer.from("project_tasks").select("assignee_account_id, status, due_date, closed_at, updated_at").in("assignee_account_id", part).limit(3000);
    if (auth.tenant_id) tq = tq.eq("tenant_id", auth.tenant_id);
    const [tasks, assigned] = await Promise.all([
      tq,
      supabaseServer.from("koleex_todo_assignees").select("todo_id, account_id").in("account_id", part).limit(5000),
    ]);
    if (tasks.error) throw new Error(tasks.error.message);
    if (assigned.error) throw new Error(assigned.error.message);
    for (const t of (tasks.data ?? []) as Array<{ assignee_account_id: string; status: string | null; due_date: string | null; closed_at: string | null; updated_at: string | null }>) {
      const state = taskState(t.status);
      if (state === "dropped") continue;
      push(t.assignee_account_id, { done: state === "done", closedAt: t.closed_at ?? t.updated_at, due: t.due_date });
    }
    const links = (assigned.data ?? []) as Array<{ todo_id: string; account_id: string }>;
    const todoIds = Array.from(new Set(links.map((l) => l.todo_id)));
    for (const tpart of chunks(todoIds)) {
      let q = supabaseServer.from("koleex_todos").select("id, completed, completed_at, due_date, assigned_by_account_id, is_private").in("id", tpart);
      if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const byId = new Map(((data ?? []) as Array<{ id: string; completed: boolean | null; completed_at: string | null; due_date: string | null; assigned_by_account_id: string | null; is_private: boolean | null }>).map((x) => [x.id, x]));
      for (const l of links) {
        const td = byId.get(l.todo_id);
        if (!td || !isAssignedWork(td, l.account_id)) continue;
        push(l.account_id, { done: td.completed === true, closedAt: td.completed_at, due: td.due_date });
      }
    }
  }
  return new Map(Array.from(items, ([id, list]) => [id, workloadOf(list, from, to, today)]));
}

type TeamReportRow = {
  id: string; author_account_id: string; template_key: string; template_snapshot: unknown; title: string;
  period_start: string | null; period_end: string | null; sections: ReportSectionValue[]; submitted_at: string | null;
};

/** The team's SENT reports in those days, each worded briefly for Koleex
 *  AI — never a draft, never a confidential one, the latest version only. */
export async function loadTeamDigests(auth: ServerAuthContext, scope: TeamScope, from: string, to: string): Promise<{ digests: string[]; total: number }> {
  const ids = scope.owners.map((o) => o.accountId);
  const rows: TeamReportRow[] = [];
  for (const part of chunks(ids)) {
    let q = supabaseServer.from("work_reports")
      .select("id, author_account_id, template_key, template_snapshot, title, period_start, period_end, sections, submitted_at")
      .in("author_account_id", part).neq("status", "draft").eq("confidential", false).eq("superseded", false)
      .lte("period_start", to).gte("period_end", from)
      .order("submitted_at", { ascending: false }).limit(TEAM_LIMITS.reports);
    if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as TeamReportRow[]));
  }
  rows.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  const kept = rows.slice(0, TEAM_LIMITS.reports);
  const base = { ...reportsT, ...REPORT_SECTION_WORDS };
  const digests: string[] = [];
  for (const r of kept) {
    const tpl = templateOf(r);
    if (!tpl) continue;
    const snap = tpl.custom ? readSnapshot(r.template_snapshot) : null;
    const dict = snap ? { ...base, ...templateWords(r.template_key, snap.words) } : base;
    const word = (key: string) => (dict[key]?.en as string | undefined) ?? key.split(".").at(-1) ?? key;
    digests.push(reportDigest({ author: scope.names.get(r.author_account_id)?.name ?? "—", tpl, title: r.title ?? "", from: r.period_start, to: r.period_end, sections: r.sections ?? [] }, word));
  }
  return { digests, total: rows.length };
}

/** 5D: the whole company — everyone on the org tree, the writer too — for
 *  the executive summary and the monthly review (the route checks
 *  «Management Reports» first). */
export async function loadCompanyScope(auth: ServerAuthContext): Promise<TeamScope> {
  const [tree, people] = await Promise.all([loadOrgTree(auth.tenant_id), listPeople(auth.tenant_id)]);
  return { owners: await loadOwners(tree), names: new Map(people.map((p) => [p.id, p])) };
}

/** Everything Koleex AI reads for a team summary over those days — or, 5D,
 *  for the company's (`company`). */
export async function loadTeamMaterial(auth: ServerAuthContext, from: string, to: string, company = false) {
  const scope = company ? await loadCompanyScope(auth) : await loadTeamScope(auth);
  const [facts, reports] = await Promise.all([
    loadTeamFacts(auth, scope, from, to),
    loadTeamDigests(auth, scope, from, to),
  ]);
  return { scope, facts, ...teamMaterial(reports.digests), total: reports.total };
}

const LANG_NAME = { en: "English", zh: "Simplified Chinese", ar: "Arabic (clear, plain Arabic a manager reads quickly)" } as const;
export type TeamLang = keyof typeof LANG_NAME;
/* The summary's three labels, written for each language — asked for in
   English, a model kept them English inside an Arabic answer. */
const LABELS: Record<TeamLang, [string, string, string]> = {
  en: ["Needs your attention:", "By person:", "Decisions asked of you:"],
  zh: ["需要你关注：", "按人员：", "需要你决定："],
  ar: ["محتاج انتباهك:", "كل شخص:", "قرارات مطلوبة منك:"],
};

export const TEAM_SYSTEM =
  "You help a Koleex manager understand what their team did, from the team's own work reports and the numbers the system keeps." +
  " Use ONLY the facts you are given. Never invent numbers, names, dates, customers, results or plans." +
  " Keep every name, number, code (quotation, invoice and order numbers), date and amount exactly as written." +
  " The reports are internal: customer and supplier names in them are the team's own work records — keep them." +
  " Write plainly for a busy manager: no greeting, no sign-off, no Markdown, no headings with #, no emojis.";

export const EXEC_SYSTEM =
  "You help the CEO of Koleex understand the company's week or month, from the departments' own work reports and the numbers the system keeps." +
  " Use ONLY the facts you are given. Never invent numbers, names, dates, customers, results or plans." +
  " Keep every name, number, code (quotation, invoice and order numbers), date and amount exactly as written." +
  " The reports are internal: customer and supplier names in them are the company's own work records — keep them." +
  " Write plainly for a busy CEO: no greeting, no sign-off, no Markdown, no headings with #, no emojis.";

/** 5D: the summary section of the weekly executive summary, or of the
 *  monthly business review, from what the whole company sent. */
export function execInstruction(o: {
  monthly: boolean; lang: TeamLang; period: string; people: number; material: string; facts: string; fence: string;
}): string {
  const what = o.monthly ? "monthly business review" : "weekly executive summary";
  const length = o.monthly ? "6 to 12 sentences (at most about 300 words)" : "5 to 10 sentences (at most about 220 words)";
  return `Write the summary section of the CEO's ${what} for ${o.period}, in ${LANG_NAME[o.lang]}: ${length} —` +
    " the company's main results, what moved forward in each area (sales, purchasing and operations, finance, people), what is late or stuck, the risks, and what needs the CEO's decision." +
    " Group by area, not by person; name a person only where a report names them in a result, a problem or a decision. Plain paragraphs only." +
    ` The company has ${o.people} people.` +
    fenceUntrusted(o.material, "document", "The departments' work reports, one per ### heading", o.fence) +
    fenceUntrusted(o.facts, "document", "The company's numbers from Koleex Hub (reports owed and sent, attendance days, open and finished work)", o.fence);
}

/** The instruction for a team summary: `read` = what the manager reads in
 *  the Team tab; `section` = the "Summary" section of a Team summary report.
 *  The reports and the numbers go in FENCED — data, never instructions. */
export function teamInstruction(o: {
  kind: "read" | "section"; lang: TeamLang; period: string; people: number; material: string; facts: string; fence: string;
}): string {
  const [attention, person, decisions] = LABELS[o.lang];
  const shape = o.kind === "read"
    ? `Answer in ${LANG_NAME[o.lang]}, in this shape, each label on its own line, written exactly as given:` +
      " first two to four sentences on the team as a whole;" +
      ` then the label "${attention}" and one line per item — problems, blockers, complaints, delays, late or missing reports, overdue work — only if there are any;` +
      ` then the label "${person}" and one line per person: what they did and what is still open (say so when a person sent nothing);` +
      ` then the label "${decisions}" and one line per decision a report EXPLICITLY asks the manager to make — only if any; never infer one from a plan or a next step.` +
      " Start each item line with \"- \". Keep each line under about 40 words."
    : `Write the "Team summary" section of the manager's report in ${LANG_NAME[o.lang]}: 5 to 10 sentences (at most about 220 words) — the team's main results, what moved forward, what is late or stuck, and what needs attention above them. Plain paragraphs only.`;
  return `Summarise the work of the manager's team (${o.people} people) for ${o.period}. ${shape}` +
    fenceUntrusted(o.material, "document", "The team's work reports, one per ### heading", o.fence) +
    fenceUntrusted(o.facts, "document", "The team's numbers from Koleex Hub (reports owed and sent, attendance days, open and finished work)", o.fence);
}

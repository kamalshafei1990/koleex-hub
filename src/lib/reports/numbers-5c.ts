/* ---------------------------------------------------------------------------
   Reports — the HR, Projects, Inventory and Finance numbers (Phase 5C,
   owner's picks 26 Sep 2026), pure: how each block counts, from facts the
   server gathered (src/lib/server/reports/{hr,project,stock,finance}-data.ts).
   Only the server and validate:reports import this file — the rows reach
   the page already computed.

   Dates are YYYY-MM-DD. Every row has a stable key; a row a note or a typed
   figure rides on is keyed by its record's id (a person, a stock line, a
   category in one currency).
   --------------------------------------------------------------------------- */

import type { ReportDataRow } from "./templates";

const DAY = 86_400_000;
const ms = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
export const addDays = (ymd: string, n: number) => new Date(ms(ymd) + n * DAY).toISOString().slice(0, 10);
export const daysUntil = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/* ── HR: a person's days ────────────────────────────────────────────── */

/** One day of HR's attendance sheet, as far as a report reads it. */
export interface SheetDayLite { date: string; status: string; hours: number | null; lateMin: number; overtimeH: number; overtimeState: string | null; overtimeApprovedH: number }

export interface PersonDays {
  workdays: number; present: number; late: number; absent: number; leave: number;
  hours: number; lateMin: number; overtimeDays: number; approvedH: number; pendingH: number;
}

/** A person's days inside [from, to]: a working day is one they were
 *  present (on time, late or half a day), absent or on leave — a weekend, a
 *  holiday, a day before counting started or still to come is none of them.
 *  Late days also count as present; only approved overtime is "approved". */
export function personDays(days: SheetDayLite[], from: string, to: string): PersonDays {
  const out: PersonDays = { workdays: 0, present: 0, late: 0, absent: 0, leave: 0, hours: 0, lateMin: 0, overtimeDays: 0, approvedH: 0, pendingH: 0 };
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    switch (d.status) {
      case "present": case "half_day": out.present++; out.workdays++; break;
      case "late": out.present++; out.late++; out.workdays++; break;
      case "absent": out.absent++; out.workdays++; break;
      case "leave": out.leave++; out.workdays++; break;
      default: break;
    }
    out.hours += d.hours ?? 0;
    out.lateMin += d.lateMin || 0;
    if (d.overtimeH > 0) {
      out.overtimeDays++;
      if (d.overtimeState === "pending") out.pendingH += d.overtimeH;
    }
    out.approvedH += d.overtimeApprovedH || 0;
  }
  out.hours = r1(out.hours); out.approvedH = r1(out.approvedH); out.pendingH = r1(out.pendingH);
  return out;
}

/* ── HR: the file ───────────────────────────────────────────────────── */

/** What an employee's file lacks — coded, each in words (blk.st.no_*).
 *  Presence only: a bank account or an ID is never read, only whether HR
 *  has it. */
export interface FileFacts {
  department: string | null; managerId: string | null; hireDate: string | null; birthDate: string | null;
  idDocument: boolean; emergency: boolean; bank: boolean; documents: number;
}
export function fileGaps(f: FileFacts): string[] {
  const out: string[] = [];
  if (!f.department) out.push("no_department");
  if (!f.managerId) out.push("no_manager");
  if (!f.hireDate) out.push("no_hire_date");
  if (!f.birthDate) out.push("no_birth_date");
  if (!f.idDocument) out.push("no_id_document");
  if (!f.emergency) out.push("no_emergency");
  if (!f.bank) out.push("no_bank");
  if (!f.documents) out.push("no_documents");
  return out;
}

/* ── HR: what expires ───────────────────────────────────────────────── */

export interface ExpiryFact { key: string; person: string; employeeId: string; what: string; date: string }

/** What expires in [today, today + horizon days], soonest first, with its
 *  days left. */
export function expiryRows(facts: ExpiryFact[], today: string, horizon: number): ReportDataRow[] {
  const last = addDays(today, horizon);
  return facts.filter((f) => f.date >= today && f.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date) || a.person.localeCompare(b.person))
    .map((f) => ({ key: f.key, cells: { person: f.person, what: f.what, expires: f.date, days_left: daysUntil(today, f.date) } }));
}

/* ── HR: joining, moving, leaving ───────────────────────────────────── */

export interface StaffFact {
  id: string; name: string; department: string; status: string; type: string | null;
  hire: string | null; left: string | null;
}

const ACTIVE = new Set(["active", "on_leave", "probation"]);
const isActive = (s: StaffFact) => ACTIVE.has(s.status);

/** Per department over [from, to]: who was there on the first day, who
 *  joined, who left, who is there on the last day, and the turnover —
 *  leavers ÷ the average of the two counts, in percent. The first row is
 *  the whole company (department "*", in words blk.allCompany). A leaver is dated by the day their record left
 *  (HR keeps no termination date). */
export function turnoverRows(staff: StaffFact[], from: string, to: string): ReportDataRow[] {
  const by = new Map<string, { start: number; hires: number; leavers: number; end: number }>();
  const add = (dept: string, s: StaffFact) => {
    const cur = by.get(dept) ?? { start: 0, hires: 0, leavers: 0, end: 0 };
    const hiredBy = (d: string) => !s.hire || s.hire <= d;
    const leftBy = (d: string) => !!s.left && s.left <= d;
    if (hiredBy(addDays(from, -1)) && !leftBy(addDays(from, -1)) && (isActive(s) || !!s.left)) cur.start++;
    if (s.hire && s.hire >= from && s.hire <= to) cur.hires++;
    if (s.left && s.left >= from && s.left <= to) cur.leavers++;
    if (hiredBy(to) && !leftBy(to) && (isActive(s) || !!s.left)) cur.end++;
    by.set(dept, cur);
  };
  for (const s of staff) { add("*", s); add(s.department || "—", s); }
  const rate = (x: { start: number; leavers: number; end: number }) => {
    const avg = (x.start + x.end) / 2;
    return avg ? r1((x.leavers / avg) * 100) : 0;
  };
  return Array.from(by, ([dept, x]) => ({ dept, x }))
    .filter((r) => r.dept === "*" || r.x.start || r.x.hires || r.x.leavers || r.x.end)
    .sort((a, b) => (a.dept === "*" ? -1 : b.dept === "*" ? 1 : a.dept.localeCompare(b.dept)))
    .map(({ dept, x }) => ({ key: `dept:${dept}`, cells: { department: dept, start_n: x.start, hires: x.hires, leavers: x.leavers, end_n: x.end, rate: rate(x) } }));
}

/** Who joined, moved or left in [from, to], by date. */
export interface MoveFact { key: string; person: string; change: "hire" | "move" | "exit"; date: string; detail: string }
export function movementRows(moves: MoveFact[], from: string, to: string): ReportDataRow[] {
  return moves.filter((m) => m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.person.localeCompare(b.person))
    .map((m) => ({ key: m.key, cells: { person: m.person, change: m.change, date: m.date, detail: m.detail } }));
}

/** Per department: the people there now, by kind of contract. The first
 *  row is the whole company (department "*"). */
export function headcountRows(staff: StaffFact[]): ReportDataRow[] {
  const by = new Map<string, { people: number; full_time: number; part_time: number; intern: number; other_n: number }>();
  const add = (dept: string, s: StaffFact) => {
    const cur = by.get(dept) ?? { people: 0, full_time: 0, part_time: 0, intern: 0, other_n: 0 };
    cur.people++;
    if (s.type === "full_time" || s.type === "part_time" || s.type === "intern") cur[s.type]++;
    else cur.other_n++;
    by.set(dept, cur);
  };
  for (const s of staff.filter(isActive)) { add("*", s); add(s.department || "—", s); }
  if (!by.size) return [];
  return Array.from(by, ([dept, x]) => ({ dept, x }))
    .sort((a, b) => (a.dept === "*" ? -1 : b.dept === "*" ? 1 : b.x.people - a.x.people || a.dept.localeCompare(b.dept)))
    .map(({ dept, x }) => ({ key: `dept:${dept}`, cells: { department: dept, ...x } }));
}

/** An appraisal cycle's scores per department: how many were appraised,
 *  how many are finished, and the average, lowest and highest overall
 *  score of the finished ones. */
export interface AppraisalFact { department: string; status: string | null; overall: number | null }
export function appraisalResultRows(list: AppraisalFact[]): ReportDataRow[] {
  const by = new Map<string, { n: number; done: number; scores: number[] }>();
  for (const a of list) {
    const d = a.department || "—";
    const cur = by.get(d) ?? { n: 0, done: 0, scores: [] };
    cur.n++;
    if (a.status === "completed") { cur.done++; if (typeof a.overall === "number") cur.scores.push(a.overall); }
    by.set(d, cur);
  }
  return Array.from(by, ([dept, x]) => ({ dept, x })).sort((a, b) => a.dept.localeCompare(b.dept)).map(({ dept, x }) => ({
    key: `dept:${dept}`,
    cells: {
      department: dept, appraised: x.n, done_n: x.done,
      average: x.scores.length ? r1(x.scores.reduce((s, v) => s + v, 0) / x.scores.length) : null,
      lowest: x.scores.length ? Math.min(...x.scores) : null, highest: x.scores.length ? Math.max(...x.scores) : null,
    },
  }));
}

/** Per skill: how many people are assessed, their average, how many
 *  positions ask for it, and how many people score under what their own
 *  position asks. */
export interface SkillFact { id: string; name: string }
export interface SkillScore { skillId: string; score: number; required: number | null }
export function skillRows(skills: SkillFact[], scores: SkillScore[], requiredBy: Map<string, number>): ReportDataRow[] {
  return skills.map((s) => {
    const mine = scores.filter((x) => x.skillId === s.id);
    return {
      key: s.id,
      cells: {
        skill: s.name, assessed: mine.length,
        average: mine.length ? r1(mine.reduce((a, x) => a + x.score, 0) / mine.length) : null,
        required_by: requiredBy.get(s.id) ?? 0,
        below: mine.filter((x) => x.required !== null && x.score < x.required).length,
      },
    };
  }).filter((r) => Number(r.cells.assessed) > 0 || Number(r.cells.required_by) > 0)
    .sort((a, b) => Number(b.cells.below) - Number(a.cells.below) || String(a.cells.skill).localeCompare(String(b.cells.skill)));
}

/** The month's HR numbers, one row each (blk.st.<metric>). */
export function hrKpiRows(k: { headcount: number; hires: number; leavers: number; turnover: number; absentDays: number; lateDays: number; leaveDays: number; overtimeHours: number; openJobs: number; applicants: number }): ReportDataRow[] {
  const list: Array<[string, number]> = [
    ["headcount", k.headcount], ["hires", k.hires], ["leavers", k.leavers], ["turnover_rate", k.turnover],
    ["absent_days", k.absentDays], ["late_days", k.lateDays], ["leave_days", k.leaveDays], ["overtime_hours", r1(k.overtimeHours)],
    ["open_jobs", k.openJobs], ["applicants", k.applicants],
  ];
  return list.map(([metric, value]) => ({ key: metric, cells: { metric, value } }));
}

/* ── Projects ───────────────────────────────────────────────────────── */

export interface ProjectFact {
  id: string; name: string; status: string; progress: number | null; plannedStart: string | null; plannedEnd: string | null;
  budgetHours: number | null; loggedHours: number; open: number; overdue: number; done: number;
}

/** A project's health: late once its planned end has passed with work
 *  still open; at risk with work past its date, or more hours logged than
 *  budgeted; else on track. A finished or archived project is none. */
export function projectHealth(p: ProjectFact, today: string): "on_track" | "at_risk" | "late" | null {
  if (p.status === "completed" || p.status === "archived") return null;
  if (p.plannedEnd && p.plannedEnd < today && p.open > 0) return "late";
  if (p.overdue > 0 || (p.budgetHours && p.loggedHours > p.budgetHours)) return "at_risk";
  return "on_track";
}

/** Why a project is at risk — coded (blk.st.*), and how many days past its end. */
export function riskReasons(p: ProjectFact, today: string): { reasons: string[]; daysOver: number } {
  const reasons: string[] = [];
  if (p.overdue > 0) reasons.push("overdue_tasks");
  const daysOver = p.plannedEnd && p.plannedEnd < today && p.open > 0 ? daysUntil(p.plannedEnd, today) : 0;
  if (daysOver > 0) reasons.push("past_end");
  if (p.budgetHours && p.loggedHours > p.budgetHours) reasons.push("over_hours");
  return { reasons, daysOver };
}

/** A project's budget: hours (budget vs logged) and, with a billing rate,
 *  the amount (budget vs logged hours × rate); what is left and how much of
 *  the budget is used, in percent. A line with no budget still shows what
 *  was used. */
export function budgetRows(p: { budgetHours: number | null; loggedHours: number; budgetAmount: number | null; rate: number | null; currency: string | null }): ReportDataRow[] {
  const line = (key: "hours" | "amount", budget: number | null, actual: number, currency?: string): ReportDataRow => ({
    key, ...(currency ? { currency } : {}),
    cells: { line: key, budget, actual: r2(actual), remaining: budget !== null ? r2(budget - actual) : null, used: budget ? Math.round((actual / budget) * 100) : null },
  });
  const rows = [line("hours", p.budgetHours, p.loggedHours)];
  if (p.budgetAmount !== null || p.rate) rows.push(line("amount", p.budgetAmount, p.loggedHours * (p.rate ?? 0), p.currency ?? undefined));
  return rows;
}

/** A step of the plan (a milestone, or a top-level task): due, done, and by
 *  how many days it slipped (+ late, − early). Something open and past its
 *  date slips by the days so far; open and not yet due, not at all. */
export interface PlanStep { key: string; title: string; kind: "milestone" | "task"; due: string | null; done: string | null; reached: boolean }
export function scheduleRows(steps: PlanStep[], today: string): ReportDataRow[] {
  return steps.filter((s) => s.due)
    .map((s) => {
      const slip = s.done ? daysUntil(s.due!, s.done) : !s.reached && s.due! < today ? daysUntil(s.due!, today) : null;
      return { key: s.key, cells: { step: s.title, kind: s.kind, due: s.due, done_on: s.done, slip } };
    })
    .sort((a, b) => String(a.cells.due).localeCompare(String(b.cells.due)));
}

/* ── Inventory ──────────────────────────────────────────────────────── */

/** What to order to get back to the maximum (else the reorder point). */
export function toOrder(onHand: number, reorder: number, max: number | null): number {
  const target = max && max > reorder ? max : reorder;
  return Math.max(0, r2(target - onHand));
}

/* ── Finance ────────────────────────────────────────────────────────── */

/** An amount owed, by how late it is: current (not yet due), then 1–30,
 *  31–60, 61–90 and over 90 days past due. */
export const AGE_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
export function ageBucket(due: string | null, today: string): (typeof AGE_BUCKETS)[number] {
  const late = due ? daysUntil(due, today) : 0;
  return late <= 0 ? "current" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90_plus";
}
export interface OwedFact { due: string | null; balance: number; currency: string }
/** Each bucket in each currency (amounts are never mixed): how many and how much. */
export function agingRows(list: OwedFact[], today: string): ReportDataRow[] {
  const by = new Map<string, { count: number; balance: number }>();
  for (const x of list) {
    if (!(x.balance > 0)) continue;
    const k = `${ageBucket(x.due, today)}|${x.currency || "—"}`;
    const cur = by.get(k) ?? { count: 0, balance: 0 };
    cur.count++; cur.balance += x.balance;
    by.set(k, cur);
  }
  const order = (b: string) => AGE_BUCKETS.indexOf(b as (typeof AGE_BUCKETS)[number]);
  return Array.from(by, ([k, v]) => { const [bucket, currency] = k.split("|"); return { bucket, currency, ...v }; })
    .sort((a, b) => order(a.bucket) - order(b.bucket) || a.currency.localeCompare(b.currency))
    .map((x) => ({ key: `${x.bucket}:${x.currency}`, currency: x.currency === "—" ? undefined : x.currency, cells: { bucket: x.bucket, count: x.count, balance: r2(x.balance) } }));
}

/** Spending per category in each currency — the row a budget is typed
 *  beside ("<category id>:<currency>"; no category: the zero id). */
export const NO_CATEGORY = "00000000-0000-0000-0000-000000000000";
export interface SpendFact { categoryId: string | null; category: string; amount: number; currency: string }
export function categoryRows(list: SpendFact[], noneLabel: string): ReportDataRow[] {
  const by = new Map<string, { category: string; currency: string; count: number; actual: number }>();
  for (const x of list) {
    const cur = (x.currency || "USD").toUpperCase();
    const k = `${x.categoryId ?? NO_CATEGORY}:${cur}`;
    const v = by.get(k) ?? { category: x.categoryId ? x.category || "—" : noneLabel, currency: cur, count: 0, actual: 0 };
    v.count++; v.actual += x.amount;
    by.set(k, v);
  }
  return Array.from(by, ([key, v]) => ({ key, currency: v.currency, cells: { category: v.category, count: v.count, actual: r2(v.actual) } }))
    .sort((a, b) => Number(b.cells.actual) - Number(a.cells.actual) || String(a.cells.category).localeCompare(String(b.cells.category)));
}

export const dayOf = ymd;

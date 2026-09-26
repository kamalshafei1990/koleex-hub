/* ---------------------------------------------------------------------------
   Reports — the manager and the team (Phase 5A, owner's picks 25 Sep 2026).
   Pure: the server, the Team tab and validate:reports share every rule here.

   The team is everyone under the manager, at every level (a super admin:
   everyone) — the same people the Team tab and the compliance board show.
   Its numbers, over any days the manager picks (at most TEAM_LIMITS.rangeDays):
     reports     what the obligations board says for those days — sent on
                 time, late, missing (nothing before counting starts)
     attendance  present, late, absent and leave days, as HR's sheet reads
                 them — the manager sees his own team's (owner's pick)
     work        project tasks and the to-dos SOMEONE ELSE assigned them:
                 open, overdue, done in those days. A person's own to-dos
                 (created by them, assigned by nobody, or private) stay theirs.
   And what Koleex AI reads for the team summary: the team's SENT reports in
   those days — never a draft, never a confidential one, the latest version
   of each — each worded briefly (reportDigest), within TEAM_LIMITS.
   --------------------------------------------------------------------------- */

import { dataTotals } from "./report-data";
import type { TeamSource } from "./report-data";
import type { BoardRow, BoardSummary, Cell } from "./obligations";
import { scoreAverage, type ReportDataRow, type ReportSectionValue, type ReportTemplateDef } from "./templates";

export const TEAM_LIMITS = {
  /** The longest span a summary covers. */
  rangeDays: 31,
  /** The most reports read for one summary (the newest first). */
  reports: 150,
  /** One report's words, at most. */
  perReport: 2400,
  /** Everything Koleex AI reads, at most. */
  material: 36_000,
  /** Summaries per manager per hour. */
  perHour: 20,
} as const;

export interface TeamAttendance { present: number; late: number; absent: number; leave: number }
export interface TeamWorkload { open: number; overdue: number; done: number }
export interface TeamPersonFacts {
  accountId: string;
  name: string;
  /** Null: nothing is owed in those days, or counting has not started. */
  reports: BoardSummary | null;
  /** Null: no attendance record could be read for them. */
  attendance: TeamAttendance | null;
  workload: TeamWorkload;
}

/* ── Dates ── */
const DAY = 86_400_000;
const ms = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
export const addDaysYmd = (ymd: string, n: number): string => new Date(ms(ymd) + n * DAY).toISOString().slice(0, 10);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const real = (v: unknown): v is string => typeof v === "string" && YMD.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** The days a summary covers, checked: two real days, the first not after
 *  the last, at most TEAM_LIMITS.rangeDays long — or null. */
export function teamRange(from: unknown, to: unknown): { from: string; to: string } | null {
  if (!real(from) || !real(to) || to < from) return null;
  return (ms(to) - ms(from)) / DAY + 1 <= TEAM_LIMITS.rangeDays ? { from, to } : null;
}

export type TeamPeriodKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month";
export const TEAM_PERIODS: TeamPeriodKey[] = ["today", "yesterday", "this_week", "last_week", "this_month"];

/** The Team tab's quick picks, from the viewer's own day (weeks start on Monday). */
export function teamPeriod(key: TeamPeriodKey, today: string): { from: string; to: string } {
  const monday = addDaysYmd(today, -((new Date(ms(today)).getUTCDay() + 6) % 7));
  switch (key) {
    case "yesterday": { const d = addDaysYmd(today, -1); return { from: d, to: d }; }
    case "this_week": return { from: monday, to: today };
    case "last_week": return { from: addDaysYmd(monday, -7), to: addDaysYmd(monday, -1) };
    case "this_month": return { from: `${today.slice(0, 8)}01`, to: today };
    default: return { from: today, to: today };
  }
}

/* ── The numbers ── */

/** A person's report obligations over some days, from the board's weeks:
 *  each daily whose day is inside, the weekly and the monthly whose
 *  deadline is inside — each counted once. */
export function summarizeRange(weeks: BoardRow[], from: string, to: string): BoardSummary {
  const s: BoardSummary = { expected: 0, onTime: 0, late: 0, missing: 0, due: 0 };
  const seen = new Set<string>();
  const inside = (day: string | undefined) => !!day && day >= from && day <= to;
  const add = (cell: Cell | null | undefined, key: string) => {
    if (!cell || seen.has(key)) return;
    seen.add(key);
    if (cell.state === "sent") { s.expected++; s.onTime++; }
    else if (cell.state === "late") { s.expected++; s.late++; }
    else if (cell.state === "missing") { s.expected++; s.missing++; }
    else if (cell.state === "due") { s.expected++; s.due++; }
  };
  for (const row of weeks) {
    for (const [day, cell] of Object.entries(row.daily ?? {})) if (inside(day)) add(cell, `d|${day}`);
    if (row.weekly && inside(row.weekly.dueAt?.slice(0, 10))) add(row.weekly, `w|${row.weekly.dueAt}`);
    if (row.monthly && inside(row.monthly.cell.dueAt?.slice(0, 10))) add(row.monthly.cell, `m|${row.monthly.month}`);
  }
  return s;
}

/** Attendance over some days, as the sheet reads each day: a late or a
 *  half day is still a day present. Weekends, holidays, days not yet
 *  tracked and days to come count nothing. */
export function attendanceCounts(days: Array<{ date: string; status: string }>, from: string, to: string): TeamAttendance {
  const out: TeamAttendance = { present: 0, late: 0, absent: 0, leave: 0 };
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    if (d.status === "present" || d.status === "half_day") out.present++;
    else if (d.status === "late") { out.present++; out.late++; }
    else if (d.status === "absent") out.absent++;
    else if (d.status === "leave") out.leave++;
  }
  return out;
}

export interface WorkItem { done: boolean; closedAt: string | null; due: string | null }
/** Open work (and how much of it is past its date) and what was finished
 *  in those days. */
export function workloadOf(items: WorkItem[], from: string, to: string, today: string): TeamWorkload {
  const out: TeamWorkload = { open: 0, overdue: 0, done: 0 };
  for (const it of items) {
    if (it.done) {
      const d = it.closedAt?.slice(0, 10);
      if (d && d >= from && d <= to) out.done++;
      continue;
    }
    out.open++;
    if (it.due && it.due.slice(0, 10) < today) out.overdue++;
  }
  return out;
}

/** Which to-dos are WORK (owner's pick): assigned to the person by someone
 *  else, and not private. Their own list stays theirs. */
export const isAssignedWork = (todo: { assigned_by_account_id: string | null; is_private: boolean | null }, personId: string): boolean =>
  !!todo.assigned_by_account_id && todo.assigned_by_account_id !== personId && todo.is_private !== true;

/** A project task's state: finished, dropped (counts nothing), or open. */
export function taskState(status: string | null): "done" | "dropped" | "open" {
  const s = (status ?? "").toLowerCase();
  if (s === "done" || s === "completed" || s === "closed") return "done";
  if (s === "cancelled" || s === "canceled" || s === "archived") return "dropped";
  return "open";
}

/** A team numbers block's rows: one per person (reports — only who owed
 *  something in those days; attendance — who has a sheet; work — everyone). */
export function teamRows(source: TeamSource, people: TeamPersonFacts[]): ReportDataRow[] {
  const out: ReportDataRow[] = [];
  for (const p of people) {
    if (source === "team_reports") {
      if (p.reports && p.reports.expected) out.push({ key: p.accountId, cells: { person: p.name, owed: p.reports.expected, on_time: p.reports.onTime, sent_late: p.reports.late, missed: p.reports.missing } });
    } else if (source === "team_attendance") {
      if (p.attendance) out.push({ key: p.accountId, cells: { person: p.name, present: p.attendance.present, late_days: p.attendance.late, absent: p.attendance.absent, leave_days: p.attendance.leave } });
    } else {
      out.push({ key: p.accountId, cells: { person: p.name, open_work: p.workload.open, overdue_work: p.workload.overdue, done_work: p.workload.done } });
    }
  }
  return out;
}

/* ── What Koleex AI reads ── */

const dmy = (ymd: string | null | undefined) => (ymd && YMD.test(ymd.slice(0, 10)) ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "");
export const rangeLabel = (from: string, to: string) => (from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`);
const flat = (s: string, max: number) => { const v = s.replace(/\s+/g, " ").trim(); return v.length > max ? `${v.slice(0, max - 1)}…` : v; };

export interface DigestInput {
  author: string;
  tpl: ReportTemplateDef;
  title: string;
  from: string | null;
  to: string | null;
  sections: ReportSectionValue[];
}

/** One sent report, briefly, in plain lines: who, what, when, then each
 *  section that says something — texts and lists as written; a checklist's
 *  problems; a score's average; a choice's answer; a table's first rows;
 *  links' names; the numbers blocks' counts and totals; who signed.
 *  `word` names a section, a point, a column or an answer. */
export function reportDigest(r: DigestInput, word: (key: string) => string, caps: { section: number; report: number } = { section: 900, report: TEAM_LIMITS.perReport }): string {
  const k = r.tpl.key;
  const name = (sid: string) => word(`tpl.${k}.s.${sid}`);
  const lines: string[] = [`### ${r.author} — ${word(`tpl.${k}.name`)} — ${r.from ? rangeLabel(r.from, r.to ?? r.from) : ""}${r.title.trim() ? ` — "${flat(r.title, 120)}"` : ""}`];
  const byId = new Map(r.sections.map((s) => [s.id, s]));
  for (const def of r.tpl.sections) {
    const v = byId.get(def.id);
    if (!v) continue;
    let line = "";
    switch (def.kind) {
      case "text": if (v.text?.trim()) line = flat(v.text, caps.section); break;
      case "list": if (v.items?.length) line = flat(v.items.join(" · "), caps.section); break;
      case "checklist": {
        const points = def.points ?? [];
        const answered = points.filter((p) => v.checks?.[p.id]?.state).length;
        const issues = points.filter((p) => v.checks?.[p.id]?.state === "issue")
          .map((p) => `${word(`tpl.${k}.s.${def.id}.i.${p.id}`)}${v.checks?.[p.id]?.note ? ` (${flat(v.checks[p.id]!.note!, 160)})` : ""}`);
        if (answered) line = `${answered}/${points.length} checked${issues.length ? `; problems: ${issues.join("; ")}` : "; no problem"}`;
        break;
      }
      case "score": { const avg = scoreAverage(def, v); if (avg !== null) line = `${avg}/5${v.text?.trim() ? ` — ${flat(v.text, 300)}` : ""}`; break; }
      case "choice": if (v.choice) line = word(`tpl.${k}.s.${def.id}.o.${v.choice}`); break;
      case "table": {
        const rows = v.rows ?? [];
        if (rows.length) line = `${rows.length} row(s): ${rows.slice(0, 5).map((row) => (def.columns ?? []).filter((c) => row[c.id]).map((c) => `${word(`tpl.${k}.s.${def.id}.c.${c.id}`)} ${row[c.id]}`).join(", ")).join(" | ")}${v.currency && (def.columns ?? []).some((c) => c.type === "money") ? ` (${v.currency})` : ""}`;
        break;
      }
      case "links": if (v.links?.length) line = v.links.map((l) => flat(l.label, 80)).join(", "); break;
      case "data": {
        const d = v.data;
        if (d && !d.denied && !d.failed) {
          const totals = dataTotals(d).map((x) => `${x.value} ${x.currency}`);
          line = `${d.rows.length} item(s)${totals.length ? `, total ${totals.join(" + ")}` : ""}`;
        }
        break;
      }
      case "signature": if (v.signature) line = `signed by ${flat(v.signature.name, 80) || "—"}`; break;
    }
    if (line) lines.push(`${name(def.id)}: ${line}`);
  }
  const text = lines.join("\n");
  return text.length > caps.report ? `${text.slice(0, caps.report - 1)}…` : text;
}

/** The reports' digests, newest first, until the material is full. */
export function teamMaterial(digests: string[]): { text: string; included: number; truncated: boolean } {
  const kept: string[] = [];
  let size = 0;
  for (const d of digests) {
    if (size + d.length + 2 > TEAM_LIMITS.material) break;
    kept.push(d);
    size += d.length + 2;
  }
  return { text: kept.join("\n\n"), included: kept.length, truncated: kept.length < digests.length };
}

/** The team's numbers as lines Koleex AI reads beside the reports. Before
 *  report counting starts nothing is said about reports at all — "not
 *  counted yet" read as a problem to raise. */
export function teamFactsText(people: TeamPersonFacts[], tracking: boolean): string {
  return people.map((p) => {
    const parts: string[] = [];
    if (tracking && p.reports?.expected) parts.push(`reports: ${p.reports.onTime} on time, ${p.reports.late} late, ${p.reports.missing} missing, ${p.reports.due} still due, of ${p.reports.expected}`);
    if (p.attendance) parts.push(`attendance: ${p.attendance.present} day(s) present, ${p.attendance.late} late, ${p.attendance.absent} absent, ${p.attendance.leave} on leave`);
    parts.push(`work: ${p.workload.open} open (${p.workload.overdue} overdue), ${p.workload.done} done in these days`);
    return `- ${p.name}: ${parts.join("; ")}`;
  }).join("\n");
}

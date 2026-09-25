/* ---------------------------------------------------------------------------
   Reports — who must write which report, and when it is due (Phase 3A,
   owner's decisions 25 Sep 2026).

   WHO: every employee writes the daily and the weekly report; anyone with
   people under them also writes the monthly; super admins are exempt. A
   per-person exception (work_report_obligations) wins over that default.

   WHEN — on the person's OWN calendar (their country's weekend and
   holidays, their approved leave, their attendance policy's end of day and
   timezone):
     daily    the end of that working day
     weekly   the end of the last working day BEFORE their weekend
              (Thursday for a Friday–Saturday weekend, Friday for
              Saturday–Sunday); a week with no working day asks nothing
     monthly  the end of the 3rd working day of the next month; a month
              with no working day asks nothing
   Nothing counts late or missing before tracking starts (the tenant's
   tracking_from, or the person's hire date if later).

   Pure; the server gathers the facts (src/lib/server/reports/obligations.ts)
   and hands over a Clock (wall-clock → instant in a zone). validate:reports
   proves the calendar cases, Egypt and China both.
   --------------------------------------------------------------------------- */

import { isoWeekKey } from "./templates";

export type ObligationKey = "daily" | "weekly" | "monthly";
export const OBLIGATION_KEYS: ObligationKey[] = ["daily", "weekly", "monthly"];
export type Obliged = Record<ObligationKey, boolean>;

export function defaultObliged(p: { isSuperAdmin: boolean; hasTeam: boolean }): Obliged {
  if (p.isSuperAdmin) return { daily: false, weekly: false, monthly: false };
  return { daily: true, weekly: true, monthly: p.hasTeam };
}

/** The default, with this person's exceptions on top. */
export function effectiveObliged(p: { isSuperAdmin: boolean; hasTeam: boolean }, exceptions: Partial<Obliged>): Obliged {
  const d = defaultObliged(p);
  return { daily: exceptions.daily ?? d.daily, weekly: exceptions.weekly ?? d.weekly, monthly: exceptions.monthly ?? d.monthly };
}

/** One person's calendar and clock. */
export interface PersonClock {
  /** Rest weekdays, JS getDay() numbers (0 = Sunday). */
  weekend: number[];
  holidays: ReadonlySet<string>;
  /** Days on approved leave. */
  leave: ReadonlySet<string>;
  tz: string;
  /** "HH:MM" — the end of their working day. */
  workEnd: string;
  /** First day anything can be late or missing; null = not tracked yet. */
  from: string | null;
}

/** Wall-clock "HH:MM" on a day in a zone → the ISO instant. */
export type Clock = (day: string, hhmm: string, tz: string) => string | null;

const pad = (n: number) => String(n).padStart(2, "0");
const utc = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const ymdOf = (t: Date) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
export const addDays = (ymd: string, n: number) => ymdOf(new Date(utc(ymd).getTime() + n * 86_400_000));
export const weekdayOf = (ymd: string) => utc(ymd).getUTCDay();
/** Monday of the ISO week a day falls in. */
export const mondayOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** The local calendar day of an instant in a zone. */
export function localDayOf(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return iso.slice(0, 10);
  }
}

export type DayKind = "work" | "off" | "leave";
export function dayKind(c: PersonClock, day: string): DayKind {
  if (c.weekend.includes(weekdayOf(day)) || c.holidays.has(day)) return "off";
  if (c.leave.has(day)) return "leave";
  return "work";
}

export interface Due { day: string; at: string }
const dueOn = (c: PersonClock, day: string, clock: Clock): Due | null => { const at = clock(day, c.workEnd, c.tz); return at ? { day, at } : null; };

export function dailyDue(c: PersonClock, day: string, clock: Clock): Due | null {
  return dayKind(c, day) === "work" ? dueOn(c, day, clock) : null;
}

export function weeklyDue(c: PersonClock, monday: string, clock: Clock): Due | null {
  const days = weekDays(monday);
  const works = (d: string) => dayKind(c, d) === "work";
  const firstRest = days.findIndex((d) => c.weekend.includes(weekdayOf(d)));
  /* The working run before the weekend; a week that opens on a rest day or
     has none takes all its days. */
  const run = firstRest > 0 ? days.slice(0, firstRest) : days;
  const last = [...run].reverse().find(works) ?? [...days].reverse().find(works);
  return last ? dueOn(c, last, clock) : null;
}

export function monthlyDue(c: PersonClock, month: string, clock: Clock): Due | null {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = ymdOf(new Date(Date.UTC(y, m, 0)));
  let worked = false;
  for (let d = first; d <= last; d = addDays(d, 1)) if (dayKind(c, d) === "work") { worked = true; break; }
  if (!worked) return null;
  let n = 0;
  let d = ymdOf(new Date(Date.UTC(y, m, 1)));
  for (let i = 0; i < 45; i++, d = addDays(d, 1)) {
    if (dayKind(c, d) === "work" && ++n === 3) return dueOn(c, d, clock);
  }
  return null;
}

export const monthOf = (ymd: string) => ymd.slice(0, 7);
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export type CellState = "sent" | "late" | "missing" | "due" | "upcoming" | "off" | "leave" | "untracked";
export interface Cell { state: CellState; dueAt?: string; sentAt?: string; reportId?: string }
export interface Sent { at: string; id: string }

const ms = (iso: string) => Date.parse(iso);

/** One obligation's state. Before tracking starts nothing is late or
 *  missing — a report sent then is simply sent. */
export function cellOf(o: { due: Due | null; offKind?: "off" | "leave"; sent: Sent | null; now: string; startsAt: string | null; from: string | null }): Cell {
  if (!o.due) return { state: o.offKind ?? "off" };
  const tracked = !!o.from && o.due.day >= o.from;
  if (o.sent) {
    const late = tracked && ms(o.sent.at) > ms(o.due.at);
    return { state: late ? "late" : "sent", dueAt: o.due.at, sentAt: o.sent.at, reportId: o.sent.id };
  }
  if (!tracked) return { state: "untracked", dueAt: o.due.at };
  if (ms(o.now) > ms(o.due.at)) return { state: "missing", dueAt: o.due.at };
  if (o.startsAt && ms(o.now) < ms(o.startsAt)) return { state: "upcoming", dueAt: o.due.at };
  return { state: "due", dueAt: o.due.at };
}

/** How the board asks for what was sent. */
export type SentLookup = (key: ObligationKey, periodKey: string) => Sent | null;

export interface PersonFacts { obliged: Obliged; clock: PersonClock }

export interface BoardRow {
  daily: Record<string, Cell> | null;
  weekly: Cell | null;
  monthly: { month: string; cell: Cell } | null;
}

/** One person's week on the board: each day's daily, the week's weekly, and
 *  the monthly that falls due next (from the week's Monday on). */
export function boardRow(p: PersonFacts, monday: string, sent: SentLookup, now: string, clock: Clock): BoardRow {
  const c = p.clock;
  const start = (day: string) => clock(day, "00:00", c.tz);
  const days = weekDays(monday);
  const daily = p.obliged.daily
    ? Object.fromEntries(days.map((d) => {
      const kind = dayKind(c, d);
      return [d, cellOf({ due: dailyDue(c, d, clock), offKind: kind === "work" ? undefined : kind, sent: sent("daily", d), now, startsAt: start(d), from: c.from })];
    }))
    : null;
  const weekKey = isoWeekKey(monday);
  const weekly = p.obliged.weekly
    ? cellOf({ due: weeklyDue(c, monday, clock), sent: sent("weekly", weekKey), now, startsAt: start(monday), from: c.from })
    : null;
  let monthly: BoardRow["monthly"] = null;
  if (p.obliged.monthly) {
    const prev = prevMonth(monthOf(monday));
    const prevDue = monthlyDue(c, prev, clock);
    const month = prevDue && prevDue.day >= monday ? prev : monthOf(monday);
    monthly = { month, cell: cellOf({ due: monthlyDue(c, month, clock), sent: sent("monthly", month), now, startsAt: start(`${month}-01`), from: c.from }) };
  }
  return { daily, weekly, monthly };
}

export interface BoardSummary { expected: number; onTime: number; late: number; missing: number; due: number }
export function summarize(rows: BoardRow[]): BoardSummary {
  const s: BoardSummary = { expected: 0, onTime: 0, late: 0, missing: 0, due: 0 };
  const add = (cell: Cell | null | undefined) => {
    if (!cell) return;
    if (cell.state === "sent") { s.expected++; s.onTime++; }
    else if (cell.state === "late") { s.expected++; s.late++; }
    else if (cell.state === "missing") { s.expected++; s.missing++; }
    else if (cell.state === "due") { s.expected++; s.due++; }
  };
  for (const r of rows) {
    for (const cell of Object.values(r.daily ?? {})) add(cell);
    add(r.weekly);
    add(r.monthly?.cell);
  }
  return s;
}

export interface DueItem {
  key: ObligationKey;
  periodKey: string;
  /** A day inside the period — what "Write it now" creates the report for. */
  date: string;
  dueAt: string;
  state: "due" | "missing";
  /** A draft already started for it. */
  draftId?: string;
}

/** What the person owes now: what is missing from the last week (oldest
 *  first), then what falls due soon. */
export function dueList(p: PersonFacts, sent: SentLookup, drafts: SentLookup, now: string, clock: Clock): DueItem[] {
  const c = p.clock;
  const today = localDayOf(now, c.tz);
  const out: DueItem[] = [];
  const push = (key: ObligationKey, periodKey: string, date: string, due: Due | null, soonDays: number) => {
    if (!due) return;
    const cell = cellOf({ due, sent: sent(key, periodKey), now, startsAt: null, from: c.from });
    if (cell.state === "missing" || (cell.state === "due" && due.day <= addDays(today, soonDays))) {
      out.push({ key, periodKey, date, dueAt: due.at, state: cell.state, draftId: drafts(key, periodKey)?.id });
    }
  };
  if (p.obliged.daily) for (let i = 7; i >= 0; i--) { const d = addDays(today, -i); push("daily", d, d, dailyDue(c, d, clock), 0); }
  if (p.obliged.weekly) {
    const thisMonday = mondayOf(today);
    for (const monday of [addDays(thisMonday, -7), thisMonday]) push("weekly", isoWeekKey(monday), monday, weeklyDue(c, monday, clock), 2);
  }
  if (p.obliged.monthly) {
    const month = monthOf(today);
    for (const m of [prevMonth(month), month]) push("monthly", m, `${m}-01`, monthlyDue(c, m, clock), 3);
  }
  return out.sort((a, b) => (a.state !== b.state ? (a.state === "missing" ? -1 : 1) : ms(a.dueAt) - ms(b.dueAt)));
}

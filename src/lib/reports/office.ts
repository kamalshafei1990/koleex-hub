/* ---------------------------------------------------------------------------
   Reports — the CEO office's numbers (Phase 5B, owner's picks 25 Sep 2026),
   pure: the rows each block shows, from facts the server gathered
   (src/lib/server/reports/office.ts). Only the server and validate:reports
   import this file — the rows reach the page already computed.

     decisions   what waits for someone's decision across the apps, oldest
                 first, with how many days it has waited
     schedule    the writer's own events in the report's days
     time_split  where the writer's time went: hours per kind of event
     meetings    the writer's meetings in those days
     followups   open, overdue and finished work per department — numbers
                 only, never a task's title
     occasions   birthdays and work anniversaries falling in those days —
                 never a birth year, never an age
     visitors    the invitation letters' visitors whose stay meets those
                 days, the letter issued or still a draft (said which) —
                 never a passport

   Dates are YYYY-MM-DD; a moment is an ISO instant read in the writer's
   own timezone. Every row has a stable key (a note or a link keys on it).
   --------------------------------------------------------------------------- */

import type { ReportDataRow } from "./templates";
import type { TeamWorkload } from "./team";
import { zonedDateKey, zonedParts } from "@/lib/calendar-tz";

const DAY = 86_400_000;
const ymdMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
export const daysBetween = (from: string, to: string) => Math.max(0, Math.round((ymdMs(to) - ymdMs(from)) / DAY));
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const two = (n: number) => String(n).padStart(2, "0");

/* ── Waiting for a decision ─────────────────────────────────────────── */

/** One thing that waits for the reader's decision. `link` is the kind a
 *  link is made from (leave_manager / leave_hr differ in where it is decided). */
export interface DecisionItem {
  kind: "leave" | "overtime" | "correction" | "expense" | "payment" | "bill" | "journal" | "todo" | "report";
  link: string;
  id: string;
  item: string;
  from: string;
  since: string | null;
  amount?: number | null;
  currency?: string | null;
}

/** Oldest first — what has waited longest is read first. */
export function decisionRows(items: DecisionItem[], today: string): ReportDataRow[] {
  return [...items]
    .sort((a, b) => (a.since ?? "9999").localeCompare(b.since ?? "9999") || a.from.localeCompare(b.from))
    .map((x) => ({
      key: `${x.link}:${x.id}`,
      currency: x.currency ?? undefined,
      cells: { item: x.item || "—", app: x.kind, from: x.from || "—", amount: x.amount ?? null, since: x.since, days: x.since ? daysBetween(x.since, today) : null },
    }));
}

/* ── The calendar ───────────────────────────────────────────────────── */

/** An event on the writer's calendar, as the feed gives it. */
export interface CalendarFact {
  id: string;
  title: string;
  kind: string;
  start: string;
  end: string;
  allDay: boolean;
  private: boolean;
  location: string | null;
  url: string | null;
  guests: number;
}

/** Where an event is: its place, else the call link's host. */
const whereOf = (e: CalendarFact): string => {
  if (e.location?.trim()) return e.location.trim();
  if (!e.url) return "";
  try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const hm = (ms: number, tz: string) => { const p = zonedParts(ms, tz); return `${two(p.h)}:${two(p.mi)}`; };
const timeOf = (e: CalendarFact, tz: string) => (e.allDay ? "" : `${hm(Date.parse(e.start), tz)}–${hm(Date.parse(e.end), tz)}`);
/** A private event is the writer's own business: its time counts, its
 *  title and place never leave the calendar. */
const shown = (e: CalendarFact) => !e.private;

/** The writer's events in the report's days, in order (private ones left out). */
export function scheduleRows(events: CalendarFact[], tz: string): ReportDataRow[] {
  return events.filter(shown)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => ({ key: `${e.id}|${e.start}`, cells: { event: e.title || "—", date: e.allDay ? e.start.slice(0, 10) : zonedDateKey(e.start, tz), time: timeOf(e, tz), where: whereOf(e), with: e.guests } }));
}

const MEETING_KINDS = new Set(["meeting", "event"]);
const hours = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;

/** The part of an event inside [winFrom, winTo) — a long one is cut at the window. */
const inside = (e: CalendarFact, winFrom: number, winTo: number) =>
  Math.max(0, Math.min(Date.parse(e.end), winTo) - Math.max(Date.parse(e.start), winFrom));

/** The meetings among them (timed, not private), with their hours. */
export function meetingRows(events: CalendarFact[], tz: string, winFrom: number, winTo: number): ReportDataRow[] {
  return events.filter((e) => shown(e) && !e.allDay && MEETING_KINDS.has(e.kind))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => ({ key: `${e.id}|${e.start}`, cells: { event: e.title || "—", date: zonedDateKey(e.start, tz), time: timeOf(e, tz), hours: hours(inside(e, winFrom, winTo)), with: e.guests } }));
}

/** Hours per kind of event inside the window (timed events only; a
 *  private one counts as "private"), most first, with each one's share. */
export function timeSplitRows(events: CalendarFact[], winFrom: number, winTo: number): ReportDataRow[] {
  const by = new Map<string, { n: number; ms: number }>();
  for (const e of events) {
    if (e.allDay) continue;
    const ms = inside(e, winFrom, winTo);
    if (ms <= 0) continue;
    const kind = e.private ? "private" : e.kind || "event";
    const cur = by.get(kind) ?? { n: 0, ms: 0 };
    cur.n++; cur.ms += ms;
    by.set(kind, cur);
  }
  const total = Array.from(by.values()).reduce((a, b) => a + b.ms, 0);
  return Array.from(by, ([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.ms - a.ms || a.kind.localeCompare(b.kind))
    .map((x) => ({ key: x.kind, cells: { kind: x.kind, events: x.n, hours: hours(x.ms), share: total ? Math.round((x.ms / total) * 100) : 0 } }));
}

/* ── Follow-ups per department ──────────────────────────────────────── */

/** Open / overdue / finished work per department, from each person's own
 *  count (workloadOf) — numbers only. A person with no department counts
 *  under "—". Most overdue first; a department with nothing is left out. */
export function followupRows(perPerson: Map<string, TeamWorkload>, deptOf: Map<string, string>): ReportDataRow[] {
  const byDept = new Map<string, TeamWorkload>();
  for (const [account, w] of perPerson) {
    const dept = deptOf.get(account) || "—";
    const cur = byDept.get(dept) ?? { open: 0, overdue: 0, done: 0 };
    byDept.set(dept, { open: cur.open + w.open, overdue: cur.overdue + w.overdue, done: cur.done + w.done });
  }
  return Array.from(byDept, ([dept, w]) => ({ dept, w }))
    .filter((x) => x.w.open || x.w.done)
    .sort((a, b) => b.w.overdue - a.w.overdue || b.w.open - a.w.open || a.dept.localeCompare(b.dept))
    .map((x) => ({ key: x.dept, cells: { department: x.dept, open_work: x.w.open, overdue_work: x.w.overdue, done_work: x.w.done } }));
}

/* ── Birthdays and work anniversaries ───────────────────────────────── */

export interface OccasionPerson { id: string; name: string; birth: string | null; hire: string | null }

/** A yearly day in a given year: 29 February falls on the 28th when the
 *  year has none. */
export function yearlyOn(mmdd: string, year: number): string {
  if (mmdd === "02-29" && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${mmdd}`;
}

/** The birthdays and work anniversaries in [from, to] (a range may cross
 *  the new year). A birthday carries no year — never an age; an anniversary
 *  carries its years of service (from the first one). Soonest first. */
export function occasionRows(people: OccasionPerson[], from: string, to: string): ReportDataRow[] {
  const rows: Array<ReportDataRow & { sort: string }> = [];
  const y0 = Number(from.slice(0, 4)), y1 = Number(to.slice(0, 4));
  for (const p of people) {
    for (let y = y0; y <= y1; y++) {
      if (p.birth && /^\d{4}-\d{2}-\d{2}/.test(p.birth)) {
        const d = yearlyOn(p.birth.slice(5, 10), y);
        if (d >= from && d <= to) rows.push({ key: `birthday:${p.id}:${d}`, sort: `${d}|${p.name}`, cells: { person: p.name, occasion: "birthday", date: d, years: null } });
      }
      if (p.hire && /^\d{4}-\d{2}-\d{2}/.test(p.hire)) {
        const d = yearlyOn(p.hire.slice(5, 10), y);
        const years = y - Number(p.hire.slice(0, 4));
        if (years >= 1 && d >= from && d <= to) rows.push({ key: `anniversary:${p.id}:${d}`, sort: `${d}|${p.name}`, cells: { person: p.name, occasion: "anniversary", date: d, years } });
      }
    }
  }
  return rows.sort((a, b) => a.sort.localeCompare(b.sort)).map(({ key, cells }) => ({ key, cells }));
}

/* ── Visitors ───────────────────────────────────────────────────────── */

export interface VisitorLetter { id: string; visitor: string; company: string | null; country: string | null; arrival: string; departure: string; purpose: string; status: string }

/** The visitors whose stay meets [from, to], by arrival. */
export function visitorRows(letters: VisitorLetter[], from: string, to: string): ReportDataRow[] {
  return letters.filter((l) => l.arrival <= to && l.departure >= from)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.visitor.localeCompare(b.visitor))
    .map((l) => ({ key: l.id, cells: { visitor: l.visitor || "—", company: l.company ?? "", country: l.country ?? "", arrival: l.arrival, departure: l.departure, purpose: l.purpose, status: l.status } }));
}

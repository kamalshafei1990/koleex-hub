/* ---------------------------------------------------------------------------
   planning-recurrence — weekly recurring planning items (isomorphic).

   A recurring item is NOT stored as a rule that the week queries would have
   to expand: it is expanded ON SAVE into concrete rows, all sharing one
   series id. That keeps every existing week-bounded query, the conflict
   check, utilization and the Projects sync working unchanged.

   The series id lives in planning_items.recurrence_parent_id (a uuid column
   with no foreign key that was never written before): it holds the id of
   the series' FIRST row, the first row included. recurrence_rule keeps a
   readable RRULE-style summary ("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231").

   Wall-clock times are kept in the planner's zone, so a 09:00 shift stays
   09:00 across a DST change.
   --------------------------------------------------------------------------- */

import { safeTimeZone, zonedParts, zonedToUtc } from "./calendar-tz";

export interface PlanningRecurrence {
  /** JS weekday numbers, 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** Last day (inclusive), "YYYY-MM-DD" in the planner's zone. */
  until: string;
}

/** Hard caps — a series is at most a year long and 200 rows. */
export const RECURRENCE_MAX_DAYS = 366;
export const RECURRENCE_MAX_OCCURRENCES = 200;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** Parse the `recurrence` body field. undefined = absent, null = invalid. */
export function parsePlanningRecurrence(v: unknown): PlanningRecurrence | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.weekdays) || typeof o.until !== "string" || !DATE_RE.test(o.until)) return null;
  const days = [...new Set(o.weekdays)].filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
  if (days.length === 0 || days.length !== o.weekdays.length) return null;
  return { weekdays: days.sort((a, b) => a - b), until: o.until };
}

/** A usable IANA zone from a body/query value, or null. */
export function parsePlanningTz(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(v)) return null;
  const z = safeTimeZone(v);
  return z === "UTC" && v !== "UTC" ? null : z;
}

export function recurrenceRuleText(r: PlanningRecurrence): string {
  return `FREQ=WEEKLY;BYDAY=${r.weekdays.map((d) => BYDAY[d]).join(",")};UNTIL=${r.until.replace(/-/g, "")}`;
}

/** Read a stored rule back (for the modal). null when it isn't ours. */
export function parseRecurrenceRuleText(rule: string | null | undefined): PlanningRecurrence | null {
  if (!rule) return null;
  const m = /^FREQ=WEEKLY;BYDAY=([A-Z,]+);UNTIL=(\d{8})$/.exec(rule);
  if (!m) return null;
  const weekdays = m[1].split(",").map((d) => BYDAY.indexOf(d as (typeof BYDAY)[number])).filter((d) => d >= 0);
  if (!weekdays.length) return null;
  return { weekdays, until: `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6, 8)}` };
}

/**
 * Expand a weekly recurrence from the first occurrence. The first
 * occurrence (the item as entered) is always included, then every chosen
 * weekday after it up to `until`, at the same wall time and duration.
 * Returns null when the series would exceed the caps or `until` precedes
 * the start.
 */
export function expandWeekly(
  startIso: string,
  endIso: string,
  rec: PlanningRecurrence,
  tzIn: string,
): Array<{ start_at: string; end_at: string }> | null {
  const tz = safeTimeZone(tzIn);
  const s = Date.parse(startIso);
  const dur = Date.parse(endIso) - s;
  if (!Number.isFinite(s) || !(dur > 0)) return null;
  const p = zonedParts(s, tz);
  const firstKey = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  if (rec.until < firstKey) return null;
  const out = [{ start_at: new Date(s).toISOString(), end_at: new Date(s + dur).toISOString() }];
  for (let off = 1; off <= RECURRENCE_MAX_DAYS; off++) {
    const day = new Date(Date.UTC(p.y, p.m - 1, p.d + off));
    const key = day.toISOString().slice(0, 10);
    if (key > rec.until) return out;
    if (!rec.weekdays.includes(day.getUTCDay())) continue;
    const t = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), p.h, p.mi, p.s, 0, tz);
    out.push({ start_at: new Date(t).toISOString(), end_at: new Date(t + dur).toISOString() });
    if (out.length > RECURRENCE_MAX_OCCURRENCES) return null;
  }
  // Ran past a year without reaching `until`.
  return null;
}

/** Shift an instant by whole days keeping its wall time in `tz` (DST-safe). */
export function shiftDaysInZone(iso: string, days: number, tzIn: string): string {
  const tz = safeTimeZone(tzIn);
  const p = zonedParts(Date.parse(iso), tz);
  return new Date(zonedToUtc(p.y, p.m, p.d + days, p.h, p.mi, p.s, p.ms, tz)).toISOString();
}

/** A change between two instants as seen on the wall clock in `tz`: whole
 *  calendar days plus the change in time of day (ms, may be negative). */
export interface WallDelta {
  days: number;
  ms: number;
}

const wallMsOfDay = (p: { h: number; mi: number; s: number; ms: number }) =>
  ((p.h * 60 + p.mi) * 60 + p.s) * 1000 + p.ms;

/** The wall-clock delta that takes `fromIso` to `toIso` in `tz`. */
export function wallDelta(fromIso: string, toIso: string, tzIn: string): WallDelta {
  const tz = safeTimeZone(tzIn);
  const a = zonedParts(Date.parse(fromIso), tz);
  const b = zonedParts(Date.parse(toIso), tz);
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  return { days, ms: wallMsOfDay(b) - wallMsOfDay(a) };
}

/** Apply a wall-clock delta to an instant in `tz` (DST-safe: "+1 day, +30
 *  minutes" keeps landing on the same wall time across a DST change). */
export function applyWallDelta(iso: string, delta: WallDelta, tzIn: string): string {
  const tz = safeTimeZone(tzIn);
  const p = zonedParts(Date.parse(iso), tz);
  return new Date(zonedToUtc(p.y, p.m, p.d + delta.days, p.h, p.mi, p.s, p.ms + delta.ms, tz)).toISOString();
}

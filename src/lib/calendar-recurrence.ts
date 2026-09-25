/* ---------------------------------------------------------------------------
   Calendar recurrence — pure, isomorphic date math.

   The Calendar stores a recurring event as ONE row (recurrence = daily/weekly/
   monthly, optional recurrence_until). Occurrences are computed on read
   (expandRecurrence) rather than spawned, so there's no dedup/cron drift and a
   series edit is a single-row edit. The reminder cron uses nextOccurrenceStart
   to know when the next alert is due.

   Occurrence n is always computed FROM THE BASE, never by stepping from the
   previous occurrence: a monthly series on the 31st lands on 31 Jan, 28/29 Feb,
   31 Mar … (clamped to the month's last day), where stepping drifted to
   3 Mar, 3 Apr for ever after.

   Occurrences keep the base's WALL-CLOCK time in the organizer's timezone
   (`tz`), so a 09:00 weekly meeting stays at 09:00 across a DST change.
   Without a `tz` the arithmetic runs in UTC — the old behaviour, which the
   callers outside the Calendar (dashboard, brief, reports feed) still use.
   (The table only allows daily/weekly/monthly; there is no yearly cadence.)
   --------------------------------------------------------------------------- */

import { safeTimeZone, zonedParts, zonedToUtc, type WallParts } from "@/lib/calendar-tz";

export type CalendarRec = "daily" | "weekly" | "monthly" | null | undefined;

const DAY = 86_400_000;

function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

/** Occurrence n of a series whose base wall clock is `b`, as a UTC instant. */
function occurrence(b: WallParts, rec: CalendarRec, n: number, tz: string): number {
  if (rec === "daily" || rec === "weekly") {
    const step = rec === "daily" ? n : 7 * n;
    return zonedToUtc(b.y, b.m, b.d + step, b.h, b.mi, b.s, b.ms, tz);
  }
  /* monthly: base month + n, day clamped to the month's end */
  const total = b.m - 1 + n;
  const y = b.y + Math.floor(total / 12);
  const m1 = (((total % 12) + 12) % 12) + 1;
  const d = Math.min(b.d, daysInMonth(y, m1));
  return zonedToUtc(y, m1, d, b.h, b.mi, b.s, b.ms, tz);
}

/** A first index guaranteed not to be past `targetMs` (a small undershoot is
 *  fine — the caller walks forward from it). */
function firstIndexNear(baseMs: number, rec: CalendarRec, targetMs: number): number {
  if (targetMs <= baseMs) return 0;
  const span = targetMs - baseMs;
  const approx = rec === "daily" ? span / DAY : rec === "weekly" ? span / (7 * DAY) : span / (31 * DAY);
  return Math.max(0, Math.floor(approx) - 2);
}

/** Last instant of the `until` date, in the organizer's zone. */
function untilBoundary(untilDate: string | null | undefined, tz: string): number | null {
  if (!untilDate || !/^\d{4}-\d{2}-\d{2}/.test(untilDate)) return null;
  const [y, m, d] = untilDate.slice(0, 10).split("-").map(Number);
  const t = zonedToUtc(y, m, d, 23, 59, 59, 999, tz);
  return Number.isFinite(t) ? t : null;
}

/** All occurrence [start,end] pairs whose span overlaps [winFrom, winTo).
 *  Returns [] for a non-recurring event (caller renders the base row itself). */
export function expandRecurrence(
  baseStartISO: string,
  baseEndISO: string,
  rec: CalendarRec,
  untilDate: string | null | undefined,
  winFrom: Date,
  winTo: Date,
  cap = 400,
  tz = "UTC",
): Array<{ start: Date; end: Date }> {
  if (!rec) return [];
  const bStart = Date.parse(baseStartISO);
  const bEnd = Date.parse(baseEndISO);
  if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) return [];
  const zone = safeTimeZone(tz);
  const durationMs = Math.max(0, bEnd - bStart);
  const until = untilBoundary(untilDate, zone);
  const fromMs = winFrom.getTime();
  const toMs = winTo.getTime();
  const base = zonedParts(bStart, zone);

  const out: Array<{ start: Date; end: Date }> = [];
  let n = firstIndexNear(bStart, rec, fromMs - durationMs);
  for (let guard = 0; guard < cap + 64; guard++, n++) {
    const s = occurrence(base, rec, n, zone);
    if (s >= toMs) break;
    if (until != null && s > until) break;
    const e = s + durationMs;
    if (e >= fromMs) {
      out.push({ start: new Date(s), end: new Date(e) });
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** The next occurrence start relevant for reminders: earliest start at/after
 *  `now` (with a 60s grace so a just-passed start isn't skipped). Returns the
 *  base start for one-off events, or null when the series has ended. */
export function nextOccurrenceStart(
  baseStartISO: string,
  rec: CalendarRec,
  untilDate: string | null | undefined,
  now: Date,
  tz = "UTC",
): Date | null {
  const bStart = Date.parse(baseStartISO);
  if (!Number.isFinite(bStart)) return null;
  if (!rec) return new Date(bStart);
  const zone = safeTimeZone(tz);
  const floor = now.getTime() - 60_000;
  const until = untilBoundary(untilDate, zone);
  const base = zonedParts(bStart, zone);
  let n = firstIndexNear(bStart, rec, floor);
  for (let guard = 0; guard < 64; guard++, n++) {
    const s = occurrence(base, rec, n, zone);
    if (s < floor) continue;
    if (until != null && s > until) return null;
    return new Date(s);
  }
  return null;
}

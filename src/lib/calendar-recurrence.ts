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

/* ── "This occurrence only" ──────────────────────────────────────────────
   A series can have exceptions (koleex_calendar_event_exceptions), keyed by
   an occurrence's ORIGINAL start: a skip removes the occurrence, an override
   replaces its title / time / place / link. The feed and the reminder cron
   both run the expansion through here, so they agree on what happens. */

export interface OccurrenceException {
  occurrence_start: string;
  kind: "skip" | "override";
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
  meeting_url?: string | null;
}

export interface EffectiveOccurrence {
  start: Date;
  end: Date;
  /** The occurrence's original start — its key. */
  original: Date;
  override?: OccurrenceException;
}

/** Index a series' exceptions by the ms of their original start. */
export function exceptionIndex(list: OccurrenceException[] | undefined): Map<number, OccurrenceException> {
  const out = new Map<number, OccurrenceException>();
  for (const e of list ?? []) {
    const ms = Date.parse(e.occurrence_start);
    if (Number.isFinite(ms)) out.set(ms, e);
  }
  return out;
}

/** The occurrences of a series that land in [winFrom, winTo) once its
 *  exceptions are applied: skipped ones are dropped, overridden ones take
 *  their own time (and may move into or out of the window). */
export function expandWithExceptions(
  baseStartISO: string,
  baseEndISO: string,
  rec: CalendarRec,
  untilDate: string | null | undefined,
  winFrom: Date,
  winTo: Date,
  exceptions: OccurrenceException[] | undefined,
  cap = 400,
  tz = "UTC",
): EffectiveOccurrence[] {
  const index = exceptionIndex(exceptions);
  const durationMs = Math.max(0, Date.parse(baseEndISO) - Date.parse(baseStartISO));
  const fromMs = winFrom.getTime();
  const toMs = winTo.getTime();
  const overlaps = (s: number, e: number) => e >= fromMs && s < toMs;
  const out: EffectiveOccurrence[] = [];
  const seen = new Set<number>();
  for (const o of expandRecurrence(baseStartISO, baseEndISO, rec, untilDate, winFrom, winTo, cap, tz)) {
    const key = o.start.getTime();
    seen.add(key);
    const ex = index.get(key);
    if (!ex) { out.push({ start: o.start, end: o.end, original: o.start }); continue; }
    if (ex.kind === "skip") continue;
    const eff = effectiveSpan(key, durationMs, ex);
    if (overlaps(eff.s, eff.e)) out.push({ start: new Date(eff.s), end: new Date(eff.e), original: o.start, override: ex });
  }
  /* An override moved INTO the window from an occurrence outside it. */
  for (const [key, ex] of index) {
    if (seen.has(key) || ex.kind !== "override" || !ex.start_at) continue;
    const eff = effectiveSpan(key, durationMs, ex);
    if (overlaps(eff.s, eff.e)) out.push({ start: new Date(eff.s), end: new Date(eff.e), original: new Date(key), override: ex });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function effectiveSpan(originalMs: number, durationMs: number, ex: OccurrenceException): { s: number; e: number } {
  const s = ex.start_at ? Date.parse(ex.start_at) : originalMs;
  const start = Number.isFinite(s) ? s : originalMs;
  const e = ex.end_at ? Date.parse(ex.end_at) : NaN;
  return { s: start, e: Number.isFinite(e) && e >= start ? e : start + durationMs };
}

/** Is `occurrenceISO` really an occurrence of this series (its original
 *  start)? Used to refuse an exception keyed on a time the series never has. */
export function isOccurrenceOf(
  baseStartISO: string,
  baseEndISO: string,
  rec: CalendarRec,
  untilDate: string | null | undefined,
  occurrenceISO: string,
  tz = "UTC",
): boolean {
  const ms = Date.parse(occurrenceISO);
  if (!rec || !Number.isFinite(ms)) return false;
  return expandRecurrence(baseStartISO, baseEndISO, rec, untilDate, new Date(ms - 1), new Date(ms + 1), 8, tz)
    .some((o) => o.start.getTime() === ms);
}

/** The next occurrence a reminder is due for, exceptions applied: the
 *  earliest EFFECTIVE start at/after `now` (60s grace). A one-off answers
 *  its own start. */
export function nextEffectiveOccurrence(
  baseStartISO: string,
  baseEndISO: string,
  rec: CalendarRec,
  untilDate: string | null | undefined,
  now: Date,
  exceptions: OccurrenceException[] | undefined,
  tz = "UTC",
): EffectiveOccurrence | null {
  const bStart = Date.parse(baseStartISO);
  if (!Number.isFinite(bStart)) return null;
  if (!rec) {
    const bEnd = Date.parse(baseEndISO);
    return { start: new Date(bStart), end: new Date(Number.isFinite(bEnd) ? bEnd : bStart), original: new Date(bStart) };
  }
  if (!exceptions || exceptions.length === 0) {
    const s = nextOccurrenceStart(baseStartISO, rec, untilDate, now, tz);
    if (!s) return null;
    const dur = Math.max(0, Date.parse(baseEndISO) - bStart);
    return { start: s, end: new Date(s.getTime() + dur), original: s };
  }
  const floor = now.getTime() - 60_000;
  const step = rec === "daily" ? 4 * DAY : rec === "weekly" ? 22 * DAY : 70 * DAY;
  /* Look back a little: an override can move an earlier occurrence later. */
  let from = floor - 8 * DAY;
  for (let tries = 0; tries < 6; tries++) {
    const to = floor + step * (tries + 1);
    const list = expandWithExceptions(baseStartISO, baseEndISO, rec, untilDate, new Date(from), new Date(to), exceptions, 128, tz)
      .filter((o) => o.start.getTime() >= floor);
    if (list.length) return list[0];
    from = to;
    const until = untilBoundary(untilDate, safeTimeZone(tz));
    if (until != null && until < from) return null;
  }
  return null;
}

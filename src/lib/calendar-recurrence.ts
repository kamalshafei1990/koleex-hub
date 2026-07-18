/* ---------------------------------------------------------------------------
   Calendar recurrence — pure, isomorphic date math.

   The Calendar stores a recurring event as ONE row (recurrence = daily/weekly/
   monthly, optional recurrence_until). Occurrences are computed on read
   (expandRecurrence) rather than spawned, so there's no dedup/cron drift and a
   series edit is a single-row edit. The reminder cron uses nextOccurrenceStart
   to know when the next alert is due.

   Times are shifted on the UTC instant, preserving the UTC time-of-day — exact
   for fixed-offset timezones (the Hub's model); DST transitions can nudge an
   occurrence by an hour, acceptable for v1.
   --------------------------------------------------------------------------- */

export type CalendarRec = "daily" | "weekly" | "monthly" | null | undefined;

function addPeriod(d: Date, rec: CalendarRec, n: number): Date {
  const x = new Date(d.getTime());
  if (rec === "daily") x.setUTCDate(x.getUTCDate() + n);
  else if (rec === "weekly") x.setUTCDate(x.getUTCDate() + 7 * n);
  else if (rec === "monthly") x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function untilBoundary(untilDate: string | null | undefined): number | null {
  if (!untilDate) return null;
  const t = new Date(`${untilDate}T23:59:59.999Z`).getTime();
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
): Array<{ start: Date; end: Date }> {
  if (!rec) return [];
  const bStart = new Date(baseStartISO);
  const bEnd = new Date(baseEndISO);
  if (!Number.isFinite(bStart.getTime()) || !Number.isFinite(bEnd.getTime())) return [];
  const durationMs = Math.max(0, bEnd.getTime() - bStart.getTime());
  const until = untilBoundary(untilDate);
  const fromMs = winFrom.getTime();
  const toMs = winTo.getTime();

  // Fast-forward to the first occurrence that could overlap the window.
  let s = new Date(bStart.getTime());
  let guard = 0;
  while (s.getTime() + durationMs < fromMs && guard < 6000) {
    s = addPeriod(s, rec, 1);
    guard++;
  }

  const out: Array<{ start: Date; end: Date }> = [];
  guard = 0;
  while (s.getTime() < toMs && guard < cap) {
    if (until != null && s.getTime() > until) break;
    const e = new Date(s.getTime() + durationMs);
    if (e.getTime() >= fromMs) out.push({ start: new Date(s.getTime()), end: e });
    s = addPeriod(s, rec, 1);
    guard++;
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
): Date | null {
  const bStart = new Date(baseStartISO);
  if (!Number.isFinite(bStart.getTime())) return null;
  if (!rec) return bStart;
  const floor = now.getTime() - 60_000;
  const until = untilBoundary(untilDate);
  let s = new Date(bStart.getTime());
  let guard = 0;
  while (s.getTime() < floor && guard < 6000) {
    s = addPeriod(s, rec, 1);
    guard++;
  }
  if (until != null && s.getTime() > until) return null;
  return s;
}

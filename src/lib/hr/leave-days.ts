/* leave-days — the one working-day count for a leave request.
 *
 * Pure, no I/O: the HR app (browser), the employee's own "My HR" page and the
 * server routes that accept a request all count the same way, so a request
 * can never be booked for a different number of days than the screen showed.
 *
 * Since Phase C the count takes a WorkCalendar (per-country weekend + public
 * holidays, see ./work-calendar); without one it is Sat/Sun and no holidays —
 * exactly what every caller did before.
 */
import { countWorkingDays, parseIsoDate, type WorkCalendar } from "./work-calendar";

export function computeBusinessDays(start: string, end: string, cal?: WorkCalendar): number {
  return countWorkingDays(start, end, cal);
}

/** Calendar days inclusive — what a customs officer or a landlord counts. */
export function calendarDays(start: string, end: string): number {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** Two date ranges overlap (inclusive). */
export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart <= bEnd && bStart <= aEnd;

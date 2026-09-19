/* leave-days — the one working-day count for a leave request.
 *
 * Pure, no imports: the HR app (browser), the employee's own "My HR" page
 * and the server routes that accept a request all count the same way, so a
 * request can never be booked for a different number of days than the
 * screen showed. Weekend = Saturday + Sunday for now; when the per-country
 * calendar lands (holidays, Friday/Saturday weekends) it plugs in here and
 * every caller follows.
 */
export function computeBusinessDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Calendar days inclusive — what a customs officer or a landlord counts. */
export function calendarDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** Two date ranges overlap (inclusive). */
export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart <= bEnd && bStart <= aEnd;

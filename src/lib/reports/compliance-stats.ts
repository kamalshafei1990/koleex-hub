/* ---------------------------------------------------------------------------
   Reports — compliance by month (owner's pick 26/09/2026, «إحصائيات
   الالتزام بالشهور»): for each person, what fell due in each month and what
   became of it — on time, late, missing — on their own calendar, the
   month's rate, and the team's.

   A report counts in the month its DEADLINE falls in: a day's report on its
   day, a week's report in the month of its last working day, a month's
   report in the next month (the 3rd working day). What is not yet due is
   pending — neither on time nor missing, and out of the rate. Nothing before
   the person's start (tracking or hire) counts. The same states the
   compliance board shows (cellOf), so a month is the board's weeks added up.

   Pure; the server gathers the facts (src/lib/server/reports/stats.ts) and
   validate:reports proves the months.
   --------------------------------------------------------------------------- */

import { isoWeekKey } from "./templates";
import {
  addDays, cellOf, dailyDue, mondayOf, monthlyDue, nextMonth, prevMonth, weeklyDue,
  type Clock, type Due, type ObligationKey, type PersonFacts, type SentLookup,
} from "./obligations";

export interface MonthTally { onTime: number; late: number; missing: number; pending: number }
export const emptyTally = (): MonthTally => ({ onTime: 0, late: 0, missing: 0, pending: 0 });

/** The share on time of what is decided (on time + late + missing), as a
 *  whole percent; null while nothing is decided. */
export function rateOf(t: MonthTally): number | null {
  const decided = t.onTime + t.late + t.missing;
  return decided ? Math.round((t.onTime / decided) * 100) : null;
}

export function addTally(a: MonthTally, b: MonthTally): MonthTally {
  return { onTime: a.onTime + b.onTime, late: a.late + b.late, missing: a.missing + b.missing, pending: a.pending + b.pending };
}

/** "2026-10" → its first and last day. */
export function monthBounds(month: string): { first: string; last: string } {
  const first = `${month}-01`;
  return { first, last: addDays(`${nextMonth(month)}-01`, -1) };
}

/** The last `n` months up to `today`'s, oldest first — never before the
 *  month counting started (nothing before it can be late or missing). */
export function statMonths(today: string, n: number, trackingFrom: string | null): string[] {
  const out: string[] = [];
  let m = today.slice(0, 7);
  for (let i = 0; i < Math.max(1, Math.min(n, 12)); i++) { out.unshift(m); m = prevMonth(m); }
  return trackingFrom ? out.filter((x) => x >= trackingFrom.slice(0, 7)) : [];
}

/** One person's tally for each month. */
export function monthTallies(p: PersonFacts, months: string[], sent: SentLookup, now: string, clock: Clock): Record<string, MonthTally> {
  const c = p.clock;
  const out: Record<string, MonthTally> = Object.fromEntries(months.map((m) => [m, emptyTally()]));
  if (!c.from || !months.length) return out;
  const add = (key: ObligationKey, periodKey: string, due: Due | null) => {
    if (!due || due.day < c.from!) return;
    const month = due.day.slice(0, 7);
    const t = out[month];
    if (!t) return;
    const state = cellOf({ due, sent: sent(key, periodKey), now, startsAt: null, from: c.from }).state;
    if (state === "sent") t.onTime++;
    else if (state === "late") t.late++;
    else if (state === "missing") t.missing++;
    else if (state === "due" || state === "upcoming") t.pending++;
  };
  const first = monthBounds(months[0]).first;
  const last = monthBounds(months[months.length - 1]).last;
  if (p.obliged.daily) for (let d = first; d <= last; d = addDays(d, 1)) add("daily", d, dailyDue(c, d, clock));
  /* A week is counted where its deadline lands — the week before the first
     month may fall due inside it. */
  if (p.obliged.weekly) for (let m = mondayOf(addDays(first, -7)); m <= last; m = addDays(m, 7)) add("weekly", isoWeekKey(m), weeklyDue(c, m, clock));
  if (p.obliged.monthly) for (let mo = prevMonth(months[0]); mo <= months[months.length - 1]; mo = nextMonth(mo)) add("monthly", mo, monthlyDue(c, mo, clock));
  return out;
}

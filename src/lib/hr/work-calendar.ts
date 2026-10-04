/* work-calendar — which days are WORKING days. Pure; shared by the browser
 * (leave forms, sheets) and the server (leave days, attendance sheet).
 *
 * A calendar = the rest weekdays + the dated holidays of ONE country. Both
 * come from koleex_holidays (the Calendar app's per-country reference data):
 * weekly rows give the weekend, national/official rows the dates. The server
 * loader (lib/server/work-calendar.ts) builds it; the DEFAULT below (Sat/Sun,
 * no holidays) is what every caller used before Phase C, so nothing changes
 * for a country nobody has configured.
 */
export interface WorkCalendar {
  /** JS getDay() numbers that are rest days: 0 = Sunday … 6 = Saturday. */
  weekend: number[];
  /** ISO dates (YYYY-MM-DD) that are public / company holidays. */
  holidays: string[];
  /** ISO alpha-2 the calendar was built for, null = default. */
  country: string | null;
}

export const DEFAULT_WORK_CALENDAR: WorkCalendar = { weekend: [0, 6], holidays: [], country: null };

export type DayKind = "workday" | "weekend" | "holiday";

/** Parse YYYY-MM-DD as a LOCAL date (no timezone shift at midnight). */
export const parseIsoDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};
export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dayKind(iso: string, cal: WorkCalendar = DEFAULT_WORK_CALENDAR): DayKind {
  if (cal.holidays.includes(iso)) return "holiday";
  const d = parseIsoDate(iso);
  if (d && cal.weekend.includes(d.getDay())) return "weekend";
  return "workday";
}

export const isWorkingDay = (iso: string, cal?: WorkCalendar): boolean => dayKind(iso, cal) === "workday";

/** Working days in [start, end] inclusive. 0 for an invalid or reversed range. */
export function countWorkingDays(start: string, end: string, cal: WorkCalendar = DEFAULT_WORK_CALENDAR): number {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (!s || !e || e < s) return 0;
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (isWorkingDay(toIsoDate(cur), cal)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/** Every ISO date of a month, in order. `month` is 1–12. */
export function daysOfMonth(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) out.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return out;
}

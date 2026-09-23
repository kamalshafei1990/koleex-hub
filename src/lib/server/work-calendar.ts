import "server-only";

/* work-calendar (server) — builds a WorkCalendar and an attendance policy
 * for a country from the Calendar app's koleex_holidays and
 * hr_attendance_policies. One loader, used by leave (day counts), the
 * attendance sheet (weekend / holiday days) and the self punch (late).
 *
 * koleex_holidays stores the country by NAME ("China"), employees carry the
 * ISO code ("CN"); COUNTRIES bridges the two. Weekly rows use JS getDay()
 * (0 = Sunday). Annual rows (recurs_annually) are expanded onto every year in
 * the requested window.
 */
import { supabaseServer } from "@/lib/server/supabase-server";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import { DEFAULT_WORK_CALENDAR, type WorkCalendar } from "@/lib/hr/work-calendar";

export interface AttendancePolicy {
  id: string | null;
  name: string;
  country: string | null;
  timezone: string;
  /** "HH:MM" wall-clock in `timezone`. */
  workStart: string;
  workEnd: string;
  lateThresholdMin: number;
  minHours: number;
  /** Rest weekdays as JS getDay() numbers. */
  weekend: number[];
  /** First day attendance counts (ISO date). Before it — and before an
   *  employee's hire date — a workday with no punch is "not tracked", never
   *  "absent". Null = HR has not started tracking yet. */
  trackingFrom: string | null;
}

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const DEFAULT_POLICY: AttendancePolicy = {
  id: null, name: "Standard Office Hours", country: null, timezone: "Asia/Shanghai",
  workStart: "09:00", workEnd: "18:00", lateThresholdMin: 15, minHours: 8, weekend: [0, 6], trackingFrom: null,
};

const countryNames = (code: string | null): string[] => {
  if (!code) return [];
  const c = COUNTRIES.find((x) => x.code === code.toUpperCase());
  return c ? [c.name, c.code] : [code];
};

/** The employee's work country: the explicit column, else home address, else
 *  nationality. Null → the default calendar/policy. */
export async function resolveEmployeeCountry(employeeId: string): Promise<string | null> {
  const { data } = await supabaseServer.from("koleex_employees")
    .select("work_country, nationality, people(country)").eq("id", employeeId).maybeSingle();
  const e = data as { work_country?: string | null; nationality?: string | null; people?: { country?: string | null } | { country?: string | null }[] | null } | null;
  if (!e) return null;
  const p = Array.isArray(e.people) ? e.people[0] : e.people;
  return (e.work_country || p?.country || e.nationality || null)?.toUpperCase() ?? null;
}

export type PolicyRow = {
  id: string; name: string; country: string | null; timezone: string | null; work_start: string; work_end: string;
  late_threshold_min: number; min_hours: number; weekend_days: string[] | null; is_default: boolean; tracking_from: string | null;
};
const POLICY_COLS = "id, name, country, timezone, work_start, work_end, late_threshold_min, min_hours, weekend_days, is_default, tracking_from";

/** Every policy row, once — the nightly job and the approval queues pick a
 *  policy per employee from one read instead of one read per employee. */
/** Work countries for many employees in one read (same rule as
 *  resolveEmployeeCountry: the column, else home country, else nationality). */
export async function resolveEmployeeCountries(employeeIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = Array.from(new Set(employeeIds.filter(Boolean)));
  if (ids.length === 0) return out;
  const { data } = await supabaseServer.from("koleex_employees").select("id, work_country, nationality, people(country)").in("id", ids);
  for (const e of (data ?? []) as Array<{ id: string; work_country?: string | null; nationality?: string | null; people?: { country?: string | null } | { country?: string | null }[] | null }>) {
    const p = Array.isArray(e.people) ? e.people[0] : e.people;
    out.set(e.id, (e.work_country || p?.country || e.nationality || null)?.toUpperCase() ?? null);
  }
  return out;
}

export async function loadPolicyRows(): Promise<PolicyRow[]> {
  const { data } = await supabaseServer.from("hr_attendance_policies").select(POLICY_COLS);
  return (data ?? []) as PolicyRow[];
}

/** The policy for a country from rows already loaded: the country's own,
 *  else the default. */
export function pickPolicy(rows: PolicyRow[], country: string | null): AttendancePolicy {
  const row = (country && rows.find((r) => r.country?.toUpperCase() === country.toUpperCase()))
    || rows.find((r) => r.is_default && !r.country) || rows.find((r) => r.is_default) || null;
  if (!row) return DEFAULT_POLICY;
  return {
    id: row.id, name: row.name, country: row.country, timezone: row.timezone || DEFAULT_POLICY.timezone,
    workStart: String(row.work_start).slice(0, 5), workEnd: String(row.work_end).slice(0, 5),
    lateThresholdMin: Number(row.late_threshold_min ?? 15), minHours: Number(row.min_hours ?? 8),
    weekend: (row.weekend_days ?? ["saturday", "sunday"]).map((n) => WEEKDAY_NAMES.indexOf(String(n).toLowerCase())).filter((n) => n >= 0),
    trackingFrom: row.tracking_from ? String(row.tracking_from).slice(0, 10) : null,
  };
}

export async function loadPolicy(country: string | null): Promise<AttendancePolicy> {
  return pickPolicy(await loadPolicyRows(), country);
}

/** Calendar for a country over [from, to] (ISO dates). Weekend from the
 *  weekly holiday rows, else the policy's weekend_days, else Sat/Sun. */
export async function loadWorkCalendar(tenantId: string | null, country: string | null, from: string, to: string, policy?: AttendancePolicy): Promise<WorkCalendar> {
  const names = countryNames(country);
  if (!tenantId || names.length === 0) return { ...DEFAULT_WORK_CALENDAR, weekend: policy?.weekend ?? DEFAULT_WORK_CALENDAR.weekend, country };
  const { data } = await supabaseServer.from("koleex_holidays")
    .select("holiday_type, holiday_date, weekday, recurs_annually")
    .eq("tenant_id", tenantId).eq("is_active", true).eq("scope_type", "country").in("country", names);
  const rows = (data ?? []) as Array<{ holiday_type: string; holiday_date: string | null; weekday: number | null; recurs_annually: boolean }>;
  const weekly = rows.filter((r) => r.holiday_type === "weekly" && r.weekday !== null).map((r) => Number(r.weekday));
  const yFrom = Number(from.slice(0, 4)), yTo = Number(to.slice(0, 4));
  const holidays = new Set<string>();
  for (const r of rows) {
    if (r.holiday_type === "weekly" || !r.holiday_date) continue;
    if (r.recurs_annually) {
      for (let y = yFrom; y <= yTo; y++) {
        const d = `${y}-${r.holiday_date.slice(5, 10)}`;
        if (d >= from && d <= to) holidays.add(d);
      }
    } else if (r.holiday_date >= from && r.holiday_date <= to) holidays.add(r.holiday_date);
  }
  return {
    weekend: weekly.length ? Array.from(new Set(weekly)) : policy?.weekend ?? DEFAULT_WORK_CALENDAR.weekend,
    holidays: Array.from(holidays).sort(),
    country,
  };
}

/** "HH:MM" of an instant in a zone. */
export function wallClock(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace("24:", "00:");
  } catch { return new Date(iso).toISOString().slice(11, 16); }
}
const minutes = (hhmm: string): number => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

/** Minutes late against the policy (0 when on time or no clock-in). */
export function lateMinutes(clockIn: string | null, policy: AttendancePolicy): number {
  if (!clockIn) return 0;
  const diff = minutes(wallClock(clockIn, policy.timezone)) - (minutes(policy.workStart) + policy.lateThresholdMin);
  return diff > 0 ? diff : 0;
}

/** The instant of wall-clock "HH:MM" on an ISO date in a zone. The zone's
 *  offset is read from Intl at that instant — no library for one shift. */
export function wallClockToIso(date: string, hhmm: string, tz: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm.trim());
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const local = new Date(`${date}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}Z`);
  if (Number.isNaN(local.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(local);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return new Date(local.getTime() - (asUtc - local.getTime())).toISOString();
  } catch {
    return local.toISOString();
  }
}

/** ISO date of "today" in a zone. */
export function todayInZone(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** The instant the policy's working day ends on `date`. */
export function dayEndIso(date: string, policy: AttendancePolicy): string | null {
  return wallClockToIso(date, policy.workEnd, policy.timezone);
}

/** Overtime (owner rule, 23 Sep 2026): only the time worked AFTER the
 *  policy's end time counts; the hours before it are the normal day, however
 *  long they were. Nothing is paid until HR or the owner approves it — the
 *  approval queue shows the clock-in, so a late arrival who stayed late can
 *  be approved for less. Whole minutes; 0 without a clock-out. */
export function overtimeMinutes(clockIn: string | null, clockOut: string | null, date: string, policy: AttendancePolicy): number {
  if (!clockIn || !clockOut) return 0;
  const end = dayEndIso(date, policy);
  if (!end) return 0;
  const start = Math.max(Date.parse(clockIn), Date.parse(end));
  const mins = Math.floor((Date.parse(clockOut) - start) / 60000);
  return mins > 0 ? mins : 0;
}

/** Hours between two instants minus a break, 2 decimals, never negative. */
export function workedHours(clockIn: string, clockOut: string, breakMinutes: number): number {
  const minutes = (Date.parse(clockOut) - Date.parse(clockIn)) / 60000 - (breakMinutes || 0);
  return Math.max(0, Math.round((minutes / 60) * 100) / 100);
}

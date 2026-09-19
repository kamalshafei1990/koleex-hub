import "server-only";

/* attendance-sheet — one employee, one month, every day accounted for.
 *
 * The raw table only holds days someone punched. A sheet HR (or the employee)
 * can read must also say which days were weekend, holiday, approved leave,
 * or simply absent — derived here, never inserted: the records table stays
 * the record of punches, the sheet is the reading of it.
 *
 * Status per day, in priority: leave (approved request covers it) → holiday
 * → weekend → punched (present / late / half_day, late re-derived from the
 * policy so a policy change re-reads history) → absent (a past workday with
 * no punch) → future (nothing yet).
 */
import { supabaseServer } from "@/lib/server/supabase-server";
import { daysOfMonth, dayKind } from "@/lib/hr/work-calendar";
import { loadPolicy, loadWorkCalendar, lateMinutes, resolveEmployeeCountry, type AttendancePolicy } from "@/lib/server/work-calendar";
import type { WorkCalendar } from "@/lib/hr/work-calendar";

export type SheetStatus = "present" | "late" | "half_day" | "absent" | "leave" | "holiday" | "weekend" | "future";

export interface SheetDay {
  date: string;
  status: SheetStatus;
  clockIn: string | null;
  clockOut: string | null;
  hours: number | null;
  lateMin: number;
  overtimeH: number;
  source: string | null;
  /** For leave days: the leave type name. */
  note: string | null;
  recordId: string | null;
}
export interface AttendanceSheet {
  employeeId: string;
  month: string; // YYYY-MM
  country: string | null;
  policy: AttendancePolicy;
  calendar: WorkCalendar;
  days: SheetDay[];
  summary: { workdays: number; present: number; late: number; absent: number; leave: number; hours: number; overtimeH: number; lateMin: number; halfDays: number };
}

export async function buildAttendanceSheet(opts: { employeeId: string; tenantId: string | null; year: number; month: number; today: string }): Promise<AttendanceSheet> {
  const days = daysOfMonth(opts.year, opts.month);
  const from = days[0], to = days[days.length - 1];
  const country = await resolveEmployeeCountry(opts.employeeId);
  const policy = await loadPolicy(country);
  const [calendar, { data: recs }, { data: leaves }] = await Promise.all([
    loadWorkCalendar(opts.tenantId, country, from, to, policy),
    supabaseServer.from("hr_attendance_records").select("id, date, clock_in, clock_out, total_hours, status, source")
      .eq("employee_id", opts.employeeId).gte("date", from).lte("date", to),
    supabaseServer.from("hr_leave_requests").select("start_date, end_date, half_day, hr_leave_types(name)")
      .eq("employee_id", opts.employeeId).eq("status", "approved").lte("start_date", to).gte("end_date", from),
  ]);
  const byDate = new Map<string, { id: string; date: string; clock_in: string | null; clock_out: string | null; total_hours: number | null; status: string; source: string | null }>();
  for (const r of (recs ?? []) as Array<{ id: string; date: string; clock_in: string | null; clock_out: string | null; total_hours: number | null; status: string; source: string | null }>) byDate.set(r.date, r);
  const leaveOn = new Map<string, string>();
  for (const l of (leaves ?? []) as Array<{ start_date: string; end_date: string; half_day: boolean; hr_leave_types?: { name?: string } | { name?: string }[] | null }>) {
    const t = Array.isArray(l.hr_leave_types) ? l.hr_leave_types[0] : l.hr_leave_types;
    for (const d of days) if (d >= l.start_date && d <= l.end_date) leaveOn.set(d, `${t?.name ?? "Leave"}${l.half_day ? " (½)" : ""}`);
  }

  const summary = { workdays: 0, present: 0, late: 0, absent: 0, leave: 0, hours: 0, overtimeH: 0, lateMin: 0, halfDays: 0 };
  const out: SheetDay[] = days.map((date) => {
    const kind = dayKind(date, calendar);
    const rec = byDate.get(date) ?? null;
    const base: SheetDay = { date, status: "future", clockIn: rec?.clock_in ?? null, clockOut: rec?.clock_out ?? null, hours: rec?.total_hours ?? null, lateMin: 0, overtimeH: 0, source: rec?.source ?? null, note: null, recordId: rec?.id ?? null };
    if (kind === "workday") summary.workdays++;
    if (leaveOn.has(date)) { summary.leave++; return { ...base, status: "leave", note: leaveOn.get(date)! }; }
    if (kind === "holiday") return { ...base, status: "holiday" };
    if (kind === "weekend") return { ...base, status: "weekend" };
    if (rec) {
      const lateMin = lateMinutes(rec.clock_in, policy);
      const hours = rec.total_hours === null ? null : Number(rec.total_hours);
      const overtimeH = hours !== null && hours > policy.minHours ? Math.round((hours - policy.minHours) * 100) / 100 : 0;
      const status: SheetStatus = rec.status === "half_day" ? "half_day" : rec.status === "absent" ? "absent" : lateMin > 0 ? "late" : "present";
      if (status === "absent") summary.absent++; else { summary.present++; if (status === "late") summary.late++; if (status === "half_day") summary.halfDays++; }
      summary.hours += hours ?? 0; summary.overtimeH += overtimeH; summary.lateMin += lateMin;
      return { ...base, status, hours, lateMin, overtimeH };
    }
    if (date < opts.today) { summary.absent++; return { ...base, status: "absent" }; }
    return base;
  });
  summary.hours = Math.round(summary.hours * 100) / 100;
  summary.overtimeH = Math.round(summary.overtimeH * 100) / 100;
  return { employeeId: opts.employeeId, month: `${opts.year}-${String(opts.month).padStart(2, "0")}`, country, policy, calendar, days: out, summary };
}

export const parseMonth = (v: string | null, fallbackToday: string): { year: number; month: number } => {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  const src = m ? `${m[1]}-${m[2]}` : fallbackToday.slice(0, 7);
  return { year: Number(src.slice(0, 4)), month: Number(src.slice(5, 7)) };
};

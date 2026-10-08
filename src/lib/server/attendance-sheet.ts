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
 *
 * Phase 1 (owner-approved 23 Sep 2026):
 *  · a past workday with no punch BEFORE the policy's tracking start, or
 *    before the employee's hire date, is "not_tracked", never "absent" —
 *    and with no tracking start set at all, nothing is absent yet;
 *  · overtime is the time after the policy's end time (not hours beyond the
 *    minimum), and only APPROVED overtime reaches payroll: each day carries
 *    its decision (pending until HR or the owner decides).
 */
import { supabaseServer } from "@/lib/server/supabase-server";
import { daysOfMonth, dayKind } from "@/lib/hr/work-calendar";
import { loadPolicy, loadWorkCalendar, lateMinutes, overtimeMinutes, resolveEmployeeCountry, type AttendancePolicy } from "@/lib/server/work-calendar";
import type { WorkCalendar } from "@/lib/hr/work-calendar";

export type SheetStatus = "present" | "late" | "half_day" | "absent" | "not_tracked" | "leave" | "holiday" | "weekend" | "future";
export type OvertimeState = "pending" | "approved" | "rejected";

export interface SheetDay {
  date: string;
  status: SheetStatus;
  clockIn: string | null;
  clockOut: string | null;
  hours: number | null;
  lateMin: number;
  /** Time after the policy's end time, hours. */
  overtimeH: number;
  /** Null when the day has no overtime. */
  overtimeState: OvertimeState | null;
  /** What payroll pays for this day: the approved hours, else 0. */
  overtimeApprovedH: number;
  breakMinutes: number;
  /** Closed by the nightly job at the policy end time — needs review. */
  autoClosed: boolean;
  /** Changed by HR or through an approved correction request. */
  corrected: boolean;
  /** Punched from outside the office (a works-remote employee's app punch). */
  remote: boolean;
  source: string | null;
  /** For leave days: the leave type name. */
  note: string | null;
  /** For leave days: false when the leave type is unpaid (payroll deducts it). */
  leavePaid: boolean | null;
  recordId: string | null;
}
export interface AttendanceSheet {
  employeeId: string;
  month: string; // YYYY-MM
  country: string | null;
  policy: AttendancePolicy;
  calendar: WorkCalendar;
  days: SheetDay[];
  summary: {
    workdays: number; present: number; late: number; absent: number; leave: number; hours: number; overtimeH: number; lateMin: number; halfDays: number;
    notTracked: number; autoClosed: number; overtimePendingH: number; overtimeApprovedH: number;
  };
  /** The first day that can be "absent" for this employee (tracking start or
   *  hire date, the later); null = nothing counts as absent yet. */
  trackingFrom: string | null;
}

export async function buildAttendanceSheet(opts: { employeeId: string; tenantId: string | null; year: number; month: number; today: string }): Promise<AttendanceSheet> {
  const days = daysOfMonth(opts.year, opts.month);
  const from = days[0], to = days[days.length - 1];
  const country = await resolveEmployeeCountry(opts.employeeId);
  const policy = await loadPolicy(country);
  const [calendar, { data: recs }, { data: leaves }, { data: emp }] = await Promise.all([
    loadWorkCalendar(opts.tenantId, country, from, to, policy),
    supabaseServer.from("hr_attendance_records")
      .select("id, date, clock_in, clock_out, total_hours, break_minutes, status, source, remote, auto_closed, corrected, overtime_status, overtime_approved_minutes")
      .eq("employee_id", opts.employeeId).gte("date", from).lte("date", to),
    supabaseServer.from("hr_leave_requests").select("start_date, end_date, half_day, hr_leave_types(name, is_paid)")
      .eq("employee_id", opts.employeeId).eq("status", "approved").lte("start_date", to).gte("end_date", from),
    supabaseServer.from("koleex_employees").select("hire_date").eq("id", opts.employeeId).maybeSingle(),
  ]);
  const hireDate = (emp as { hire_date?: string | null } | null)?.hire_date?.slice(0, 10) ?? null;
  /* Absent only from the later of the tracking start and the hire date. No
     tracking start = HR has not started: nothing is absent. */
  const trackingFrom = policy.trackingFrom ? (hireDate && hireDate > policy.trackingFrom ? hireDate : policy.trackingFrom) : null;
  type Rec = {
    id: string; date: string; clock_in: string | null; clock_out: string | null; total_hours: number | null; break_minutes: number | null;
    status: string; source: string | null; remote: boolean | null; auto_closed: boolean | null; corrected: boolean | null;
    overtime_status: string | null; overtime_approved_minutes: number | null;
  };
  const byDate = new Map<string, Rec>();
  for (const r of (recs ?? []) as Rec[]) byDate.set(r.date, r);
  const leaveOn = new Map<string, { note: string; paid: boolean }>();
  for (const l of (leaves ?? []) as Array<{ start_date: string; end_date: string; half_day: boolean; hr_leave_types?: { name?: string; is_paid?: boolean } | { name?: string; is_paid?: boolean }[] | null }>) {
    const t = Array.isArray(l.hr_leave_types) ? l.hr_leave_types[0] : l.hr_leave_types;
    for (const d of days) if (d >= l.start_date && d <= l.end_date) leaveOn.set(d, { note: `${t?.name ?? "Leave"}${l.half_day ? " (½)" : ""}`, paid: t?.is_paid !== false });
  }

  const summary = { workdays: 0, present: 0, late: 0, absent: 0, leave: 0, hours: 0, overtimeH: 0, lateMin: 0, halfDays: 0, notTracked: 0, autoClosed: 0, overtimePendingH: 0, overtimeApprovedH: 0 };
  const out: SheetDay[] = days.map((date) => {
    const kind = dayKind(date, calendar);
    const rec = byDate.get(date) ?? null;
    const base: SheetDay = {
      date, status: "future", clockIn: rec?.clock_in ?? null, clockOut: rec?.clock_out ?? null, hours: rec?.total_hours ?? null,
      lateMin: 0, overtimeH: 0, overtimeState: null, overtimeApprovedH: 0, breakMinutes: Number(rec?.break_minutes ?? 0),
      autoClosed: !!rec?.auto_closed, corrected: !!rec?.corrected, remote: !!rec?.remote,
      source: rec?.source ?? null, note: null, leavePaid: null, recordId: rec?.id ?? null,
    };
    if (kind === "workday") summary.workdays++;
    if (leaveOn.has(date)) { const l = leaveOn.get(date)!; summary.leave++; return { ...base, status: "leave", note: l.note, leavePaid: l.paid }; }
    if (kind === "holiday") return { ...base, status: "holiday" };
    if (kind === "weekend") return { ...base, status: "weekend" };
    if (rec) {
      const lateMin = lateMinutes(rec.clock_in, policy);
      const hours = rec.total_hours === null ? null : Number(rec.total_hours);
      const otMin = overtimeMinutes(rec.clock_in, rec.clock_out, date, policy);
      const overtimeH = Math.round((otMin / 60) * 100) / 100;
      const overtimeState: OvertimeState | null = otMin > 0
        ? rec.overtime_status === "approved" ? "approved" : rec.overtime_status === "rejected" ? "rejected" : "pending"
        : null;
      const overtimeApprovedH = overtimeState === "approved"
        ? Math.round(((rec.overtime_approved_minutes ?? otMin) / 60) * 100) / 100
        : 0;
      const status: SheetStatus = rec.status === "half_day" ? "half_day" : rec.status === "absent" ? "absent" : lateMin > 0 ? "late" : "present";
      if (status === "absent") summary.absent++; else { summary.present++; if (status === "late") summary.late++; if (status === "half_day") summary.halfDays++; }
      summary.hours += hours ?? 0; summary.overtimeH += overtimeH; summary.lateMin += lateMin;
      if (overtimeState === "pending") summary.overtimePendingH += overtimeH;
      summary.overtimeApprovedH += overtimeApprovedH;
      if (rec.auto_closed) summary.autoClosed++;
      return { ...base, status, hours, lateMin, overtimeH, overtimeState, overtimeApprovedH };
    }
    if (date < opts.today) {
      if (!trackingFrom || date < trackingFrom) { summary.notTracked++; return { ...base, status: "not_tracked" }; }
      summary.absent++;
      return { ...base, status: "absent" };
    }
    return base;
  });
  summary.hours = Math.round(summary.hours * 100) / 100;
  summary.overtimeH = Math.round(summary.overtimeH * 100) / 100;
  summary.overtimePendingH = Math.round(summary.overtimePendingH * 100) / 100;
  summary.overtimeApprovedH = Math.round(summary.overtimeApprovedH * 100) / 100;
  return { employeeId: opts.employeeId, month: `${opts.year}-${String(opts.month).padStart(2, "0")}`, country, policy, calendar, days: out, summary, trackingFrom };
}

export const parseMonth = (v: string | null, fallbackToday: string): { year: number; month: number } => {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  const src = m ? `${m[1]}-${m[2]}` : fallbackToday.slice(0, 7);
  return { year: Number(src.slice(0, 4)), month: Number(src.slice(5, 7)) };
};

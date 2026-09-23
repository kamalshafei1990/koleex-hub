import "server-only";

/* ---------------------------------------------------------------------------
   attendance-records — the ONE place a day's times change after the punch
   (Phase 1, owner-approved 23 Sep 2026): an HR edit and an approved
   correction request both come through setDayTimes(), and every change is
   written to hr_attendance_corrections with the record before and after.

   A changed day is marked `corrected`, loses any automatic-close flag, and
   its overtime decision is cleared: new times mean new overtime, and it waits
   for a fresh approval.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { lateMinutes, workedHours, type AttendancePolicy } from "@/lib/server/work-calendar";

export const RECORD_COLS =
  "id, employee_id, date, clock_in, clock_out, break_minutes, total_hours, status, source, remote, auto_closed, corrected, reminded_at, overtime_status, overtime_approved_minutes";

export interface AttendanceRecord {
  id: string; employee_id: string; date: string; clock_in: string | null; clock_out: string | null;
  break_minutes: number | null; total_hours: number | null; status: string; source: string | null;
  remote: boolean | null; auto_closed: boolean | null; corrected: boolean | null; reminded_at: string | null;
  overtime_status: string | null; overtime_approved_minutes: number | null;
}

/** undefined = keep what the day has, null = clear, a value = set it. */
export interface DayTimes {
  clockIn?: string | null;
  clockOut?: string | null;
  breakMinutes?: number | null;
}

export type SetDayResult =
  | { ok: true; before: AttendanceRecord | null; after: AttendanceRecord }
  | { ok: false; error: "no_clock_in" | "out_before_in" | "break_too_long" | "save_failed" };

export async function setDayTimes(opts: { employeeId: string; date: string; times: DayTimes; policy: AttendancePolicy }): Promise<SetDayResult> {
  const { data: existing } = await supabaseServer.from("hr_attendance_records")
    .select(RECORD_COLS).eq("employee_id", opts.employeeId).eq("date", opts.date).maybeSingle();
  const before = (existing as AttendanceRecord | null) ?? null;

  const clockIn = opts.times.clockIn === undefined ? before?.clock_in ?? null : opts.times.clockIn;
  const clockOut = opts.times.clockOut === undefined ? before?.clock_out ?? null : opts.times.clockOut;
  const breakMinutes = Math.max(0, Math.round(opts.times.breakMinutes === undefined ? Number(before?.break_minutes ?? 0) : Number(opts.times.breakMinutes ?? 0)));
  if (!clockIn) return { ok: false, error: "no_clock_in" };
  if (clockOut && Date.parse(clockOut) <= Date.parse(clockIn)) return { ok: false, error: "out_before_in" };
  if (clockOut && breakMinutes >= (Date.parse(clockOut) - Date.parse(clockIn)) / 60000) return { ok: false, error: "break_too_long" };

  const status = before?.status === "half_day" ? "half_day" : lateMinutes(clockIn, opts.policy) > 0 ? "late" : "present";
  const { data, error } = await supabaseServer.from("hr_attendance_records").upsert({
    employee_id: opts.employeeId,
    date: opts.date,
    clock_in: clockIn,
    clock_out: clockOut,
    break_minutes: breakMinutes,
    total_hours: clockOut ? workedHours(clockIn, clockOut, breakMinutes) : null,
    status,
    source: before?.source ?? "manual",
    remote: before?.remote ?? false,
    corrected: true,
    auto_closed: false,
    overtime_status: null,
    overtime_approved_minutes: null,
    overtime_decided_by: null,
    overtime_decided_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id,date" }).select(RECORD_COLS).single();
  if (error || !data) {
    console.error("[attendance-records setDayTimes]", error?.message);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true, before, after: data as AttendanceRecord };
}

/** The audit row every change leaves behind. */
export async function auditDayChange(row: {
  tenantId: string | null; employeeId: string; date: string; kind: "edit" | "request"; status: "applied" | "approved";
  reason: string; actorAccountId: string; before: AttendanceRecord | null; after: AttendanceRecord;
}): Promise<void> {
  const { error } = await supabaseServer.from("hr_attendance_corrections").insert({
    tenant_id: row.tenantId, employee_id: row.employeeId, date: row.date, kind: row.kind, status: row.status,
    clock_in: row.after.clock_in, clock_out: row.after.clock_out, break_minutes: row.after.break_minutes,
    reason: row.reason, requested_by: row.actorAccountId, decided_by: row.actorAccountId, decided_at: new Date().toISOString(),
    before: row.before, after: row.after,
  });
  if (error) console.error("[attendance-records audit]", error.message);
}

/** Employees' display names by id — for queues and notifications. */
export async function employeeNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data } = await supabaseServer.from("koleex_employees").select("id, people(full_name)").in("id", unique);
  for (const r of (data ?? []) as Array<{ id: string; people?: { full_name?: string | null } | { full_name?: string | null }[] | null }>) {
    const p = Array.isArray(r.people) ? r.people[0] : r.people;
    out.set(r.id, p?.full_name?.trim() || "Employee");
  }
  return out;
}

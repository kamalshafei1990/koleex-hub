"use client";

/* ---------------------------------------------------------------------------
   HR Admin — Unified CRUD for the HR management system.

   Covers 18 tables across 8 modules:
     1. Leave Management       — leave types, balances, requests
     2. Attendance              — policies, daily records
     3. Recruitment             — job postings, applicants, interviews
     4. Appraisals              — cycles, reviews, goals
     5. Onboarding/Offboarding  — checklists, instances
     6. Payroll                 — salary records, payslips
     7. Training                — courses, training records
     8. Documents               — employee document vault
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  LeaveTypeRow,
  LeaveBalanceRow,
  LeaveRequestRow,
  AttendancePolicyRow,
  AttendanceRecordRow,
  JobPostingRow,
  ApplicantRow,
  InterviewRoundRow,
  AppraisalCycleRow,
  AppraisalRow,
  GoalRow,
  ChecklistRow,
  ChecklistInstanceRow,
  SalaryRecordRow,
  PayslipRow,
  CourseRow,
  TrainingRecordRow,
  HrDocumentRow,
  LeaveTypeInsert,
  LeaveBalanceInsert,
  LeaveRequestInsert,
  AttendanceRecordInsert,
  JobPostingInsert,
  ApplicantInsert,
  AppraisalCycleInsert,
  AppraisalInsert,
  GoalInsert,
  ChecklistInsert,
  ChecklistInstanceInsert,
  SalaryRecordInsert,
  PayslipInsert,
  CourseInsert,
  TrainingRecordInsert,
  HrDocumentInsert,
  EmployeeRow,
  PersonRow,
} from "@/types/supabase";

/* ── Table names ── */
const LEAVE_TYPES = "hr_leave_types";
const LEAVE_BALANCES = "hr_leave_balances";
const LEAVE_REQUESTS = "hr_leave_requests";
const ATTENDANCE_POLICIES = "hr_attendance_policies";
const ATTENDANCE_RECORDS = "hr_attendance_records";
const JOB_POSTINGS = "hr_job_postings";
const APPLICANTS = "hr_applicants";
const INTERVIEW_ROUNDS = "hr_interview_rounds";
const APPRAISAL_CYCLES = "hr_appraisal_cycles";
const APPRAISALS = "hr_appraisals";
const GOALS = "hr_goals";
const CHECKLISTS = "hr_checklists";
const CHECKLIST_INSTANCES = "hr_checklist_instances";
const SALARY_RECORDS = "hr_salary_records";
const PAYSLIPS = "hr_payslips";
const COURSES = "hr_courses";
const TRAINING_RECORDS = "hr_training_records";
const HR_DOCUMENTS = "hr_documents";
const EMPLOYEES = "koleex_employees";
const PEOPLE = "people";
const DEPARTMENTS = "koleex_departments";
const POSITIONS = "koleex_positions";

/* ── Helpers ── */

/** Build a map of employee_id -> person full_name by joining employees + people. */
async function buildEmployeeNameMap(
  employeeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (employeeIds.length === 0) return map;

  const unique = [...new Set(employeeIds)];

  const { data: employees } = await supabase
    .from(EMPLOYEES)
    .select("id, person_id")
    .in("id", unique);

  if (!employees || employees.length === 0) return map;

  const personIds = employees
    .map((e: any) => e.person_id)
    .filter(Boolean) as string[];

  const { data: people } = await supabase
    .from(PEOPLE)
    .select("id, full_name")
    .in("id", personIds);

  const personMap = new Map(
    (people || []).map((p: any) => [p.id, p.full_name as string]),
  );

  for (const e of employees) {
    if (e.person_id && personMap.has(e.person_id)) {
      map.set(e.id, personMap.get(e.person_id)!);
    }
  }
  return map;
}

/** Compute business days between two dates (Mon-Fri, simplistic). */
function computeBusinessDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* ═══════════════════════════════════════════════════
   DASHBOARD AGGREGATIONS
   ═══════════════════════════════════════════════════ */

export interface HrDashboardStats {
  headcount: number;
  active: number;
  on_leave: number;
  inactive: number;
  pending_leave_requests: number;
  expiring_documents: number;
  today_absences: number;
}

/** Fetch high-level HR dashboard stats. */
export async function fetchHrDashboardStats(): Promise<HrDashboardStats> {
  const stats: HrDashboardStats = {
    headcount: 0,
    active: 0,
    on_leave: 0,
    inactive: 0,
    pending_leave_requests: 0,
    expiring_documents: 0,
    today_absences: 0,
  };

  try {
    // Total headcount + status breakdown
    const { data: employees, error: empErr } = await supabase
      .from(EMPLOYEES)
      .select("id, employment_status");

    if (empErr) {
      console.error("[HR Dashboard] Employees:", empErr.message);
    } else if (employees) {
      stats.headcount = employees.length;
      for (const e of employees) {
        if (e.employment_status === "active") stats.active++;
        else if (e.employment_status === "on_leave") stats.on_leave++;
        else if (e.employment_status === "inactive") stats.inactive++;
      }
    }

    // Pending leave requests
    const { count: pendingCount, error: leaveErr } = await supabase
      .from(LEAVE_REQUESTS)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (leaveErr) {
      console.error("[HR Dashboard] Pending leaves:", leaveErr.message);
    } else {
      stats.pending_leave_requests = pendingCount || 0;
    }

    // Documents expiring within 30 days
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const today = new Date().toISOString().split("T")[0];
    const in30Str = in30.toISOString().split("T")[0];

    const { count: docCount, error: docErr } = await supabase
      .from(HR_DOCUMENTS)
      .select("id", { count: "exact", head: true })
      .gte("expiry_date", today)
      .lte("expiry_date", in30Str);

    if (docErr) {
      console.error("[HR Dashboard] Expiring docs:", docErr.message);
    } else {
      stats.expiring_documents = docCount || 0;
    }

    // Today's absences (approved leave requests covering today)
    const { count: absenceCount, error: absErr } = await supabase
      .from(LEAVE_REQUESTS)
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today);

    if (absErr) {
      console.error("[HR Dashboard] Absences:", absErr.message);
    } else {
      stats.today_absences = absenceCount || 0;
    }
  } catch (err: any) {
    console.error("[HR Dashboard] Unexpected:", err.message);
  }

  return stats;
}

export interface ExpiringItem {
  type: "visa" | "document";
  employee_id: string;
  employee_name: string;
  label: string;
  expiry_date: string;
}

/** Fetch visa and document expiries within N days (default 60). */
export async function fetchExpiringItems(
  withinDays = 60,
): Promise<ExpiringItem[]> {
  const items: ExpiringItem[] = [];
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + withinDays);
  const futureStr = future.toISOString().split("T")[0];

  try {
    // Visa expiries from koleex_employees
    const { data: visas, error: visaErr } = await supabase
      .from(EMPLOYEES)
      .select("id, person_id, visa_number, visa_expiry_date")
      .not("visa_expiry_date", "is", null)
      .gte("visa_expiry_date", today)
      .lte("visa_expiry_date", futureStr);

    if (visaErr) {
      console.error("[Expiring] Visas:", visaErr.message);
    }

    // Document expiries from hr_documents
    const { data: docs, error: docErr } = await supabase
      .from(HR_DOCUMENTS)
      .select("*")
      .not("expiry_date", "is", null)
      .gte("expiry_date", today)
      .lte("expiry_date", futureStr);

    if (docErr) {
      console.error("[Expiring] Documents:", docErr.message);
    }

    // Collect all employee IDs
    const empIds = [
      ...(visas || []).map((v: any) => v.id),
      ...(docs || []).map((d: HrDocumentRow) => d.employee_id),
    ];
    const nameMap = await buildEmployeeNameMap(empIds);

    // Build visa items
    for (const v of visas || []) {
      items.push({
        type: "visa",
        employee_id: v.id,
        employee_name: nameMap.get(v.id) || "Unknown",
        label: `Visa ${v.visa_number || ""}`.trim(),
        expiry_date: v.visa_expiry_date,
      });
    }

    // Build document items
    for (const d of (docs || []) as HrDocumentRow[]) {
      items.push({
        type: "document",
        employee_id: d.employee_id,
        employee_name: nameMap.get(d.employee_id) || "Unknown",
        label: d.name,
        expiry_date: d.expiry_date!,
      });
    }

    // Sort by expiry date ascending
    items.sort(
      (a, b) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
    );
  } catch (err: any) {
    console.error("[Expiring] Unexpected:", err.message);
  }

  return items;
}

/* ═══════════════════════════════════════════════════
   LEAVE MANAGEMENT
   ═══════════════════════════════════════════════════ */

/** Fetch all active leave types. */
export async function fetchLeaveTypes(): Promise<LeaveTypeRow[]> {
  const { data, error } = await supabase
    .from(LEAVE_TYPES)
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[LeaveTypes] Fetch:", error.message);
    return [];
  }
  return (data as LeaveTypeRow[]) || [];
}

/** Create a new leave type. */
export async function createLeaveType(
  input: LeaveTypeInsert,
): Promise<LeaveTypeRow | null> {
  const { data, error } = await supabase
    .from(LEAVE_TYPES)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[LeaveTypes] Create:", error.message);
    return null;
  }
  return data as LeaveTypeRow;
}

export interface LeaveRequestFilters {
  status?: string;
  employee_id?: string;
}

export interface LeaveRequestWithName extends LeaveRequestRow {
  employee_name: string;
  leave_type_name: string;
}

/** Fetch leave requests, optionally filtered. Joins employee name + leave type name. */
export async function fetchLeaveRequests(
  filters?: LeaveRequestFilters,
): Promise<LeaveRequestWithName[]> {
  let query = supabase
    .from(LEAVE_REQUESTS)
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[LeaveRequests] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const requests = data as LeaveRequestRow[];

  // Build employee name map
  const empIds = requests.map((r) => r.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  // Build leave type name map
  const typeIds = [...new Set(requests.map((r) => r.leave_type_id))];
  const { data: types } = await supabase
    .from(LEAVE_TYPES)
    .select("id, name")
    .in("id", typeIds);

  const typeMap = new Map(
    (types || []).map((t: any) => [t.id, t.name as string]),
  );

  return requests.map((r) => ({
    ...r,
    employee_name: nameMap.get(r.employee_id) || "Unknown",
    leave_type_name: typeMap.get(r.leave_type_id) || "Unknown",
  }));
}

/** Create a leave request. Auto-computes days from start/end dates. */
export async function createLeaveRequest(
  input: Omit<LeaveRequestInsert, "days" | "status" | "reviewed_by" | "reviewed_at" | "review_notes"> & {
    days?: number;
  },
): Promise<LeaveRequestRow | null> {
  const days =
    input.days ??
    (input.half_day ? 0.5 : computeBusinessDays(input.start_date, input.end_date));

  const { data, error } = await supabase
    .from(LEAVE_REQUESTS)
    .insert({
      ...input,
      days,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
    })
    .select()
    .single();

  if (error) {
    console.error("[LeaveRequests] Create:", error.message);
    return null;
  }
  return data as LeaveRequestRow;
}

/** Approve or reject a leave request and update balance accordingly. */
export async function reviewLeaveRequest(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  notes?: string,
): Promise<boolean> {
  // Get the request first
  const { data: request, error: fetchErr } = await supabase
    .from(LEAVE_REQUESTS)
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !request) {
    console.error("[LeaveRequests] Review fetch:", fetchErr?.message);
    return false;
  }

  const now = new Date().toISOString();

  // Update request status
  const { error: updateErr } = await supabase
    .from(LEAVE_REQUESTS)
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: now,
      review_notes: notes || null,
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[LeaveRequests] Review update:", updateErr.message);
    return false;
  }

  // If approved, deduct from leave balance
  if (status === "approved") {
    const year = new Date(request.start_date).getFullYear();

    const { data: balance, error: balErr } = await supabase
      .from(LEAVE_BALANCES)
      .select("*")
      .eq("employee_id", request.employee_id)
      .eq("leave_type_id", request.leave_type_id)
      .eq("year", year)
      .maybeSingle();

    if (balErr) {
      console.error("[LeaveBalances] Deduct fetch:", balErr.message);
    } else if (balance) {
      const { error: deductErr } = await supabase
        .from(LEAVE_BALANCES)
        .update({ used: (balance.used || 0) + request.days })
        .eq("id", balance.id);

      if (deductErr) {
        console.error("[LeaveBalances] Deduct:", deductErr.message);
      }
    }
  }

  return true;
}

/** Fetch leave balances for an employee in a given year. */
export async function fetchLeaveBalances(
  employeeId: string,
  year: number,
): Promise<(LeaveBalanceRow & { leave_type_name: string })[]> {
  const { data, error } = await supabase
    .from(LEAVE_BALANCES)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year);

  if (error) {
    console.error("[LeaveBalances] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const balances = data as LeaveBalanceRow[];

  // Join leave type names
  const typeIds = [...new Set(balances.map((b) => b.leave_type_id))];
  const { data: types } = await supabase
    .from(LEAVE_TYPES)
    .select("id, name")
    .in("id", typeIds);

  const typeMap = new Map(
    (types || []).map((t: any) => [t.id, t.name as string]),
  );

  return balances.map((b) => ({
    ...b,
    leave_type_name: typeMap.get(b.leave_type_id) || "Unknown",
  }));
}

/** Initialize default leave balances for an employee from all active leave types. */
export async function initLeaveBalances(
  employeeId: string,
  year: number,
): Promise<boolean> {
  const types = await fetchLeaveTypes();
  if (types.length === 0) return false;

  const inserts: LeaveBalanceInsert[] = types.map((t) => ({
    employee_id: employeeId,
    leave_type_id: t.id,
    year,
    entitled: t.default_days,
    used: 0,
    carried_over: 0,
    adjustment: 0,
  }));

  const { error } = await supabase.from(LEAVE_BALANCES).insert(inserts);

  if (error) {
    console.error("[LeaveBalances] Init:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   ATTENDANCE
   ═══════════════════════════════════════════════════ */

export interface AttendanceFilters {
  employee_id?: string;
  date_from?: string;
  date_to?: string;
}

/** Fetch attendance records, filtered by date range and/or employee. */
export async function fetchAttendanceRecords(
  filters: AttendanceFilters,
): Promise<AttendanceRecordRow[]> {
  let query = supabase
    .from(ATTENDANCE_RECORDS)
    .select("*")
    .order("date", { ascending: false });

  if (filters.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }
  if (filters.date_from) {
    query = query.gte("date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("date", filters.date_to);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Attendance] Fetch:", error.message);
    return [];
  }
  return (data as AttendanceRecordRow[]) || [];
}

/** Clock in: create an attendance record with clock_in timestamp. */
export async function clockIn(
  employeeId: string,
): Promise<AttendanceRecordRow | null> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const clockInTime = now.toISOString();

  const { data, error } = await supabase
    .from(ATTENDANCE_RECORDS)
    .insert({
      employee_id: employeeId,
      date: today,
      clock_in: clockInTime,
      clock_out: null,
      break_minutes: 0,
      total_hours: null,
      status: "present",
      source: "manual",
      notes: null,
    } satisfies AttendanceRecordInsert)
    .select()
    .single();

  if (error) {
    console.error("[Attendance] ClockIn:", error.message);
    return null;
  }
  return data as AttendanceRecordRow;
}

/** Clock out: update today's record with clock_out + computed total_hours. */
export async function clockOut(
  employeeId: string,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  // Find today's open record
  const { data: record, error: fetchErr } = await supabase
    .from(ATTENDANCE_RECORDS)
    .select("*")
    .eq("employee_id", employeeId)
    .eq("date", today)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !record) {
    console.error("[Attendance] ClockOut fetch:", fetchErr?.message || "No open record");
    return false;
  }

  // Compute hours
  const clockInTime = new Date(record.clock_in).getTime();
  const clockOutTime = now.getTime();
  const totalMinutes = (clockOutTime - clockInTime) / 60000;
  const totalHours = Math.round(((totalMinutes - (record.break_minutes || 0)) / 60) * 100) / 100;

  const { error: updateErr } = await supabase
    .from(ATTENDANCE_RECORDS)
    .update({
      clock_out: now.toISOString(),
      total_hours: Math.max(0, totalHours),
    })
    .eq("id", record.id);

  if (updateErr) {
    console.error("[Attendance] ClockOut update:", updateErr.message);
    return false;
  }
  return true;
}

export interface AttendanceSummary {
  total_days: number;
  present: number;
  absent: number;
  late: number;
  avg_hours: number;
}

/** Aggregate attendance stats for an employee in a given month/year. */
export async function fetchAttendanceSummary(
  employeeId: string,
  month: number,
  year: number,
): Promise<AttendanceSummary> {
  const summary: AttendanceSummary = {
    total_days: 0,
    present: 0,
    absent: 0,
    late: 0,
    avg_hours: 0,
  };

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from(ATTENDANCE_RECORDS)
    .select("*")
    .eq("employee_id", employeeId)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (error) {
    console.error("[Attendance] Summary:", error.message);
    return summary;
  }
  if (!data || data.length === 0) return summary;

  const records = data as AttendanceRecordRow[];
  summary.total_days = records.length;

  let totalHours = 0;
  let hoursCount = 0;

  for (const r of records) {
    if (r.status === "present") summary.present++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "late") summary.late++;

    if (r.total_hours != null) {
      totalHours += r.total_hours;
      hoursCount++;
    }
  }

  summary.avg_hours = hoursCount > 0
    ? Math.round((totalHours / hoursCount) * 100) / 100
    : 0;

  return summary;
}

/* ═══════════════════════════════════════════════════
   RECRUITMENT
   ═══════════════════════════════════════════════════ */

export interface JobPostingWithNames extends JobPostingRow {
  department_name: string | null;
  position_title: string | null;
}

/** Fetch job postings, optionally by status. Joins department + position names. */
export async function fetchJobPostings(
  status?: string,
): Promise<JobPostingWithNames[]> {
  let query = supabase
    .from(JOB_POSTINGS)
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[JobPostings] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const postings = data as JobPostingRow[];

  // Join department names
  const deptIds = [
    ...new Set(postings.map((p) => p.department_id).filter(Boolean)),
  ] as string[];
  const posIds = [
    ...new Set(postings.map((p) => p.position_id).filter(Boolean)),
  ] as string[];

  const { data: depts } = deptIds.length
    ? await supabase.from(DEPARTMENTS).select("id, name").in("id", deptIds)
    : { data: [] };

  const { data: positions } = posIds.length
    ? await supabase.from(POSITIONS).select("id, title").in("id", posIds)
    : { data: [] };

  const deptMap = new Map(
    (depts || []).map((d: any) => [d.id, d.name as string]),
  );
  const posMap = new Map(
    (positions || []).map((p: any) => [p.id, p.title as string]),
  );

  return postings.map((p) => ({
    ...p,
    department_name: p.department_id ? deptMap.get(p.department_id) || null : null,
    position_title: p.position_id ? posMap.get(p.position_id) || null : null,
  }));
}

/** Create a new job posting. */
export async function createJobPosting(
  input: JobPostingInsert,
): Promise<JobPostingRow | null> {
  const { data, error } = await supabase
    .from(JOB_POSTINGS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[JobPostings] Create:", error.message);
    return null;
  }
  return data as JobPostingRow;
}

/** Update an existing job posting. */
export async function updateJobPosting(
  id: string,
  updates: Partial<JobPostingInsert>,
): Promise<boolean> {
  const { error } = await supabase
    .from(JOB_POSTINGS)
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[JobPostings] Update:", error.message);
    return false;
  }
  return true;
}

export interface ApplicantWithJob extends ApplicantRow {
  job_title: string;
}

/** Fetch applicants, optionally by job posting. Joins job title. */
export async function fetchApplicants(
  jobPostingId?: string,
): Promise<ApplicantWithJob[]> {
  let query = supabase
    .from(APPLICANTS)
    .select("*")
    .order("created_at", { ascending: false });

  if (jobPostingId) {
    query = query.eq("job_posting_id", jobPostingId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Applicants] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const applicants = data as ApplicantRow[];

  // Join job titles
  const jobIds = [...new Set(applicants.map((a) => a.job_posting_id))];
  const { data: jobs } = await supabase
    .from(JOB_POSTINGS)
    .select("id, title")
    .in("id", jobIds);

  const jobMap = new Map(
    (jobs || []).map((j: any) => [j.id, j.title as string]),
  );

  return applicants.map((a) => ({
    ...a,
    job_title: jobMap.get(a.job_posting_id) || "Unknown",
  }));
}

/** Create a new applicant. */
export async function createApplicant(
  input: ApplicantInsert,
): Promise<ApplicantRow | null> {
  const { data, error } = await supabase
    .from(APPLICANTS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Applicants] Create:", error.message);
    return null;
  }
  return data as ApplicantRow;
}

/** Move an applicant to a new pipeline stage. */
export async function updateApplicantStage(
  id: string,
  stage: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(APPLICANTS)
    .update({ stage })
    .eq("id", id);

  if (error) {
    console.error("[Applicants] UpdateStage:", error.message);
    return false;
  }
  return true;
}

/** Fetch interview rounds for a specific applicant. */
export async function fetchInterviewRounds(
  applicantId: string,
): Promise<InterviewRoundRow[]> {
  const { data, error } = await supabase
    .from(INTERVIEW_ROUNDS)
    .select("*")
    .eq("applicant_id", applicantId)
    .order("round_number");

  if (error) {
    console.error("[Interviews] Fetch:", error.message);
    return [];
  }
  return (data as InterviewRoundRow[]) || [];
}

/* ═══════════════════════════════════════════════════
   APPRAISALS
   ═══════════════════════════════════════════════════ */

/** Fetch all appraisal cycles. */
export async function fetchAppraisalCycles(): Promise<AppraisalCycleRow[]> {
  const { data, error } = await supabase
    .from(APPRAISAL_CYCLES)
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("[AppraisalCycles] Fetch:", error.message);
    return [];
  }
  return (data as AppraisalCycleRow[]) || [];
}

/** Create a new appraisal cycle. */
export async function createAppraisalCycle(
  input: AppraisalCycleInsert,
): Promise<AppraisalCycleRow | null> {
  const { data, error } = await supabase
    .from(APPRAISAL_CYCLES)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[AppraisalCycles] Create:", error.message);
    return null;
  }
  return data as AppraisalCycleRow;
}

export interface AppraisalWithName extends AppraisalRow {
  employee_name: string;
}

/** Fetch appraisals, optionally by cycle. Joins employee name. */
export async function fetchAppraisals(
  cycleId?: string,
): Promise<AppraisalWithName[]> {
  let query = supabase
    .from(APPRAISALS)
    .select("*")
    .order("created_at", { ascending: false });

  if (cycleId) {
    query = query.eq("cycle_id", cycleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Appraisals] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const appraisals = data as AppraisalRow[];
  const empIds = appraisals.map((a) => a.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  return appraisals.map((a) => ({
    ...a,
    employee_name: nameMap.get(a.employee_id) || "Unknown",
  }));
}

/** Create a new appraisal. */
export async function createAppraisal(
  input: AppraisalInsert,
): Promise<AppraisalRow | null> {
  const { data, error } = await supabase
    .from(APPRAISALS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Appraisals] Create:", error.message);
    return null;
  }
  return data as AppraisalRow;
}

/** Update an appraisal's scores/comments. */
export async function updateAppraisal(
  id: string,
  updates: Partial<AppraisalInsert>,
): Promise<boolean> {
  const { error } = await supabase
    .from(APPRAISALS)
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[Appraisals] Update:", error.message);
    return false;
  }
  return true;
}

/** Fetch goals, optionally for a specific employee. */
export async function fetchGoals(
  employeeId?: string,
): Promise<GoalRow[]> {
  let query = supabase
    .from(GOALS)
    .select("*")
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Goals] Fetch:", error.message);
    return [];
  }
  return (data as GoalRow[]) || [];
}

/** Create a new goal. */
export async function createGoal(
  input: GoalInsert,
): Promise<GoalRow | null> {
  const { data, error } = await supabase
    .from(GOALS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Goals] Create:", error.message);
    return null;
  }
  return data as GoalRow;
}

/** Update goal progress/status. */
export async function updateGoal(
  id: string,
  updates: Partial<GoalInsert>,
): Promise<boolean> {
  const { error } = await supabase
    .from(GOALS)
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[Goals] Update:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   ONBOARDING / OFFBOARDING
   ═══════════════════════════════════════════════════ */

/** Fetch checklist templates, optionally by type. */
export async function fetchChecklists(
  type?: "onboarding" | "offboarding",
): Promise<ChecklistRow[]> {
  let query = supabase
    .from(CHECKLISTS)
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Checklists] Fetch:", error.message);
    return [];
  }
  return (data as ChecklistRow[]) || [];
}

/** Create a new checklist template. */
export async function createChecklist(
  input: ChecklistInsert,
): Promise<ChecklistRow | null> {
  const { data, error } = await supabase
    .from(CHECKLISTS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Checklists] Create:", error.message);
    return null;
  }
  return data as ChecklistRow;
}

export interface ChecklistInstanceWithName extends ChecklistInstanceRow {
  employee_name: string;
  checklist_name: string;
}

/** Fetch assigned checklist instances, optionally by employee. */
export async function fetchChecklistInstances(
  employeeId?: string,
): Promise<ChecklistInstanceWithName[]> {
  let query = supabase
    .from(CHECKLIST_INSTANCES)
    .select("*")
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[ChecklistInstances] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const instances = data as ChecklistInstanceRow[];

  // Join employee names
  const empIds = instances.map((i) => i.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  // Join checklist names
  const clIds = [...new Set(instances.map((i) => i.checklist_id))];
  const { data: checklists } = await supabase
    .from(CHECKLISTS)
    .select("id, name")
    .in("id", clIds);

  const clMap = new Map(
    (checklists || []).map((c: any) => [c.id, c.name as string]),
  );

  return instances.map((i) => ({
    ...i,
    employee_name: nameMap.get(i.employee_id) || "Unknown",
    checklist_name: clMap.get(i.checklist_id) || "Unknown",
  }));
}

/** Assign a checklist to an employee, creating an instance with initial items_status. */
export async function assignChecklist(
  checklistId: string,
  employeeId: string,
  startDate: string,
): Promise<ChecklistInstanceRow | null> {
  // Fetch the template to get the items list
  const { data: template, error: tplErr } = await supabase
    .from(CHECKLISTS)
    .select("*")
    .eq("id", checklistId)
    .single();

  if (tplErr || !template) {
    console.error("[ChecklistInstances] Template fetch:", tplErr?.message);
    return null;
  }

  const items = (template as ChecklistRow).items || [];
  const itemsStatus = items.map((_: any, idx: number) => ({
    item_index: idx,
    completed: false,
  }));

  const { data, error } = await supabase
    .from(CHECKLIST_INSTANCES)
    .insert({
      checklist_id: checklistId,
      employee_id: employeeId,
      start_date: startDate,
      status: "in_progress",
      items_status: itemsStatus,
      completed_at: null,
    } satisfies ChecklistInstanceInsert)
    .select()
    .single();

  if (error) {
    console.error("[ChecklistInstances] Assign:", error.message);
    return null;
  }
  return data as ChecklistInstanceRow;
}

/** Toggle a single checklist item's completed state. */
export async function toggleChecklistItem(
  instanceId: string,
  itemIndex: number,
  completed: boolean,
  completedBy?: string,
): Promise<boolean> {
  const { data: instance, error: fetchErr } = await supabase
    .from(CHECKLIST_INSTANCES)
    .select("*")
    .eq("id", instanceId)
    .single();

  if (fetchErr || !instance) {
    console.error("[ChecklistInstances] Toggle fetch:", fetchErr?.message);
    return false;
  }

  const itemsStatus = [...(instance.items_status || [])] as {
    item_index: number;
    completed: boolean;
    completed_by?: string;
    completed_at?: string;
    notes?: string;
  }[];

  const target = itemsStatus.find((i) => i.item_index === itemIndex);
  if (!target) {
    console.error("[ChecklistInstances] Item index not found:", itemIndex);
    return false;
  }

  target.completed = completed;
  if (completed) {
    target.completed_by = completedBy || undefined;
    target.completed_at = new Date().toISOString();
  } else {
    delete target.completed_by;
    delete target.completed_at;
  }

  // Check if all items are completed
  const allDone = itemsStatus.every((i) => i.completed);

  const { error: updateErr } = await supabase
    .from(CHECKLIST_INSTANCES)
    .update({
      items_status: itemsStatus,
      status: allDone ? "completed" : "in_progress",
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq("id", instanceId);

  if (updateErr) {
    console.error("[ChecklistInstances] Toggle update:", updateErr.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   PAYROLL
   ═══════════════════════════════════════════════════ */

export interface SalaryRecordWithName extends SalaryRecordRow {
  employee_name: string;
}

/** Fetch salary records, optionally per employee. Joins employee name. */
export async function fetchSalaryRecords(
  employeeId?: string,
): Promise<SalaryRecordWithName[]> {
  let query = supabase
    .from(SALARY_RECORDS)
    .select("*")
    .order("effective_from", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[SalaryRecords] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const records = data as SalaryRecordRow[];
  const empIds = records.map((r) => r.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  return records.map((r) => ({
    ...r,
    employee_name: nameMap.get(r.employee_id) || "Unknown",
  }));
}

/** Create a salary record and close the previous one's effective_to. */
export async function createSalaryRecord(
  input: SalaryRecordInsert,
): Promise<SalaryRecordRow | null> {
  // Close the current active record for this employee (no effective_to)
  const { data: current } = await supabase
    .from(SALARY_RECORDS)
    .select("id")
    .eq("employee_id", input.employee_id)
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current) {
    // Set previous record's effective_to to the day before new record starts
    const prevEnd = new Date(input.effective_from);
    prevEnd.setDate(prevEnd.getDate() - 1);

    await supabase
      .from(SALARY_RECORDS)
      .update({ effective_to: prevEnd.toISOString().split("T")[0] })
      .eq("id", current.id);
  }

  const { data, error } = await supabase
    .from(SALARY_RECORDS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[SalaryRecords] Create:", error.message);
    return null;
  }
  return data as SalaryRecordRow;
}

export interface PayslipFilters {
  employee_id?: string;
  period_start?: string;
  period_end?: string;
}

export interface PayslipWithName extends PayslipRow {
  employee_name: string;
}

/** Fetch payslips, optionally by employee/period. Joins employee name. */
export async function fetchPayslips(
  filters?: PayslipFilters,
): Promise<PayslipWithName[]> {
  let query = supabase
    .from(PAYSLIPS)
    .select("*")
    .order("period_start", { ascending: false });

  if (filters?.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }
  if (filters?.period_start) {
    query = query.gte("period_start", filters.period_start);
  }
  if (filters?.period_end) {
    query = query.lte("period_end", filters.period_end);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Payslips] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const payslips = data as PayslipRow[];
  const empIds = payslips.map((p) => p.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  return payslips.map((p) => ({
    ...p,
    employee_name: nameMap.get(p.employee_id) || "Unknown",
  }));
}

/** Create a new payslip. */
export async function createPayslip(
  input: PayslipInsert,
): Promise<PayslipRow | null> {
  const { data, error } = await supabase
    .from(PAYSLIPS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Payslips] Create:", error.message);
    return null;
  }
  return data as PayslipRow;
}

/* ═══════════════════════════════════════════════════
   TRAINING
   ═══════════════════════════════════════════════════ */

/** Fetch all active courses. */
export async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase
    .from(COURSES)
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("[Courses] Fetch:", error.message);
    return [];
  }
  return (data as CourseRow[]) || [];
}

/** Create a new course. */
export async function createCourse(
  input: CourseInsert,
): Promise<CourseRow | null> {
  const { data, error } = await supabase
    .from(COURSES)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[Courses] Create:", error.message);
    return null;
  }
  return data as CourseRow;
}

export interface TrainingRecordWithCourse extends TrainingRecordRow {
  course_name: string;
  employee_name: string;
}

/** Fetch training records, optionally per employee. Joins course name + employee name. */
export async function fetchTrainingRecords(
  employeeId?: string,
): Promise<TrainingRecordWithCourse[]> {
  let query = supabase
    .from(TRAINING_RECORDS)
    .select("*")
    .order("enrolled_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[TrainingRecords] Fetch:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const records = data as TrainingRecordRow[];

  // Join employee names
  const empIds = records.map((r) => r.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  // Join course names
  const courseIds = [...new Set(records.map((r) => r.course_id))];
  const { data: courses } = await supabase
    .from(COURSES)
    .select("id, name")
    .in("id", courseIds);

  const courseMap = new Map(
    (courses || []).map((c: any) => [c.id, c.name as string]),
  );

  return records.map((r) => ({
    ...r,
    course_name: courseMap.get(r.course_id) || "Unknown",
    employee_name: nameMap.get(r.employee_id) || "Unknown",
  }));
}

/** Enroll an employee in a course. */
export async function enrollInCourse(
  employeeId: string,
  courseId: string,
): Promise<TrainingRecordRow | null> {
  const { data, error } = await supabase
    .from(TRAINING_RECORDS)
    .insert({
      employee_id: employeeId,
      course_id: courseId,
      status: "enrolled",
      enrolled_at: new Date().toISOString(),
      completed_at: null,
      expiry_date: null,
      certificate_url: null,
      score: null,
      notes: null,
    } satisfies TrainingRecordInsert)
    .select()
    .single();

  if (error) {
    console.error("[TrainingRecords] Enroll:", error.message);
    return null;
  }
  return data as TrainingRecordRow;
}

/** Mark a training record as completed. */
export async function completeTraining(
  recordId: string,
  score?: number,
): Promise<boolean> {
  const { error } = await supabase
    .from(TRAINING_RECORDS)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      score: score ?? null,
    })
    .eq("id", recordId);

  if (error) {
    console.error("[TrainingRecords] Complete:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   DOCUMENTS
   ═══════════════════════════════════════════════════ */

/** Fetch HR documents, optionally for a specific employee. */
export async function fetchHrDocuments(
  employeeId?: string,
): Promise<HrDocumentRow[]> {
  let query = supabase
    .from(HR_DOCUMENTS)
    .select("*")
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[HrDocuments] Fetch:", error.message);
    return [];
  }
  return (data as HrDocumentRow[]) || [];
}

/** Upload / create a new HR document record. */
export async function createHrDocument(
  input: HrDocumentInsert,
): Promise<HrDocumentRow | null> {
  const { data, error } = await supabase
    .from(HR_DOCUMENTS)
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[HrDocuments] Create:", error.message);
    return null;
  }
  return data as HrDocumentRow;
}

/** Delete an HR document. */
export async function deleteHrDocument(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(HR_DOCUMENTS)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[HrDocuments] Delete:", error.message);
    return false;
  }
  return true;
}

/** Fetch documents expiring within N days. */
export async function fetchExpiringDocuments(
  withinDays: number,
): Promise<(HrDocumentRow & { employee_name: string })[]> {
  const today = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + withinDays);
  const futureStr = future.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from(HR_DOCUMENTS)
    .select("*")
    .not("expiry_date", "is", null)
    .gte("expiry_date", today)
    .lte("expiry_date", futureStr)
    .order("expiry_date");

  if (error) {
    console.error("[HrDocuments] Expiring:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const docs = data as HrDocumentRow[];
  const empIds = docs.map((d) => d.employee_id);
  const nameMap = await buildEmployeeNameMap(empIds);

  return docs.map((d) => ({
    ...d,
    employee_name: nameMap.get(d.employee_id) || "Unknown",
  }));
}

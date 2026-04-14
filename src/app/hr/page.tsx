"use client";

/* ---------------------------------------------------------------------------
   HR — Full HR management application for Koleex Hub.

   Features:
     - Dashboard with stats & expiring items
     - Leave management (requests, approve/reject)
     - Attendance tracking (clock in/out, daily records)
     - Recruitment (job postings, applicants, pipeline)
     - Appraisals (cycles, reviews, goals)
     - Onboarding / Offboarding checklists
     - Payroll (salary records, payslips)
     - Training (courses, enrollment, completion)
     - Document vault (upload, expiry tracking)
     - Reports & analytics
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

/* ── Icons ── */
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import SignOutIcon from "@/components/icons/ui/SignOutIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import HrIcon from "@/components/icons/HrIcon";

/* ── Data layer ── */
import {
  fetchHrDashboardStats, fetchExpiringItems,
  fetchLeaveTypes, fetchLeaveRequests, createLeaveRequest, reviewLeaveRequest,
  fetchAttendanceRecords, clockIn, clockOut,
  fetchJobPostings, createJobPosting, fetchApplicants, createApplicant, updateApplicantStage,
  fetchAppraisalCycles, createAppraisalCycle, fetchAppraisals, updateAppraisal, fetchGoals, createGoal, updateGoal,
  fetchChecklists, fetchChecklistInstances, assignChecklist, toggleChecklistItem,
  fetchSalaryRecords, createSalaryRecord, fetchPayslips, createPayslip,
  fetchCourses, createCourse, fetchTrainingRecords, enrollInCourse, completeTraining,
  fetchHrDocuments, createHrDocument, deleteHrDocument,
  type HrDashboardStats, type ExpiringItem,
  type LeaveRequestWithName,
  type JobPostingWithNames, type ApplicantWithJob,
  type AppraisalWithName,
  type ChecklistInstanceWithName,
  type SalaryRecordWithName, type PayslipWithName,
  type TrainingRecordWithCourse,
} from "@/lib/hr-admin";
import { fetchEmployeeList, type EmployeeListItem } from "@/lib/employees-admin";
import type {
  LeaveTypeRow, AttendanceRecordRow, AppraisalCycleRow, GoalRow,
  ChecklistRow, CourseRow, HrDocumentRow, JobPostingRow,
} from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   SHARED UI CLASSES
   ═══════════════════════════════════════════════════ */

const inputCls = "w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors";
const textareaCls = "w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors resize-none";
const selectCls = inputCls;
const primaryBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-30 transition-all";
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-surface)] transition-colors";
const dangerBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all";

/* ═══════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════ */

function ModalShell({ open, onClose, title, width, children, footer }: {
  open: boolean; onClose: () => void; title: string; width?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onTouchMove={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width || "max-w-[520px]"} bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[85vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
            <CrossIcon size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-color)] shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">{children}</label>;
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3">
        <Icon size={20} className="text-[var(--text-dim)]" />
      </div>
      <div className="text-[14px] font-medium text-[var(--text-muted)] mb-1">{title}</div>
      {subtitle && <div className="text-[12px] text-[var(--text-dim)]">{subtitle}</div>}
    </div>
  );
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  const cls = map[status] || "bg-slate-500/15 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

type TabId = "dashboard" | "leave" | "attendance" | "recruitment" | "appraisals" | "onboarding" | "offboarding" | "payroll" | "training" | "documents" | "reports";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3Icon },
  { id: "leave", label: "Leave", icon: CalendarPlusIcon },
  { id: "attendance", label: "Attendance", icon: ClockIcon },
  { id: "recruitment", label: "Recruitment", icon: UserPlusIcon },
  { id: "appraisals", label: "Appraisals", icon: StarIcon },
  { id: "onboarding", label: "Onboarding", icon: CheckCircleIcon },
  { id: "offboarding", label: "Offboarding", icon: SignOutIcon },
  { id: "payroll", label: "Payroll", icon: WalletIcon },
  { id: "training", label: "Training", icon: BookOpenIcon },
  { id: "documents", label: "Documents", icon: DocumentIcon },
  { id: "reports", label: "Reports", icon: BarChart3Icon },
];

const LEAVE_STATUS_MAP: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const JOB_STATUS_MAP: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  open: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  closed: "bg-red-500/15 text-red-400 border-red-500/20",
  filled: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

const STAGE_MAP: Record<string, string> = {
  new: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  screening: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  interview: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  offer: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  hired: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
};

const ATTENDANCE_STATUS_MAP: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  late: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  absent: "bg-red-500/15 text-red-400 border-red-500/20",
  half_day: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

const PAYSLIP_STATUS_MAP: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  approved: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const TRAINING_STATUS_MAP: Record<string, string> = {
  enrolled: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  expired: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const DOC_CATEGORY_MAP: Record<string, string> = {
  identity: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  contract: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  certification: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  medical: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  other: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function daysUntil(d: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function sumObj(obj: Record<string, number> | null | undefined): number {
  if (!obj) return 0;
  return Object.values(obj).reduce((s, v) => s + (v || 0), 0);
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function HRPage() {
  /* ── Core navigation state ── */
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Shared data ── */
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);

  /* ── Dashboard state ── */
  const [dashStats, setDashStats] = useState<HrDashboardStats | null>(null);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequestWithName[]>([]);

  /* ── Leave state ── */
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithName[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", half_day: false });
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestWithName | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  /* ── Attendance state ── */
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>([]);
  const [attendanceNames, setAttendanceNames] = useState<Map<string, string>>(new Map());

  /* ── Recruitment state ── */
  const [jobPostings, setJobPostings] = useState<JobPostingWithNames[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<JobPostingWithNames | null>(null);
  const [applicants, setApplicants] = useState<ApplicantWithJob[]>([]);
  const [showPostingModal, setShowPostingModal] = useState(false);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [postingForm, setPostingForm] = useState({ title: "", department_id: "", description: "", requirements: "", location: "", employment_type: "full_time", salary_min: "", salary_max: "", salary_currency: "USD" });
  const [applicantForm, setApplicantForm] = useState({ full_name: "", email: "", phone: "", source: "" });

  /* ── Appraisals state ── */
  const [cycles, setCycles] = useState<AppraisalCycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [appraisals, setAppraisals] = useState<AppraisalWithName[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", start_date: "", end_date: "" });
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalWithName | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ employee_id: "", title: "", description: "", weight: "1", due_date: "" });

  /* ── Onboarding / Offboarding state ── */
  const [onboardChecklists, setOnboardChecklists] = useState<ChecklistRow[]>([]);
  const [offboardChecklists, setOffboardChecklists] = useState<ChecklistRow[]>([]);
  const [onboardInstances, setOnboardInstances] = useState<ChecklistInstanceWithName[]>([]);
  const [offboardInstances, setOffboardInstances] = useState<ChecklistInstanceWithName[]>([]);
  const [showAssignModal, setShowAssignModal] = useState<"onboarding" | "offboarding" | null>(null);
  const [assignForm, setAssignForm] = useState({ employee_id: "", checklist_id: "", start_date: new Date().toISOString().split("T")[0] });
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);

  /* ── Payroll state ── */
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecordWithName[]>([]);
  const [payslips, setPayslips] = useState<PayslipWithName[]>([]);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ employee_id: "", base_salary: "", currency: "USD", pay_frequency: "monthly", effective_from: "", allowances: "{}", deductions: "{}", notes: "" });
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState({ employee_id: "", period_start: "", period_end: "", gross_amount: "", net_amount: "", status: "draft" });

  /* ── Training state ── */
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecordWithCourse[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "", description: "", provider: "", duration_hours: "", is_mandatory: false });
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ employee_id: "", course_id: "" });

  /* ── Documents state ── */
  const [hrDocuments, setHrDocuments] = useState<HrDocumentRow[]>([]);
  const [docFilter, setDocFilter] = useState("all");
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ employee_id: "", name: "", category: "other", file_url: "", expiry_date: "" });

  /* ═══════════════════════════════════════════════════
     DATA LOADING
     ═══════════════════════════════════════════════════ */

  const loadEmployees = useCallback(async () => {
    const data = await fetchEmployeeList();
    setEmployees(data);
    return data;
  }, []);

  /* ── Load on mount ── */
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  /* ── Load when tab activates ── */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case "dashboard": {
            const [stats, expiring, recent] = await Promise.all([
              fetchHrDashboardStats(),
              fetchExpiringItems(60),
              fetchLeaveRequests(),
            ]);
            if (!cancelled) {
              setDashStats(stats);
              setExpiringItems(expiring);
              setRecentLeaves(recent.slice(0, 5));
            }
            break;
          }
          case "leave": {
            const [requests, types] = await Promise.all([
              fetchLeaveRequests(),
              fetchLeaveTypes(),
            ]);
            if (!cancelled) { setLeaveRequests(requests); setLeaveTypes(types); }
            break;
          }
          case "attendance": {
            const records = await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate });
            if (!cancelled) {
              setAttendanceRecords(records);
              // Build name map from employees
              const nameMap = new Map<string, string>();
              const emps = employees.length > 0 ? employees : await loadEmployees();
              for (const e of emps) { nameMap.set(e.id, e.person.full_name); }
              setAttendanceNames(nameMap);
            }
            break;
          }
          case "recruitment": {
            const postings = await fetchJobPostings();
            if (!cancelled) { setJobPostings(postings); setSelectedPosting(null); setApplicants([]); }
            break;
          }
          case "appraisals": {
            const cs = await fetchAppraisalCycles();
            if (!cancelled) {
              setCycles(cs);
              if (cs.length > 0 && !selectedCycleId) {
                setSelectedCycleId(cs[0].id);
                const ap = await fetchAppraisals(cs[0].id);
                if (!cancelled) setAppraisals(ap);
              }
            }
            break;
          }
          case "onboarding": {
            const [checklists, instances] = await Promise.all([
              fetchChecklists("onboarding"),
              fetchChecklistInstances(),
            ]);
            if (!cancelled) {
              setOnboardChecklists(checklists);
              setOnboardInstances(instances.filter((i) => {
                const cl = checklists.find((c) => c.id === i.checklist_id);
                return cl?.type === "onboarding";
              }));
            }
            break;
          }
          case "offboarding": {
            const [checklists, instances] = await Promise.all([
              fetchChecklists("offboarding"),
              fetchChecklistInstances(),
            ]);
            if (!cancelled) {
              setOffboardChecklists(checklists);
              setOffboardInstances(instances.filter((i) => {
                const cl = checklists.find((c) => c.id === i.checklist_id);
                return cl?.type === "offboarding";
              }));
            }
            break;
          }
          case "payroll": {
            const [sal, pay] = await Promise.all([
              fetchSalaryRecords(),
              fetchPayslips(),
            ]);
            if (!cancelled) { setSalaryRecords(sal); setPayslips(pay); }
            break;
          }
          case "training": {
            const [cs, recs] = await Promise.all([
              fetchCourses(),
              fetchTrainingRecords(),
            ]);
            if (!cancelled) { setCourses(cs); setTrainingRecords(recs); }
            break;
          }
          case "documents": {
            const docs = await fetchHrDocuments();
            if (!cancelled) setHrDocuments(docs);
            break;
          }
          case "reports": {
            // Reports use data from other tabs; load what we need
            const [stats, leaves, recs] = await Promise.all([
              fetchHrDashboardStats(),
              fetchLeaveRequests(),
              fetchTrainingRecords(),
            ]);
            if (!cancelled) {
              setDashStats(stats);
              setLeaveRequests(leaves);
              setTrainingRecords(recs);
            }
            break;
          }
        }
      } catch (err) {
        console.error("[HR] Tab load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, attendanceDate]);

  /* ── Attendance date change reload ── */
  const reloadAttendance = useCallback(async (date: string) => {
    setLoading(true);
    const records = await fetchAttendanceRecords({ date_from: date, date_to: date });
    setAttendanceRecords(records);
    setLoading(false);
  }, []);

  /* ── Filtered leave requests ── */
  const filteredLeaves = useMemo(() => {
    if (leaveFilter === "all") return leaveRequests;
    return leaveRequests.filter((r) => r.status === leaveFilter);
  }, [leaveRequests, leaveFilter]);

  /* ── Filtered documents ── */
  const filteredDocs = useMemo(() => {
    if (docFilter === "all") return hrDocuments;
    return hrDocuments.filter((d) => d.category === docFilter);
  }, [hrDocuments, docFilter]);

  /* ── Attendance summary ── */
  const attendanceSummary = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const r of attendanceRecords) {
      if (r.status === "present") present++;
      else if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
    }
    return { present, late, absent };
  }, [attendanceRecords]);

  /* ═══════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════ */

  /* ── Leave ── */
  const handleCreateLeave = async () => {
    if (!leaveForm.employee_id || !leaveForm.leave_type_id || !leaveForm.start_date || !leaveForm.end_date) return;
    setSaving(true);
    await createLeaveRequest({
      employee_id: leaveForm.employee_id,
      leave_type_id: leaveForm.leave_type_id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason || null,
      half_day: leaveForm.half_day,
      attachment_url: null,
    });
    const updated = await fetchLeaveRequests();
    setLeaveRequests(updated);
    setShowLeaveModal(false);
    setLeaveForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", half_day: false });
    setSaving(false);
  };

  const handleReviewLeave = async (id: string, status: "approved" | "rejected") => {
    setSaving(true);
    await reviewLeaveRequest(id, status, "admin", reviewNotes || undefined);
    const updated = await fetchLeaveRequests();
    setLeaveRequests(updated);
    setSelectedLeave(null);
    setReviewNotes("");
    setSaving(false);
  };

  /* ── Attendance ── */
  const handleClockIn = async (empId: string) => {
    setSaving(true);
    await clockIn(empId);
    await reloadAttendance(attendanceDate);
    setSaving(false);
  };

  const handleClockOut = async (empId: string) => {
    setSaving(true);
    await clockOut(empId);
    await reloadAttendance(attendanceDate);
    setSaving(false);
  };

  /* ── Recruitment ── */
  const handleCreatePosting = async () => {
    if (!postingForm.title) return;
    setSaving(true);
    await createJobPosting({
      title: postingForm.title,
      department_id: postingForm.department_id || null,
      position_id: null,
      description: postingForm.description || null,
      requirements: postingForm.requirements || null,
      location: postingForm.location || null,
      employment_type: postingForm.employment_type,
      salary_min: postingForm.salary_min ? Number(postingForm.salary_min) : null,
      salary_max: postingForm.salary_max ? Number(postingForm.salary_max) : null,
      salary_currency: postingForm.salary_currency,
      status: "draft",
      published_at: null,
      closes_at: null,
      created_by: null,
    });
    const updated = await fetchJobPostings();
    setJobPostings(updated);
    setShowPostingModal(false);
    setPostingForm({ title: "", department_id: "", description: "", requirements: "", location: "", employment_type: "full_time", salary_min: "", salary_max: "", salary_currency: "USD" });
    setSaving(false);
  };

  const handleSelectPosting = async (p: JobPostingWithNames) => {
    setSelectedPosting(p);
    setLoading(true);
    const apps = await fetchApplicants(p.id);
    setApplicants(apps);
    setLoading(false);
  };

  const handleCreateApplicant = async () => {
    if (!applicantForm.full_name || !selectedPosting) return;
    setSaving(true);
    await createApplicant({
      job_posting_id: selectedPosting.id,
      full_name: applicantForm.full_name,
      email: applicantForm.email || null,
      phone: applicantForm.phone || null,
      resume_url: null,
      cover_letter: null,
      source: applicantForm.source || null,
      stage: "new",
      rating: null,
      notes: null,
      assigned_to: null,
    });
    const apps = await fetchApplicants(selectedPosting.id);
    setApplicants(apps);
    setShowApplicantModal(false);
    setApplicantForm({ full_name: "", email: "", phone: "", source: "" });
    setSaving(false);
  };

  const handleUpdateStage = async (applicantId: string, stage: string) => {
    setSaving(true);
    await updateApplicantStage(applicantId, stage);
    if (selectedPosting) {
      const apps = await fetchApplicants(selectedPosting.id);
      setApplicants(apps);
    }
    setSaving(false);
  };

  /* ── Appraisals ── */
  const handleCreateCycle = async () => {
    if (!cycleForm.name || !cycleForm.start_date || !cycleForm.end_date) return;
    setSaving(true);
    await createAppraisalCycle({
      name: cycleForm.name,
      start_date: cycleForm.start_date,
      end_date: cycleForm.end_date,
      status: "active",
    });
    const cs = await fetchAppraisalCycles();
    setCycles(cs);
    setShowCycleModal(false);
    setCycleForm({ name: "", start_date: "", end_date: "" });
    setSaving(false);
  };

  const handleSelectCycle = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setLoading(true);
    const ap = await fetchAppraisals(cycleId);
    setAppraisals(ap);
    setLoading(false);
  };

  const handleCreateGoal = async () => {
    if (!goalForm.employee_id || !goalForm.title) return;
    setSaving(true);
    await createGoal({
      employee_id: goalForm.employee_id,
      appraisal_id: selectedAppraisal?.id || null,
      title: goalForm.title,
      description: goalForm.description || null,
      target_value: null,
      actual_value: null,
      weight: Number(goalForm.weight) || 1,
      progress: 0,
      status: "not_started",
      due_date: goalForm.due_date || null,
    });
    if (selectedAppraisal) {
      const g = await fetchGoals(selectedAppraisal.employee_id);
      setGoals(g);
    }
    setShowGoalModal(false);
    setGoalForm({ employee_id: "", title: "", description: "", weight: "1", due_date: "" });
    setSaving(false);
  };

  /* ── Onboarding/Offboarding ── */
  const handleAssignChecklist = async () => {
    if (!assignForm.employee_id || !assignForm.checklist_id) return;
    setSaving(true);
    await assignChecklist(assignForm.checklist_id, assignForm.employee_id, assignForm.start_date);
    // Reload
    const instances = await fetchChecklistInstances();
    if (showAssignModal === "onboarding") {
      setOnboardInstances(instances.filter((i) => {
        const cl = onboardChecklists.find((c) => c.id === i.checklist_id);
        return cl?.type === "onboarding";
      }));
    } else {
      setOffboardInstances(instances.filter((i) => {
        const cl = offboardChecklists.find((c) => c.id === i.checklist_id);
        return cl?.type === "offboarding";
      }));
    }
    setShowAssignModal(null);
    setAssignForm({ employee_id: "", checklist_id: "", start_date: new Date().toISOString().split("T")[0] });
    setSaving(false);
  };

  const handleToggleItem = async (instanceId: string, itemIndex: number, completed: boolean, type: "onboarding" | "offboarding") => {
    await toggleChecklistItem(instanceId, itemIndex, completed);
    const instances = await fetchChecklistInstances();
    const checklists = type === "onboarding" ? onboardChecklists : offboardChecklists;
    const filtered = instances.filter((i) => {
      const cl = checklists.find((c) => c.id === i.checklist_id);
      return cl?.type === type;
    });
    if (type === "onboarding") setOnboardInstances(filtered);
    else setOffboardInstances(filtered);
  };

  /* ── Payroll ── */
  const handleCreateSalary = async () => {
    if (!salaryForm.employee_id || !salaryForm.base_salary || !salaryForm.effective_from) return;
    setSaving(true);
    let allowances: Record<string, number> = {};
    let deductions: Record<string, number> = {};
    try { allowances = JSON.parse(salaryForm.allowances); } catch { /* empty */ }
    try { deductions = JSON.parse(salaryForm.deductions); } catch { /* empty */ }
    await createSalaryRecord({
      employee_id: salaryForm.employee_id,
      base_salary: Number(salaryForm.base_salary),
      currency: salaryForm.currency,
      pay_frequency: salaryForm.pay_frequency,
      effective_from: salaryForm.effective_from,
      effective_to: null,
      allowances,
      deductions,
      notes: salaryForm.notes || null,
    });
    const updated = await fetchSalaryRecords();
    setSalaryRecords(updated);
    setShowSalaryModal(false);
    setSalaryForm({ employee_id: "", base_salary: "", currency: "USD", pay_frequency: "monthly", effective_from: "", allowances: "{}", deductions: "{}", notes: "" });
    setSaving(false);
  };

  const handleCreatePayslip = async () => {
    if (!payslipForm.employee_id || !payslipForm.period_start || !payslipForm.period_end) return;
    setSaving(true);
    await createPayslip({
      employee_id: payslipForm.employee_id,
      salary_record_id: null,
      period_start: payslipForm.period_start,
      period_end: payslipForm.period_end,
      gross_amount: payslipForm.gross_amount ? Number(payslipForm.gross_amount) : null,
      deductions: {},
      net_amount: payslipForm.net_amount ? Number(payslipForm.net_amount) : null,
      status: payslipForm.status as "draft" | "approved" | "paid",
      paid_at: null,
      notes: null,
    });
    const updated = await fetchPayslips();
    setPayslips(updated);
    setShowPayslipModal(false);
    setPayslipForm({ employee_id: "", period_start: "", period_end: "", gross_amount: "", net_amount: "", status: "draft" });
    setSaving(false);
  };

  /* ── Training ── */
  const handleCreateCourse = async () => {
    if (!courseForm.name) return;
    setSaving(true);
    await createCourse({
      name: courseForm.name,
      description: courseForm.description || null,
      provider: courseForm.provider || null,
      duration_hours: courseForm.duration_hours ? Number(courseForm.duration_hours) : null,
      is_mandatory: courseForm.is_mandatory,
      department_id: null,
      is_active: true,
    });
    const updated = await fetchCourses();
    setCourses(updated);
    setShowCourseModal(false);
    setCourseForm({ name: "", description: "", provider: "", duration_hours: "", is_mandatory: false });
    setSaving(false);
  };

  const handleEnroll = async () => {
    if (!enrollForm.employee_id || !enrollForm.course_id) return;
    setSaving(true);
    await enrollInCourse(enrollForm.employee_id, enrollForm.course_id);
    const updated = await fetchTrainingRecords();
    setTrainingRecords(updated);
    setShowEnrollModal(false);
    setEnrollForm({ employee_id: "", course_id: "" });
    setSaving(false);
  };

  /* ── Documents ── */
  const handleCreateDoc = async () => {
    if (!docForm.employee_id || !docForm.name || !docForm.file_url) return;
    setSaving(true);
    await createHrDocument({
      employee_id: docForm.employee_id,
      name: docForm.name,
      category: docForm.category,
      file_url: docForm.file_url,
      file_type: null,
      file_size: null,
      expiry_date: docForm.expiry_date || null,
      reminder_days: 30,
      notes: null,
      uploaded_by: null,
    });
    const updated = await fetchHrDocuments();
    setHrDocuments(updated);
    setShowDocModal(false);
    setDocForm({ employee_id: "", name: "", category: "other", file_url: "", expiry_date: "" });
    setSaving(false);
  };

  const handleDeleteDoc = async (id: string) => {
    setSaving(true);
    await deleteHrDocument(id);
    const updated = await fetchHrDocuments();
    setHrDocuments(updated);
    setSaving(false);
  };

  /* ═══════════════════════════════════════════════════
     TAB PANELS — DASHBOARD
     ═══════════════════════════════════════════════════ */

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Employees */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-1 bg-emerald-400 rounded-t-xl" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <UsersIcon size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-[24px] font-bold text-[var(--text-primary)]">{dashStats?.headcount ?? "-"}</div>
              <div className="text-[12px] text-[var(--text-dim)]">Total Employees</div>
            </div>
          </div>
        </div>
        {/* On Leave Today */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-1 bg-amber-400 rounded-t-xl" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <CalendarPlusIcon size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-[24px] font-bold text-[var(--text-primary)]">{dashStats?.today_absences ?? "-"}</div>
              <div className="text-[12px] text-[var(--text-dim)]">On Leave Today</div>
            </div>
          </div>
        </div>
        {/* Pending Requests */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-1 bg-blue-400 rounded-t-xl" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <ClockIcon size={18} className="text-blue-400" />
            </div>
            <div>
              <div className="text-[24px] font-bold text-[var(--text-primary)]">{dashStats?.pending_leave_requests ?? "-"}</div>
              <div className="text-[12px] text-[var(--text-dim)]">Pending Requests</div>
            </div>
          </div>
        </div>
        {/* Expiring Documents */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-1 bg-red-400 rounded-t-xl" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <DocumentIcon size={18} className="text-red-400" />
            </div>
            <div>
              <div className="text-[24px] font-bold text-[var(--text-primary)]">{dashStats?.expiring_documents ?? "-"}</div>
              <div className="text-[12px] text-[var(--text-dim)]">Expiring Documents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Recent Leave Requests</h3>
        {recentLeaves.length === 0 ? (
          <div className="text-[13px] text-[var(--text-dim)]">No recent requests</div>
        ) : (
          <div className="space-y-2">
            {recentLeaves.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <UserIcon size={14} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.employee_name}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">{r.leave_type_name} &middot; {fmtDate(r.start_date)} - {fmtDate(r.end_date)}</div>
                </div>
                <StatusBadge status={r.status} map={LEAVE_STATUS_MAP} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expiring Soon */}
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Expiring Soon</h3>
        {expiringItems.length === 0 ? (
          <div className="text-[13px] text-[var(--text-dim)]">Nothing expiring within 60 days</div>
        ) : (
          <div className="space-y-2">
            {expiringItems.slice(0, 8).map((item, idx) => {
              const days = daysUntil(item.expiry_date);
              const urgency = days <= 14 ? "text-red-400" : days <= 30 ? "text-amber-400" : "text-[var(--text-dim)]";
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.type === "visa" ? "bg-violet-500/15" : "bg-blue-500/15"}`}>
                    {item.type === "visa" ? <ShieldIcon size={14} className="text-violet-400" /> : <DocumentIcon size={14} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{item.label}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">{item.employee_name}</div>
                  </div>
                  <div className={`text-[12px] font-medium ${urgency}`}>{days}d</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — LEAVE
     ═══════════════════════════════════════════════════ */

  const renderLeave = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Leave Requests</h2>
        <button onClick={() => setShowLeaveModal(true)} className={primaryBtnCls}>
          <span className="flex items-center gap-1.5"><PlusIcon size={14} /> New Request</span>
        </button>
      </div>

      {/* Filter row */}
      <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-2 shrink-0 overflow-x-auto">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setLeaveFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-colors ${
              leaveFilter === s ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filteredLeaves.length === 0 ? (
          <EmptyState icon={CalendarPlusIcon} title="No leave requests" subtitle="Create a new leave request to get started" />
        ) : filteredLeaves.map((r) => (
          <button key={r.id} onClick={() => { if (r.status === "pending") setSelectedLeave(r); }}
            className="w-full text-start px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                <UserIcon size={16} className="text-[var(--text-dim)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.employee_name}</span>
                  <StatusBadge status={r.leave_type_name} map={{
                    ...Object.fromEntries((leaveTypes || []).map((t) => [t.name, `bg-${t.color || "slate"}-500/15 text-${t.color || "slate"}-400 border-${t.color || "slate"}-500/20`]))
                  }} />
                </div>
                <div className="text-[11px] text-[var(--text-dim)]">
                  {fmtDate(r.start_date)} - {fmtDate(r.end_date)} &middot; {r.days} day{r.days !== 1 ? "s" : ""}{r.half_day ? " (Half day)" : ""}
                </div>
              </div>
              <StatusBadge status={r.status} map={LEAVE_STATUS_MAP} />
            </div>
          </button>
        ))}
      </div>

      {/* Review Modal */}
      <ModalShell open={!!selectedLeave} onClose={() => { setSelectedLeave(null); setReviewNotes(""); }} title="Review Leave Request"
        footer={selectedLeave?.status === "pending" ? (
          <>
            <button onClick={() => handleReviewLeave(selectedLeave!.id, "rejected")} className={dangerBtnCls} disabled={saving}>Reject</button>
            <button onClick={() => handleReviewLeave(selectedLeave!.id, "approved")} className={primaryBtnCls} disabled={saving}>
              {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Approve"}
            </button>
          </>
        ) : undefined}>
        {selectedLeave && (
          <div className="space-y-3">
            <div className="text-[13px]"><span className="text-[var(--text-dim)]">Employee:</span> <span className="font-medium text-[var(--text-primary)]">{selectedLeave.employee_name}</span></div>
            <div className="text-[13px]"><span className="text-[var(--text-dim)]">Type:</span> <span className="font-medium text-[var(--text-primary)]">{selectedLeave.leave_type_name}</span></div>
            <div className="text-[13px]"><span className="text-[var(--text-dim)]">Period:</span> <span className="font-medium text-[var(--text-primary)]">{fmtDate(selectedLeave.start_date)} - {fmtDate(selectedLeave.end_date)} ({selectedLeave.days} days)</span></div>
            {selectedLeave.reason && <div className="text-[13px]"><span className="text-[var(--text-dim)]">Reason:</span> <span className="text-[var(--text-primary)]">{selectedLeave.reason}</span></div>}
            <div>
              <FieldLabel>Review Notes</FieldLabel>
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className={textareaCls} rows={3} placeholder="Optional notes..." />
            </div>
          </div>
        )}
      </ModalShell>

      {/* Create Leave Modal */}
      <ModalShell open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="New Leave Request"
        footer={<>
          <button onClick={() => setShowLeaveModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateLeave} className={primaryBtnCls} disabled={saving || !leaveForm.employee_id || !leaveForm.leave_type_id || !leaveForm.start_date || !leaveForm.end_date}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Submit"}
          </button>
        </>}>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <select value={leaveForm.employee_id} onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })} className={selectCls}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Leave Type</FieldLabel>
          <select value={leaveForm.leave_type_id} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })} className={selectCls}>
            <option value="">Select type...</option>
            {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <FieldLabel>Reason</FieldLabel>
          <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className={textareaCls} rows={3} placeholder="Optional reason..." />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
          <input type="checkbox" checked={leaveForm.half_day} onChange={(e) => setLeaveForm({ ...leaveForm, half_day: e.target.checked })} className="rounded border-[var(--border-subtle)]" />
          Half Day
        </label>
      </ModalShell>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — ATTENDANCE
     ═══════════════════════════════════════════════════ */

  const renderAttendance = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Attendance</h2>
        <input type="date" value={attendanceDate} onChange={(e) => { setAttendanceDate(e.target.value); reloadAttendance(e.target.value); }}
          className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] outline-none" />
      </div>

      {/* Summary row */}
      <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[12px] font-medium text-[var(--text-primary)]">{attendanceSummary.present} Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[12px] font-medium text-[var(--text-primary)]">{attendanceSummary.late} Late</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-[12px] font-medium text-[var(--text-primary)]">{attendanceSummary.absent} Absent</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {attendanceRecords.length === 0 ? (
          <EmptyState icon={ClockIcon} title="No attendance records" subtitle={`No records for ${fmtDate(attendanceDate)}`} />
        ) : attendanceRecords.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
              <UserIcon size={16} className="text-[var(--text-dim)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{attendanceNames.get(r.employee_id) || r.employee_id}</div>
              <div className="text-[11px] text-[var(--text-dim)]">
                In: {fmtTime(r.clock_in)} &middot; Out: {fmtTime(r.clock_out)} &middot; {r.total_hours != null ? `${r.total_hours}h` : "-"}
              </div>
            </div>
            <StatusBadge status={r.status} map={ATTENDANCE_STATUS_MAP} />
            {!r.clock_out && r.clock_in && (
              <button onClick={() => handleClockOut(r.employee_id)} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
                Clock Out
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — RECRUITMENT
     ═══════════════════════════════════════════════════ */

  const renderRecruitment = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {selectedPosting && (
            <button onClick={() => { setSelectedPosting(null); setApplicants([]); }}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
              <ArrowLeftIcon size={16} className="text-[var(--text-dim)] rtl:rotate-180" />
            </button>
          )}
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {selectedPosting ? selectedPosting.title : "Job Postings"}
          </h2>
        </div>
        {selectedPosting ? (
          <button onClick={() => setShowApplicantModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> New Applicant</span>
          </button>
        ) : (
          <button onClick={() => setShowPostingModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> New Posting</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!selectedPosting ? (
          /* Job postings list */
          jobPostings.length === 0 ? (
            <EmptyState icon={BriefcaseIcon} title="No job postings" subtitle="Create your first job posting" />
          ) : jobPostings.map((p) => (
            <button key={p.id} onClick={() => handleSelectPosting(p)}
              className="w-full text-start px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <BriefcaseIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.title}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    {p.department_name || "No dept"} &middot; {p.employment_type}
                  </div>
                </div>
                <StatusBadge status={p.status} map={JOB_STATUS_MAP} />
              </div>
            </button>
          ))
        ) : (
          /* Applicants list */
          applicants.length === 0 ? (
            <EmptyState icon={UserPlusIcon} title="No applicants" subtitle="Add the first applicant for this posting" />
          ) : applicants.map((a) => (
            <div key={a.id} className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <UserIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{a.full_name}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    {a.email || "-"} &middot; {a.source || "Direct"}
                    {a.rating != null && (
                      <span className="ms-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={i < a.rating! ? "text-amber-400" : "text-[var(--text-faint)]"}>&#9733;</span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={a.stage} map={STAGE_MAP} />
              </div>
              {/* Stage actions */}
              <div className="flex items-center gap-1.5 mt-2 ms-12 flex-wrap">
                {(["new", "screening", "interview", "offer", "hired", "rejected"] as const).map((s) => (
                  <button key={s} onClick={() => handleUpdateStage(a.id, s)} disabled={a.stage === s || saving}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium capitalize transition-colors ${
                      a.stage === s ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    } disabled:opacity-30`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Posting Modal */}
      <ModalShell open={showPostingModal} onClose={() => setShowPostingModal(false)} title="New Job Posting" width="max-w-[560px]"
        footer={<>
          <button onClick={() => setShowPostingModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreatePosting} className={primaryBtnCls} disabled={saving || !postingForm.title}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Create"}
          </button>
        </>}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input value={postingForm.title} onChange={(e) => setPostingForm({ ...postingForm, title: e.target.value })} className={inputCls} placeholder="e.g. Senior Developer" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Employment Type</FieldLabel>
            <select value={postingForm.employment_type} onChange={(e) => setPostingForm({ ...postingForm, employment_type: e.target.value })} className={selectCls}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <input value={postingForm.location} onChange={(e) => setPostingForm({ ...postingForm, location: e.target.value })} className={inputCls} placeholder="e.g. Remote" />
          </div>
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea value={postingForm.description} onChange={(e) => setPostingForm({ ...postingForm, description: e.target.value })} className={textareaCls} rows={4} placeholder="Job description..." />
        </div>
        <div>
          <FieldLabel>Requirements</FieldLabel>
          <textarea value={postingForm.requirements} onChange={(e) => setPostingForm({ ...postingForm, requirements: e.target.value })} className={textareaCls} rows={3} placeholder="Job requirements..." />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel>Min Salary</FieldLabel>
            <input type="number" value={postingForm.salary_min} onChange={(e) => setPostingForm({ ...postingForm, salary_min: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <FieldLabel>Max Salary</FieldLabel>
            <input type="number" value={postingForm.salary_max} onChange={(e) => setPostingForm({ ...postingForm, salary_max: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <FieldLabel>Currency</FieldLabel>
            <input value={postingForm.salary_currency} onChange={(e) => setPostingForm({ ...postingForm, salary_currency: e.target.value })} className={inputCls} placeholder="USD" />
          </div>
        </div>
      </ModalShell>

      {/* Create Applicant Modal */}
      <ModalShell open={showApplicantModal} onClose={() => setShowApplicantModal(false)} title="New Applicant"
        footer={<>
          <button onClick={() => setShowApplicantModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateApplicant} className={primaryBtnCls} disabled={saving || !applicantForm.full_name}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Add"}
          </button>
        </>}>
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <input value={applicantForm.full_name} onChange={(e) => setApplicantForm({ ...applicantForm, full_name: e.target.value })} className={inputCls} placeholder="Full name" />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input type="email" value={applicantForm.email} onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })} className={inputCls} placeholder="Email" />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input value={applicantForm.phone} onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })} className={inputCls} placeholder="Phone" />
        </div>
        <div>
          <FieldLabel>Source</FieldLabel>
          <input value={applicantForm.source} onChange={(e) => setApplicantForm({ ...applicantForm, source: e.target.value })} className={inputCls} placeholder="e.g. LinkedIn, Referral" />
        </div>
      </ModalShell>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — APPRAISALS
     ═══════════════════════════════════════════════════ */

  const renderAppraisals = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {selectedAppraisal && (
            <button onClick={() => { setSelectedAppraisal(null); setGoals([]); }}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
              <ArrowLeftIcon size={16} className="text-[var(--text-dim)] rtl:rotate-180" />
            </button>
          )}
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {selectedAppraisal ? selectedAppraisal.employee_name : "Appraisals"}
          </h2>
        </div>
        {!selectedAppraisal && (
          <button onClick={() => setShowCycleModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> New Cycle</span>
          </button>
        )}
        {selectedAppraisal && (
          <button onClick={() => { setGoalForm({ ...goalForm, employee_id: selectedAppraisal.employee_id }); setShowGoalModal(true); }} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Add Goal</span>
          </button>
        )}
      </div>

      {!selectedAppraisal ? (
        <>
          {/* Cycle selector */}
          <div className="px-6 py-3 border-b border-[var(--border-color)] shrink-0">
            <select value={selectedCycleId} onChange={(e) => handleSelectCycle(e.target.value)} className={selectCls}>
              <option value="">Select cycle...</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmtDate(c.start_date)} - {fmtDate(c.end_date)})</option>)}
            </select>
          </div>

          {/* Appraisal list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {appraisals.length === 0 ? (
              <EmptyState icon={StarIcon} title="No appraisals" subtitle={selectedCycleId ? "No appraisals in this cycle" : "Select an appraisal cycle"} />
            ) : appraisals.map((a) => (
              <button key={a.id} onClick={async () => {
                setSelectedAppraisal(a);
                setLoading(true);
                const g = await fetchGoals(a.employee_id);
                setGoals(g);
                setLoading(false);
              }}
                className="w-full text-start px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{a.employee_name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      Self: {a.self_rating ?? "-"} &middot; Reviewer: {a.reviewer_rating ?? "-"} &middot; Overall: {a.overall_score ?? "-"}
                    </div>
                  </div>
                  <StatusBadge status={a.status} map={{
                    draft: "bg-slate-500/15 text-slate-400 border-slate-500/20",
                    in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
                    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
                  }} />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Appraisal detail + goals */
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Appraisal info */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Self Rating</FieldLabel>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">{selectedAppraisal.self_rating ?? "-"}</div>
              </div>
              <div>
                <FieldLabel>Reviewer Rating</FieldLabel>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">{selectedAppraisal.reviewer_rating ?? "-"}</div>
              </div>
            </div>
            {selectedAppraisal.self_comments && (
              <div>
                <FieldLabel>Self Comments</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)]">{selectedAppraisal.self_comments}</div>
              </div>
            )}
            {selectedAppraisal.reviewer_comments && (
              <div>
                <FieldLabel>Reviewer Comments</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)]">{selectedAppraisal.reviewer_comments}</div>
              </div>
            )}
            {selectedAppraisal.overall_score != null && (
              <div>
                <FieldLabel>Overall Score</FieldLabel>
                <div className="text-[20px] font-bold text-[var(--text-primary)]">{selectedAppraisal.overall_score}</div>
              </div>
            )}
          </div>

          {/* Goals */}
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Goals</h3>
            {goals.length === 0 ? (
              <div className="text-[13px] text-[var(--text-dim)]">No goals set</div>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => (
                  <div key={g.id} className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{g.title}</span>
                      <StatusBadge status={g.status} map={{
                        not_started: "bg-slate-500/15 text-slate-400 border-slate-500/20",
                        in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
                        completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
                        deferred: "bg-amber-500/15 text-amber-400 border-amber-500/20",
                      }} />
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, g.progress)}%` }} />
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-1">{g.progress}% complete &middot; Weight: {g.weight}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Cycle Modal */}
      <ModalShell open={showCycleModal} onClose={() => setShowCycleModal(false)} title="New Appraisal Cycle"
        footer={<>
          <button onClick={() => setShowCycleModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateCycle} className={primaryBtnCls} disabled={saving || !cycleForm.name || !cycleForm.start_date || !cycleForm.end_date}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Create"}
          </button>
        </>}>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} className={inputCls} placeholder="e.g. Q1 2026 Review" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input type="date" value={cycleForm.start_date} onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <input type="date" value={cycleForm.end_date} onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })} className={inputCls} />
          </div>
        </div>
      </ModalShell>

      {/* Create Goal Modal */}
      <ModalShell open={showGoalModal} onClose={() => setShowGoalModal(false)} title="Add Goal"
        footer={<>
          <button onClick={() => setShowGoalModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateGoal} className={primaryBtnCls} disabled={saving || !goalForm.title}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Add"}
          </button>
        </>}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className={inputCls} placeholder="Goal title" />
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} className={textareaCls} rows={3} placeholder="Description..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Weight</FieldLabel>
            <input type="number" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} className={inputCls} min="1" max="10" />
          </div>
          <div>
            <FieldLabel>Due Date</FieldLabel>
            <input type="date" value={goalForm.due_date} onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })} className={inputCls} />
          </div>
        </div>
      </ModalShell>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — ONBOARDING / OFFBOARDING (shared)
     ═══════════════════════════════════════════════════ */

  const renderBoardingTab = (type: "onboarding" | "offboarding") => {
    const checklists = type === "onboarding" ? onboardChecklists : offboardChecklists;
    const instances = type === "onboarding" ? onboardInstances : offboardInstances;
    const Icon = type === "onboarding" ? CheckCircleIcon : SignOutIcon;
    const label = type === "onboarding" ? "Onboarding" : "Offboarding";

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{label}</h2>
          <button onClick={() => { setShowAssignModal(type); setAssignForm({ employee_id: "", checklist_id: "", start_date: new Date().toISOString().split("T")[0] }); }} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Assign Checklist</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Templates */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Templates</div>
            {checklists.length === 0 ? (
              <div className="text-[13px] text-[var(--text-dim)] px-2">No templates available</div>
            ) : (
              <div className="space-y-1">
                {checklists.map((c) => (
                  <div key={c.id} className="px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{c.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">{c.items.length} items</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active instances */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Active</div>
            {instances.length === 0 ? (
              <EmptyState icon={Icon} title={`No active ${type}`} subtitle={`Assign a checklist to begin`} />
            ) : (
              <div className="space-y-2">
                {instances.map((inst) => {
                  const checklist = checklists.find((c) => c.id === inst.checklist_id);
                  const items = checklist?.items || [];
                  const completed = (inst.items_status || []).filter((s) => s.completed).length;
                  const total = items.length;
                  const isExpanded = expandedInstance === inst.id;

                  return (
                    <div key={inst.id} className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                      <button onClick={() => setExpandedInstance(isExpanded ? null : inst.id)}
                        className="w-full text-start px-4 py-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                          <UserIcon size={16} className="text-[var(--text-dim)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{inst.employee_name}</div>
                          <div className="text-[11px] text-[var(--text-dim)]">{inst.checklist_name} &middot; {completed}/{total} items &middot; {fmtDate(inst.start_date)}</div>
                        </div>
                        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-1 border-t border-[var(--border-subtle)]">
                          {items.map((item, idx) => {
                            const status = (inst.items_status || []).find((s) => s.item_index === idx);
                            const isDone = status?.completed || false;
                            return (
                              <label key={idx} className="flex items-center gap-3 py-2 cursor-pointer hover:bg-[var(--bg-surface)] rounded-lg px-2 transition-colors">
                                <input type="checkbox" checked={isDone}
                                  onChange={(e) => handleToggleItem(inst.id, idx, e.target.checked, type)}
                                  className="rounded border-[var(--border-subtle)]" />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[13px] ${isDone ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{item.title}</div>
                                  <div className="text-[10px] text-[var(--text-dim)]">{item.assignee_role} &middot; Due: +{item.due_days}d</div>
                                </div>
                                {isDone && <CheckIcon size={14} className="text-emerald-400 shrink-0" />}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Assign Checklist Modal */}
        <ModalShell open={showAssignModal === type} onClose={() => setShowAssignModal(null)} title={`Assign ${label} Checklist`}
          footer={<>
            <button onClick={() => setShowAssignModal(null)} className={cancelBtnCls}>Cancel</button>
            <button onClick={handleAssignChecklist} className={primaryBtnCls} disabled={saving || !assignForm.employee_id || !assignForm.checklist_id}>
              {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Assign"}
            </button>
          </>}>
          <div>
            <FieldLabel>Employee</FieldLabel>
            <select value={assignForm.employee_id} onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })} className={selectCls}>
              <option value="">Select employee...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Checklist Template</FieldLabel>
            <select value={assignForm.checklist_id} onChange={(e) => setAssignForm({ ...assignForm, checklist_id: e.target.value })} className={selectCls}>
              <option value="">Select checklist...</option>
              {checklists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input type="date" value={assignForm.start_date} onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })} className={inputCls} />
          </div>
        </ModalShell>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     TAB PANELS — PAYROLL
     ═══════════════════════════════════════════════════ */

  const renderPayroll = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Payroll</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPayslipModal(true)} className={cancelBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Payslip</span>
          </button>
          <button onClick={() => setShowSalaryModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Add Salary</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Salary Records */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Salary Register</div>
          {salaryRecords.length === 0 ? (
            <EmptyState icon={WalletIcon} title="No salary records" subtitle="Add a salary record to get started" />
          ) : (
            <div className="space-y-2">
              {salaryRecords.map((r) => (
                <div key={r.id} className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                      <UserIcon size={16} className="text-[var(--text-dim)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.employee_name}</div>
                      <div className="text-[11px] text-[var(--text-dim)]">
                        {r.currency} {r.base_salary.toLocaleString()} &middot; {fmtDate(r.effective_from)}{r.effective_to ? ` - ${fmtDate(r.effective_to)}` : " - Present"}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="text-[11px] text-emerald-400">+{sumObj(r.allowances).toLocaleString()}</div>
                      <div className="text-[11px] text-red-400">-{sumObj(r.deductions).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payslips */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Payslips</div>
          {payslips.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)] px-2">No payslips</div>
          ) : (
            <div className="space-y-2">
              {payslips.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.employee_name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {fmtDate(p.period_start)} - {fmtDate(p.period_end)} &middot; Gross: {p.gross_amount ?? "-"} &middot; Net: {p.net_amount ?? "-"}
                    </div>
                  </div>
                  <StatusBadge status={p.status} map={PAYSLIP_STATUS_MAP} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Salary Modal */}
      <ModalShell open={showSalaryModal} onClose={() => setShowSalaryModal(false)} title="Add Salary Record"
        footer={<>
          <button onClick={() => setShowSalaryModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateSalary} className={primaryBtnCls} disabled={saving || !salaryForm.employee_id || !salaryForm.base_salary || !salaryForm.effective_from}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Save"}
          </button>
        </>}>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <select value={salaryForm.employee_id} onChange={(e) => setSalaryForm({ ...salaryForm, employee_id: e.target.value })} className={selectCls}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Base Salary</FieldLabel>
            <input type="number" value={salaryForm.base_salary} onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <FieldLabel>Currency</FieldLabel>
            <input value={salaryForm.currency} onChange={(e) => setSalaryForm({ ...salaryForm, currency: e.target.value })} className={inputCls} placeholder="USD" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Pay Frequency</FieldLabel>
            <select value={salaryForm.pay_frequency} onChange={(e) => setSalaryForm({ ...salaryForm, pay_frequency: e.target.value })} className={selectCls}>
              <option value="monthly">Monthly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <FieldLabel>Effective From</FieldLabel>
            <input type="date" value={salaryForm.effective_from} onChange={(e) => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <FieldLabel>Allowances (JSON)</FieldLabel>
          <input value={salaryForm.allowances} onChange={(e) => setSalaryForm({ ...salaryForm, allowances: e.target.value })} className={inputCls} placeholder='{"housing": 500}' />
        </div>
        <div>
          <FieldLabel>Deductions (JSON)</FieldLabel>
          <input value={salaryForm.deductions} onChange={(e) => setSalaryForm({ ...salaryForm, deductions: e.target.value })} className={inputCls} placeholder='{"tax": 200}' />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} className={textareaCls} rows={2} placeholder="Optional notes..." />
        </div>
      </ModalShell>

      {/* Payslip Modal */}
      <ModalShell open={showPayslipModal} onClose={() => setShowPayslipModal(false)} title="Create Payslip"
        footer={<>
          <button onClick={() => setShowPayslipModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreatePayslip} className={primaryBtnCls} disabled={saving || !payslipForm.employee_id || !payslipForm.period_start || !payslipForm.period_end}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Create"}
          </button>
        </>}>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <select value={payslipForm.employee_id} onChange={(e) => setPayslipForm({ ...payslipForm, employee_id: e.target.value })} className={selectCls}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Period Start</FieldLabel>
            <input type="date" value={payslipForm.period_start} onChange={(e) => setPayslipForm({ ...payslipForm, period_start: e.target.value })} className={inputCls} />
          </div>
          <div>
            <FieldLabel>Period End</FieldLabel>
            <input type="date" value={payslipForm.period_end} onChange={(e) => setPayslipForm({ ...payslipForm, period_end: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Gross Amount</FieldLabel>
            <input type="number" value={payslipForm.gross_amount} onChange={(e) => setPayslipForm({ ...payslipForm, gross_amount: e.target.value })} className={inputCls} placeholder="0" />
          </div>
          <div>
            <FieldLabel>Net Amount</FieldLabel>
            <input type="number" value={payslipForm.net_amount} onChange={(e) => setPayslipForm({ ...payslipForm, net_amount: e.target.value })} className={inputCls} placeholder="0" />
          </div>
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <select value={payslipForm.status} onChange={(e) => setPayslipForm({ ...payslipForm, status: e.target.value })} className={selectCls}>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </ModalShell>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — TRAINING
     ═══════════════════════════════════════════════════ */

  const renderTraining = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Training</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEnrollModal(true)} className={cancelBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Enroll</span>
          </button>
          <button onClick={() => setShowCourseModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Add Course</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Courses */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Courses</div>
          {courses.length === 0 ? (
            <EmptyState icon={BookOpenIcon} title="No courses" subtitle="Add your first training course" />
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <BookOpenIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{c.name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {c.provider || "Internal"} &middot; {c.duration_hours ? `${c.duration_hours}h` : "-"}
                    </div>
                  </div>
                  {c.is_mandatory && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">Mandatory</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training Records */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2 mb-2">Training Records</div>
          {trainingRecords.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)] px-2">No training records</div>
          ) : (
            <div className="space-y-2">
              {trainingRecords.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.employee_name}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {r.course_name} &middot; Enrolled: {fmtDate(r.enrolled_at)}{r.completed_at ? ` &middot; Completed: ${fmtDate(r.completed_at)}` : ""}{r.score != null ? ` &middot; Score: ${r.score}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={r.status} map={TRAINING_STATUS_MAP} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Course Modal */}
      <ModalShell open={showCourseModal} onClose={() => setShowCourseModal(false)} title="Add Course"
        footer={<>
          <button onClick={() => setShowCourseModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleCreateCourse} className={primaryBtnCls} disabled={saving || !courseForm.name}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Create"}
          </button>
        </>}>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} className={inputCls} placeholder="Course name" />
        </div>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <input value={courseForm.provider} onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })} className={inputCls} placeholder="e.g. Coursera, Internal" />
        </div>
        <div>
          <FieldLabel>Duration (hours)</FieldLabel>
          <input type="number" value={courseForm.duration_hours} onChange={(e) => setCourseForm({ ...courseForm, duration_hours: e.target.value })} className={inputCls} placeholder="0" />
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} className={textareaCls} rows={3} placeholder="Course description..." />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
          <input type="checkbox" checked={courseForm.is_mandatory} onChange={(e) => setCourseForm({ ...courseForm, is_mandatory: e.target.checked })} className="rounded border-[var(--border-subtle)]" />
          Mandatory
        </label>
      </ModalShell>

      {/* Enroll Modal */}
      <ModalShell open={showEnrollModal} onClose={() => setShowEnrollModal(false)} title="Enroll Employee"
        footer={<>
          <button onClick={() => setShowEnrollModal(false)} className={cancelBtnCls}>Cancel</button>
          <button onClick={handleEnroll} className={primaryBtnCls} disabled={saving || !enrollForm.employee_id || !enrollForm.course_id}>
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Enroll"}
          </button>
        </>}>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <select value={enrollForm.employee_id} onChange={(e) => setEnrollForm({ ...enrollForm, employee_id: e.target.value })} className={selectCls}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Course</FieldLabel>
          <select value={enrollForm.course_id} onChange={(e) => setEnrollForm({ ...enrollForm, course_id: e.target.value })} className={selectCls}>
            <option value="">Select course...</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </ModalShell>
    </div>
  );

  /* ═══════════════════════════════════════════════════
     TAB PANELS — DOCUMENTS
     ═══════════════════════════════════════════════════ */

  const renderDocuments = () => {
    const empNameMap = new Map<string, string>();
    for (const e of employees) { empNameMap.set(e.id, e.person.full_name); }

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Documents</h2>
          <button onClick={() => setShowDocModal(true)} className={primaryBtnCls}>
            <span className="flex items-center gap-1.5"><PlusIcon size={14} /> Upload</span>
          </button>
        </div>

        {/* Category filter */}
        <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-2 shrink-0 overflow-x-auto">
          {["all", "identity", "contract", "certification", "medical", "other"].map((c) => (
            <button key={c} onClick={() => setDocFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-colors ${
                docFilter === c ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}>
              {c}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filteredDocs.length === 0 ? (
            <EmptyState icon={DocumentIcon} title="No documents" subtitle="Upload a document to get started" />
          ) : filteredDocs.map((d) => {
            const days = d.expiry_date ? daysUntil(d.expiry_date) : null;
            const expiryUrgency = days != null ? (days <= 14 ? "text-red-400" : days <= 30 ? "text-amber-400" : "text-[var(--text-dim)]") : null;

            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <DocumentIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{d.name}</span>
                    <StatusBadge status={d.category} map={DOC_CATEGORY_MAP} />
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    {empNameMap.get(d.employee_id) || d.employee_id}
                    {d.file_type && ` &middot; ${d.file_type}`}
                    {d.expiry_date && (
                      <span className={`ms-1 ${expiryUrgency}`}>&middot; Expires: {fmtDate(d.expiry_date)} ({days}d)</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDeleteDoc(d.id)} disabled={saving}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-[var(--text-dim)] hover:text-red-400 transition-colors shrink-0">
                  <TrashIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Upload Modal */}
        <ModalShell open={showDocModal} onClose={() => setShowDocModal(false)} title="Upload Document"
          footer={<>
            <button onClick={() => setShowDocModal(false)} className={cancelBtnCls}>Cancel</button>
            <button onClick={handleCreateDoc} className={primaryBtnCls} disabled={saving || !docForm.employee_id || !docForm.name || !docForm.file_url}>
              {saving ? <SpinnerIcon size={16} className="animate-spin" /> : "Upload"}
            </button>
          </>}>
          <div>
            <FieldLabel>Employee</FieldLabel>
            <select value={docForm.employee_id} onChange={(e) => setDocForm({ ...docForm, employee_id: e.target.value })} className={selectCls}>
              <option value="">Select employee...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.person.full_name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} className={inputCls} placeholder="Document name" />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <select value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })} className={selectCls}>
              <option value="identity">Identity</option>
              <option value="contract">Contract</option>
              <option value="certification">Certification</option>
              <option value="medical">Medical</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <FieldLabel>File URL</FieldLabel>
            <input value={docForm.file_url} onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })} className={inputCls} placeholder="https://..." />
          </div>
          <div>
            <FieldLabel>Expiry Date</FieldLabel>
            <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })} className={inputCls} />
          </div>
        </ModalShell>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     TAB PANELS — REPORTS
     ═══════════════════════════════════════════════════ */

  const renderReports = () => {
    // Headcount by department
    const deptCounts = new Map<string, number>();
    for (const e of employees) {
      const dept = e.department_name || "Unassigned";
      deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    }
    const deptEntries = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);
    const maxDeptCount = deptEntries.length > 0 ? deptEntries[0][1] : 1;

    // Leave utilization
    const totalLeaves = leaveRequests.length;
    const approvedLeaves = leaveRequests.filter((r) => r.status === "approved").length;
    const pendingLeaves = leaveRequests.filter((r) => r.status === "pending").length;
    const rejectedLeaves = leaveRequests.filter((r) => r.status === "rejected").length;

    // Training completion
    const completedTraining = trainingRecords.filter((r) => r.status === "completed").length;
    const totalTraining = trainingRecords.length;
    const trainingRate = totalTraining > 0 ? Math.round((completedTraining / totalTraining) * 100) : 0;

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Reports</h2>

        {/* Headcount by Department */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Headcount by Department</h3>
          {deptEntries.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)]">No data</div>
          ) : (
            <div className="space-y-3">
              {deptEntries.map(([dept, count]) => (
                <div key={dept}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-[var(--text-primary)]">{dept}</span>
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${(count / maxDeptCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave Utilization */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Leave Utilization</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-[20px] font-bold text-emerald-400">{approvedLeaves}</div>
              <div className="text-[11px] text-[var(--text-dim)]">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-bold text-amber-400">{pendingLeaves}</div>
              <div className="text-[11px] text-[var(--text-dim)]">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-bold text-red-400">{rejectedLeaves}</div>
              <div className="text-[11px] text-[var(--text-dim)]">Rejected</div>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-[var(--text-dim)] text-center">Total: {totalLeaves} requests</div>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-2">Overall Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1">Total Employees</div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">{dashStats?.headcount ?? "-"}</div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1">Active</div>
              <div className="text-[20px] font-bold text-emerald-400">{dashStats?.active ?? "-"}</div>
            </div>
          </div>
        </div>

        {/* Training Completion */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Training Completion</h3>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-surface)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" className="stroke-emerald-400"
                  strokeWidth="3" strokeDasharray={`${trainingRate}, 100`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)]">{trainingRate}%</span>
            </div>
            <div>
              <div className="text-[13px] text-[var(--text-primary)]">{completedTraining} of {totalTraining} completed</div>
              <div className="text-[11px] text-[var(--text-dim)]">Training records</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     RENDER TAB CONTENT
     ═══════════════════════════════════════════════════ */

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <SpinnerIcon size={24} className="animate-spin text-[var(--text-dim)]" />
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard": return renderDashboard();
      case "leave": return renderLeave();
      case "attendance": return renderAttendance();
      case "recruitment": return renderRecruitment();
      case "appraisals": return renderAppraisals();
      case "onboarding": return renderBoardingTab("onboarding");
      case "offboarding": return renderBoardingTab("offboarding");
      case "payroll": return renderPayroll();
      case "training": return renderTraining();
      case "documents": return renderDocuments();
      case "reports": return renderReports();
      default: return null;
    }
  };

  /* ═══════════════════════════════════════════════════
     MAIN LAYOUT
     ═══════════════════════════════════════════════════ */

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden max-w-[100vw]">

      {/* ═══════════ LEFT PANEL ═══════════ */}
      <div className={`${mobileShowDetail ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] lg:w-[380px] md:border-e border-[var(--border-color)] shrink-0 h-full bg-[var(--bg-secondary)] min-w-0`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2.5 mb-3">
              <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <ArrowLeftIcon size={16} className="rtl:rotate-180" />
              </Link>
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <HrIcon size={16} />
              </div>
              <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate flex-1">HR</h1>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileShowDetail(true); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                    isActive ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  }`}>
                  <Icon size={16} />
                  <span className="text-[13px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <div className={`${mobileShowDetail ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 h-full bg-[var(--bg-primary)]`}>
        {/* Mobile back button */}
        <div className="md:hidden px-4 py-2 border-b border-[var(--border-color)] shrink-0">
          <button onClick={() => setMobileShowDetail(false)} className="flex items-center gap-2 text-[13px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeftIcon size={14} className="rtl:rotate-180" />
            <span>Back</span>
          </button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

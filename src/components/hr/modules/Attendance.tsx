"use client";

/* ---------------------------------------------------------------------------
   Attendance — two readings of the same records.

   Day  — who punched today (the original view): one date, every record,
          each one editable (with a reason) by HR or the owner.
   Month — one employee, every day accounted for (Phase C): weekend, public
          holiday, approved leave, present, late, absent — derived on the
          server by attendance-sheet.ts so HR and the employee read the same
          sheet at /me.

   Plus the two things a real attendance desk needs: importing the
   fingerprint device's CSV export, and the per-country policy (hours,
   timezone, late threshold, weekend fallback) that late/overtime derive
   from. Weekend and public holidays themselves come from the Calendar app's
   holidays for the employee's work country.

   Phase 1 (owner-approved 23 Sep 2026): HR or the owner EDITS a day (times
   in the employee's policy zone, reason required, kept in the history) —
   the old "clock out on behalf" stamped the moment of the press and looked
   the day up by UTC date. "Requests" is the queue of employee correction
   requests and of overtime waiting for approval (only approved overtime is
   paid). "Employees" sets how each person punches: the app, or the office
   fingerprint device only, and who works outside the office.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useRef } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  EmptyState, StatusBadge, ModalShell, FieldLabel, fmtDate, fmtTime,
  ATTENDANCE_STATUS_MAP, LEAVE_STATUS_MAP, makeTranslationHelpers, primaryBtnCls, cancelBtnCls, inputCls, textareaCls, cardCls,
} from "@/components/hr/shared";
import {
  fetchAttendanceRecords, fetchAttendanceSheet, importAttendanceCsv, fetchAttendancePolicies, saveAttendancePolicy,
  editAttendanceDay, fetchAttendanceCorrections, decideAttendanceCorrection, fetchPendingOvertime, decideOvertime,
  fetchAttendanceEmployees, saveAttendanceEmployee,
  type AttendanceSheet, type AttendanceImportResult, type AttendancePolicyInput,
  type AttendanceCorrectionRow, type OvertimeItem, type AttendanceEmployeeSetting,
} from "@/lib/hr-admin";
import { hhmmInZone, fmtMinutes } from "@/lib/hr/attendance-time";
import type { AttendanceRecordRow, AttendancePolicyRow } from "@/types/supabase";
import DatePicker from "@/components/ui/DatePicker";
import EmployeePicker from "@/components/hr/EmployeePicker";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import UserIcon from "@/components/icons/ui/UserIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import UserCogIcon from "@/components/icons/ui/UserCogIcon";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const ZONES = ["Asia/Shanghai", "Africa/Cairo", "Asia/Dubai", "Asia/Riyadh", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Kolkata", "Asia/Ho_Chi_Minh", "Asia/Jakarta", "UTC"];
/* The browser's own calendar day, not the UTC one (UTC is yesterday before
   08:00 in China). */
const todayIso = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shiftMonth = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + by, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const fmtH = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 10) / 10} h`);

const emptyPolicy = (): AttendancePolicyInput => ({
  name: "", country: null, timezone: "Asia/Shanghai", work_start: "09:00", work_end: "18:00",
  late_threshold_min: 15, min_hours: 8, weekend_days: ["saturday", "sunday"], is_default: false, tracking_from: null,
});
const chip = "inline-flex items-center h-5 px-1.5 rounded-md text-[10.5px] font-medium border";
const OT_CHIP: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-slate-500/10 text-[var(--text-dim)] border-slate-500/15",
};
const EDIT_ERRORS: Record<string, string> = {
  out_before_in: "hr.att.errOutBeforeIn", break_too_long: "hr.att.errBreak", no_reason: "hr.att.errReason",
  bad_time: "hr.att.errTime", no_clock_in: "hr.att.errTime",
};

export default function AttendanceModule({ employees, t, lang }: HRModuleProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const [view, setView] = useState<"day" | "month">("day");

  /* ── Day view ── */
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const records = await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate });
      if (!cancelled) { setAttendanceRecords(records); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [attendanceDate]);

  const nameMap = useMemo(() => { const m = new Map<string, string>(); for (const e of employees) m.set(e.id, e.person.full_name); return m; }, [employees]);
  const summary = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const r of attendanceRecords) { if (r.status === "present") present++; else if (r.status === "late") late++; else if (r.status === "absent") absent++; }
    return { present, late, absent };
  }, [attendanceRecords]);


  /* ── Month view ── */
  const [sheetEmployee, setSheetEmployee] = useState("");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);
  /* No setState in the effect body: "loading" is derived from whether the
     sheet on hand matches the employee + month being asked for. */
  useEffect(() => {
    if (!sheetEmployee) return;
    let cancelled = false;
    fetchAttendanceSheet(sheetEmployee, month).then((s) => { if (!cancelled && s) setSheet(s); });
    return () => { cancelled = true; };
  }, [sheetEmployee, month, sheetVersion]);
  const sheetCurrent = sheet && sheet.employeeId === sheetEmployee && sheet.month === month ? sheet : null;
  const sheetLoading = !!sheetEmployee && !sheetCurrent;

  /* ── Edit a day (Phase 1) ──
     Times are HH:MM in the EMPLOYEE's policy zone. From the month view the
     sheet is already here; from the day view the employee's sheet for that
     month is fetched first, so the form shows their zone and their day. */
  const [edit, setEdit] = useState<{ employeeId: string; name: string; date: string; tz: string; clockIn: string; clockOut: string; breakMin: number; reason: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const openEditFromSheet = (sh: AttendanceSheet, date: string, name: string) => {
    const d = sh.days.find((x) => x.date === date);
    const tz = sh.policy.timezone;
    setEditError(null);
    setEdit({ employeeId: sh.employeeId, name, date, tz, clockIn: hhmmInZone(d?.clockIn, tz), clockOut: hhmmInZone(d?.clockOut, tz), breakMin: d?.breakMinutes ?? 0, reason: "" });
  };
  const openEdit = async (employeeId: string, date: string) => {
    const sh = await fetchAttendanceSheet(employeeId, date.slice(0, 7));
    if (sh) openEditFromSheet(sh, date, nameMap.get(employeeId) || "");
  };
  const saveEdit = async () => {
    if (!edit) return;
    setEditBusy(true);
    setEditError(null);
    const res = await editAttendanceDay({ employee_id: edit.employeeId, date: edit.date, clock_in: edit.clockIn, clock_out: edit.clockOut, break_minutes: edit.breakMin, reason: edit.reason });
    setEditBusy(false);
    if (!res.ok) { setEditError(t(EDIT_ERRORS[res.error] ?? "hr.att.errSave")); return; }
    setEdit(null);
    setAttendanceRecords(await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate }));
    setSheetVersion((v) => v + 1);
    void loadQueue();
  };

  /* ── Requests: correction requests + overtime waiting for approval ── */
  const [queueOpen, setQueueOpen] = useState(false);
  const [corrections, setCorrections] = useState<{ pending: AttendanceCorrectionRow[]; recent: AttendanceCorrectionRow[] }>({ pending: [], recent: [] });
  const [overtime, setOvertime] = useState<OvertimeItem[]>([]);
  const [otMinutes, setOtMinutes] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const loadQueue = async () => {
    const [c, o] = await Promise.all([fetchAttendanceCorrections(), fetchPendingOvertime()]);
    setCorrections(c);
    setOvertime(o);
  };
  useEffect(() => { void loadQueue(); }, []);
  const queueCount = corrections.pending.length + overtime.length;
  const decideCorrection = async (id: string, decision: "approve" | "reject") => {
    setQueueBusy(id);
    await decideAttendanceCorrection(id, decision, notes[id] ?? "");
    setQueueBusy(null);
    await loadQueue();
    setSheetVersion((v) => v + 1);
    setAttendanceRecords(await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate }));
  };
  const decideOt = async (items: OvertimeItem[], decision: "approve" | "reject") => {
    setQueueBusy(items.length === 1 ? items[0].record_id : "all");
    await decideOvertime(items.map((it) => ({ record_id: it.record_id, decision, minutes: otMinutes[it.record_id] ?? it.minutes })));
    setQueueBusy(null);
    await loadQueue();
    setSheetVersion((v) => v + 1);
  };

  /* ── Employees: how each person punches ── */
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [people, setPeople] = useState<AttendanceEmployeeSetting[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const openPeople = async () => {
    setPeopleOpen(true);
    setPeopleLoading(true);
    setPeople(await fetchAttendanceEmployees());
    setPeopleLoading(false);
  };
  const savePerson = async (id: string, patch: { punch_method?: "app" | "device"; works_remote?: boolean; work_country?: string | null }) => {
    setPeople((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const ok = await saveAttendanceEmployee({ employee_id: id, ...patch });
    if (!ok) setPeople(await fetchAttendanceEmployees());
    else setSheetVersion((v) => v + 1);
  };

  /* ── Import ── */
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<AttendanceImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeImport = () => { setImportOpen(false); setCsv(""); setPreview(null); };
  const runImport = async (dryRun: boolean) => {
    setImporting(true);
    const res = await importAttendanceCsv(csv, dryRun);
    setImporting(false);
    setPreview(res);
    if (!dryRun && res.ok) {
      setSheetVersion((v) => v + 1);
      setAttendanceRecords(await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate }));
    }
  };

  /* ── Policies ── */
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [policies, setPolicies] = useState<AttendancePolicyRow[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; form: AttendancePolicyInput } | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const openPolicies = async () => { setPoliciesOpen(true); setPolicies(await fetchAttendancePolicies()); };
  const savePolicy = async () => {
    if (!editing || !editing.form.name.trim()) return;
    setPolicySaving(true);
    const ok = await saveAttendancePolicy(editing.id, { ...editing.form, country: editing.form.country || null });
    setPolicySaving(false);
    if (ok) { setEditing(null); setPolicies(await fetchAttendancePolicies()); setSheetVersion((v) => v + 1); }
  };
  const setP = <K extends keyof AttendancePolicyInput>(k: K, v: AttendancePolicyInput[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const countryLabel = (code: string | null) => { const c = code ? COUNTRIES.find((x) => x.code === code) : null; return c ? `${c.flag} ${c.name}` : t("hr.att.defaultPolicy"); };
  const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short" });
  const monthTitle = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" }); };

  const segBtn = (active: boolean) => `h-8 px-3.5 rounded-lg text-[12px] font-medium transition-colors ${active ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`;
  const iconBtn = "h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors";

  if (loading && view === "day") {
    return <div className="flex items-center justify-center py-20"><SpinnerIcon size={24} className="text-[var(--text-dim)]" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      {/* items-start: the date picker's calendar opens IN FLOW under it, and
          a centred row would slide every other control down to its middle. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 h-10">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{t("hr.attendance")}</h2>
          <div className="flex items-center gap-1">
            <button type="button" className={segBtn(view === "day")} onClick={() => setView("day")}>{t("hr.att.dayView")}</button>
            <button type="button" className={segBtn(view === "month")} onClick={() => setView("month")}>{t("hr.att.monthView")}</button>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <button type="button" className={iconBtn} onClick={() => { setQueueOpen(true); void loadQueue(); }}>
            <ClipboardCheckIcon size={14} /> {t("hr.att.requests")}
            {queueCount > 0 && <span className="ms-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[#567FB2] text-white text-[10px] font-bold tabular-nums">{queueCount}</span>}
          </button>
          <button type="button" className={iconBtn} onClick={openPeople}><UserCogIcon size={14} /> {t("hr.att.employees")}</button>
          <button type="button" className={iconBtn} onClick={() => setImportOpen(true)}><UploadIcon size={14} /> {t("hr.att.import")}</button>
          <button type="button" className={iconBtn} onClick={openPolicies}><CogIcon size={14} /> {t("hr.att.policies")}</button>
          {view === "day" && (
            <div className="w-44">
              <DatePicker value={attendanceDate} onChange={(iso) => { if (iso) setAttendanceDate(iso); }} heightCls="h-10" />
            </div>
          )}
        </div>
      </div>

      {view === "day" ? (
        <>
          <div className="flex items-center gap-5 text-[13px]">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="text-[var(--text-muted)]">{t("hr.present")}: <span className="font-semibold text-[var(--text-primary)]">{summary.present}</span></span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="text-[var(--text-muted)]">{t("hr.late")}: <span className="font-semibold text-[var(--text-primary)]">{summary.late}</span></span></div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="text-[var(--text-muted)]">{t("hr.absent")}: <span className="font-semibold text-[var(--text-primary)]">{summary.absent}</span></span></div>
          </div>
          {attendanceRecords.length === 0 ? (
            <EmptyState icon={ClockIcon} title={t("hr.noAttendanceRecords")} subtitle={`${t("hr.noRecordsFor")} ${fmtDate(attendanceDate)}`} />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
              {attendanceRecords.map((rec) => (
                <div key={rec.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0"><UserIcon size={16} className="text-[var(--text-dim)]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate mb-0.5">{nameMap.get(rec.employee_id) || "Unknown"}</div>
                    <div className="flex items-center gap-3 text-[12px] text-[var(--text-dim)]">
                      <span>{t("hr.clockIn")} {fmtTime(rec.clock_in)}</span>
                      <span>{t("hr.clockOut")} {fmtTime(rec.clock_out)}</span>
                      {rec.total_hours != null && <span className="font-medium text-[var(--text-muted)]">{rec.total_hours.toFixed(1)}h</span>}
                      {rec.source && rec.source !== "manual" && <span className="text-[var(--text-faint)]">· {rec.source}</span>}
                      {rec.auto_closed && <span className={`${chip} bg-amber-500/10 text-amber-400 border-amber-500/20`}>{t("hr.att.autoClosed")}</span>}
                      {rec.corrected && <span className={`${chip} bg-blue-500/10 text-blue-400 border-blue-500/15`}>{t("hr.att.corrected")}</span>}
                      {rec.remote && <span className={`${chip} bg-slate-500/10 text-[var(--text-dim)] border-slate-500/15`}>{t("hr.att.remote")}</span>}
                    </div>
                  </div>
                  <StatusBadge status={rec.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(rec.status)} />
                  <button type="button" onClick={() => void openEdit(rec.employee_id, rec.date)} aria-label={t("hr.att.editDay")} title={t("hr.att.editDay")}
                    className="h-8 w-8 shrink-0 rounded-lg inline-flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]">
                    <PencilIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-[320px]">
              <EmployeePicker employees={employees} value={sheetEmployee} onChange={setSheetEmployee} placeholder={t("hr.selectEmployee")} searchPlaceholder={t("hr.searchEmployees")} emptyLabel={t("hr.noEmployeesFound")} />
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Previous month"><ArrowLeftIcon size={14} className="rtl:rotate-180" /></button>
              <span className="text-[13px] font-semibold text-[var(--text-primary)] min-w-[140px] text-center">{monthTitle(month)}</span>
              <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Next month"><ArrowRightIcon size={14} className="rtl:rotate-180" /></button>
            </div>
            {sheetLoading && <SpinnerIcon size={14} className="text-[var(--text-dim)]" />}
          </div>

          {!sheetEmployee ? (
            <EmptyState icon={ClockIcon} title={t("hr.att.pickEmployee")} />
          ) : sheetCurrent ? (
            <>
              <div className="grid grid-cols-3 md:grid-cols-8 gap-2">
                {([
                  ["hr.att.workdays", sheetCurrent.summary.workdays], ["hr.att.presentDays", sheetCurrent.summary.present], ["hr.att.lateDays", sheetCurrent.summary.late],
                  ["hr.att.absentDays", sheetCurrent.summary.absent], ["hr.att.leaveDays", sheetCurrent.summary.leave], ["hr.att.hours", fmtH(sheetCurrent.summary.hours)],
                  ["hr.att.overtime", sheetCurrent.summary.overtimePendingH > 0 ? `${fmtH(sheetCurrent.summary.overtimeApprovedH)} +${fmtH(sheetCurrent.summary.overtimePendingH)}` : fmtH(sheetCurrent.summary.overtimeApprovedH)], ["hr.att.lateMinutes", sheetCurrent.summary.lateMin],
                ] as Array<[string, number | string]>).map(([k, v]) => (
                  <div key={k} className={`${cardCls} px-3 py-2`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{t(k)}</div>
                    <div className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">{v}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[var(--text-faint)]">
                {t("hr.att.policy")}: {sheetCurrent.policy.name} · {sheetCurrent.policy.workStart}–{sheetCurrent.policy.workEnd} · {sheetCurrent.policy.timezone}{sheetCurrent.country ? ` · ${countryLabel(sheetCurrent.country)}` : ""}
              </div>
              <div className={`${cardCls} overflow-hidden`}>
                <div className="hidden md:grid grid-cols-[150px_1fr_1fr_1fr_1fr_120px] gap-3 px-4 py-2 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                  <span>{t("hr.periodLabel")}</span><span>{t("hr.clockIn")}</span><span>{t("hr.clockOut")}</span><span>{t("hr.att.hours")}</span><span>{t("hr.att.overtime")}</span><span>{t("hr.status")}</span>
                </div>
                <ul className="divide-y divide-[var(--border-subtle)] max-h-[55vh] overflow-y-auto overscroll-contain">
                  {sheetCurrent.days.map((d) => (
                    <li key={d.date} className={`grid grid-cols-[1fr_auto] md:grid-cols-[150px_1fr_1fr_1fr_1fr_120px] items-center gap-3 px-4 py-2 text-[13px] ${d.status === "weekend" || d.status === "holiday" ? "opacity-60" : ""}`}>
                      <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(d.date)} <span className="text-[var(--text-dim)] font-normal">{weekday(d.date)}</span></span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockIn ? hhmmInZone(d.clockIn, sheetCurrent.policy.timezone) : d.note ?? ""}{d.lateMin > 0 ? <span className="text-amber-400"> +{d.lateMin}m</span> : null}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockOut ? hhmmInZone(d.clockOut, sheetCurrent.policy.timezone) : ""}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.hours !== null ? fmtH(d.hours) : ""}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.overtimeState ? <span className={`${chip} ${OT_CHIP[d.overtimeState]}`}>{fmtH(d.overtimeState === "approved" ? d.overtimeApprovedH : d.overtimeH)} · {tStatus(d.overtimeState)}</span> : ""}</span>
                      <span className="justify-self-end md:justify-self-start inline-flex items-center gap-1.5">
                        {d.status !== "future" && <StatusBadge status={d.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(d.status)} />}
                        {(d.status !== "future" || d.date === todayIso()) && (
                          <button type="button" onClick={() => openEditFromSheet(sheetCurrent, d.date, nameMap.get(sheetCurrent.employeeId) || "")} aria-label={t("hr.att.editDay")} title={t("hr.att.editDay")}
                            className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]">
                            <PencilIcon size={13} />
                          </button>
                        )}
                      </span>
                      {(d.autoClosed || d.corrected || d.remote) && (
                        <span className="col-span-2 md:col-span-6 flex flex-wrap gap-1.5">
                          {d.autoClosed && <span className={`${chip} bg-amber-500/10 text-amber-400 border-amber-500/20`}>{t("hr.att.autoClosed")}</span>}
                          {d.corrected && <span className={`${chip} bg-blue-500/10 text-blue-400 border-blue-500/15`}>{t("hr.att.corrected")}</span>}
                          {d.remote && <span className={`${chip} bg-slate-500/10 text-[var(--text-dim)] border-slate-500/15`}>{t("hr.att.remote")}</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* ── Import CSV ── */}
      <ModalShell open={importOpen} onClose={closeImport} title={t("hr.att.importTitle")} width="max-w-[640px]"
        footer={<>
          <button type="button" className={cancelBtnCls} onClick={closeImport}>{t("hr.close")}</button>
          <button type="button" className={cancelBtnCls} disabled={!csv.trim() || importing} onClick={() => runImport(true)}>{t("hr.att.preview")}</button>
          <button type="button" className={primaryBtnCls} disabled={!preview?.ok || !preview.dryRun || !(preview.rows ?? 0) || importing} onClick={() => runImport(false)}>{importing ? <SpinnerIcon size={13} /> : t("hr.att.importNow")}</button>
        </>}>
        <p className="text-[12px] text-[var(--text-dim)]">{t("hr.att.importHint")}</p>
        <div>
          <FieldLabel>{t("hr.att.pasteOrChoose")}</FieldLabel>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="block text-[12px] text-[var(--text-dim)] mb-2"
            onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; f.text().then((txt) => { setCsv(txt); setPreview(null); }); }} />
          <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} rows={8} className={`${textareaCls} font-mono text-[12px]`} placeholder={"employee,date,in,out,break\nEMP-007,20/09/2026,09:02,18:10,60"} />
        </div>
        {preview && (
          <div className="space-y-2 text-[13px]">
            {preview.error && <p className="text-[#FF3333]">{preview.error}</p>}
            {preview.ok && preview.dryRun && <p className="text-[var(--text-primary)] font-medium">{preview.rows} {t("hr.att.rowsReady")} · {preview.problems?.length ?? 0} {t("hr.att.problems")}</p>}
            {preview.ok && !preview.dryRun && <p className="text-[#00CC66] font-medium">{t("hr.att.imported")} {preview.imported} {t("hr.att.records")}</p>}
            {!!preview.problems?.length && (
              <ul className="max-h-40 overflow-y-auto text-[12px] text-[var(--text-dim)] space-y-0.5">
                {preview.problems.map((p, i) => <li key={i}>#{p.line}: {p.problem}</li>)}
              </ul>
            )}
          </div>
        )}
      </ModalShell>

      {/* ── Policies ── */}
      <ModalShell open={policiesOpen} onClose={() => { setPoliciesOpen(false); setEditing(null); }} title={t("hr.att.policies")} width="max-w-[640px]"
        footer={editing ? <>
          <button type="button" className={cancelBtnCls} onClick={() => setEditing(null)}>{t("hr.cancel")}</button>
          <button type="button" className={primaryBtnCls} disabled={policySaving || !editing.form.name.trim()} onClick={savePolicy}>{policySaving ? <SpinnerIcon size={13} /> : t("hr.save")}</button>
        </> : <>
          <button type="button" className={cancelBtnCls} onClick={() => setPoliciesOpen(false)}>{t("hr.close")}</button>
          <button type="button" className={primaryBtnCls} onClick={() => setEditing({ id: null, form: emptyPolicy() })}>{t("hr.att.newPolicy")}</button>
        </>}>
        <p className="text-[12px] text-[var(--text-dim)]">{t("hr.att.policiesHint")}</p>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>{t("hr.att.policyName")}</FieldLabel><input value={editing.form.name} onChange={(e) => setP("name", e.target.value)} className={inputCls} /></div>
              <div>
                <FieldLabel>{t("hr.att.country")}</FieldLabel>
                <select value={editing.form.country ?? ""} onChange={(e) => setP("country", e.target.value || null)} className={inputCls}>
                  <option value="">{t("hr.att.defaultPolicy")}</option>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>{t("hr.att.timezone")}</FieldLabel>
                <input list="kx-att-zones" value={editing.form.timezone} onChange={(e) => setP("timezone", e.target.value)} className={inputCls} />
                <datalist id="kx-att-zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>{t("hr.att.workStart")}</FieldLabel><input type="time" value={String(editing.form.work_start).slice(0, 5)} onChange={(e) => setP("work_start", e.target.value)} className={inputCls} /></div>
                <div><FieldLabel>{t("hr.att.workEnd")}</FieldLabel><input type="time" value={String(editing.form.work_end).slice(0, 5)} onChange={(e) => setP("work_end", e.target.value)} className={inputCls} /></div>
              </div>
              <div><FieldLabel>{t("hr.att.lateThreshold")}</FieldLabel><input type="number" min={0} value={editing.form.late_threshold_min} onChange={(e) => setP("late_threshold_min", Number(e.target.value) || 0)} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.att.minHours")}</FieldLabel><input type="number" min={0} step={0.5} value={editing.form.min_hours} onChange={(e) => setP("min_hours", Number(e.target.value) || 0)} className={inputCls} /></div>
            </div>
            <div>
              <FieldLabel>{t("hr.att.weekend")}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = editing.form.weekend_days.includes(d);
                  return (
                    <button key={d} type="button" onClick={() => setP("weekend_days", on ? editing.form.weekend_days.filter((x) => x !== d) : [...editing.form.weekend_days, d])}
                      className={`h-8 px-3 rounded-lg text-[12px] font-medium capitalize ${on ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface)] text-[var(--text-muted)]"}`}>{d.slice(0, 3)}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>{t("hr.att.trackingFrom")}</FieldLabel>
              <div className="w-48"><DatePicker value={editing.form.tracking_from ?? ""} onChange={(iso) => setP("tracking_from", iso || null)} heightCls="h-10" /></div>
              <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("hr.att.trackingHint")}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <input type="checkbox" checked={editing.form.is_default} onChange={(e) => setP("is_default", e.target.checked)} className="h-4 w-4" /> {t("hr.att.defaultPolicy")}
            </label>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {policies.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text-primary)]">{p.name} {p.is_default && <span className="text-[11px] text-[var(--text-dim)]">· default</span>}</div>
                  <div className="text-[12px] text-[var(--text-dim)] tabular-nums">{countryLabel(p.country)} · {String(p.work_start).slice(0, 5)}–{String(p.work_end).slice(0, 5)} · {p.timezone} · {p.late_threshold_min}m · {p.min_hours}h{p.tracking_from ? ` · ${t("hr.att.trackingFrom")} ${fmtDate(p.tracking_from)}` : ""}</div>
                </div>
                <button type="button" className="text-[12px] font-medium text-[#0066FF]" onClick={() => setEditing({ id: p.id, form: { name: p.name, country: p.country, timezone: p.timezone || "Asia/Shanghai", work_start: String(p.work_start).slice(0, 5), work_end: String(p.work_end).slice(0, 5), late_threshold_min: p.late_threshold_min, min_hours: Number(p.min_hours), weekend_days: p.weekend_days ?? [], is_default: p.is_default, tracking_from: p.tracking_from ?? null } })}>{t("hr.edit")}</button>
              </li>
            ))}
            {policies.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-[var(--text-dim)]">—</li>}
          </ul>
        )}
      </ModalShell>

      {/* ── Edit a day ── */}
      <ModalShell open={!!edit} onClose={() => setEdit(null)} title={t("hr.att.editDay")} width="max-w-[520px]"
        footer={<>
          <button type="button" className={cancelBtnCls} onClick={() => setEdit(null)}>{t("hr.cancel")}</button>
          <button type="button" className={primaryBtnCls} disabled={editBusy || !edit?.clockIn || (edit?.reason.trim().length ?? 0) < 3} onClick={saveEdit}>{editBusy ? <SpinnerIcon size={13} /> : t("hr.save")}</button>
        </>}>
        {edit && (
          <div className="space-y-3">
            <div className="text-[13px] text-[var(--text-primary)] font-medium">{edit.name} <span className="text-[var(--text-dim)] font-normal tabular-nums">· {fmtDate(edit.date)} · {edit.tz}</span></div>
            <p className="text-[12px] text-[var(--text-dim)]">{t("hr.att.editHint")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div><FieldLabel>{t("hr.clockIn")}</FieldLabel><input type="time" value={edit.clockIn} onChange={(e) => setEdit({ ...edit, clockIn: e.target.value })} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.clockOut")}</FieldLabel><input type="time" value={edit.clockOut} onChange={(e) => setEdit({ ...edit, clockOut: e.target.value })} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.att.breakMinutes")}</FieldLabel><input type="number" min={0} max={600} step={5} value={edit.breakMin} onChange={(e) => setEdit({ ...edit, breakMin: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} /></div>
            </div>
            <div>
              <FieldLabel>{t("hr.reason")}</FieldLabel>
              <textarea value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} rows={2} className={textareaCls} />
            </div>
            {editError && <p className="text-[12.5px] text-[#FF3333]">{editError}</p>}
          </div>
        )}
      </ModalShell>

      {/* ── Requests: corrections + overtime ── */}
      <ModalShell open={queueOpen} onClose={() => setQueueOpen(false)} title={t("hr.att.requests")} width="max-w-[720px]"
        footer={<button type="button" className={cancelBtnCls} onClick={() => setQueueOpen(false)}>{t("hr.close")}</button>}>
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("hr.att.corrections")}</h3>
          {corrections.pending.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)]">{t("hr.att.noPending")}</p>
          ) : (
            <ul className="space-y-2">
              {corrections.pending.map((c) => (
                <li key={c.id} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{c.employee_name}</span>
                    <span className="text-[12px] text-[var(--text-dim)] tabular-nums">{fmtDate(c.date)} · {c.timezone}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12.5px] tabular-nums">
                    <div className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">{t("hr.att.current")}</div>
                      <div className="text-[var(--text-secondary)]">{hhmmInZone(c.current?.clock_in, c.timezone) || "—"} → {hhmmInZone(c.current?.clock_out, c.timezone) || "—"}</div>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">{t("hr.att.requested")}</div>
                      <div className="text-[var(--text-primary)] font-medium">{hhmmInZone(c.clock_in, c.timezone) || "—"} → {hhmmInZone(c.clock_out, c.timezone) || "—"}</div>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-[var(--text-secondary)]"><span className="text-[var(--text-dim)]">{t("hr.reason")}:</span> {c.reason}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={notes[c.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} placeholder={t("hr.att.note")} className={`${inputCls} !h-8 flex-1 min-w-[160px] text-[12.5px]`} />
                    <div className="ms-auto inline-flex items-center gap-2">
                      <button type="button" className={cancelBtnCls + " !h-8 !px-3 text-[12px]"} disabled={queueBusy === c.id} onClick={() => void decideCorrection(c.id, "reject")}>{t("hr.reject")}</button>
                      <button type="button" className={primaryBtnCls + " !h-8 !px-3 text-[12px]"} disabled={queueBusy === c.id} onClick={() => void decideCorrection(c.id, "approve")}>{queueBusy === c.id ? <SpinnerIcon size={12} /> : t("hr.approve")}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("hr.att.overtime")}</h3>
            {overtime.length > 1 && (
              <button type="button" className="text-[12px] font-medium text-[#0066FF] disabled:opacity-50" disabled={queueBusy === "all"} onClick={() => void decideOt(overtime, "approve")}>{t("hr.att.approveAll")}</button>
            )}
          </div>
          {overtime.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)]">{t("hr.att.noPending")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
              {overtime.map((o) => (
                <li key={o.record_id} className="px-3 py-2.5 text-[12.5px] space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium text-[var(--text-primary)]">{o.employee_name}</span>
                    <span className="text-[var(--text-dim)] tabular-nums">{fmtDate(o.date)} · {hhmmInZone(o.clock_in, o.timezone)} → {hhmmInZone(o.clock_out, o.timezone)} · {t("hr.att.overtimeAfter")} {String(o.work_end).slice(0, 5)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[var(--text-dim)]">
                      <input type="number" min={0} max={o.minutes} step={5} value={otMinutes[o.record_id] ?? o.minutes}
                        onChange={(e) => setOtMinutes((m) => ({ ...m, [o.record_id]: Math.min(o.minutes, Math.max(0, Number(e.target.value) || 0)) }))}
                        className={`${inputCls} !h-8 !w-20 text-[12.5px] tabular-nums`} aria-label={t("hr.att.minutesShort")} />
                      <span>{t("hr.att.minutesShort")}</span>
                    </label>
                    <span className="text-[var(--text-secondary)] tabular-nums">{fmtMinutes(otMinutes[o.record_id] ?? o.minutes)}</span>
                    <div className="ms-auto inline-flex items-center gap-2">
                      <button type="button" className={cancelBtnCls + " !h-8 !px-3 text-[12px]"} disabled={!!queueBusy} onClick={() => void decideOt([o], "reject")}>{t("hr.reject")}</button>
                      <button type="button" className={primaryBtnCls + " !h-8 !px-3 text-[12px]"} disabled={!!queueBusy} onClick={() => void decideOt([o], "approve")}>{queueBusy === o.record_id ? <SpinnerIcon size={12} /> : t("hr.approve")}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {corrections.recent.length > 0 && (
          <section className="space-y-2 pt-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("hr.att.history")}</h3>
            <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] max-h-64 overflow-y-auto">
              {corrections.recent.map((c) => (
                <li key={c.id} className="px-3 py-2 text-[12.5px] space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{c.employee_name}</span>
                    <span className="text-[var(--text-dim)] tabular-nums">{fmtDate(c.date)}</span>
                    <span className={`${chip} bg-slate-500/10 text-[var(--text-dim)] border-slate-500/15`}>{t(c.kind === "edit" ? "hr.att.kindEdit" : "hr.att.kindRequest")}</span>
                    {c.kind === "request" && <StatusBadge status={c.status} map={LEAVE_STATUS_MAP} label={tStatus(c.status)} />}
                    <span className="text-[var(--text-secondary)] tabular-nums">{hhmmInZone(c.clock_in, c.timezone) || "—"} → {hhmmInZone(c.clock_out, c.timezone) || "—"}</span>
                  </div>
                  <div className="text-[var(--text-dim)]">{c.reason}{c.decision_note ? ` · ${c.decision_note}` : ""}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ModalShell>

      {/* ── Employees: how each person punches ── */}
      <ModalShell open={peopleOpen} onClose={() => setPeopleOpen(false)} title={t("hr.att.employees")} width="max-w-[720px]"
        footer={<button type="button" className={cancelBtnCls} onClick={() => setPeopleOpen(false)}>{t("hr.close")}</button>}>
        <p className="text-[12px] text-[var(--text-dim)]">{t("hr.att.employeesHint")}</p>
        <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
          {people.map((p) => (
            <li key={p.id} className="px-3 py-3 space-y-2">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">{p.name}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="inline-flex rounded-lg bg-[var(--bg-surface)] p-0.5" role="group" aria-label={t("hr.att.punchMethod")}>
                  {(["app", "device"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={p.punch_method === m} onClick={() => { if (p.punch_method !== m) void savePerson(p.id, { punch_method: m }); }}
                      className={`h-8 px-3 rounded-md text-[12px] font-medium ${p.punch_method === m ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-muted)]"}`}>
                      {t(m === "app" ? "hr.att.methodApp" : "hr.att.methodDevice")}
                    </button>
                  ))}
                </div>
                {/* The Hub switch (role="switch" — Aurora styles it by role). */}
                <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--text-secondary)] cursor-pointer">
                  <button type="button" role="switch" aria-checked={p.works_remote} onClick={() => void savePerson(p.id, { works_remote: !p.works_remote })}
                    className={`relative h-6 w-11 rounded-full shrink-0 transition-colors duration-200 ${p.works_remote ? "bg-emerald-500" : "bg-[var(--border-color,#6b7280)]"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${p.works_remote ? "start-[22px]" : "start-0.5"}`} />
                  </button>
                  {t("hr.att.worksOutside")}
                </label>
                <select value={p.work_country ?? ""} onChange={(e) => void savePerson(p.id, { work_country: e.target.value || null })} className={`${inputCls} !h-8 !w-44 text-[12.5px] ms-auto`} aria-label={t("hr.att.workCountry")}>
                  <option value="">{t("hr.att.workCountry")}</option>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
              </div>
            </li>
          ))}
          {peopleLoading && people.length === 0 && <li className="px-4 py-6 flex justify-center"><SpinnerIcon size={16} /></li>}
        </ul>
      </ModalShell>
    </div>
  );
}

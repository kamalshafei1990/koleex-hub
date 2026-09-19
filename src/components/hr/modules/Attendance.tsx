"use client";

/* ---------------------------------------------------------------------------
   Attendance — two readings of the same records.

   Day  — who punched today (the original view): one date, every record,
          clock-out on behalf of someone who forgot.
   Month — one employee, every day accounted for (Phase C): weekend, public
          holiday, approved leave, present, late, absent — derived on the
          server by attendance-sheet.ts so HR and the employee read the same
          sheet at /me.

   Plus the two things a real attendance desk needs: importing the
   fingerprint device's CSV export, and the per-country policy (hours,
   timezone, late threshold, weekend fallback) that late/overtime derive
   from. Weekend and public holidays themselves come from the Calendar app's
   holidays for the employee's work country.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo, useRef } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  EmptyState, StatusBadge, ModalShell, FieldLabel, fmtDate, fmtTime,
  ATTENDANCE_STATUS_MAP, makeTranslationHelpers, primaryBtnCls, cancelBtnCls, inputCls, textareaCls, cardCls,
} from "@/components/hr/shared";
import {
  fetchAttendanceRecords, clockOut, fetchAttendanceSheet, importAttendanceCsv, fetchAttendancePolicies, saveAttendancePolicy,
  type AttendanceSheet, type AttendanceImportResult, type AttendancePolicyInput,
} from "@/lib/hr-admin";
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

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const ZONES = ["Asia/Shanghai", "Africa/Cairo", "Asia/Dubai", "Asia/Riyadh", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Kolkata", "Asia/Ho_Chi_Minh", "Asia/Jakarta", "UTC"];
const todayIso = () => new Date().toISOString().split("T")[0];
const shiftMonth = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + by, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const fmtH = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 10) / 10} h`);

const emptyPolicy = (): AttendancePolicyInput => ({
  name: "", country: null, timezone: "Asia/Shanghai", work_start: "09:00", work_end: "18:00",
  late_threshold_min: 15, min_hours: 8, weekend_days: ["saturday", "sunday"], is_default: false,
});

export default function AttendanceModule({ employees, t, lang }: HRModuleProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const [view, setView] = useState<"day" | "month">("day");

  /* ── Day view ── */
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleClockOut = async (empId: string) => {
    setSaving(true);
    await clockOut(empId);
    setAttendanceRecords(await fetchAttendanceRecords({ date_from: attendanceDate, date_to: attendanceDate }));
    setSaving(false);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{t("hr.attendance")}</h2>
          <div className="flex items-center gap-1">
            <button type="button" className={segBtn(view === "day")} onClick={() => setView("day")}>{t("hr.att.dayView")}</button>
            <button type="button" className={segBtn(view === "month")} onClick={() => setView("month")}>{t("hr.att.monthView")}</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                      <span>{t("hr.clockIn")}: {fmtTime(rec.clock_in)}</span>
                      <span>{t("hr.clockOut")}: {fmtTime(rec.clock_out)}</span>
                      {rec.total_hours != null && <span className="font-medium text-[var(--text-muted)]">{rec.total_hours.toFixed(1)}h</span>}
                      {rec.source && rec.source !== "manual" && <span className="text-[var(--text-faint)]">· {rec.source}</span>}
                    </div>
                  </div>
                  <StatusBadge status={rec.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(rec.status)} />
                  {!rec.clock_out && (
                    <button className={primaryBtnCls + " !h-8 !px-3 text-[12px] shrink-0"} disabled={saving} onClick={() => handleClockOut(rec.employee_id)}>{t("hr.clockOutBtn")}</button>
                  )}
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
                  ["hr.att.overtime", fmtH(sheetCurrent.summary.overtimeH)], ["hr.att.lateMinutes", sheetCurrent.summary.lateMin],
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
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockIn ? fmtTime(d.clockIn) : d.note ?? ""}{d.lateMin > 0 ? <span className="text-amber-400"> +{d.lateMin}m</span> : null}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockOut ? fmtTime(d.clockOut) : ""}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.hours !== null ? fmtH(d.hours) : ""}</span>
                      <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.overtimeH > 0 ? fmtH(d.overtimeH) : ""}</span>
                      <span className="justify-self-end md:justify-self-start">{d.status !== "future" && <StatusBadge status={d.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(d.status)} />}</span>
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
                  <div className="text-[12px] text-[var(--text-dim)] tabular-nums">{countryLabel(p.country)} · {String(p.work_start).slice(0, 5)}–{String(p.work_end).slice(0, 5)} · {p.timezone} · {p.late_threshold_min}m · {p.min_hours}h</div>
                </div>
                <button type="button" className="text-[12px] font-medium text-[#0066FF]" onClick={() => setEditing({ id: p.id, form: { name: p.name, country: p.country, timezone: p.timezone || "Asia/Shanghai", work_start: String(p.work_start).slice(0, 5), work_end: String(p.work_end).slice(0, 5), late_threshold_min: p.late_threshold_min, min_hours: Number(p.min_hours), weekend_days: p.weekend_days ?? [], is_default: p.is_default } })}>{t("hr.edit")}</button>
              </li>
            ))}
            {policies.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-[var(--text-dim)]">—</li>}
          </ul>
        )}
      </ModalShell>
    </div>
  );
}

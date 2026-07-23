"use client";

/* ---------------------------------------------------------------------------
   LeaveManagement — Leave requests module for the HR application.
   Handles viewing, creating, filtering, and reviewing leave requests.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import { useCurrentAccount } from "@/lib/identity";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  StatusBadge,
  inputCls,
  textareaCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  dangerBtnCls,
  fmtDate,
  LEAVE_STATUS_MAP,
  makeTranslationHelpers,
  EmployeeLink,
} from "@/components/hr/shared";
import EmployeePicker, { EmployeeAvatar, employeeRoleLine } from "@/components/hr/EmployeePicker";
import HrFileField, { resolveHrFileUrl } from "@/components/hr/HrFileField";
import TranslatableText from "@/components/hr/TranslatableText";
import DatePicker from "@/components/ui/DatePicker";
import PersonName from "@/components/ui/PersonName";
import {
  fetchLeaveRequests,
  fetchLeaveTypes,
  fetchLeaveBalances,
  createLeaveRequest,
  reviewLeaveRequest,
  type LeaveRequestWithName,
} from "@/lib/hr-admin";
import type { LeaveTypeRow, LeaveBalanceRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";

/* ── Date maths for the live request summary ──
   Mirrors computeBusinessDays() in hr-admin (the value the server actually
   stores) so the operator sees the same number before submitting. Dates are
   parsed as LOCAL midnight — new Date("2026-07-23") is UTC and rolls back a
   day in negative offsets, which would silently shift every count. */
function parseLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function countDays(start: string, end: string): { working: number; calendar: number } | null {
  const s = parseLocal(start);
  const e = parseLocal(end);
  if (!s || !e || e < s) return null;
  let working = 0;
  let calendar = 0;
  const cur = new Date(s);
  while (cur <= e) {
    calendar++;
    const d = cur.getDay();
    if (d !== 0 && d !== 6) working++;
    cur.setDate(cur.getDate() + 1);
  }
  return { working, calendar };
}

/* ═══════════════════════════════════════════════════
   LEAVE MANAGEMENT MODULE
   ═══════════════════════════════════════════════════ */

export default function LeaveManagement({ employees, t, lang }: HRModuleProps) {
  const { account } = useCurrentAccount();
  /* ── Translation helpers ── */
  const { tStatus, tLeaveType } = makeTranslationHelpers(t);

  /* ── State ── */
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithName[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    half_day: false,
    half_day_period: "",
    attachment_url: "",
    contact_phone: "",
    contact_address: "",
    destination: "",
    handover_to: "",
    handover_notes: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [balances, setBalances] = useState<(LeaveBalanceRow & { leave_type_name: string })[] | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestWithName | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Data loading ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [requests, types] = await Promise.all([
        fetchLeaveRequests(),
        fetchLeaveTypes(),
      ]);
      if (!cancelled) {
        setLeaveRequests(requests);
        setLeaveTypes(types);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Selected employee's balances for this year ──
     Loaded only once someone is picked (and only in the create modal), so the
     module still opens with a single round-trip. */
  useEffect(() => {
    const empId = leaveForm.employee_id;
    if (!showLeaveModal || !empId) { setBalances(null); return; }
    let cancelled = false;
    setBalancesLoading(true);
    fetchLeaveBalances(empId, new Date().getFullYear()).then((rows) => {
      if (cancelled) return;
      setBalances(rows);
      setBalancesLoading(false);
    });
    return () => { cancelled = true; };
  }, [showLeaveModal, leaveForm.employee_id]);

  /* ── Live request maths (mirrors what the server will store) ── */
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === leaveForm.employee_id) ?? null,
    [employees, leaveForm.employee_id],
  );

  const dateError =
    !!leaveForm.start_date && !!leaveForm.end_date && leaveForm.end_date < leaveForm.start_date;

  const isSingleDay =
    !!leaveForm.start_date && leaveForm.start_date === leaveForm.end_date;

  const span = useMemo(
    () => (dateError ? null : countDays(leaveForm.start_date, leaveForm.end_date)),
    [leaveForm.start_date, leaveForm.end_date, dateError],
  );

  /* half_day makes the request 0.5 days — only meaningful on a single date.
     The old form let it be ticked on a two-week range, which silently booked
     half a day off for the whole period. */
  const requestedDays = leaveForm.half_day && isSingleDay ? 0.5 : span?.working ?? 0;

  const selectedBalance = useMemo(
    () => balances?.find((b) => b.leave_type_id === leaveForm.leave_type_id) ?? null,
    [balances, leaveForm.leave_type_id],
  );

  const balanceRemaining = selectedBalance
    ? selectedBalance.entitled + selectedBalance.carried_over + selectedBalance.adjustment - selectedBalance.used
    : null;
  const balanceAfter = balanceRemaining === null ? null : balanceRemaining - requestedDays;

  /* Untick half day as soon as the range stops being a single date, so the
     checkbox never sits on while having no effect. */
  useEffect(() => {
    if (!isSingleDay && leaveForm.half_day) {
      setLeaveForm((f) => ({ ...f, half_day: false }));
    }
  }, [isSingleDay, leaveForm.half_day]);

  /* Requests by the same person that overlap the chosen range. Double-booking
     leave is the mistake this catches, and it costs nothing extra — the list
     is already loaded. Cancelled/rejected rows don't count as a clash. */
  const overlapping = useMemo(() => {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date || dateError) {
      return [];
    }
    return leaveRequests.filter(
      (r) =>
        r.employee_id === leaveForm.employee_id &&
        (r.status === "pending" || r.status === "approved") &&
        r.start_date <= leaveForm.end_date &&
        r.end_date >= leaveForm.start_date,
    );
  }, [leaveRequests, leaveForm.employee_id, leaveForm.start_date, leaveForm.end_date, dateError]);

  /* Who else from the same department is already off in that window — the
     question a manager asks before approving, and it was nowhere in the UI. */
  const teamAway = useMemo(() => {
    if (!selectedEmployee || !leaveForm.start_date || !leaveForm.end_date || dateError) return [];
    const dept = selectedEmployee.department_id;
    if (!dept) return [];
    const sameDept = new Set(
      employees.filter((e) => e.department_id === dept && e.id !== selectedEmployee.id).map((e) => e.id),
    );
    return leaveRequests.filter(
      (r) =>
        sameDept.has(r.employee_id) &&
        r.status === "approved" &&
        r.start_date <= leaveForm.end_date &&
        r.end_date >= leaveForm.start_date,
    );
  }, [employees, leaveRequests, selectedEmployee, leaveForm.start_date, leaveForm.end_date, dateError]);

  const canSubmitLeave =
    !!leaveForm.employee_id &&
    !!leaveForm.leave_type_id &&
    !!leaveForm.start_date &&
    !!leaveForm.end_date &&
    !dateError;

  /* ── Filtering ── */
  const filteredLeaves = useMemo(
    () =>
      leaveFilter === "all"
        ? leaveRequests
        : leaveRequests.filter((r) => r.status === leaveFilter),
    [leaveRequests, leaveFilter],
  );

  /* ── Actions ── */
  const reloadRequests = async () => {
    const requests = await fetchLeaveRequests();
    setLeaveRequests(requests);
  };

  const resetLeaveForm = () =>
    setLeaveForm({
      employee_id: "", leave_type_id: "", start_date: "", end_date: "",
      reason: "", half_day: false, half_day_period: "", attachment_url: "",
      contact_phone: "", contact_address: "", destination: "",
      handover_to: "", handover_notes: "",
      emergency_contact_name: "", emergency_contact_phone: "",
    });

  /** "" → null, so an untouched optional field stays NULL rather than empty
   *  string — the difference between "not provided" and "provided as blank". */
  const orNull = (v: string) => v.trim() || null;

  const handleCreateLeave = async () => {
    if (!canSubmitLeave) return;
    setSaving(true);
    await createLeaveRequest({
      employee_id: leaveForm.employee_id,
      leave_type_id: leaveForm.leave_type_id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason || null,
      /* Never send half_day on a multi-day range — the server would store
         0.5 days for the whole period. */
      half_day: leaveForm.half_day && isSingleDay,
      half_day_period:
        leaveForm.half_day && isSingleDay ? orNull(leaveForm.half_day_period) : null,
      attachment_url: orNull(leaveForm.attachment_url),
      contact_phone: orNull(leaveForm.contact_phone),
      contact_address: orNull(leaveForm.contact_address),
      destination: orNull(leaveForm.destination),
      handover_to: leaveForm.handover_to || null,
      handover_notes: orNull(leaveForm.handover_notes),
      emergency_contact_name: orNull(leaveForm.emergency_contact_name),
      emergency_contact_phone: orNull(leaveForm.emergency_contact_phone),
      /* Who filed it — the signed-in employee, not the person it is for. */
      requested_by: account?.employee?.id ?? null,
    });
    await reloadRequests();
    resetLeaveForm();
    setShowLeaveModal(false);
    setSaving(false);
  };

  const handleReviewLeave = async (id: string, status: "approved" | "rejected") => {
    setSaving(true);
    /* reviewed_by is a uuid FK to koleex_employees — the old literal
       "admin" failed the cast (invisible while writes were RLS-dead). Use
       the signed-in user's employee record; null-safe because the column
       is nullable and the server keeps working for non-employee admins. */
    await reviewLeaveRequest(id, status, account?.employee?.id ?? null, reviewNotes || undefined);
    await reloadRequests();
    setSelectedLeave(null);
    setReviewNotes("");
    setSaving(false);
  };

  /* ── Filter options ── */
  const filterOptions = [
    { key: "all", label: t("hr.all") },
    { key: "pending", label: t("hr.pending") },
    { key: "approved", label: t("hr.approved") },
    { key: "rejected", label: t("hr.rejected") },
  ];

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon size={24} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {t("hr.leaveRequests")}
        </h2>
        <button className={primaryBtnCls + " flex items-center gap-2"} onClick={() => setShowLeaveModal(true)}>
          <PlusIcon size={14} />
          {t("hr.newRequest")}
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setLeaveFilter(opt.key)}
            className={`h-8 px-3.5 rounded-lg text-[12px] font-medium transition-colors ${
              leaveFilter === opt.key
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Leave requests list */}
      {filteredLeaves.length === 0 ? (
        <EmptyState
          icon={CalendarPlusIcon}
          title={t("hr.noLeaveRequests")}
          subtitle={t("hr.createLeaveSubtitle")}
        />
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
          {filteredLeaves.map((req) => {
            const days = req.days;
            const isPending = req.status === "pending";
            const emp = employees.find((e) => e.id === req.employee_id) ?? null;

            return (
              <button
                key={req.id}
                onClick={() => {
                  if (isPending) {
                    setSelectedLeave(req);
                    setReviewNotes("");
                  }
                }}
                disabled={!isPending}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] transition-colors text-left ${
                  isPending ? "hover:bg-[var(--bg-surface)] cursor-pointer" : "cursor-default"
                }`}
              >
                {/* Avatar — the real photo when the person is in the list */}
                {emp ? (
                  <EmployeeAvatar employee={emp} size={36} />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      <EmployeeLink id={req.employee_id} name={req.employee_name} />
                    </span>
                    {emp?.person.name_alt && (
                      <span lang="zh" className="text-[12px] text-[var(--text-dim)] truncate shrink-0">
                        {emp.person.name_alt}
                      </span>
                    )}
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">
                      {tLeaveType(req.leave_type_name, req.leave_type_code)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
                    <span>{fmtDate(req.start_date)} — {fmtDate(req.end_date)}</span>
                    <span className="text-[var(--text-dim)]">·</span>
                    <span>
                      {days} {days === 1 ? t("hr.day") : t("hr.days")}
                    </span>
                    {req.half_day && (
                      <>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span className="text-blue-400">{t("hr.halfDay")}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={req.status} map={LEAVE_STATUS_MAP} label={tStatus(req.status)} />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Review Leave Modal ── */}
      <ModalShell
        open={!!selectedLeave}
        onClose={() => { setSelectedLeave(null); setReviewNotes(""); }}
        title={t("hr.reviewLeaveRequest")}
        footer={
          <>
            <button
              className={dangerBtnCls}
              disabled={saving}
              onClick={() => selectedLeave && handleReviewLeave(selectedLeave.id, "rejected")}
            >
              {t("hr.reject")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={saving}
              onClick={() => selectedLeave && handleReviewLeave(selectedLeave.id, "approved")}
            >
              {t("hr.approve")}
            </button>
          </>
        }
      >
        {selectedLeave && (
          <div className="space-y-3">
            <div>
              <FieldLabel>{t("hr.employeeLabel")}</FieldLabel>
              {(() => {
                const emp = employees.find((e) => e.id === selectedLeave.employee_id) ?? null;
                if (!emp) {
                  return <div className="text-[13px] text-[var(--text-primary)]">{selectedLeave.employee_name}</div>;
                }
                const role = employeeRoleLine(emp);
                return (
                  <div className="flex items-center gap-2.5">
                    <EmployeeAvatar employee={emp} size={34} />
                    <div className="min-w-0">
                      <PersonName
                        name={emp.person.full_name}
                        alt={emp.person.name_alt}
                        nameClassName="text-[13px] font-medium text-[var(--text-primary)] truncate block"
                        altClassName="text-[11px] text-[var(--text-dim)] truncate block"
                      />
                      {role && <div className="text-[11px] text-[var(--text-dim)] truncate">{role}</div>}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <FieldLabel>{t("hr.typeLabel")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-primary)]">{tLeaveType(selectedLeave.leave_type_name, selectedLeave.leave_type_code)}</div>
            </div>
            <div>
              <FieldLabel>{t("hr.periodLabel")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-primary)]">
                {fmtDate(selectedLeave.start_date)} — {fmtDate(selectedLeave.end_date)}{" "}
                ({selectedLeave.days} {selectedLeave.days === 1 ? t("hr.day") : t("hr.days")})
                {selectedLeave.half_day && (
                  <span className="ml-2 text-blue-400">
                    ({t("hr.halfDayLabel")}
                    {selectedLeave.half_day_period
                      ? ` — ${t(`hr.${selectedLeave.half_day_period}`)}`
                      : ""}
                    )
                  </span>
                )}
              </div>
            </div>
            {selectedLeave.reason && (
              <div>
                <FieldLabel>{t("hr.reasonLabel")}</FieldLabel>
                {/* The reviewer often doesn't read the language the reason was
                    written in — one tap renders it in theirs. */}
                <TranslatableText
                  text={selectedLeave.reason}
                  viewerLang={lang}
                  className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap"
                  translateLabel={t("hr.translate")}
                  showOriginalLabel={t("hr.showOriginal")}
                  translatedNote={t("hr.machineTranslated")}
                  failedLabel={t("hr.translateFailed")}
                />
              </div>
            )}
            {selectedLeave.attachment_url && (
              <div>
                <FieldLabel>{t("hr.attachment")}</FieldLabel>
                {/* New uploads are PRIVATE storage paths, not URLs — resolve a
                    short-lived signed URL on click. resolveHrFileUrl passes a
                    legacy https:// value straight through. */}
                <button
                  type="button"
                  onClick={async () => {
                    const url = await resolveHrFileUrl(selectedLeave.attachment_url!);
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline break-all"
                >
                  <PaperclipIcon size={13} className="shrink-0" />
                  {t("hr.openAttachment")}
                </button>
              </div>
            )}
            {/* Cover — who is picking the work up */}
            {(selectedLeave.handover_to || selectedLeave.handover_notes) && (
              <div>
                <FieldLabel>{t("hr.coverSection")}</FieldLabel>
                {selectedLeave.handover_to && (() => {
                  const cover = employees.find((e) => e.id === selectedLeave.handover_to);
                  return (
                    <div className="text-[13px] text-[var(--text-primary)]">
                      {cover
                        ? <PersonName name={cover.person.full_name} alt={cover.person.name_alt} />
                        : t("hr.handoverUnknown")}
                    </div>
                  );
                })()}
                {selectedLeave.handover_notes && (
                  <div className="mt-1 text-[12px] text-[var(--text-muted)] whitespace-pre-wrap">
                    {selectedLeave.handover_notes}
                  </div>
                )}
              </div>
            )}

            {/* Reachability — the answers to "where are they / how do I call" */}
            {(selectedLeave.contact_phone || selectedLeave.destination || selectedLeave.contact_address) && (
              <div>
                <FieldLabel>{t("hr.whileAwaySection")}</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)] space-y-0.5">
                  {selectedLeave.contact_phone && <div>{selectedLeave.contact_phone}</div>}
                  {selectedLeave.destination && <div>{selectedLeave.destination}</div>}
                  {selectedLeave.contact_address && (
                    <div className="text-[12px] text-[var(--text-muted)]">{selectedLeave.contact_address}</div>
                  )}
                </div>
              </div>
            )}

            {(selectedLeave.emergency_contact_name || selectedLeave.emergency_contact_phone) && (
              <div>
                <FieldLabel>{t("hr.emergencySection")}</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)]">
                  {[selectedLeave.emergency_contact_name, selectedLeave.emergency_contact_phone]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            )}

            {selectedLeave.created_at && (
              <div>
                <FieldLabel>{t("hr.submittedOn")}</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)]">
                  {fmtDate(selectedLeave.created_at)}
                  {/* Whether the person filed it themselves or HR did it for
                      them — relevant when chasing up a request. */}
                  {selectedLeave.requested_by &&
                    selectedLeave.requested_by !== selectedLeave.employee_id && (
                      <span className="ms-2 text-[11px] text-[var(--text-dim)]">
                        {t("hr.filedOnBehalf")}
                      </span>
                    )}
                </div>
              </div>
            )}
            <div>
              <FieldLabel>{t("hr.reviewNotes")}</FieldLabel>
              <textarea
                className={textareaCls}
                rows={3}
                placeholder={t("hr.optionalNotes")}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </ModalShell>

      {/* ── Create Leave Modal ── */}
      <ModalShell
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title={t("hr.newLeaveRequest")}
        width="max-w-[580px]"
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowLeaveModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={saving || !canSubmitLeave}
              onClick={handleCreateLeave}
            >
              {t("hr.submit")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Employee — photo + English and native name + role */}
          <div>
            <FieldLabel>{t("hr.employee")}</FieldLabel>
            <EmployeePicker
              employees={employees}
              value={leaveForm.employee_id}
              onChange={(id) => setLeaveForm((f) => ({ ...f, employee_id: id }))}
              placeholder={t("hr.selectEmployee")}
              searchPlaceholder={t("hr.searchEmployees")}
              emptyLabel={t("hr.noEmployeesFound")}
            />
            {selectedEmployee && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-dim)]">
                {employeeRoleLine(selectedEmployee) && (
                  <span>{employeeRoleLine(selectedEmployee)}</span>
                )}
                {selectedEmployee.employee_number && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)]">
                    {selectedEmployee.employee_number}
                  </span>
                )}
                {selectedEmployee.work_email && <span>{selectedEmployee.work_email}</span>}
              </div>
            )}
          </div>

          {/* Leave type */}
          <div>
            <FieldLabel>{t("hr.leaveType")}</FieldLabel>
            <select
              className={selectCls}
              value={leaveForm.leave_type_id}
              onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type_id: e.target.value }))}
            >
              <option value="">{t("hr.selectType")}</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {tLeaveType(lt.name, lt.code)}
                </option>
              ))}
            </select>
          </div>

          {/* Dates — side by side on desktop, stacked on mobile.
              The end picker cannot go before the start date. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <FieldLabel>{t("hr.startDate")}</FieldLabel>
              <DatePicker
                value={leaveForm.start_date}
                onChange={(iso) =>
                  setLeaveForm((f) => ({
                    ...f,
                    start_date: iso,
                    /* Keep the range coherent: an end date that now sits
                       before the new start is cleared rather than left wrong. */
                    end_date: f.end_date && iso && f.end_date < iso ? "" : f.end_date,
                  }))
                }
                placeholder={t("hr.pickDate")}
                lang={lang}
                heightCls="h-10"
              />
            </div>
            <div>
              <FieldLabel>{t("hr.endDate")}</FieldLabel>
              <DatePicker
                value={leaveForm.end_date}
                onChange={(iso) => setLeaveForm((f) => ({ ...f, end_date: iso }))}
                placeholder={t("hr.pickDate")}
                lang={lang}
                min={leaveForm.start_date || undefined}
                heightCls="h-10"
              />
            </div>
          </div>

          {/* Live summary — what will actually be booked */}
          {dateError ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              <InfoIcon size={13} className="mt-0.5 shrink-0" />
              <span>{t("hr.endBeforeStart")}</span>
            </div>
          ) : span ? (
            <div className="px-3.5 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  {t("hr.duration")}
                </span>
                <span className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {requestedDays} {requestedDays === 1 ? t("hr.day") : t("hr.days")}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-dim)]">
                {fmtDate(leaveForm.start_date)} — {fmtDate(leaveForm.end_date)} ·{" "}
                {span.calendar} {t("hr.calendarDays")} ·{" "}
                {span.working} {span.working === 1 ? t("hr.workingDay") : t("hr.workingDays")}
              </div>

              {/* Balance for the chosen type */}
              {leaveForm.leave_type_id && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  {balancesLoading ? (
                    <div className="text-[11px] text-[var(--text-dim)]">{t("hr.loadingBalance")}</div>
                  ) : selectedBalance && balanceRemaining !== null ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t("hr.entitled")}</div>
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                            {selectedBalance.entitled + selectedBalance.carried_over + selectedBalance.adjustment}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t("hr.used")}</div>
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{selectedBalance.used}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t("hr.remaining")}</div>
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{balanceRemaining}</div>
                        </div>
                      </div>
                      <div className={`mt-2 text-[11px] ${balanceAfter !== null && balanceAfter < 0 ? "text-amber-400" : "text-[var(--text-dim)]"}`}>
                        {balanceAfter !== null && balanceAfter < 0
                          ? t("hr.exceedsBalance")
                          : `${t("hr.afterThisRequest")}: ${balanceAfter}`}
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-[var(--text-dim)]">{t("hr.noBalanceConfigured")}</div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Clash with this person's own leave — the mistake worth catching */}
          {overlapping.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
              <InfoIcon size={13} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">{t("hr.overlapWarning")}</div>
                <ul className="mt-1 space-y-0.5 text-[11px] opacity-90">
                  {overlapping.map((r) => (
                    <li key={r.id}>
                      {tLeaveType(r.leave_type_name, r.leave_type_code)} ·{" "}
                      {fmtDate(r.start_date)} — {fmtDate(r.end_date)} · {tStatus(r.status)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Who else in the department is already away — coverage at a glance */}
          {teamAway.length > 0 && (
            <div className="px-3.5 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                {t("hr.teamAway")}
              </div>
              <ul className="space-y-0.5 text-[11px] text-[var(--text-muted)]">
                {teamAway.map((r) => (
                  <li key={r.id}>
                    {r.employee_name} · {fmtDate(r.start_date)} — {fmtDate(r.end_date)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Half day — only meaningful on a single date */}
          <label className={`flex items-center gap-2 ${isSingleDay ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <input
              type="checkbox"
              disabled={!isSingleDay}
              checked={leaveForm.half_day}
              onChange={(e) => setLeaveForm((f) => ({ ...f, half_day: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--bg-inverted)]"
            />
            <span className="text-[13px] text-[var(--text-primary)]">{t("hr.halfDayLabel")}</span>
            {!isSingleDay && (
              <span className="text-[11px] text-[var(--text-dim)]">— {t("hr.halfDaySingleDayOnly")}</span>
            )}
          </label>

          {/* Which half — "0.5 days" alone cannot be rostered against */}
          {leaveForm.half_day && isSingleDay && (
            <div className="flex items-center gap-2">
              {(["morning", "afternoon"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLeaveForm((f) => ({ ...f, half_day_period: p }))}
                  className={`h-8 px-3.5 rounded-lg text-[12px] font-medium transition-colors ${
                    leaveForm.half_day_period === p
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(`hr.${p}`)}
                </button>
              ))}
            </div>
          )}

          {/* Reason */}
          <div>
            <FieldLabel>{t("hr.reason")}</FieldLabel>
            <textarea
              className={textareaCls}
              rows={3}
              placeholder={t("hr.optionalReason")}
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>

          {/* ── Cover ── who picks the work up, and what they need to know.
              A leave request that doesn't say this leaves the manager to
              work it out by asking around. */}
          <div className="pt-1 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] pt-3 pb-2">
              {t("hr.coverSection")}
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>{t("hr.handoverTo")}</FieldLabel>
                <EmployeePicker
                  employees={employees.filter((e) => e.id !== leaveForm.employee_id)}
                  value={leaveForm.handover_to}
                  onChange={(id) => setLeaveForm((f) => ({ ...f, handover_to: id }))}
                  placeholder={t("hr.handoverNobody")}
                  searchPlaceholder={t("hr.searchEmployees")}
                  emptyLabel={t("hr.noEmployeesFound")}
                />
              </div>
              <div>
                <FieldLabel>{t("hr.handoverNotes")}</FieldLabel>
                <textarea
                  className={textareaCls}
                  rows={2}
                  placeholder={t("hr.handoverNotesPlaceholder")}
                  value={leaveForm.handover_notes}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, handover_notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* ── Reachability ── where they are and how to reach them */}
          <div className="pt-1 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] pt-3 pb-2">
              {t("hr.whileAwaySection")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>{t("hr.contactPhone")}</FieldLabel>
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputCls}
                  placeholder={t("hr.contactPhonePlaceholder")}
                  value={leaveForm.contact_phone}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>{t("hr.destination")}</FieldLabel>
                <input
                  className={inputCls}
                  placeholder={t("hr.destinationPlaceholder")}
                  value={leaveForm.destination}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, destination: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>{t("hr.contactAddress")}</FieldLabel>
                <input
                  className={inputCls}
                  placeholder={t("hr.contactAddressPlaceholder")}
                  value={leaveForm.contact_address}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, contact_address: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* ── Emergency contact ── matters on long and medical absences */}
          <div className="pt-1 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] pt-3 pb-2">
              {t("hr.emergencySection")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>{t("hr.emergencyName")}</FieldLabel>
                <input
                  className={inputCls}
                  placeholder={t("hr.emergencyNamePlaceholder")}
                  value={leaveForm.emergency_contact_name}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>{t("hr.emergencyPhone")}</FieldLabel>
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputCls}
                  placeholder={t("hr.contactPhonePlaceholder")}
                  value={leaveForm.emergency_contact_phone}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Supporting document — upload or drag a photo/PDF of the
              certificate. Lands in the PRIVATE hr-documents bucket. */}
          <div>
            <FieldLabel>{t("hr.attachment")}</FieldLabel>
            <HrFileField
              value={leaveForm.attachment_url}
              onChange={(path) => setLeaveForm((f) => ({ ...f, attachment_url: path }))}
              folder="leave"
              label={leaveForm.attachment_url ? t("hr.openAttachment") : t("hr.dropFileHere")}
              browseLabel={t("hr.browseFiles")}
              removeLabel={t("hr.removeFile")}
              errorLabel={t("hr.uploadFailed")}
              hint={t("hr.attachmentHint")}
            />
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

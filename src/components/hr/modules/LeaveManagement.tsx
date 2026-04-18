"use client";

/* ---------------------------------------------------------------------------
   LeaveManagement — Leave requests module for the HR application.
   Handles viewing, creating, filtering, and reviewing leave requests.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
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
} from "@/components/hr/shared";
import {
  fetchLeaveRequests,
  fetchLeaveTypes,
  createLeaveRequest,
  reviewLeaveRequest,
  type LeaveRequestWithName,
} from "@/lib/hr-admin";
import type { LeaveTypeRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   LEAVE MANAGEMENT MODULE
   ═══════════════════════════════════════════════════ */

export default function LeaveManagement({ employees, t, lang }: HRModuleProps) {
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
  });
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
    await reloadRequests();
    setLeaveForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", half_day: false });
    setShowLeaveModal(false);
    setSaving(false);
  };

  const handleReviewLeave = async (id: string, status: "approved" | "rejected") => {
    setSaving(true);
    await reviewLeaveRequest(id, status, "admin", reviewNotes || undefined);
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
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <UserIcon size={16} className="text-[var(--text-dim)]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {req.employee_name}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">
                      {tLeaveType(req.leave_type_name)}
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
              <div className="text-[13px] text-[var(--text-primary)]">{selectedLeave.employee_name}</div>
            </div>
            <div>
              <FieldLabel>{t("hr.typeLabel")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-primary)]">{tLeaveType(selectedLeave.leave_type_name)}</div>
            </div>
            <div>
              <FieldLabel>{t("hr.periodLabel")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-primary)]">
                {fmtDate(selectedLeave.start_date)} — {fmtDate(selectedLeave.end_date)}{" "}
                ({selectedLeave.days} {selectedLeave.days === 1 ? t("hr.day") : t("hr.days")})
                {selectedLeave.half_day && (
                  <span className="ml-2 text-blue-400">({t("hr.halfDayLabel")})</span>
                )}
              </div>
            </div>
            {selectedLeave.reason && (
              <div>
                <FieldLabel>{t("hr.reasonLabel")}</FieldLabel>
                <div className="text-[13px] text-[var(--text-primary)]">{selectedLeave.reason}</div>
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
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowLeaveModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={saving || !leaveForm.employee_id || !leaveForm.leave_type_id || !leaveForm.start_date || !leaveForm.end_date}
              onClick={handleCreateLeave}
            >
              {t("hr.submit")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Employee select */}
          <div>
            <FieldLabel>{t("hr.employee")}</FieldLabel>
            <select
              className={selectCls}
              value={leaveForm.employee_id}
              onChange={(e) => setLeaveForm((f) => ({ ...f, employee_id: e.target.value }))}
            >
              <option value="">{t("hr.selectEmployee")}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.person.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Leave type select */}
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
                  {tLeaveType(lt.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <FieldLabel>{t("hr.startDate")}</FieldLabel>
            <input
              type="date"
              className={inputCls}
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>

          {/* End date */}
          <div>
            <FieldLabel>{t("hr.endDate")}</FieldLabel>
            <input
              type="date"
              className={inputCls}
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>

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

          {/* Half day checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={leaveForm.half_day}
              onChange={(e) => setLeaveForm((f) => ({ ...f, half_day: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--bg-inverted)]"
            />
            <span className="text-[13px] text-[var(--text-primary)]">{t("hr.halfDayLabel")}</span>
          </label>
        </div>
      </ModalShell>
    </div>
  );
}

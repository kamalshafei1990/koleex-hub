"use client";

/* ---------------------------------------------------------------------------
   Attendance — Daily attendance tracking module for the HR application.
   Handles viewing records by date, summary stats, and clock-out actions.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  EmptyState,
  StatusBadge,
  fmtTime,
  ATTENDANCE_STATUS_MAP,
  makeTranslationHelpers,
  primaryBtnCls,
  inputCls,
} from "@/components/hr/shared";
import {
  fetchAttendanceRecords,
  clockOut,
} from "@/lib/hr-admin";
import type { AttendanceRecordRow } from "@/types/supabase";

/* ── Icons ── */
import UserIcon from "@/components/icons/ui/UserIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   ATTENDANCE MODULE
   ═══════════════════════════════════════════════════ */

export default function Attendance({ employees, t, lang }: HRModuleProps) {
  /* ── Translation helpers ── */
  const { tStatus } = makeTranslationHelpers(t);

  /* ── State ── */
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Data loading (reloads when date changes) ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const records = await fetchAttendanceRecords({
        date_from: attendanceDate,
        date_to: attendanceDate,
      });
      if (!cancelled) {
        setAttendanceRecords(records);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [attendanceDate]);

  /* ── Employee name map ── */
  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.person.full_name);
    return m;
  }, [employees]);

  /* ── Attendance summary ── */
  const summary = useMemo(() => {
    let present = 0,
      late = 0,
      absent = 0;
    for (const r of attendanceRecords) {
      if (r.status === "present") present++;
      else if (r.status === "late") late++;
      else if (r.status === "absent") absent++;
    }
    return { present, late, absent };
  }, [attendanceRecords]);

  /* ── Actions ── */
  const handleClockOut = async (empId: string) => {
    setSaving(true);
    await clockOut(empId);
    // Reload records for current date
    const records = await fetchAttendanceRecords({
      date_from: attendanceDate,
      date_to: attendanceDate,
    });
    setAttendanceRecords(records);
    setSaving(false);
  };

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
          {t("hr.attendance")}
        </h2>
        <input
          type="date"
          className={inputCls + " !w-auto"}
          value={attendanceDate}
          onChange={(e) => setAttendanceDate(e.target.value)}
        />
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-5 text-[13px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-[var(--text-muted)]">
            {t("hr.present")}: <span className="font-semibold text-[var(--text-primary)]">{summary.present}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-[var(--text-muted)]">
            {t("hr.late")}: <span className="font-semibold text-[var(--text-primary)]">{summary.late}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="text-[var(--text-muted)]">
            {t("hr.absent")}: <span className="font-semibold text-[var(--text-primary)]">{summary.absent}</span>
          </span>
        </div>
      </div>

      {/* Attendance records list */}
      {attendanceRecords.length === 0 ? (
        <EmptyState
          icon={ClockIcon}
          title={t("hr.noAttendanceRecords")}
          subtitle={t("hr.noRecordsFor")}
        />
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
          {attendanceRecords.map((rec) => {
            const empName = nameMap.get(rec.employee_id) || "Unknown";
            const hasClockedOut = !!rec.clock_out;

            return (
              <div
                key={rec.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <UserIcon size={16} className="text-[var(--text-dim)]" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate mb-0.5">
                    {empName}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-[var(--text-dim)]">
                    <span>
                      {t("hr.clockIn")}: {fmtTime(rec.clock_in)}
                    </span>
                    <span>
                      {t("hr.clockOut")}: {fmtTime(rec.clock_out)}
                    </span>
                    {rec.total_hours != null && (
                      <span className="font-medium text-[var(--text-muted)]">
                        {rec.total_hours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <StatusBadge
                  status={rec.status}
                  map={ATTENDANCE_STATUS_MAP}
                  label={tStatus(rec.status)}
                />

                {/* Clock out button (only if not clocked out yet) */}
                {!hasClockedOut && (
                  <button
                    className={primaryBtnCls + " !h-8 !px-3 text-[12px] shrink-0"}
                    disabled={saving}
                    onClick={() => handleClockOut(rec.employee_id)}
                  >
                    {t("hr.clockOutBtn")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

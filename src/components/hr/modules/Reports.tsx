"use client";

/* ---------------------------------------------------------------------------
   Reports — HR analytics with department headcount, leave utilization,
   overall stats, and training completion charts.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  cardCls,
  sectionTitleCls,
} from "@/components/hr/shared";
import {
  fetchHrDashboardStats,
  fetchLeaveRequests,
  fetchTrainingRecords,
  type HrDashboardStats,
  type LeaveRequestWithName,
  type TrainingRecordWithCourse,
} from "@/lib/hr-admin";

/* ── Icons ── */
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function ReportsModule({ employees, t, lang }: HRModuleProps) {
  /* ── state ── */
  const [dashStats, setDashStats] = useState<HrDashboardStats | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithName[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecordWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stats, leaves, recs] = await Promise.all([
          fetchHrDashboardStats(),
          fetchLeaveRequests(),
          fetchTrainingRecords(),
        ]);
        if (cancelled) return;
        setDashStats(stats);
        setLeaveRequests(leaves);
        setTrainingRecords(recs);
      } catch (err) {
        console.error("[Reports] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── computed data ── */

  // Headcount by Department
  const deptCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const emp of employees) {
      const dept = emp.department_name || t("hr.unassigned");
      map[dept] = (map[dept] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [employees, t]);

  const maxDeptCount = useMemo(
    () => Math.max(...deptCounts.map(([, c]) => c), 1),
    [deptCounts],
  );

  // Leave utilization
  const approvedLeaves = useMemo(
    () => leaveRequests.filter((l) => l.status === "approved").length,
    [leaveRequests],
  );
  const pendingLeaves = useMemo(
    () => leaveRequests.filter((l) => l.status === "pending").length,
    [leaveRequests],
  );
  const rejectedLeaves = useMemo(
    () => leaveRequests.filter((l) => l.status === "rejected").length,
    [leaveRequests],
  );

  // Training completion
  const totalTraining = trainingRecords.length;
  const completedTraining = useMemo(
    () => trainingRecords.filter((r) => r.status === "completed").length,
    [trainingRecords],
  );
  const trainingRate = totalTraining > 0
    ? Math.round((completedTraining / totalTraining) * 100)
    : 0;

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Section title */}
      <div className={sectionTitleCls}>
        <BarChart3Icon size={14} className="text-[var(--text-dim)]" />
        {t("hr.reports")}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 1. Headcount by Department ── */}
        <div className={cardCls}>
          <div className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
              {t("hr.headcountByDept")}
            </h3>

            {deptCounts.length === 0 ? (
              <div className="text-[13px] text-[var(--text-dim)] text-center py-6">
                {t("hr.noData")}
              </div>
            ) : (
              <div className="space-y-3">
                {deptCounts.map(([dept, count]) => (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[var(--text-subtle)] truncate">
                        {dept}
                      </span>
                      <span className="text-[12px] font-semibold text-[var(--text-primary)] ml-2">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all"
                        style={{ width: `${(count / maxDeptCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Leave Utilization ── */}
        <div className={cardCls}>
          <div className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
              {t("hr.leaveUtilization")}
            </h3>

            {leaveRequests.length === 0 ? (
              <div className="text-[13px] text-[var(--text-dim)] text-center py-6">
                {t("hr.noData")}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Approved */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/10">
                  <span className="text-[13px] font-medium text-emerald-400">
                    {t("hr.approved")}
                  </span>
                  <span className="text-[16px] font-bold text-emerald-400">
                    {approvedLeaves}
                  </span>
                </div>

                {/* Pending */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/10">
                  <span className="text-[13px] font-medium text-amber-400">
                    {t("hr.pending")}
                  </span>
                  <span className="text-[16px] font-bold text-amber-400">
                    {pendingLeaves}
                  </span>
                </div>

                {/* Rejected */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-500/10">
                  <span className="text-[13px] font-medium text-red-400">
                    {t("hr.rejected")}
                  </span>
                  <span className="text-[16px] font-bold text-red-400">
                    {rejectedLeaves}
                  </span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] mt-1">
                  <span className="text-[13px] font-medium text-[var(--text-subtle)]">
                    {t("hr.totalRequests")}
                  </span>
                  <span className="text-[16px] font-bold text-[var(--text-primary)]">
                    {leaveRequests.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Overall Stats ── */}
        <div className={cardCls}>
          <div className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
              {t("hr.overallStats")}
            </h3>

            <div className="space-y-3">
              {/* Total Employees */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-surface)]">
                <span className="text-[13px] font-medium text-[var(--text-subtle)]">
                  {t("hr.totalEmployees")}
                </span>
                <span className="text-[16px] font-bold text-[var(--text-primary)]">
                  {dashStats?.headcount ?? "-"}
                </span>
              </div>

              {/* Active */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/10">
                <span className="text-[13px] font-medium text-emerald-400">
                  {t("hr.activeLabel")}
                </span>
                <span className="text-[16px] font-bold text-emerald-400">
                  {dashStats?.active ?? "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Training Completion (donut chart) ── */}
        <div className={cardCls}>
          <div className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
              {t("hr.trainingCompletion")}
            </h3>

            {totalTraining === 0 ? (
              <div className="text-[13px] text-[var(--text-dim)] text-center py-6">
                {t("hr.noData")}
              </div>
            ) : (
              <div className="flex items-center gap-6">
                {/* Donut */}
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--bg-surface)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      className="stroke-emerald-400"
                      strokeWidth="3"
                      strokeDasharray={`${trainingRate}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[16px] font-bold text-[var(--text-primary)]">
                      {trainingRate}%
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  <div className="text-[12px] text-[var(--text-dim)]">
                    {t("hr.ofCompleted")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="text-[12px] text-[var(--text-subtle)]">
                      {t("hr.completedLabel")}: {completedTraining}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--bg-surface)]" />
                    <span className="text-[12px] text-[var(--text-subtle)]">
                      {t("hr.trainingRecordsLabel")}: {totalTraining}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

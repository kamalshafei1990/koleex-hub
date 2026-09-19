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
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import Link from "next/link";
import { fmtDate } from "@/components/hr/shared";

/* ── Phase G — the server-computed report (see /api/hr/reports) ── */
interface HrReport {
  today: string;
  headcount: { now: number; byStatus: Record<string, number>; months: string[]; hires: number[]; leavers: number[]; hiresWindow: number; leaversWindow: number; turnoverRate: number };
  tenure: { averageYears: number; buckets: Record<string, number>; people: Array<{ employeeId: string; name: string; number: string | null; department: string; hireDate: string | null; years: number | null }> };
  expiries: Array<{ employeeId: string; name: string; kind: string; date: string; daysLeft: number }>;
  occasions: Array<{ employeeId: string; name: string; kind: "birthday" | "anniversary"; date: string; years: number | null; daysLeft: number }>;
  cost: Record<string, Record<string, number>>;
  mix: Record<"nationality" | "workCountry" | "gender" | "employmentType", Array<[string, number]>>;
}

/** Rows → a CSV download, built in the browser from the report already on
 *  screen: no second request, and what you export is what you saw. */
function downloadCsv(name: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const num = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function ReportsModule({ employees, t }: HRModuleProps) {
  /* ── state ── */
  const [dashStats, setDashStats] = useState<HrDashboardStats | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithName[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecordWithCourse[]>([]);
  const [report, setReport] = useState<HrReport | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stats, leaves, recs, rep] = await Promise.all([
          fetchHrDashboardStats(),
          fetchLeaveRequests(),
          fetchTrainingRecords(),
          fetch("/api/hr/reports", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<HrReport>) : null)).catch(() => null),
        ]);
        if (cancelled) return;
        setDashStats(stats);
        setLeaveRequests(leaves);
        setTrainingRecords(recs);
        setReport(rep);
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
        <SpinnerIcon size={28} className="text-[var(--text-dim)]" />
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
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#567FB2] transition-all"
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

      {/* ═══ Phase G — the manager's questions ═══ */}
      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hires & leavers */}
          <div className={cardCls}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("hr.rpt.turnover")}</h3>
                <button type="button" onClick={() => downloadCsv("hires-leavers", ["month", "hires", "leavers"], report.headcount.months.map((m, i) => [m, report.headcount.hires[i], report.headcount.leavers[i]]))} className="h-8 px-2.5 rounded-lg text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1.5"><DownloadIcon size={13} /> {t("hr.rpt.exportCsv")}</button>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--text-dim)] mb-3 tabular-nums">
                <span>{t("hr.rpt.hires")} <b className="text-[var(--text-primary)]">{report.headcount.hiresWindow}</b></span>
                <span>{t("hr.rpt.leavers")} <b className="text-[var(--text-primary)]">{report.headcount.leaversWindow}</b></span>
                <span>{t("hr.rpt.turnoverRate")} <b className="text-[var(--text-primary)]">{report.headcount.turnoverRate}%</b></span>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {report.headcount.months.map((m, i) => {
                  const max = Math.max(1, ...report.headcount.hires, ...report.headcount.leavers);
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-0.5" title={`${m}: +${report.headcount.hires[i]} / −${report.headcount.leavers[i]}`}>
                      <div className="w-full flex items-end gap-px h-20">
                        <div className="flex-1 rounded-t bg-[#0066FF]" style={{ height: `${(report.headcount.hires[i] / max) * 100}%` }} />
                        <div className="flex-1 rounded-t bg-[var(--text-faint)]" style={{ height: `${(report.headcount.leavers[i] / max) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-[var(--text-faint)]">{m.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-faint)]">{t("hr.rpt.turnoverNote")}</p>
            </div>
          </div>

          {/* Tenure */}
          <div className={cardCls}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("hr.rpt.tenure")}</h3>
                <button type="button" onClick={() => downloadCsv("tenure", ["employee", "number", "department", "hire_date", "years"], report.tenure.people.map((p) => [p.name, p.number, p.department, p.hireDate, p.years]))} className="h-8 px-2.5 rounded-lg text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1.5"><DownloadIcon size={13} /> {t("hr.rpt.exportCsv")}</button>
              </div>
              <div className="text-[12px] text-[var(--text-dim)] mb-3">{t("hr.rpt.avgTenure")} <b className="text-[var(--text-primary)] tabular-nums">{report.tenure.averageYears} {t("hr.rpt.years")}</b></div>
              <div className="space-y-2">
                {Object.entries(report.tenure.buckets).map(([b, n]) => (
                  <div key={b}>
                    <div className="flex items-center justify-between mb-1 text-[12px]"><span className="text-[var(--text-subtle)]">{b} {t("hr.rpt.years")}</span><span className="font-semibold text-[var(--text-primary)]">{n}</span></div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden"><div className="h-full rounded-full bg-[#567FB2]" style={{ width: `${(n / Math.max(1, report.headcount.now)) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expiries */}
          <div className={cardCls}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("hr.rpt.expiries")}</h3>
                <button type="button" onClick={() => downloadCsv("expiries-90d", ["employee", "kind", "date", "days_left"], report.expiries.map((x) => [x.name, x.kind, x.date, x.daysLeft]))} className="h-8 px-2.5 rounded-lg text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1.5"><DownloadIcon size={13} /> {t("hr.rpt.exportCsv")}</button>
              </div>
              {report.expiries.length === 0 ? <div className="text-[13px] text-[var(--text-dim)] text-center py-6">{t("hr.rpt.nothingExpiring")}</div> : (
                <ul className="divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
                  {report.expiries.map((x, i) => (
                    <li key={i} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate"><Link href={`/employees/${x.employeeId}`} className="font-medium text-[var(--text-primary)] hover:underline">{x.name}</Link> <span className="text-[var(--text-dim)]">· {x.kind}</span></span>
                      <span className={`shrink-0 tabular-nums ${x.daysLeft <= 14 ? "text-[#FF3333]" : x.daysLeft <= 30 ? "text-[#FFCC00]" : "text-[var(--text-dim)]"}`}>{fmtDate(x.date)} · {x.daysLeft} {t("hr.rpt.daysLeft")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Occasions */}
          <div className={cardCls}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("hr.rpt.occasions")}</h3>
                <button type="button" onClick={() => downloadCsv("occasions-60d", ["employee", "kind", "date", "years"], report.occasions.map((x) => [x.name, x.kind, x.date, x.years]))} className="h-8 px-2.5 rounded-lg text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1.5"><DownloadIcon size={13} /> {t("hr.rpt.exportCsv")}</button>
              </div>
              {report.occasions.length === 0 ? <div className="text-[13px] text-[var(--text-dim)] text-center py-6">{t("hr.rpt.noOccasions")}</div> : (
                <ul className="divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
                  {report.occasions.map((x, i) => (
                    <li key={i} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate"><Link href={`/employees/${x.employeeId}`} className="font-medium text-[var(--text-primary)] hover:underline">{x.name}</Link> <span className="text-[var(--text-dim)]">· {x.kind === "birthday" ? t("hr.rpt.birthday") : `${t("hr.rpt.anniversary")} · ${x.years} ${t("hr.rpt.years")}`}</span></span>
                      <span className="shrink-0 tabular-nums text-[var(--text-dim)]">{fmtDate(x.date)} · {t("hr.rpt.inDays")} {x.daysLeft} {t("hr.rpt.daysLeft")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Cost by department */}
          <div className={cardCls}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("hr.rpt.cost")}</h3>
                <button type="button" onClick={() => downloadCsv("salary-cost-by-department", ["department", "currency", "monthly"], Object.entries(report.cost).flatMap(([d, byCcy]) => Object.entries(byCcy).map(([c, v]) => [d, c, v])))} className="h-8 px-2.5 rounded-lg text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1.5"><DownloadIcon size={13} /> {t("hr.rpt.exportCsv")}</button>
              </div>
              <p className="text-[10px] text-[var(--text-faint)] mb-3">{t("hr.rpt.costNote")}</p>
              {Object.keys(report.cost).length === 0 ? <div className="text-[13px] text-[var(--text-dim)] text-center py-6">{t("hr.rpt.noCost")}</div> : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {Object.entries(report.cost).map(([d, byCcy]) => (
                    <li key={d} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-[var(--text-subtle)] truncate">{d}</span>
                      <span className="tabular-nums font-semibold text-[var(--text-primary)]">{Object.entries(byCcy).map(([c, v]) => `${c} ${num(v)}`).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Mix */}
          <div className={cardCls}>
            <div className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">{t("hr.rpt.mix")}</h3>
              <div className="grid grid-cols-2 gap-4">
                {(["nationality", "workCountry", "gender", "employmentType"] as const).map((k) => (
                  <div key={k}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">{t(`hr.rpt.${k}`)}</div>
                    <ul className="space-y-1">
                      {report.mix[k].slice(0, 6).map(([label, n]) => (
                        <li key={label} className="flex items-center justify-between text-[12px]"><span className="text-[var(--text-subtle)] truncate">{label}</span><span className="tabular-nums font-semibold text-[var(--text-primary)]">{n}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
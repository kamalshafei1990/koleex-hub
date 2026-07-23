"use client";

/* ---------------------------------------------------------------------------
   Dashboard — HR overview with stat cards, recent leave requests, and
   expiring documents/visas.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  StatusBadge,
  LEAVE_STATUS_MAP,
  cardCls,
  sectionTitleCls,
  fmtDate,
  daysUntil,
  makeTranslationHelpers,
  EmployeeLink,
} from "@/components/hr/shared";
import {
  fetchHrDashboardStats,
  fetchExpiringItems,
  fetchLeaveRequests,
  type HrDashboardStats,
  type ExpiringItem,
  type LeaveRequestWithName,
} from "@/lib/hr-admin";

/* ── Icons ── */
import UsersIcon from "@/components/icons/ui/UsersIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import KpiCard from "@/components/ui/KpiCard";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function DashboardModule({ employees, t, lang, setActiveTab }: HRModuleProps) {
  /* ── state ── */
  const [dashStats, setDashStats] = useState<HrDashboardStats | null>(null);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequestWithName[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── translation helpers ── */
  const { tStatus, tLeaveType } = makeTranslationHelpers(t);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stats, expiring, recent] = await Promise.all([
          fetchHrDashboardStats(),
          fetchExpiringItems(60),
          fetchLeaveRequests(),
        ]);
        if (cancelled) return;
        setDashStats(stats);
        setExpiringItems(expiring);
        setRecentLeaves(recent.slice(0, 5));
      } catch (err) {
        console.error("[Dashboard] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── urgency color for expiring items ── */
  const urgencyColor = (days: number) => {
    if (days <= 7) return "text-red-400";
    if (days <= 30) return "text-amber-400";
    return "text-emerald-400";
  };

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* ── KPI cards — canonical monochrome KpiCard, same as every other app ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t("hr.totalEmployees")}
          value={dashStats?.headcount ?? "—"}
          icon={<UsersIcon size={14} />}
        />
        <KpiCard
          label={t("hr.onLeaveToday")}
          value={dashStats?.today_absences ?? "—"}
          icon={<CalendarPlusIcon size={14} />}
        />
        <KpiCard
          label={t("hr.pendingRequests")}
          value={dashStats?.pending_leave_requests ?? "—"}
          icon={<ClockIcon size={14} />}
          tone={(dashStats?.pending_leave_requests ?? 0) > 0 ? "warning" : "default"}
        />
        <KpiCard
          label={t("hr.expiringDocuments")}
          value={dashStats?.expiring_documents ?? "—"}
          icon={<DocumentIcon size={14} />}
          tone={(dashStats?.expiring_documents ?? 0) > 0 ? "rose" : "default"}
        />
      </div>

      {/* ── Recent Leave Requests ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            <CalendarPlusIcon size={14} className="text-[var(--text-dim)]" />
            {t("hr.recentLeaveRequests")}
          </div>

          {recentLeaves.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)] text-center py-8">
              {t("hr.noRecentRequests")}
            </div>
          ) : (
            <div className="space-y-2">
              {recentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-[var(--text-dim)]" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      <EmployeeLink id={leave.employee_id} name={leave.employee_name} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-subtle)] font-medium">
                        {tLeaveType(leave.leave_type_name)}
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {fmtDate(leave.start_date)} — {fmtDate(leave.end_date)}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge
                    status={leave.status}
                    map={LEAVE_STATUS_MAP}
                    label={tStatus(leave.status)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Expiring Soon ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            <ShieldIcon size={14} className="text-[var(--text-dim)]" />
            {t("hr.expiringSoon")}
          </div>

          {expiringItems.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)] text-center py-8">
              {t("hr.nothingExpiring")}
            </div>
          ) : (
            <div className="space-y-2">
              {expiringItems.map((item, idx) => {
                const days = daysUntil(item.expiry_date);
                return (
                  <div
                    key={`${item.employee_id}-${item.type}-${idx}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    {/* Icon */}
                    <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                      {item.type === "visa" ? (
                        <ShieldIcon size={14} className="text-[var(--text-dim)]" />
                      ) : (
                        <DocumentIcon size={14} className="text-[var(--text-dim)]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)]">
                        <EmployeeLink id={item.employee_id} name={item.employee_name} />
                      </div>
                    </div>

                    {/* Days countdown */}
                    <div className={`text-[12px] font-semibold ${urgencyColor(days)}`}>
                      {days <= 0
                        ? t("hr.expired")
                        : `${days} ${t("hr.daysLeft")}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

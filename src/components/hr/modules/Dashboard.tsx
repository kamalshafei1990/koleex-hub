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
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function DashboardModule({ employees, t, lang }: HRModuleProps) {
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
      {/* ── Stat cards (2x2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Employees */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="h-1 bg-emerald-400 rounded-t-xl" />
          <div className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <UsersIcon size={18} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-[24px] font-bold text-[var(--text-primary)]">
                {dashStats?.headcount ?? "-"}
              </div>
              <div className="text-[12px] text-[var(--text-dim)]">
                {t("hr.totalEmployees")}
              </div>
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
              <div className="text-[24px] font-bold text-[var(--text-primary)]">
                {dashStats?.today_absences ?? "-"}
              </div>
              <div className="text-[12px] text-[var(--text-dim)]">
                {t("hr.onLeaveToday")}
              </div>
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
              <div className="text-[24px] font-bold text-[var(--text-primary)]">
                {dashStats?.pending_leave_requests ?? "-"}
              </div>
              <div className="text-[12px] text-[var(--text-dim)]">
                {t("hr.pendingRequests")}
              </div>
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
              <div className="text-[24px] font-bold text-[var(--text-primary)]">
                {dashStats?.expiring_documents ?? "-"}
              </div>
              <div className="text-[12px] text-[var(--text-dim)]">
                {t("hr.expiringDocuments")}
              </div>
            </div>
          </div>
        </div>
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
                      {leave.employee_name}
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
                        {item.employee_name}
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

"use client";

/* Attendance — today's punch and this month's record, mine only. */

import { cardCls, fmtDate, fmtTime, StatusBadge, ATTENDANCE_STATUS_MAP, makeTranslationHelpers, EmptyState } from "@/components/hr/shared";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import ClockButton from "./ClockButton";
import { fmtHours, type MeTabProps } from "./shared";

export default function Attendance({ bundle, setBundle, t }: MeTabProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const { today, month, monthHours } = bundle.attendance;

  return (
    <div className="space-y-4">
      <section className={`${cardCls} p-5 md:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.today")}</div>
            <div className="mt-1 text-[32px] font-bold leading-none tabular-nums text-[var(--text-primary)]">
              {today?.clock_out ? fmtHours(today.total_hours) : today?.clock_in ? fmtTime(today.clock_in) : "—"}
            </div>
            <div className="mt-2 text-[13px] text-[var(--text-dim)] tabular-nums">
              {today?.clock_in ? `${t("hr.clockIn")} ${fmtTime(today.clock_in)}` : t("hr.me.notClockedIn")}
              {today?.clock_out ? ` · ${t("hr.clockOut")} ${fmtTime(today.clock_out)}` : ""}
            </div>
          </div>
          <ClockButton today={today} setBundle={setBundle} t={t} size="lg" />
        </div>
      </section>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.thisMonth")}</h3>
          <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">{month.length} {t("hr.days")} · {fmtHours(monthHours)}</span>
        </div>
        {month.length === 0 ? (
          <EmptyState icon={ClockIcon} title={t("hr.me.noAttendance")} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {month.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_1fr_1fr_auto] items-center gap-3 px-5 py-3 text-[13px]">
                <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(r.date)}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{t("hr.clockIn")} {fmtTime(r.clock_in)}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{t("hr.clockOut")} {fmtTime(r.clock_out)}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{fmtHours(r.total_hours)}</span>
                <span className="justify-self-end"><StatusBadge status={r.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(r.status)} /></span>
                <span className="sm:hidden col-span-2 text-[12px] text-[var(--text-dim)] tabular-nums">{fmtTime(r.clock_in)} → {fmtTime(r.clock_out)} · {fmtHours(r.total_hours)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

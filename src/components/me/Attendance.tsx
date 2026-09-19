"use client";

/* Attendance — today's punch, then MY month with every day accounted for:
   weekend, public holiday, approved leave, present, late, absent. The
   sheet is server-derived (attendance-sheet.ts) so HR and I read the same
   thing; the bundle's raw month list is only the fallback while it loads. */

import { useEffect, useState } from "react";
import type { AttendanceSheet, SheetDay } from "@/lib/server/attendance-sheet";
import { cardCls, fmtDate, fmtTime, StatusBadge, ATTENDANCE_STATUS_MAP, makeTranslationHelpers } from "@/components/hr/shared";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ClockButton from "./ClockButton";
import { browserTz, fmtHours, meFetch, type MeTabProps } from "./shared";

const monthLabel = (ym: string, lang: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" });
};
const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Attendance({ bundle, setBundle, t, lang }: MeTabProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const { today } = bundle.attendance;
  const [month, setMonth] = useState(bundle.serverDate.slice(0, 7));
  const [fetched, setFetched] = useState<AttendanceSheet | null>(null);

  /* The sheet is per month; refetch on month change and after a punch
     (bundle.attendance.today changes identity). "loading" is derived — the
     sheet on hand is for another month — so the effect body never sets state. */
  useEffect(() => {
    let cancelled = false;
    meFetch<{ sheet: AttendanceSheet }>(`/api/me/hr/attendance/sheet?month=${month}&tz=${encodeURIComponent(browserTz())}`, { cache: "no-store" })
      .then((res) => { if (!cancelled && res.ok) setFetched(res.data.sheet); });
    return () => { cancelled = true; };
  }, [month, today?.id, today?.clock_out]);
  const sheet = fetched && fetched.month === month ? fetched : null;
  const loading = !sheet;

  const s = sheet?.summary;
  const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short" });
  const isToday = (d: SheetDay) => d.date === bundle.serverDate;

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
              {today?.status === "late" ? ` · ${tStatus("late")}` : ""}
            </div>
          </div>
          <ClockButton today={today} setBundle={setBundle} t={t} size="lg" />
        </div>
      </section>

      {/* Month summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {([
          ["hr.att.workdays", s?.workdays], ["hr.att.presentDays", s?.present], ["hr.att.lateDays", s?.late],
          ["hr.att.absentDays", s?.absent], ["hr.att.leaveDays", s?.leave], ["hr.att.hours", s ? fmtHours(s.hours) : undefined],
        ] as Array<[string, number | string | undefined]>).map(([k, v]) => (
          <div key={k} className={`${cardCls} px-3 py-2.5`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{t(k)}</div>
            <div className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">{v ?? "—"}</div>
          </div>
        ))}
      </div>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Previous month"><ArrowLeftIcon size={14} className="rtl:rotate-180" /></button>
          <div className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            {monthLabel(month, lang)}{loading && <SpinnerIcon size={12} className="text-[var(--text-dim)]" />}
            {s && s.overtimeH > 0 && <span className="text-[11px] font-medium text-[var(--text-dim)]">· {t("hr.att.overtime")} {fmtHours(s.overtimeH)}</span>}
          </div>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= bundle.serverDate.slice(0, 7)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)] disabled:opacity-30" aria-label="Next month"><ArrowRightIcon size={14} className="rtl:rotate-180" /></button>
        </div>
        {sheet ? (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {sheet.days.map((d) => (
              <li key={d.date} className={`grid grid-cols-[1fr_auto] sm:grid-cols-[150px_1fr_1fr_1fr_auto] items-center gap-3 px-4 py-2 text-[13px] ${d.status === "weekend" || d.status === "holiday" ? "opacity-60" : ""} ${isToday(d) ? "bg-[var(--bg-surface-subtle)]" : ""}`}>
                <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(d.date)} <span className="text-[var(--text-dim)] font-normal">{weekday(d.date)}</span></span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.clockIn ? `${t("hr.clockIn")} ${fmtTime(d.clockIn)}` : d.note ?? ""}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.clockOut ? `${t("hr.clockOut")} ${fmtTime(d.clockOut)}` : ""}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.hours !== null ? fmtHours(d.hours) : ""}{d.lateMin > 0 ? ` · +${d.lateMin}m` : ""}</span>
                <span className="justify-self-end">{d.status !== "future" && <StatusBadge status={d.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(d.status)} />}</span>
                {(d.clockIn || d.note) && <span className="sm:hidden col-span-2 text-[12px] text-[var(--text-dim)] tabular-nums">{d.note ?? `${fmtTime(d.clockIn)} → ${fmtTime(d.clockOut)} · ${fmtHours(d.hours)}`}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center py-12"><SpinnerIcon size={20} className="text-[var(--text-dim)]" /></div>
        )}
      </section>
    </div>
  );
}

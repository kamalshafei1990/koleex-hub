"use client";

/* ---------------------------------------------------------------------------
   UtilizationView — scheduled hours vs capacity per employee for the week
   on screen. Split out of PlanningApp and loaded with next/dynamic.

   Capacity counts WORKING days only (Mon–Fri) and subtracts each person's
   approved-leave working days, so someone on leave for three days is
   measured against two days of capacity, not five. Scheduled hours are
   clipped to the visible week, so a multi-week item only counts the part
   that falls inside it.

   The "billable" figure is gone: nothing in the app sets is_billable or a
   rate, so it was always 0.
   --------------------------------------------------------------------------- */

import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import { addDays, dateKey, type LeaveSpan, type PlanningItem, type PlanningResource } from "@/lib/planning";

export default function UtilizationView({
  items,
  resources,
  leaves,
  weekStart,
}: {
  items: PlanningItem[];
  resources: PlanningResource[];
  leaves: LeaveSpan[];
  weekStart: Date;
}) {
  const { t } = useTranslation(planningT);
  const weekEnd = addDays(weekStart, 7);
  const workDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });

  const clippedHours = (i: PlanningItem) => {
    if (i.allocated_hours != null) return i.allocated_hours;
    const s = Math.max(new Date(i.start_at).getTime(), weekStart.getTime());
    const e = Math.min(new Date(i.end_at).getTime(), weekEnd.getTime());
    return Math.max(0, (e - s) / 3_600_000);
  };

  const rows = resources
    .filter((r) => r.is_active && r.type === "employee")
    .map((r) => {
      const mine = items.filter((i) => i.resource_id === r.id && i.status !== "cancelled");
      const hours = mine.reduce((s, i) => s + clippedHours(i), 0);
      const myLeaves = leaves.filter((l) => l.resource_id === r.id);
      const leaveDays = workDays.filter((d) => {
        const k = dateKey(d);
        return myLeaves.some((l) => l.start_date <= k && k <= l.end_date);
      }).length;
      const capacity = (r.capacity_hours_per_day ?? 8) * (workDays.length - leaveDays);
      const pct = capacity > 0 ? Math.round((hours / capacity) * 100) : hours > 0 ? 999 : 0;
      return { r, hours, capacity, pct, leaveDays };
    })
    .sort((a, b) => b.pct - a.pct);

  if (rows.length === 0) {
    return (
      <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-6 py-12 text-center text-[12px] text-[var(--text-dim)]">
        {t("util.empty")}
      </div>
    );
  }

  return (
    <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
      <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {t("util.title")}
      </div>
      {rows.map(({ r, hours, capacity, pct, leaveDays }) => (
        <div key={r.id} className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{r.name}</span>
            {leaveDays > 0 && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1 py-px">
                {t("sched.onLeave")}
              </span>
            )}
            <span
              className={`ms-auto text-[12px] font-bold ${pct > 100 ? "text-red-600 dark:text-red-400" : "text-[var(--text-primary)]"}`}
            >
              {pct}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden"
            role="progressbar"
            aria-label={r.name}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, pct)}
          >
            <div
              className={`h-full rounded-full transition-all ${pct > 100 ? "bg-red-500/80" : "bg-[var(--bg-inverted)]"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-dim)]">
            {hours.toFixed(1)}
            {t("unit.h")} {t("util.of")} {capacity}
            {t("unit.h")}
            {leaveDays > 0 ? ` · ${leaveDays} ${t("util.leaveDays")}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

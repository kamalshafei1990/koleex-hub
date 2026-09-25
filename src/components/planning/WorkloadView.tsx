"use client";

/* ---------------------------------------------------------------------------
   WorkloadView — a heat grid of planned hours per person per day for the
   visible week. Reads GET /api/planning/workload (the same feed Projects
   can use), so both apps agree on the numbers.

   A cell's tint grows with hours ÷ the person's daily capacity (Hub Blue);
   over capacity turns red. The number is always printed — colour is never
   the only signal. Refetches when the week or `version` (any save) changes.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import {
  addDays,
  dateKey,
  fetchWorkload,
  formatWeekRange,
  type PlanningResource,
  type WorkloadResponse,
} from "@/lib/planning";

export default function WorkloadView({
  weekStart,
  resources,
  tz,
  version,
  onPrev,
  onNext,
  onToday,
}: {
  weekStart: Date;
  resources: PlanningResource[];
  tz: string;
  version: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const { t, lang } = useTranslation(planningT);
  const accounts = useMemo(
    () => [...new Set(resources.filter((r) => r.is_active && r.type === "employee" && r.account_id).map((r) => r.account_id as string))].slice(0, 200),
    [resources],
  );
  const from = dateKey(weekStart);
  const to = dateKey(addDays(weekStart, 6));
  const reqKey = `${from}|${to}|${tz}|${accounts.join(",")}|${version}`;
  const [state, setState] = useState<{ k: string; data: WorkloadResponse | null; failed: boolean } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (accounts.length === 0) return;
    let alive = true;
    fetchWorkload({ from, to, tz, accounts }).then(
      (data) => { if (alive) setState({ k: reqKey, data, failed: false }); },
      () => { if (alive) setState({ k: reqKey, data: null, failed: true }); },
    );
    return () => { alive = false; };
    // reqKey folds every input in; retry forces a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, retry]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayKey = dateKey(new Date());

  const nav = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onPrev} aria-label={t("aria.prevWeek")} title={t("aria.prevWeek")}
        className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0">
        <AngleLeftIcon size={14} className="rtl:-scale-x-100" />
      </button>
      <button type="button" onClick={onToday}
        className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] shrink-0">
        {t("sched.today")}
      </button>
      <button type="button" onClick={onNext} aria-label={t("aria.nextWeek")} title={t("aria.nextWeek")}
        className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0">
        <AngleRightIcon size={14} className="rtl:-scale-x-100" />
      </button>
      <div className="text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] truncate" aria-live="polite">
        {formatWeekRange(weekStart)}
      </div>
    </div>
  );

  if (accounts.length === 0) {
    return (
      <div className="space-y-3">
        {nav}
        <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-6 py-12 text-center text-[12px] text-[var(--text-dim)]">
          {t("wl.empty")}
        </div>
      </div>
    );
  }

  const current = state && state.k === reqKey ? state : null;
  const shown = current ?? state; // keep the previous week on screen while the next loads

  return (
    <div className="space-y-3">
      {nav}
      {shown?.failed && current ? (
        <div role="alert" className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-12 text-center space-y-3">
          <div className="text-[13px] text-red-600 dark:text-red-400">{t("err.load")}</div>
          <button type="button" onClick={() => setRetry((n) => n + 1)}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">
            {t("btn.retry")}
          </button>
        </div>
      ) : !shown?.data ? (
        <div className="flex items-center justify-center py-20"><SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" /></div>
      ) : (
        <div className={`kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden transition-opacity ${current ? "" : "opacity-60"}`} aria-busy={!current}>
          <div className="px-4 pt-3 pb-2 space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("wl.title")}</div>
            <p className="text-[11px] text-[var(--text-dim)]">{t("wl.help")}</p>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-[var(--text-dim)]" aria-hidden="true">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />{t("wl.legend.free")}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#567FB2]/60" />{t("wl.legend.full")}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/50" />{t("wl.legend.over")}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-[var(--border-subtle)]">
                  <th scope="col" className="text-start px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] w-[200px]">{t("wl.person")}</th>
                  {days.map((d) => {
                    const k = dateKey(d);
                    return (
                      <th key={k} scope="col" aria-current={k === todayKey ? "date" : undefined}
                        className={`px-1 py-2 text-center font-bold ${k === todayKey ? "text-[#567FB2] dark:text-[#7FA9D6]" : "text-[var(--text-primary)]"}`}>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{d.toLocaleDateString(lang, { weekday: "short" })}</div>
                        <div className="text-[13px]">{d.getDate()}</div>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-3 py-2 text-end text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("wl.total")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.data.people.map((p) => (
                  <tr key={p.account_id} className="border-b last:border-b-0 border-[var(--border-subtle)]">
                    <th scope="row" className="text-start px-4 py-1.5 font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{p.name}</th>
                    {days.map((d) => {
                      const k = dateKey(d);
                      const h = p.days[k] ?? 0;
                      const cap = p.capacity_hours_per_day > 0 ? p.capacity_hours_per_day : 8;
                      const ratio = h / cap;
                      const over = ratio > 1.001;
                      const alpha = h <= 0 ? 0 : Math.min(0.7, 0.12 + ratio * 0.5);
                      return (
                        <td key={k} className="px-1 py-1">
                          <div
                            className={`h-9 rounded-md flex items-center justify-center tabular-nums text-[12px] font-semibold ${
                              h <= 0
                                ? "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-ghost)]"
                                : over
                                  ? "bg-red-500/40 text-red-800 dark:text-red-100"
                                  : "text-[var(--text-primary)]"
                            }`}
                            style={!over && h > 0 ? { background: `rgba(86,127,178,${alpha})` } : undefined}
                            title={`${p.name} · ${h}${t("unit.h")} / ${cap}${t("unit.h")}`}
                          >
                            {h > 0 ? `${Number(h.toFixed(1))}${t("unit.h")}` : "—"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-end tabular-nums font-bold text-[var(--text-primary)]">
                      {Number(p.total.toFixed(1))}{t("unit.h")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

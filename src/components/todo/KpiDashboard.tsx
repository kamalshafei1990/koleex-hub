"use client";

/* ---------------------------------------------------------------------------
   KPI dashboard — the stat cards and Top Performers above the list (the
   original design, restored).

   The list holds only the OPEN set now, so the numbers come from two
   places: open-side counts (active, overdue, high priority) are counted from
   the open set the screen already has — with the recurring-series rule — and
   finished-work numbers come from GET /api/todos?resource=stats (counts
   under the list's own scope, warm-cached, re-read after writes).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import type { TodoAssigneeInfo } from "@/types/supabase";
import { useWarmData } from "@/lib/warm-cache";
import { todoWriteVersion } from "@/lib/todo-list-url";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import MiniAvatar from "./MiniAvatar";
import type { TFn } from "./todo-ui";

export interface TodoStats {
  completed: number;
  completedSince: number;
  performers: (Pick<TodoAssigneeInfo, "account_id" | "username" | "full_name" | "avatar_url"> & { count: number })[];
}

/** Local midnight seven days ago — "done this week" as the reader's calendar
 *  counts it; a whole day, so the request URL (and its cache) holds all day. */
function weekAgoIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).toISOString();
}

/** Server-side completion numbers for the current audience lens. `bump`
 *  changes after writes; the stats are re-read a beat later. */
export function useTodoStats(accountId: string | null, view: string, bump: unknown): TodoStats | null {
  const load = useCallback(async (): Promise<TodoStats> => {
    const q = new URLSearchParams({ resource: "stats", view, since: weekAgoIso(), v: todoWriteVersion() });
    const res = await fetch(`/api/todos?${q.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as Partial<TodoStats>;
    return { completed: j.completed ?? 0, completedSince: j.completedSince ?? 0, performers: Array.isArray(j.performers) ? j.performers : [] };
  }, [view]);
  const { data, reload } = useWarmData<TodoStats>(accountId ? `todo:stats:${accountId}:${view}` : "", load, undefined, 0);
  /* The first list answers arrive right after mount and are not changes —
     only re-read once the page has settled. */
  const [mountedAt] = useState(() => Date.now());
  useEffect(() => {
    if (Date.now() - mountedAt < 4000) return;
    const id = setTimeout(() => void reload(), 1500);
    return () => clearTimeout(id);
  }, [bump, reload, mountedAt]);
  return data;
}

export default function KpiDashboard({ active, overdue, high, stats, t }: {
  active: number;
  overdue: number;
  high: number;
  stats: TodoStats | null;
  t: TFn;
}) {
  const completed = stats?.completed ?? null;
  const total = completed === null ? null : active + completed;
  const rate = total ? Math.round(((completed ?? 0) / total) * 100) : total === 0 ? 0 : null;
  const dash = (n: number | null, suffix = "") => (n === null ? "—" : `${n}${suffix}`);

  const cards = [
    { label: t("kpi.totalTasks"), value: dash(total), icon: ListTodoIcon, color: "text-[#7FA9D6]", bg: "bg-[#567FB2]/10 border-[#567FB2]/20" },
    { label: t("kpi.active"), value: String(active), icon: TargetIcon, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: t("kpi.completed"), value: dash(completed), icon: CheckCircleIcon, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: t("kpi.overdue"), value: String(overdue), icon: ExclamationIcon, color: "text-red-400", bg: overdue > 0 ? "bg-red-500/10 border-red-500/20" : "bg-[var(--bg-surface)] border-[var(--border-subtle)]" },
    { label: t("kpi.highPriority"), value: String(high), icon: FlagIcon, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: t("kpi.doneThisWeek"), value: dash(stats ? stats.completedSince : null), icon: TrendingUpIcon, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
    { label: t("kpi.completion"), value: dash(rate, "%"), icon: BarChart3Icon, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  ];
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0 [&>*]:min-w-0">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border px-3 py-3 overflow-hidden ${c.bg}`}>
            <div className="flex items-center gap-1.5 mb-1 min-w-0">
              <c.icon size={12} className={`${c.color} shrink-0`} />
              <span className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">{c.label}</span>
            </div>
            <p className={`text-[20px] font-bold tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {stats && stats.performers.length > 0 && (
        <div className="kx-glass bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AwardIcon size={14} className="text-yellow-400" />
            <span className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("kpi.topPerformers")}</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            {stats.performers.map((p, i) => (
              <div key={p.account_id} className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <MiniAvatar info={p} size={28} />
                  <span aria-hidden className="absolute -top-1 -end-1 text-[10px]">{medals[i]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{p.full_name || p.username}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{p.count} {t("kpi.completedWord")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

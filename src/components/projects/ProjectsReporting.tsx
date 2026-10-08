"use client";

/* ---------------------------------------------------------------------------
   ProjectsReporting — KPI strip + project progress + priority / assignee
   breakdown. Split out of ProjectsApp so its code only loads when the
   Reporting tab is opened (dynamic import). Project progress uses the ONE
   shared rule (src/lib/project-progress.ts) — the same number the card and
   the server's projects.progress_pct show.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import SharedKpiCard from "@/components/ui/KpiCard";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { summarizeProgress } from "@/lib/project-progress";
import { BudgetMeter, budgetSummary, sumLoggedHours } from "./ProjectBudget";
import {
  fetchProjectList,
  fetchTasks,
  isOverdue,
  parseLocalDate,
  PRIORITY_COLOR,
  type ProjectRow,
  type TaskPriority,
  type TaskRow,
} from "@/lib/projects";

const panel = "kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3";

export default function ProjectsReporting() {
  const { t } = useTranslation(projectsT);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    Promise.all([fetchProjectList({ status: "all" }), fetchTasks({ status: "all", limit: 2000 })])
      .then(([ps, ts]) => {
        setProjects(ps.projects);
        setTasks(ts);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-10 text-center space-y-2">
        <div className="text-[13px] text-[var(--text-dim)]">{t("error.load")}</div>
        <button type="button" onClick={() => { setState("loading"); load(); }} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {t("btn.retry")}
        </button>
      </div>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const totalProjects = projects.filter((p) => p.status === "active").length;
  const openTasks = tasks.filter((x) => x.status === "open").length;
  const overdue = tasks.filter((x) => x.status === "open" && isOverdue(x.due_date)).length;
  const doneThisWeek = tasks.filter((x) => x.status === "done" && x.closed_at && new Date(x.closed_at) >= oneWeekAgo).length;
  const dueThisWeek = tasks.filter((x) => {
    if (x.status !== "open") return false;
    const d = parseLocalDate(x.due_date);
    return !!d && d <= inSevenDays && !isOverdue(x.due_date);
  }).length;

  const byPriority: Record<TaskPriority, number> = { urgent: 0, high: 0, normal: 0, low: 0 };
  for (const tk of tasks) if (tk.status === "open") byPriority[tk.priority]++;
  const priorityMax = Math.max(1, ...Object.values(byPriority));

  const byAssignee = new Map<string, number>();
  for (const tk of tasks) {
    if (tk.status !== "open") continue;
    const name = tk.assignee?.username ?? "—";
    byAssignee.set(name, (byAssignee.get(name) ?? 0) + 1);
  }
  const assigneeRows = [...byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const assigneeMax = Math.max(1, ...assigneeRows.map(([, c]) => c));

  const tasksByProject = new Map<string, TaskRow[]>();
  for (const tk of tasks) {
    const arr = tasksByProject.get(tk.project_id) ?? [];
    arr.push(tk);
    tasksByProject.set(tk.project_id, arr);
  }
  const projectProgress = projects
    .map((p) => {
      const s = summarizeProgress(tasksByProject.get(p.id) ?? []);
      return { id: p.id, name: p.name, color: p.color ?? "#567FB2", ...s };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  /* Budget vs actual — hours from the tasks already loaded above (no extra
     request); amount = hours × billing rate where a rate exists. Most
     consumed first, so over-budget projects lead. */
  const budgetRows = projects
    .filter((p) => !p.is_template)
    .map((p) => ({ p, s: budgetSummary(p, sumLoggedHours(tasksByProject.get(p.id) ?? [])) }))
    .filter((r) => r.s.hasBudget)
    .map((r) => {
      const hRatio = r.s.budgetHours ? r.s.loggedHours / r.s.budgetHours : 0;
      const aRatio = r.s.budgetAmount && r.s.actualAmount != null ? r.s.actualAmount / r.s.budgetAmount : 0;
      return { ...r, ratio: Math.max(hRatio, aRatio) };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SharedKpiCard label={t("report.totalProjects")} value={totalProjects} tone="info" />
        <SharedKpiCard label={t("report.openTasks")} value={openTasks} tone="warning" />
        <SharedKpiCard label={t("report.overdueTasks")} value={overdue} tone="rose" />
        <SharedKpiCard label={t("report.completedWk")} value={doneThisWeek} tone="positive" />
        <SharedKpiCard label={t("report.dueThisWeek", "Due this week")} value={dueThisWeek} tone="info" />
      </div>

      {projectProgress.length > 0 && (
        <div className={panel}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("report.byProject", "Project progress")}
          </h3>
          {projectProgress.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)] min-w-0">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="text-[var(--text-muted)] font-semibold tabular-nums shrink-0 ms-2">{p.done}/{p.total} · {p.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: p.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={panel}>
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
          {t("report.budget")}
        </h3>
        {budgetRows.length === 0 ? (
          <div className="text-[11px] text-[var(--text-dim)]">{t("report.noBudgets")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {budgetRows.map(({ p, s }) => (
              <div key={p.id} className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)] min-w-0">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? "#567FB2" }} />
                  <span className="truncate">{p.name}</span>
                </div>
                <BudgetMeter summary={s} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={panel}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("report.byPriority")}
          </h3>
          {(["urgent", "high", "normal", "low"] as const).map((p) => (
            <div key={p} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {t(`priority.${p}`)}
                </span>
                <span className="text-[var(--text-muted)] font-semibold">{byPriority[p]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(byPriority[p] / priorityMax) * 100}%`, background: PRIORITY_COLOR[p] }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={panel}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("report.byAssignee")}
          </h3>
          {assigneeRows.length === 0 ? (
            <div className="text-[11px] text-[var(--text-dim)]">{t("empty.noTasks")}</div>
          ) : (
            assigneeRows.map(([name, count]) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">{name}</span>
                  <span className="text-[var(--text-muted)] font-semibold">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#567FB2] transition-all" style={{ width: `${(count / assigneeMax) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

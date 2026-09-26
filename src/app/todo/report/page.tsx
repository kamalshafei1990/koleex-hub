"use client";

/* ══════════════════════════════════════════════════════════════
   ASSIGNMENT REPORT — manager view.
   "What I asked [person] to do, over [period], and how it's going."
   Only tasks the viewer assigned (assigned_by = me), so it needs no extra
   permission: a manager already sees what they delegated.

   Paints from the list's warm snapshot (same account, same rows), so opening
   it from the list is instant; the network answer replaces it.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import { fetchAssignableEmployees } from "@/lib/todo-admin";
import { collapseSeries } from "@/lib/todo-series";
import { useCurrentAccountId } from "@/lib/identity";
import { useWarm } from "@/lib/warm-cache";
import type { TodoAssigneeInfo, TodoStatus, TodoWithRelations } from "@/types/supabase";
import KdsSelect from "@/components/kds/Select";
import PageHeader from "@/components/ui/PageHeader";
import DatePicker from "@/components/ui/DatePicker";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MiniAvatar from "@/components/todo/MiniAvatar";
import { loadTodoList, todoWarmKey, type TodoSnap } from "@/components/todo/todo-data";
import { dayKey, fmtDay, horizonRange, isOverdueDate } from "@/components/todo/todo-dates";
import { statusOf } from "@/components/todo/todo-ui";

type Period = "today" | "week" | "month" | "custom";

const STATUS_TONE: Record<TodoStatus, string> = {
  todo: "text-[var(--text-dim)] bg-[var(--bg-surface)]",
  in_progress: "text-[#7FA9D6] bg-[#567FB2]/10",
  blocked: "text-red-400 bg-red-500/10",
  done: "text-green-400 bg-green-500/10",
};

/* Display name with the alternate (Chinese) name when it differs. */
function personLabel(p: { full_name: string | null; username: string; name_alt?: string | null }): string {
  const base = p.full_name || p.username;
  const alt = (p.name_alt ?? "").trim();
  return alt && alt !== (p.full_name ?? "").trim() ? `${base} (${alt})` : base;
}

const isDone = (r: TodoWithRelations) => r.completed || r.status === "done";
/* Finished after its due day (calendar days, not instants). */
const finishedLate = (r: TodoWithRelations) => {
  const done = dayKey(r.completed_at), due = dayKey(r.due_date);
  return isDone(r) && !!done && !!due && done > due;
};

/* Same ground the To-do list mounts — Core never pays for the canvas. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function TodoReportPage() {
  const { t, lang } = useTranslation(todoT);
  const aurora = useSkin() === "aurora";
  /* Subscribed, not a one-shot read: the report is filtered by "assigned by
     me", so rendering before the id lands would show an empty report. */
  const accountId = useCurrentAccountId();
  const warm = useWarm<TodoSnap>(todoWarmKey(accountId), 6 * 60 * 60 * 1000);
  const [fresh, setFresh] = useState<{ todos: TodoWithRelations[]; people: TodoAssigneeInfo[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [person, setPerson] = useState<string>(""); // "" = everyone
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([loadTodoList(attempt > 0), fetchAssignableEmployees()])
      .then(([todos, people]) => { if (alive) { setFresh({ todos, people }); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [attempt]);

  const todos = fresh?.todos ?? warm?.todos ?? null;
  const people = fresh?.people ?? warm?.employees ?? [];

  /* Tasks I assigned, to the chosen person, whose due OR created day falls
     in the period. Dead periods of a recurring series collapse with the same
     rule the list uses, so a daily task counts once, not once per day. */
  const rows = useMemo(() => {
    if (!todos) return [];
    const [start, end] = period === "custom" ? [from || "0000-01-01", to || "9999-12-31"] : horizonRange(period);
    const inRange = (v: string | null) => { const k = dayKey(v); return !!k && k >= start && k <= end; };
    return collapseSeries(todos)
      .filter((x) => x.assigned_by_account_id === accountId)
      .filter((x) => (person ? x.assignees.some((a) => a.account_id === person) : true))
      .filter((x) => inRange(x.due_date) || inRange(x.created_at))
      .sort((a, b) => (dayKey(a.due_date) ?? "9999").localeCompare(dayKey(b.due_date) ?? "9999"));
  }, [todos, accountId, person, period, from, to]);

  const stats = useMemo(() => {
    const by = (s: TodoStatus) => rows.filter((r) => statusOf(r) === s).length;
    const dueDone = rows.filter((r) => isDone(r) && r.due_date && r.completed_at);
    const onTime = dueDone.filter((r) => !finishedLate(r)).length;
    return {
      total: rows.length,
      done: rows.filter(isDone).length,
      inProgress: by("in_progress"),
      blocked: by("blocked"),
      notStarted: by("todo"),
      overdue: rows.filter((r) => !isDone(r) && isOverdueDate(r.due_date)).length,
      onTimeRate: dueDone.length ? Math.round((onTime / dueDone.length) * 100) : null,
    };
  }, [rows]);

  /* Who finished the most of what I assigned, in this period. Credit is the
     ASSIGNEE's only — observers follow a task, the work is not theirs. */
  const performers = useMemo(() => {
    const map = new Map<string, { info: TodoAssigneeInfo; count: number }>();
    rows.filter(isDone).forEach((r) => {
      const observers = new Set(((r.metadata?.observers ?? []) as { account_id?: string }[]).map((o) => o.account_id));
      r.assignees.forEach((a) => {
        if (observers.has(a.account_id)) return;
        const e = map.get(a.account_id);
        if (e) e.count++; else map.set(a.account_id, { info: a, count: 1 });
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [rows]);

  const exportCsv = () => {
    /* Headers in the reader's language; a BOM so Excel reads 中文 / العربية
       as UTF-8; dates as YYYY-MM-DD, which no spreadsheet misreads. */
    const head = [t("report.taskCol"), t("report.forCol"), t("f.status"), t("report.dueCol"), t("report.doneCol"), t("report.onTimeRate")];
    const lines = rows.map((r) => {
      const who = r.assignees.map((a) => a.full_name || a.username).join("; ");
      const onTime = isDone(r) && r.due_date && r.completed_at ? (finishedLate(r) ? t("row.late") : t("row.onTime")) : "";
      return [r.title, who, t("st." + statusOf(r)), dayKey(r.due_date) ?? "", dayKey(r.completed_at) ?? "", onTime]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `todo-report-${period}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tiles = [
    { label: t("report.assigned"), value: stats.total, color: "text-[var(--text-primary)]" },
    { label: t("st.in_progress"), value: stats.inProgress, color: "text-[#7FA9D6]" },
    { label: t("st.blocked"), value: stats.blocked, color: "text-red-400" },
    { label: t("kpi.completed"), value: stats.done, color: "text-green-400" },
    { label: t("kpi.overdue"), value: stats.overdue, color: "text-orange-400" },
    { label: t("report.notStarted"), value: stats.notStarted, color: "text-[var(--text-dim)]" },
    { label: t("report.onTimeRate"), value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`, color: "text-violet-300" },
  ];

  return (
    /* Same Aurora conversion as the list: `kx-app` remaps the app's tokens,
       the ground mounts only under the skin. */
    <div className="kx-app kx-ground-host relative bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - var(--kx-header-h, 3.5rem))" }}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <WavyBackground />
        </div>
      )}
      <div className="relative z-[1] flex flex-col min-h-0 flex-1">
        <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] w-full">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
            <div className="pt-5 pb-3">
              <PageHeader title={t("report.title")} subtitle={t("report.subtitle")} backHref="/todo"
                icon={<BarChart3Icon size={16} />} showTabs={false} />
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-4">
              <div className="flex items-center gap-1.5 w-full sm:w-auto sm:min-w-[220px]">
                <UsersIcon size={13} className="text-[var(--text-dim)] shrink-0" />
                <KdsSelect value={person} onChange={setPerson} wrapperClassName="flex-1 min-w-0"
                  options={[{ value: "", label: t("report.everyone") }, ...people.map((p) => ({ value: p.account_id, label: personLabel(p) }))]}
                  triggerClassName="h-9 w-full ps-3 pe-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] cursor-pointer text-start" />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label={t("report.period")}>
                {(["today", "week", "month", "custom"] as Period[]).map((p) => (
                  <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p}
                    className={`h-8 px-3 rounded-lg text-[12px] font-semibold border transition-colors whitespace-nowrap ${
                      period === p ? "kx-seg-on border-transparent text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                    }`}>
                    {t("report." + p)}
                  </button>
                ))}
              </div>
              {period === "custom" && (
                <div className="grid grid-cols-2 gap-1.5 w-full sm:w-[300px]">
                  <DatePicker value={from} onChange={setFrom} placeholder={t("filters.fromDate")} lang={lang} heightCls="h-9" max={to || undefined} floating />
                  <DatePicker value={to} onChange={setTo} placeholder={t("filters.toDate")} lang={lang} heightCls="h-9" min={from || undefined} floating />
                </div>
              )}
              <button type="button" onClick={exportCsv} disabled={rows.length === 0}
                className="ms-auto h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-40 flex items-center gap-1.5">
                <DownloadIcon size={13} /> {t("report.export")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5 space-y-5">
            {failed && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                <TriangleWarningIcon size={14} className="shrink-0" />
                <span className="flex-1 min-w-0">{todos ? t("err.loadStale") : t("err.loadFailed")}</span>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline underline-offset-2">{t("common.retry")}</button>
              </div>
            )}

            {!todos ? (
              !failed && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" aria-hidden>
                  {Array.from({ length: 7 }, (_, i) => <div key={i} className="h-[62px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] animate-pulse" />)}
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 [&>*]:min-w-0">
                  {tiles.map((c) => (
                    <div key={c.label} className="kx-glass rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-3">
                      <p className="text-[9.5px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">{c.label}</p>
                      <p className={`text-[20px] font-bold tabular-nums ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {performers.length > 0 && (
                  <div className="kx-glass bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AwardIcon size={14} className="text-yellow-400" />
                      <span className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("kpi.topPerformers")}</span>
                    </div>
                    <ol className="flex items-center gap-5 flex-wrap min-w-0">
                      {performers.map((p, i) => (
                        <li key={p.info.account_id} className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-bold text-[var(--text-ghost)] tabular-nums w-3">{i + 1}</span>
                          <MiniAvatar info={p.info} size={28} />
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium text-[var(--text-primary)] truncate">{p.info.full_name || p.info.username}</span>
                            <span className="block text-[10px] text-[var(--text-dim)]">{p.count} {t("kpi.completedWord")}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 gap-2 text-center px-6">
                    <p className="text-[13px] font-medium text-[var(--text-muted)]">{t("report.empty")}</p>
                    <p className="text-[12px] text-[var(--text-dim)]">{t("report.emptyHint")}</p>
                  </div>
                ) : (
                  <div className="kx-glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
                    <div className="hidden md:grid grid-cols-[minmax(0,1fr)_160px_110px_90px_130px] gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      <span>{t("report.taskCol")}</span><span>{t("report.forCol")}</span><span>{t("f.status")}</span><span>{t("report.dueCol")}</span><span>{t("report.doneCol")}</span>
                    </div>
                    {rows.map((r) => {
                      const st = statusOf(r);
                      const late = finishedLate(r);
                      const overdue = !isDone(r) && isOverdueDate(r.due_date);
                      return (
                        <div key={r.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_110px_90px_130px] gap-1 md:gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 [&>*]:min-w-0">
                          <span className={`text-[13px] font-medium truncate ${isDone(r) ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
                            <AutoTranslatedText text={r.title} plain />
                          </span>
                          <span className="text-[11.5px] text-[var(--text-muted)] truncate">{r.assignees.map(personLabel).join(", ") || "—"}</span>
                          <span><span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_TONE[st]}`}>{t("st." + st)}</span></span>
                          <span className={`text-[11.5px] ${overdue || late ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                            <span className="md:hidden text-[var(--text-dim)]">{t("report.dueCol")}: </span>{fmtDay(r.due_date, lang)}
                          </span>
                          <span className="text-[11.5px] text-[var(--text-muted)]">
                            <span className="md:hidden text-[var(--text-dim)]">{t("report.doneCol")}: </span>
                            {r.completed_at ? fmtDay(r.completed_at, lang) : "—"}
                            {late ? ` · ${t("row.late")}` : r.completed_at && r.due_date ? ` · ${t("row.onTime")}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

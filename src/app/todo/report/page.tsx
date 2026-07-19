"use client";

/* ══════════════════════════════════════════════════════════════
   ASSIGNMENT REPORT — manager view.
   "What I asked [person] to do, over [period], and how it's going."
   Uses only tasks the viewer assigned (assigned_by = me), so it needs
   no extra permission: a manager already sees what they delegated.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import { fetchTodos, fetchAssignableEmployees } from "@/lib/todo-admin";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { loadScopeContext, type ScopeContext } from "@/lib/scope";
import type { TodoWithRelations, TodoAssigneeInfo, TodoStatus } from "@/types/supabase";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import UsersIcon from "@/components/icons/ui/UsersIcon";

type Period = "today" | "week" | "month" | "custom";

/* Local-time period bounds. */
function periodRange(p: Period, from: string, to: string): [Date, Date] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (p === "today") return [startOfDay(now), endOfDay(now)];
  if (p === "week") {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    const mon = new Date(now); mon.setDate(now.getDate() - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [startOfDay(mon), endOfDay(sun)];
  }
  if (p === "month") {
    return [
      new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    ];
  }
  const f = from ? startOfDay(new Date(from)) : new Date(0);
  const t = to ? endOfDay(new Date(to)) : endOfDay(now);
  return [f, t];
}

const STATUS_TONE: Record<TodoStatus, string> = {
  todo: "text-[var(--text-dim)] bg-[var(--bg-surface)]",
  in_progress: "text-blue-400 bg-blue-500/10",
  blocked: "text-red-400 bg-red-500/10",
  done: "text-green-400 bg-green-500/10",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function TodoReportPage() {
  const { t } = useTranslation(todoT);
  const accountId = getCurrentAccountIdSync();
  const [scopeCtx, setScopeCtx] = useState<ScopeContext | null>(null);
  const [todos, setTodos] = useState<TodoWithRelations[]>([]);
  const [people, setPeople] = useState<TodoAssigneeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [person, setPerson] = useState<string>(""); // "" = everyone
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!accountId) return;
    loadScopeContext(accountId).then(setScopeCtx);
  }, [accountId]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTodos(scopeCtx), fetchAssignableEmployees()]).then(([tds, ppl]) => {
      if (!alive) return;
      setTodos(tds);
      setPeople(ppl);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [scopeCtx]);

  /* Tasks I assigned, to the chosen person, whose due OR created date falls in the period. */
  const rows = useMemo(() => {
    const [start, end] = periodRange(period, from, to);
    const inRange = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    };
    return todos
      .filter((x) => x.assigned_by_account_id === accountId)
      .filter((x) => (person ? x.assignees.some((a) => a.account_id === person) : true))
      .filter((x) => inRange(x.due_date) || inRange(x.created_at));
  }, [todos, accountId, person, period, from, to]);

  const stats = useMemo(() => {
    const total = rows.length;
    const by = (s: TodoStatus) => rows.filter((r) => (r.status ?? (r.completed ? "done" : "todo")) === s).length;
    const done = rows.filter((r) => r.completed || r.status === "done").length;
    const overdue = rows.filter((r) => !r.completed && r.due_date && r.due_date.split("T")[0] < new Date().toISOString().split("T")[0]).length;
    const dueDone = rows.filter((r) => (r.completed || r.status === "done") && r.due_date && r.completed_at);
    const onTime = dueDone.filter((r) => r.completed_at!.split("T")[0] <= r.due_date!.split("T")[0]).length;
    const onTimeRate = dueDone.length ? Math.round((onTime / dueDone.length) * 100) : null;
    return { total, done, inProgress: by("in_progress"), blocked: by("blocked"), notStarted: by("todo"), overdue, onTimeRate };
  }, [rows]);

  const exportCsv = () => {
    const head = ["Task", "For", "Status", "Due", "Done", "On time"];
    const lines = rows.map((r) => {
      const who = r.assignees.map((a) => a.full_name || a.username).join("; ");
      const st = r.status ?? (r.completed ? "done" : "todo");
      const onTime = (r.completed || r.status === "done") && r.due_date && r.completed_at
        ? (r.completed_at.split("T")[0] <= r.due_date.split("T")[0] ? "yes" : "no") : "";
      return [r.title, who, st, r.due_date?.split("T")[0] ?? "", r.completed_at?.split("T")[0] ?? "", onTime]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `todo-report-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tiles = [
    { label: t("report.assigned"), value: stats.total, color: "text-[var(--text-primary)]" },
    { label: t("st.in_progress"), value: stats.inProgress, color: "text-blue-400" },
    { label: t("st.blocked"), value: stats.blocked, color: "text-red-400" },
    { label: t("kpi.completed"), value: stats.done, color: "text-green-400" },
    { label: t("kpi.overdue"), value: stats.overdue, color: "text-orange-400" },
    { label: t("report.notStarted"), value: stats.notStarted, color: "text-[var(--text-dim)]" },
    { label: t("report.onTimeRate"), value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`, color: "text-violet-400" },
  ];

  const selectCls = "h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full" style={{ height: "calc(100dvh - 3.5rem)" }}>
      {/* Header */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3 pt-5 pb-1">
            <Link href="/todo" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <BarChart3Icon size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">{t("report.title")}</h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-3 ml-0 md:ml-11">{t("report.subtitle")}</p>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <div className="flex items-center gap-1.5">
              <UsersIcon size={13} className="text-[var(--text-dim)]" />
              <select value={person} onChange={(e) => setPerson(e.target.value)} className={selectCls + " min-w-[160px]"}>
                <option value="">{t("report.everyone")}</option>
                {people.map((p) => { const alt = (p.name_alt ?? "").trim(); const label = (p.full_name || p.username) + (alt && alt !== (p.full_name ?? "").trim() ? ` ${alt}` : ""); return <option key={p.account_id} value={p.account_id}>{label}</option>; })}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              {(["today", "week", "month", "custom"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`h-8 px-3 rounded-lg text-[12px] font-semibold border transition-all ${
                    period === p ? "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                  }`}>
                  {t("report." + p)}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
                <span className="text-[var(--text-dim)]">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
              </div>
            )}
            <button onClick={exportCsv} disabled={rows.length === 0}
              className="ms-auto h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition disabled:opacity-40">
              {t("report.export")}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20"><SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" /></div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
                {tiles.map((c) => (
                  <div key={c.label} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-3 min-w-0">
                    <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wider truncate">{c.label}</p>
                    <p className={`text-[20px] font-bold tabular-nums ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Task list */}
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                  <p className="text-[var(--text-faint)] text-sm font-medium">{t("report.empty")}</p>
                  <p className="text-[12px] text-[var(--text-dim)]">{t("report.emptyHint")}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="hidden md:grid grid-cols-[1fr_140px_120px_90px_90px] gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                    <span>{t("report.taskCol")}</span><span>{t("report.forCol")}</span><span>{t("f.status")}</span><span>{t("report.dueCol")}</span><span>{t("report.doneCol")}</span>
                  </div>
                  {rows.map((r) => {
                    const st = (r.status ?? (r.completed ? "done" : "todo")) as TodoStatus;
                    const late = (r.completed || r.status === "done") && r.due_date && r.completed_at && r.completed_at.split("T")[0] > r.due_date.split("T")[0];
                    return (
                      <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_90px_90px] gap-1 md:gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-subtle)] transition-colors">
                        <AutoTranslatedText text={r.title} className={`text-[13px] font-medium truncate ${r.completed ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`} />
                        <span className="text-[11.5px] text-[var(--text-muted)] truncate">{r.assignees.map((a) => { const base = a.full_name || a.username; const alt = (a.name_alt ?? "").trim(); return alt && alt !== (a.full_name ?? "").trim() ? `${base} (${alt})` : base; }).join(", ") || "—"}</span>
                        <span><span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_TONE[st]}`}>{t("st." + st)}</span></span>
                        <span className={`text-[11.5px] ${late ? "text-red-400" : "text-[var(--text-muted)]"}`}>{fmtDate(r.due_date)}</span>
                        <span className="text-[11.5px] text-[var(--text-muted)]">{fmtDate(r.completed_at)}{late ? ` · ${t("row.late")}` : (r.completed_at && r.due_date ? ` · ${t("row.onTime")}` : "")}</span>
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
  );
}

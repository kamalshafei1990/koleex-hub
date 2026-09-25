"use client";

/* ---------------------------------------------------------------------------
   ProjectTimeline — Gantt view of one project's tasks (+ milestones).

   · Rows are grouped by stage (board order), milestones on top as diamonds.
   · A bar runs start_date → due_date. No start_date ⇒ the task's created
     day; no due_date ⇒ a one-day bar at the start.
   · Zoom: week / month / quarter (px per day). Today line + "jump to today".
   · Drag a bar to move it, drag an edge to resize. Arrow keys nudge a
     focused bar by a day (Shift+Arrow resizes the end); the change commits
     after a short pause. The PARENT applies it optimistically, PATCHes, and
     rolls back on failure (the server validates start ≤ due).
   · blocked_by_task_ids draw dependency arrows; a task that starts before a
     blocker ends gets the warning style.
   · Rows are windowed once there are more than 200 of them.

   Direction: the time axis always runs left→right (dir="ltr" on the
   scroller — calendars read that way in every locale); labels inside keep
   the document direction and use logical alignment.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import { SpinnerIcon, TriangleWarningIcon } from "@/components/icons/ui";
import {
  addDaysISO,
  daysBetween,
  fetchMilestones,
  formatDMY,
  isOverdue,
  PRIORITY_COLOR,
  todayLocalISO,
  toISODay,
  type Milestone,
  type ProjectStage,
  type TaskRow,
} from "@/lib/projects";

type Zoom = "week" | "month" | "quarter";
const PX_PER_DAY: Record<Zoom, number> = { week: 36, month: 14, quarter: 5 };
const PAD_DAYS: Record<Zoom, number> = { week: 7, month: 14, quarter: 30 };
const ROW_H = 34;
const LABEL_W = 232;
const HEADER_H = 44;
const VIRTUALIZE_OVER = 200;
const OVERSCAN = 12;
const HUB_BLUE = "#567FB2";
const UNSTAGED = "__unstaged__";

export interface DatePatch { start_date?: string | null; due_date?: string | null }

type Row =
  | { kind: "group"; key: string; name: string; color: string | null; count: number }
  | { kind: "milestones"; key: string }
  | { kind: "task"; key: string; task: TaskRow; start: string; end: string; hasDue: boolean };

interface DragState {
  id: string;
  mode: "move" | "start" | "end";
  x0: number;
  start0: string;
  end0: string;
  start: string;
  end: string;
  moved: boolean;
}

const LOCALES: Record<string, string> = { en: "en-GB", zh: "zh-CN", ar: "ar-EG" };

function taskSpan(tk: TaskRow): { start: string; end: string; hasDue: boolean } {
  const created = tk.created_at ? toISODay(new Date(tk.created_at)) : todayLocalISO();
  let start = tk.start_date ?? (tk.due_date && tk.due_date < created ? tk.due_date : created);
  let end = tk.due_date ?? start;
  if (end < start) [start, end] = [end, start];
  return { start, end, hasDue: !!tk.due_date };
}

export default function ProjectTimeline({
  projectId,
  tasks,
  allTasks,
  stages,
  onUpdateDates,
  onOpenTask,
  readOnly = false,
}: {
  projectId: string;
  /** Rows to draw (already filtered). */
  tasks: TaskRow[];
  /** Every task in the project — blockers are looked up here. */
  allTasks: TaskRow[];
  stages: ProjectStage[];
  onUpdateDates: (task: TaskRow, patch: DatePatch) => Promise<void>;
  onOpenTask: (task: TaskRow) => void;
  /** Viewer access: bars open the task but never drag, resize or nudge. */
  readOnly?: boolean;
}) {
  const { t, lang } = useTranslation(projectsT);
  const [zoom, setZoom] = useState<Zoom>("month");
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  /* Keyboard nudges: preview until the user pauses, then commit once. */
  const [nudge, setNudge] = useState<{ id: string; start: string; end: string } | null>(null);
  const nudgeTimer = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 600 });
  const px = PX_PER_DAY[zoom];
  const today = todayLocalISO();

  useEffect(() => {
    let alive = true;
    fetchMilestones(projectId).then((m) => { if (alive) setMilestones(m); }).catch(() => { if (alive) setMilestones([]); });
    return () => { alive = false; };
  }, [projectId]);

  /* ── Rows ── */
  const rows = useMemo<Row[]>(() => {
    const stageIds = new Set(stages.map((s) => s.id));
    const groups = new Map<string, TaskRow[]>();
    for (const tk of tasks) {
      const k = tk.stage_id && stageIds.has(tk.stage_id) ? tk.stage_id : UNSTAGED;
      const arr = groups.get(k) ?? [];
      arr.push(tk);
      groups.set(k, arr);
    }
    const out: Row[] = [];
    if ((milestones ?? []).some((m) => m.due_date)) out.push({ kind: "milestones", key: "__ms__" });
    const ordered: { id: string; name: string; color: string | null }[] = [
      ...(groups.has(UNSTAGED) ? [{ id: UNSTAGED, name: t("stage.unstaged"), color: null }] : []),
      ...stages.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    ];
    for (const g of ordered) {
      const list = groups.get(g.id);
      if (!list || list.length === 0) continue;
      out.push({ kind: "group", key: `g:${g.id}`, name: g.name, color: g.color, count: list.length });
      const spans = list.map((task) => ({ task, ...taskSpan(task) }));
      spans.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.task.sort_order - b.task.sort_order);
      for (const s of spans) out.push({ kind: "task", key: s.task.id, ...s });
    }
    return out;
  }, [tasks, stages, milestones, t]);

  /* Live span for a task (drag / nudge preview wins over stored dates). */
  const liveSpan = useCallback(
    (r: Extract<Row, { kind: "task" }>) => {
      if (drag && drag.id === r.task.id) return { start: drag.start, end: drag.end };
      if (nudge && nudge.id === r.task.id) return { start: nudge.start, end: nudge.end };
      return { start: r.start, end: r.end };
    },
    [drag, nudge],
  );

  /* ── Range ── */
  const range = useMemo(() => {
    let lo = today;
    let hi = today;
    for (const r of rows) {
      if (r.kind !== "task") continue;
      if (r.start < lo) lo = r.start;
      if (r.end > hi) hi = r.end;
    }
    for (const m of milestones ?? []) {
      if (!m.due_date) continue;
      if (m.due_date < lo) lo = m.due_date;
      if (m.due_date > hi) hi = m.due_date;
    }
    let start = addDaysISO(lo, -PAD_DAYS[zoom]);
    const end = addDaysISO(hi, PAD_DAYS[zoom] * 2);
    /* Align to a Monday (week/month) or the 1st (quarter) so ticks line up. */
    const d = new Date(`${start}T12:00:00`);
    if (zoom === "quarter") start = `${start.slice(0, 8)}01`;
    else start = addDaysISO(start, -((d.getDay() + 6) % 7));
    return { start, end, days: daysBetween(start, end) + 1 };
  }, [rows, milestones, today, zoom]);
  const chartW = range.days * px;
  const xOf = useCallback((iso: string) => daysBetween(range.start, iso) * px, [range.start, px]);

  /* ── Header ticks ── */
  const ticks = useMemo(() => {
    const loc = LOCALES[lang] ?? "en-GB";
    const monthFmt = new Intl.DateTimeFormat(loc, { month: "short", year: "numeric" });
    const monthShort = new Intl.DateTimeFormat(loc, { month: "short" });
    const top: { x: number; w: number; label: string }[] = [];
    const bottom: { x: number; label: string; weekend?: boolean; w: number }[] = [];
    let cur = range.start;
    let monthStartX = 0;
    let monthLabel = "";
    for (let i = 0; i < range.days; i++) {
      const d = new Date(`${cur}T12:00:00`);
      const x = i * px;
      if (d.getDate() === 1 || i === 0) {
        if (i > 0) top.push({ x: monthStartX, w: x - monthStartX, label: monthLabel });
        monthStartX = x;
        monthLabel = zoom === "quarter" ? String(d.getFullYear()) : monthFmt.format(d);
        if (zoom === "quarter") bottom.push({ x, label: monthShort.format(d), w: 0 });
      }
      if (zoom === "week") bottom.push({ x, label: String(d.getDate()), weekend: d.getDay() === 0 || d.getDay() === 6, w: px });
      if (zoom === "month" && d.getDay() === 1) bottom.push({ x, label: formatDMY(cur, { short: true }), w: px * 7 });
      cur = addDaysISO(cur, 1);
    }
    top.push({ x: monthStartX, w: range.days * px - monthStartX, label: monthLabel });
    /* Quarter view: merge consecutive same-year labels into one span. */
    const mergedTop = zoom === "quarter"
      ? top.reduce<typeof top>((acc, m) => {
          const last = acc[acc.length - 1];
          if (last && last.label === m.label) last.w += m.w;
          else acc.push({ ...m });
          return acc;
        }, [])
      : top;
    for (let i = 0; i < bottom.length; i++) {
      if (zoom === "quarter") bottom[i].w = (bottom[i + 1]?.x ?? range.days * px) - bottom[i].x;
    }
    return { top: mergedTop, bottom };
  }, [range, px, zoom, lang]);

  /* ── Row positions + windowing ── */
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.key, i])), [rows]);
  const virtual = rows.length > VIRTUALIZE_OVER;
  const first = virtual ? Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN) : 0;
  const last = virtual ? Math.min(rows.length, Math.ceil((view.top + view.height) / ROW_H) + OVERSCAN) : rows.length;

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !virtual) return;
    setView({ top: Math.max(0, el.scrollTop - HEADER_H), height: el.clientHeight });
  };
  /* The scroller exists only once milestones are in and there are rows. */
  const ready = milestones !== null && rows.length > 0;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) setView({ top: 0, height: el.clientHeight });
  }, [ready]);

  /* Scroll today into view on first paint and whenever the zoom changes. */
  const jumpToToday = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, xOf(today) - (el.clientWidth - LABEL_W) / 3);
  }, [xOf, today]);
  useLayoutEffect(() => { jumpToToday(); }, [zoom, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Blocker lookups (full task list, not just the filtered rows) ── */
  const byId = useMemo(() => new Map(allTasks.map((tk) => [tk.id, tk])), [allTasks]);
  const blockerEnd = useCallback((id: string): string | null => {
    const b = byId.get(id);
    if (!b || b.status === "cancelled") return null;
    return taskSpan(b).end;
  }, [byId]);
  const conflicts = (tk: TaskRow, start: string) =>
    (tk.blocked_by_task_ids ?? []).some((bid) => {
      const e = blockerEnd(bid);
      return !!e && start <= e && byId.get(bid)?.status !== "done";
    });

  /* ── Drag ── */
  /* Only the dates that actually changed are sent. A task without a due
     date that is merely moved stays due-less; any op that leaves it longer
     than one day gains a due date (the bar's end). */
  const commit = useCallback(
    (r: Extract<Row, { kind: "task" }>, start: string, end: string) => {
      const patch: DatePatch = {};
      if (start !== r.start || !r.task.start_date) patch.start_date = start;
      if (r.hasDue ? end !== r.end : end !== start) patch.due_date = end;
      if (start === r.start && end === r.end) return;
      void onUpdateDates(r.task, patch);
    },
    [onUpdateDates],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, r: Extract<Row, { kind: "task" }>) => {
    if (e.button !== 0 || readOnly) return;
    const mode = ((e.target as HTMLElement).dataset.mode as DragState["mode"] | undefined) ?? "move";
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: r.task.id, mode, x0: e.clientX, start0: r.start, end0: r.end, start: r.start, end: r.end, moved: false });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dd = Math.round((e.clientX - drag.x0) / px);
    const moved = drag.moved || Math.abs(e.clientX - drag.x0) > 3;
    let start = drag.start0;
    let end = drag.end0;
    if (drag.mode === "move") { start = addDaysISO(drag.start0, dd); end = addDaysISO(drag.end0, dd); }
    if (drag.mode === "start") { start = addDaysISO(drag.start0, dd); if (start > end) start = end; }
    if (drag.mode === "end") { end = addDaysISO(drag.end0, dd); if (end < start) end = start; }
    if (start !== drag.start || end !== drag.end || moved !== drag.moved) setDrag({ ...drag, start, end, moved });
  };
  const onPointerUp = (r: Extract<Row, { kind: "task" }>) => {
    const d = drag;
    setDrag(null);
    if (!d) { if (readOnly) onOpenTask(r.task); return; }
    if (!d.moved) { onOpenTask(r.task); return; }
    commit(r, d.start, d.end);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, r: Extract<Row, { kind: "task" }>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenTask(r.task); return; }
    if (readOnly || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const cur = nudge && nudge.id === r.task.id ? nudge : { id: r.task.id, start: r.start, end: r.end };
    const next = e.shiftKey
      ? { ...cur, end: addDaysISO(cur.end, step) < cur.start ? cur.start : addDaysISO(cur.end, step) }
      : { ...cur, start: addDaysISO(cur.start, step), end: addDaysISO(cur.end, step) };
    setNudge(next);
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => {
      setNudge(null);
      commit(r, next.start, next.end);
    }, 700);
  };
  useEffect(() => () => { if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current); }, []);

  /* ── Dependency arrows (only between rows that exist; windowed) ── */
  const arrows = useMemo(() => {
    const out: { key: string; d: string; warn: boolean }[] = [];
    for (let i = first; i < last; i++) {
      const r = rows[i];
      if (!r || r.kind !== "task") continue;
      const span = liveSpan(r);
      for (const bid of r.task.blocked_by_task_ids ?? []) {
        const bi = rowIndex.get(bid);
        if (bi === undefined) continue;
        const br = rows[bi];
        if (br.kind !== "task") continue;
        const bspan = liveSpan(br);
        const x1 = xOf(bspan.end) + px;
        const y1 = bi * ROW_H + ROW_H / 2;
        const x2 = xOf(span.start);
        const y2 = i * ROW_H + ROW_H / 2;
        const d = x2 - x1 >= 16
          ? `M${x1},${y1} H${x1 + 8} V${y2} H${x2 - 2}`
          : `M${x1},${y1} h8 V${(y1 + y2) / 2} H${x2 - 10} V${y2} H${x2 - 2}`;
        out.push({ key: `${bid}>${r.task.id}`, d, warn: span.start <= bspan.end && br.task.status !== "done" });
      }
    }
    return out;
  }, [rows, first, last, rowIndex, liveSpan, xOf, px]);

  const todayX = xOf(today);
  const totalH = rows.length * ROW_H;
  const visible = rows.slice(first, last);
  const zoomLabel: Record<Zoom, string> = { week: t("tl.zoom.week"), month: t("tl.zoom.month"), quarter: t("tl.zoom.quarter") };

  if (milestones === null) {
    return <div className="flex justify-center py-16"><SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" /></div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden" role="group" aria-label={t("tl.zoom")}>
          {(["week", "month", "quarter"] as const).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              aria-pressed={zoom === z}
              className={`h-7 px-2.5 text-[11px] font-semibold transition-colors ${
                zoom === z ? "kx-seg-on rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "kx-seg-off rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {zoomLabel[z]}
            </button>
          ))}
        </div>
        <button type="button" onClick={jumpToToday} className="h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          {t("tl.jumpToday")}
        </button>
        {!readOnly && <p id={`tl-hint-${projectId}`} className="text-[11px] text-[var(--text-dim)] min-w-0">{t("tl.hint")}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] py-14 text-center text-[13px] text-[var(--text-dim)]">
          {t("tl.noDates")}
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={onScroll}
          dir="ltr"
          role="region"
          aria-label={t("tl.rows")}
          tabIndex={-1}
          className="kx-glass relative overflow-auto max-h-[70vh] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overscroll-contain"
        >
          <div style={{ width: LABEL_W + chartW, minWidth: "100%" }}>
            {/* Header */}
            <div className="sticky top-0 z-20 flex bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]" style={{ height: HEADER_H }}>
              <div className="sticky left-0 z-30 shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)]" style={{ width: LABEL_W }} />
              <div className="relative shrink-0" style={{ width: chartW }} aria-hidden>
                {ticks.top.map((m) => (
                  <div key={`t${m.x}`} className="absolute top-0 h-5 border-s border-[var(--border-subtle)] px-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] truncate leading-5" style={{ left: m.x, width: m.w }}>
                    {m.label}
                  </div>
                ))}
                {ticks.bottom.map((b) => (
                  <div
                    key={`b${b.x}`}
                    className={`absolute bottom-0 h-6 border-s border-[var(--border-subtle)] text-[10px] leading-6 tabular-nums truncate ${zoom === "week" ? "text-center" : "px-1"} ${b.weekend ? "text-[var(--text-ghost)]" : "text-[var(--text-muted)]"}`}
                    style={{ left: b.x, width: b.w }}
                  >
                    {b.label}
                  </div>
                ))}
                <div className="absolute bottom-0 h-6 flex items-center" style={{ left: todayX + px / 2 }}>
                  <span className="-translate-x-1/2 rounded bg-[#567FB2] px-1 text-[9px] font-bold uppercase text-white leading-4">{t("tl.today")}</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative" style={{ height: totalH }}>
              {/* Grid + weekends + today */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LABEL_W, width: chartW }} aria-hidden>
                {ticks.bottom.map((b) => (
                  <div key={`g${b.x}`} className={`absolute top-0 bottom-0 border-s border-[var(--border-subtle)]/60 ${b.weekend ? "bg-[var(--bg-surface)]/40" : ""}`} style={{ left: b.x, width: b.w }} />
                ))}
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#567FB2] dark:bg-[#7FA9D6] opacity-80" style={{ left: todayX + px / 2 - 1 }} />
              </div>

              {/* Dependency arrows */}
              {arrows.length > 0 && (
                <svg className="absolute top-0 pointer-events-none z-[5]" style={{ left: LABEL_W, width: chartW, height: totalH }} aria-hidden>
                  <defs>
                    <marker id="tl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="var(--text-dim)" />
                    </marker>
                    <marker id="tl-arrow-warn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="#f87171" />
                    </marker>
                  </defs>
                  {arrows.map((a) => (
                    <path key={a.key} d={a.d} fill="none" stroke={a.warn ? "#f87171" : "var(--text-dim)"} strokeWidth={1.5} strokeDasharray={a.warn ? "4 3" : undefined} markerEnd={`url(#${a.warn ? "tl-arrow-warn" : "tl-arrow"})`} />
                  ))}
                </svg>
              )}

              {visible.map((r, vi) => {
                const i = first + vi;
                const top = i * ROW_H;
                if (r.kind === "group") {
                  return (
                    <div key={r.key} className="absolute left-0 right-0 flex items-center border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]" style={{ top, height: ROW_H }}>
                      <div dir="auto" className="sticky left-0 z-10 flex items-center gap-2 px-3 h-full bg-[var(--bg-surface-subtle)] border-e border-[var(--border-subtle)]" style={{ width: LABEL_W }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color ?? "var(--border-color)" }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] truncate">{r.name}</span>
                        <span className="text-[10px] font-semibold text-[var(--text-ghost)]">{r.count}</span>
                      </div>
                    </div>
                  );
                }
                if (r.kind === "milestones") {
                  return (
                    <div key={r.key} className="absolute left-0 right-0 flex items-center border-b border-[var(--border-subtle)]" style={{ top, height: ROW_H }}>
                      <div dir="auto" className="sticky left-0 z-10 flex items-center px-3 h-full bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]" style={{ width: LABEL_W }}>
                        {t("tl.milestones")}
                      </div>
                      {(milestones ?? []).filter((m) => m.due_date).map((m) => {
                        const x = LABEL_W + xOf(m.due_date!) + px / 2;
                        const label = `${t("tl.milestone")}: ${m.name} · ${formatDMY(m.due_date)}`;
                        return (
                          <div key={m.id} className="absolute flex items-center gap-1.5" style={{ left: x - 6, top: ROW_H / 2 - 6 }} title={label}>
                            <span
                              role="img"
                              aria-label={label}
                              className={`block h-3 w-3 rotate-45 rounded-[2px] border-2 ${m.is_reached ? "bg-emerald-500 border-emerald-500" : "border-[#567FB2] bg-[var(--bg-secondary)] dark:border-[#7FA9D6]"}`}
                              style={m.color && !m.is_reached ? { borderColor: m.color } : undefined}
                            />
                            <span dir="auto" className="text-[10px] font-semibold text-[var(--text-muted)] whitespace-nowrap">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                const span = liveSpan(r);
                const x = xOf(span.start);
                const w = (daysBetween(span.start, span.end) + 1) * px;
                const warn = r.task.status === "open" && conflicts(r.task, span.start);
                const late = r.task.status === "open" && isOverdue(r.task.due_date);
                const done = r.task.status !== "open";
                const stageColor = stages.find((s) => s.id === r.task.stage_id)?.color ?? HUB_BLUE;
                const active = drag?.id === r.task.id || nudge?.id === r.task.id;
                const aria = `${t("tl.bar").replace("{title}", r.task.title).replace("{start}", formatDMY(span.start)).replace("{end}", formatDMY(span.end))}${warn ? ` — ${t("tl.blockedWarn")}` : ""}${!r.hasDue ? ` — ${t("tl.noDue")}` : ""}`;
                return (
                  <div key={r.key} className="absolute left-0 right-0 border-b border-[var(--border-subtle)]/60" style={{ top, height: ROW_H }}>
                    <button
                      type="button"
                      dir="auto"
                      onClick={() => onOpenTask(r.task)}
                      className="sticky left-0 z-10 flex items-center gap-2 px-3 h-full bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] text-start hover:bg-[var(--bg-surface-subtle)]"
                      style={{ width: LABEL_W }}
                    >
                      <span className="w-1 h-4 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[r.task.priority] }} />
                      <span className={`flex-1 min-w-0 truncate text-[12px] ${done ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{r.task.title}</span>
                      {warn && <TriangleWarningIcon size={11} className="shrink-0 text-rose-400" aria-hidden />}
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => onPointerDown(e, r)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => onPointerUp(r)}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => onKeyDown(e, r)}
                      aria-label={aria}
                      aria-describedby={readOnly ? undefined : `tl-hint-${projectId}`}
                      title={aria}
                      className={`group/bar absolute z-[6] rounded-md select-none ${readOnly ? "cursor-pointer" : "touch-none cursor-grab active:cursor-grabbing"} outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2] ${
                        active ? "shadow-lg ring-2 ring-[#567FB2]/60" : ""
                      } ${warn ? "ring-2 ring-rose-400 ring-offset-1 ring-offset-[var(--bg-secondary)]" : late ? "ring-1 ring-rose-400/70" : ""} ${done ? "opacity-50" : ""}`}
                      style={{
                        left: LABEL_W + x,
                        width: Math.max(w, 6),
                        top: 7,
                        height: ROW_H - 14,
                        background: r.hasDue ? stageColor : `repeating-linear-gradient(135deg, ${stageColor}, ${stageColor} 4px, transparent 4px, transparent 8px)`,
                        border: r.hasDue ? undefined : `1px solid ${stageColor}`,
                      }}
                    >
                      <span
                        className="absolute inset-0 rounded-md"
                        style={{ background: `linear-gradient(to right, rgba(255,255,255,0.28) ${Math.min(100, Math.max(0, r.task.progress_pct ?? 0))}%, transparent 0)` }}
                        aria-hidden
                      />
                      {!readOnly && <span data-mode="start" className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-s-md opacity-0 group-hover/bar:opacity-100 bg-black/20" aria-hidden />}
                      {!readOnly && <span data-mode="end" className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-e-md opacity-0 group-hover/bar:opacity-100 bg-black/20" aria-hidden />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

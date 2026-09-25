"use client";

/* ---------------------------------------------------------------------------
   TimelineView — the schedule on an hour axis. One row per resource (plus the
   open-shifts row); each item sits at its real start and end.

     · Day   — the whole day, 64px an hour, opened scrolled to 06:00.
     · Week  — seven days side by side, 06:00–22:00 each, 14px an hour.

   Times are read on the planner's clock (lib/planning-tz): the Calendar's
   timezone preference when they set one, else the browser's zone — the
   same clock as the week grid, so both views put an item on the same day.
   `days` are wall dates in that zone.

   Editing (only items the caller may write): drag a bar to move it — across
   time and onto another row — or drag its end edge to resize. Everything
   snaps to 15 minutes. Keyboard: Arrow ←/→ moves by 15 minutes, Shift+Arrow
   changes the end, Enter opens the item. The parent applies each change
   optimistically and rolls back if the server refuses (conflicts included).

   RTL: positions are logical (inset-inline-start) and pointer maths runs
   from the inline-start edge, so the axis mirrors in Arabic.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import { toWall, zonedParts, zonedToUtc } from "@/lib/calendar-tz";
import {
  dateKey,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_LABELS,
  type PlanningItem,
} from "@/lib/planning";
import { AWAY_HATCH, type AwaySlice } from "@/lib/planning-away";
import { fmtDMY } from "@/lib/finance/format";

export interface TimelineRow {
  /** "__open__" for the open-shifts row, else the resource id. */
  id: string;
  name: string;
  sub: string | null;
  color: string | null;
  resourceId: string | null;
}

export interface TimelinePatch {
  start_at: string;
  end_at: string;
  resource_id: string | null;
}

const H = 3_600_000;
const SNAP = 15 * 60_000;
const LANE_H = 26;
const ROW_PAD = 6;
const HEAD_W = 180;

const snap = (ms: number) => Math.round(ms / SNAP) * SNAP;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtHM = (ms: number, tz: string) => {
  const p = zonedParts(ms, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
};

interface Drag {
  id: string;
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
  grabOffset: number;
  origStart: number;
  origEnd: number;
  origRow: string;
  start: number;
  end: number;
  rowId: string;
  moved: boolean;
}

export default function TimelineView({
  days,
  range,
  rows,
  items,
  tz,
  conflictIds,
  leaveCells,
  awayCells,
  awayTip,
  canWrite,
  onItemClick,
  onMove,
  onCreateAt,
}: {
  days: Date[];
  range: "day" | "week";
  rows: TimelineRow[];
  items: PlanningItem[];
  tz: string;
  conflictIds: Set<string>;
  leaveCells: Set<string>;
  /** Calendar out-of-office, `resource|dayKey` → that day's slices (planning-away). */
  awayCells: Map<string, AwaySlice[]>;
  /** Tooltip text for a day's slices — a time span only, never a title. */
  awayTip: (slices: AwaySlice[]) => string;
  canWrite: (i: PlanningItem) => boolean;
  onItemClick: (i: PlanningItem) => void;
  onMove: (id: string, patch: TimelinePatch) => void;
  onCreateAt: (resourceId: string | null, start: Date) => void;
}) {
  const { t, lang } = useTranslation(planningT);
  const hintId = useId();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const hFrom = range === "day" ? 0 : 6;
  const hTo = range === "day" ? 24 : 22;
  const pxPerHour = range === "day" ? 64 : 14;
  const dayWidth = (hTo - hFrom) * pxPerHour;
  const totalWidth = dayWidth * days.length;

  /* The instant each shown day starts on the planner's clock. */
  const dayStarts = useMemo(
    () => days.map((d) => zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, 0, 0, tz)),
    [days, tz],
  );
  const dayKeys = useMemo(() => days.map(dateKey), [days]);

  const xOf = useCallback(
    (ms: number, i: number) => {
      const raw = (ms - dayStarts[i]) / H;
      const clamped = Math.min(hTo, Math.max(hFrom, raw));
      return i * dayWidth + (clamped - hFrom) * pxPerHour;
    },
    [dayStarts, hFrom, hTo, dayWidth, pxPerHour],
  );

  const timeAtX = useCallback(
    (x: number) => {
      const i = Math.min(days.length - 1, Math.max(0, Math.floor(x / dayWidth)));
      const within = Math.min(dayWidth, Math.max(0, x - i * dayWidth));
      return dayStarts[i] + (hFrom + within / pxPerHour) * H;
    },
    [days.length, dayWidth, dayStarts, hFrom, pxPerHour],
  );

  /* Open on 06:00 in Day range (the default 06–22 window); scroll stays free. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const target = range === "day" ? 6 * pxPerHour : 0;
    el.scrollLeft = rtl ? -target : target;
  }, [range, pxPerHour, days]);

  /* ── Drag state: a ref for the maths, state for the paint ── */
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  /* Window listeners of the drag in flight (removed on release/unmount). */
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);
  const stopListening = () => {
    const l = listenersRef.current;
    if (!l) return;
    window.removeEventListener("pointermove", l.move);
    window.removeEventListener("pointerup", l.up);
    window.removeEventListener("pointercancel", l.up);
    listenersRef.current = null;
  };
  useEffect(() => stopListening, []);

  const beginDrag = (e: React.PointerEvent, item: PlanningItem, mode: "move" | "resize", rowId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const track = (e.currentTarget as HTMLElement).closest("[data-tl-track]") as HTMLElement | null;
    if (!track) return;
    stopListening();
    const rect = track.getBoundingClientRect();
    const rtl = getComputedStyle(track).direction === "rtl";
    const toX = (clientX: number) => (rtl ? rect.right - clientX : clientX - rect.left);
    const s = Date.parse(item.start_at);
    const en = Date.parse(item.end_at);
    const writable = canWrite(item);
    const initial: Drag = {
      id: item.id,
      mode,
      pointerX: e.clientX,
      pointerY: e.clientY,
      grabOffset: timeAtX(toX(e.clientX)) - s,
      origStart: s,
      origEnd: en,
      origRow: rowId,
      start: s,
      end: en,
      rowId,
      moved: false,
    };
    dragRef.current = initial;

    const move = (ev: PointerEvent) => {
      const dd = dragRef.current;
      if (!dd || !writable) return;
      const moved = dd.moved || Math.hypot(ev.clientX - dd.pointerX, ev.clientY - dd.pointerY) > 4;
      if (!moved) return;
      const x = toX(ev.clientX);
      let { start, end, rowId: target } = dd;
      if (dd.mode === "move") {
        start = snap(timeAtX(x) - dd.grabOffset);
        end = start + (dd.origEnd - dd.origStart);
        const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-tl-row]")?.getAttribute("data-tl-row");
        if (under && rowById.has(under)) target = under;
      } else {
        end = Math.max(dd.origStart + SNAP, snap(timeAtX(x)));
      }
      const next = { ...dd, start, end, rowId: target, moved };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      const dd = dragRef.current;
      stopListening();
      dragRef.current = null;
      setDrag(null);
      if (!dd) return;
      if (!dd.moved) {
        onItemClick(item);
        return;
      }
      if (dd.start === dd.origStart && dd.end === dd.origEnd && dd.rowId === dd.origRow) return;
      const row = rowById.get(dd.rowId);
      onMove(dd.id, {
        start_at: new Date(dd.start).toISOString(),
        end_at: new Date(dd.end).toISOString(),
        resource_id: row ? row.resourceId : item.resource_id,
      });
    };
    listenersRef.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onBarKey = (e: React.KeyboardEvent, item: PlanningItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onItemClick(item);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!canWrite(item)) return;
    e.preventDefault();
    const rtl = getComputedStyle(e.currentTarget as HTMLElement).direction === "rtl";
    const sign = (e.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
    const s = Date.parse(item.start_at);
    const en = Date.parse(item.end_at);
    const patch = e.shiftKey
      ? { start: s, end: Math.max(s + SNAP, en + sign * SNAP) }
      : { start: s + sign * SNAP, end: en + sign * SNAP };
    onMove(item.id, {
      start_at: new Date(patch.start).toISOString(),
      end_at: new Date(patch.end).toISOString(),
      resource_id: item.resource_id,
    });
  };

  /* ── Layout: rows → lanes (overlapping items stack) ── */
  const windowStart = dayStarts[0] + hFrom * H;
  const windowEnd = dayStarts[dayStarts.length - 1] + hTo * H;
  const laidOut = useMemo(() => {
    const byRow = new Map<string, Array<{ item: PlanningItem; s: number; e: number }>>();
    for (const it of items) {
      const isDragged = drag?.id === it.id;
      const s = isDragged ? drag.start : Date.parse(it.start_at);
      const e = isDragged ? drag.end : Date.parse(it.end_at);
      const rowId = isDragged ? drag.rowId : it.resource_id ?? "__open__";
      if (e <= windowStart || s >= windowEnd) continue;
      const arr = byRow.get(rowId) ?? [];
      arr.push({ item: it, s, e });
      byRow.set(rowId, arr);
    }
    const out = new Map<string, { lanes: number; bars: Array<{ item: PlanningItem; s: number; e: number; lane: number }> }>();
    for (const [rowId, arr] of byRow) {
      arr.sort((a, b) => a.s - b.s || a.e - b.e);
      const laneEnds: number[] = [];
      const bars = arr.map((b) => {
        let lane = laneEnds.findIndex((end) => end <= b.s);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(b.e);
        } else laneEnds[lane] = b.e;
        return { ...b, lane };
      });
      out.set(rowId, { lanes: Math.max(1, laneEnds.length), bars });
    }
    return out;
  }, [items, drag, windowStart, windowEnd]);

  /* Segments of [s, e) inside each shown day's window. */
  const segmentsOf = (s: number, e: number) => {
    const segs: Array<{ x: number; w: number; first: boolean; last: boolean }> = [];
    for (let i = 0; i < days.length; i++) {
      const ws = dayStarts[i] + hFrom * H;
      const we = dayStarts[i] + hTo * H;
      const a = Math.max(s, ws);
      const b = Math.min(e, we);
      if (b <= a) continue;
      const x = xOf(a, i);
      segs.push({ x, w: Math.max(6, xOf(b, i) - x), first: a === s, last: b === e });
    }
    return segs;
  };

  const hourTicks = useMemo(() => {
    const step = range === "day" ? 1 : 3;
    const ticks: Array<{ x: number; label: string; major: boolean }> = [];
    days.forEach((_, i) => {
      for (let h = hFrom; h < hTo; h += step) {
        ticks.push({ x: i * dayWidth + (h - hFrom) * pxPerHour, label: `${pad(h)}:00`, major: h === hFrom });
      }
    });
    return ticks;
  }, [days, range, hFrom, hTo, dayWidth, pxPerHour]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowX = (() => {
    for (let i = 0; i < days.length; i++) {
      if (nowMs >= dayStarts[i] + hFrom * H && nowMs < dayStarts[i] + hTo * H) return xOf(nowMs, i);
    }
    return null;
  })();

  const weekday = (d: Date) => d.toLocaleDateString(lang, { weekday: "short" });

  return (
    <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <p id={hintId} className="sr-only">{t("tl.itemHint")}</p>
      <div ref={scrollerRef} className="overflow-x-auto" role="grid" aria-label={t("sched.view.timeline")} aria-describedby={hintId}>
        <div style={{ width: HEAD_W + totalWidth }}>
          {/* Axis header */}
          <div role="row" className="flex border-b border-[var(--border-subtle)]">
            <div
              role="columnheader"
              className="sticky z-20 shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]"
              style={{ width: HEAD_W, insetInlineStart: 0 }}
            >
              {t("sched.resource")}
            </div>
            <div className="relative" style={{ width: totalWidth, height: range === "week" ? 44 : 30 }}>
              {range === "week" &&
                days.map((d, i) => (
                  <div
                    key={dayKeys[i]}
                    role="columnheader"
                    className="absolute top-0 h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] border-s border-[var(--border-subtle)] truncate"
                    style={{ insetInlineStart: i * dayWidth, width: dayWidth }}
                  >
                    {weekday(d)} {fmtDMY(d).slice(0, 5)}
                  </div>
                ))}
              {hourTicks.map((tk) => (
                <div
                  key={tk.x}
                  aria-hidden="true"
                  className={`absolute bottom-0 ps-1 text-[9px] tabular-nums text-[var(--text-dim)] border-s ${tk.major ? "border-[var(--border-color)] h-full" : "border-[var(--border-subtle)] h-4"}`}
                  style={{ insetInlineStart: tk.x }}
                >
                  {tk.label}
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => {
            const lay = laidOut.get(row.id);
            const height = Math.max(44, (lay?.lanes ?? 1) * (LANE_H + 2) + ROW_PAD * 2);
            return (
              <div key={row.id} role="row" data-tl-row={row.id} className="flex border-b last:border-b-0 border-[var(--border-subtle)]">
                <div
                  role="rowheader"
                  className="sticky z-10 shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] px-3 flex items-center gap-2"
                  style={{ width: HEAD_W, insetInlineStart: 0 }}
                >
                  <div className="w-1.5 h-7 rounded-full shrink-0" style={{ background: row.color ?? "var(--border-subtle)" }} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{row.name}</div>
                    {row.sub && <div className="text-[10px] text-[var(--text-dim)] truncate">{row.sub}</div>}
                  </div>
                </div>
                <div
                  role="gridcell"
                  data-tl-track
                  className="relative cursor-copy"
                  style={{ width: totalWidth, height }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
                    const x = rtl ? rect.right - e.clientX : e.clientX - rect.left;
                    onCreateAt(row.resourceId, new Date(Math.floor(timeAtX(x) / SNAP) * SNAP));
                  }}
                >
                  {/* Day separators + approved leave shading */}
                  {days.map((_, i) => (
                    <div
                      key={dayKeys[i]}
                      aria-hidden="true"
                      className={`absolute top-0 bottom-0 border-s pointer-events-none ${
                        row.resourceId && leaveCells.has(`${row.resourceId}|${dayKeys[i]}`)
                          ? "bg-amber-500/10 border-amber-500/30"
                          : i > 0
                            ? "border-[var(--border-color)]"
                            : "border-transparent"
                      }`}
                      style={{ insetInlineStart: i * dayWidth, width: dayWidth }}
                    >
                      {row.resourceId && leaveCells.has(`${row.resourceId}|${dayKeys[i]}`) && (
                        <span className="absolute top-0.5 start-1 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                          {t("sched.onLeave")}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Calendar out-of-office — hatched at its real hours, with
                      a tooltip; below the bars so items stay grabbable. */}
                  {row.resourceId &&
                    days.map((_, i) => {
                      const slices = awayCells.get(`${row.resourceId}|${dayKeys[i]}`);
                      if (!slices?.length) return null;
                      return slices.map((sl) => {
                        const x0 = xOf(sl.fromMs, i);
                        const x1 = sl.full ? (i + 1) * dayWidth : xOf(sl.toMs, i);
                        const left = sl.full ? i * dayWidth : x0;
                        if (x1 - left < 1) return null;
                        return (
                          <div
                            key={`away-${dayKeys[i]}-${sl.fromMs}`}
                            title={awayTip([sl])}
                            aria-label={awayTip([sl])}
                            className="absolute top-0 bottom-0 border-x border-dashed border-slate-500/40 cursor-help overflow-hidden"
                            style={{ insetInlineStart: left, width: x1 - left, backgroundImage: AWAY_HATCH }}
                          >
                            {x1 - left >= 48 && (
                              <span className="absolute bottom-0.5 start-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 whitespace-nowrap pointer-events-none">
                                {t("sched.outOfOffice")}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })}
                  {hourTicks.map((tk) =>
                    tk.major ? null : (
                      <div
                        key={tk.x}
                        aria-hidden="true"
                        className="absolute top-0 bottom-0 border-s border-[var(--border-subtle)] opacity-60 pointer-events-none"
                        style={{ insetInlineStart: tk.x }}
                      />
                    ),
                  )}
                  {nowX != null && (
                    <div
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 w-px bg-[#567FB2] dark:bg-[#7FA9D6] pointer-events-none z-[1]"
                      style={{ insetInlineStart: nowX }}
                    />
                  )}

                  {(lay?.bars ?? []).map(({ item, s, e, lane }) => {
                    const color = item.role?.color ?? ITEM_TYPE_COLOR[item.type];
                    const label = item.title || t(`type.${item.type}`, ITEM_TYPE_LABELS[item.type]);
                    const writable = canWrite(item);
                    const isDragged = drag?.id === item.id;
                    const range_ = `${fmtHM(s, tz)}–${fmtHM(e, tz)}`;
                    return segmentsOf(s, e).map((seg, si) => (
                      <div
                        key={`${item.id}-${si}`}
                        role="button"
                        tabIndex={si === 0 ? 0 : -1}
                        aria-label={`${label}, ${fmtDMY(toWall(s, tz))} ${range_}, ${t(`status.${item.status}`)}${writable ? "" : `, ${t("tl.readOnly")}`}`}
                        aria-describedby={writable ? hintId : undefined}
                        onPointerDown={(ev) => beginDrag(ev, item, "move", item.resource_id ?? "__open__")}
                        onKeyDown={(ev) => onBarKey(ev, item)}
                        className={`absolute rounded-md text-[10px] leading-tight overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2] ${
                          writable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                        } ${item.status === "draft" ? "border border-dashed" : "border border-transparent"} ${
                          conflictIds.has(item.id) ? "ring-1 ring-red-500/70" : ""
                        } ${isDragged ? "opacity-80 shadow-lg z-10 pointer-events-none" : "hover:brightness-105"}`}
                        style={{
                          insetInlineStart: seg.x,
                          width: seg.w,
                          top: ROW_PAD + lane * (LANE_H + 2),
                          height: LANE_H,
                          background: `${color}2e`,
                          borderColor: item.status === "draft" ? color : undefined,
                          borderInlineStartWidth: seg.first ? 3 : undefined,
                          borderInlineStartStyle: seg.first ? "solid" : undefined,
                          borderInlineStartColor: seg.first ? color : undefined,
                          touchAction: "none",
                        }}
                      >
                        <div className="px-1.5 pt-0.5 font-bold text-[var(--text-primary)] truncate">{label}</div>
                        {seg.w > 60 && <div className="px-1.5 text-[9px] tabular-nums text-[var(--text-dim)] truncate">{range_}</div>}
                        {writable && seg.last && (
                          <div
                            aria-hidden="true"
                            title={t("tl.resize")}
                            onPointerDown={(ev) => beginDrag(ev, item, "resize", item.resource_id ?? "__open__")}
                            className="absolute top-0 bottom-0 end-0 w-2 cursor-ew-resize hover:bg-[var(--text-primary)]/10"
                          />
                        )}
                      </div>
                    ));
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

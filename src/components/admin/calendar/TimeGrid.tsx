"use client";

/* ---------------------------------------------------------------------------
   TimeGrid — the hour grid WeekView (7 columns) and DayView (1 column) share.

   · An ALL-DAY strip under the day headers holds all-day items (to-dos,
     project tasks, leave, all-day events) and dated holidays. They are never
     drawn as 24-hour blocks over the hours.
   · The hours scroll inside the grid, which opens at the start of the
     account's working hours; the day headers and the strip stay put.
   · Every hour slot is a button (keyboard, screen readers).
   · The "now" line follows `now`, which CalendarApp advances every minute.
   · Drag to reschedule: an editable timed block (`canDrag`) moves with the
     mouse or pen — up/down in 15-minute steps, across to another day — and
     its bottom edge resizes it. Pointer events; a touch never starts a drag,
     so a phone keeps scrolling and tapping. Escape cancels. On release the
     shell gets the new WALL start/end (`onEventMove`) and saves it.
   · An event with a meeting link on today carries a Join button.

   All dates are WALL dates of the calendar's timezone (calendar-utils).
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import type { AccountPreferences } from "@/types/supabase";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import {
  HOURS_OF_DAY,
  colorForEvent,
  dayLanes,
  eventLayoutInDay,
  formatDMY,
  formatHourLabel,
  formatTime,
  isSameDay,
  isToday,
  isoDateKey,
  isoWeekday,
  joinableNow,
  laneStyle,
  nowOffsetPx,
  snapMinutes,
  startOfDay,
  workingHoursBand,
} from "@/lib/calendar-utils";
import EventChip, { JoinLink, type ChipLabels } from "./EventChip";

interface Props {
  days: Date[];
  today: Date;
  now: Date;
  eventsByDay: Map<string, CalendarFeedEvent[]>;
  holidaysByDay?: Record<string, HolidayInstance[]>;
  restDays?: Map<number, string>;
  preferences: AccountPreferences;
  hourHeight: number;
  timeColWidth: number;
  /** Tailwind min-width classes for the scrolling body. */
  minWidthClass: string;
  showDayHeader: boolean;
  /** Bigger blocks with location (the day view). */
  roomy?: boolean;
  chipLabels: ChipLabels;
  onDayClick?: (d: Date) => void;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarFeedEvent) => void;
  /** May this block be dragged (rescheduled) here? */
  canDrag?: (e: CalendarFeedEvent) => boolean;
  /** A drag ended on a new time: the new WALL start and end. */
  onEventMove?: (e: CalendarFeedEvent, start: Date, end: Date) => void;
}

interface DragState {
  ev: CalendarFeedEvent;
  mode: "move" | "resize";
  x0: number;
  y0: number;
  dayIndex: number;
  startMin: number;
  endMin: number;
  moved: boolean;
}

interface Preview { id: string; ev: CalendarFeedEvent; dayIndex: number; startMin: number; endMin: number }

const STRIP_MAX = 3;
const DAY_MIN = 24 * 60;
const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const HOLIDAY_COLOR = EVENT_TYPE_COLORS.holiday;
const DEFAULT_WH = { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };

export default function TimeGrid({
  days,
  today,
  now,
  eventsByDay,
  holidaysByDay,
  restDays,
  preferences,
  hourHeight,
  timeColWidth,
  minWidthClass,
  showDayHeader,
  roomy = false,
  chipLabels,
  onDayClick,
  onNewEventAtSlot,
  onEventClick,
  canDrag,
  onEventMove,
}: Props) {
  const { t } = useTranslation(calendarT);
  const wh = preferences.calendar?.working_hours || DEFAULT_WH;
  const band = workingHoursBand(wh, hourHeight);
  const cols = `${timeColWidth}px repeat(${days.length}, minmax(0, 1fr))`;

  /* Open at the working day, not at midnight. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const openAt = Math.max(0, band.topPx - hourHeight / 2);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = openAt;
  }, [openAt]);

  /* ── Drag to reschedule ── */
  const colRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  /** A block can be dragged when the shell allows it and it sits inside one
   *  day (a block running past midnight is edited in the form). */
  function draggable(ev: CalendarFeedEvent): boolean {
    if (!onEventMove || !canDrag?.(ev)) return false;
    const s = new Date(ev.start_at);
    const e = new Date(ev.end_at);
    return isSameDay(s, new Date(Math.max(s.getTime(), e.getTime() - 1)));
  }

  /* The block can change column mid-drag (it is re-drawn in the day it would
     land on), so the drag listens on the window, not on the element. The
     listeners read the latest state through refs. */
  const previewRef = useRef<Preview | null>(null);
  const handlersRef = useRef<{ move: (e: PointerEvent) => void; end: (commit: boolean) => void } | null>(null);

  function showPreview(p: Preview | null) {
    previewRef.current = p;
    setPreview(p);
  }

  function beginDrag(e: React.PointerEvent<HTMLElement>, ev: CalendarFeedEvent, dayIndex: number, mode: DragState["mode"]) {
    if (e.pointerType === "touch" || e.button !== 0 || dragRef.current) return;
    e.stopPropagation();
    const s = new Date(ev.start_at);
    const en = new Date(ev.end_at);
    const startMin = minuteOfDay(s);
    const endMin = isSameDay(s, en) ? minuteOfDay(en) : DAY_MIN;
    dragRef.current = { ev, mode, x0: e.clientX, y0: e.clientY, dayIndex, startMin, endMin, moved: false };

    const onMove = (pe: PointerEvent) => handlersRef.current?.move(pe);
    const onUp = () => { cleanup(); handlersRef.current?.end(true); };
    const onCancel = () => { cleanup(); handlersRef.current?.end(false); };
    const onKey = (ke: KeyboardEvent) => {
      if (ke.key !== "Escape") return;
      ke.stopPropagation();
      cleanup();
      handlersRef.current?.end(false);
    };
    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  }

  function columnAt(x: number, fallback: number): number {
    const i = colRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    return i < 0 ? fallback : i;
  }

  function moveDrag(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    e.preventDefault();
    const dMin = (dy / hourHeight) * 60;
    const dur = d.endMin - d.startMin;
    if (d.mode === "resize") {
      const endMin = Math.min(DAY_MIN, Math.max(d.startMin + 15, snapMinutes(d.endMin + dMin)));
      showPreview({ id: d.ev.id, ev: d.ev, dayIndex: d.dayIndex, startMin: d.startMin, endMin });
      return;
    }
    const startMin = Math.min(DAY_MIN - Math.max(dur, 15), Math.max(0, snapMinutes(d.startMin + dMin)));
    showPreview({ id: d.ev.id, ev: d.ev, dayIndex: columnAt(e.clientX, d.dayIndex), startMin, endMin: startMin + dur });
  }

  function endDrag(commit: boolean) {
    const d = dragRef.current;
    dragRef.current = null;
    const p = previewRef.current;
    showPreview(null);
    if (!d || !d.moved) return;
    /* The click that follows the release must not open the event. */
    suppressClickRef.current = true;
    setTimeout(() => { suppressClickRef.current = false; }, 0);
    if (!commit || !p) return;
    if (p.dayIndex === d.dayIndex && p.startMin === d.startMin && p.endMin === d.endMin) return;
    const base = startOfDay(days[p.dayIndex] ?? days[d.dayIndex]);
    const start = new Date(base);
    start.setMinutes(p.startMin);
    const end = new Date(base);
    end.setMinutes(p.endMin);
    onEventMove?.(d.ev, start, end);
  }

  useEffect(() => {
    handlersRef.current = { move: moveDrag, end: endDrag };
  });

  const perDay = days.map((day, index) => {
    const key = isoDateKey(day);
    let list = eventsByDay.get(key) ?? [];
    /* While dragging, the block is drawn where it would land. */
    if (preview) {
      list = list.filter((e) => e.id !== preview.id);
      if (index === preview.dayIndex) {
        const s = new Date(startOfDay(day)); s.setMinutes(preview.startMin);
        const en = new Date(startOfDay(day)); en.setMinutes(preview.endMin);
        list = [...list, { ...preview.ev, start_at: s.toISOString(), end_at: en.toISOString() }];
      }
    }
    return {
      day,
      key,
      allDay: list.filter((e) => e.all_day),
      timed: list.filter((e) => !e.all_day),
      holidays: holidaysByDay?.[key] ?? [],
    };
  });
  const hasStrip = perDay.some((d) => d.allDay.length > 0 || d.holidays.length > 0);

  function slotDate(day: Date, hour: number): Date {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  return (
    <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: "min(72vh, 880px)" }}>
      <div className={minWidthClass}>
        <div className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          {/* Day header */}
          {showDayHeader && (
            <div className="grid" style={{ gridTemplateColumns: cols }}>
              <div />
              {days.map((day) => {
                const iso = isoWeekday(day);
                const isWorking = wh.days.includes(iso);
                const isTodayCol = isToday(day, today);
                const rest = restDays?.get(iso);
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    onClick={() => onDayClick?.(day)}
                    title={rest}
                    aria-label={t("day.open").replace("{date}", formatDMY(day))}
                    aria-current={isTodayCol ? "date" : undefined}
                    className={`text-center py-2.5 border-s border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                      isWorking ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      {t(`wd.${iso}`)}
                      {rest && <span className="ms-1 inline-block h-1 w-1 rounded-full align-middle" style={{ backgroundColor: HOLIDAY_COLOR }} aria-hidden />}
                    </div>
                    <div
                      className={`inline-flex items-center justify-center h-7 min-w-7 px-2 mt-1 rounded-full text-[13px] font-bold ${
                        isTodayCol ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* All-day strip */}
          {hasStrip && (
            <div className={`grid ${showDayHeader ? "border-t border-[var(--border-subtle)]" : ""}`} style={{ gridTemplateColumns: cols }}>
              <div className="flex items-start justify-end pe-2 pt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {t("allDay.row")}
              </div>
              {perDay.map(({ day, key, allDay, holidays }) => {
                const room = Math.max(0, STRIP_MAX - holidays.length);
                const shown = allDay.slice(0, room);
                const extra = allDay.length - shown.length;
                return (
                  <div key={key} className="border-s border-[var(--border-subtle)] p-1 space-y-1 min-w-0">
                    {holidays.map((h) => (
                      <div
                        key={h.id}
                        className="w-full flex items-center h-[18px] px-1.5 rounded text-[10px] font-semibold truncate"
                        style={{ backgroundColor: HOLIDAY_COLOR + "22", color: HOLIDAY_COLOR, borderInlineStart: `2px solid ${HOLIDAY_COLOR}` }}
                        title={`${h.name}${h.country ? " · " + h.country : ""}`}
                      >
                        <span className="truncate">{h.name}</span>
                      </div>
                    ))}
                    {shown.map((ev) => (
                      <EventChip key={ev.id} ev={ev} labels={chipLabels} onClick={onEventClick} showTime={false} now={now} />
                    ))}
                    {extra > 0 && (
                      <button
                        type="button"
                        onClick={() => onDayClick?.(day)}
                        className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] ps-1"
                        aria-label={t("month.moreAria").replace("{n}", String(allDay.length)).replace("{date}", formatDMY(day))}
                      >
                        +{extra} {t("month.more")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time grid */}
        <div className="grid relative" style={{ gridTemplateColumns: cols }}>
          {/* Hour labels */}
          <div className="flex flex-col">
            {HOURS_OF_DAY.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pe-2 pt-1 border-b border-[var(--border-subtle)]"
                style={{ height: hourHeight }}
              >
                <span className="text-[10px] font-medium text-[var(--text-dim)] tabular-nums">{formatHourLabel(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {perDay.map(({ day, key, timed }, dayIndex) => {
            const isWorking = wh.days.includes(isoWeekday(day));
            const lanes = dayLanes(timed, day, hourHeight);
            const nowPx = isToday(day, today) ? nowOffsetPx(now, hourHeight) : null;
            return (
              <div
                key={key}
                ref={(el) => { colRefs.current[dayIndex] = el; }}
                className={`relative border-s border-[var(--border-subtle)] ${isWorking ? "" : "bg-[var(--bg-primary)]/30"}`}
              >
                {isWorking && band.heightPx > 0 && (
                  <div
                    className="absolute inset-x-0 bg-[var(--bg-surface-subtle)]/50 pointer-events-none"
                    style={{ top: band.topPx, height: band.heightPx }}
                  />
                )}

                {HOURS_OF_DAY.map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() => onNewEventAtSlot?.(slotDate(day, h))}
                    aria-label={t("slot.new").replace("{time}", `${formatDMY(day)} ${formatHourLabel(h)}`)}
                    className="block w-full border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 focus-visible:bg-[var(--bg-surface-subtle)] focus-visible:outline-none cursor-pointer transition-colors"
                    style={{ height: hourHeight }}
                  />
                ))}

                {timed.map((ev) => {
                  const { topPx, heightPx } = eventLayoutInDay(ev, day, hourHeight);
                  const color = colorForEvent(ev);
                  const declined = ev.invite_status === "declined";
                  const range = `${formatTime(new Date(ev.start_at))} – ${formatTime(new Date(ev.end_at))}`;
                  const canMove = draggable(ev);
                  const isPreview = preview?.id === ev.id;
                  const join = ev.meeting_url && joinableNow(ev, now) ? ev.meeting_url : null;
                  const tip = `${ev.title} · ${formatDMY(new Date(ev.start_at))} ${range}${declined ? ` · ${chipLabels.declined}` : ""}${canMove ? ` · ${chipLabels.dragHint}` : ""}`;
                  return (
                    <div
                      key={ev.id}
                      className={`absolute overflow-hidden transition-[filter,box-shadow] ${roomy ? "rounded-lg" : "rounded-md"} ${declined ? "opacity-60" : ""} ${isPreview ? "z-20 shadow-lg ring-2 ring-[#567FB2] dark:ring-[#7FA9D6]" : ""} ${canMove ? (isPreview ? "cursor-grabbing select-none" : "cursor-grab select-none") : ""}`}
                      style={{
                        ...laneStyle(isPreview ? undefined : lanes.get(ev.id), roomy ? 8 : 4, roomy ? 4 : 2),
                        top: topPx,
                        height: heightPx,
                        backgroundColor: color + (isPreview ? "33" : "22"),
                        color,
                        borderInlineStart: `3px solid ${color}`,
                      }}
                      onPointerDown={canMove ? (e) => beginDrag(e, ev, dayIndex, "move") : undefined}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressClickRef.current) return;
                          onEventClick?.(ev);
                        }}
                        className={`block w-full h-full text-start hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)] ${roomy ? "px-3 py-2" : "px-1.5 py-1 text-[10px] font-medium"} ${canMove ? "cursor-[inherit]" : ""}`}
                        title={tip}
                        aria-label={tip}
                      >
                        <div className={`font-semibold truncate ${roomy ? "text-[12px]" : ""} ${declined ? "line-through" : ""} ${join ? (roomy ? "pe-16" : "pe-5") : ""}`}>{ev.title}</div>
                        {heightPx >= (roomy ? 40 : 32) && (
                          <div className={`${roomy ? "text-[10px]" : "text-[9px]"} opacity-80 truncate tabular-nums`}>{range}</div>
                        )}
                        {roomy && ev.location && heightPx >= 60 && (
                          <div className="text-[10px] opacity-70 truncate mt-0.5">{ev.location}</div>
                        )}
                        {!roomy && !isSameDay(new Date(ev.start_at), day) && (
                          <div className="text-[9px] opacity-70">{t("week.continues")}</div>
                        )}
                      </button>
                      {join && (
                        <div className="absolute top-1 end-1">
                          <JoinLink url={join} label={chipLabels.join} title={ev.title} compact={!roomy} />
                        </div>
                      )}
                      {canMove && (
                        <div
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          onPointerDown={(e) => beginDrag(e, ev, dayIndex, "resize")}
                        />
                      )}
                    </div>
                  );
                })}

                {nowPx !== null && (
                  <div className="absolute inset-x-0 pointer-events-none" style={{ top: nowPx }}>
                    <div className="h-px bg-[var(--state-error)]" />
                    <div className="absolute -start-1 -top-1 h-2 w-2 rounded-full bg-[var(--state-error)]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

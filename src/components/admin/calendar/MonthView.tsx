"use client";

/* ---------------------------------------------------------------------------
   MonthView — 6-row month grid with event chips, anchored on the viewer's
   first day of week (Settings → Language & region).

   Click a day (or its number, from the keyboard) → open day view.
   "+" (on hover, on focus, always on touch screens) → new event that day.
   "+N more" → the day view of that date.
   Click an event chip → open it.
   Drag an editable chip to another day → it moves there, keeping its time
   (HTML5 drag: a mouse or pen; touch screens do not start it). The drop
   carries the day the chip was picked up from, so a multi-day item moves by
   the difference.

   Dates are WALL dates of the calendar's timezone (see calendar-utils); the
   day's items arrive grouped once by CalendarApp.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { PlusIcon } from "@/components/icons/ui";
import type { AccountPreferences } from "@/types/supabase";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import {
  formatDMY,
  isSameMonth,
  isToday,
  isoDateKey,
  monthGrid,
  isoWeekday,
  weekdayOrder,
  type WeekStart,
} from "@/lib/calendar-utils";
import EventChip, { EVENT_DRAG_MIME, type ChipLabels } from "./EventChip";

interface Props {
  focusDate: Date;
  today: Date;
  eventsByDay: Map<string, CalendarFeedEvent[]>;
  preferences: AccountPreferences;
  weekStart: WeekStart;
  /* Report GEN-10 — dated holiday occurrences keyed by yyyy-mm-dd (weekly
     rest days are not in here; they are one hint, not a chip per cell). */
  holidaysByDay?: Record<string, HolidayInstance[]>;
  /** ISO weekday → name of the weekly rest day (e.g. 6 → "Weekend"). */
  restDays?: Map<number, string>;
  chipLabels: ChipLabels;
  onDayClick?: (d: Date) => void;
  onNewEventOnDay?: (d: Date) => void;
  onEventClick?: (e: CalendarFeedEvent) => void;
  canDrag?: (e: CalendarFeedEvent) => boolean;
  /** A chip picked up on `fromKey` was dropped on `toKey` (YYYY-MM-DD). */
  onEventDropDay?: (e: CalendarFeedEvent, fromKey: string, toKey: string) => void;
}

const MAX_CHIPS = 3;
const HOLIDAY_COLOR = EVENT_TYPE_COLORS.holiday;

export default function MonthView({
  focusDate,
  today,
  eventsByDay,
  preferences,
  weekStart,
  holidaysByDay,
  restDays,
  chipLabels,
  onDayClick,
  onNewEventOnDay,
  onEventClick,
  canDrag,
  onEventDropDay,
}: Props) {
  const { t } = useTranslation(calendarT);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dnd = !!onEventDropDay;

  function findEvent(id: string): CalendarFeedEvent | undefined {
    for (const list of eventsByDay.values()) {
      const hit = list.find((e) => e.id === id);
      if (hit) return hit;
    }
    return undefined;
  }
  const days = monthGrid(focusDate, weekStart);
  const columnDays = weekdayOrder(weekStart);   // ISO numbers, in column order
  const workingDays = preferences.calendar?.working_hours?.days || [1, 2, 3, 4, 5];

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
        {columnDays.map((iso) => {
          const isWorking = workingDays.includes(iso);
          const rest = restDays?.get(iso);
          return (
            <div
              key={iso}
              title={rest}
              className={`text-[10px] font-semibold uppercase tracking-wider py-3 text-center ${
                isWorking ? "text-[var(--text-muted)]" : "text-[var(--text-ghost)]"
              }`}
            >
              {t(`wd.${iso}`)}
              {rest && <span className="ms-1 inline-block h-1 w-1 rounded-full align-middle" style={{ backgroundColor: HOLIDAY_COLOR }} aria-hidden />}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, idx) => {
          const key = isoDateKey(day);
          const inMonth = isSameMonth(day, focusDate);
          const isTodayCell = isToday(day, today);
          const dayEvents = eventsByDay.get(key) ?? [];
          const dayHolidays = holidaysByDay?.[key] ?? [];
          const room = Math.max(1, MAX_CHIPS - dayHolidays.length);
          const shown = dayEvents.slice(0, room);
          const extra = dayEvents.length - shown.length;
          const isWorking = workingDays.includes(isoWeekday(day));
          const isLastCol = (idx + 1) % 7 === 0;
          const isLastRow = idx >= days.length - 7;
          const dmy = formatDMY(day);

          return (
            <div
              key={key}
              className={`group relative min-h-[88px] sm:min-h-[112px] p-1 sm:p-1.5 md:p-2 cursor-pointer transition-colors ${
                !isLastCol ? "border-e border-[var(--border-subtle)]" : ""
              } ${!isLastRow ? "border-b border-[var(--border-subtle)]" : ""} ${
                inMonth
                  ? isWorking
                    ? "bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-subtle)]"
                    : "bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-surface-subtle)]"
                  : "bg-[var(--bg-primary)]/60 hover:bg-[var(--bg-surface-subtle)]/60"
              }`}
              onClick={() => onDayClick?.(day)}
              onDragOver={dnd ? (e) => {
                if (!e.dataTransfer.types.includes(EVENT_DRAG_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropKey !== key) setDropKey(key);
              } : undefined}
              onDragLeave={dnd ? (e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropKey((k) => (k === key ? null : k));
              } : undefined}
              onDrop={dnd ? (e) => {
                const raw = e.dataTransfer.getData(EVENT_DRAG_MIME);
                setDropKey(null);
                if (!raw) return;
                e.preventDefault();
                const [id, fromKey] = raw.split("|");
                const ev = findEvent(id);
                if (ev && fromKey && fromKey !== key) onEventDropDay?.(ev, fromKey, key);
              } : undefined}
            >
              {dropKey === key && (
                <div aria-hidden className="pointer-events-none absolute inset-1 rounded-lg border-2 border-dashed border-[#567FB2] dark:border-[#7FA9D6] bg-[#567FB2]/[0.06]" />
              )}
              {/* Day number (opens the day — the keyboard way in) + quick-create */}
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDayClick?.(day); }}
                  aria-label={t("day.open").replace("{date}", dmy)}
                  aria-current={isTodayCell ? "date" : undefined}
                  className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-[11px] font-bold focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)] ${
                    isTodayCell
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : inMonth
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-ghost)]"
                  }`}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewEventOnDay?.(day);
                  }}
                  className="h-5 w-5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-all flex items-center justify-center"
                  title={t("newEvent")}
                  aria-label={`${t("newEvent")} · ${dmy}`}
                >
                  <PlusIcon className="h-3 w-3" />
                </button>
              </div>

              {/* Holiday chips (report GEN-10) */}
              {dayHolidays.length > 0 && (
                <div className="space-y-1 mb-1">
                  {dayHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="w-full flex items-center gap-1 h-[18px] px-1.5 rounded text-[10px] font-semibold truncate"
                      style={{
                        backgroundColor: HOLIDAY_COLOR + "22",
                        color: HOLIDAY_COLOR,
                        borderInlineStart: `2px solid ${HOLIDAY_COLOR}`,
                      }}
                      title={`${h.name}${h.country ? " · " + h.country : ""}`}
                    >
                      <span className="truncate">{h.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Event chips */}
              <div className="space-y-1">
                {shown.map((ev) => (
                  <EventChip
                    key={ev.id}
                    ev={ev}
                    labels={chipLabels}
                    onClick={onEventClick}
                    now={today}
                    dragData={dnd && canDrag?.(ev) ? `${ev.id}|${key}` : undefined}
                  />
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDayClick?.(day); }}
                    aria-label={t("month.moreAria").replace("{n}", String(dayEvents.length)).replace("{date}", dmy)}
                    className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] ps-1 rounded focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)]"
                  >
                    +{extra} {t("month.more")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

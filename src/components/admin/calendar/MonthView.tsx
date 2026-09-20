"use client";

/* ---------------------------------------------------------------------------
   MonthView — 6-row month grid with event chips, anchored on the viewer's
   first day of week (Settings → Language & region).

   Click a day → open day view.
   Hover a day → show a "+" button to create a new event on that day.
   Click an event chip → open it.
   --------------------------------------------------------------------------- */

import PlusIcon from "@/components/icons/ui/PlusIcon";
import type { CalendarViewEvent, AccountPreferences } from "@/types/supabase";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import {
  eventsOnDay,
  isSameMonth,
  isToday,
  isoDateKey,
  monthGrid,
  colorForEvent,
  isoWeekday,
  formatTime,
  weekdayOrder,
  type WeekStart,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarViewEvent[];
  preferences: AccountPreferences;
  weekStart: WeekStart;
  /* Report GEN-10 — holiday occurrences keyed by yyyy-mm-dd. */
  holidaysByDay?: Record<string, HolidayInstance[]>;
  onDayClick?: (d: Date) => void;
  onNewEventOnDay?: (d: Date) => void;
  onEventClick?: (e: CalendarViewEvent) => void;
}

const MAX_CHIPS = 3;
const HOLIDAY_COLOR = EVENT_TYPE_COLORS.holiday;

export default function MonthView({
  focusDate,
  events,
  preferences,
  weekStart,
  holidaysByDay,
  onDayClick,
  onNewEventOnDay,
  onEventClick,
}: Props) {
  const { t, lang } = useTranslation(calendarT);
  const days = monthGrid(focusDate, weekStart);
  const columnDays = weekdayOrder(weekStart);   // ISO numbers, in column order
  const workingDays = preferences.calendar?.working_hours?.days || [1, 2, 3, 4, 5];

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
        {columnDays.map((iso) => {
          const isWorking = workingDays.includes(iso);
          return (
            <div
              key={iso}
              className={`text-[10px] font-semibold uppercase tracking-wider py-3 text-center ${
                isWorking ? "text-[var(--text-muted)]" : "text-[var(--text-ghost)]"
              }`}
            >
              {t(`wd.${iso}`)}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, focusDate);
          const today = isToday(day);
          const dayEvents = eventsOnDay(events, day);
          const dayHolidays = holidaysByDay?.[isoDateKey(day)] ?? [];
          const shown = dayEvents.slice(0, MAX_CHIPS);
          const extra = dayEvents.length - shown.length;
          const isWorking = workingDays.includes(isoWeekday(day));
          const isLastCol = (idx + 1) % 7 === 0;
          const isLastRow = idx >= days.length - 7;

          return (
            <div
              key={day.toISOString()}
              className={`group relative min-h-[112px] p-1.5 md:p-2 cursor-pointer transition-colors ${
                !isLastCol ? "border-e border-[var(--border-subtle)]" : ""
              } ${!isLastRow ? "border-b border-[var(--border-subtle)]" : ""} ${
                inMonth
                  ? isWorking
                    ? "bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-subtle)]"
                    : "bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-surface-subtle)]"
                  : "bg-[var(--bg-primary)]/60 hover:bg-[var(--bg-surface-subtle)]/60"
              }`}
              onClick={() => onDayClick?.(day)}
            >
              {/* Day number + quick-create */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-[11px] font-bold ${
                    today
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : inMonth
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-ghost)]"
                  }`}
                >
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewEventOnDay?.(day);
                  }}
                  className="h-5 w-5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                  title={t("newEvent")}
                  aria-label={t("newEvent")}
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
                        borderLeft: `2px solid ${HOLIDAY_COLOR}`,
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
                {shown.map((ev) => {
                  const color = colorForEvent(ev);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className="w-full text-left flex items-center gap-1.5 h-[18px] px-1.5 rounded text-[10px] font-medium truncate hover:brightness-125 transition-all"
                      style={{
                        backgroundColor: color + "22",
                        color,
                        borderLeft: `2px solid ${color}`,
                      }}
                      title={`${ev.title} · ${ev.all_day ? t("f.allDay") : formatTime(new Date(ev.start_at), lang)}`}
                    >
                      {!ev.all_day && (
                        <span className="shrink-0 text-[9px] opacity-80">
                          {formatTime(new Date(ev.start_at), lang)}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <p className="text-[10px] text-[var(--text-dim)] ps-1">
                    +{extra} {t("month.more")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

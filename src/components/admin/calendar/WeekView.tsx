"use client";

/* ---------------------------------------------------------------------------
   WeekView — a week time grid anchored on the viewer's first day of week.

   7 columns, one row per hour. Working hours from the account's preferences
   are rendered with a slightly lighter background; non-working days are
   subtly dimmed. Events are absolute-positioned within each column.

   Click an empty slot → create new event at that time.
   Click an event → open it.
   --------------------------------------------------------------------------- */

import type { CalendarViewEvent, AccountPreferences } from "@/types/supabase";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import {
  HOURS_OF_DAY,
  colorForEvent,
  eventLayoutInDay,
  eventsOnDay,
  formatHourLabel,
  formatTime,
  isSameDay,
  isToday,
  isoWeekday,
  nowOffsetPx,
  weekDays,
  workingHoursBand,
  type WeekStart,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarViewEvent[];
  preferences: AccountPreferences;
  weekStart: WeekStart;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarViewEvent) => void;
}

const HOUR_HEIGHT = 48;
const TIME_COL_WIDTH = 56;

export default function WeekView({
  focusDate,
  events,
  preferences,
  weekStart,
  onNewEventAtSlot,
  onEventClick,
}: Props) {
  const { t, lang } = useTranslation(calendarT);
  const days = weekDays(focusDate, weekStart);
  const wh = preferences.calendar?.working_hours || { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };
  const band = workingHoursBand(wh, HOUR_HEIGHT);

  function handleSlotClick(day: Date, hour: number) {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onNewEventAtSlot?.(d);
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 800 }}>
        {/* Day header */}
        <div
          className="grid sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const isWorking = wh.days.includes(isoWeekday(day));
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-3 border-s border-[var(--border-subtle)] ${
                  isWorking ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  {t(`wd.${isoWeekday(day)}`)}
                </div>
                <div
                  className={`inline-flex items-center justify-center h-7 min-w-7 px-2 mt-1 rounded-full text-[13px] font-bold ${
                    today ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div
          className="grid relative"
          style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))` }}
        >
          {/* Hour labels */}
          <div className="flex flex-col">
            {HOURS_OF_DAY.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pe-2 pt-1 border-b border-[var(--border-subtle)]"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="text-[10px] font-medium text-[var(--text-dim)]">{formatHourLabel(h, lang)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isWorking = wh.days.includes(isoWeekday(day));
            const dayEvents = eventsOnDay(events, day);
            const nowPx = isToday(day) ? nowOffsetPx(HOUR_HEIGHT) : null;
            return (
              <div
                key={day.toISOString()}
                className={`relative border-s border-[var(--border-subtle)] ${isWorking ? "" : "bg-[var(--bg-primary)]/30"}`}
              >
                {isWorking && band.heightPx > 0 && (
                  <div
                    className="absolute inset-x-0 bg-[var(--bg-surface-subtle)]/50 pointer-events-none"
                    style={{ top: band.topPx, height: band.heightPx }}
                  />
                )}

                {HOURS_OF_DAY.map((h) => (
                  <div
                    key={h}
                    onClick={() => handleSlotClick(day, h)}
                    className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 cursor-pointer transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {dayEvents.map((ev) => {
                  const { topPx, heightPx } = eventLayoutInDay(ev, day, HOUR_HEIGHT);
                  const color = colorForEvent(ev);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className="absolute inset-x-1 rounded-md px-1.5 py-1 text-left text-[10px] font-medium overflow-hidden hover:brightness-125 transition-all"
                      style={{
                        top: topPx,
                        height: heightPx,
                        backgroundColor: color + "22",
                        color,
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={ev.title}
                    >
                      <div className="font-semibold truncate">{ev.title}</div>
                      {!ev.all_day && heightPx >= 32 && (
                        <div className="text-[9px] opacity-80 truncate">
                          {formatTime(new Date(ev.start_at), lang)} – {formatTime(new Date(ev.end_at), lang)}
                        </div>
                      )}
                      {!isSameDay(new Date(ev.start_at), day) && (
                        <div className="text-[9px] opacity-70">{t("week.continues")}</div>
                      )}
                    </button>
                  );
                })}

                {nowPx !== null && (
                  <div className="absolute inset-x-0 pointer-events-none" style={{ top: nowPx }}>
                    <div className="h-px bg-red-500" />
                    <div className="absolute -start-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
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

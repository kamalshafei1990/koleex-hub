"use client";

/* ---------------------------------------------------------------------------
   DayView — single-day time grid.

   Same design language as WeekView but with only one column, bigger event
   rectangles, and an inline list of the day's events on the side for quick
   scanning.
   --------------------------------------------------------------------------- */

import type { CalendarViewEvent, AccountPreferences } from "@/types/supabase";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import {
  HOURS_OF_DAY,
  colorForEvent,
  dayLanes,
  eventLayoutInDay,
  eventsOnDay,
  formatEventTimeRange,
  formatHourLabel,
  formatTime,
  isToday,
  isoWeekday,
  laneStyle,
  nowOffsetPx,
  workingHoursBand,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarViewEvent[];
  preferences: AccountPreferences;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarViewEvent) => void;
}

const HOUR_HEIGHT = 60;
const TIME_COL_WIDTH = 64;

export default function DayView({
  focusDate,
  events,
  preferences,
  onNewEventAtSlot,
  onEventClick,
}: Props) {
  const { t, lang } = useTranslation(calendarT);
  const wh = preferences.calendar?.working_hours || { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };
  const isWorkingDay = wh.days.includes(isoWeekday(focusDate));
  const band = workingHoursBand(wh, HOUR_HEIGHT);
  const dayEvents = eventsOnDay(events, focusDate);
  const lanes = dayLanes(dayEvents.filter((e) => !e.all_day), focusDate, HOUR_HEIGHT);
  const nowPx = isToday(focusDate) ? nowOffsetPx(HOUR_HEIGHT) : null;

  function handleSlotClick(hour: number) {
    const d = new Date(focusDate);
    d.setHours(hour, 0, 0, 0);
    onNewEventAtSlot?.(d);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Time grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 420 }}>
          <div className="grid relative" style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px minmax(0, 1fr)` }}>
            {/* Hours */}
            <div className="flex flex-col">
              {HOURS_OF_DAY.map((h) => (
                <div
                  key={h}
                  className="flex items-start justify-end pe-2 pt-1 border-b border-[var(--border-subtle)]"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="text-[11px] font-medium text-[var(--text-dim)]">{formatHourLabel(h, lang)}</span>
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className={`relative border-s border-[var(--border-subtle)] ${!isWorkingDay ? "bg-[var(--bg-primary)]/30" : ""}`}>
              {isWorkingDay && band.heightPx > 0 && (
                <div
                  className="absolute inset-x-0 bg-[var(--bg-surface-subtle)]/50 pointer-events-none"
                  style={{ top: band.topPx, height: band.heightPx }}
                />
              )}

              {HOURS_OF_DAY.map((h) => (
                <div
                  key={h}
                  onClick={() => handleSlotClick(h)}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 cursor-pointer transition-colors"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}

              {dayEvents.map((ev) => {
                const { topPx, heightPx } = eventLayoutInDay(ev, focusDate, HOUR_HEIGHT);
                const color = colorForEvent(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    className="absolute rounded-lg px-3 py-2 text-left overflow-hidden hover:brightness-125 transition-all"
                    style={{
                      ...laneStyle(lanes.get(ev.id), 8, 4),
                      top: topPx,
                      height: heightPx,
                      backgroundColor: color + "22",
                      color,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <div className="text-[12px] font-semibold truncate">{ev.title}</div>
                    {!ev.all_day && heightPx >= 40 && (
                      <div className="text-[10px] opacity-80 truncate">
                        {formatTime(new Date(ev.start_at), lang)} – {formatTime(new Date(ev.end_at), lang)}
                      </div>
                    )}
                    {ev.location && heightPx >= 60 && (
                      <div className="text-[10px] opacity-70 truncate mt-0.5">{ev.location}</div>
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
          </div>
        </div>
      </div>

      {/* Side event list */}
      <div className="border-s border-[var(--border-subtle)] p-4 md:p-5 bg-[var(--bg-primary)]/50 max-h-[600px] lg:max-h-none overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">
          {t("day.events")} · {dayEvents.length}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("day.empty")}</p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const color = colorForEvent(ev);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev)}
                  className="w-full text-left rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] p-3 transition-all"
                >
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{ev.title}</p>
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                        {formatEventTimeRange(ev, lang, t("f.allDay"))}
                      </p>
                      {ev.location && (
                        <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{ev.location}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

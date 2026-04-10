"use client";

/* ---------------------------------------------------------------------------
   DayView — single-day time grid.

   Same design language as WeekView but with only one column, bigger event
   rectangles, and an inline list of the day's events on the right for
   quick scanning.
   --------------------------------------------------------------------------- */

import type { CalendarEventRow, AccountPreferences } from "@/types/supabase";
import {
  HOURS_OF_DAY,
  colorForEvent,
  eventLayoutInDay,
  eventsOnDay,
  isoWeekday,
  formatTime,
  formatEventTimeRange,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarEventRow[];
  preferences: AccountPreferences;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarEventRow) => void;
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
  const wh = preferences.calendar?.working_hours || {
    start: "09:00",
    end: "18:00",
    days: [1, 2, 3, 4, 5],
  };
  const iso = isoWeekday(focusDate);
  const isWorkingDay = wh.days.includes(iso);
  const [whStartH, whStartM] = wh.start.split(":").map(Number);
  const [whEndH, whEndM] = wh.end.split(":").map(Number);
  const workingTopPx = ((whStartH || 0) + (whStartM || 0) / 60) * HOUR_HEIGHT;
  const workingHeightPx =
    ((whEndH || 0) +
      (whEndM || 0) / 60 -
      ((whStartH || 0) + (whStartM || 0) / 60)) *
    HOUR_HEIGHT;

  const dayEvents = eventsOnDay(events, focusDate);
  const nowOffsetPx = isToday(focusDate) ? getNowOffsetPx() : null;

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
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `${TIME_COL_WIDTH}px minmax(0, 1fr)`,
            }}
          >
            {/* Hours */}
            <div className="flex flex-col">
              {HOURS_OF_DAY.map((h) => (
                <div
                  key={h}
                  className="flex items-start justify-end pe-2 pt-1 border-b border-[var(--border-subtle)]"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="text-[11px] font-medium text-[var(--text-dim)]">
                    {formatHourLabel(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day column */}
            <div
              className={`relative border-s border-[var(--border-subtle)] ${
                !isWorkingDay ? "bg-[var(--bg-primary)]/30" : ""
              }`}
            >
              {isWorkingDay && workingHeightPx > 0 && (
                <div
                  className="absolute inset-x-0 bg-[var(--bg-surface-subtle)]/50 pointer-events-none"
                  style={{ top: workingTopPx, height: workingHeightPx }}
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
                const { topPx, heightPx } = eventLayoutInDay(
                  ev,
                  focusDate,
                  HOUR_HEIGHT,
                );
                const color = colorForEvent(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    className="absolute inset-x-2 rounded-lg px-3 py-2 text-left overflow-hidden hover:brightness-125 transition-all"
                    style={{
                      top: topPx,
                      height: heightPx,
                      backgroundColor: color + "22",
                      color,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <div className="text-[12px] font-semibold truncate">
                      {ev.title}
                    </div>
                    {!ev.all_day && heightPx >= 40 && (
                      <div className="text-[10px] opacity-80 truncate">
                        {formatTime(new Date(ev.start_at))} –{" "}
                        {formatTime(new Date(ev.end_at))}
                      </div>
                    )}
                    {ev.location && heightPx >= 60 && (
                      <div className="text-[10px] opacity-70 truncate mt-0.5">
                        {ev.location}
                      </div>
                    )}
                  </button>
                );
              })}

              {nowOffsetPx !== null && (
                <div
                  className="absolute inset-x-0 pointer-events-none"
                  style={{ top: nowOffsetPx }}
                >
                  <div className="h-px bg-red-500" />
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Side event list */}
      <div className="border-s border-[var(--border-subtle)] p-4 md:p-5 bg-[var(--bg-primary)]/50 max-h-[600px] lg:max-h-none overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">
          Events · {dayEvents.length}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">
            Nothing scheduled. Click a slot to add an event.
          </p>
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
                    <span
                      className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {ev.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                        {formatEventTimeRange(ev)}
                      </p>
                      {ev.location && (
                        <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                          {ev.location}
                        </p>
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

function formatHourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function getNowOffsetPx(): number {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
}

"use client";

/* ---------------------------------------------------------------------------
   WeekView — Monday-anchored week time grid.

   7 columns (Mon..Sun), 24 rows per hour. Working hours from the account's
   preferences are rendered with a slightly lighter background; non-working
   days are subtly dimmed. Events are absolute-positioned within each column.

   Click an empty slot → create new event at that time.
   Click an event → open the editor.
   --------------------------------------------------------------------------- */

import type { CalendarEventRow, AccountPreferences } from "@/types/supabase";
import {
  HOURS_OF_DAY,
  addDays,
  colorForEvent,
  eventLayoutInDay,
  eventsOnDay,
  isSameDay,
  isToday,
  isoWeekday,
  startOfWeek,
  formatTime,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarEventRow[];
  preferences: AccountPreferences;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarEventRow) => void;
}

const HOUR_HEIGHT = 48;
const TIME_COL_WIDTH = 56;

export default function WeekView({
  focusDate,
  events,
  preferences,
  onNewEventAtSlot,
  onEventClick,
}: Props) {
  const weekStart = startOfWeek(focusDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const wh = preferences.calendar?.working_hours || {
    start: "09:00",
    end: "18:00",
    days: [1, 2, 3, 4, 5],
  };
  const [whStartH, whStartM] = wh.start.split(":").map(Number);
  const [whEndH, whEndM] = wh.end.split(":").map(Number);
  const workingTopPx = ((whStartH || 0) + (whStartM || 0) / 60) * HOUR_HEIGHT;
  const workingHeightPx =
    ((whEndH || 0) + (whEndM || 0) / 60 - ((whStartH || 0) + (whStartM || 0) / 60)) *
    HOUR_HEIGHT;

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
          style={{
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))`,
          }}
        >
          <div />
          {days.map((day) => {
            const iso = isoWeekday(day);
            const isWorking = wh.days.includes(iso);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-3 border-s border-[var(--border-subtle)] ${
                  isWorking
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div
                  className={`inline-flex items-center justify-center h-7 min-w-7 px-2 mt-1 rounded-full text-[13px] font-bold ${
                    today
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "text-[var(--text-primary)]"
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
          style={{
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))`,
          }}
        >
          {/* Hour labels */}
          <div className="flex flex-col">
            {HOURS_OF_DAY.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pe-2 pt-1 border-b border-[var(--border-subtle)]"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="text-[10px] font-medium text-[var(--text-dim)]">
                  {formatHourLabel(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const iso = isoWeekday(day);
            const isWorking = wh.days.includes(iso);
            const dayEvents = eventsOnDay(events, day);
            const today = isToday(day);
            const nowIndicator = today ? getNowOffsetPx() : null;
            return (
              <div
                key={day.toISOString()}
                className={`relative border-s border-[var(--border-subtle)] ${
                  isWorking ? "" : "bg-[var(--bg-primary)]/30"
                }`}
              >
                {/* Working hours shade */}
                {isWorking && workingHeightPx > 0 && (
                  <div
                    className="absolute inset-x-0 bg-[var(--bg-surface-subtle)]/50 pointer-events-none"
                    style={{ top: workingTopPx, height: workingHeightPx }}
                  />
                )}

                {/* Hour rows (clickable) */}
                {HOURS_OF_DAY.map((h) => (
                  <div
                    key={h}
                    onClick={() => handleSlotClick(day, h)}
                    className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/60 cursor-pointer transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const { topPx, heightPx } = eventLayoutInDay(
                    ev,
                    day,
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
                          {formatTime(new Date(ev.start_at))} –{" "}
                          {formatTime(new Date(ev.end_at))}
                        </div>
                      )}
                      {isSameDay(new Date(ev.start_at), day) === false && (
                        <div className="text-[9px] opacity-70">continues</div>
                      )}
                    </button>
                  );
                })}

                {/* "Now" indicator */}
                {nowIndicator !== null && (
                  <div
                    className="absolute inset-x-0 pointer-events-none"
                    style={{ top: nowIndicator }}
                  >
                    <div className="h-px bg-red-500" />
                    <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
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

function formatHourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function getNowOffsetPx(): number {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
}

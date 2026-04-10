"use client";

/* ---------------------------------------------------------------------------
   MonthView — 6-row Monday-anchored month grid with event chips.

   Click a day → open day view.
   Hover a day → show a "+" button to create a new event on that day.
   Click an event chip → open the editor.
   --------------------------------------------------------------------------- */

import { Plus } from "lucide-react";
import type { CalendarEventRow, AccountPreferences } from "@/types/supabase";
import {
  eventsOnDay,
  isSameMonth,
  isToday,
  monthGrid,
  colorForEvent,
  isoWeekday,
  formatTime,
} from "@/lib/calendar-utils";

interface Props {
  focusDate: Date;
  events: CalendarEventRow[];
  preferences: AccountPreferences;
  onDayClick?: (d: Date) => void;
  onNewEventOnDay?: (d: Date) => void;
  onEventClick?: (e: CalendarEventRow) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

export default function MonthView({
  focusDate,
  events,
  preferences,
  onDayClick,
  onNewEventOnDay,
  onEventClick,
}: Props) {
  const days = monthGrid(focusDate);
  const workingDays = preferences.calendar?.working_hours?.days || [1, 2, 3, 4, 5];

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)]">
        {WEEKDAY_LABELS.map((label, i) => {
          const iso = i + 1;
          const isWorking = workingDays.includes(iso);
          return (
            <div
              key={label}
              className={`text-[10px] font-semibold uppercase tracking-wider py-3 text-center ${
                isWorking
                  ? "text-[var(--text-muted)]"
                  : "text-[var(--text-ghost)]"
              }`}
            >
              {label}
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
          const shown = dayEvents.slice(0, MAX_CHIPS);
          const extra = dayEvents.length - shown.length;
          const iso = isoWeekday(day);
          const isWorking = workingDays.includes(iso);
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
                  title="New event"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

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
                      title={`${ev.title} · ${
                        ev.all_day ? "All day" : formatTime(new Date(ev.start_at))
                      }`}
                    >
                      {!ev.all_day && (
                        <span className="shrink-0 text-[9px] opacity-80">
                          {formatTime(new Date(ev.start_at))}
                        </span>
                      )}
                      <span className="truncate">{ev.title}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <p className="text-[10px] text-[var(--text-dim)] pl-1">
                    +{extra} more
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

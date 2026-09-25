"use client";

/* ---------------------------------------------------------------------------
   DayView — single-day time grid.

   Same grid as WeekView (TimeGrid, with its all-day strip) but one column,
   bigger blocks, and a list of the day's items on the side for quick
   scanning.
   --------------------------------------------------------------------------- */

import type { AccountPreferences } from "@/types/supabase";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { colorForEvent, formatEventTimeRange, isoDateKey } from "@/lib/calendar-utils";
import TimeGrid from "./TimeGrid";
import type { ChipLabels } from "./EventChip";

interface Props {
  focusDate: Date;
  today: Date;
  now: Date;
  eventsByDay: Map<string, CalendarFeedEvent[]>;
  holidaysByDay?: Record<string, HolidayInstance[]>;
  restDays?: Map<number, string>;
  preferences: AccountPreferences;
  chipLabels: ChipLabels;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarFeedEvent) => void;
}

export default function DayView(props: Props) {
  const { t } = useTranslation(calendarT);
  const { focusDate, eventsByDay, chipLabels, onEventClick } = props;
  const dayEvents = eventsByDay.get(isoDateKey(focusDate)) ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <TimeGrid
        {...props}
        days={[focusDate]}
        hourHeight={60}
        timeColWidth={56}
        minWidthClass="min-w-[280px]"
        showDayHeader={false}
        roomy
      />

      {/* Side event list */}
      <div className="border-t lg:border-t-0 lg:border-s border-[var(--border-subtle)] p-4 md:p-5 bg-[var(--bg-primary)]/50 max-h-[600px] lg:max-h-[min(72vh,880px)] overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3">
          {t("day.events")} · {dayEvents.length}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("day.empty")}</p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const color = colorForEvent(ev);
              const declined = ev.invite_status === "declined";
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev)}
                  className={`w-full text-start rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] p-3 transition-all ${declined ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold text-[var(--text-primary)] truncate ${declined ? "line-through" : ""}`}>{ev.title}</p>
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5 tabular-nums">
                        {formatEventTimeRange(ev, chipLabels.allDay)}
                        {ev.source === "leave" && ` · ${chipLabels.readOnly}`}
                        {declined && ` · ${chipLabels.declined}`}
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

"use client";

/* ---------------------------------------------------------------------------
   AgendaView — the visible range as a plain list grouped by day. The phone
   default: a month grid of 42 cells or a seven-column week does not read at
   phone width; a list does.
   --------------------------------------------------------------------------- */

import type { CalendarFeedEvent } from "@/lib/calendar-types";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import { colorForEvent, formatDMY, formatEventTimeRange, isToday, isoDateKey, isoWeekday } from "@/lib/calendar-utils";
import type { ChipLabels } from "./EventChip";

interface Props {
  days: Date[];
  today: Date;
  eventsByDay: Map<string, CalendarFeedEvent[]>;
  holidaysByDay?: Record<string, HolidayInstance[]>;
  chipLabels: ChipLabels;
  onDayClick?: (d: Date) => void;
  onEventClick?: (e: CalendarFeedEvent) => void;
}

export default function AgendaView({ days, today, eventsByDay, holidaysByDay, chipLabels, onDayClick, onEventClick }: Props) {
  const { t } = useTranslation(calendarT);
  const rows = days
    .map((day) => {
      const key = isoDateKey(day);
      return { day, key, items: eventsByDay.get(key) ?? [], holidays: holidaysByDay?.[key] ?? [] };
    })
    .filter((r) => r.items.length > 0 || r.holidays.length > 0);

  if (rows.length === 0) {
    return <div className="p-10 text-center text-[13px] text-[var(--text-dim)]">{t("agenda.empty")}</div>;
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {rows.map(({ day, key, items, holidays }) => (
        <section key={key} className="px-4 py-3 md:px-5" aria-label={formatDMY(day)}>
          <button
            type="button"
            onClick={() => onDayClick?.(day)}
            className="mb-2 flex items-baseline gap-2 text-start"
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isToday(day, today) ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
              {t(`wd.${isoWeekday(day)}`)}
            </span>
            <span className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums">{formatDMY(day)}</span>
            {isToday(day, today) && <span className="text-[11px] text-[var(--text-dim)]">· {t("today")}</span>}
          </button>
          <ul className="space-y-1.5">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-[12px]" style={{ color: EVENT_TYPE_COLORS.holiday }}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: EVENT_TYPE_COLORS.holiday }} />
                <span className="truncate font-semibold">{h.name}</span>
              </li>
            ))}
            {items.map((ev) => {
              const declined = ev.invite_status === "declined";
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => onEventClick?.(ev)}
                    className={`w-full flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 text-start hover:bg-[var(--bg-surface-subtle)] transition-colors ${declined ? "opacity-60" : ""}`}
                  >
                    <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colorForEvent(ev) }} />
                    <span className="w-24 shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums pt-0.5">
                      {ev.all_day ? chipLabels.allDay : formatEventTimeRange(ev, chipLabels.allDay)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-medium text-[var(--text-primary)] truncate ${declined ? "line-through" : ""}`}>{ev.title}</span>
                      {(ev.location || ev.source === "leave" || declined) && (
                        <span className="block text-[11px] text-[var(--text-dim)] truncate">
                          {[ev.location, ev.source === "leave" ? chipLabels.readOnly : null, declined ? chipLabels.declined : null].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

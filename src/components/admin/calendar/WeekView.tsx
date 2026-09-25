"use client";

/* ---------------------------------------------------------------------------
   WeekView — a week time grid anchored on the viewer's first day of week.

   7 columns, one row per hour, an all-day strip under the day headers (see
   TimeGrid). Working hours from the account's preferences are rendered with
   a slightly lighter background; non-working days are subtly dimmed. On a
   phone the columns narrow instead of forcing an 800 px sideways scroll.

   Click an empty slot → create new event at that time.
   Click a day header → that day. Click an event → open it.
   --------------------------------------------------------------------------- */

import type { AccountPreferences } from "@/types/supabase";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import type { HolidayInstance } from "@/lib/calendar-holidays";
import { weekDays, type WeekStart } from "@/lib/calendar-utils";
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
  weekStart: WeekStart;
  chipLabels: ChipLabels;
  onDayClick?: (d: Date) => void;
  onNewEventAtSlot?: (d: Date) => void;
  onEventClick?: (e: CalendarFeedEvent) => void;
}

export default function WeekView({ focusDate, weekStart, ...rest }: Props) {
  return (
    <TimeGrid
      {...rest}
      days={weekDays(focusDate, weekStart)}
      hourHeight={48}
      timeColWidth={48}
      minWidthClass="min-w-[520px] md:min-w-[760px]"
      showDayHeader
    />
  );
}

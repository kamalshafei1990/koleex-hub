/* ---------------------------------------------------------------------------
   Calendar enums — the closed sets koleex_calendar_events and its attendees
   accept, with guards. Client-safe; the routes, the AI tools and the views
   all read from here so a value the database would reject never gets as far
   as an insert, and a select in the modal cannot drift from the CHECK.
   --------------------------------------------------------------------------- */

import type { CalendarEventType, CalendarRecurrence } from "@/types/supabase";

export const CALENDAR_EVENT_TYPES: readonly CalendarEventType[] = [
  "meeting",
  "task",
  "reminder",
  "event",
  "holiday",
  "out_of_office",
];

export const CALENDAR_RECURRENCES: readonly NonNullable<CalendarRecurrence>[] = [
  "daily",
  "weekly",
  "monthly",
];

export type CalendarAttendeeStatus = "invited" | "accepted" | "declined";
const CALENDAR_ATTENDEE_STATUSES: readonly CalendarAttendeeStatus[] = [
  "invited",
  "accepted",
  "declined",
];

export function isCalendarEventType(v: unknown): v is CalendarEventType {
  return typeof v === "string" && (CALENDAR_EVENT_TYPES as readonly string[]).includes(v);
}

export function isCalendarRecurrence(v: unknown): v is NonNullable<CalendarRecurrence> {
  return typeof v === "string" && (CALENDAR_RECURRENCES as readonly string[]).includes(v);
}

export function isCalendarAttendeeStatus(v: unknown): v is CalendarAttendeeStatus {
  return typeof v === "string" && (CALENDAR_ATTENDEE_STATUSES as readonly string[]).includes(v);
}

/** Event type → default color. One place, so the legend, the chips and the
 *  modal's default swatch agree. A meeting — the default type — is Hub Blue
 *  (KDS HUB.steel); a colour stored on an event always wins over these. */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  meeting: "#567FB2",
  task: "#10B981",
  reminder: "#F59E0B",
  event: "#A855F7",
  holiday: "#EC4899",
  out_of_office: "#EF4444",
};

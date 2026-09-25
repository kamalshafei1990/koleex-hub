/* ---------------------------------------------------------------------------
   calendar-types — the shape GET /api/calendar/events hands the views, and
   the AI tool reads. Client-safe (types only).
   --------------------------------------------------------------------------- */

import type { CalendarAttendeeStatus, CalendarViewEvent } from "@/types/supabase";

export interface CalendarFeedEvent extends CalendarViewEvent {
  /** All-day items are DATES, not instants: the first and last day
   *  (YYYY-MM-DD, end inclusive). Present whenever all_day is true. Views
   *  match all-day items to a day by these keys, never by overlap of
   *  start_at/end_at — an instant is a different date in another zone. */
  start_date?: string;
  end_date?: string;
  /** Invited events: the viewer's own answer. */
  invite_status?: CalendarAttendeeStatus;
  /** Project-task and milestone mirrors: the project, for the deep link. */
  project_id?: string | null;
  /** Project milestone mirrors: the milestone. */
  milestone_id?: string;
  /** Planning mirrors: the item, for the deep link, and its type (the
   *  fallback title when the item has none). */
  planning_item_id?: string;
  planning_type?: string | null;
  /** Leave mirrors: the half of the day taken, when it is a half day. */
  half_day_period?: string | null;
  /** The call link (https). Absent before the 2026-09-26 migration. */
  meeting_url?: string | null;
  /** Occurrences of a series: the ORIGINAL start of this occurrence (ISO) —
   *  the key a "this occurrence only" change is stored under — and whether
   *  it has been changed on its own. */
  occurrence_start?: string;
  overridden?: boolean;
}

/** A row of koleex_calendar_event_exceptions (see the 2026-09-26 migration). */
export interface CalendarEventException {
  event_id: string;
  occurrence_start: string;
  kind: "skip" | "override";
  title?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
  meeting_url?: string | null;
}

/** One busy interval of GET /api/calendar/freebusy. `title` only when the
 *  caller may read the event (never for a private one). */
export interface BusyBlock {
  start: string;
  end: string;
  all_day?: boolean;
  start_date?: string;
  end_date?: string;
  kind: "event" | "leave";
  tentative?: boolean;
  title?: string;
}

/** One hit of GET /api/calendar/search. */
export interface CalendarSearchHit {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  start_date?: string;
  end_date?: string;
  recurring: boolean;
  invited: boolean;
  occurrence_start?: string;
}

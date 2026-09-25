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
  /** Project-task mirrors: the project, for the deep link. */
  project_id?: string | null;
  /** Planning mirrors: the item, for the deep link, and its type (the
   *  fallback title when the item has none). */
  planning_item_id?: string;
  planning_type?: string | null;
  /** Leave mirrors: the half of the day taken, when it is a half day. */
  half_day_period?: string | null;
}

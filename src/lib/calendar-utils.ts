/* ---------------------------------------------------------------------------
   Calendar date math helpers.

   Calendars involve a lot of fiddly boundary logic (first day of the month
   grid, ISO weekday numbers, overlap detection, etc). Keep it in one place
   so the components stay focused on layout.

   Conventions:
   - ISO weekday numbers: 1 = Monday, 7 = Sunday (matches the weekday list in
     access-control.ts and accounts.preferences.calendar.working_hours.days).
   - Calendar grids start on Monday by default.
   - Everything operates in the user's local browser timezone for now — the
     rendered timezone is shown via Intl for display only. (Adding strict
     per-account timezone layout is a follow-up once Supabase Auth lands.)
   --------------------------------------------------------------------------- */

import type { CalendarEventRow, CalendarEventType } from "@/types/supabase";

/** Event type → default color. Kept in one place for legend consistency. */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  meeting: "#3B82F6",       // blue
  task: "#10B981",          // emerald
  reminder: "#F59E0B",      // amber
  event: "#A855F7",         // purple
  holiday: "#EC4899",       // pink
  out_of_office: "#EF4444", // red
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  meeting: "Meeting",
  task: "Task",
  reminder: "Reminder",
  event: "Event",
  holiday: "Holiday",
  out_of_office: "Out of Office",
};

export const EVENT_TYPES: CalendarEventType[] = [
  "meeting",
  "task",
  "reminder",
  "event",
  "holiday",
  "out_of_office",
];

/* ── Day helpers ────────────────────────────────────────────────────────── */

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Convert JS getDay() (0=Sun..6=Sat) to ISO weekday (1=Mon..7=Sun). */
export function isoWeekday(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}

/* ── Week helpers ───────────────────────────────────────────────────────── */

/** Monday-anchored start of the ISO week containing d. */
export function startOfWeek(d: Date): Date {
  const iso = isoWeekday(d); // 1..7
  return startOfDay(addDays(d, -(iso - 1)));
}

export function endOfWeek(d: Date): Date {
  return endOfDay(addDays(startOfWeek(d), 6));
}

/** Seven consecutive days starting Monday of the week containing d. */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/* ── Month grid ─────────────────────────────────────────────────────────── */

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Build the 6-row × 7-column grid for a month view.
 * Always returns 42 dates so layout stays stable across months.
 */
export function monthGrid(d: Date): Date[] {
  const first = startOfMonth(d);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/* ── Event overlap / layout ─────────────────────────────────────────────── */

/** True if the event overlaps the [from, to) window. */
export function eventOverlapsRange(
  event: CalendarEventRow,
  from: Date,
  to: Date,
): boolean {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  return start < to && end >= from;
}

/** Return only events that touch this specific day. */
export function eventsOnDay(
  events: CalendarEventRow[],
  day: Date,
): CalendarEventRow[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return events
    .filter((e) => eventOverlapsRange(e, from, to))
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
}

/** Get the color used to render an event. */
export function colorForEvent(event: CalendarEventRow): string {
  return event.color || EVENT_TYPE_COLORS[event.event_type];
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

export function formatWeekRange(d: Date): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sMonth = s.toLocaleDateString(undefined, { month: "short" });
  const eMonth = e.toLocaleDateString(undefined, { month: "short" });
  if (sameMonth) {
    return `${sMonth} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (sameYear) {
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${sMonth} ${s.getDate()}, ${s.getFullYear()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventTimeRange(event: CalendarEventRow): string {
  if (event.all_day) return "All day";
  const s = new Date(event.start_at);
  const e = new Date(event.end_at);
  if (isSameDay(s, e)) {
    return `${formatTime(s)} – ${formatTime(e)}`;
  }
  return `${s.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} → ${e.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/* ── Input helpers ──────────────────────────────────────────────────────── */

/** Convert a Date to `<input type="datetime-local">` string in local TZ. */
export function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Inverse of toDateTimeLocal — parses the control value back into a Date. */
export function fromDateTimeLocal(value: string): Date {
  // `new Date("YYYY-MM-DDTHH:MM")` is treated as local time in all modern browsers.
  return new Date(value);
}

/** Convert a `<input type="date">` value to a local midnight Date. */
export function fromDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function toDateInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ── Time grid helpers for week / day views ─────────────────────────────── */

/** Hours 0..23 used by the time grid on the week / day views. */
export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);

/**
 * Given an event, return its vertical position + height (in pixels) for a
 * time grid with the given row height per hour. Clamps to the day window.
 */
export function eventLayoutInDay(
  event: CalendarEventRow,
  day: Date,
  hourHeight: number,
): { topPx: number; heightPx: number } {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const s = new Date(event.start_at);
  const e = new Date(event.end_at);
  const clampedStart = s < dayStart ? dayStart : s;
  const clampedEnd = e > dayEnd ? dayEnd : e;
  const startMs = clampedStart.getTime() - dayStart.getTime();
  const endMs = clampedEnd.getTime() - dayStart.getTime();
  const topPx = (startMs / (60 * 60 * 1000)) * hourHeight;
  const heightPx = Math.max(
    20, // minimum readable height
    ((endMs - startMs) / (60 * 60 * 1000)) * hourHeight,
  );
  return { topPx, heightPx };
}

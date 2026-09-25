/* ---------------------------------------------------------------------------
   Calendar date math helpers.

   Calendars involve a lot of fiddly boundary logic (first day of the month
   grid, ISO weekday numbers, overlap detection, etc). Keep it in one place
   so the components stay focused on layout.

   Conventions:
   - ISO weekday numbers: 1 = Monday, 7 = Sunday (matches the weekday list in
     access-control.ts and accounts.preferences.calendar.working_hours.days).
   - Grids start on the viewer's first day of week (Settings → Language &
     region); Monday is the default because that is the ISO week.
   - Everything operates in the browser's local timezone; the account's
     preferred zone is shown in the header for orientation only.
   - Text is rendered with the active UI language (`locale`), never the
     browser's default, so an Arabic Hub shows Arabic month names.
   --------------------------------------------------------------------------- */

import type { CalendarEventRow } from "@/types/supabase";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";

export { EVENT_TYPE_COLORS };

/* ── Day helpers ────────────────────────────────────────────────────────── */

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
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

/** yyyy-mm-dd of a local date — the key the holiday overlay uses. */
export function isoDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Convert JS getDay() (0=Sun..6=Sat) to ISO weekday (1=Mon..7=Sun). */
export function isoWeekday(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}

/* ── Week helpers ───────────────────────────────────────────────────────── */

/** Which day the user's week starts on: 0=Sunday, 1=Monday, 6=Saturday. */
export type WeekStart = 0 | 1 | 6;

/** Start of the week containing d, anchored on `weekStart`. */
export function startOfWeek(d: Date, weekStart: WeekStart = 1): Date {
  const iso = isoWeekday(d);                        // 1..7 (Mon..Sun)
  const isoStart = weekStart === 0 ? 7 : weekStart; // Sun=7, Mon=1, Sat=6
  const back = (iso - isoStart + 7) % 7;            // days since the anchor
  return startOfDay(addDays(d, -back));
}

/** Seven consecutive days starting on the user's first day of week. */
export function weekDays(d: Date, weekStart: WeekStart = 1): Date[] {
  const start = startOfWeek(d, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** ISO weekday numbers (1=Mon..7=Sun) in the user's column order — so a
 *  header row can label the grid without re-deriving the rotation. */
export function weekdayOrder(weekStart: WeekStart = 1): number[] {
  const isoStart = weekStart === 0 ? 7 : weekStart;
  return Array.from({ length: 7 }, (_, i) => ((isoStart - 1 + i) % 7) + 1);
}

/* ── Month grid ─────────────────────────────────────────────────────────── */

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The 6-row × 7-column grid for a month view — always 42 dates so the
 *  layout stays stable across months. */
export function monthGrid(d: Date, weekStart: WeekStart = 1): Date[] {
  const gridStart = startOfWeek(startOfMonth(d), weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/* ── Event overlap / layout ─────────────────────────────────────────────── */

/** True if the event overlaps the [from, to) window. */
export function eventOverlapsRange(event: CalendarEventRow, from: Date, to: Date): boolean {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  return start < to && end >= from;
}

/** Only the events that touch this day, earliest first. */
export function eventsOnDay<E extends CalendarEventRow>(events: E[], day: Date): E[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  return events
    .filter((e) => eventOverlapsRange(e, from, to))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}

/** The color an event renders with: its override, else its type's. */
export function colorForEvent(event: Pick<CalendarEventRow, "color" | "event_type">): string {
  return event.color || EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.event;
}

/* ── Formatting (in the UI language) ────────────────────────────────────── */

export function formatMonthYear(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function formatWeekRange(d: Date, locale: string, weekStart: WeekStart = 1): string {
  const s = startOfWeek(d, weekStart);
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sMonth = s.toLocaleDateString(locale, { month: "short" });
  const eMonth = e.toLocaleDateString(locale, { month: "short" });
  if (sameMonth) return `${s.getDate()} – ${e.getDate()} ${sMonth} ${e.getFullYear()}`;
  if (sameYear) return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
  return `${s.getDate()} ${sMonth} ${s.getFullYear()} – ${e.getDate()} ${eMonth} ${e.getFullYear()}`;
}

export function formatFullDay(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** The label of an hour row on the time grid ("9 AM", "09"). */
export function formatHourLabel(h: number, locale: string): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(locale, { hour: "numeric" });
}

/** "14:00 – 15:00", or a two-day span; `allDayLabel` is the translated
 *  "All day". */
export function formatEventTimeRange(event: CalendarEventRow, locale: string, allDayLabel: string): string {
  if (event.all_day) return allDayLabel;
  const s = new Date(event.start_at);
  const e = new Date(event.end_at);
  if (isSameDay(s, e)) return `${formatTime(s, locale)} – ${formatTime(e, locale)}`;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
  return `${s.toLocaleString(locale, opts)} → ${e.toLocaleString(locale, opts)}`;
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
  return isoDateKey(d);
}

/* ── Time grid helpers for week / day views ─────────────────────────────── */

/** Hours 0..23 used by the time grid on the week / day views. */
export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);

/** The working-hours band of a preferences block, in pixels from the top of
 *  a grid with `hourHeight` per hour. */
export function workingHoursBand(
  wh: { start: string; end: string },
  hourHeight: number,
): { topPx: number; heightPx: number } {
  const [sh, sm] = wh.start.split(":").map(Number);
  const [eh, em] = wh.end.split(":").map(Number);
  const startH = (sh || 0) + (sm || 0) / 60;
  const endH = (eh || 0) + (em || 0) / 60;
  return { topPx: startH * hourHeight, heightPx: Math.max(0, endH - startH) * hourHeight };
}

/** Where the "now" line sits on a time grid. */
export function nowOffsetPx(hourHeight: number): number {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * hourHeight;
}

/** An event's vertical position + height (in pixels) for a time grid with
 *  the given row height per hour, clamped to the day window. */
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
  const heightPx = Math.max(20, ((endMs - startMs) / (60 * 60 * 1000)) * hourHeight);
  return { topPx, heightPx };
}

/** Side by side, for a day's timed events: blocks that overlap on the grid
 *  form a cluster, each takes the first lane free where it starts, and the
 *  cluster shares the column width between its lanes. Overlap is judged on
 *  the DRAWN block (never under 20 px), so two short meetings back to back
 *  cannot cover each other either. Before this every block took the full
 *  width and a second one at the same time was drawn on top of the first —
 *  which report deadlines make routine: the daily and the weekly fall due
 *  at the same moment every week. */
export function dayLanes(events: CalendarEventRow[], day: Date, hourHeight: number): Map<string, { lane: number; lanes: number }> {
  const boxes = events
    .map((e) => { const { topPx, heightPx } = eventLayoutInDay(e, day, hourHeight); return { id: e.id, top: topPx, bottom: topPx + heightPx }; })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: Array<{ id: string; lane: number }> = [];
  let ends: number[] = [];
  let groupBottom = 0;
  const close = () => {
    for (const g of group) out.set(g.id, { lane: g.lane, lanes: ends.length });
    group = [];
    ends = [];
  };
  for (const b of boxes) {
    if (group.length && b.top >= groupBottom) close();
    let lane = ends.findIndex((end) => end <= b.top);
    if (lane < 0) { lane = ends.length; ends.push(b.bottom); } else ends[lane] = b.bottom;
    group.push({ id: b.id, lane });
    groupBottom = group.length === 1 ? b.bottom : Math.max(groupBottom, b.bottom);
  }
  close();
  return out;
}

/** Where a block sits across its day column, from its lane: `pad` px kept
 *  at each side of the column, `gap` px between lanes. Inline-start, so the
 *  first lane is on the reading side in Arabic too. */
export function laneStyle(l: { lane: number; lanes: number } | undefined, pad: number, gap = 2): { insetInlineStart: string; width: string } {
  const { lane, lanes } = l ?? { lane: 0, lanes: 1 };
  const share = `(100% - ${2 * pad + (lanes - 1) * gap}px) / ${lanes}`;
  return {
    insetInlineStart: `calc(${pad}px + (${share}) * ${lane} + ${lane * gap}px)`,
    width: `calc(${share})`,
  };
}

/** Round a Date forward to the next :00 or :30. */
export function roundToNextHalfHour(d: Date): Date {
  const x = new Date(d);
  const m = x.getMinutes();
  if (m === 0 || m === 30) { x.setSeconds(0, 0); return x; }
  if (m < 30) x.setMinutes(30, 0, 0);
  else x.setHours(x.getHours() + 1, 0, 0, 0);
  return x;
}

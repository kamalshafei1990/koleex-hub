import "server-only";

/* ---------------------------------------------------------------------------
   Task times, resolved on the server in the caller's timezone.

   The model writes times as it heard them: a full ISO string with an offset
   when it followed the prompt, a bare "2026-09-18T15:00" when it did not, a
   date alone when the caller gave a day and no hour. The tool must not
   guess in UTC: a reminder "at 3" is 15:00 where the caller is, and a task
   "for Thursday" wakes its reminder at a working hour of Thursday there,
   not at midnight UTC (which is Thursday morning in Dubai and Wednesday
   evening in the Americas). Pure functions; the timezone is
   UserContext.timezone (the caller's calendar preference, default
   Asia/Dubai). Node's Intl carries the IANA database — no library.
   --------------------------------------------------------------------------- */

/** The hour a date-only value resolves to: the start of a working morning. */
export const DEFAULT_TASK_HOUR = 9;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The zone's offset from UTC, in minutes, at the given instant. */
function offsetMinutesAt(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return Math.round((asIfUtc - utcMs) / 60_000);
}

/** A wall-clock time in a zone → the instant, as epoch ms. Two passes
 *  settle a DST edge. */
export function zonedToUtcMs(y: number, m: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  const first = offsetMinutesAt(guess, tz);
  let utc = guess - first * 60_000;
  const second = offsetMinutesAt(utc, tz);
  if (second !== first) utc = guess - second * 60_000;
  return utc;
}

function plausible(ms: number): boolean {
  if (!Number.isFinite(ms)) return false;
  const y = new Date(ms).getUTCFullYear();
  return y >= 2000 && y <= 2100;
}

/** Whether the model's value names a clock time at all (a bare date does
 *  not). Decides whether a reminder defaults to the due time. Pure. */
export function hasClockTime(raw: unknown): boolean {
  return typeof raw === "string" && /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw.trim());
}

/** The instant a task value means, as an ISO string in UTC — or null when
 *  the value is not a time. A date alone is that day at `defaultHour` in
 *  the zone; a local datetime without offset is read in the zone; a value
 *  with an offset is taken as written. Pure. */
export function resolveTaskTime(raw: unknown, tz: string, defaultHour: number = DEFAULT_TASK_HOUR): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.toLowerCase() === "none") return null;
  const zone = isValidTz(tz) ? tz : "Asia/Dubai";
  let m = DATE_ONLY.exec(s);
  if (m) {
    const ms = zonedToUtcMs(+m[1], +m[2], +m[3], defaultHour, 0, zone);
    return plausible(ms) ? new Date(ms).toISOString() : null;
  }
  m = LOCAL_DATETIME.exec(s);
  if (m) {
    const ms = zonedToUtcMs(+m[1], +m[2], +m[3], +m[4], +m[5], zone);
    return plausible(ms) ? new Date(ms).toISOString() : null;
  }
  if (HAS_OFFSET.test(s)) {
    const ms = Date.parse(s);
    return plausible(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

/** A calendar day (YYYY-MM-DD) in the zone for a `start_date`-style value:
 *  a date is kept; a datetime is the day it falls on in the zone. Pure. */
export function resolveTaskDay(raw: unknown, tz: string): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.toLowerCase() === "none") return null;
  if (DATE_ONLY.test(s)) return s;
  const iso = resolveTaskTime(s, tz);
  if (!iso) return null;
  const zone = isValidTz(tz) ? tz : "Asia/Dubai";
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(new Date(iso));
}

/** The instant in words, in the zone, for a preview: "Thu 18 Sep, 15:00".
 *  Pure. */
export function describeWhen(iso: string | null, tz: string, locale: string = "en-GB"): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const zone = isValidTz(tz) ? tz : "Asia/Dubai";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: zone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

/** A recurrence word the table accepts, or null. Pure. */
export function parseRecurrence(raw: unknown): "daily" | "weekly" | "monthly" | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "daily" || s === "weekly" || s === "monthly" ? s : null;
}

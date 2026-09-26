/* ---------------------------------------------------------------------------
   calendar-tz — named-timezone date math with Intl only (isomorphic, no deps).

   The Calendar shows one account's calendar in THAT account's timezone
   preference (Settings → Calendar), not in whatever zone the browser sits in.
   Two representations make that cheap:

   · a WALL date — a JS Date whose *local* fields (getFullYear … getMinutes)
     read the wall clock in the calendar's zone. The views keep doing their
     ordinary local-date math on it (startOfDay, addDays, getHours) and it is
     right for the chosen zone. `toWall` makes one from an instant,
     `fromWall` turns one back into the real instant.
   · a DATE KEY — "YYYY-MM-DD", for all-day items, which have no instant.

   When the browser already runs in the calendar's zone both conversions are
   the identity, so nothing changes for the common case.
   --------------------------------------------------------------------------- */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

/** A usable IANA zone name, or "UTC" when the name is unknown. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  if (fmtCache.has(tz)) return tz;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface WallParts { y: number; m: number; d: number; h: number; mi: number; s: number; ms: number }

/** The wall-clock fields of an instant in `tz` (m is 1-based). */
export function zonedParts(ms: number, tz: string): WallParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(safeTimeZone(tz)).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    y: out.year, m: out.month, d: out.day,
    h: out.hour === 24 ? 0 : out.hour, mi: out.minute, s: out.second,
    ms: ((ms % 1000) + 1000) % 1000,
  };
}

/** Offset of `tz` from UTC at an instant, in ms (Dubai → +4h). */
function offsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s, p.ms) - ms;
}

/** The instant at which the wall clock in `tz` reads the given fields.
 *  Month and day may overflow (Date.UTC normalises them). A wall time that
 *  does not exist (a DST gap) resolves to a neighbouring valid instant. */
export function zonedToUtc(y: number, m: number, d: number, h = 0, mi = 0, s = 0, msec = 0, tz = "UTC"): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, msec);
  const zone = safeTimeZone(tz);
  if (zone === "UTC") return guess;
  const off1 = offsetMs(guess, zone);
  let t = guess - off1;
  const off2 = offsetMs(t, zone);
  if (off2 !== off1) t = guess - off2;
  return t;
}

/** "YYYY-MM-DD" of an instant as seen in `tz`. */
export function zonedDateKey(msOrIso: number | string, tz: string): string {
  const ms = typeof msOrIso === "number" ? msOrIso : Date.parse(msOrIso);
  const p = zonedParts(ms, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

let browserZone: string | null = null;
/** The browser's own zone (read once). */
export function browserTimeZone(): string {
  if (browserZone) return browserZone;
  try { browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { browserZone = "UTC"; }
  return browserZone;
}

/** Instant → WALL date for `tz` (see the header). */
export function toWall(msOrIso: number | string | Date, tz: string): Date {
  const ms = msOrIso instanceof Date ? msOrIso.getTime() : typeof msOrIso === "number" ? msOrIso : Date.parse(msOrIso);
  if (safeTimeZone(tz) === browserTimeZone()) return new Date(ms);
  const p = zonedParts(ms, tz);
  return new Date(p.y, p.m - 1, p.d, p.h, p.mi, p.s, p.ms);
}

/** WALL date for `tz` → the real instant. */
export function fromWall(wall: Date, tz: string): Date {
  if (safeTimeZone(tz) === browserTimeZone()) return new Date(wall.getTime());
  return new Date(zonedToUtc(
    wall.getFullYear(), wall.getMonth() + 1, wall.getDate(),
    wall.getHours(), wall.getMinutes(), wall.getSeconds(), wall.getMilliseconds(), tz,
  ));
}

/** Add whole days to a "YYYY-MM-DD" key. */
function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
  return t.toISOString().slice(0, 10);
}

/** An all-day event's [start, end] date keys (end inclusive) from its stored
 *  instants, read in the ORGANIZER's zone. Rows saved as local midnight →
 *  23:59:59.999 and rows saved with an exclusive next-midnight end both come
 *  out right. */
export function allDayKeys(startISO: string, endISO: string, tz: string): { start: string; end: string } {
  const start = zonedDateKey(startISO, tz);
  let end = zonedDateKey(endISO, tz);
  const e = zonedParts(Date.parse(endISO), tz);
  if (end > start && e.h === 0 && e.mi === 0 && e.s === 0 && e.ms === 0) end = addDaysToKey(end, -1);
  return { start, end: end < start ? start : end };
}

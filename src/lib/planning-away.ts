/* ---------------------------------------------------------------------------
   planning-away — Calendar out-of-office time cut into the board's days.

   The week grid and the timeline both draw a person's out-of-office time
   (from /api/planning/leaves → `away`). This turns those spans into
   per-cell slices on the planner's clock (lib/planning-tz), ONE place, so
   the two views, and the client-side conflict flag, agree with the
   server's check (lib/server/planning-conflicts):

     · an all-day event covers whole local days by its date keys;
     · a timed event covers the part of each day it overlaps.

   Pure and isomorphic. A slice carries a title only when the server sent
   one (the viewer could open that event in Calendar anyway); otherwise —
   and always for a private event — it is "Out of office" and a span.
   --------------------------------------------------------------------------- */

import { zonedParts, zonedToUtc } from "@/lib/calendar-tz";
import { dateKey, type AwaySpan } from "@/lib/planning";

export interface AwaySlice {
  /** The slice on this day, as instants (ms). */
  fromMs: number;
  toMs: number;
  /** Covers the whole day (an all-day event, or a timed one spanning it). */
  full: boolean;
  /** The event's title, when the server allowed it for this viewer. */
  title?: string;
}

/** Instant a wall day starts at in `tz`. */
function dayStartMs(d: Date, tz: string): number {
  return zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, 0, 0, tz);
}

/** `resource_id|dayKey` → that day's out-of-office slices. `days` are
 *  wall dates on the planner's clock. */
export function awayDaySlices(spans: AwaySpan[], days: Date[], tz: string): Map<string, AwaySlice[]> {
  const out = new Map<string, AwaySlice[]>();
  if (spans.length === 0 || days.length === 0) return out;
  const bounds = days.map((d) => {
    const from = dayStartMs(d, tz);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { key: dateKey(d), from, to: dayStartMs(next, tz) };
  });
  const add = (k: string, sl: AwaySlice) => {
    const list = out.get(k) ?? [];
    list.push(sl);
    out.set(k, list);
  };
  for (const sp of spans) {
    if (sp.all_day && sp.start_date && sp.end_date) {
      for (const b of bounds) {
        if (sp.start_date <= b.key && b.key <= sp.end_date) add(`${sp.resource_id}|${b.key}`, { fromMs: b.from, toMs: b.to, full: true, ...(sp.title ? { title: sp.title } : {}) });
      }
      continue;
    }
    const s = Date.parse(sp.start_at);
    const e = Date.parse(sp.end_at);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    for (const b of bounds) {
      const from = Math.max(s, b.from);
      const to = Math.min(e, b.to);
      if (to <= from) continue;
      add(`${sp.resource_id}|${b.key}`, { fromMs: from, toMs: to, full: from <= b.from && to >= b.to, ...(sp.title ? { title: sp.title } : {}) });
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.fromMs - b.fromMs);
  return out;
}

/** The hatch every out-of-office mark uses (grid badge, timeline block) —
 *  distinct from leave's solid amber. */
export const AWAY_HATCH = "repeating-linear-gradient(135deg, rgba(100,116,139,0.22) 0 4px, transparent 4px 8px)";

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM–HH:MM" of a slice on the planner's clock (a day's end reads 24:00). */
export function awaySliceRange(sl: AwaySlice, tz: string): string {
  const a = zonedParts(sl.fromMs, tz);
  const b = zonedParts(sl.toMs, tz);
  const endsAtMidnight = b.h === 0 && b.mi === 0 && sl.toMs > sl.fromMs;
  return `${pad(a.h)}:${pad(a.mi)}–${endsAtMidnight ? "24:00" : `${pad(b.h)}:${pad(b.mi)}`}`;
}

/** Does an item [startIso, endIso) overlap any out-of-office time of its
 *  resource on the given day keys? Mirrors the server check: a full-day
 *  slice counts per day the item touches, a timed one by overlap. */
export function overlapsAway(
  cells: Map<string, AwaySlice[]>,
  resourceId: string,
  dayKeys: string[],
  startIso: string,
  endIso: string,
): boolean {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  for (const dk of dayKeys) {
    for (const sl of cells.get(`${resourceId}|${dk}`) ?? []) {
      if (sl.full || (sl.fromMs < e && sl.toMs > s)) return true;
    }
  }
  return false;
}

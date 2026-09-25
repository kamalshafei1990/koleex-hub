/* ---------------------------------------------------------------------------
   Calendar holidays (report GEN-10)

   Holidays are defined per country or per customer, in three categories:
     · weekly   — a recurring weekend / rest day (weekday 0=Sun..6=Sat)
     · national — a public/national holiday (a calendar date, optionally annual)
     · official — a company/official non-working day (a calendar date)

   Client-safe: types, the fetch helper, and a pure expander that turns the
   definitions into dated instances within a visible range. The same rows
   drive HR's working calendar on the server (lib/server/work-calendar.ts).
   --------------------------------------------------------------------------- */

import { isoDateKey } from "@/lib/calendar-utils";

export type HolidayType = "weekly" | "national" | "official";
export type HolidayScope = "country" | "customer";

export interface HolidayRow {
  id: string;
  name: string;
  holiday_type: HolidayType;
  scope_type: HolidayScope;
  country: string | null;
  customer_id: string | null;
  holiday_date: string | null; // ISO yyyy-mm-dd
  weekday: number | null; // 0=Sun..6=Sat
  recurs_annually: boolean;
  is_active: boolean;
}

export interface HolidayInstance {
  id: string;
  name: string;
  type: HolidayType;
  scope: HolidayScope;
  country: string | null;
  customer_id: string | null;
  iso: string; // yyyy-mm-dd for the concrete occurrence
}

/** The tenant's active holiday definitions (the API scopes them). */
export async function fetchHolidays(signal?: AbortSignal): Promise<HolidayRow[]> {
  const res = await fetch("/api/calendar/holidays", { credentials: "include", signal });
  if (!res.ok) return [];
  const j = (await res.json()) as { holidays?: HolidayRow[] };
  return j.holidays ?? [];
}

/**
 * Expand holiday definitions into concrete dated instances within [from, to]
 * (inclusive). Returns a map keyed by yyyy-mm-dd → instances on that day.
 *
 *  · weekly   → every matching weekday in the range
 *  · annual   → the (month, day) in each year touched by the range
 *  · one-off  → the single date, if it falls in the range
 */
export function expandHolidays(
  rows: HolidayRow[],
  from: Date,
  to: Date,
): Record<string, HolidayInstance[]> {
  const out: Record<string, HolidayInstance[]> = {};
  const push = (iso: string, h: HolidayRow) => {
    (out[iso] ??= []).push({
      id: h.id,
      name: h.name,
      type: h.holiday_type,
      scope: h.scope_type,
      country: h.country,
      customer_id: h.customer_id,
      iso,
    });
  };

  const startMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const endMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();

  for (const h of rows) {
    if (!h.is_active) continue;

    if (h.holiday_type === "weekly" && h.weekday != null) {
      for (let t = startMs; t <= endMs; t += 86_400_000) {
        const d = new Date(t);
        if (d.getDay() === h.weekday) push(isoDateKey(d), h);
      }
      continue;
    }

    if (!h.holiday_date) continue;
    const base = new Date(h.holiday_date + "T00:00:00");
    if (Number.isNaN(base.getTime())) continue;

    if (h.recurs_annually) {
      for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const occ = new Date(y, base.getMonth(), base.getDate());
        const occMs = occ.getTime();
        if (occMs >= startMs && occMs <= endMs) push(isoDateKey(occ), h);
      }
    } else {
      const occMs = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
      if (occMs >= startMs && occMs <= endMs) push(isoDateKey(base), h);
    }
  }
  return out;
}

/* ── Super Admin: add / remove (the routes refuse anyone else) ── */

export interface HolidayInput {
  name: string;
  holiday_type: HolidayType;
  country?: string | null;
  holiday_date?: string | null;
  weekday?: number | null;
  recurs_annually?: boolean;
}

export async function createHoliday(input: HolidayInput): Promise<HolidayRow | null> {
  try {
    const res = await fetch("/api/calendar/holidays", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, scope_type: "country" }),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { holiday?: HolidayRow }).holiday ?? null;
  } catch {
    return null;
  }
}

export async function deleteHoliday(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/calendar/holidays/${id}`, { method: "DELETE", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

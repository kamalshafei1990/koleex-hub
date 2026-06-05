/* ---------------------------------------------------------------------------
   Calendar holidays (report GEN-10)

   Holidays are defined per country or per customer, in three categories:
     · weekly   — a recurring weekend / rest day (weekday 0=Sun..6=Sat)
     · national — a public/national holiday (a calendar date, optionally annual)
     · official — a company/official non-working day (a calendar date)

   This module is client-safe: types, a fetch helper that hits the API, and a
   pure expander that turns holiday definitions into concrete dated instances
   within a visible range so views can overlay them.
   --------------------------------------------------------------------------- */

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

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch holiday definitions, optionally filtered by country / customer. */
export async function fetchHolidays(params?: {
  country?: string;
  customerId?: string;
  signal?: AbortSignal;
}): Promise<HolidayRow[]> {
  const qs = new URLSearchParams();
  if (params?.country) qs.set("country", params.country);
  if (params?.customerId) qs.set("customer_id", params.customerId);
  const res = await fetch(`/api/calendar/holidays?${qs.toString()}`, {
    credentials: "include",
    signal: params?.signal,
  });
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
        if (d.getDay() === h.weekday) push(isoOf(d), h);
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
        if (occMs >= startMs && occMs <= endMs) push(isoOf(occ), h);
      }
    } else {
      const occMs = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
      if (occMs >= startMs && occMs <= endMs) push(isoOf(base), h);
    }
  }
  return out;
}

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  weekly: "Weekly",
  national: "National",
  official: "Official",
};

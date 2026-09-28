/* ---------------------------------------------------------------------------
   marketing/insights — the Insights tab's numbers, shared by the server and
   the screen: Meta's day, the Hub's names for the metrics, and the ONE way
   a period's figures and its change against the period before are worked
   out (the route and the tests use the same summarize()).

   Meta's day ends at midnight US Pacific time, so "yesterday" is Meta's
   yesterday. Counts (views, follows, visits, …) add up across days. Viewers
   and reach are unique people: they never add up — a week's or 28 days'
   figure comes from Meta for that window, stored on the window's last day
   (viewers_7d, reach_28d, …), and a 90-day period shows none. The change
   against the period before is shown only when the Hub has every day of
   both periods: a half-collected period never passes for a drop.
   --------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/** YYYY-MM-DD plus n days. */
export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const PACIFIC = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today where Meta's day turns (Pacific). */
export const metaToday = (now: number = Date.now()): string => PACIFIC.format(new Date(now));

/** The last day Meta has closed. */
export const metaYesterday = (now: number = Date.now()): string => addDays(metaToday(now), -1);

/** The instant a Meta day starts: midnight Pacific (07:00 or 08:00 UTC). */
export function metaDayStart(day: string): number {
  const base = Date.parse(`${day}T00:00:00Z`);
  for (const h of [7, 8]) {
    const t = base + h * 3_600_000;
    if (PACIFIC.format(new Date(t)) === day && PACIFIC.format(new Date(t - 1)) !== day) return t;
  }
  return base + 8 * 3_600_000;
}

/** What the Hub stores per account per day (marketing_insight_days.metrics). */
export const INSIGHT_KEYS = [
  "views", "views_followers", "views_others", "viewers_7d", "viewers_28d", "reach_7d", "reach_28d",
  "follows", "unfollows", "visits", "interactions", "likes", "comments", "shares", "saves",
  "link_taps", "video_views", "watch_ms",
] as const;
export type InsightKey = (typeof INSIGHT_KEYS)[number];
export type DayMetrics = Partial<Record<InsightKey, number>>;

/** Counts that add up across days. */
export const ADDITIVE_KEYS = [
  "views", "views_followers", "views_others", "follows", "unfollows", "visits", "interactions",
  "likes", "comments", "shares", "saves", "link_taps", "video_views", "watch_ms",
] as const satisfies readonly InsightKey[];

/** Unique people over a window: the figure is Meta's, never a sum. */
export const UNIQUE_WINDOWS = {
  viewers: { 7: "viewers_7d", 28: "viewers_28d" },
  reach: { 7: "reach_7d", 28: "reach_28d" },
} as const;

/** What the screen shows: the stored counts, the unique figures and net follows. */
export type InsightMetric = (typeof ADDITIVE_KEYS)[number] | keyof typeof UNIQUE_WINDOWS | "net_follows";

export type InsightPeriod = 7 | 28 | 90;
export const INSIGHT_PERIODS: readonly InsightPeriod[] = [7, 28, 90];
export const asPeriod = (v: unknown): InsightPeriod => (v === 7 || v === "7" ? 7 : v === 90 || v === "90" ? 90 : 28);

export interface MetricView {
  /** This period (never null for a shown metric). */
  now: number;
  /** The period before; null when the Hub does not have all of it. */
  before: number | null;
  /** Day by day, oldest first (counts only; empty for unique figures). */
  series: Array<number | null>;
}

export interface PeriodSummary {
  /** First and last day of the period (YYYY-MM-DD, Meta's days). */
  start: string;
  end: string;
  /** How many of the period's days the Hub has, and of the period before. */
  days: number;
  daysBefore: number;
  metrics: Partial<Record<InsightMetric, MetricView>>;
}

/** A period's figures from the stored days — see the header. `counted` is
 *  the days whose own numbers were read (a day that so far holds only a
 *  window's unique figure is not a day the Hub has); all rows when absent. */
export function summarize(rows: ReadonlyMap<string, DayMetrics>, end: string, period: InsightPeriod, counted?: ReadonlySet<string>): PeriodSummary {
  const has = (d: string) => (counted ? counted.has(d) : rows.has(d));
  const day = (d: string) => (has(d) ? rows.get(d) : undefined);
  const current = Array.from({ length: period }, (_, i) => addDays(end, i - period + 1));
  const previous = current.map((d) => addDays(d, -period));
  const days = current.filter(has).length;
  const daysBefore = previous.filter(has).length;
  const fullBefore = days === period && daysBefore === period;
  const metrics: PeriodSummary["metrics"] = {};

  const count = (key: (typeof ADDITIVE_KEYS)[number]) => {
    const series = current.map((d) => day(d)?.[key] ?? null);
    if (series.every((v) => v === null)) return null;
    const now = series.reduce<number>((n, v) => n + (v ?? 0), 0);
    const before = fullBefore ? previous.reduce<number>((n, d) => n + (day(d)?.[key] ?? 0), 0) : null;
    return { now, before, series };
  };
  for (const key of ADDITIVE_KEYS) {
    const m = count(key);
    if (m) metrics[key] = m;
  }

  const f = metrics.follows, u = metrics.unfollows;
  if (f && u) {
    metrics.net_follows = {
      now: f.now - u.now,
      before: f.before !== null && u.before !== null ? f.before - u.before : null,
      series: f.series.map((v, i) => (v === null && u.series[i] === null ? null : (v ?? 0) - (u.series[i] ?? 0))),
    };
  }

  if (period !== 90) {
    for (const name of Object.keys(UNIQUE_WINDOWS) as Array<keyof typeof UNIQUE_WINDOWS>) {
      const key = UNIQUE_WINDOWS[name][period];
      const now = rows.get(end)?.[key];
      if (now === undefined) continue;
      metrics[name] = { now, before: rows.get(addDays(end, -period))?.[key] ?? null, series: [] };
    }
  }

  return { start: current[0], end, days, daysBefore, metrics };
}

/** The change in percent, or null when there is nothing honest to compare. */
export function changePct(m: Pick<MetricView, "now" | "before">): number | null {
  if (m.before === null || m.before === 0) return null;
  return ((m.now - m.before) / Math.abs(m.before)) * 100;
}

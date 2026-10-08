import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-insights — an account's numbers per day, read from Meta for
   the Insights tab and turned into the Hub's names (lib/marketing/insights)
   HERE and nowhere else: when Meta renames or retires a metric, only these
   maps change.

   Facebook Page — /{page}/insights, period=day, up to 90 days a call. Each
   value's end_time closes Meta's day, so it belongs to the day before.
   Viewers are unique people: the rolling week and 28 days come from
   period=week / days_28 and are stored on the window's last day. Views
   are also split by is_from_followers and is_from_ads (Meta answers only
   the non-zero parts, so a missing part is 0); an answer in a shape this
   code does not know is logged once, never guessed at.

   Instagram — /{ig-user}/insights with metric_type=total_value answers ONE
   total for since..until, so a day is one window. A breakdown only fits
   the metrics that support it, so a day is three calls: views by
   follow_type (Meta's table says "follower_type" for views, but Meta refuses
   that name — seen live 28/09/2026 — so follow_type, then no breakdown at
   all), follows_and_unfollows by follow_type (FOLLOWER = follows,
   NON_FOLLOWER = unfollows), and the interactions without a breakdown.
   Reach is unique too: one call per window. A refused call is logged once
   per metric and message, so a Meta change shows up in the logs.

   A call that fails for one metric (Meta fails the whole call) is repeated
   metric by metric, keeping the ones Meta accepts. An expired key (190) is
   thrown for the caller. The page's own key, in the Authorization header.
   --------------------------------------------------------------------------- */

import { MetaError, metaGet, metaGraphUrl } from "@/lib/server/marketing/meta";
import { addDays, metaDayStart, topEntries, totalOf, type AudiencePart, type AudienceSnapshot, type DayMetrics, type InsightKey } from "@/lib/marketing/insights";

interface GraphBreakdown { dimension_keys?: string[]; results?: Array<{ dimension_values?: string[]; value?: unknown }> }
interface GraphMetric {
  name?: string;
  values?: Array<{ value?: unknown; end_time?: string }>;
  total_value?: { value?: unknown; breakdowns?: GraphBreakdown[] };
}
type GraphInsights = { data?: GraphMetric[] };

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

const unix = (ms: number) => String(Math.floor(ms / 1000));

/** Meta's "too many calls" codes: stop and come back later, never retry metric by metric. */
export const META_RATE_LIMIT_CODES: ReadonlySet<number> = new Set([4, 17, 32, 613, 80001, 80002]);
/** A failure that must stop the whole run: an expired key or a rate limit. */
export const stopsRun = (e: unknown): boolean => e instanceof MetaError && (e.code === 190 || META_RATE_LIMIT_CODES.has(e.code ?? -1));

const warned = new Set<string>();
/** One log line per account, metric and Meta message (per server instance). */
function warnRefused(where: string, what: string, e: unknown): void {
  const key = `${where}|${what}|${e instanceof Error ? e.message : String(e)}`;
  if (warned.has(key) || warned.size > 500) return;
  warned.add(key);
  console.warn(`[marketing/insights] Meta refused ${what} for ${where}: ${e instanceof Error ? e.message : String(e)}`);
}

/** An answer in a shape this code does not know: logged once, then left out. */
function warnShape(where: string, what: string, sample: unknown): void {
  const key = `${where}|${what}|shape`;
  if (warned.has(key) || warned.size > 500) return;
  warned.add(key);
  console.warn(`[marketing/insights] unknown answer for ${what} (${where}): ${JSON.stringify(sample).slice(0, 600)}`);
}

const objectOf = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, n] of Object.entries(v)) { const x = num(n); if (x !== null) out[k] = x; }
  return out;
};

const TRUE_KEY = /^(true|1|yes)$/i;
const FALSE_KEY = /^(false|0|no)$/i;

/** A day-by-day breakdown, in either shape Meta uses: one entry per part,
 *  tagged with the breakdown ({"value": 18, "is_from_followers": "0"} — the
 *  live answer, 28/09/2026), or one entry per day keyed by the parts
 *  ({"value": {"1": 12, "0": 300}}). null when the answer has another shape. */
export function breakdownByDay(m: GraphMetric | undefined, breakdown: string): Array<{ day: string; yes: number; no: number }> | null {
  const byDay = new Map<string, { yes: number; no: number }>();
  for (const v of m?.values ?? []) {
    const day = v.end_time ? fbValueDay(v.end_time) : null;
    if (!day) continue;
    const cell = byDay.get(day) ?? { yes: 0, no: 0 };
    const tag = (v as Record<string, unknown>)[breakdown];
    if (tag !== undefined && tag !== null) {
      const x = num(v.value);
      if (x === null) continue;
      const k = String(tag);
      if (TRUE_KEY.test(k)) cell.yes += x;
      else if (FALSE_KEY.test(k)) cell.no += x;
      else return null;
    } else if (v.value && typeof v.value === "object" && !Array.isArray(v.value)) {
      for (const [k, n] of Object.entries(v.value as Record<string, unknown>)) {
        const x = num(n);
        if (x === null) continue;
        if (TRUE_KEY.test(k)) cell.yes += x;
        else if (FALSE_KEY.test(k)) cell.no += x;
      }
    } else {
      return null;
    }
    byDay.set(day, cell);
  }
  return [...byDay].map(([day, c]) => ({ day, ...c }));
}

/** A demographic snapshot's counts, in either shape: the last value an
 *  object ({"EG": 2527, …}), or one entry per key tagged with the
 *  dimension ({"value": 2527, "country": "EG"}) — the last day only. */
export function countsOf(m: GraphMetric | undefined): Record<string, number> | null {
  const values = m?.values ?? [];
  if (!values.length) return null;
  const last = values[values.length - 1];
  if (last.value && typeof last.value === "object" && !Array.isArray(last.value)) return objectOf(last.value);
  const lastEnd = last.end_time;
  const out: Record<string, number> = {};
  for (const v of values) {
    if (lastEnd && v.end_time !== lastEnd) continue;
    const tags = Object.entries(v as Record<string, unknown>).filter(([k]) => k !== "value" && k !== "end_time" && k !== "start_time");
    const x = num(v.value);
    if (tags.length !== 1 || x === null) return null;
    const key = String(tags[0][1]);
    out[key] = (out[key] ?? 0) + x;
  }
  return out;
}

/** Facebook Page metrics per day → the Hub's names. */
export const FB_DAY_METRICS: Readonly<Record<string, InsightKey>> = {
  page_media_view: "views",
  page_daily_follows_unique: "follows",
  page_daily_unfollows_unique: "unfollows",
  page_views_total: "visits",
  page_post_engagements: "interactions",
  page_video_views: "video_views",
  page_video_view_time: "watch_ms",
};

/** Unique viewers over a rolling window (period → the Hub's name). */
export const FB_VIEWERS_METRIC = "page_total_media_view_unique";
export const FB_VIEWER_WINDOWS: ReadonlyArray<readonly ["week" | "days_28", InsightKey]> = [["week", "viewers_7d"], ["days_28", "viewers_28d"]];

/** Views split two ways: breakdown → the Hub's name for its "true" part and,
 *  when both parts are kept, its "false" part. */
export const FB_VIEW_SPLITS: ReadonlyArray<readonly [string, InsightKey, InsightKey | null]> = [
  ["is_from_followers", "views_followers", "views_others"],
  ["is_from_ads", "views_ads", null],
];

/** Instagram totals without a breakdown → the Hub's names. */
export const IG_TOTALS: Readonly<Record<string, InsightKey>> = {
  total_interactions: "interactions",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  profile_links_taps: "link_taps",
};

/** The Meta day a Page value belongs to: its end_time closes that day. */
export function fbValueDay(endTime: string): string | null {
  const t = Date.parse(endTime.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isFinite(t) ? new Date(t - 86_400_000).toISOString().slice(0, 10) : null;
}

/** All the metrics in one call; if Meta refuses the call (one retired or
 *  unavailable metric fails all of them), each metric alone, keeping the
 *  ones it accepts. An expired key is thrown. */
async function readEach(path: string, token: string, metrics: string[], params: Record<string, string>): Promise<GraphMetric[]> {
  const read = async (list: string[]) => (await metaGet<GraphInsights>(metaGraphUrl(path, { ...params, metric: list.join(",") }), token)).data ?? [];
  try {
    return await read(metrics);
  } catch (e) {
    if (!(e instanceof MetaError) || stopsRun(e) || metrics.length === 1) throw e;
    const out: GraphMetric[] = [];
    for (const m of metrics) {
      try {
        out.push(...(await read([m])));
      } catch (one) {
        if (!(one instanceof MetaError) || stopsRun(one)) throw one;
        warnRefused(path, m, one);
      }
    }
    return out;
  }
}

/** Facebook: the days from..to (inclusive). */
export async function facebookPageInsights(pageId: string, token: string, from: string, to: string): Promise<Map<string, DayMetrics>> {
  const days = new Map<string, DayMetrics>();
  const put = (endTime: string | undefined, key: InsightKey, value: unknown) => {
    const day = endTime ? fbValueDay(endTime) : null;
    const n = num(value);
    if (!day || n === null || day < from || day > to) return;
    days.set(day, { ...days.get(day), [key]: n });
  };
  for (let a = from; a <= to; a = addDays(a, 90)) {
    const b = addDays(a, 89) < to ? addDays(a, 89) : to;
    const window = { since: unix(metaDayStart(a)), until: unix(metaDayStart(addDays(b, 1))) };
    for (const m of await readEach(`${pageId}/insights`, token, Object.keys(FB_DAY_METRICS), { ...window, period: "day" })) {
      const key = m.name ? FB_DAY_METRICS[m.name] : undefined;
      if (key) for (const v of m.values ?? []) put(v.end_time, key, v.value);
    }
    for (const [period, key] of FB_VIEWER_WINDOWS) {
      for (const m of await readEach(`${pageId}/insights`, token, [FB_VIEWERS_METRIC], { ...window, period })) {
        if (m.name === FB_VIEWERS_METRIC) for (const v of m.values ?? []) put(v.end_time, key, v.value);
      }
    }
    for (const [breakdown, yesKey, noKey] of FB_VIEW_SPLITS) {
      try {
        const [m] = await readEach(`${pageId}/insights`, token, ["page_media_view"], { ...window, period: "day", breakdown });
        const split = breakdownByDay(m, breakdown);
        if (!split) { warnShape(pageId, `page_media_view by ${breakdown}`, m); continue; }
        for (const { day, yes, no } of split) {
          if (day < from || day > to) continue;
          days.set(day, { ...days.get(day), [yesKey]: yes, ...(noKey ? { [noKey]: no } : {}) });
        }
      } catch (e) {
        if (stopsRun(e)) throw e;
        warnRefused(pageId, `page_media_view by ${breakdown}`, e);
      }
    }
  }
  return days;
}

/** A Page's audience by country and city (Meta's lifetime snapshot). Meta
 *  no longer gives a Page's age and gender. Live (29/09/2026): page_fans_*
 *  are refused and page_follows_* answer with nothing — then the snapshot
 *  says unavailable, so the screen says so instead of "not yet". */
export async function facebookDemographics(pageId: string, token: string): Promise<Pick<AudienceSnapshot, "countries" | "cities" | "totals" | "unavailable">> {
  for (const [country, city] of [["page_fans_country", "page_fans_city"], ["page_follows_country", "page_follows_city"]]) {
    const data = await readEach(`${pageId}/insights`, token, [country, city], { period: "lifetime" }).catch((e) => {
      if (stopsRun(e)) throw e;
      warnRefused(pageId, `${country}, ${city}`, e);
      return [] as GraphMetric[];
    });
    const read = (name: string) => {
      const m = data.find((x) => x.name === name);
      const counts = countsOf(m);
      if (m && !counts && (m.values?.length ?? 0) > 0) warnShape(pageId, name, m);
      return counts ?? {};
    };
    const c = read(country), ci = read(city);
    const countries = topEntries(c), cities = topEntries(ci);
    if (countries.length || cities.length) return { countries, cities, totals: { countries: totalOf(c), cities: totalOf(ci) } };
    if (data.length) warnShape(pageId, `${country}, ${city} (nothing counted)`, data);
  }
  return { countries: [], cities: [], totals: {}, unavailable: true };
}

const results = (m: GraphMetric | undefined) =>
  (m?.total_value?.breakdowns?.[0]?.results ?? []).map((r) => ({ key: r.dimension_values?.[0] ?? "", value: num(r.value) }));

/** Instagram: one Meta day. {} when Meta refused all three calls (it has
 *  nothing for that day — stored, so an old day is not asked for forever);
 *  null when none of them got through (the network: asked again next run).
 *  An expired key or a rate limit is thrown. */
export async function instagramDay(igId: string, token: string, day: string): Promise<DayMetrics | null> {
  const base = { period: "day", metric_type: "total_value", since: unix(metaDayStart(day)), until: unix(metaDayStart(addDays(day, 1))) };
  const path = `${igId}/insights`;
  const readViews = async () => {
    try {
      return await readEach(path, token, ["views"], { ...base, breakdown: "follow_type" });
    } catch (e) {
      if (!(e instanceof MetaError) || stopsRun(e)) throw e;
      warnRefused(path, "views by follow_type", e);
      return readEach(path, token, ["views"], base);
    }
  };
  const settled = await Promise.allSettled([
    readViews(),
    readEach(path, token, ["follows_and_unfollows"], { ...base, breakdown: "follow_type" }),
    readEach(path, token, Object.keys(IG_TOTALS), base),
  ]);
  for (const s of settled) if (s.status === "rejected" && stopsRun(s.reason)) throw s.reason;
  const labels = ["views", "follows_and_unfollows", "interactions"];
  settled.forEach((s, i) => { if (s.status === "rejected" && s.reason instanceof MetaError) warnRefused(path, labels[i], s.reason); });
  if (settled.every((s) => s.status === "rejected")) {
    return settled.every((s) => s.status === "rejected" && s.reason instanceof MetaError) ? {} : null;
  }

  const out: DayMetrics = {};
  const [views, follows, totals] = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  const v = views.find((m) => m.name === "views");
  const total = num(v?.total_value?.value);
  if (total !== null) out.views = total;
  for (const r of results(v)) {
    if (r.value === null) continue;
    if (r.key === "FOLLOWER") out.views_followers = r.value;
    else if (r.key === "NON_FOLLOWER") out.views_others = r.value;
  }
  for (const r of results(follows.find((m) => m.name === "follows_and_unfollows"))) {
    if (r.value === null) continue;
    if (r.key === "FOLLOWER") out.follows = r.value;
    else if (r.key === "NON_FOLLOWER") out.unfollows = r.value;
  }
  for (const m of totals) {
    const key = m.name ? IG_TOTALS[m.name] : undefined;
    const n = num(m.total_value?.value);
    if (key && n !== null) out[key] = n;
  }
  return out;
}

/** Instagram: unique accounts reached over from..to (up to 28 days). */
export async function instagramReach(igId: string, token: string, from: string, to: string): Promise<number | null> {
  const [m] = await readEach(`${igId}/insights`, token, ["reach"], {
    period: "day", metric_type: "total_value", since: unix(metaDayStart(from)), until: unix(metaDayStart(addDays(to, 1))),
  });
  return num(m?.total_value?.value);
}

/** An Instagram account's followers by country, city, age and gender (Meta
 *  gives them for accounts with 100 followers or more). null when none. */
export async function instagramDemographics(igId: string, token: string): Promise<Omit<AudienceSnapshot, "at"> | null> {
  const out: Omit<AudienceSnapshot, "at"> = { countries: [], cities: [], ages: [], genders: [], totals: {} };
  const parts: ReadonlyArray<readonly [string, AudiencePart]> = [["country", "countries"], ["city", "cities"], ["age", "ages"], ["gender", "genders"]];
  for (const [breakdown, key] of parts) {
    try {
      const [m] = await readEach(`${igId}/insights`, token, ["follower_demographics"], { period: "lifetime", metric_type: "total_value", breakdown });
      const values: Record<string, number> = {};
      for (const r of results(m)) if (r.key && r.value !== null) values[r.key] = r.value;
      if (m && !Object.keys(values).length) warnShape(igId, `follower_demographics by ${breakdown}`, m);
      out[key] = topEntries(values);
      out.totals[key] = totalOf(values);
    } catch (e) {
      if (stopsRun(e)) throw e;
      warnRefused(igId, `follower_demographics by ${breakdown}`, e);
    }
  }
  return out.countries.length || out.cities.length || out.ages.length || out.genders.length ? out : null;
}


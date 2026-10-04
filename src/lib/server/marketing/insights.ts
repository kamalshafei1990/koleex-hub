import "server-only";

/* ---------------------------------------------------------------------------
   marketing/insights — the Insights tab: each connected Facebook Page's and
   Instagram account's numbers per day, kept in marketing_insight_days.

   syncInsights, inside a time budget, after CLAIMING the account
   (claimInsights, like the comments refresh):
     · the days it wants are the last 180 (a 90-day period and the 90
       before) that are missing, or not settled yet — Meta finishes a day's
       numbers up to 48 hours late, so a day is fetched again until 72
       hours after it ends;
     · Facebook answers any range in a few calls, so all of it at once;
       Instagram costs three calls per day, so the newest days first, a
       dozen per run, until the history is in (then every 6 hours);
     · Instagram's unique reach for the week and the 28 days ending on the
       period's last day and on the day the period before ends — fetched
       with that day, so the figure settles when the day does.
   Days merge into what is stored: a metric a run could not read is never
   wiped. An expired key marks the account "expired" (Accounts asks to
   reconnect); any other failure keeps what was read and tries again later.
     · the audience (countries, cities; Instagram also age and gender), a
       Meta snapshot read once a day into sync_state.insights_audience;
     · the views of the last 12 months' posts the Feed has without them
       (it reads only the newest), 40 a run, newest first — a post Meta
       has no views for is marked views_na, so it is not asked again. The
       account is complete once its days AND its posts' views are in.

   loadInsights reads the stored days and summarizes a period for the
   screen (lib/marketing/insights.summarize), with the audience, the top
   posts by views and the formats.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { MetaError } from "@/lib/server/marketing/meta";
import { allRowsOrThrow } from "@/lib/server/all-rows";
import { claimInsights, listAccounts, loadAccountForSync, recordInsights, recordSync } from "@/lib/server/marketing/accounts";
import { facebookDemographics, facebookPageInsights, instagramDay, instagramDemographics, instagramReach, stopsRun } from "@/lib/server/marketing/meta-insights";
import { facebookPostViews, instagramInsights } from "@/lib/server/marketing/meta-feed";
import {
  POST_FORMATS, addDays, formatOf, metaDayStart, metaYesterday, postInteractions, summarize,
  type AudienceSnapshot, type DayMetrics, type FormatStat, type InsightKey, type InsightPeriod, type PeriodSummary,
  type PostViewsCoverage, type TopPost,
} from "@/lib/marketing/insights";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

/** A 90-day period and the 90 days before it. */
export const INSIGHT_HISTORY_DAYS = 180;
/** Once the history is in, the numbers refresh every 6 hours. */
export const INSIGHTS_REFRESH_MS = 6 * 3600_000;
/** While the history is still coming in, every cron run continues it. */
const BACKFILL_GAP_MS = 4 * 60_000;
/** A day is fetched again until this long after it ends. */
const SETTLE_MS = 72 * 3600_000;
/** Instagram days per run (three calls each). */
const IG_DAYS_PER_RUN = 12;
/** The audience is a snapshot: once a day is plenty. */
const AUDIENCE_MS = 24 * 3600_000;
/** Older posts' views read per run, and how far back. */
const POST_VIEWS_PER_RUN = 40;
const POST_MONTHS = 12;

interface PostRow { id: string; external_id: string; message: string | null; media: Array<{ kind?: string; url?: string }> | null; permalink: string | null; posted_at: string | null; metrics: Record<string, number> | null }

/** The last 12 months' posts of an account (the Feed's), newest first. */
async function recentPosts(accountId: string): Promise<PostRow[]> {
  const since = new Date(Date.now() - POST_MONTHS * 31 * 86_400_000).toISOString();
  return allRowsOrThrow<PostRow>("marketing insights posts", supabaseServer
    .from("marketing_remote_posts")
    .select("id, external_id, message, media, permalink, posted_at, metrics")
    .eq("account_id", accountId)
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .order("id"));
}

/** Views not asked yet: neither a figure nor Meta's "none". */
const viewsMissing = (m: Record<string, number> | null) => typeof m?.views !== "number" && m?.views_na !== 1;

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

interface StoredDay { day: string; metrics: DayMetrics; synced_at: string }

async function storedDays(accountId: string, from: string, to: string): Promise<Map<string, StoredDay>> {
  const { data, error } = await supabaseServer
    .from("marketing_insight_days")
    .select("day, metrics, synced_at")
    .eq("account_id", accountId)
    .gte("day", from)
    .lte("day", to)
    .limit(INSIGHT_HISTORY_DAYS + 10);
  if (error) throw new Error(`marketing insight days: ${error.message}`);
  return new Map(((data ?? []) as StoredDay[]).map((r) => [r.day, { ...r, metrics: r.metrics ?? {} }]));
}

/** A stored day whose numbers Meta may still change. */
const unsettled = (day: string, syncedAt: string) => (Date.parse(syncedAt) || 0) < metaDayStart(addDays(day, 1)) + SETTLE_MS;

export async function syncInsights(
  tenantId: string,
  accountId: string,
  opts: { budgetMs: number; force?: boolean },
): Promise<{ ok: boolean; skipped?: "unavailable" | "fresh"; days?: number }> {
  const started = Date.now();
  const a = await loadAccountForSync(tenantId, accountId);
  if (!a || a.connection !== "api" || !a.token || !a.external_id || (a.platform !== "facebook" && a.platform !== "instagram")
    || a.status === "disconnected" || a.status === "expired") {
    return { ok: false, skipped: "unavailable" };
  }
  const gap = opts.force ? 60_000 : a.sync_state.insights_full === true ? INSIGHTS_REFRESH_MS : BACKFILL_GAP_MS;
  if (!(await claimInsights(a, gap))) return { ok: true, skipped: "fresh" };

  const end = metaYesterday();
  const first = addDays(end, -(INSIGHT_HISTORY_DAYS - 1));
  const have = await storedDays(a.id, first, end);
  // Missing days, and unsettled ones read longer ago than the refresh rhythm
  // (Refresh: 10 minutes) — so the history keeps moving instead of re-reading
  // the last days every few minutes.
  const readAgo = opts.force ? 10 * 60_000 : INSIGHTS_REFRESH_MS;
  const wanted: string[] = [];
  for (let d = end; d >= first; d = addDays(d, -1)) {
    const row = have.get(d);
    if (!row || (unsettled(d, row.synced_at) && Date.now() - (Date.parse(row.synced_at) || 0) > readAgo)) wanted.push(d);
  }

  const fetched = new Map<string, DayMetrics>();
  const dayFetched = new Set<string>();
  const token = a.token;
  const ext = a.external_id;
  const inBudget = (reserve: number) => Date.now() - started < opts.budgetMs - reserve;

  // The audience, once a day — first: a few calls, before the days take the budget.
  let audience: AudienceSnapshot | null = null;
  const audienceAt = (a.sync_state.insights_audience as { at?: string } | undefined)?.at;
  if ((!audienceAt || Date.now() - (Date.parse(audienceAt) || 0) > AUDIENCE_MS) && inBudget(6_000)) {
    try {
      const d = a.platform === "facebook" ? await facebookDemographics(ext, token) : await instagramDemographics(ext, token);
      if (d) audience = { ages: [], genders: [], ...d, at: new Date().toISOString() };
    } catch (e) {
      if (e instanceof MetaError && e.code === 190) {
        await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
        return { ok: false };
      }
      console.warn(`[marketing/insights] ${a.id}: audience left for later: ${text(e)}`);
    }
  }

  try {
    if (a.platform === "facebook") {
      if (wanted.length) {
        const days = await facebookPageInsights(ext, token, wanted[wanted.length - 1], end);
        // Meta answered for the whole range: a wanted day it gave no numbers
        // for is stored empty, so an old day is not asked for forever.
        for (const d of wanted) { fetched.set(d, days.get(d) ?? {}); dayFetched.add(d); }
        for (const [d, m] of days) if (!fetched.has(d)) { fetched.set(d, m); dayFetched.add(d); }
      }
    } else {
      for (const d of wanted.slice(0, IG_DAYS_PER_RUN)) {
        if (!inBudget(6_000)) break;
        const m = await instagramDay(ext, token, d);
        if (m) { fetched.set(d, m); dayFetched.add(d); }
      }
      const windows: Array<[InsightKey, number]> = [["reach_7d", 7], ["reach_28d", 28]];
      for (const [key, n] of windows) {
        for (const anchor of [end, addDays(end, -n)]) {
          const stored = have.get(anchor)?.metrics[key];
          if (!dayFetched.has(anchor) && stored !== undefined) continue;
          if (!inBudget(4_000)) break;
          const reach = await instagramReach(ext, token, addDays(anchor, -(n - 1)), anchor);
          if (reach !== null) fetched.set(anchor, { ...fetched.get(anchor), [key]: reach });
        }
      }
    }
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return { ok: false };
    }
    // A rate limit or any other failure: keep what was read, try again later.
    console.warn(`[marketing/insights] ${a.id}: kept what was read: ${text(e)}`);
  }

  // Older posts' views, a few a run.
  let postsLeft = 0;
  try {
    const missing = (await recentPosts(a.id)).filter((p) => viewsMissing(p.metrics));
    postsLeft = missing.length;
    for (const post of missing.slice(0, POST_VIEWS_PER_RUN)) {
      if (!inBudget(4_000)) break;
      const got = a.platform === "facebook" ? await facebookPostViews(post.external_id, token) : await instagramInsights(post.external_id, token);
      const metrics = typeof got?.views === "number" ? { ...post.metrics, ...got } : { ...post.metrics, ...(got ?? {}), views_na: 1 };
      const { error } = await supabaseServer.from("marketing_remote_posts").update({ metrics }).eq("id", post.id);
      if (error) throw new Error(`marketing posts: ${error.message}`);
      postsLeft--;
    }
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return { ok: false };
    }
    if (!stopsRun(e)) console.warn(`[marketing/insights] ${a.id}: post views left for later: ${text(e)}`);
  }

  const now = new Date().toISOString();
  const rows = [...fetched].map(([day, m]) => ({
    account_id: a.id,
    tenant_id: a.tenant_id,
    day,
    metrics: { ...have.get(day)?.metrics, ...m },
    // Only a day whose own numbers were read counts as refreshed; a day that
    // only gained a reach figure keeps its time (or is fetched again).
    synced_at: dayFetched.has(day) ? now : have.get(day)?.synced_at ?? new Date(0).toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseServer.from("marketing_insight_days").upsert(rows.slice(i, i + 200), { onConflict: "account_id,day" });
    if (error) throw new Error(`marketing insight days: ${error.message}`);
  }
  const complete = wanted.every((d) => dayFetched.has(d)) && postsLeft <= 0;
  const recorded = await recordInsights(a, complete, audience ? { insights_audience: audience } : {}).catch((e) => { console.warn(`[marketing/insights] ${a.id}: ${text(e)}`); return false; });
  if (!recorded) console.warn(`[marketing/insights] ${a.id}: the account kept changing; its state waits for the next refresh`);
  return { ok: true, days: dayFetched.size };
}

export interface AccountInsights extends PeriodSummary {
  account: MarketingAccountView;
  /** When the Hub last read this account's numbers. */
  synced_at: string | null;
  audience: AudienceSnapshot | null;
  /** The last 12 months' posts: the five with the most views, and the formats. */
  top: TopPost[];
  formats: FormatStat[];
  postViews: PostViewsCoverage;
}

/** The top posts by views and the formats, from the last 12 months' posts. */
export function postsSummary(posts: PostRow[]): { top: TopPost[]; formats: FormatStat[]; postViews: PostViewsCoverage } {
  const shaped = posts.map((p) => {
    const m = p.metrics ?? {};
    const text = p.message?.trim() || null;
    return {
      id: p.id,
      excerpt: text ? Array.from(text).slice(0, 90).join("") : null,
      thumb: p.media?.[0]?.url ?? null,
      permalink: p.permalink,
      posted_at: p.posted_at,
      format: formatOf(p.media),
      views: typeof m.views === "number" ? m.views : null,
      interactions: postInteractions(m),
    };
  });
  const top = shaped.filter((p): p is typeof p & { views: number } => p.views !== null).sort((x, y) => y.views - x.views).slice(0, 5);
  const formats = POST_FORMATS.map((format) => {
    const of = shaped.filter((p) => p.format === format);
    const seen = of.filter((p) => p.views !== null);
    return {
      format,
      posts: of.length,
      avgViews: seen.length ? Math.round(seen.reduce((n, p) => n + (p.views ?? 0), 0) / seen.length) : null,
      avgInteractions: of.length ? Math.round((of.reduce((n, p) => n + p.interactions, 0) / of.length) * 10) / 10 : 0,
    };
  }).filter((f) => f.posts > 0);
  return { top, formats, postViews: { have: posts.filter((p) => !viewsMissing(p.metrics)).length, total: posts.length } };
}

/** The connected Pages and Instagram accounts of a space, summarized. */
export async function loadInsights(
  tenantId: string, space: MarketingSpace, period: InsightPeriod, accountId: string | null,
): Promise<{ period: InsightPeriod; end: string; accounts: AccountInsights[] }> {
  const accounts = (await listAccounts(tenantId, space)).filter((a) =>
    a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram") && a.status !== "disconnected" && (!accountId || a.id === accountId));
  const end = metaYesterday();
  const from = addDays(end, -(period * 2 - 1));
  const { data: states, error: sErr } = accounts.length
    ? await supabaseServer.from("marketing_accounts").select("id, audience:sync_state->insights_audience").eq("tenant_id", tenantId).in("id", accounts.map((a) => a.id))
    : { data: [], error: null };
  if (sErr) throw new Error(`marketing accounts: ${sErr.message}`);
  const audienceOf = new Map(((states ?? []) as Array<{ id: string; audience: AudienceSnapshot | null }>).map((r) => [r.id, r.audience]));
  const out = await Promise.all(accounts.map(async (account) => {
    const [stored, posts] = await Promise.all([storedDays(account.id, from, end), recentPosts(account.id)]);
    const rows = new Map([...stored].map(([d, r]) => [d, r.metrics]));
    // A day counts once its own numbers were read (a reach-only day has no time).
    const counted = new Set([...stored.values()].filter((r) => Date.parse(r.synced_at) > 0).map((r) => r.day));
    const synced = [...stored.values()].reduce<string | null>((m, r) => (!m || r.synced_at > m ? r.synced_at : m), null);
    return {
      account,
      synced_at: synced && Date.parse(synced) > 0 ? synced : null,
      audience: audienceOf.get(account.id) ?? null,
      ...postsSummary(posts),
      ...summarize(rows, end, period, counted),
    };
  }));
  return { period, end, accounts: out };
}

import "server-only";

/* ---------------------------------------------------------------------------
   marketing/sync — refreshes one connected account for the Feed.

   One run, inside a time budget:
     1. the audience and the newest page of posts (new posts + fresh numbers);
     2. the history, page by page, resuming where the last run stopped
        (sync_state.history_after) — a long import finishes over several runs
        instead of failing one. A saved position Meta no longer accepts
        starts the history again on the next run;
     3. views and comments for the newest posts, while the budget lasts;
     4. today's snapshot (audience, this week's posts and engagement) for the
        Feed's change against last week.
   Numbers a run could not read are never wiped: a post's metrics are MERGED
   with what was stored. Views and comments are extras: a refusal there (a
   missing permission, a metric Meta retired) leaves them out, it does not
   fail the posts. An expired key marks the account "expired" (the screen
   asks to reconnect); any other failure marks "error" with Meta's message.

   More new posts than one page since the last run (a quiet week, then a
   busy one) would leave a gap between the newest page and the history, so
   when none of the newest page is known yet the history is walked again —
   resumably, like the first import — until the gap is closed.

   The Feed asks for a refresh when it opens (stale after 10 minutes),
   "Refresh" forces one (once a minute), and the marketing cron refreshes
   every account every 3 hours. A run CLAIMS the account first (claimSync),
   so two screens opening together start one run, and a failing account
   waits its turn like a healthy one. Comments on the last 14 days' posts
   refresh on their own, every 15 minutes (refreshRecentComments, claimed
   with claimComments). Comments on OLDER posts (within 12 months) are found
   by a daily scan of every post's comment count (scanOlderComments, claimed
   with claimCommentScan): a post whose count grew is read.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { allRowsOrThrow } from "@/lib/server/all-rows";
import { MetaError } from "@/lib/server/marketing/meta";
import { postInteractions } from "@/lib/marketing/insights";
import {
  facebookAudience, facebookCommentCounts, facebookComments, facebookPostMedia, facebookPostViews, facebookPosts,
  instagramAudience, instagramCommentCounts, instagramComments, instagramInsights, instagramMedia, instagramMediaItem,
  type CommentCount, type PostPage, type RemoteComment, type RemoteMedia, type RemotePost,
} from "@/lib/server/marketing/meta-feed";
import { claimCommentScan, claimComments, claimSync, loadAccountForSync, recordSync, recordSyncState, type AccountForSync } from "@/lib/server/marketing/accounts";
import { commentWatch } from "@/lib/server/marketing/comment-waiting";
import type { MarketingAccountView, MarketingPlatform } from "@/lib/marketing/spaces";

export const SYNC_STALE_MS = 10 * 60_000;
export const SYNC_MIN_GAP_MS = 60_000;
/* Comments: the posts of the last 14 days (the newest 8), every 15 minutes. */
export const COMMENTS_REFRESH_MS = 15 * 60_000;
const COMMENTS_POST_DAYS = 14;
const COMMENTS_POSTS_MAX = 8;

/* Meta's rate-limit codes (app, user, page, API-specific, Instagram). */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002]);

export interface SyncOutcome {
  accountId: string;
  ok: boolean;
  skipped?: "recent" | "manual" | "not-found" | "removed";
  posts?: number;
  comments?: number;
  historyDone?: boolean;
  error?: string;
}

interface Adapter {
  audience(a: AccountForSync, token: string): Promise<number | null>;
  page(a: AccountForSync, token: string, after: string | null): Promise<PostPage>;
  media(postId: string, token: string): Promise<RemoteMedia[]>;
  insights(postId: string, token: string): Promise<Record<string, number> | null>;
  comments(a: AccountForSync, postId: string, token: string): Promise<RemoteComment[]>;
  commentCounts(a: AccountForSync, token: string, since: string): Promise<CommentCount[]>;
}

const ADAPTERS: Partial<Record<MarketingPlatform, Adapter>> = {
  facebook: {
    audience: (a, t) => facebookAudience(a.external_id!, t),
    page: (a, t, after) => facebookPosts(a.external_id!, t, after),
    media: (id, t) => facebookPostMedia(id, t),
    insights: (id, t) => facebookPostViews(id, t),
    comments: (a, id, t) => facebookComments(a.external_id!, id, t),
    commentCounts: (a, t, since) => facebookCommentCounts(a.external_id!, t, since),
  },
  instagram: {
    audience: (a, t) => instagramAudience(a.external_id!, t),
    page: (a, t, after) => instagramMedia(a.external_id!, t, after),
    media: (id, t) => instagramMediaItem(id, t),
    insights: (id, t) => instagramInsights(id, t),
    comments: (a, id, t) => instagramComments(id, a.handle, t),
    commentCounts: (a, t, since) => instagramCommentCounts(a.external_id!, t, since),
  },
};

/** When the account was last refreshed or last tried, whichever is later. */
export function lastSyncTouch(lastSyncedAt: string | null, lastAttemptAt: string | null): number {
  const at = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  return Math.max(at(lastSyncedAt), at(lastAttemptAt));
}

/** Whether the Feed should ask for this account to be refreshed. */
export function isStale(
  a: Pick<MarketingAccountView, "connection" | "status" | "last_synced_at"> & { last_attempt_at: string | null },
  now = Date.now(),
): boolean {
  if (a.connection !== "api" || (a.status !== "connected" && a.status !== "error")) return false;
  return now - lastSyncTouch(a.last_synced_at, a.last_attempt_at) >= SYNC_STALE_MS;
}

/** A post's engagement: Instagram's own total when Meta gives it, else the
 *  sum of what people did. */
export function engagementOf(m: Record<string, number>): number {
  return postInteractions(m); // the ONE rule, shared with the Insights tab
}

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const attemptOf = (a: AccountForSync) => (typeof a.sync_state.last_attempt_at === "string" ? a.sync_state.last_attempt_at : null);

/* Run `work` over the items, `size` at a time. The first failure stops the
   workers from taking more items and is thrown once they are done. */
async function pool<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (failure === null && next < items.length) {
      const item = items[next++];
      try { await work(item); } catch (e) { if (failure === null) failure = e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  if (failure !== null) throw failure;
}

type Saved = { id: string; metrics: Record<string, number> };

/** Which of these posts the Hub already has for the account. */
async function knownPosts(a: AccountForSync, externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const { data, error } = await supabaseServer
    .from("marketing_remote_posts")
    .select("external_id")
    .eq("account_id", a.id)
    .in("external_id", externalIds)
    .limit(externalIds.length);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  return new Set(((data ?? []) as Array<{ external_id: string }>).map((r) => r.external_id));
}

async function savePosts(a: AccountForSync, posts: RemotePost[]): Promise<Map<string, Saved>> {
  const byExt = new Map(posts.map((p) => [p.external_id, p]));
  if (byExt.size === 0) return new Map();
  const { data: existing, error: readErr } = await inChunks<{ external_id: string; metrics: Record<string, number> | null }>(
    [...byExt.keys()],
    (chunk) => supabaseServer.from("marketing_remote_posts").select("external_id, metrics").eq("account_id", a.id).in("external_id", chunk),
  );
  if (readErr) throw new Error(`marketing posts: ${readErr.message}`);
  const prev = new Map((existing ?? []).map((r) => [r.external_id, r.metrics ?? {}]));
  const now = new Date().toISOString();
  const rows = [...byExt.values()].map((p) => ({
    tenant_id: a.tenant_id,
    account_id: a.id,
    external_id: p.external_id,
    message: p.message,
    media: p.media,
    permalink: p.permalink,
    posted_at: p.posted_at,
    metrics: { ...(prev.get(p.external_id) ?? {}), ...p.metrics },
    metrics_at: now,
    updated_at: now,
  }));
  const saved = new Map<string, Saved>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabaseServer
      .from("marketing_remote_posts")
      .upsert(rows.slice(i, i + 200), { onConflict: "account_id,external_id" })
      .select("id, external_id, metrics");
    if (error) throw new Error(`marketing posts: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: string; external_id: string; metrics: Record<string, number> }>) {
      saved.set(r.external_id, { id: r.id, metrics: r.metrics ?? {} });
    }
  }
  return saved;
}

async function saveComments(a: AccountForSync, rows: Array<{ remotePostId: string; comment: RemoteComment }>): Promise<number> {
  /* One statement may not touch a row twice, so a comment Meta listed twice
     is written once. */
  const byExt = new Map(rows.map(({ remotePostId, comment }) => [comment.external_id, {
    ...comment, tenant_id: a.tenant_id, account_id: a.id, remote_post_id: remotePostId,
  }]));
  const list = [...byExt.values()];
  const watched = await commentWatch(a, list);
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await supabaseServer.from("marketing_comments").upsert(list.slice(i, i + 500), { onConflict: "account_id,external_id" });
    if (error) throw new Error(`marketing comments: ${error.message}`);
  }
  await watched();
  return list.length;
}

async function saveDay(a: AccountForSync, audience: number | null, posts: Array<{ posted_at: string | null; metrics: Record<string, number> }>): Promise<void> {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = posts.filter((p) => p.posted_at && Date.parse(p.posted_at) >= weekAgo);
  const { error } = await supabaseServer.from("marketing_account_days").upsert({
    account_id: a.id,
    tenant_id: a.tenant_id,
    day: new Date().toISOString().slice(0, 10),
    audience,
    posts: week.length,
    engagement: week.reduce((n, p) => n + engagementOf(p.metrics), 0),
  }, { onConflict: "account_id,day" });
  if (error) throw new Error(`marketing account days: ${error.message}`);
}

export async function syncAccount(
  tenantId: string,
  accountId: string,
  opts: { force?: boolean; budgetMs?: number } = {},
): Promise<SyncOutcome> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 40_000;
  const within = (share: number) => Date.now() - started < budget * share;

  const a = await loadAccountForSync(tenantId, accountId);
  if (!a) return { accountId, ok: false, skipped: "not-found" };
  if (a.status === "disconnected") return { accountId, ok: true, skipped: "removed" };
  const adapter = ADAPTERS[a.platform];
  if (a.connection !== "api" || !a.token || !a.external_id || !adapter) return { accountId, ok: true, skipped: "manual" };
  const touched = lastSyncTouch(a.last_synced_at, attemptOf(a));
  if (touched && Date.now() - touched < (opts.force ? SYNC_MIN_GAP_MS : SYNC_STALE_MS)) return { accountId, ok: true, skipped: "recent" };
  if (!(await claimSync(a))) return { accountId, ok: true, skipped: "recent" };
  const token = a.token;

  try {
    const audience = await adapter.audience(a, token);
    const first = await adapter.page(a, token, null);
    const seen: RemotePost[] = [...first.posts];

    const state = a.sync_state as { history_after?: string | null; history_done?: boolean };
    /* A full newest page with nothing the Hub knows: there may be a gap
       below it, so the history is walked again from there. */
    const gap = state.history_done === true && !!first.after && (await knownPosts(a, first.posts.map((p) => p.external_id))).size === 0;
    const walked = state.history_done === true && !gap;
    let after: string | null = walked ? null : (state.history_after ?? first.after);
    let restart = false;
    while (after && within(0.5)) {
      let page: PostPage;
      try {
        page = await adapter.page(a, token, after);
      } catch (e) {
        if (!(e instanceof MetaError) || e.code === 190) throw e;
        if (!RATE_LIMIT_CODES.has(e.code ?? -1)) {
          console.warn(`[marketing/sync] ${a.platform} ${a.id}: history position refused, starting it again next run: ${text(e)}`);
          restart = true;
        }
        break;
      }
      seen.push(...page.posts);
      after = page.after;
    }
    const historyDone = !restart && (walked || after === null);
    const saved = await savePosts(a, seen);

    /* Views and comments of the newest posts, three at a time. */
    const now = new Date().toISOString();
    const metricRows: Array<Record<string, unknown>> = [];
    const commentRows: Array<{ remotePostId: string; comment: RemoteComment }> = [];
    let throttled = false;
    const extra = async <T,>(call: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await call;
      } catch (e) {
        if (e instanceof MetaError && e.code === 190) throw e;
        if (e instanceof MetaError && RATE_LIMIT_CODES.has(e.code ?? -1)) throttled = true;
        console.warn(`[marketing/sync] ${a.platform} ${a.id}: left out: ${text(e)}`);
        return fallback;
      }
    };
    await pool(first.posts, 3, async (p) => {
      if (throttled || !within(0.9)) return;
      const row = saved.get(p.external_id);
      if (!row) return;
      const [insights, list] = await Promise.all([
        extra(adapter.insights(p.external_id, token), null),
        extra(adapter.comments(a, p.external_id, token), [] as RemoteComment[]),
      ]);
      if (insights && Object.keys(insights).length) {
        row.metrics = { ...row.metrics, ...insights };
        metricRows.push({ tenant_id: a.tenant_id, account_id: a.id, external_id: p.external_id, metrics: row.metrics, metrics_at: now });
      }
      for (const comment of list) commentRows.push({ remotePostId: row.id, comment });
    });
    /* An upsert updates only the columns it names: the numbers here. */
    for (let i = 0; i < metricRows.length; i += 200) {
      const { error } = await supabaseServer.from("marketing_remote_posts").upsert(metricRows.slice(i, i + 200), { onConflict: "account_id,external_id" });
      if (error) throw new Error(`marketing posts: ${error.message}`);
    }
    const comments = await saveComments(a, commentRows);

    await saveDay(a, audience, first.posts.map((p) => ({ posted_at: p.posted_at, metrics: saved.get(p.external_id)?.metrics ?? p.metrics })));
    /* The Feed's marks are MERGED onto the account's current state: the
       other steps keep theirs there too (insights, the comment scans, the
       ads scan). Writing this object whole wiped them on every refresh
       (found 29/09/2026). */
    await recordSyncState(a, {
      history_after: historyDone || restart ? null : after,
      history_done: historyDone,
      last_attempt_at: attemptOf(a),
      last_run_posts: seen.length,
    });
    await recordSync(a.id, { status: "connected", last_error: null, audience, synced: true });
    return { accountId, ok: true, posts: seen.length, comments, historyDone };
  } catch (e) {
    const expired = e instanceof MetaError && e.code === 190;
    const message = text(e);
    console.error(`[marketing/sync] ${a.platform} ${a.id}: ${message}`);
    await recordSync(a.id, { status: expired ? "expired" : "error", last_error: message, synced: false }).catch(() => {});
    return { accountId, ok: false, error: message };
  }
}

/** The first refresh of accounts just connected — run after the connect
 *  response has gone, three accounts at a time inside one budget. An account
 *  the budget does not reach is refreshed when the Feed opens. */
export async function syncAccounts(tenantId: string, ids: readonly string[], budgetMs = 50_000): Promise<SyncOutcome[]> {
  const started = Date.now();
  const out: SyncOutcome[] = [];
  await pool(ids, 3, async (id) => {
    const left = budgetMs - (Date.now() - started);
    if (left < 8_000) return;
    out.push(await syncAccount(tenantId, id, { force: true, budgetMs: left }));
  });
  return out;
}

/** Refresh one post when someone opens it: its pictures (Meta's picture
 *  links expire after some days) and, unless only the pictures are asked
 *  for, its numbers and comments. Best effort: a refusal keeps what was
 *  stored; an expired key marks the account like a sync would. */
export async function refreshPost(tenantId: string, postId: string, parts: { engagement: boolean }): Promise<void> {
  const { data: post, error } = await supabaseServer
    .from("marketing_remote_posts")
    .select("id, account_id, external_id, metrics")
    .eq("tenant_id", tenantId)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (!post) return;
  const row = post as { id: string; account_id: string; external_id: string; metrics: Record<string, number> | null };
  const a = await loadAccountForSync(tenantId, row.account_id);
  const adapter = a ? ADAPTERS[a.platform] : undefined;
  if (!a || !adapter || a.connection !== "api" || !a.token || a.status === "disconnected" || a.status === "expired") return;
  const token = a.token;
  const soft = async <T,>(call: Promise<T>): Promise<T | null> => {
    try {
      return await call;
    } catch (e) {
      if (e instanceof MetaError && e.code === 190) throw e;
      console.warn(`[marketing/sync] post ${row.id}: left out: ${text(e)}`);
      return null;
    }
  };
  try {
    const [media, insights, comments] = await Promise.all([
      soft(adapter.media(row.external_id, token)),
      parts.engagement ? soft(adapter.insights(row.external_id, token)) : Promise.resolve(null),
      parts.engagement ? soft(adapter.comments(a, row.external_id, token)) : Promise.resolve(null),
    ]);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (media && media.length) patch.media = media;
    if (insights && Object.keys(insights).length) {
      patch.metrics = { ...(row.metrics ?? {}), ...insights };
      patch.metrics_at = now;
    }
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabaseServer.from("marketing_remote_posts").update({ ...patch, updated_at: now }).eq("id", row.id);
      if (upErr) throw new Error(`marketing posts: ${upErr.message}`);
    }
    if (comments && comments.length) await saveComments(a, comments.map((comment) => ({ remotePostId: row.id, comment })));
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return;
    }
    throw e;
  }
}

/** The comments of an account's recent posts — the last 14 days, the newest
 *  8 — unless they were refreshed less than `minGapMs` ago (claimed first,
 *  so two runs never both call Meta). A post Meta refuses is skipped; an
 *  expired key marks the account "expired" and stops. */
export async function refreshRecentComments(
  tenantId: string, accountId: string, opts: { minGapMs: number; budgetMs: number },
): Promise<{ ok: boolean; skipped?: "unavailable" | "fresh"; comments?: number }> {
  const started = Date.now();
  const a = await loadAccountForSync(tenantId, accountId);
  const adapter = a ? ADAPTERS[a.platform] : undefined;
  if (!a || !adapter || a.connection !== "api" || !a.token || !a.external_id || a.status === "disconnected" || a.status === "expired") {
    return { ok: false, skipped: "unavailable" };
  }
  if (!(await claimComments(a, opts.minGapMs))) return { ok: true, skipped: "fresh" };
  const since = new Date(Date.now() - COMMENTS_POST_DAYS * 86_400_000).toISOString();
  const { data: posts, error } = await supabaseServer
    .from("marketing_remote_posts")
    .select("id, external_id")
    .eq("tenant_id", tenantId)
    .eq("account_id", a.id)
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .limit(COMMENTS_POSTS_MAX);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  const token = a.token;
  const rows: Array<{ remotePostId: string; comment: RemoteComment }> = [];
  for (const p of (posts ?? []) as Array<{ id: string; external_id: string }>) {
    if (Date.now() - started > opts.budgetMs - 3_000) break;
    try {
      for (const comment of await adapter.comments(a, p.external_id, token)) rows.push({ remotePostId: p.id, comment });
    } catch (e) {
      if (e instanceof MetaError && e.code === 190) {
        await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
        return { ok: false };
      }
      console.warn(`[marketing/sync] comments of ${p.id}: left out: ${text(e)}`);
    }
  }
  return { ok: true, comments: rows.length ? await saveComments(a, rows) : 0 };
}

/** Once a day per account the scan runs; while a backlog remains, every run. */
export const COMMENT_SCAN_MS = 24 * 3600_000;
const COMMENT_SCAN_BACKLOG_MS = 4 * 60_000;
const COMMENT_SCAN_MONTHS = 12;
/** Older posts whose comments are read per run. */
const COMMENT_SCAN_READS = 30;

/** Comments on OLDER posts — older than the 15-minute refresh's 14 days,
 *  within 12 months: every post's comment count from Meta (a few calls),
 *  then the posts whose count grew since their comments were last read — or
 *  that were never read and have comments — are read, newest first.
 *  metrics.comments_seen keeps the count at that read (the Feed's own
 *  "comments" number is left as it is). */
export async function scanOlderComments(
  tenantId: string, accountId: string, opts: { budgetMs: number },
): Promise<{ ok: boolean; skipped?: "unavailable" | "fresh"; read?: number; left?: number }> {
  const started = Date.now();
  const a = await loadAccountForSync(tenantId, accountId);
  const adapter = a ? ADAPTERS[a.platform] : undefined;
  if (!a || !adapter || a.connection !== "api" || !a.token || !a.external_id || a.status === "disconnected" || a.status === "expired") {
    return { ok: false, skipped: "unavailable" };
  }
  const gap = a.sync_state.comments_scan_full === true ? COMMENT_SCAN_MS : COMMENT_SCAN_BACKLOG_MS;
  if (!(await claimCommentScan(a, gap))) return { ok: true, skipped: "fresh" };
  const token = a.token;
  const since = new Date(Date.now() - COMMENT_SCAN_MONTHS * 31 * 86_400_000).toISOString();
  const recent = Date.now() - COMMENTS_POST_DAYS * 86_400_000;
  try {
    const counts = await adapter.commentCounts(a, token, since);
    const posts = await allRowsOrThrow<{ id: string; external_id: string; posted_at: string | null; metrics: Record<string, number> | null }>(
      "marketing older comments",
      supabaseServer.from("marketing_remote_posts").select("id, external_id, posted_at, metrics").eq("account_id", a.id).gte("posted_at", since).order("posted_at", { ascending: false }).order("id"),
    );
    const byExt = new Map(posts.map((p) => [p.external_id, p]));
    const due = counts.filter((c) => {
      const p = byExt.get(c.external_id);
      if (!p || (p.posted_at && Date.parse(p.posted_at) >= recent)) return false;
      const seen = p.metrics?.comments_seen;
      return typeof seen === "number" ? c.count > seen : c.count > 0;
    });
    let read = 0;
    for (const c of due) {
      if (read >= COMMENT_SCAN_READS || Date.now() - started > opts.budgetMs - 3_000) break;
      const p = byExt.get(c.external_id)!;
      const comments = await adapter.comments(a, c.external_id, token);
      if (comments.length) await saveComments(a, comments.map((comment) => ({ remotePostId: p.id, comment })));
      const { error } = await supabaseServer.from("marketing_remote_posts").update({ metrics: { ...p.metrics, comments_seen: c.count } }).eq("id", p.id);
      if (error) throw new Error(`marketing posts: ${error.message}`);
      read++;
    }
    const left = due.length - read;
    await recordSyncState(a, { comments_scan_full: left <= 0 });
    return { ok: true, read, left };
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return { ok: false };
    }
    console.warn(`[marketing/sync] older comments of ${a.id}: left for later: ${text(e)}`);
    return { ok: false };
  }
}

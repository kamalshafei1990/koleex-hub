import "server-only";

/* ---------------------------------------------------------------------------
   marketing/feed — what the Feed shows, read from what the syncs stored:
   one column per account read by API, each with its week (followers now and
   the change against 7 days ago, from marketing_account_days) and its newest
   posts, twelve at a time; and one post with its whole text, all its
   pictures and its comments.

   Posts page by (posted_at, id), newest first, so two posts published in the
   same second are neither skipped nor shown twice. Every read is bounded.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { namesOf } from "@/lib/server/marketing/posts";
import { feedAccount, listFeedAccounts, type FeedAccount } from "@/lib/server/marketing/accounts";
import { isStale } from "@/lib/server/marketing/sync";
import type { FeedColumn, FeedComment, FeedMedia, FeedPost, FeedResponse, FeedWeek, PostDetail } from "@/lib/marketing/feed-types";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

export const FEED_PAGE = 12;
const EXCERPT_CHARS = 280;
const POST_COLUMNS = "id, account_id, message, media, permalink, posted_at, metrics";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PostRow = {
  id: string;
  account_id: string;
  message: string | null;
  media: FeedMedia[] | null;
  permalink: string | null;
  posted_at: string;
  metrics: Record<string, number> | null;
};

function toFeedPost(r: PostRow): FeedPost {
  const message = r.message?.trim() || null;
  /* By characters, not UTF-16 units, so an emoji is never cut in half. */
  const chars = message ? Array.from(message) : [];
  const media = Array.isArray(r.media) ? r.media : [];
  return {
    id: r.id,
    account_id: r.account_id,
    excerpt: message ? (chars.length > EXCERPT_CHARS ? chars.slice(0, EXCERPT_CHARS).join("").trimEnd() : message) : null,
    truncated: chars.length > EXCERPT_CHARS,
    thumb: media[0] ?? null,
    media_count: media.length,
    permalink: r.permalink,
    posted_at: r.posted_at,
    metrics: r.metrics ?? {},
  };
}

/** A page position: "<posted_at>|<post id>". null when it is not one. */
export function parseCursor(raw: string | null): { at: string; id: string } | null {
  if (!raw) return null;
  const cut = raw.lastIndexOf("|");
  if (cut <= 0) return null;
  const at = raw.slice(0, cut);
  const id = raw.slice(cut + 1);
  const ms = Date.parse(at);
  if (!UUID_RE.test(id) || Number.isNaN(ms)) return null;
  return { at: new Date(ms).toISOString(), id };
}

async function postsPage(tenantId: string, accountId: string, cursor: { at: string; id: string } | null): Promise<{ posts: FeedPost[]; next: string | null }> {
  let q = supabaseServer
    .from("marketing_remote_posts")
    .select(POST_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("account_id", accountId)
    .not("posted_at", "is", null);
  if (cursor) q = q.or(`posted_at.lt."${cursor.at}",and(posted_at.eq."${cursor.at}",id.lt.${cursor.id})`);
  const { data, error } = await q
    .order("posted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEED_PAGE + 1);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  const rows = (data ?? []) as PostRow[];
  const posts = rows.slice(0, FEED_PAGE).map(toFeedPost);
  const last = posts[posts.length - 1];
  return { posts, next: rows.length > FEED_PAGE && last ? `${last.posted_at}|${last.id}` : null };
}

async function weeksOf(tenantId: string, ids: string[]): Promise<Map<string, FeedWeek>> {
  const out = new Map<string, FeedWeek>();
  if (ids.length === 0) return out;
  const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from("marketing_account_days")
    .select("account_id, day, audience, posts, engagement")
    .eq("tenant_id", tenantId)
    .in("account_id", ids)
    .gte("day", day(14))
    .order("day", { ascending: false })
    .limit(ids.length * 15);
  if (error) throw new Error(`marketing account days: ${error.message}`);
  type Day = { account_id: string; day: string; audience: number | null; posts: number | null; engagement: number | null };
  const weekAgo = day(7);
  const byAccount = new Map<string, Day[]>();
  for (const r of (data ?? []) as Day[]) byAccount.set(r.account_id, [...(byAccount.get(r.account_id) ?? []), r]);
  for (const [id, days] of byAccount) {
    const now = days[0];
    const base = days.find((d) => d.day <= weekAgo);
    const diff = (x: number | null | undefined, y: number | null | undefined) => (x != null && y != null ? x - y : null);
    out.set(id, {
      audience_change: diff(now?.audience, base?.audience),
      posts: now?.posts ?? null,
      engagement: now?.engagement ?? null,
      engagement_change: diff(now?.engagement, base?.engagement),
    });
  }
  return out;
}

function toColumn(a: FeedAccount, week: FeedWeek | null, page: { posts: FeedPost[]; next: string | null }, now: number): FeedColumn {
  const account: MarketingAccountView & { last_attempt_at?: string | null } = { ...a };
  delete account.last_attempt_at;
  return { account, stale: isStale(a, now), week, posts: page.posts, next: page.next };
}

export async function loadFeed(tenantId: string, space: MarketingSpace): Promise<FeedResponse> {
  const { accounts, manual, publishOnly } = await listFeedAccounts(tenantId, space);
  const [weeks, pages] = await Promise.all([
    weeksOf(tenantId, accounts.map((a) => a.id)),
    Promise.all(accounts.map((a) => postsPage(tenantId, a.id, null))),
  ]);
  const now = Date.now();
  return { columns: accounts.map((a, i) => toColumn(a, weeks.get(a.id) ?? null, pages[i], now)), manual, publishOnly };
}

/** One column again, after its account was refreshed. */
export async function loadColumn(tenantId: string, accountId: string): Promise<FeedColumn | null> {
  const a = await feedAccount(tenantId, accountId);
  if (!a) return null;
  const [weeks, page] = await Promise.all([weeksOf(tenantId, [a.id]), postsPage(tenantId, a.id, null)]);
  return toColumn(a, weeks.get(a.id) ?? null, page, Date.now());
}

/** The next page of an account's older posts; null when the account is not
 *  one the Feed shows. */
export async function loadMorePosts(tenantId: string, accountId: string, cursor: { at: string; id: string }): Promise<{ posts: FeedPost[]; next: string | null } | null> {
  if (!(await feedAccount(tenantId, accountId))) return null;
  return postsPage(tenantId, accountId, cursor);
}

/** The account a post belongs to; null when it is not this tenant's. */
export async function postAccountId(tenantId: string, postId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("marketing_remote_posts")
    .select("account_id")
    .eq("tenant_id", tenantId)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  return (data as { account_id: string } | null)?.account_id ?? null;
}

/** A post with its comments. Hidden comments only for `withHidden` — the
 *  people who may hide them. What the caller may do is the route's to add. */
export async function loadPostDetail(tenantId: string, postId: string, opts: { withHidden: boolean }): Promise<Omit<PostDetail, "canReply" | "canHide"> | null> {
  const [{ data: post, error }, { data: comments, error: cErr }] = await Promise.all([
    supabaseServer.from("marketing_remote_posts").select(POST_COLUMNS).eq("tenant_id", tenantId).eq("id", postId).maybeSingle(),
    supabaseServer
      .from("marketing_comments")
      .select("id, external_id, parent_external_id, author_name, author_avatar_url, message, commented_at, is_ours, hidden, replied_by, handled_at")
      .eq("tenant_id", tenantId)
      .eq("remote_post_id", postId)
      .in("hidden", opts.withHidden ? [false, true] : [false])
      .not("external_id", "like", "pending:%")
      .order("commented_at", { ascending: true })
      .limit(300),
  ]);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (cErr) throw new Error(`marketing comments: ${cErr.message}`);
  if (!post) return null;
  const row = post as PostRow;
  type C = Omit<FeedComment, "replied_by_name"> & { replied_by: string | null };
  const list = (comments ?? []) as C[];
  const names = await namesOf(list.map((c) => c.replied_by).filter((x): x is string => !!x));
  return {
    post: { ...toFeedPost(row), message: row.message, media: Array.isArray(row.media) ? row.media : [] },
    comments: list.map(({ replied_by, ...c }) => ({ ...c, replied_by_name: replied_by ? names.get(replied_by) || null : null })),
  };
}

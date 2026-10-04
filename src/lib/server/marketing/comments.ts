import "server-only";

/* ---------------------------------------------------------------------------
   marketing/comments — comments on the connected accounts' posts, answered
   from the Hub (owner, 28/09/2026).

     · The list: threads of the last 90 days (a first comment and its
       replies), newest activity first, «Needs a reply» by the ONE rule in
       lib/marketing/comment-types. Hidden comments are only ever sent to
       the people who may hide them.
     · Reply: anyone with "edit" on the account's space. The reply is CLAIMED
       before Meta is called — a placeholder row whose key is the thread and
       the words, so a double click, two tabs or a retry send ONE reply —
       then it becomes the real comment (or is removed when Meta refuses).
       Meta's own explanation comes back to the person.
     · Hide / show again: approvers only (the route checks). Koleex's own
       replies are never hidden.
     · «No reply needed»: set on the thread's first comment; a newer comment
       in the thread brings it back on its own.
   Reads are bounded: 3,000 comments of the window, 300 older parents.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";
import { pageAccessRemoved } from "@/lib/marketing/spaces";
import { supabaseServer } from "@/lib/server/supabase-server";
import { allRows } from "@/lib/server/all-rows";
import { inChunks } from "@/lib/server/in-chunks";
import { listAccounts, loadAccountForSync, recordSync, type AccountForSync } from "@/lib/server/marketing/accounts";
import { MetaError } from "@/lib/server/marketing/meta";
import { hideOnPlatform, replyOnPlatform } from "@/lib/server/marketing/meta-comments";
import { later, settleComment } from "@/lib/server/marketing/notify";
import { namesOf } from "@/lib/server/marketing/posts";
import {
  REPLY_MAX, groupThreads, lastVisible, needsReply,
  type CommentFilter, type CommentThread, type CommentView,
} from "@/lib/marketing/comment-types";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

const WINDOW_DAYS = 90;
const WINDOW_ROWS = 3000;
const PARENTS_MAX = 300;
const PAGE = 20;
/* A reply being sent: the placeholder's key (never shown, never counted). */
const PENDING = "pending:";
const CLAIM_MS = 120_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS = "id, account_id, remote_post_id, ad_post_id, external_id, parent_external_id, author_name, author_avatar_url, message, commented_at, is_ours, hidden, replied_by, handled_at, handled_by";
const COUNT_COLUMNS = "id, account_id, external_id, parent_external_id, is_ours, hidden, commented_at, handled_at";

type Row = {
  id: string; account_id: string; remote_post_id: string | null; ad_post_id: string | null; external_id: string; parent_external_id: string | null;
  author_name: string | null; author_avatar_url: string | null; message: string | null; commented_at: string | null;
  is_ours: boolean; hidden: boolean; replied_by: string | null; handled_at: string | null; handled_by: string | null;
};

export type Result<T = { ok: true }> = T | { error: string; status: number; code?: string };
export const isError = <T,>(r: Result<T>): r is { error: string; status: number; code?: string } => typeof r === "object" && r !== null && "error" in r;

/** The comments of the window, and the older first comments their replies
 *  hang under. */
async function windowRows<R extends { external_id: string; parent_external_id: string | null }>(tenantId: string, accountIds: string[], columns: string): Promise<R[]> {
  if (!accountIds.length) return [];
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  /* Paged: the API answers 1000 rows at most, silently; WINDOW_ROWS stays
     the ceiling (reaching it is logged). */
  const { data, error } = await allRows<R>(
    supabaseServer
      .from("marketing_comments")
      .select(columns)
      .eq("tenant_id", tenantId)
      .in("account_id", accountIds)
      .gte("commented_at", since)
      .not("external_id", "like", `${PENDING}%`)
      .order("commented_at", { ascending: false })
      .order("id"),
    "marketing comments",
    WINDOW_ROWS,
  );
  if (error) throw new Error(`marketing comments: ${error.message}`);
  const rows = data ?? [];
  const have = new Set(rows.map((r) => r.external_id));
  const missing = [...new Set(rows.map((r) => r.parent_external_id).filter((p): p is string => !!p && !have.has(p)))].slice(0, PARENTS_MAX);
  if (missing.length) {
    const { data: parents, error: pErr } = await inChunks<R>(missing, (chunk) =>
      supabaseServer.from("marketing_comments").select(columns).eq("tenant_id", tenantId).in("account_id", accountIds).in("external_id", chunk).limit(chunk.length * 2) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>);
    if (pErr) throw new Error(`marketing comments: ${pErr.message}`);
    rows.push(...(parents ?? []));
  }
  return rows;
}

/** The space's accounts that can have comments (Meta's, connected by API —
 *  LinkedIn sends none back). */
async function commentAccounts(tenantId: string, space: MarketingSpace): Promise<MarketingAccountView[]> {
  return (await listAccounts(tenantId, space)).filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram"));
}

/** How many threads wait for a reply — the number on the Comments tab. */
export async function needsReplyCount(tenantId: string, space: MarketingSpace): Promise<number> {
  const accounts = await commentAccounts(tenantId, space);
  const rows = await windowRows<Row>(tenantId, accounts.map((a) => a.id), COUNT_COLUMNS);
  return groupThreads(rows).filter((g) => needsReply(g.first, g.replies)).length;
}

const view = (r: Row, names: Map<string, string>): CommentView => ({
  id: r.id, external_id: r.external_id, parent_external_id: r.parent_external_id,
  author_name: r.author_name, author_avatar_url: r.author_avatar_url, message: r.message,
  commented_at: r.commented_at, is_ours: r.is_ours, hidden: r.hidden,
  replied_by_name: r.replied_by ? names.get(r.replied_by) || null : null,
});

/** One page of threads. `canSeeHidden`: the caller may hide comments — only
 *  then are hidden ones sent at all. */
export async function listThreads(
  tenantId: string, space: MarketingSpace,
  opts: { filter: CommentFilter; accountId: string | null; cursor: number; canSeeHidden: boolean },
): Promise<{ threads: CommentThread[]; next: number | null; counts: { needs: number; hidden: number } }> {
  const accounts = await commentAccounts(tenantId, space);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ids = opts.accountId ? (byId.has(opts.accountId) ? [opts.accountId] : []) : [...byId.keys()];
  const groups = groupThreads(await windowRows<Row>(tenantId, ids, COLUMNS)).map((g) => ({
    ...g,
    needs: needsReply(g.first, g.replies),
    anyHidden: g.first.hidden || g.replies.some((r) => r.hidden),
    last: lastVisible(g.first, g.replies).commented_at,
  }));
  const counts = { needs: groups.filter((g) => g.needs).length, hidden: opts.canSeeHidden ? groups.filter((g) => g.anyHidden).length : 0 };
  const picked = (opts.filter === "needs" ? groups.filter((g) => g.needs)
    : opts.filter === "hidden" ? (opts.canSeeHidden ? groups.filter((g) => g.anyHidden) : [])
    : groups.filter((g) => !g.first.hidden))
    .sort((a, b) => (Date.parse(b.last ?? "") || 0) - (Date.parse(a.last ?? "") || 0));
  const page = picked.slice(opts.cursor, opts.cursor + PAGE);
  const next = opts.cursor + PAGE < picked.length ? opts.cursor + PAGE : null;

  const postIds = [...new Set(page.map((g) => g.first.remote_post_id).filter((p): p is string => !!p))];
  /* A comment on an ad hangs under its ad post (marketing_ad_posts). */
  const adIds = [...new Set(page.map((g) => g.first.ad_post_id).filter((p): p is string => !!p))];
  const people = page.flatMap((g) => [g.first.handled_by, ...[g.first, ...g.replies].map((r) => r.replied_by)]).filter((x): x is string => !!x);
  const none = Promise.resolve({ data: [], error: null });
  const [{ data: posts, error: pErr }, { data: adPosts, error: aErr }, names] = await Promise.all([
    postIds.length
      ? supabaseServer.from("marketing_remote_posts").select("id, message, media, permalink, posted_at").eq("tenant_id", tenantId).in("id", postIds).limit(postIds.length)
      : none,
    adIds.length
      ? supabaseServer.from("marketing_ad_posts").select("id, message, media, permalink, posted_at").eq("tenant_id", tenantId).in("id", adIds).limit(adIds.length)
      : none,
    namesOf(people),
  ]);
  if (pErr) throw new Error(`marketing posts: ${pErr.message}`);
  if (aErr) throw new Error(`marketing ad posts: ${aErr.message}`);
  type PostRow = { id: string; message: string | null; media: Array<{ url: string }> | null; permalink: string | null; posted_at: string | null };
  const postById = new Map(((posts ?? []) as PostRow[]).map((p) => [p.id, p]));
  const adById = new Map(((adPosts ?? []) as PostRow[]).map((p) => [p.id, p]));
  const threads: CommentThread[] = [];
  for (const g of page) {
    const account = byId.get(g.first.account_id);
    if (!account) continue;
    const ad = g.first.ad_post_id ? adById.get(g.first.ad_post_id) : undefined;
    const p = ad ?? (g.first.remote_post_id ? postById.get(g.first.remote_post_id) : undefined);
    const text = p?.message?.trim() || null;
    threads.push({
      id: g.first.id,
      account,
      post: p ? { id: p.id, excerpt: text ? Array.from(text).slice(0, 120).join("") : null, permalink: p.permalink, thumb: Array.isArray(p.media) ? p.media[0]?.url ?? null : null, posted_at: p.posted_at, is_ad: !!ad } : null,
      first: view(g.first, names),
      replies: g.replies.filter((r) => opts.canSeeHidden || !r.hidden).map((r) => view(r, names)),
      last_at: g.last,
      needs_reply: g.needs,
      handled_at: g.first.handled_at,
      handled_by_name: g.first.handled_by ? names.get(g.first.handled_by) || null : null,
    });
  }
  return { threads, next, counts };
}

/** A comment and its account — what a route checks before acting. */
export async function loadComment(tenantId: string, id: string): Promise<(Row & { space: MarketingSpace }) | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await supabaseServer.from("marketing_comments").select(`${COLUMNS}, account:account_id ( space )`).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error) throw new Error(`marketing comments: ${error.message}`);
  if (!data || (data as { external_id: string }).external_id.startsWith(PENDING)) return null;
  const { account, ...row } = data as unknown as Row & { account: { space: MarketingSpace } | Array<{ space: MarketingSpace }> | null };
  const space = (Array.isArray(account) ? account[0]?.space : account?.space) ?? null;
  return space ? { ...row, space } : null;
}

/** The account's key, or why there is none to use. */
async function usableAccount(tenantId: string, accountId: string): Promise<Result<{ a: AccountForSync & { token: string } }>> {
  const a = await loadAccountForSync(tenantId, accountId);
  if (!a || a.connection !== "api" || !a.token || a.status === "disconnected") return { error: "This account is not connected any more.", status: 409, code: "account" };
  if (a.status === "expired") return pageAccessRemoved(a.last_error) ? REMOVED : EXPIRED;
  return { a: a as AccountForSync & { token: string } };
}

const EXPIRED = { error: "The account's key has expired. Reconnect it in Accounts.", status: 409, code: "expired" } as const;
/* A later Facebook sign-in left it out: Meta no longer shares it. */
const REMOVED = { error: "Meta no longer shares this account with the Hub: sign in with Facebook again in Accounts and keep it selected.", status: 409, code: "removed" } as const;

/** Meta refused: an expired key (or an account taken away) marks the
 *  account; the person reads why. */
async function refused(a: AccountForSync, e: unknown): Promise<{ error: string; status: number; code: string }> {
  if (e instanceof MetaError && e.code === 190) {
    await recordSync(a.id, { status: "expired", last_error: e.message.slice(0, 300), synced: false }).catch(() => {});
    return pageAccessRemoved(e.message) ? REMOVED : EXPIRED;
  }
  if (e instanceof MetaError) return { error: e.message, status: 502, code: "platform" };
  throw e;
}

/** Reply under a comment's thread, as the account. */
export async function replyToComment(tenantId: string, commentId: string, actorId: string, text: string): Promise<Result<{ comment: CommentView }>> {
  const words = text.trim();
  if (!words) return { error: "Write the reply first.", status: 400 };
  if (Array.from(words).length > REPLY_MAX) return { error: `A reply can have up to ${REPLY_MAX} characters.`, status: 400 };
  const target = await loadComment(tenantId, commentId);
  if (!target) return { error: "Comment not found.", status: 404 };
  if (target.hidden) return { error: "This comment is hidden. Show it again to reply.", status: 409, code: "hidden" };
  const usable = await usableAccount(tenantId, target.account_id);
  if (isError(usable)) return usable;
  const { a } = usable;
  /* One level on both platforms: the reply goes under the first comment; a
     reply to a reply names who it answers. */
  const thread = target.parent_external_id ?? target.external_id;
  const message = target.parent_external_id && !target.is_ours && target.author_name && !words.startsWith("@")
    ? `@${target.author_name} ${words}` : words;
  /* The same words to the same thread in the last two minutes — a retry
     after the first one went through — are that reply, not a new one. */
  const since = new Date(Date.now() - CLAIM_MS).toISOString();
  const { data: same, error: sErr0 } = await supabaseServer.from("marketing_comments").select("id")
    .eq("tenant_id", tenantId).eq("account_id", a.id).eq("parent_external_id", thread).eq("is_ours", true)
    .eq("message", message).gte("commented_at", since).limit(1);
  if (sErr0) throw new Error(`marketing comments: ${sErr0.message}`);
  if (same?.length) return { error: "This reply was just sent.", status: 409, code: "duplicate" };
  /* Two sends at the same instant: the placeholder's key is unique. */
  const key = `${PENDING}${crypto.createHash("sha256").update(`${thread}|${message}`).digest("hex").slice(0, 32)}:${Math.floor(Date.now() / CLAIM_MS)}`;
  const now = new Date().toISOString();
  const { data: claimed, error: cErr } = await supabaseServer.from("marketing_comments").insert({
    tenant_id: tenantId, account_id: a.id, remote_post_id: target.remote_post_id, ad_post_id: target.ad_post_id, external_id: key, parent_external_id: thread,
    message, commented_at: now, is_ours: true, hidden: false, replied_by: actorId, replied_at: now,
  }).select(COLUMNS).single();
  if (cErr) {
    if (cErr.code === "23505") return { error: "This reply was just sent.", status: 409, code: "duplicate" };
    throw new Error(`marketing comments: ${cErr.message}`);
  }
  const placeholder = claimed as unknown as Row;
  let externalId: string;
  try {
    externalId = await replyOnPlatform(a.platform, thread, a.token, message);
  } catch (e) {
    await supabaseServer.from("marketing_comments").delete().eq("id", placeholder.id);
    return refused(a, e);
  }
  /* The placeholder becomes the reply. A refresh that already brought the
     same comment in first keeps its row, which is marked as ours from here. */
  const { data: done, error: uErr } = await supabaseServer.from("marketing_comments").update({ external_id: externalId }).eq("id", placeholder.id).select(COLUMNS).single();
  let row: Row;
  if (uErr && uErr.code === "23505") {
    await supabaseServer.from("marketing_comments").delete().eq("id", placeholder.id);
    const { data: seen, error: sErr } = await supabaseServer.from("marketing_comments")
      .update({ is_ours: true, replied_by: actorId, replied_at: now }).eq("account_id", a.id).eq("external_id", externalId).select(COLUMNS).single();
    if (sErr) throw new Error(`marketing comments: ${sErr.message}`);
    row = seen as unknown as Row;
  } else if (uErr) {
    throw new Error(`marketing comments: ${uErr.message}`);
  } else {
    row = done as unknown as Row;
  }
  /* The thread was answered: its bell's notice is cleared — the team's wait
     is over, like a message conversation's. */
  const resetQ = supabaseServer.from("marketing_comments").update({ notified_at: null }).eq("account_id", a.id).not("notified_at", "is", null);
  const { data: reset } = target.parent_external_id
    ? await resetQ.eq("external_id", target.parent_external_id).select("id")
    : await resetQ.eq("id", target.id).select("id");
  const rootId = (reset ?? [])[0]?.id as string | undefined;
  if (rootId) later(() => settleComment(rootId));
  return { comment: view(row, await namesOf([actorId])) };
}

/** Hide a comment on its platform, or show it again (approvers — the route checks). */
export async function setCommentHidden(tenantId: string, commentId: string, hidden: boolean): Promise<Result> {
  const c = await loadComment(tenantId, commentId);
  if (!c) return { error: "Comment not found.", status: 404 };
  if (c.is_ours) return { error: "The account's own replies are not hidden.", status: 409, code: "ours" };
  if (c.hidden === hidden) return { ok: true };
  const usable = await usableAccount(tenantId, c.account_id);
  if (isError(usable)) return usable;
  try {
    await hideOnPlatform(usable.a.platform, c.external_id, usable.a.token, hidden);
  } catch (e) {
    return refused(usable.a, e);
  }
  /* Hiding the thread's first comment ends its wait: the bell's notice is
     cleared with it. */
  const { error } = await supabaseServer.from("marketing_comments")
    .update({ hidden, ...(hidden && !c.parent_external_id ? { notified_at: null } : {}) })
    .eq("tenant_id", tenantId).eq("id", c.id);
  if (error) throw new Error(`marketing comments: ${error.message}`);
  if (hidden && !c.parent_external_id) later(() => settleComment(c.id));
  return { ok: true };
}

/** «No reply needed» for a thread — or back on the list. Kept on the
 *  thread's first comment. */
export async function setThreadHandled(tenantId: string, commentId: string, handled: boolean, actorId: string): Promise<Result<{ handled_at: string | null; handled_by_name: string | null }>> {
  const c = await loadComment(tenantId, commentId);
  if (!c) return { error: "Comment not found.", status: 404 };
  const at = handled ? new Date().toISOString() : null;
  let q = supabaseServer.from("marketing_comments").update({ handled_at: at, handled_by: handled ? actorId : null, ...(handled ? { notified_at: null } : {}) }).eq("tenant_id", tenantId).eq("account_id", c.account_id);
  q = c.parent_external_id ? q.eq("external_id", c.parent_external_id) : q.eq("id", c.id);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`marketing comments: ${error.message}`);
  if (!data?.length) return { error: "Comment not found.", status: 404 };
  if (handled) later(() => settleComment((data as Array<{ id: string }>)[0].id));
  return { handled_at: at, handled_by_name: handled ? (await namesOf([actorId])).get(actorId) || null : null };
}

/** A thread for Koleex AI to answer: the post and the words so far. */
export async function threadContext(tenantId: string, c: Row): Promise<{ post: string | null; messages: Array<{ ours: boolean; text: string }> }> {
  const first = c.parent_external_id ?? c.external_id;
  /* Platform ids are digits and underscores; anything else is read alone
     rather than spliced into a filter. */
  const inThread = /^[\w.:-]+$/.test(first) ? `external_id.eq.${first},parent_external_id.eq.${first}` : `id.eq.${c.id}`;
  const [{ data: rows, error }, { data: post, error: pErr }] = await Promise.all([
    supabaseServer.from("marketing_comments").select("external_id, is_ours, hidden, message, commented_at")
      .eq("tenant_id", tenantId).eq("account_id", c.account_id).or(inThread)
      .order("commented_at", { ascending: true }).limit(40),
    c.ad_post_id
      ? supabaseServer.from("marketing_ad_posts").select("message").eq("tenant_id", tenantId).eq("id", c.ad_post_id).maybeSingle()
      : c.remote_post_id
        ? supabaseServer.from("marketing_remote_posts").select("message").eq("tenant_id", tenantId).eq("id", c.remote_post_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
  ]);
  if (error) throw new Error(`marketing comments: ${error.message}`);
  if (pErr) throw new Error(`marketing posts: ${pErr.message}`);
  const messages = ((rows ?? []) as Array<{ external_id: string; is_ours: boolean; hidden: boolean; message: string | null }>)
    .filter((r) => !r.hidden && !r.external_id.startsWith(PENDING) && r.message?.trim())
    .map((r) => ({ ours: r.is_ours, text: r.message!.trim() }));
  return { post: (post as { message: string | null } | null)?.message ?? null, messages };
}

/* ---------------------------------------------------------------------------
   marketing/comment-types — comments on the connected accounts' posts, as
   the screens see them, and the ONE rule for «Needs a reply» (the server's
   count and the screens agree because both use it).

   A thread is a first comment and the replies under it: Facebook and
   Instagram both nest one level. A thread NEEDS A REPLY when its newest
   visible message is someone else's — the customer spoke last — and nobody
   marked it «No reply needed» since that message (owner, 28/09/2026). A
   hidden first comment takes the whole thread off the list; a hidden reply
   simply does not count.
   --------------------------------------------------------------------------- */

import type { MarketingAccountView } from "@/lib/marketing/spaces";

/** Longest reply the Hub sends — plenty for an answer, far inside both
 *  platforms' limits. */
export const REPLY_MAX = 1000;

export interface CommentView {
  id: string;
  external_id: string;
  parent_external_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  message: string | null;
  commented_at: string | null;
  /** Written by the account itself — from the Hub or on the platform. */
  is_ours: boolean;
  hidden: boolean;
  /** Who wrote it from the Hub (our replies only). */
  replied_by_name: string | null;
}

export interface CommentThread {
  /** The first comment's id. */
  id: string;
  account: MarketingAccountView;
  /** is_ad: the comment is on an ad — a post that exists only as an ad
   *  (marketing_ad_posts), marked «Ad» on the screen. */
  post: { id: string; excerpt: string | null; permalink: string | null; thumb: string | null; posted_at: string | null; is_ad?: boolean } | null;
  first: CommentView;
  replies: CommentView[];
  last_at: string | null;
  needs_reply: boolean;
  handled_at: string | null;
  handled_by_name: string | null;
}

export type CommentFilter = "needs" | "all" | "hidden";
export const COMMENT_FILTERS: readonly CommentFilter[] = ["needs", "all", "hidden"];

/** What deciding needs of a comment row. */
export interface ThreadRow {
  account_id?: string;
  external_id: string;
  parent_external_id: string | null;
  is_ours: boolean;
  hidden: boolean;
  commented_at: string | null;
  handled_at?: string | null;
}

const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);

/** The newest visible message of a thread (the first comment when every
 *  reply is hidden). */
export function lastVisible<R extends ThreadRow>(first: R, replies: R[]): R {
  let last = first;
  for (const r of replies) if (!r.hidden && time(r.commented_at) >= time(last.commented_at)) last = r;
  return last;
}

/** «Needs a reply» — see the header. */
export function needsReply(first: ThreadRow, replies: ThreadRow[]): boolean {
  if (first.hidden) return false;
  const last = lastVisible(first, replies);
  if (last.is_ours) return false;
  return !first.handled_at || time(first.handled_at) < time(last.commented_at);
}

/** Rows into threads: a row whose parent is in the list (same account) is a
 *  reply to it; any other row starts a thread. Replies oldest first. */
export function groupThreads<R extends ThreadRow>(rows: R[]): Array<{ first: R; replies: R[] }> {
  const key = (account: string | undefined, id: string) => `${account ?? ""}|${id}`;
  const known = new Set(rows.map((r) => key(r.account_id, r.external_id)));
  const replies = new Map<string, R[]>();
  const firsts: R[] = [];
  for (const r of rows) {
    const parent = r.parent_external_id ? key(r.account_id, r.parent_external_id) : null;
    if (parent && known.has(parent)) replies.set(parent, [...(replies.get(parent) ?? []), r]);
    else firsts.push(r);
  }
  return firsts.map((first) => ({
    first,
    replies: (replies.get(key(first.account_id, first.external_id)) ?? []).sort((a, b) => time(a.commented_at) - time(b.commented_at)),
  }));
}

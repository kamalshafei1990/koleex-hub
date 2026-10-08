/* ---------------------------------------------------------------------------
   marketing/feed-types — what the Feed screen receives, shared by the server
   (lib/server/marketing/feed) and the screen. Never an access key.
   --------------------------------------------------------------------------- */

import type { MarketingAccountView } from "@/lib/marketing/spaces";
import type { CommentView } from "@/lib/marketing/comment-types";

export interface FeedMedia { kind: "image" | "video"; url: string }

export interface FeedPost {
  id: string;
  account_id: string;
  /** The beginning of the text; the whole text comes with the post itself. */
  excerpt: string | null;
  truncated: boolean;
  thumb: FeedMedia | null;
  media_count: number;
  permalink: string | null;
  posted_at: string;
  /** As the platform names them: reactions/likes, comments, shares, views,
   *  reach, saved… Only the numbers the platform gave. */
  metrics: Record<string, number>;
}

/** The account's last 7 days, from its daily snapshots. A null is a number
 *  the Hub does not have yet (a change needs a snapshot from a week ago). */
export interface FeedWeek {
  audience_change: number | null;
  posts: number | null;
  engagement: number | null;
  engagement_change: number | null;
}

export interface FeedColumn {
  account: MarketingAccountView;
  /** Refreshed long enough ago that the screen should ask for a refresh. */
  stale: boolean;
  week: FeedWeek | null;
  posts: FeedPost[];
  /** Where the next page of older posts starts; null at the end. */
  next: string | null;
}

export interface FeedResponse {
  columns: FeedColumn[];
  /** Accounts of the space shared by hand (no posts to read). */
  manual: number;
  /** Accounts the Hub only publishes to (LinkedIn: nothing comes back). */
  publishOnly: number;
}

/** A comment in a post's panel: the comment view, and — on a thread's first
 *  comment — when it was marked «No reply needed». */
export interface FeedComment extends CommentView {
  handled_at: string | null;
}

export interface PostDetail {
  post: FeedPost & { message: string | null; media: FeedMedia[] };
  comments: FeedComment[];
  /** What the caller may do with the comments (set by the route). */
  canReply: boolean;
  canHide: boolean;
}

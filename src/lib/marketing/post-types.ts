/* ---------------------------------------------------------------------------
   marketing/post-types — posts written in the Hub (the composer), as the
   server and the screens share them. Never an access key.
   --------------------------------------------------------------------------- */

import type { ContentCheck, ContentState } from "@/lib/marketing/ceo-rules";
import type { CaptureRecord } from "@/lib/marketing/capture";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

/* draft → in_review → approved → publishing → published / partly_published /
   failed; rejected goes back to its author. ('scheduled' and 'archived' are
   in the table for the calendar step.) */
export type PostStatus =
  | "draft" | "in_review" | "approved" | "scheduled" | "publishing"
  | "published" | "partly_published" | "failed" | "rejected" | "archived";

/* A post on one account: 'shared' = an account with no posting API, shared by
   a person after approval. */
export type TargetStatus = "pending" | "publishing" | "published" | "failed" | "skipped" | "shared";

/** A picture or video uploaded for a post, in the public `media` bucket
 *  under marketing/<tenant>/ (Meta fetches it from there to publish). */
export interface PostMedia {
  kind: "image" | "video";
  url: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  /** Seconds, for a video. */
  duration: number | null;
}

export interface PostTargetInput {
  account_id: string;
  /** This account's own text; null = the post's text. */
  body_override: string | null;
}

export interface PostInput {
  body: string;
  media: PostMedia[];
  targets: PostTargetInput[];
  /** When to publish once approved (an instant, ISO); null = as soon as it
   *  is approved. Shown and picked in Shanghai time. */
  scheduled_at: string | null;
}

export interface PostTargetView {
  id: string;
  account: MarketingAccountView;
  body_override: string | null;
  status: TargetStatus;
  permalink: string | null;
  /** "rule:<code>" for a platform rule (the screen translates it), else the
   *  platform's own message. */
  error: string | null;
  published_at: string | null;
}

export interface PostView {
  id: string;
  space: MarketingSpace;
  status: PostStatus;
  body: string;
  media: PostMedia[];
  created_by: string;
  author: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decider: string | null;
  decided_at: string | null;
  decision_note: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  targets: PostTargetView[];
  /** CEO Brand: the JD's content check (lib/marketing/ceo-rules); null elsewhere or before it. */
  content_check: ContentCheck | null;
  content_state: ContentState;
  /** CEO Brand quick capture: what was said, and where the recording is (lib/marketing/capture). */
  capture: CaptureRecord | null;
}

export interface PostSummary {
  id: string;
  status: PostStatus;
  excerpt: string | null;
  thumb: { kind: "image" | "video"; url: string } | null;
  media_count: number;
  accounts: Array<{ id: string; platform: MarketingAccountView["platform"]; name: string }>;
  author: string | null;
  updated_at: string;
  scheduled_at: string | null;
  published_at: string | null;
  /** Accounts it failed on. */
  failed: number;
  /** Hand-shared accounts still waiting to be shared after approval. */
  to_share: number;
}

export type PostFilter = "all" | "drafts" | "review" | "scheduled" | "published" | "problems";

export interface PostsResponse {
  posts: PostSummary[];
  next: string | null;
  counts: { drafts: number; review: number; scheduled: number; problems: number };
  canApprove: boolean;
}

/** One post on the calendar: written in the Hub, or published on an account
 *  outside the Hub (from the Feed). `at` is when it goes (or went) out. */
export interface CalendarItem {
  kind: "hub" | "remote";
  id: string;
  at: string;
  status: PostStatus | "outside";
  excerpt: string | null;
  thumb: { kind: "image" | "video"; url: string } | null;
  accounts: Array<{ id: string; platform: MarketingAccountView["platform"]; name: string }>;
  permalink: string | null;
}

export interface PostDetailResponse {
  post: PostView;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/** What the composer needs before anything is written: the accounts it can
 *  post to and where its uploads go. */
export interface ComposerSetup {
  accounts: MarketingAccountView[];
  uploadPrefix: string;
  canApprove: boolean;
  ai: boolean;
}

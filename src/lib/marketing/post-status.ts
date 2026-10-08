/* How a post's status and an account's result read on screen (the KDS
   StatusPill tones), shared by the Posts tab and the composer. */

import type { PostStatus, TargetStatus } from "@/lib/marketing/post-types";

export type Tone = "neutral" | "brand" | "success" | "warning" | "error";

export const POST_TONE: Record<PostStatus, Tone> = {
  draft: "neutral",
  in_review: "brand",
  approved: "brand",
  scheduled: "brand",
  publishing: "brand",
  published: "success",
  partly_published: "warning",
  failed: "error",
  rejected: "warning",
  archived: "neutral",
};

export const TARGET_TONE: Record<TargetStatus, Tone> = {
  pending: "neutral",
  publishing: "brand",
  published: "success",
  failed: "error",
  skipped: "neutral",
  shared: "success",
};

/* ---------------------------------------------------------------------------
   marketing/post-rules — what each platform accepts, checked the SAME way by
   the composer (as you type) and by the server (before anything is sent).
   From Meta's publishing docs (Graph API v26.0, 27/09/2026):
   · Instagram: a post needs a picture or a video; captions up to 2,200
     characters and 30 hashtags; pictures must be JPEG with a shape between
     4:5 (portrait) and 1.91:1 (landscape); an album holds up to 10 items;
     videos publish as Reels, 3 seconds to 15 minutes.
   · Facebook: text, up to 10 photos, or ONE video on its own (a video
     cannot share a post with photos through the API).
   · LinkedIn (the CEO's profile, lib/marketing/linkedin): words up to 3,000
     characters, or words with up to 9 pictures; no video from the Hub yet.
   Hand-shared accounts (WeChat, WhatsApp, Douyin) only need something to
   share. An account whose key expired cannot be published to.
   --------------------------------------------------------------------------- */

import type { MarketingAccountView } from "@/lib/marketing/spaces";
import { LI_IMAGES_MAX, LI_TEXT_MAX } from "@/lib/marketing/linkedin";
import type { PostMedia } from "@/lib/marketing/post-types";

export const MAX_MEDIA = 10;
export const MAX_TARGETS = 20;
export const IG_CAPTION_MAX = 2200;
export const IG_HASHTAGS_MAX = 30;
export const FB_TEXT_MAX = 63206;
export const IG_RATIO_MIN = 4 / 5;
export const IG_RATIO_MAX = 1.91;
export const IG_VIDEO_MIN_S = 3;
export const IG_VIDEO_MAX_S = 15 * 60;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024;
export const IMAGE_MIMES = ["image/jpeg"] as const;
export const VIDEO_MIMES = ["video/mp4", "video/quicktime"] as const;
export const DECISION_NOTE_MAX = 500;

export type IssueCode =
  | "empty" | "too_many_media" | "account_expired"
  | "fb_video_alone" | "fb_text_long"
  | "ig_needs_media" | "ig_caption_long" | "ig_hashtags" | "ig_jpeg" | "ig_ratio" | "ig_video_length"
  | "li_text_long" | "li_video" | "li_too_many_images";

export interface Issue {
  code: IssueCode;
  /** The picture or video it is about (0-based). */
  mediaIndex?: number;
}

/** Characters as a person counts them (an emoji is one). */
export const charCount = (text: string): number => Array.from(text).length;

export function hashtagCount(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** Why this post cannot go to this account as it is; [] = it can. */
export function targetIssues(
  account: Pick<MarketingAccountView, "platform" | "connection" | "status">,
  text: string,
  media: PostMedia[],
): Issue[] {
  const out: Issue[] = [];
  const hasText = text.trim().length > 0;
  if (account.connection === "assisted") {
    if (!hasText && media.length === 0) out.push({ code: "empty" });
    return out;
  }
  if (account.status === "expired" || account.status === "revoked") out.push({ code: "account_expired" });
  if (media.length > MAX_MEDIA) out.push({ code: "too_many_media" });

  if (account.platform === "facebook") {
    if (!hasText && media.length === 0) out.push({ code: "empty" });
    if (media.some((m) => m.kind === "video") && media.length > 1) out.push({ code: "fb_video_alone" });
    if (charCount(text) > FB_TEXT_MAX) out.push({ code: "fb_text_long" });
  }

  if (account.platform === "linkedin") {
    if (!hasText && media.length === 0) out.push({ code: "empty" });
    if (charCount(text) > LI_TEXT_MAX) out.push({ code: "li_text_long" });
    if (media.some((m) => m.kind === "video")) out.push({ code: "li_video" });
    if (media.filter((m) => m.kind === "image").length > LI_IMAGES_MAX) out.push({ code: "li_too_many_images" });
  }

  if (account.platform === "instagram") {
    if (media.length === 0) out.push({ code: "ig_needs_media" });
    if (charCount(text) > IG_CAPTION_MAX) out.push({ code: "ig_caption_long" });
    if (hashtagCount(text) > IG_HASHTAGS_MAX) out.push({ code: "ig_hashtags" });
    media.forEach((m, i) => {
      if (m.kind === "image") {
        if (!(IMAGE_MIMES as readonly string[]).includes(m.mime)) out.push({ code: "ig_jpeg", mediaIndex: i });
        if (m.width && m.height) {
          const r = m.width / m.height;
          if (r < IG_RATIO_MIN - 0.005 || r > IG_RATIO_MAX + 0.005) out.push({ code: "ig_ratio", mediaIndex: i });
        }
      } else if (m.duration != null && (m.duration < IG_VIDEO_MIN_S || m.duration > IG_VIDEO_MAX_S)) {
        out.push({ code: "ig_video_length", mediaIndex: i });
      }
    });
  }
  return out;
}

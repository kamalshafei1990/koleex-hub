import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-comments — the two things the Hub does to a comment on
   Facebook or Instagram: reply to it, and hide (or show again) it.

   Both platforms nest ONE level, so a reply always goes under the thread's
   first comment (the caller passes that id). Facebook: POST
   /{comment}/comments, hide with is_hidden. Instagram: POST
   /{comment}/replies, hide with hide. The page's own key, never a person's;
   Meta's own explanation comes back as a MetaError.
   --------------------------------------------------------------------------- */

import { MetaError, metaGraphUrl, metaPost } from "@/lib/server/marketing/meta";
import type { MarketingPlatform } from "@/lib/marketing/spaces";

/** Reply under a thread's first comment; the new comment's id on the platform. */
export async function replyOnPlatform(platform: MarketingPlatform, threadExternalId: string, token: string, message: string): Promise<string> {
  const path = platform === "facebook" ? `${threadExternalId}/comments` : platform === "instagram" ? `${threadExternalId}/replies` : null;
  if (!path) throw new MetaError("Replying on this platform is not available yet.", null);
  const body = await metaPost<{ id?: string }>(metaGraphUrl(path), token, { message });
  if (!body.id) throw new MetaError("The platform did not confirm the reply.", null);
  return body.id;
}

/** Hide a comment from everyone but its writer and the page — or show it again. */
export async function hideOnPlatform(platform: MarketingPlatform, externalId: string, token: string, hidden: boolean): Promise<void> {
  const field = platform === "facebook" ? "is_hidden" : platform === "instagram" ? "hide" : null;
  if (!field) throw new MetaError("Hiding comments on this platform is not available yet.", null);
  await metaPost(metaGraphUrl(externalId), token, { [field]: String(hidden) });
}

import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-ads — finding the posts that exist ONLY as ads, whose
   comments the Feed's reads never see (owner, 29/09/2026).

   · Facebook: the Page's ad posts, /{page}/ads_posts with
     include_inline_create (the posts made inside Ads Manager — "dark"
     posts, never on the Page's timeline), read with the Page key, of any
     age (an old post boosted today). Each comes with its comment count
     (replies included, like the Feed's scan).
   · Instagram: an ad's Instagram media is known only to its ad account:
     /me/adaccounts, then each account's ads and their creative's
     effective_instagram_media_id — read with the connecting person's key.
     The media themselves (caption, picture, comment count) are then read
     with the Page key, and a media that is not this account's is left out.

   Every call sends its key in the Authorization header (metaGet). Graph API
   v26.0 names, checked 29/09/2026.
   --------------------------------------------------------------------------- */

import { MetaError, metaGet, metaGraphUrl } from "@/lib/server/marketing/meta";
import { facebookMedia, instagramMediaList, type FbPost, type IgMedia, type RemoteMedia } from "@/lib/server/marketing/meta-feed";

export interface AdPost {
  external_id: string;
  message: string | null;
  media: RemoteMedia[];
  permalink: string | null;
  posted_at: string | null;
  /** Meta's comment count now. */
  comments: number;
}

type Paging = { paging?: { cursors?: { after?: string }; next?: string } };
const nextCursor = (b: Paging): string | null => (b.paging?.next ? b.paging.cursors?.after ?? null : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Pages of ads read per scan: a few hundred ads at most. */
const PAGES_MAX = 10;
/** Media read per call (Meta's limit for ?ids=). */
const IDS_PER_CALL = 50;

/** A Page's ad posts, with their comment counts. No age limit: an old post
 *  boosted today gets its comments from the ad now. */
export async function facebookAdPosts(pageId: string, token: string): Promise<AdPost[]> {
  const out: AdPost[] = [];
  let after: string | null = null;
  for (let page = 0; page < PAGES_MAX; page++) {
    const params: Record<string, string> = {
      fields: "id,message,created_time,permalink_url,full_picture,attachments{media_type,media,subattachments{media_type,media}},comments.filter(stream).limit(0).summary(true)",
      include_inline_create: "true",
      limit: "50",
    };
    if (after) params.after = after;
    const b = await metaGet<{ data?: FbPost[] } & Paging>(metaGraphUrl(`${pageId}/ads_posts`, params), token);
    for (const p of b.data ?? []) {
      out.push({
        external_id: p.id,
        message: p.message ?? null,
        media: facebookMedia(p),
        permalink: p.permalink_url ?? null,
        posted_at: p.created_time ?? null,
        comments: num(p.comments?.summary?.total_count) ?? 0,
      });
    }
    after = nextCursor(b);
    if (!after) break;
  }
  return out;
}

/** The ad accounts the connecting person can read ("act_…") — only the ones
 *  granted in the Facebook sign-in's asset step. */
export async function adAccounts(userToken: string): Promise<string[]> {
  const b = await metaGet<{ data?: Array<{ id?: string }> }>(metaGraphUrl("me/adaccounts", { fields: "id", limit: "50" }), userToken);
  return (b.data ?? []).map((a) => a.id).filter((id): id is string => typeof id === "string" && /^act_\d+$/.test(id));
}

/** Every ad status but deleted — ARCHIVED too: Meta leaves archived ads out
 *  unless they are asked for by name, and an ad that ended still has
 *  comments to answer (owner, 29/09/2026). */
const AD_STATUSES = JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO"]);

/** The Instagram media of an ad account's ads made since `since`. */
export async function instagramAdMediaIds(adAccountId: string, userToken: string, since: string): Promise<string[]> {
  const ids = new Set<string>();
  const from = Date.parse(since);
  let after: string | null = null;
  for (let page = 0; page < PAGES_MAX; page++) {
    const params: Record<string, string> = { fields: "id,created_time,creative{effective_instagram_media_id}", effective_status: AD_STATUSES, limit: "100" };
    if (after) params.after = after;
    const b = await metaGet<{ data?: Array<{ created_time?: string; creative?: { effective_instagram_media_id?: string } }> } & Paging>(
      metaGraphUrl(`${adAccountId}/ads`, params), userToken,
    );
    for (const ad of b.data ?? []) {
      if (ad.created_time && Date.parse(ad.created_time) < from) continue;
      const m = ad.creative?.effective_instagram_media_id;
      if (m && /^\d+$/.test(m)) ids.add(m);
    }
    after = nextCursor(b);
    if (!after) break;
  }
  return [...ids];
}

type IgAdMedia = IgMedia & { owner?: { id?: string } };
const IG_AD_FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,owner,children{media_type,media_url,thumbnail_url}";

const toAdPost = (m: IgAdMedia): AdPost => ({
  external_id: m.id,
  message: m.caption ?? null,
  media: instagramMediaList(m),
  permalink: m.permalink ?? null,
  posted_at: m.timestamp ?? null,
  comments: num(m.comments_count) ?? 0,
});

/** The ad media themselves, read with the Page key, only this Instagram
 *  account's. A batch Meta refuses (one media it will not show) is read one
 *  by one, and a media refused alone is left out. */
export async function instagramAdMedia(igId: string, token: string, mediaIds: readonly string[]): Promise<AdPost[]> {
  const out: AdPost[] = [];
  const mine = (m: IgAdMedia | undefined) => !!m && m.owner?.id === igId;
  for (let i = 0; i < mediaIds.length; i += IDS_PER_CALL) {
    const chunk = mediaIds.slice(i, i + IDS_PER_CALL);
    try {
      const b = await metaGet<Record<string, IgAdMedia>>(metaGraphUrl("", { ids: chunk.join(","), fields: IG_AD_FIELDS }), token);
      for (const m of Object.values(b)) if (mine(m)) out.push(toAdPost(m));
    } catch (e) {
      if (!(e instanceof MetaError) || e.code === 190 || e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) throw e;
      for (const id of chunk) {
        try {
          const m = await metaGet<IgAdMedia>(metaGraphUrl(id, { fields: IG_AD_FIELDS }), token);
          if (mine(m)) out.push(toAdPost(m));
        } catch (one) {
          if (!(one instanceof MetaError) || one.code === 190) throw one;
        }
      }
    }
  }
  return out;
}

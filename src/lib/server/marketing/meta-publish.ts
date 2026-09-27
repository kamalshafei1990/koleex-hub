import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-publish — publishing one post to a Facebook Page or an
   Instagram business account (Graph API v26.0). Meta fetches the pictures and
   videos itself from their public links in our `media` bucket.

   Facebook: text → /{page}/feed; one photo → /{page}/photos; several photos →
   each uploaded unpublished, then ONE /{page}/feed post that attaches them;
   one video → /{page}/videos.
   Instagram: a container is prepared (/{ig}/media — a picture, a Reel, or an
   album of prepared items), and published (/{ig}/media_publish) once Meta
   reports it FINISHED. A video can take longer than one call, so a step may
   come back "not done" with where it stopped; the caller keeps that
   (post_targets.publish_state) and continues later from there.
   Every call carries the Page token in the Authorization header (metaPost).
   --------------------------------------------------------------------------- */

import { MetaError, metaGet, metaGraphUrl, metaPost } from "@/lib/server/marketing/meta";
import type { PostMedia } from "@/lib/marketing/post-types";

export type PublishStep =
  | {
      done: true;
      externalId: string;
      /** The id the Feed knows the post by (null when it differs, e.g. a
       *  Facebook video: the sync finds that one itself). */
      feedId: string | null;
      permalink: string | null;
    }
  | { done: false; state: Record<string, unknown>; retryInMs: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function facebookPermalink(postId: string, token: string): Promise<string | null> {
  try {
    const b = await metaGet<{ permalink_url?: string }>(metaGraphUrl(postId, { fields: "permalink_url" }), token);
    return b.permalink_url ?? null;
  } catch {
    return null;
  }
}

export async function publishToFacebook(pageId: string, token: string, text: string, media: PostMedia[]): Promise<PublishStep> {
  const video = media.find((m) => m.kind === "video");
  if (video) {
    const r = await metaPost<{ id: string }>(metaGraphUrl(`${pageId}/videos`), token, { file_url: video.url, description: text });
    return { done: true, externalId: r.id, feedId: null, permalink: `https://www.facebook.com/${pageId}/videos/${r.id}` };
  }
  const photos = media.filter((m) => m.kind === "image");
  if (photos.length === 0) {
    const r = await metaPost<{ id: string }>(metaGraphUrl(`${pageId}/feed`), token, { message: text });
    return { done: true, externalId: r.id, feedId: r.id, permalink: await facebookPermalink(r.id, token) };
  }
  if (photos.length === 1) {
    const r = await metaPost<{ id: string; post_id?: string }>(metaGraphUrl(`${pageId}/photos`), token, { url: photos[0].url, message: text });
    const postId = r.post_id ?? `${pageId}_${r.id}`;
    return { done: true, externalId: postId, feedId: postId, permalink: await facebookPermalink(postId, token) };
  }
  /* An album: the photos go up unpublished (invisible until attached), then
     one post attaches them all. A failure half-way leaves only unattached
     photos, which nobody sees; a retry starts the album again. */
  const ids: string[] = [];
  for (const p of photos) {
    const r = await metaPost<{ id: string }>(metaGraphUrl(`${pageId}/photos`), token, { url: p.url, published: "false" });
    ids.push(r.id);
  }
  const params: Record<string, string> = { message: text };
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const r = await metaPost<{ id: string }>(metaGraphUrl(`${pageId}/feed`), token, params);
  return { done: true, externalId: r.id, feedId: r.id, permalink: await facebookPermalink(r.id, token) };
}

type ContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED" | string;

async function containerStatus(id: string, token: string): Promise<{ code: ContainerStatus; detail: string | null }> {
  const b = await metaGet<{ status_code?: string; status?: string }>(metaGraphUrl(id, { fields: "status_code,status" }), token);
  return { code: b.status_code ?? "IN_PROGRESS", detail: b.status ?? null };
}

function failedToPrepare(code: string, detail: string | null): MetaError {
  return new MetaError(`Instagram could not prepare the media (${code}${detail ? `: ${detail}` : ""}).`, null);
}

/**
 * Publish to Instagram, or continue a publish started earlier (`state`).
 * Waits for Meta inside `deadline` (epoch ms); past it, returns "not done"
 * with the state to continue from.
 */
export async function publishToInstagram(
  igId: string,
  token: string,
  caption: string,
  media: PostMedia[],
  state: Record<string, unknown>,
  deadline: number,
): Promise<PublishStep> {
  let container = typeof state.container_id === "string" ? state.container_id : null;
  let children = Array.isArray(state.children) ? (state.children as unknown[]).filter((c): c is string => typeof c === "string") : null;

  if (!container) {
    if (media.length === 1) {
      const m = media[0];
      const params: Record<string, string> = m.kind === "video"
        ? { media_type: "REELS", video_url: m.url, caption, share_to_feed: "true" }
        : { image_url: m.url, caption };
      container = (await metaPost<{ id: string }>(metaGraphUrl(`${igId}/media`), token, params)).id;
    } else {
      if (!children || children.length !== media.length) {
        children = [];
        for (const m of media) {
          const params: Record<string, string> = m.kind === "video"
            ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" }
            : { image_url: m.url, is_carousel_item: "true" };
          children.push((await metaPost<{ id: string }>(metaGraphUrl(`${igId}/media`), token, params)).id);
        }
      }
      /* Every item of an album must be ready before the album can be made. */
      for (;;) {
        const statuses = await Promise.all(children.map((c) => containerStatus(c, token)));
        const bad = statuses.find((s) => s.code === "ERROR" || s.code === "EXPIRED");
        if (bad) throw failedToPrepare(bad.code, bad.detail);
        if (statuses.every((s) => s.code === "FINISHED")) break;
        if (Date.now() + 3_000 > deadline) return { done: false, state: { children }, retryInMs: 5_000 };
        await sleep(3_000);
      }
      container = (await metaPost<{ id: string }>(metaGraphUrl(`${igId}/media`), token, {
        media_type: "CAROUSEL", children: children.join(","), caption,
      })).id;
    }
  }

  for (;;) {
    const s = await containerStatus(container, token);
    if (s.code === "FINISHED") break;
    if (s.code === "PUBLISHED") {
      /* Published by an earlier attempt that stopped before it could record
         the result: never publish twice. The sync imports the post. */
      return { done: true, externalId: `container:${container}`, feedId: null, permalink: null };
    }
    if (s.code === "ERROR" || s.code === "EXPIRED") throw failedToPrepare(s.code, s.detail);
    if (Date.now() + 3_000 > deadline) return { done: false, state: { container_id: container, ...(children ? { children } : {}) }, retryInMs: 5_000 };
    await sleep(3_000);
  }

  const published = await metaPost<{ id: string }>(metaGraphUrl(`${igId}/media_publish`), token, { creation_id: container });
  let permalink: string | null = null;
  try {
    permalink = (await metaGet<{ permalink?: string }>(metaGraphUrl(published.id, { fields: "permalink" }), token)).permalink ?? null;
  } catch { /* the post is out; the link can wait for the sync */ }
  return { done: true, externalId: published.id, feedId: published.id, permalink };
}

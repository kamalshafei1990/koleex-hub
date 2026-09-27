import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-feed — reading a connected Facebook Page or Instagram
   business account for the Feed: its audience, its posts (newest first, then
   the history page by page), each post's numbers and its comments.

   The numbers, as Meta names them in Graph API v26.0 (checked 27/09/2026):
   · Facebook: reactions, comments and shares come from the post itself —
     fields that have not changed in years. Views: Meta retired
     "impressions" on 15/11/2025 and replaced it with "views"; the post-level
     names below are tried, and when Meta refuses one the post keeps its other
     numbers and a single line is logged — never a failed sync.
   · Instagram: likes and comments from the media; views, reach, saved,
     shares and total_interactions from its insights ("impressions" is gone
     for media created after 02/07/2024).
   Every call sends the Page token in the Authorization header (metaGet).
   --------------------------------------------------------------------------- */

import { MetaError, metaGet, metaGraphUrl } from "@/lib/server/marketing/meta";

export interface RemoteMedia { kind: "image" | "video"; url: string }
export interface RemotePost {
  external_id: string;
  message: string | null;
  media: RemoteMedia[];
  permalink: string | null;
  posted_at: string | null;
  metrics: Record<string, number>;
}
export interface RemoteComment {
  external_id: string;
  parent_external_id: string | null;
  author_name: string | null;
  author_external_id: string | null;
  author_avatar_url: string | null;
  message: string | null;
  commented_at: string | null;
  is_ours: boolean;
}
export interface PostPage { posts: RemotePost[]; after: string | null }

type Paging = { paging?: { cursors?: { after?: string }; next?: string } };
const nextCursor = (b: Paging): string | null => (b.paging?.next ? b.paging.cursors?.after ?? null : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* A metric Meta no longer knows, or does not have for this post, comes back
   as error #100; that must not fail the sync. */
const isUnsupportedMetric = (e: unknown) => e instanceof MetaError && e.code === 100;
let loggedFacebookViews = false;

/* ── Facebook Pages ─────────────────────────────────────────────────────── */

export async function facebookAudience(pageId: string, token: string): Promise<number | null> {
  const b = await metaGet<{ followers_count?: number; fan_count?: number }>(metaGraphUrl(pageId, { fields: "followers_count,fan_count" }), token);
  return num(b.followers_count) ?? num(b.fan_count);
}

type FbAttachment = { media_type?: string; media?: { image?: { src?: string }; source?: string }; subattachments?: { data?: FbAttachment[] } };
type FbPost = {
  id: string; message?: string; created_time?: string; permalink_url?: string; full_picture?: string;
  attachments?: { data?: FbAttachment[] };
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

function facebookMedia(p: FbPost): RemoteMedia[] {
  const out: RemoteMedia[] = [];
  const walk = (a: FbAttachment) => {
    const src = a.media?.image?.src;
    if (src) out.push({ kind: a.media_type === "video" ? "video" : "image", url: src });
    for (const s of a.subattachments?.data ?? []) walk(s);
  };
  for (const a of p.attachments?.data ?? []) walk(a);
  if (out.length === 0 && p.full_picture) out.push({ kind: "image", url: p.full_picture });
  return out.slice(0, 10);
}

export async function facebookPosts(pageId: string, token: string, after?: string | null): Promise<PostPage> {
  const params: Record<string, string> = {
    fields: "id,message,created_time,permalink_url,full_picture,attachments{media_type,media,subattachments{media_type,media}},shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
    limit: "25",
  };
  if (after) params.after = after;
  const b = await metaGet<{ data?: FbPost[] } & Paging>(metaGraphUrl(`${pageId}/published_posts`, params), token);
  const posts = (b.data ?? []).map((p): RemotePost => ({
    external_id: p.id,
    message: p.message ?? null,
    media: facebookMedia(p),
    permalink: p.permalink_url ?? null,
    posted_at: p.created_time ?? null,
    metrics: Object.fromEntries(Object.entries({
      reactions: num(p.reactions?.summary?.total_count),
      comments: num(p.comments?.summary?.total_count),
      shares: num(p.shares?.count) ?? 0,
    }).filter(([, v]) => v !== null)) as Record<string, number>,
  }));
  return { posts, after: nextCursor(b) };
}

/** A post's pictures, read again: Meta's picture links expire after some
 *  days, so a picture that stops loading is fetched afresh. */
export async function facebookPostMedia(postId: string, token: string): Promise<RemoteMedia[]> {
  const p = await metaGet<FbPost>(metaGraphUrl(postId, { fields: "id,full_picture,attachments{media_type,media,subattachments{media_type,media}}" }), token);
  return facebookMedia(p);
}

/** A post's views. Meta's post-level "views" names after the 15/11/2025
 *  change; null when Meta refuses them (logged once per server). */
export async function facebookPostViews(postId: string, token: string): Promise<Record<string, number> | null> {
  try {
    const b = await metaGet<{ data?: Array<{ name: string; values?: Array<{ value?: unknown }> }> }>(
      metaGraphUrl(`${postId}/insights`, { metric: "post_media_view,post_total_media_view_unique" }), token);
    const out: Record<string, number> = {};
    for (const m of b.data ?? []) {
      const v = num(m.values?.[0]?.value);
      if (v === null) continue;
      if (m.name === "post_media_view") out.views = v;
      if (m.name === "post_total_media_view_unique") out.reach = v;
    }
    return out;
  } catch (e) {
    if (!isUnsupportedMetric(e)) throw e;
    if (!loggedFacebookViews) {
      loggedFacebookViews = true;
      console.warn(`[marketing/meta-feed] Facebook post views unavailable: ${(e as Error).message}`);
    }
    return null;
  }
}

type FbComment = { id: string; message?: string; created_time?: string; from?: { id?: string; name?: string; picture?: { data?: { url?: string } } }; parent?: { id?: string } };

export async function facebookComments(pageId: string, postId: string, token: string): Promise<RemoteComment[]> {
  const b = await metaGet<{ data?: FbComment[] }>(metaGraphUrl(`${postId}/comments`, {
    fields: "id,message,created_time,from{id,name,picture},parent{id}",
    filter: "stream",
    order: "reverse_chronological",
    limit: "50",
  }), token);
  return (b.data ?? []).map((c) => ({
    external_id: c.id,
    parent_external_id: c.parent?.id ?? null,
    author_name: c.from?.name ?? null,
    author_external_id: c.from?.id ?? null,
    author_avatar_url: c.from?.picture?.data?.url ?? null,
    message: c.message ?? null,
    commented_at: c.created_time ?? null,
    is_ours: !!c.from?.id && c.from.id === pageId,
  }));
}

/* ── Instagram business accounts ────────────────────────────────────────── */

export async function instagramAudience(igId: string, token: string): Promise<number | null> {
  const b = await metaGet<{ followers_count?: number }>(metaGraphUrl(igId, { fields: "followers_count" }), token);
  return num(b.followers_count);
}

type IgMedia = {
  id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string;
  like_count?: number; comments_count?: number;
  children?: { data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }> };
};

function instagramMediaList(m: IgMedia): RemoteMedia[] {
  const one = (t?: string, url?: string, thumb?: string): RemoteMedia | null => {
    const src = t === "VIDEO" ? thumb ?? url : url;
    return src ? { kind: t === "VIDEO" ? "video" : "image", url: src } : null;
  };
  const kids = (m.children?.data ?? []).map((c) => one(c.media_type, c.media_url, c.thumbnail_url)).filter((x): x is RemoteMedia => !!x);
  if (kids.length) return kids.slice(0, 10);
  const self = one(m.media_type, m.media_url, m.thumbnail_url);
  return self ? [self] : [];
}

export async function instagramMedia(igId: string, token: string, after?: string | null): Promise<PostPage> {
  const params: Record<string, string> = {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_type,media_url,thumbnail_url}",
    limit: "25",
  };
  if (after) params.after = after;
  const b = await metaGet<{ data?: IgMedia[] } & Paging>(metaGraphUrl(`${igId}/media`, params), token);
  const posts = (b.data ?? []).map((m): RemotePost => ({
    external_id: m.id,
    message: m.caption ?? null,
    media: instagramMediaList(m),
    permalink: m.permalink ?? null,
    posted_at: m.timestamp ?? null,
    metrics: Object.fromEntries(Object.entries({ likes: num(m.like_count), comments: num(m.comments_count) }).filter(([, v]) => v !== null)) as Record<string, number>,
  }));
  return { posts, after: nextCursor(b) };
}

/** A media's pictures, read again (the links expire after some days). */
export async function instagramMediaItem(mediaId: string, token: string): Promise<RemoteMedia[]> {
  const m = await metaGet<IgMedia>(metaGraphUrl(mediaId, { fields: "id,media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}" }), token);
  return instagramMediaList(m);
}

/** A media's insights. Falls back to the metrics every media type has when
 *  Meta refuses the full set for this one; null if it refuses those too. */
export async function instagramInsights(mediaId: string, token: string): Promise<Record<string, number> | null> {
  const read = async (metric: string) => {
    const b = await metaGet<{ data?: Array<{ name: string; values?: Array<{ value?: unknown }> }> }>(metaGraphUrl(`${mediaId}/insights`, { metric }), token);
    const out: Record<string, number> = {};
    for (const m of b.data ?? []) {
      const v = num(m.values?.[0]?.value);
      if (v !== null) out[m.name] = v;
    }
    return out;
  };
  try {
    return await read("views,reach,saved,shares,total_interactions");
  } catch (e) {
    if (!isUnsupportedMetric(e)) throw e;
    try {
      return await read("reach,saved,total_interactions");
    } catch (e2) {
      if (!isUnsupportedMetric(e2)) throw e2;
      return null;
    }
  }
}

type IgComment = { id: string; text?: string; timestamp?: string; username?: string; from?: { id?: string; username?: string }; replies?: { data?: IgComment[] } };

export async function instagramComments(mediaId: string, handle: string | null, token: string): Promise<RemoteComment[]> {
  const b = await metaGet<{ data?: IgComment[] }>(metaGraphUrl(`${mediaId}/comments`, {
    fields: "id,text,timestamp,username,from{id,username},replies{id,text,timestamp,username,from{id,username}}",
    limit: "50",
  }), token);
  const out: RemoteComment[] = [];
  const push = (c: IgComment, parent: string | null) => {
    const user = c.from?.username ?? c.username ?? null;
    out.push({
      external_id: c.id,
      parent_external_id: parent,
      author_name: user,
      author_external_id: c.from?.id ?? null,
      author_avatar_url: null,
      message: c.text ?? null,
      commented_at: c.timestamp ?? null,
      is_ours: !!handle && !!user && user.toLowerCase() === handle.toLowerCase(),
    });
  };
  for (const c of b.data ?? []) {
    push(c, null);
    for (const r of c.replies?.data ?? []) push(r, c.id);
  }
  return out;
}

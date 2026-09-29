import "server-only";

/* ---------------------------------------------------------------------------
   marketing/linkedin (server) — the calls of Share on LinkedIn (the rules and
   the checked endpoints are in lib/marketing/linkedin). Two env vars, from
   the LinkedIn app (Auth tab): LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET.
   The redirect URL is the Hub's origin + /api/marketing/connect/linkedin/callback.
   The key travels in the Authorization header, never in a URL. A 401 is
   reported as code 190, like an expired Meta key, so the same handling
   marks the account expired. A published post gets its link on the post's
   account but no Feed row: LinkedIn sends back nothing to show there.
   --------------------------------------------------------------------------- */

import { MARKETING_ORIGIN, META_STATE_COOKIE_OPTIONS, MetaError } from "@/lib/server/marketing/meta";
import { LINKEDIN_SCOPES } from "@/lib/marketing/linkedin";
import type { PostMedia } from "@/lib/marketing/post-types";
import type { PublishStep } from "@/lib/server/marketing/meta-publish";

export interface LinkedInConfig { clientId: string; clientSecret: string }

export function linkedinConfig(): LinkedInConfig | null {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Must match an Authorized redirect URL of the LinkedIn app exactly. */
export const LINKEDIN_REDIRECT_URI = `${MARKETING_ORIGIN}/api/marketing/connect/linkedin/callback`;
export const LINKEDIN_STATE_COOKIE = "kx_li_oauth";
export const LINKEDIN_STATE_COOKIE_OPTIONS = { ...META_STATE_COOKIE_OPTIONS, path: "/api/marketing/connect/linkedin" };

/** LinkedIn's sign-in the connect button opens. */
export function linkedinLoginUrl(cfg: LinkedInConfig, state: string): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return url.toString();
}

type LiError = { error?: string; error_description?: string; message?: string; serviceErrorCode?: number };

async function liBody<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & LiError;
  if (!res.ok) {
    throw new MetaError(body.error_description || body.message || body.error || `LinkedIn answered HTTP ${res.status}`, res.status === 401 ? 190 : res.status);
  }
  return body;
}

const until = (expiresIn: unknown): string | null =>
  typeof expiresIn === "number" && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

/** The sign-in's code → the member's key (60 days) and the permissions granted. */
export async function exchangeLinkedInCode(cfg: LinkedInConfig, code: string): Promise<{ token: string; expiresAt: string | null; scopes: string[] }> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: LINKEDIN_REDIRECT_URI }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const b = await liBody<{ access_token?: string; expires_in?: number; scope?: string }>(res);
  if (!b.access_token) throw new MetaError("LinkedIn returned no key for the sign-in code.", null);
  return { token: b.access_token, expiresAt: until(b.expires_in), scopes: (b.scope ?? "").split(/[\s,]+/).filter(Boolean) };
}

export interface LinkedInProfile { id: string; name: string | null; picture: string | null }

/** The signed-in member (OpenID Connect userinfo; "sub" is the person id). */
export async function linkedinProfile(token: string): Promise<LinkedInProfile> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const b = await liBody<{ sub?: string; name?: string; picture?: string }>(res);
  if (!b.sub) throw new MetaError("LinkedIn did not say which member signed in.", null);
  return { id: b.sub, name: b.name ?? null, picture: b.picture ?? null };
}

const jsonHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" });

/** A picture registered with LinkedIn and uploaded; its asset URN. */
async function uploadPicture(author: string, token: string, url: string): Promise<string> {
  const reg = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: author,
      serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
    } }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  type Reg = { value?: { asset?: string; uploadMechanism?: Record<string, { uploadUrl?: string }> } };
  const v = (await liBody<Reg>(reg)).value;
  const uploadUrl = v?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  if (!v?.asset || !uploadUrl) throw new MetaError("LinkedIn did not give a place to upload the picture.", null);
  const pic = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!pic.ok) throw new MetaError("The picture could not be read to send it to LinkedIn.", null);
  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": pic.headers.get("content-type") ?? "application/octet-stream" },
    body: await pic.arrayBuffer(),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!up.ok) await liBody(up);
  return v.asset;
}

/** Publish on the member's profile — words, or words with pictures. */
export async function publishToLinkedIn(personId: string, token: string, text: string, media: PostMedia[]): Promise<PublishStep> {
  const author = `urn:li:person:${personId}`;
  const assets: string[] = [];
  for (const m of media) {
    if (m.kind !== "image") throw new MetaError("Videos to LinkedIn from the Hub come later.", null);
    assets.push(await uploadPicture(author, token, m.url));
  }
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: assets.length ? "IMAGE" : "NONE",
        ...(assets.length ? { media: assets.map((asset) => ({ status: "READY", media: asset })) } : {}),
      } },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await liBody(res);
  const urn = res.headers.get("x-restli-id") ?? ((await res.json().catch(() => ({}))) as { id?: string }).id ?? null;
  if (!urn) throw new MetaError("LinkedIn did not confirm the post.", null);
  /* No Feed row (feedId null): LinkedIn sends back no numbers or comments,
     and every Feed reader would ask Meta about it. The link stays on the
     post's account. */
  return { done: true, externalId: urn, feedId: null, permalink: `https://www.linkedin.com/feed/update/${urn}/` };
}

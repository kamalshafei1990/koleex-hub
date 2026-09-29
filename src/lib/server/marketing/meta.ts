import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta — connecting Facebook Pages and their Instagram business
   accounts through Facebook Login for Business (a Business-type Meta app).

   Verified on developers.facebook.com, 27/09/2026:
   · A Business app has no Development/Live mode. Standard Access covers an
     app that serves only accounts we own or manage, so there is no App
     Review and no Business Verification. The Page and the Instagram account
     must belong to the same Business Portfolio as the app.
   · The login dialog takes a Configuration ID (config_id) in place of
     `scope`; the permissions live in that configuration.
   · The flow: the code becomes a short-lived user token, which becomes a
     long-lived one. /me/accounts then returns each Page with a Page token
     that does not expire. Instagram calls use the linked Page's token.
   · Graph API v26.0 (released 29/07/2026) is the latest.

   Four env vars, and the flow is refused until all four exist:
     META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID  (the Meta app)
     MARKETING_TOKEN_KEY                                 (lib/server/marketing/token-crypto)
   Tokens are never logged: errors carry Meta's message and code, not the
   request.
   --------------------------------------------------------------------------- */

export const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION ?? "").trim() || "v26.0";

/** Must match "Valid OAuth Redirect URIs" in the Meta app exactly (the
 *  setup checklist gives the owner this same URL). */
/** The Hub's public origin the platforms send the sign-ins back to. */
export const MARKETING_ORIGIN = (process.env.META_REDIRECT_ORIGIN ?? "").trim() || "https://hub.koleexgroup.com";
export const META_REDIRECT_URI = `${MARKETING_ORIGIN}/api/marketing/connect/meta/callback`;

/** The login's anti-forgery state rides in this cookie — httpOnly, ten
 *  minutes, only sent to the connect routes — and must come back unchanged
 *  with Meta's redirect. SameSite=Lax still sends it on that top-level
 *  navigation back from facebook.com. */
export const META_STATE_COOKIE = "kx_meta_oauth";
export const META_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/marketing/connect/meta",
  maxAge: 600,
};

/** Business Login for Instagram (the CEO's own Instagram): the Meta app's
 *  Instagram product keys — INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. */
export interface InstagramLoginConfig { appId: string; appSecret: string }
export function instagramLoginConfig(): InstagramLoginConfig | null {
  const appId = (process.env.INSTAGRAM_APP_ID ?? "").trim();
  const appSecret = (process.env.INSTAGRAM_APP_SECRET ?? "").trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

/* Instagram Login keys are served by graph.instagram.com, not
   graph.facebook.com. The accounts loader marks each one here — in memory
   only, never logged — and every Graph call made with a marked key goes to
   Instagram's host: the Feed, publishing, comments, insights and messages
   keep one set of paths, and no call can send such a key to the wrong host. */
const instagramLoginKeys = new Set<string>();
export function markInstagramLoginKey(token: string): void {
  if (instagramLoginKeys.size > 500) instagramLoginKeys.clear();
  instagramLoginKeys.add(token);
}
function routed(url: URL | string, token?: string): URL | string {
  if (!token || !instagramLoginKeys.has(token)) return url;
  const u = new URL(String(url));
  if (u.hostname === "graph.facebook.com") u.hostname = "graph.instagram.com";
  return u;
}

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  configId: string;
}

export function metaAppConfig(): MetaAppConfig | null {
  const appId = (process.env.META_APP_ID ?? "").trim();
  const appSecret = (process.env.META_APP_SECRET ?? "").trim();
  const configId = (process.env.META_LOGIN_CONFIG_ID ?? "").trim();
  return appId && appSecret && configId ? { appId, appSecret, configId } : null;
}

/** The Facebook Login for Business dialog the connect button opens. */
export function metaLoginUrl(cfg: MetaAppConfig, state: string): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", META_REDIRECT_URI);
  url.searchParams.set("config_id", cfg.configId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export class MetaError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
    this.name = "MetaError";
  }
}

type GraphError = { error?: { message?: string; code?: number; error_user_msg?: string } };

/* Meta's own explanation for a person ("The aspect ratio is not supported")
   when it gives one, else its technical message. */
const graphMessage = (e: GraphError["error"], status: number): string =>
  e?.error_user_msg || e?.message || `Meta answered HTTP ${status}`;

/** One Graph API read. The token goes in the Authorization header, never
 *  in the URL. Shared with lib/server/marketing/meta-feed. */
export async function metaGet<T>(url: URL | string, token?: string): Promise<T> {
  const res = await fetch(routed(url, token), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || body.error) throw new MetaError(graphMessage(body.error, res.status), body.error?.code ?? null);
  return body;
}

/** One Graph API write (publishing): form-encoded, the token in the
 *  Authorization header — never in the URL or the body. */
export async function metaPost<T>(url: URL | string, token: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(routed(url, token), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || body.error) throw new MetaError(graphMessage(body.error, res.status), body.error?.code ?? null);
  return body;
}

export const metaGraphUrl = (path: string, params: Record<string, string> = {}): URL => {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
};

/** The login's code → a short-lived user token. */
export async function exchangeCode(cfg: MetaAppConfig, code: string): Promise<string> {
  const body = await metaGet<{ access_token?: string }>(metaGraphUrl("oauth/access_token", {
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: META_REDIRECT_URI,
    code,
  }));
  if (!body.access_token) throw new MetaError("Meta returned no access token for the login code.", null);
  return body.access_token;
}

/** A short-lived user token → a long-lived one, so the Page tokens read with
 *  it do not expire. expiresAt: the long-lived one's own end (about 60
 *  days; null when Meta does not say). */
export async function longLivedUserToken(cfg: MetaAppConfig, shortToken: string): Promise<{ token: string; expiresAt: string | null }> {
  const body = await metaGet<{ access_token?: string; expires_in?: number }>(metaGraphUrl("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortToken,
  }));
  if (!body.access_token) throw new MetaError("Meta returned no long-lived token.", null);
  const secs = typeof body.expires_in === "number" && Number.isFinite(body.expires_in) && body.expires_in > 0 ? body.expires_in : null;
  return { token: body.access_token, expiresAt: secs ? new Date(Date.now() + secs * 1000).toISOString() : null };
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  link?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
}

/** Every Page the person chose in the login dialog, with its Page token and
 *  its linked Instagram business account. Follows paging (at most 500). */
export async function managedPages(userToken: string): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  let next: string | null = metaGraphUrl("me/accounts", {
    fields: "id,name,access_token,link,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
    limit: "100",
  }).toString();
  for (let i = 0; next && i < 5; i++) {
    const body: { data?: MetaPage[]; paging?: { next?: string } } = await metaGet(next, userToken);
    pages.push(...(body.data ?? []).filter((p) => p.id && p.access_token));
    next = body.paging?.next ?? null;
  }
  return pages;
}

/** The permissions the person actually granted. */
export async function grantedScopes(userToken: string): Promise<string[]> {
  const body = await metaGet<{ data?: Array<{ permission: string; status: string }> }>(metaGraphUrl("me/permissions"), userToken);
  return (body.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

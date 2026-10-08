import "server-only";

/* ---------------------------------------------------------------------------
   marketing/instagram-login (server) — the calls of Business Login for
   Instagram (lib/marketing/instagram-login has the rules and the checked
   endpoints), and the refresh of its 60-day keys (cron).

   Two env vars, from the Meta app's Instagram product ("API setup with
   Instagram business login"): INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. The
   redirect URI is the Hub's origin + /api/marketing/connect/instagram/callback.

   The keys travel in the Authorization header on every data call. Only the
   two OAuth exchanges Meta documents as GET with the key in the query (the
   long-lived exchange and the refresh) carry it there — server to server,
   never logged.
   --------------------------------------------------------------------------- */

import { MARKETING_ORIGIN, META_GRAPH_VERSION, META_STATE_COOKIE_OPTIONS, MetaError, markInstagramLoginKey, metaGet, type InstagramLoginConfig } from "@/lib/server/marketing/meta";
import { loadAccountForSync, recordSync, storeRefreshedKey } from "@/lib/server/marketing/accounts";
import { supabaseServer } from "@/lib/server/supabase-server";
import { INSTAGRAM_LOGIN_SCOPES, isInstagramLogin, type InstagramLoginProfile } from "@/lib/marketing/instagram-login";

export { instagramLoginConfig } from "@/lib/server/marketing/meta";

/** Must match the Business login's redirect URL in the Meta app exactly. */
export const INSTAGRAM_REDIRECT_URI = `${MARKETING_ORIGIN}/api/marketing/connect/instagram/callback`;
export const INSTAGRAM_STATE_COOKIE = "kx_ig_oauth";
export const INSTAGRAM_STATE_COOKIE_OPTIONS = { ...META_STATE_COOKIE_OPTIONS, path: "/api/marketing/connect/instagram" };

/** The Instagram sign-in the connect button opens (no Facebook sign-in in it). */
export function instagramLoginUrl(cfg: InstagramLoginConfig, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", INSTAGRAM_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_LOGIN_SCOPES.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  return url.toString();
}

type IgOAuthError = { error_message?: string; error_type?: string; code?: number; error?: { message?: string; code?: number } };

/* Instagram account ids pass 2^53: sent as a JSON NUMBER, JSON.parse rounds
   them (17841400000000001 → 17841400000000000). Read an id from the raw
   answer, as its digits. */
const rawId = (raw: string, field: string): string | null =>
  new RegExp(`"${field}"\\s*:\\s*"?(\\d+)"?`).exec(raw)?.[1] ?? null;
const parse = <T,>(raw: string): T => { try { return JSON.parse(raw) as T; } catch { return {} as T; } };
const oauthError = (b: IgOAuthError, status: number) =>
  new MetaError(b.error_message || b.error?.message || `Instagram answered HTTP ${status}`, b.code ?? b.error?.code ?? null);

/** The sign-in's code → a short-lived key, the account's id, the permissions granted. */
export async function exchangeInstagramCode(cfg: InstagramLoginConfig, code: string): Promise<{ token: string; userId: string; scopes: string[] }> {
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, grant_type: "authorization_code", redirect_uri: INSTAGRAM_REDIRECT_URI, code }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  type One = { access_token?: string; permissions?: string | string[] };
  const raw = await res.text().catch(() => "");
  const body = parse<One & { data?: One[] } & IgOAuthError>(raw);
  if (!res.ok) throw oauthError(body, res.status);
  const one: One = Array.isArray(body.data) && body.data.length ? body.data[0] : body;
  const userId = rawId(raw, "user_id");
  if (!one.access_token || !userId) throw new MetaError("Instagram returned no key for the sign-in code.", null);
  const scopes = Array.isArray(one.permissions) ? one.permissions : (one.permissions ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { token: one.access_token, userId, scopes };
}

const until = (expiresIn: unknown): string | null =>
  typeof expiresIn === "number" && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

/** A short-lived key → a long-lived one (60 days). */
export async function longLivedInstagramToken(cfg: InstagramLoginConfig, short: string): Promise<{ token: string; expiresAt: string | null }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("access_token", short);
  const body = await metaGet<{ access_token?: string; expires_in?: number }>(url);
  if (!body.access_token) throw new MetaError("Instagram returned no long-lived key.", null);
  return { token: body.access_token, expiresAt: until(body.expires_in) };
}

/** A long-lived key (at least a day old, not expired) → a fresh 60-day one. */
export async function refreshInstagramToken(token: string): Promise<{ token: string; expiresAt: string | null }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const body = await metaGet<{ access_token?: string; expires_in?: number }>(url);
  if (!body.access_token) throw new MetaError("Instagram returned no refreshed key.", null);
  return { token: body.access_token, expiresAt: until(body.expires_in) };
}

/** The signed-in account itself (its key in the header). */
export async function instagramLoginProfile(token: string): Promise<InstagramLoginProfile> {
  const url = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "user_id,username,name,profile_picture_url,followers_count,account_type");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const raw = await res.text().catch(() => "");
  const b = parse<{ username?: string; name?: string; profile_picture_url?: string; followers_count?: number; account_type?: string } & IgOAuthError>(raw);
  if (!res.ok || b.error) throw oauthError(b, res.status);
  const id = rawId(raw, "user_id");
  if (!id) throw new MetaError("Instagram did not say which account signed in.", null);
  return {
    id,
    username: b.username ?? null,
    name: b.name ?? null,
    picture: b.profile_picture_url ?? null,
    followers: typeof b.followers_count === "number" ? b.followers_count : null,
    accountType: b.account_type ?? null,
  };
}

/** Refresh the Instagram Login keys that end within 20 days (each at least a
 *  day old — Meta refuses a younger one). A key Meta no longer accepts marks
 *  the account expired: the Accounts tab asks to connect again. */
export const IG_REFRESH_BEFORE_MS = 20 * 86_400_000;
const IG_KEY_LIFE_MS = 60 * 86_400_000;
const IG_KEY_MIN_AGE_MS = 86_400_000;
export async function refreshInstagramLoginKeys(opts: { tenantId?: string; max?: number } = {}): Promise<number> {
  const soon = new Date(Date.now() + IG_REFRESH_BEFORE_MS).toISOString();
  let q = supabaseServer.from("marketing_accounts").select("id, tenant_id, token_expires_at")
    .eq("connection", "api").eq("platform", "instagram").in("status", ["connected", "error"])
    .not("token_expires_at", "is", null).lt("token_expires_at", soon);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data, error } = await q.order("token_expires_at", { ascending: true }).limit(opts.max ?? 5);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  let refreshed = 0;
  for (const r of (data ?? []) as Array<{ id: string; tenant_id: string; token_expires_at: string }>) {
    if (Date.parse(r.token_expires_at) - IG_KEY_LIFE_MS + IG_KEY_MIN_AGE_MS > Date.now()) continue;
    const a = await loadAccountForSync(r.tenant_id, r.id);
    if (!a?.token || !isInstagramLogin(a.scopes)) continue;
    try {
      const fresh = await refreshInstagramToken(a.token);
      markInstagramLoginKey(fresh.token);
      await storeRefreshedKey(a.id, fresh.token, fresh.expiresAt);
      refreshed++;
    } catch (e) {
      if (e instanceof MetaError && e.code === 190) {
        await recordSync(a.id, { status: "expired", last_error: e.message.slice(0, 300), synced: false }).catch(() => {});
        continue;
      }
      console.warn(`[marketing/instagram-login] refresh ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return refreshed;
}

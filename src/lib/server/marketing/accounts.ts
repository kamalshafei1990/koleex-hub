import "server-only";

/* ---------------------------------------------------------------------------
   marketing/accounts — the connected accounts of a space (Social Marketing =
   'company', CEO Brand = 'ceo').

   The one rule this file keeps: token_encrypted is written here and read by
   the publishing code, and never selected for a screen. The list below names
   its columns and leaves the key out; validate:marketing pins that.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { decryptToken, encryptToken, isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { metaAppConfig, type MetaPage } from "@/lib/server/marketing/meta";
import { MANUAL_PLATFORMS, type MarketingAccountView, type MarketingPlatform, type MarketingSetup, type MarketingSpace } from "@/lib/marketing/spaces";
import { FACEBOOK_ADS_SCOPES, instagramAdsGranted, type AdsState } from "@/lib/marketing/ads";
import { messageScopesFor } from "@/lib/marketing/message-types";

const VIEW_COLUMNS = "id, space, platform, connection, external_id, name, handle, avatar_url, profile_url, status, last_error, last_synced_at, audience, updated_at";

export async function listAccounts(tenantId: string, space: MarketingSpace): Promise<MarketingAccountView[]> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select(VIEW_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("space", space)
    /* A removed account keeps its row (and its posts' history) but leaves
       the list; adding it again brings it back. */
    .neq("status", "disconnected")
    .order("platform", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  return (data ?? []) as MarketingAccountView[];
}

/** An account as the Feed sees it: the screen's columns plus when its last
 *  sync STARTED (kept in sync_state), so the Feed can tell which accounts
 *  to refresh. Never the access key, never the paging cursor. */
export type FeedAccount = MarketingAccountView & { last_attempt_at: string | null };

type FeedAccountRow = MarketingAccountView & { sync_state: Record<string, unknown> | null };
const FEED_ACCOUNT_COLUMNS = `${VIEW_COLUMNS}, sync_state`;

function toFeedAccount({ sync_state, ...view }: FeedAccountRow): FeedAccount {
  const at = sync_state?.last_attempt_at;
  return { ...view, last_attempt_at: typeof at === "string" ? at : null };
}

/** The Feed's accounts — the ones read by API (an account shared by hand has
 *  no posts to read) — and how many of the space's accounts are shared by
 *  hand. */
export async function listFeedAccounts(tenantId: string, space: MarketingSpace): Promise<{ accounts: FeedAccount[]; manual: number }> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select(FEED_ACCOUNT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("space", space)
    .neq("status", "disconnected")
    .order("platform", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  const rows = (data ?? []) as unknown as FeedAccountRow[];
  const accounts = rows.filter((r) => r.connection === "api").map(toFeedAccount);
  return { accounts, manual: rows.length - accounts.length };
}

/** One Feed account; null when it is not this tenant's, is shared by hand,
 *  or was removed. */
export async function feedAccount(tenantId: string, id: string): Promise<FeedAccount | null> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select(FEED_ACCOUNT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  const row = data as unknown as FeedAccountRow | null;
  if (!row || row.connection !== "api" || row.status === "disconnected") return null;
  return toFeedAccount(row);
}

/** Every account of a space, removed ones included — a post keeps showing
 *  the accounts it went to after one is removed. Never the key. */
export async function allSpaceAccounts(tenantId: string, space: MarketingSpace): Promise<MarketingAccountView[]> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select(VIEW_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("space", space)
    .limit(200);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  return (data ?? []) as MarketingAccountView[];
}

/** Which server settings are in place, as booleans — what the connect card
 *  needs to explain itself. Never the values. */
export function marketingSetup(): MarketingSetup {
  return {
    tokenKey: isTokenCryptoConfigured(),
    meta: metaAppConfig() !== null,
    cron: !!(process.env.CRON_SECRET ?? "").trim(),
  };
}

/** Save the Pages (and their Instagram business accounts) a person chose in
 *  the Facebook login. An account already connected is refreshed in place —
 *  its new key replaces the old one — so reconnecting never duplicates it.
 *  Returns the saved accounts' ids, so their first sync can start. */
export async function saveMetaAccounts(input: {
  tenantId: string;
  space: MarketingSpace;
  connectedBy: string;
  pages: MetaPage[];
  scopes: string[];
  /** The connecting person's long-lived key — passed only when the ads
   *  permissions were granted (Instagram's ads are found with it); a
   *  reconnect without them removes the one kept before. */
  userToken?: { token: string; expiresAt: string | null } | null;
}): Promise<string[]> {
  const now = new Date().toISOString();
  const userKey = input.userToken ? encryptToken(input.userToken.token) : null;
  type Row = Record<string, unknown> & { platform: "facebook" | "instagram"; external_id: string };
  const rows: Row[] = [];
  for (const page of input.pages) {
    const token = encryptToken(page.access_token);
    const common = {
      tenant_id: input.tenantId,
      space: input.space,
      connection: "api",
      token_encrypted: token,
      token_expires_at: null,
      user_token_encrypted: userKey,
      user_token_expires_at: userKey ? input.userToken?.expiresAt ?? null : null,
      scopes: input.scopes,
      status: "connected",
      last_error: null,
      connected_by: input.connectedBy,
      updated_at: now,
    };
    rows.push({
      ...common,
      platform: "facebook",
      external_id: page.id,
      name: page.name,
      handle: null,
      avatar_url: page.picture?.data?.url ?? null,
      profile_url: page.link ?? `https://www.facebook.com/${page.id}`,
    });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      rows.push({
        ...common,
        platform: "instagram",
        external_id: ig.id,
        name: ig.name || ig.username || page.name,
        handle: ig.username ?? null,
        avatar_url: ig.profile_picture_url ?? null,
        profile_url: ig.username ? `https://www.instagram.com/${ig.username}` : null,
      });
    }
  }
  if (rows.length === 0) return [];

  const { data: existing, error: readErr } = await inChunks<{ id: string; platform: string; external_id: string }>(
    rows.map((r) => r.external_id),
    (chunk) => supabaseServer
      .from("marketing_accounts")
      .select("id, platform, external_id")
      .eq("tenant_id", input.tenantId)
      .in("platform", ["facebook", "instagram"])
      .in("external_id", chunk),
  );
  if (readErr) throw new Error(`marketing accounts: ${readErr.message}`);
  const idOf = new Map((existing ?? []).map((e) => [`${e.platform}|${e.external_id}`, e.id]));

  const fresh = rows.filter((r) => !idOf.has(`${r.platform}|${r.external_id}`));
  const ids: string[] = [];
  for (const r of rows) {
    const id = idOf.get(`${r.platform}|${r.external_id}`);
    if (!id) continue;
    const { error } = await supabaseServer.from("marketing_accounts").update(r).eq("id", id);
    if (error) throw new Error(`marketing accounts: ${error.message}`);
    ids.push(id);
  }
  if (fresh.length) {
    const { data, error } = await supabaseServer.from("marketing_accounts").insert(fresh).select("id");
    if (error) throw new Error(`marketing accounts: ${error.message}`);
    ids.push(...((data ?? []) as Array<{ id: string }>).map((d) => d.id));
  }
  return ids;
}

/** What the sync needs about an account, with its access key DECRYPTED.
 *  For the server's sync and publishing code only; never returned by a
 *  route. token is null for accounts shared by hand or removed. */
export interface AccountForSync {
  id: string;
  tenant_id: string;
  space: MarketingSpace;
  platform: MarketingPlatform;
  connection: "api" | "assisted";
  external_id: string | null;
  handle: string | null;
  status: MarketingAccountView["status"];
  last_synced_at: string | null;
  sync_state: Record<string, unknown>;
  /** The row's version: a sync claims the account only if it is unchanged. */
  updated_at: string;
  token: string | null;
  /** The permissions Meta granted at connect. */
  scopes: string[];
  /** The connecting person's key (Instagram ads), DECRYPTED; null when not
   *  kept. Never a route's answer. */
  userToken: string | null;
  user_token_expires_at: string | null;
}

export async function loadAccountForSync(tenantId: string, id: string): Promise<AccountForSync | null> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select("id, tenant_id, space, platform, connection, external_id, handle, status, last_synced_at, sync_state, updated_at, scopes, token_encrypted, user_token_encrypted, user_token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data) return null;
  const { token_encrypted, user_token_encrypted, ...rest } = data as Omit<AccountForSync, "token" | "userToken"> & { token_encrypted: string | null; user_token_encrypted: string | null };
  return {
    ...rest,
    sync_state: rest.sync_state ?? {},
    scopes: rest.scopes ?? [],
    token: token_encrypted ? decryptToken(token_encrypted) : null,
    userToken: user_token_encrypted ? decryptToken(user_token_encrypted) : null,
  };
}

/** Mark a sync as started — unless another one started since this account
 *  was read (updated_at is the row's version, so two Feeds opening at once
 *  run ONE sync). true = this caller runs it. */
export async function claimSync(a: AccountForSync): Promise<boolean> {
  const now = new Date().toISOString();
  const state = { ...a.sync_state, last_attempt_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** Mark a refresh of the recent posts' comments as started — unless one
 *  started less than `minGapMs` ago, or anything else changed the account
 *  since it was read (the same version check as claimSync). true = this
 *  caller runs it. A Feed sync finishing later may write its older
 *  sync_state over comments_at: the next refresh then only comes sooner. */
export async function claimComments(a: AccountForSync, minGapMs: number): Promise<boolean> {
  const last = typeof a.sync_state.comments_at === "string" ? Date.parse(a.sync_state.comments_at) || 0 : 0;
  if (last && Date.now() - last < minGapMs) return false;
  const now = new Date().toISOString();
  const state = { ...a.sync_state, comments_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** Mark an Insights refresh as started — the same rules as claimComments,
 *  on sync_state.insights_at. true = this caller runs it. */
export async function claimInsights(a: AccountForSync, minGapMs: number): Promise<boolean> {
  const last = typeof a.sync_state.insights_at === "string" ? Date.parse(a.sync_state.insights_at) || 0 : 0;
  if (last && Date.now() - last < minGapMs) return false;
  const now = new Date().toISOString();
  const state = { ...a.sync_state, insights_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** Write fields into an account's sync_state — version-checked; if something
 *  changed the account meanwhile (a Feed sync opened by a screen), the fields
 *  are merged onto its FRESH sync_state and written again (twice at most),
 *  never over the other writer's. false when it still could not land (the
 *  next run comes sooner). */
export async function recordSyncState(a: AccountForSync, fields: Record<string, unknown>): Promise<boolean> {
  let state0 = a.sync_state, version = a.updated_at;
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const state = { ...state0, ...fields };
    const { data, error } = await supabaseServer
      .from("marketing_accounts")
      .update({ sync_state: state, updated_at: now })
      .eq("id", a.id)
      .eq("updated_at", version)
      .select("id");
    if (error) throw new Error(`marketing accounts: ${error.message}`);
    if (data && data.length) { a.sync_state = state; a.updated_at = now; return true; }
    const { data: fresh, error: fErr } = await supabaseServer.from("marketing_accounts").select("sync_state, updated_at").eq("id", a.id).maybeSingle();
    if (fErr) throw new Error(`marketing accounts: ${fErr.message}`);
    if (!fresh) return false;
    state0 = (fresh as { sync_state: Record<string, unknown> | null }).sync_state ?? {};
    version = (fresh as { updated_at: string }).updated_at;
  }
  return false;
}

/** After an Insights refresh: whether every wanted day is in (then the next
 *  refresh waits hours, not minutes), and what it read for the account (the
 *  audience). */
export async function recordInsights(a: AccountForSync, complete: boolean, extra: Record<string, unknown> = {}): Promise<boolean> {
  return recordSyncState(a, { ...extra, insights_full: complete });
}

/** Mark a scan of the older posts' comment counts as started — the same rules
 *  as claimComments, on sync_state.comments_scan_at. true = this caller runs it. */
export async function claimCommentScan(a: AccountForSync, minGapMs: number): Promise<boolean> {
  const last = typeof a.sync_state.comments_scan_at === "string" ? Date.parse(a.sync_state.comments_scan_at) || 0 : 0;
  if (last && Date.now() - last < minGapMs) return false;
  const now = new Date().toISOString();
  const state = { ...a.sync_state, comments_scan_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** The ads scan's claim (sync_state.ads_scan_at), like claimCommentScan:
 *  one run at a time per account, at most every minGapMs. */
export async function claimAdScan(a: AccountForSync, minGapMs: number): Promise<boolean> {
  const last = typeof a.sync_state.ads_scan_at === "string" ? Date.parse(a.sync_state.ads_scan_at) || 0 : 0;
  if (last && Date.now() - last < minGapMs) return false;
  const now = new Date().toISOString();
  const state = { ...a.sync_state, ads_scan_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** The messages read's claim (sync_state.messages_at), like the others:
 *  one run at a time per account, at most every minGapMs. */
export async function claimMessages(a: AccountForSync, minGapMs: number): Promise<boolean> {
  const last = typeof a.sync_state.messages_at === "string" ? Date.parse(a.sync_state.messages_at) || 0 : 0;
  if (last && Date.now() - last < minGapMs) return false;
  const now = new Date().toISOString();
  const state = { ...a.sync_state, messages_at: now };
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .update({ sync_state: state, updated_at: now })
    .eq("id", a.id)
    .eq("updated_at", a.updated_at)
    .select("id");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  if (!data || data.length === 0) return false;
  a.sync_state = state;
  a.updated_at = now;
  return true;
}

/** What the Accounts screen says about each Page's and Instagram account's
 *  ads — derived here, so no key or key date leaves the server as a column. */
export async function adsStates(tenantId: string, space: MarketingSpace): Promise<Record<string, AdsState>> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select("id, platform, scopes, sync_state, user_token_expires_at, user_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("space", space)
    .eq("connection", "api")
    .in("platform", ["facebook", "instagram"])
    .neq("status", "disconnected");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  const out: Record<string, AdsState> = {};
  for (const r of (data ?? []) as Array<{ id: string; platform: string; scopes: string[] | null; sync_state: Record<string, unknown> | null; user_token_expires_at: string | null; user_token_encrypted: string | null }>) {
    const scopes = r.scopes ?? [];
    const err = typeof r.sync_state?.ads_error === "string" ? r.sync_state.ads_error : null;
    if (r.platform === "facebook") {
      const missing = FACEBOOK_ADS_SCOPES.filter((x) => !scopes.includes(x));
      out[r.id] = { ready: missing.length === 0, missing, findUntil: null, error: err };
    } else {
      const granted = instagramAdsGranted(scopes);
      const until = r.user_token_encrypted ? r.user_token_expires_at : null;
      const live = !!r.user_token_encrypted && (!until || Date.parse(until) > Date.now());
      out[r.id] = { ready: granted && live, missing: granted ? [] : [...FACEBOOK_ADS_SCOPES], findUntil: until, error: err };
    }
  }
  return out;
}

/** What the Accounts screen says about each Page's and Instagram account's
 *  private messages: ready, what to add in Meta, or Meta's last refusal. */
export async function messagesStates(tenantId: string, space: MarketingSpace): Promise<Record<string, { ready: boolean; missing: string[]; error: string | null }>> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select("id, platform, scopes, sync_state")
    .eq("tenant_id", tenantId)
    .eq("space", space)
    .eq("connection", "api")
    .in("platform", ["facebook", "instagram"])
    .neq("status", "disconnected");
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  const out: Record<string, { ready: boolean; missing: string[]; error: string | null }> = {};
  for (const r of (data ?? []) as Array<{ id: string; platform: string; scopes: string[] | null; sync_state: Record<string, unknown> | null }>) {
    const missing = messageScopesFor(r.platform).filter((x) => !(r.scopes ?? []).includes(x));
    out[r.id] = { ready: missing.length === 0, missing, error: typeof r.sync_state?.messages_error === "string" ? r.sync_state.messages_error : null };
  }
  return out;
}

/** After a sync: the account's status, audience and where the history
 *  import stopped. */
export async function recordSync(id: string, patch: {
  status: "connected" | "expired" | "error";
  last_error: string | null;
  audience?: number | null;
  synced: boolean;
}): Promise<void> {
  /* Never the sync state: several steps keep marks there, so it is only
     ever MERGED (recordSyncState) or claimed version-checked (claim*). */
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { status: patch.status, last_error: patch.last_error, updated_at: now };
  if (patch.audience !== undefined) row.audience = patch.audience;
  if (patch.synced) row.last_synced_at = now;
  const { error } = await supabaseServer.from("marketing_accounts").update(row).eq("id", id);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
}

/** Add an account on a platform with no posting API (WeChat, WhatsApp,
 *  Douyin) by its name and link. It has no access key: its posts go out
 *  with one-tap sharing. Returns the new account, or an error message for
 *  the person. */
export async function addManualAccount(input: {
  tenantId: string;
  space: MarketingSpace;
  platform: string;
  name: unknown;
  handle: unknown;
  profileUrl: unknown;
  createdBy: string;
}): Promise<{ account: MarketingAccountView } | { error: string }> {
  if (!(MANUAL_PLATFORMS as readonly string[]).includes(input.platform)) return { error: "This platform is not added by hand." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return { error: "Enter the account name (up to 120 characters)." };
  const handle = typeof input.handle === "string" ? input.handle.trim().replace(/^@+/, "").slice(0, 80) || null : null;
  let profileUrl: string | null = null;
  if (typeof input.profileUrl === "string" && input.profileUrl.trim()) {
    const raw = input.profileUrl.trim();
    let url: URL | null = null;
    try { url = new URL(raw); } catch { url = null; }
    if (!url || url.protocol !== "https:" || raw.length > 500) return { error: "The profile link must start with https://" };
    profileUrl = url.toString();
  }
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .insert({
      tenant_id: input.tenantId,
      space: input.space,
      platform: input.platform as MarketingPlatform,
      connection: "assisted",
      external_id: null,
      name,
      handle,
      profile_url: profileUrl,
      status: "connected",
      connected_by: input.createdBy,
    })
    .select(VIEW_COLUMNS)
    .single();
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  return { account: data as MarketingAccountView };
}

/** The space an account belongs to, so a route can check the right Roles
 *  module before touching it. null when it is not this tenant's. */
export async function accountSpace(tenantId: string, id: string): Promise<MarketingSpace | null> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select("space")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`marketing accounts: ${error.message}`);
  return (data as { space: MarketingSpace } | null)?.space ?? null;
}

/** Remove an account: its access key is deleted (the Data Deletion page
 *  promises exactly this) and it leaves the list; its row stays, marked
 *  disconnected, so its posts' history survives. */
export async function disconnectAccount(tenantId: string, id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("marketing_accounts")
    .update({ token_encrypted: null, token_expires_at: null, status: "disconnected", user_token_encrypted: null, user_token_expires_at: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
}

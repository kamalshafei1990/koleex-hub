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
import { encryptToken, isTokenCryptoConfigured } from "@/lib/server/marketing/token-crypto";
import { metaAppConfig, type MetaPage } from "@/lib/server/marketing/meta";
import type { MarketingAccountView, MarketingSetup, MarketingSpace } from "@/lib/marketing/spaces";

const VIEW_COLUMNS = "id, space, platform, connection, external_id, name, handle, avatar_url, profile_url, status, last_error, last_synced_at, updated_at";

export async function listAccounts(tenantId: string, space: MarketingSpace): Promise<MarketingAccountView[]> {
  const { data, error } = await supabaseServer
    .from("marketing_accounts")
    .select(VIEW_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("space", space)
    .order("platform", { ascending: true })
    .order("name", { ascending: true });
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
 *  Returns how many accounts were saved. */
export async function saveMetaAccounts(input: {
  tenantId: string;
  space: MarketingSpace;
  connectedBy: string;
  pages: MetaPage[];
  scopes: string[];
}): Promise<number> {
  const now = new Date().toISOString();
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
  if (rows.length === 0) return 0;

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
  for (const r of rows) {
    const id = idOf.get(`${r.platform}|${r.external_id}`);
    if (!id) continue;
    const { error } = await supabaseServer.from("marketing_accounts").update(r).eq("id", id);
    if (error) throw new Error(`marketing accounts: ${error.message}`);
  }
  if (fresh.length) {
    const { error } = await supabaseServer.from("marketing_accounts").insert(fresh);
    if (error) throw new Error(`marketing accounts: ${error.message}`);
  }
  return rows.length;
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

/** Disconnect an account: its access key is deleted (the Data Deletion page
 *  promises exactly this) and it stays listed as disconnected, with its
 *  history. */
export async function disconnectAccount(tenantId: string, id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("marketing_accounts")
    .update({ token_encrypted: null, token_expires_at: null, status: "disconnected", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw new Error(`marketing accounts: ${error.message}`);
}

import "server-only";

/* ---------------------------------------------------------------------------
   marketing/ad-comments — comments on ADS (owner, 29/09/2026: Facebook and
   Instagram together, shown in the Comments tab marked «Ad»).

   Every 30 minutes per account (claimAdScan), inside a time budget:
     1. the ads of the last 12 months, with their comment counts
        (meta-ads): a Facebook Page's ad posts with the Page key; an
        Instagram account's ad media found through the ad account with the
        connecting person's key, then read with the Page key. When that key
        is gone or lapsed, the Instagram ads already found still get fresh
        counts — only NEW ones wait for a reconnect;
     2. a BOOSTED post is an organic post — the Feed's posts and its comment
        scans already cover it — so only the posts that exist solely as ads
        are kept (marketing_ad_posts): ads never mix into the Feed, Insights
        or the weekly plan's numbers;
     3. an ad whose count grew since its comments were last read (or never
        read and with comments) is read, newest first; its comments land in
        marketing_comments with ad_post_id, so the Comments tab, «Needs a
        reply» and replying work as for any comment.
   Without the permissions (see lib/marketing/ads) nothing is asked of Meta
   (the account is still claimed, so it waits its turn).
   A refusal is kept for the Accounts screen (sync_state.ads_error); an
   expired Page key marks the account "expired" like every other read, but a
   lapsed personal key never does — the Page key still works.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { MetaError } from "@/lib/server/marketing/meta";
import { facebookComments, instagramComments, type RemoteComment } from "@/lib/server/marketing/meta-feed";
import { adAccounts, facebookAdPosts, instagramAdMedia, instagramAdMediaIds, type AdPost } from "@/lib/server/marketing/meta-ads";
import { claimAdScan, loadAccountForSync, recordSync, recordSyncState, type AccountForSync } from "@/lib/server/marketing/accounts";
import { facebookAdsGranted, instagramAdsGranted } from "@/lib/marketing/ads";

export const AD_SCAN_MS = 30 * 60_000;
/** sync_state.ads_error when the key that finds new Instagram ads is gone. */
export const AD_KEY_LAPSED = "key_lapsed";
const AD_MONTHS = 12;
/** Ads whose comments are read per run. */
const AD_READS = 30;
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002]);

export interface AdScanOutcome {
  ok: boolean;
  skipped?: "unavailable" | "fresh" | "no_permission";
  ads?: number;
  read?: number;
  left?: number;
}

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

type AdRow = { id: string; external_id: string; posted_at: string | null; comments: number | null; comments_seen: number | null };

/** Which of these the Feed already has as organic posts (a boosted post). */
async function organic(a: AccountForSync, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await inChunks<{ external_id: string }>(ids, (chunk) =>
    supabaseServer.from("marketing_remote_posts").select("external_id").eq("account_id", a.id).in("external_id", chunk));
  if (error) throw new Error(`marketing posts: ${error.message}`);
  return new Set((data ?? []).map((r) => r.external_id));
}

async function knownAds(a: AccountForSync): Promise<AdRow[]> {
  const { data, error } = await supabaseServer.from("marketing_ad_posts")
    .select("id, external_id, posted_at, comments, comments_seen").eq("account_id", a.id).limit(1000);
  if (error) throw new Error(`marketing ad posts: ${error.message}`);
  return (data ?? []) as AdRow[];
}

/** The ads, saved: their words, picture, link and count now; the count at
 *  the last read (comments_seen) is left as it is. */
async function saveAds(a: AccountForSync, ads: AdPost[]): Promise<AdRow[]> {
  if (!ads.length) return [];
  const now = new Date().toISOString();
  const rows = [...new Map(ads.map((p) => [p.external_id, p])).values()].map((p) => ({
    tenant_id: a.tenant_id, account_id: a.id, external_id: p.external_id, message: p.message, media: p.media,
    permalink: p.permalink, posted_at: p.posted_at, comments: p.comments, seen_at: now, updated_at: now,
  }));
  const out: AdRow[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabaseServer.from("marketing_ad_posts")
      .upsert(rows.slice(i, i + 200), { onConflict: "account_id,external_id" })
      .select("id, external_id, posted_at, comments, comments_seen");
    if (error) throw new Error(`marketing ad posts: ${error.message}`);
    out.push(...((data ?? []) as AdRow[]));
  }
  return out;
}

async function saveAdComments(a: AccountForSync, adPostId: string, comments: RemoteComment[]): Promise<void> {
  /* One statement may not touch a row twice. */
  const list = [...new Map(comments.map((c) => [c.external_id, { ...c, tenant_id: a.tenant_id, account_id: a.id, ad_post_id: adPostId }])).values()];
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await supabaseServer.from("marketing_comments").upsert(list.slice(i, i + 500), { onConflict: "account_id,external_id" });
    if (error) throw new Error(`marketing comments: ${error.message}`);
  }
}

/** Instagram's ads: the ones the ad accounts name now (when the personal key
 *  works) and the ones already found, read with the Page key. */
async function instagramAds(a: AccountForSync, since: string, known: AdRow[]): Promise<{ ads: AdPost[]; keyError: string | null }> {
  const ids = new Set(known.map((k) => k.external_id));
  let keyError: string | null = null;
  const live = !!a.userToken && (!a.user_token_expires_at || Date.parse(a.user_token_expires_at) > Date.now());
  if (live && instagramAdsGranted(a.scopes)) {
    try {
      for (const act of await adAccounts(a.userToken!)) {
        for (const id of await instagramAdMediaIds(act, a.userToken!, since)) ids.add(id);
      }
    } catch (e) {
      if (e instanceof MetaError && RATE_LIMIT_CODES.has(e.code ?? -1)) throw e;
      /* The personal key refused (lapsed, or a permission taken back): the
         ads already found still come, with the Page key. */
      keyError = text(e);
    }
  } else if (a.userToken || instagramAdsGranted(a.scopes)) {
    /* A code, not words: the Accounts screen says it in the reader's language. */
    keyError = AD_KEY_LAPSED;
  }
  return { ads: ids.size ? await instagramAdMedia(a.external_id!, a.token!, [...ids]) : [], keyError };
}

export async function scanAdComments(tenantId: string, accountId: string, opts: { budgetMs: number }): Promise<AdScanOutcome> {
  const started = Date.now();
  const a = await loadAccountForSync(tenantId, accountId);
  if (!a || (a.platform !== "facebook" && a.platform !== "instagram") || a.connection !== "api" || !a.token || !a.external_id
    || a.status === "disconnected" || a.status === "expired") {
    return { ok: false, skipped: "unavailable" };
  }
  /* Claimed first, even without the permissions: such an account then waits
     its 30 minutes like the others instead of taking every run's turn. */
  if (!(await claimAdScan(a, AD_SCAN_MS))) return { ok: true, skipped: "fresh" };
  const known0 = a.platform === "instagram" ? await knownAds(a) : [];
  const allowed = a.platform === "facebook" ? facebookAdsGranted(a.scopes) : instagramAdsGranted(a.scopes) || known0.length > 0;
  if (!allowed) return { ok: true, skipped: "no_permission" };
  const since = new Date(Date.now() - AD_MONTHS * 31 * 86_400_000).toISOString();
  try {
    let found: AdPost[];
    let keyError: string | null = null;
    if (a.platform === "facebook") found = await facebookAdPosts(a.external_id, a.token, since);
    else ({ ads: found, keyError } = await instagramAds(a, since, known0));
    const boosted = await organic(a, found.map((f) => f.external_id));
    const saved = await saveAds(a, found.filter((f) => !boosted.has(f.external_id)));
    const due = saved
      .filter((r) => (r.comments ?? 0) > (r.comments_seen ?? 0))
      .sort((x, y) => (Date.parse(y.posted_at ?? "") || 0) - (Date.parse(x.posted_at ?? "") || 0));
    let read = 0;
    for (const r of due) {
      if (read >= AD_READS || Date.now() - started > opts.budgetMs - 3_000) break;
      const comments = a.platform === "facebook"
        ? await facebookComments(a.external_id, r.external_id, a.token)
        : await instagramComments(r.external_id, a.handle, a.token);
      if (comments.length) await saveAdComments(a, r.id, comments);
      const { error } = await supabaseServer.from("marketing_ad_posts").update({ comments_seen: r.comments ?? 0 }).eq("id", r.id);
      if (error) throw new Error(`marketing ad posts: ${error.message}`);
      read++;
    }
    const left = due.length - read;
    await recordSyncState(a, { ads_scan_full: left <= 0, ads_error: keyError, ads_found: saved.length });
    return { ok: true, ads: saved.length, read, left };
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return { ok: false };
    }
    /* A refusal (a permission missing, the ADVERTISE task, a rate limit) is
       kept for the Accounts screen; the next run tries again. */
    await recordSyncState(a, { ads_error: text(e) }).catch(() => {});
    console.warn(`[marketing/ad-comments] ${a.platform} ${a.id}: left for later: ${text(e)}`);
    return { ok: false };
  }
}

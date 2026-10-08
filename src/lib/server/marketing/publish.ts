import "server-only";

/* ---------------------------------------------------------------------------
   marketing/publish — sends an APPROVED post to its accounts.

   One run, inside a time budget, account after account:
     · a target is CLAIMED before anything is sent — a conditional update
       from the status (and lease) it was read with — so two clicks, two
       tabs or two approvers can never publish the same post twice;
     · the claim is a 90-second lease (next_attempt_at): a run that dies
       mid-way frees the account for the next one;
     · Instagram may need longer than one run to prepare a video or an album:
       the step comes back "not done", its state goes to publish_state and the
       lease is shortened, and the next run continues from there;
     · a published account gets its link, and the post appears in the Feed at
       once (marketing_remote_posts, linked by target_id); a failure keeps
       Meta's own explanation; an expired key also marks the account expired;
     · hand-shared accounts (no posting API) are never sent — a person shares
       them and marks them shared.
   The post's status then follows its accounts: published, partly_published,
   failed, or still publishing. A move to a settled status is written once,
   from the status it was read with, and only that writer tells the people
   concerned (./notify): a failure reaches the author and the approver, a
   post published with nobody watching reaches its author.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { MetaError } from "@/lib/server/marketing/meta";
import { publishToFacebook, publishToInstagram, type PublishStep } from "@/lib/server/marketing/meta-publish";
import { publishToLinkedIn } from "@/lib/server/marketing/linkedin";
import { loadAccountForSync, recordSync } from "@/lib/server/marketing/accounts";
import { later, notifyPublishOutcome } from "@/lib/server/marketing/notify";
import { targetIssues } from "@/lib/marketing/post-rules";
import type { PostMedia, PostStatus, TargetStatus } from "@/lib/marketing/post-types";

const LEASE_MS = 90_000;
const PUBLISHABLE: readonly PostStatus[] = ["approved", "publishing", "partly_published", "failed"];
const SETTLED: readonly PostStatus[] = ["published", "partly_published", "failed"];

type TargetRow = {
  id: string; account_id: string; body_override: string | null; status: TargetStatus;
  attempts: number; next_attempt_at: string | null; publish_state: Record<string, unknown> | null;
};

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

async function targetsOf(postId: string): Promise<TargetRow[]> {
  const { data, error } = await supabaseServer
    .from("marketing_post_targets")
    .select("id, account_id, body_override, status, attempts, next_attempt_at, publish_state")
    .eq("post_id", postId)
    .limit(50);
  if (error) throw new Error(`marketing post targets: ${error.message}`);
  return (data ?? []) as TargetRow[];
}

/** Take one account of the post for this run. Only from what it was read
 *  as: pending, or publishing with an expired lease. */
async function claim(t: TargetRow): Promise<boolean> {
  const now = Date.now();
  if (t.status === "publishing" && t.next_attempt_at && Date.parse(t.next_attempt_at) > now) return false;
  let q = supabaseServer
    .from("marketing_post_targets")
    .update({ status: "publishing", attempts: t.attempts + 1, next_attempt_at: new Date(now + LEASE_MS).toISOString(), updated_at: new Date(now).toISOString() })
    .eq("id", t.id)
    .eq("status", t.status);
  q = t.next_attempt_at ? q.eq("next_attempt_at", t.next_attempt_at) : q.is("next_attempt_at", null);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`marketing post targets: ${error.message}`);
  return !!data?.length;
}

async function finishTarget(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseServer.from("marketing_post_targets").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`marketing post targets: ${error.message}`);
}

/** Recompute the post's status from its accounts. `actorId`: whose request
 *  ran the publishing (null for the cron) — they saw the result on screen. */
export async function settlePost(tenantId: string, postId: string, opts: { actorId?: string | null } = {}): Promise<{ status: PostStatus; busy: boolean }> {
  const { data: post, error } = await supabaseServer.from("marketing_posts").select("status, published_at").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (!post) return { status: "failed", busy: false };
  const current = (post as { status: PostStatus; published_at: string | null });
  const targets = await targetsOf(postId);
  const ids = [...new Set(targets.map((t) => t.account_id))];
  const { data: accs, error: aErr } = await supabaseServer.from("marketing_accounts").select("id, connection").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).limit(ids.length || 1);
  if (aErr) throw new Error(`marketing accounts: ${aErr.message}`);
  const assisted = new Set(((accs ?? []) as Array<{ id: string; connection: string }>).filter((a) => a.connection === "assisted").map((a) => a.id));
  const api = targets.filter((t) => !assisted.has(t.account_id));
  const hand = targets.filter((t) => assisted.has(t.account_id));

  const busy = api.some((t) => t.status === "publishing" || t.status === "pending");
  const published = api.filter((t) => t.status === "published").length;
  const failed = api.filter((t) => t.status === "failed").length;
  const shared = hand.filter((t) => t.status === "shared").length;

  let status: PostStatus;
  if (busy) status = "publishing";
  else if (api.length === 0) status = hand.length && shared === hand.length ? "published" : "approved";
  else if (failed === 0) status = "published";
  else if (published > 0) status = "partly_published";
  else status = "failed";

  if (!PUBLISHABLE.includes(current.status) && current.status !== "published") return { status: current.status, busy: false };
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (!current.published_at && (status === "published" || status === "partly_published")) patch.published_at = new Date().toISOString();
  if (status !== current.status || patch.published_at) {
    /* From the status it was read with: of two runs settling at once, one
       writes the move — and only that one tells anyone about it. */
    const { data: moved, error: uErr } = await supabaseServer.from("marketing_posts").update(patch)
      .eq("tenant_id", tenantId).eq("id", postId).eq("status", current.status).select("id");
    if (uErr) throw new Error(`marketing posts: ${uErr.message}`);
    if (moved?.length && status !== current.status && SETTLED.includes(status)) {
      const actorId = opts.actorId ?? null;
      later(() => notifyPublishOutcome(tenantId, postId, status, actorId));
    }
  }
  return { status, busy };
}

export async function publishPost(tenantId: string, postId: string, opts: { budgetMs?: number; actorId?: string | null } = {}): Promise<{ status: PostStatus; busy: boolean }> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 45_000);
  const { data: post, error } = await supabaseServer.from("marketing_posts").select("id, status, body, media").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (!post) return { status: "failed", busy: false };
  const row = post as { id: string; status: PostStatus; body: string; media: PostMedia[] | null };
  if (!PUBLISHABLE.includes(row.status)) return { status: row.status, busy: false };
  if (row.status === "approved") {
    const { error: uErr } = await supabaseServer.from("marketing_posts").update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", postId).eq("status", "approved");
    if (uErr) throw new Error(`marketing posts: ${uErr.message}`);
  }
  const media = Array.isArray(row.media) ? row.media : [];

  for (const t of await targetsOf(postId)) {
    if (Date.now() > deadline - 5_000) break;
    if (t.status !== "pending" && t.status !== "publishing") continue;
    const account = await loadAccountForSync(tenantId, t.account_id);
    if (!account || account.connection !== "api") continue;
    if (!(await claim(t))) continue;

    const body = t.body_override ?? row.body;
    if (account.status === "disconnected" || !account.token || !account.external_id) {
      await finishTarget(t.id, { status: "failed", error: "The account was removed. Add it again in Accounts.", next_attempt_at: null });
      continue;
    }
    const issues = targetIssues(account, body, media);
    if (issues.length) {
      await finishTarget(t.id, { status: "failed", error: `rule:${issues[0].code}`, next_attempt_at: null });
      continue;
    }
    try {
      const step: PublishStep = account.platform === "facebook"
        ? await publishToFacebook(account.external_id, account.token, body, media)
        : account.platform === "instagram"
          ? await publishToInstagram(account.external_id, account.token, body, media, t.publish_state ?? {}, deadline - 3_000)
          : account.platform === "linkedin"
            ? await publishToLinkedIn(account.external_id, account.token, body, media)
            : (() => { throw new MetaError("Publishing to this platform is not available yet.", null); })();
      if (!step.done) {
        await finishTarget(t.id, { status: "publishing", publish_state: step.state, next_attempt_at: new Date(Date.now() + step.retryInMs).toISOString() });
        continue;
      }
      const now = new Date().toISOString();
      await finishTarget(t.id, {
        status: "published", external_post_id: step.externalId, permalink: step.permalink, error: null,
        published_at: now, publish_state: {}, next_attempt_at: null,
      });
      if (step.feedId) {
        /* In the Feed at once; the next sync adds its numbers. */
        const { error: fErr } = await supabaseServer.from("marketing_remote_posts").upsert({
          tenant_id: tenantId, account_id: account.id, external_id: step.feedId, target_id: t.id,
          message: body || null, media: media.map((m) => ({ kind: m.kind, url: m.url })),
          permalink: step.permalink, posted_at: now, updated_at: now,
        }, { onConflict: "account_id,external_id" });
        if (fErr) console.warn(`[marketing/publish] feed row for ${t.id}: ${fErr.message}`);
      }
    } catch (e) {
      const message = text(e);
      console.error(`[marketing/publish] ${account.platform} ${t.id}: ${message}`);
      await finishTarget(t.id, { status: "failed", error: message, next_attempt_at: null });
      if (e instanceof MetaError && e.code === 190) {
        await recordSync(account.id, { status: "expired", last_error: message, synced: false }).catch(() => {});
      }
    }
  }
  return settlePost(tenantId, postId, { actorId: opts.actorId ?? null });
}

/** A person shared the post on a hand-shared account (WeChat, WhatsApp,
 *  Douyin). Only after approval, only once. */
export async function markShared(tenantId: string, postId: string, targetId: string, actorId: string | null = null): Promise<{ ok: true; status: PostStatus } | { error: string; status: number }> {
  const { data: post, error } = await supabaseServer.from("marketing_posts").select("status").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  const st = (post as { status: PostStatus } | null)?.status;
  if (!st) return { error: "Post not found.", status: 404 };
  if (!["approved", "publishing", "published", "partly_published", "failed"].includes(st)) return { error: "The post is not approved yet.", status: 409 };
  const { data: target, error: tErr } = await supabaseServer.from("marketing_post_targets").select("id, account_id, status").eq("tenant_id", tenantId).eq("post_id", postId).eq("id", targetId).maybeSingle();
  if (tErr) throw new Error(`marketing post targets: ${tErr.message}`);
  if (!target) return { error: "Account not found on this post.", status: 404 };
  const { data: acc, error: aErr } = await supabaseServer.from("marketing_accounts").select("connection").eq("id", (target as { account_id: string }).account_id).maybeSingle();
  if (aErr) throw new Error(`marketing accounts: ${aErr.message}`);
  if ((acc as { connection: string } | null)?.connection !== "assisted") return { error: "This account is published by the Hub itself.", status: 409 };
  const now = new Date().toISOString();
  const { data: done, error: uErr } = await supabaseServer.from("marketing_post_targets")
    .update({ status: "shared", published_at: now, updated_at: now })
    .eq("id", targetId).eq("status", "pending").select("id");
  if (uErr) throw new Error(`marketing post targets: ${uErr.message}`);
  if (!done?.length) return { error: "Already marked as shared.", status: 409 };
  const settled = await settlePost(tenantId, postId, { actorId });
  return { ok: true, status: settled.status };
}

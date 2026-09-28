import "server-only";

/* ---------------------------------------------------------------------------
   marketing/cron — the work of /api/cron/marketing-publish (every 5 minutes),
   inside one time budget:
     1. scheduled posts whose time has come: each is CLAIMED (scheduled →
        approved, conditionally on still being scheduled and due) before it
        is published, so two overlapping runs never take the same post — and
        each account is claimed again by the publisher;
     2. posts still publishing (an Instagram video Meta is preparing, an
        account a run did not reach) continue where they stopped, even with
        every screen closed;
     3. the Feed: accounts not refreshed for 3 hours are refreshed (owner,
        27/09/2026), a few per run, so numbers and followers stay current and
        the week-on-week change has a snapshot every day;
     4. comments: the last 14 days' posts of every account, every 15 minutes
        (28/09/2026), so a question waits minutes, not hours, for the team to
        see it — each account claimed first (claimComments);
     5. insights: each Page's and Instagram account's numbers per day
        (28/09/2026) — every run while the 180 days of history come in, then
        every 6 hours — each account claimed first (claimInsights);
     6. comments on OLDER posts (29/09/2026): every post's comment count
        once a day, and the posts whose count grew are read — every run while
        a backlog remains — each account claimed first (claimCommentScan).
   Scheduled times are instants; the screens show and pick them in Shanghai
   time (lib/marketing/format).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { publishPost } from "@/lib/server/marketing/publish";
import { COMMENTS_REFRESH_MS, COMMENT_SCAN_MS, refreshRecentComments, scanOlderComments, syncAccount } from "@/lib/server/marketing/sync";
import { INSIGHTS_REFRESH_MS, syncInsights } from "@/lib/server/marketing/insights";

export const FEED_REFRESH_MS = 3 * 3600_000;

export interface CronSummary { due: number; published: number; continued: number; refreshed: number; comments: number; insights: number; olderComments: number; stoppedEarly: boolean }

export async function runMarketingCron(opts: { budgetMs?: number; tenantId?: string } = {}): Promise<CronSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  const left = () => budget - (Date.now() - started);
  const out: CronSummary = { due: 0, published: 0, continued: 0, refreshed: 0, comments: 0, insights: 0, olderComments: 0, stoppedEarly: false };
  /* 1. Due scheduled posts, oldest first. */
  const now = new Date().toISOString();
  let dueQ = supabaseServer.from("marketing_posts").select("id, tenant_id").eq("status", "scheduled").lte("scheduled_at", now);
  if (opts.tenantId) dueQ = dueQ.eq("tenant_id", opts.tenantId);
  const { data: due, error } = await dueQ.order("scheduled_at", { ascending: true }).limit(10);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  out.due = (due ?? []).length;
  for (const p of (due ?? []) as Array<{ id: string; tenant_id: string }>) {
    if (left() < 15_000) { out.stoppedEarly = true; break; }
    const { data: claimed, error: cErr } = await supabaseServer
      .from("marketing_posts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", p.id)
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .select("id");
    if (cErr) throw new Error(`marketing posts: ${cErr.message}`);
    if (!claimed?.length) continue;
    await publishPost(p.tenant_id, p.id, { budgetMs: Math.min(40_000, left() - 5_000) });
    out.published++;
  }

  /* 2. Posts still publishing. */
  if (left() > 12_000) {
    let busyQ = supabaseServer.from("marketing_posts").select("id, tenant_id").eq("status", "publishing");
    if (opts.tenantId) busyQ = busyQ.eq("tenant_id", opts.tenantId);
    const { data: busy, error: bErr } = await busyQ.order("updated_at", { ascending: true }).limit(10);
    if (bErr) throw new Error(`marketing posts: ${bErr.message}`);
    for (const p of (busy ?? []) as Array<{ id: string; tenant_id: string }>) {
      if (left() < 12_000) { out.stoppedEarly = true; break; }
      await publishPost(p.tenant_id, p.id, { budgetMs: Math.min(30_000, left() - 5_000) });
      out.continued++;
    }
  }

  /* 3. The Feed, every 3 hours per account. */
  if (left() > 15_000) {
    const stale = new Date(Date.now() - FEED_REFRESH_MS).toISOString();
    let accQ = supabaseServer.from("marketing_accounts").select("id, tenant_id").eq("connection", "api")
      .in("status", ["connected", "error"])
      .or(`last_synced_at.is.null,last_synced_at.lt.${stale}`)
      .or(`sync_state->>last_attempt_at.is.null,sync_state->>last_attempt_at.lt.${stale}`);
    if (opts.tenantId) accQ = accQ.eq("tenant_id", opts.tenantId);
    const { data: accs, error: aErr } = await accQ.order("last_synced_at", { ascending: true, nullsFirst: true }).limit(3);
    if (aErr) throw new Error(`marketing accounts: ${aErr.message}`);
    for (const a of (accs ?? []) as Array<{ id: string; tenant_id: string }>) {
      if (left() < 15_000) { out.stoppedEarly = true; break; }
      const r = await syncAccount(a.tenant_id, a.id, { budgetMs: Math.min(30_000, left() - 5_000) });
      if (r.ok && !r.skipped) out.refreshed++;
    }
  }

  /* 4. Comments on recent posts, every 15 minutes per account. */
  if (left() > 10_000) {
    const stale = new Date(Date.now() - COMMENTS_REFRESH_MS).toISOString();
    let cQ = supabaseServer.from("marketing_accounts").select("id, tenant_id").eq("connection", "api")
      .in("status", ["connected", "error"])
      .or(`sync_state->>comments_at.is.null,sync_state->>comments_at.lt.${stale}`);
    if (opts.tenantId) cQ = cQ.eq("tenant_id", opts.tenantId);
    const { data: cAccs, error: cErr } = await cQ.order("updated_at", { ascending: true }).limit(5);
    if (cErr) throw new Error(`marketing accounts: ${cErr.message}`);
    for (const a of (cAccs ?? []) as Array<{ id: string; tenant_id: string }>) {
      if (left() < 10_000) { out.stoppedEarly = true; break; }
      const r = await refreshRecentComments(a.tenant_id, a.id, { minGapMs: COMMENTS_REFRESH_MS, budgetMs: Math.min(20_000, left() - 5_000) });
      if (r.ok && !r.skipped) out.comments++;
    }
  }

  /* 5. Insights: while an account's history is still coming in, every run;
        after that, every 6 hours (syncInsights decides; claimInsights keeps
        two runs off one account). Facebook Pages and Instagram only. */
  if (left() > 12_000) {
    const staleLong = new Date(Date.now() - INSIGHTS_REFRESH_MS).toISOString();
    const staleShort = new Date(Date.now() - 4 * 60_000).toISOString();
    let iQ = supabaseServer.from("marketing_accounts").select("id, tenant_id").eq("connection", "api")
      .in("platform", ["facebook", "instagram"])
      .in("status", ["connected", "error"])
      .or(`sync_state->>insights_full.is.null,sync_state->>insights_full.neq.true,sync_state->>insights_at.lt.${staleLong}`)
      .or(`sync_state->>insights_at.is.null,sync_state->>insights_at.lt.${staleShort}`);
    if (opts.tenantId) iQ = iQ.eq("tenant_id", opts.tenantId);
    const { data: iAccs, error: iErr } = await iQ.order("updated_at", { ascending: true }).limit(3);
    if (iErr) throw new Error(`marketing accounts: ${iErr.message}`);
    for (const a of (iAccs ?? []) as Array<{ id: string; tenant_id: string }>) {
      if (left() < 12_000) { out.stoppedEarly = true; break; }
      const r = await syncInsights(a.tenant_id, a.id, { budgetMs: Math.min(25_000, left() - 5_000) });
      if (r.ok && !r.skipped) out.insights++;
    }
  }

  /* 6. Comments on older posts: once a day per account, every run while a
        backlog remains (scanOlderComments decides; claimCommentScan keeps
        two runs off one account). */
  if (left() > 10_000) {
    const staleLong = new Date(Date.now() - COMMENT_SCAN_MS).toISOString();
    const staleShort = new Date(Date.now() - 4 * 60_000).toISOString();
    let sQ = supabaseServer.from("marketing_accounts").select("id, tenant_id").eq("connection", "api")
      .in("platform", ["facebook", "instagram"])
      .in("status", ["connected", "error"])
      .or(`sync_state->>comments_scan_full.is.null,sync_state->>comments_scan_full.neq.true,sync_state->>comments_scan_at.lt.${staleLong}`)
      .or(`sync_state->>comments_scan_at.is.null,sync_state->>comments_scan_at.lt.${staleShort}`);
    if (opts.tenantId) sQ = sQ.eq("tenant_id", opts.tenantId);
    const { data: sAccs, error: sErr } = await sQ.order("updated_at", { ascending: true }).limit(2);
    if (sErr) throw new Error(`marketing accounts: ${sErr.message}`);
    for (const a of (sAccs ?? []) as Array<{ id: string; tenant_id: string }>) {
      if (left() < 10_000) { out.stoppedEarly = true; break; }
      const r = await scanOlderComments(a.tenant_id, a.id, { budgetMs: Math.min(20_000, left() - 5_000) });
      if (r.ok && !r.skipped) out.olderComments++;
    }
  }
  return out;
}

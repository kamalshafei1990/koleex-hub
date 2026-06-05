import "server-only";

/* ---------------------------------------------------------------------------
   QA watch / follow (Phase 5) — server helpers.

   Watchers follow an issue and receive its notifications without being the
   reporter or assignee. Delivery reuses the existing notifyIssue() + inbox
   pipeline — this module only manages membership and turns watchers into
   notification targets, with the internal-note privacy rules applied
   server-side.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { issueLink, reporterIssueLink, type NotifyTarget, type QaNotificationType } from "@/lib/qa/notify";
import type { QaWatcher } from "@/lib/qa/types";

/** Add the caller as a watcher (idempotent — UNIQUE(issue_id, account_id)). */
export async function addWatcher(tenantId: string, issueId: string, accountId: string): Promise<{ ok: boolean; created: boolean }> {
  const { data, error } = await supabaseServer
    .from("qa_issue_watchers")
    .upsert({ tenant_id: tenantId, issue_id: issueId, account_id: accountId }, { onConflict: "issue_id,account_id", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[qa watchers add]", error.message);
    return { ok: false, created: false };
  }
  // upsert with ignoreDuplicates returns the inserted row(s); empty when it
  // already existed.
  return { ok: true, created: (data?.length ?? 0) > 0 };
}

/** Remove the caller from an issue's watchers. */
export async function removeWatcher(tenantId: string, issueId: string, accountId: string): Promise<{ ok: boolean; removed: boolean }> {
  const { data, error } = await supabaseServer
    .from("qa_issue_watchers")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId)
    .eq("account_id", accountId)
    .select("id");
  if (error) {
    console.error("[qa watchers remove]", error.message);
    return { ok: false, removed: false };
  }
  return { ok: true, removed: (data?.length ?? 0) > 0 };
}

/** Is a given account watching the issue? */
export async function isWatching(tenantId: string, issueId: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("qa_issue_watchers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId)
    .eq("account_id", accountId)
    .maybeSingle();
  return !!data;
}

/** Watcher count for an issue (cheap, head count). */
export async function getWatcherCount(tenantId: string, issueId: string): Promise<number> {
  const { count } = await supabaseServer
    .from("qa_issue_watchers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId);
  return count ?? 0;
}

/** Watcher identities (admin-only display) — name + avatar, one round-trip. */
export async function getWatchers(tenantId: string, issueId: string): Promise<QaWatcher[]> {
  const { data, error } = await supabaseServer
    .from("qa_issue_watchers")
    .select("account_id, accounts:account_id ( username, login_email, avatar_url )")
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[qa watchers list]", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const row = r as { account_id: string; accounts: unknown };
    const a = (Array.isArray(row.accounts) ? row.accounts[0] : row.accounts) as
      { username: string | null; login_email: string | null; avatar_url: string | null } | null;
    return {
      account_id: row.account_id,
      name: a?.username || a?.login_email || "—",
      avatar_url: a?.avatar_url ?? null,
    };
  });
}

/**
 * Turn an issue's watchers into notification targets for an event.
 *
 *  • excludes the actor (no self-notification)
 *  • internal notes notify only watchers with internal access (Super Admins);
 *    a reporter watching their own issue never gets internal-note pings
 *  • routes each watcher to the surface they can actually open: admins → the
 *    QA console, everyone else → the reporter-safe view
 *
 * Returned targets are appended AFTER the reporter/assignee/mention targets so
 * notifyIssue's per-recipient dedupe keeps the more specific one (mentions win).
 */
export async function watcherTargets(opts: {
  tenantId: string;
  issueId: string;
  actorId: string | null;
  internal: boolean;
  type: QaNotificationType;
  title: string;
  body: string;
  alert?: boolean;
}): Promise<NotifyTarget[]> {
  const { data, error } = await supabaseServer
    .from("qa_issue_watchers")
    .select("account_id, accounts:account_id ( is_super_admin )")
    .eq("tenant_id", opts.tenantId)
    .eq("issue_id", opts.issueId);
  if (error) {
    console.error("[qa watchers targets]", error.message);
    return [];
  }
  const out: NotifyTarget[] = [];
  for (const r of data ?? []) {
    const row = r as { account_id: string; accounts: unknown };
    if (row.account_id === opts.actorId) continue;
    const a = (Array.isArray(row.accounts) ? row.accounts[0] : row.accounts) as { is_super_admin: boolean | null } | null;
    const admin = !!a?.is_super_admin;
    if (opts.internal && !admin) continue; // internal notes → admins only
    out.push({
      recipientId: row.account_id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      alert: opts.alert,
      link: admin ? issueLink(opts.issueId) : reporterIssueLink(opts.issueId),
    });
  }
  return out;
}

import "server-only";

/* ---------------------------------------------------------------------------
   QA → Notifications bridge (Phase 4).

   This file does NOT introduce a new notification system. It wires QA
   workflow events into the Hub's existing in-app notification store —
   `inbox_messages` — which already powers the NotificationBell dropdown
   (unread badge, mark-read / mark-all-read, realtime, empty/loading state).

   A QA notification is simply an inbox row:
     recipient_account_id  → who is notified
     sender_account_id     → the actor (used to suppress self-notifications)
     category              → 'task' (normal) | 'alert' (reopen / urgent)
     subject / body        → title / message
     link                  → /issues?issue=<id>  (auto-selects the issue)
     metadata.type         → the fine-grained type (qa_issue_assigned, …) —
                             the key the shared classifier reads, so the row
                             lands under the "QA reports" chip / switch / chime.
                             (`qa_type` is kept alongside for older readers.)
     tenant_id             → the issue's tenant (recipients are tenant accounts)

   Each row also goes out as a Web Push (kind = the same type), like every
   other module — QA used to be the one producer with no push at all.

   Everything here is best-effort: a notification failure must never break the
   QA mutation that triggered it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { clearUnreadByMetaIn, supersedeUnread } from "@/lib/server/inbox-lifecycle";
import type { IssueStatus } from "@/lib/qa/types";

export type QaNotificationType =
  | "qa_issue_assigned"
  | "qa_issue_reassigned"
  | "qa_comment_added"
  | "qa_status_changed"
  | "qa_priority_changed"
  | "qa_issue_reopened"
  | "qa_issue_verified"
  | "qa_issue_closed"
  | "qa_issue_mentioned"
  | "qa_issue_duplicate_marked";

/** Alert-tier events get the red "Alert" badge; everything else is a "Task". */
const ALERT_TYPES = new Set<QaNotificationType>(["qa_issue_reopened"]);

/** Admin deep-link — the QA console reads ?issue= to auto-select the row. */
export function issueLink(issueId: string): string {
  return `/issues?issue=${issueId}`;
}

/** Reporter-safe deep-link — the restricted, read-only issue view. */
export function reporterIssueLink(issueId: string): string {
  return `/qa/report/${issueId}`;
}

export interface NotifyTarget {
  recipientId: string | null | undefined;
  type: QaNotificationType;
  title: string;
  body: string;
  /** Force the alert tier (e.g. urgent priority). */
  alert?: boolean;
  /** Per-recipient destination. Defaults to the admin console link.
   *  Reporter-directed notifications pass the reporter-safe link. */
  link?: string;
}

export interface NotifyContext {
  tenantId: string;
  issueId: string;
  actorId: string | null;
  actorName: string | null;
}

/**
 * Insert in-app notifications for a QA event.
 *
 * Guarantees:
 *  • never notifies the actor (self-notification suppression)
 *  • at most one row per recipient per call (dedupe — first target wins, so
 *    callers should list the most specific type first, e.g. mentions)
 *  • single batched insert (no N+1)
 *  • never throws
 */
export async function notifyIssue(ctx: NotifyContext, targets: NotifyTarget[]): Promise<void> {
  const byRecipient = new Map<string, NotifyTarget>();
  for (const t of targets) {
    const id = t.recipientId;
    if (!id) continue;
    if (id === ctx.actorId) continue;        // no self-notifications
    if (byRecipient.has(id)) continue;        // first target wins
    byRecipient.set(id, t);
  }
  if (byRecipient.size === 0) return;

  const rows = Array.from(byRecipient.entries()).map(([recipientId, t]) => ({
    tenant_id: ctx.tenantId,
    recipient_account_id: recipientId,
    sender_account_id: ctx.actorId,
    category: t.alert || ALERT_TYPES.has(t.type) ? "alert" : "task",
    subject: t.title.slice(0, 200),
    body: t.body.slice(0, 1000),
    link: t.link ?? issueLink(ctx.issueId),
    metadata: {
      type: t.type,
      qa_type: t.type,
      entity_type: "qa_issue",
      entity_id: ctx.issueId,
      actor_name: ctx.actorName,
    },
  }));

  // Thread per issue: collapse repeated updates into ONE notification per
  // recipient per issue instead of piling up a new row for every change. Any
  // still-UNREAD QA notification for this issue (any qa_type) is superseded
  // for these recipients, then the fresh one lands — so the inbox shows a
  // single, latest entry per issue. Read notifications are left untouched
  // (history). Superseded = archived like every other module's, no longer
  // hard-deleted.
  const recipientIds = Array.from(byRecipient.keys());
  await supersedeUnread({ recipients: recipientIds, meta: { entity_type: "qa_issue", entity_id: ctx.issueId } });

  const { error } = await supabaseServer.from("inbox_messages").insert(rows);
  if (error) { console.error("[qa notify]", error.message); return; }
  await emitPings(recipientIds.map((id) => ({ topic: rtTopic.inbox(id) })));

  /* Push mirrors the row, one per recipient (their own title/link — the
     reporter gets the reporter-safe link). Tagged per issue so a burst of
     updates on one issue replaces rather than stacks on the lock screen. */
  await Promise.all(
    Array.from(byRecipient.entries()).map(([recipientId, t]) =>
      sendPushToAccounts(
        [recipientId],
        {
          title: t.title.slice(0, 120),
          body: t.body.slice(0, 200),
          url: t.link ?? issueLink(ctx.issueId),
          tag: `qa:${ctx.issueId}`,
          kind: t.type,
        },
        { actorAccountId: ctx.actorId },
      ).catch((e) => console.error("[qa notify] push:", e instanceof Error ? e.message : e)),
    ),
  );
}

/* ── Settled issues ────────────────────────────────────────────────────────
   Verified, closed, rejected or a duplicate: nothing about the issue waits on
   anyone any more. Every recipient's unread QA row for it is finished
   business — not only the people the status change itself notifies (an
   assignee who closes their own issue is never notified, and their
   "assigned to you" used to stay unread forever). Call BEFORE notifyIssue,
   so the notice of the settling status itself survives. */
export const SETTLED_STATUSES: ReadonlySet<IssueStatus> = new Set<IssueStatus>(["verified", "closed", "rejected", "duplicate"]);

export async function settleIssueNotifications(issueIds: string[]): Promise<void> {
  await clearUnreadByMetaIn({ entity_type: "qa_issue" }, "entity_id", issueIds);
}

/* ── Mentions ──────────────────────────────────────────────────────────────
   Parse @username tokens from a comment, resolve to real accounts in the
   issue's tenant, and ignore anything that doesn't match a real user. */

/** Extract unique @username handles. Safe, bounded regex. */
export function parseMentions(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  // @handle: letters, digits, dot, underscore, hyphen — 2..40 chars.
  const re = /(?:^|[^a-zA-Z0-9_@])@([a-zA-Z0-9._-]{2,40})/g;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(text)) !== null && guard < 50) {
    guard++;
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

/** Resolve @usernames → { id, username } for real accounts in this tenant.
 *  Matched case-insensitively in JS (usernames here are already lowercased),
 *  so no injection surface and no case mismatches. */
export async function resolveMentionedAccounts(
  tenantId: string,
  usernames: string[],
): Promise<Array<{ id: string; username: string }>> {
  if (usernames.length === 0) return [];
  const want = new Set(usernames);
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("id, username")
    .eq("tenant_id", tenantId);
  if (error) {
    console.error("[qa notify mentions]", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string; username: string | null }>)
    .filter((a) => a.username && want.has(a.username.toLowerCase()))
    .map((a) => ({ id: a.id, username: a.username as string }));
}

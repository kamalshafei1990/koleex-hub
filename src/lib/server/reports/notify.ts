import "server-only";

/* ---------------------------------------------------------------------------
   Reports — notifications. Every one rides notify-lite (inbox + push, the
   sender excluded) and carries metadata.report_id, so opening the report can
   clear exactly the reader's own copy, and a review decision can clear the
   approval request for everyone who received it.

   Types (classified in src/lib/notification-activity.ts):
     report_submitted          → reports_activity
     report_approval_request   → approvals (the word "approval" wins)
     report_decided            → reports_activity
     report_comment            → comments_activity

   The nudges (report_reminder / report_escalation, from nudges.ts) and the
   event requests (report_request, from events.ts) are ONE row about possibly
   SEVERAL owed reports. Sending a report settles it in each of them
   (settleOwedReport): a row still listing other owed reports stays.
   --------------------------------------------------------------------------- */

import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta, settleListedItems, supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { requestIdOf } from "@/lib/reports/events";
import type { ReportRow } from "@/lib/server/reports/core";
import { pickWord, readSnapshot, templateOf } from "@/lib/reports/custom-templates";
import { reportsT } from "@/lib/translations/reports";

/* Every notification is a template (translations/notif-templates/reports.ts):
   the bell and Koleex Mail read it in the reader's own language, and the
   row stores its English. The report's title is the author's own words —
   {title:free}; with none, its type's name stands in, in its English form
   (a builder type's: as its report was started with it — 4E). */
const nameOf = (r: ReportRow) =>
  (reportsT[`tpl.${r.template_key}.name`]?.en as string | undefined) ?? (pickWord(readSnapshot(r.template_snapshot)?.head.name, "en") || "Report");
const titleOf = (r: ReportRow) => (r.title?.trim() ? r.title.trim() : nameOf(r));

export async function notifyReportSubmitted(r: ReportRow, recipientIds: string[], authorName: string): Promise<void> {
  const tpl = templateOf(r);
  const urgent = !!tpl?.urgent;
  /* One sentence per variant: "Urgent · " leads for an urgent type, and a
     review request says "Waiting for your review." in its body. */
  const p = { title: titleOf(r), author: authorName };
  await notifyLite({
    tenantId: r.tenant_id,
    recipients: recipientIds,
    senderId: r.author_account_id,
    tpl: r.review_required
      ? urgent ? { k: "report_approval_request.urgent", p } : { k: "report_approval_request", p }
      : urgent ? { k: "report_submitted.urgent", p } : { k: "report_submitted", p },
    link: `/reports/${r.id}`,
    type: r.review_required ? "report_approval_request" : "report_submitted",
    metadata: { report_id: r.id, template_key: r.template_key },
    tag: `report-${r.id}`,
  });
}

export async function notifyReportDecided(r: ReportRow, decision: "approved" | "returned", deciderId: string, note: string | null): Promise<void> {
  /* The request is settled for every reviewer, not only the one who acted. */
  await clearUnreadByMeta({ report_id: r.id, type: "report_approval_request" });
  await notifyLite({
    tenantId: r.tenant_id,
    recipients: [r.author_account_id],
    senderId: deciderId,
    tpl: decision === "approved"
      ? { k: "report_decided.approved", p: { title: titleOf(r) } }
      : { k: "report_decided.returned", p: { title: titleOf(r) } },
    body: note,
    link: `/reports/${r.id}`,
    type: "report_decided",
    metadata: { report_id: r.id, decision },
    tag: `report-decided-${r.id}`,
  });
}

export async function notifyReportComment(r: ReportRow, participantIds: string[], commenterId: string, commenterName: string, body: string): Promise<void> {
  await notifyLite({
    tenantId: r.tenant_id,
    recipients: participantIds,
    senderId: commenterId,
    tpl: { k: "report_comment", p: { actor: commenterName, title: titleOf(r) } },
    body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
    link: `/reports/${r.id}`,
    type: "report_comment",
    metadata: { report_id: r.id },
  });
}

/** The report is sent: every reminder, escalation and request that was waiting
 *  on it lets go of it — for the author, and for the manager who was told it
 *  was missing. Items are matched as nudges.ts / events.ts wrote them. */
export async function settleOwedReport(r: ReportRow): Promise<void> {
  if (!r.period_key) return;
  const owed = { key: r.template_key, period_key: r.period_key };
  const requestId = requestIdOf(r.period_key);
  await Promise.all([
    settleListedItems({ type: "report_reminder", listKey: "reminders", items: [owed], recipients: [r.author_account_id] }),
    settleListedItems({ type: "report_escalation", listKey: "escalations", items: [{ author: r.author_account_id, ...owed }] }),
    requestId
      ? settleListedItems({ type: "report_request", listKey: "requests", items: [requestId], recipients: [r.author_account_id] })
      : null,
    /* 5D: a draft the system prepared — its "ready to write" goes. */
    clearUnreadByMeta({ type: "report_scheduled", report_id: r.id }),
  ]);
}

/** The reader opened it — their own unread copies are done. */
export async function clearMyReportNotifications(reportId: string, accountId: string): Promise<void> {
  await supersedeUnread({ recipients: [accountId], meta: { report_id: reportId } });
}

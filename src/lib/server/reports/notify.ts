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
   --------------------------------------------------------------------------- */

import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta, supersedeUnread } from "@/lib/server/inbox-lifecycle";
import type { ReportRow } from "@/lib/server/reports/core";
import { reportTemplate } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";

/* Notifications are written once in English — the inbox row is data, and
   every reader's bell already shows it through the auto-translation the
   inbox uses for free text. The template name keeps its English form here. */
const nameOf = (key: string) => (reportsT[`tpl.${key}.name`]?.en as string | undefined) ?? "Report";
const titleOf = (r: ReportRow) => (r.title?.trim() ? r.title.trim() : nameOf(r.template_key));

export async function notifyReportSubmitted(r: ReportRow, recipientIds: string[], authorName: string): Promise<void> {
  const tpl = reportTemplate(r.template_key);
  const urgent = !!tpl?.urgent;
  await notifyLite({
    tenantId: r.tenant_id,
    recipients: recipientIds,
    senderId: r.author_account_id,
    subject: `${urgent ? "Urgent · " : ""}${titleOf(r)} — ${authorName}`,
    body: r.review_required ? "Waiting for your review." : null,
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
    subject: `${decision === "approved" ? "Approved" : "Returned"}: ${titleOf(r)}`,
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
    subject: `${commenterName} commented: ${titleOf(r)}`,
    body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
    link: `/reports/${r.id}`,
    type: "report_comment",
    metadata: { report_id: r.id },
  });
}

/** The reader opened it — their own unread copies are done. */
export async function clearMyReportNotifications(reportId: string, accountId: string): Promise<void> {
  await supersedeUnread({ recipients: [accountId], meta: { report_id: reportId } });
}

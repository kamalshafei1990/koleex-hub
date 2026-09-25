import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the records a report is linked to (Phase 4A, owner's
   pick 25 Sep 2026: "the report shows on that record's page").

   A report's links blocks name customers, suppliers, products and orders.
   work_report_links keeps them as rows so a record's page asks "which
   reports are about me?" in one indexed read; the sections stay the record,
   this table is their index, rewritten on save only when the links changed.

   What a record's page lists is the report's OWN read rule (reportAccess —
   author, recipients, the manager chain and a super admin for a
   non-confidential report; a draft only its author's): a link grants nothing.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { REPORT_LIST_COLS, listPeople, loadOrgTree } from "@/lib/server/reports/core";
import { reportAccess } from "@/lib/reports/access";
import type { ReportLink, ReportLinkType } from "@/lib/reports/templates";

const keyOf = (l: Pick<ReportLink, "type" | "id">) => `${l.type}|${l.id}`;

/** Rewrite a report's link rows — on a save only when the set changed
 *  (`before` = the links the report had); `before: null` always rewrites
 *  (sending, a new version), so a save that failed midway cannot leave a
 *  record's page short of a report. */
export async function syncReportLinks(reportId: string, tenantId: string | null, before: ReportLink[] | null, after: ReportLink[]): Promise<void> {
  const b = new Set(after.map(keyOf));
  if (before) {
    const a = new Set(before.map(keyOf));
    if (a.size === b.size && [...a].every((k) => b.has(k))) return;
  }
  const { error: dErr } = await supabaseServer.from("work_report_links").delete().eq("report_id", reportId);
  if (dErr) { console.error("[reports.links] clear:", dErr.message); return; }
  if (!after.length) return;
  const { error } = await supabaseServer.from("work_report_links").insert(after.map((l) => ({
    report_id: reportId, tenant_id: tenantId, entity_type: l.type, entity_id: l.id, label: l.label,
  })));
  if (error) console.error("[reports.links] write:", error.message);
}

export interface AboutRow {
  id: string; templateKey: string; title: string; authorName: string; periodStart: string | null; periodEnd: string | null;
  status: string; confidential: boolean; submittedAt: string | null; updatedAt: string;
}

type Row = { id: string; template_key: string; author_account_id: string; title: string; period_start: string | null; period_end: string | null; status: "draft" | "submitted" | "approved" | "returned"; confidential: boolean; superseded: boolean; submitted_at: string | null; updated_at: string };

/** The reports about one record that THIS viewer may read, newest first —
 *  the latest version of each; a draft only its author's. */
export async function listReportsAbout(auth: ServerAuthContext, type: ReportLinkType, entityId: string, limit = 20): Promise<AboutRow[]> {
  let lq = supabaseServer.from("work_report_links").select("report_id").eq("entity_type", type).eq("entity_id", entityId).limit(500);
  if (auth.tenant_id) lq = lq.eq("tenant_id", auth.tenant_id);
  const { data: links, error: lErr } = await lq;
  if (lErr) throw new Error(lErr.message);
  const ids = Array.from(new Set(((links ?? []) as Array<{ report_id: string }>).map((l) => l.report_id)));
  if (!ids.length) return [];
  let rq = supabaseServer.from("work_reports").select(REPORT_LIST_COLS).in("id", ids).eq("superseded", false);
  if (auth.tenant_id) rq = rq.eq("tenant_id", auth.tenant_id);
  const [{ data: rows, error }, { data: rcpt }, people] = await Promise.all([
    rq.order("updated_at", { ascending: false }).limit(200),
    supabaseServer.from("work_report_recipients").select("report_id, account_id").in("report_id", ids),
    listPeople(auth.tenant_id),
  ]);
  if (error) throw new Error(error.message);
  const recipientsOf = new Map<string, string[]>();
  for (const r of (rcpt ?? []) as Array<{ report_id: string; account_id: string }>) recipientsOf.set(r.report_id, [...(recipientsOf.get(r.report_id) ?? []), r.account_id]);
  const viewer = { accountId: auth.account_id, isSuperAdmin: !!auth.is_super_admin };
  const needsChain = ((rows ?? []) as Row[]).some((r) => r.status !== "draft" && !r.confidential);
  const tree = needsChain ? await loadOrgTree(auth.tenant_id) : null;
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return ((rows ?? []) as Row[])
    .filter((r) => reportAccess({
      status: r.status, confidential: r.confidential, authorAccountId: r.author_account_id,
      recipientIds: recipientsOf.get(r.id) ?? [], managerChain: tree && r.status !== "draft" && !r.confidential ? tree.chainOf(r.author_account_id) : [],
    }, viewer) !== null)
    .slice(0, limit)
    .map((r) => ({
      id: r.id, templateKey: r.template_key, title: r.title, authorName: nameOf.get(r.author_account_id) ?? "—",
      periodStart: r.period_start, periodEnd: r.period_end, status: r.status, confidential: r.confidential,
      submittedAt: r.submitted_at, updatedAt: r.updated_at,
    }));
}

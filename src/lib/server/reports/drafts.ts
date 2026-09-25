import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — starting a draft, in one place: the Write button
   (POST /api/work-reports) and the drafts the system prepares on schedule
   (5D, ./schedules.ts) write the same row with the same default readers, so
   a prepared draft is exactly the one the writer would have started.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { REPORT_LIMITS, normalizeSections, type ReportTemplateDef } from "@/lib/reports/templates";
import type { TemplateSnapshot } from "@/lib/reports/custom-templates";
import { defaultRecipients, superAdminIds } from "@/lib/server/reports/core";

export interface DraftPeriod { start: string; end: string; key: string }

/** The writer's report of that type for that period — the newest version,
 *  a draft or sent. One daily per day, one weekly per week, one monthly per
 *  month: this one opens instead of a second. */
export async function periodReport(auth: ServerAuthContext, templateKey: string, periodKey: string): Promise<{ id: string; status: string } | null> {
  let q = supabaseServer.from("work_reports").select("id, status").eq("author_account_id", auth.account_id)
    .eq("template_key", templateKey).eq("period_key", periodKey).eq("superseded", false).order("version", { ascending: false }).limit(1);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data } = await q.maybeSingle();
  return (data as { id: string; status: string } | null) ?? null;
}

/** A new draft addressed to the type's default readers — a builder type's
 *  with its copy of the type (4E). Null when it could not be written (said
 *  in the log). */
export async function insertDraft(
  auth: ServerAuthContext, tpl: ReportTemplateDef, period: DraftPeriod, title: string, sections: unknown, snapshot: TemplateSnapshot | null = null,
): Promise<string | null> {
  const { data: created, error } = await supabaseServer.from("work_reports").insert({
    tenant_id: auth.tenant_id, template_key: tpl.key, author_account_id: auth.account_id, title,
    period_start: period.start, period_end: period.end, period_key: period.key,
    sections: normalizeSections(tpl, sections), status: "draft",
    confidential: tpl.confidential, review_required: tpl.reviewRequired,
    template_snapshot: snapshot,
  }).select("id").single();
  if (error || !created) {
    console.error("[reports] new draft:", error?.message);
    return null;
  }
  const id = (created as { id: string }).id;
  const to = await defaultRecipients(tpl, auth).catch(async () => (await superAdminIds(auth.tenant_id)).filter((x) => x !== auth.account_id));
  if (to.length) {
    const { error: rErr } = await supabaseServer.from("work_report_recipients")
      .insert(to.slice(0, REPORT_LIMITS.recipients).map((account_id) => ({ report_id: id, account_id, role: "to" })));
    if (rErr) console.error("[reports] new draft recipients:", rErr.message);
  }
  return id;
}

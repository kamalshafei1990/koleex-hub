import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — starting a draft, in one place: the Write button
   (POST /api/work-reports), the drafts the system prepares on schedule
   (5D, ./schedules.ts) and Koleex AI's startReportDraft (6B) write the same
   row with the same default readers, so a prepared draft is exactly the one
   the writer would have started.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { REPORT_LIMITS, normalizeSections, periodFor, type ReportTemplateDef } from "@/lib/reports/templates";
import { isCustomKey, snapshotOf, type TemplateSnapshot } from "@/lib/reports/custom-templates";
import { reportTemplate } from "@/lib/reports/catalog";
import { canStartTemplate, defaultRecipients, superAdminIds } from "@/lib/server/reports/core";
import { customAsTemplate, loadCustomTemplate, loadHiddenKeys } from "@/lib/server/reports/custom-templates";

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

export type PlanOutcome =
  | { tpl: ReportTemplateDef; snapshot: TemplateSnapshot | null; period: DraftPeriod; existing: { id: string; status: string } | null }
  | "unknown_template" | "request_only" | "forbidden" | "hidden";

export type StartOutcome =
  | { id: string; existing: boolean; tpl: ReportTemplateDef; period: DraftPeriod }
  | "unknown_template" | "request_only" | "forbidden" | "hidden" | "failed";

/** A type by its key — a built-in, or a builder type's current version
 *  (active only, the tenant's own) with its copy. */
export async function draftType(tenantId: string | null, key: unknown): Promise<{ tpl: ReportTemplateDef; snapshot: TemplateSnapshot | null } | null> {
  if (isCustomKey(key)) {
    const row = await loadCustomTemplate(tenantId, key).catch(() => null);
    if (!row || row.status !== "active") return null;
    return { tpl: customAsTemplate(row), snapshot: snapshotOf(row.def, row.words, row.version) };
  }
  const tpl = typeof key === "string" ? reportTemplate(key) : null;
  return tpl ? { tpl, snapshot: null } : null;
}

/** The Write button's rules, WITHOUT writing: a type this person may start
 *  and the company did not hide, never one only an event asks for; the
 *  period the day falls in; and the report they already have for it (the
 *  day's, the week's or the month's opens instead of a second). Koleex AI
 *  previews with this; startReportDraft writes with it. */
export async function planReportDraft(auth: ServerAuthContext, o: { templateKey: unknown; date: string }): Promise<PlanOutcome> {
  const found = await draftType(auth.tenant_id, o.templateKey);
  if (!found) return "unknown_template";
  const { tpl, snapshot } = found;
  if (tpl.requestOnly) return "request_only";
  const [allowed, hidden] = await Promise.all([
    canStartTemplate(tpl, auth),
    tpl.custom ? Promise.resolve([] as string[]) : loadHiddenKeys(auth.tenant_id).catch(() => [] as string[]),
  ]);
  if (!allowed) return "forbidden";
  if (hidden.includes(tpl.key)) return "hidden";
  const p = periodFor(tpl.cadence, o.date);
  const period: DraftPeriod = { start: p.start, end: p.end, key: tpl.cadence ? p.key : p.start };
  const existing = tpl.cadence ? await periodReport(auth, tpl.key, period.key) : null;
  return { tpl, snapshot, period, existing };
}

/** Start the writer's report of a type for the period a day falls in (the
 *  Write button, Koleex AI's confirmed startReportDraft). */
export async function startReportDraft(auth: ServerAuthContext, o: { templateKey: unknown; date: string; title?: unknown }): Promise<StartOutcome> {
  const plan = await planReportDraft(auth, o);
  if (typeof plan === "string") return plan;
  const { tpl, snapshot, period } = plan;
  if (plan.existing) return { id: plan.existing.id, existing: true, tpl, period };
  const title = tpl.customTitle && typeof o.title === "string" ? o.title.trim().slice(0, REPORT_LIMITS.title) : "";
  const id = await insertDraft(auth, tpl, period, title, [], snapshot);
  return id ? { id, existing: false, tpl, period } : "failed";
}

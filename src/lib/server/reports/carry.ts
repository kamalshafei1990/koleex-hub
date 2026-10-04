import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the earlier reports a draft can carry items from
   (Phase 2A). ONE read: the author's own latest versions of the source
   types, starting in the range the rules need; the rules themselves and the
   grouping are the pure src/lib/reports/carry.ts.

   Only ever the VIEWER's own reports — the callers already made sure the
   viewer is the author of a draft, and this read is scoped to the viewer
   again, so a mistake upstream still cannot show anyone else's text.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { buildCarry, carryQueryRange, type CarryGroup, type CarrySource } from "@/lib/reports/carry";
import { reportTemplate } from "@/lib/reports/catalog";
import { periodFor, type ReportPeriod } from "@/lib/reports/templates";
import { templateOf } from "@/lib/reports/custom-templates";

type DraftFacts = { id: string; template_key: string; template_snapshot?: unknown; period_start: string | null; period_end: string | null; period_key: string | null };

/** Suggestions for a draft, for its saved period — or for `date` when the
 *  author is moving it to another day, week or month. */
export async function loadCarry(row: DraftFacts, auth: ServerAuthContext, date?: string | null): Promise<CarryGroup[]> {
  const tpl = templateOf(row);
  if (!tpl) return [];
  let period: ReportPeriod | null = null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) period = periodFor(tpl.cadence, date);
  else if (row.period_start) period = { start: row.period_start, end: row.period_end ?? row.period_start, key: row.period_key ?? row.period_start };
  if (!period) return [];
  const range = carryQueryRange(tpl, period);
  if (!range) return [];

  let q = supabaseServer.from("work_reports")
    .select("id, template_key, period_start, period_end, period_key, sections, superseded, version")
    .eq("author_account_id", auth.account_id).eq("superseded", false)
    .in("template_key", range.templates).gte("period_start", range.from).lte("period_start", range.to)
    .neq("id", row.id).order("period_start", { ascending: false }).limit(80);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) { console.error("[reports] carry:", error.message); return []; }
  return buildCarry(tpl, period, (data ?? []) as CarrySource[], { id: row.id, periodKey: period.key }, reportTemplate);
}

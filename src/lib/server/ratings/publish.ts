import "server-only";

/* ---------------------------------------------------------------------------
   ratings/publish — the monthly rating as a Reports-app document.

   On FINALIZE (plan §F.2): one work_report per employee, written by the
   server from rating_summaries + the cycle's items — never by hand. The
   report is `submitted` and confidential from birth: nobody edits it, and
   the employee meets it only when the cycle publishes.

   Readers: the employee's own account (to), plus the cycle's actor (cc) so
   whoever ran the cycle can read what they ran. HR/CEO read every report
   through the Reports app's HR permission, as with every HR type.

   On PUBLISH: every recipient gets one inbox+push notification and the
   report enters their list. A re-publish (reopen → finalize → publish) does
   NOT duplicate reports — generation is keyed by (cycle, employee).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import type { ServerAuthContext } from "@/lib/server/auth";

const TEMPLATE = "hr_monthly_rating";

type SummaryRow = {
  employee_id: string; skills_avg: number | null; behavior_avg: number | null;
  overall: number | null; band: string | null; partial: boolean;
  delta_overall: number | null; delta_skills: number | null; delta_behavior: number | null;
};
type ItemRow = {
  employee_id: string; item_kind: "skill" | "behavior"; ref_id: string;
  required_score: number | null; score: number | null; weight: number;
  is_mandatory: boolean;
};

function fmt(n: number | null): string { return n === null ? "—" : String(Math.round(n)); }
function delta(n: number | null): string {
  if (n === null) return "";
  const r = Math.round(n);
  return r === 0 ? " ±0" : r > 0 ? ` ↑${r}` : ` ↓${Math.abs(r)}`;
}

export async function generateRatingReports(
  cycle: { id: string; tenant_id: string; month: string },
  auth: Pick<ServerAuthContext, "account_id" | "tenant_id">,
): Promise<{ created: number }> {
  /* Already generated for this cycle? Generation is keyed by it. */
  const { data: existing } = await supabaseServer
    .from("work_reports").select("id")
    .eq("tenant_id", cycle.tenant_id).eq("template_key", TEMPLATE)
    .eq("period_key", cycle.month.slice(0, 7))
    .limit(1);
  if (existing && existing.length > 0) return { created: 0 };

  const [{ data: summaries }, { data: items }] = await Promise.all([
    supabaseServer.from("rating_summaries").select("*").eq("cycle_id", cycle.id),
    supabaseServer.from("rating_items")
      .select("employee_id, item_kind, ref_id, required_score, score, weight, is_mandatory")
      .eq("cycle_id", cycle.id),
  ]);
  const sums = (summaries ?? []) as SummaryRow[];
  if (sums.length === 0) return { created: 0 };
  const rows = (items ?? []) as ItemRow[];

  /* names for the lists — two batched lookups, same discipline as the sheet */
  const skillRefs = [...new Set(rows.filter((i) => i.item_kind === "skill").map((i) => i.ref_id))];
  const behaviorRefs = [...new Set(rows.filter((i) => i.item_kind === "behavior").map((i) => i.ref_id))];
  const [{ data: skillRows }, { data: behaviorRows }, { data: empRows }] = await Promise.all([
    skillRefs.length ? supabaseServer.from("skills").select("id, name").in("id", skillRefs) : Promise.resolve({ data: [] }),
    behaviorRefs.length ? supabaseServer.from("behavior_indicators").select("id, name").in("id", behaviorRefs) : Promise.resolve({ data: [] }),
    supabaseServer.from("koleex_employees").select("id, account_id, person_id").in("id", sums.map((s) => s.employee_id)),
  ]);
  const nameOf = new Map<string, string>();
  for (const r of skillRows ?? []) nameOf.set(r.id, r.name);
  for (const r of behaviorRows ?? []) nameOf.set(r.id, r.name);
  const accountOf = new Map((empRows ?? []).map((e) => [e.id, e.account_id as string | null]));

  const monthLabel = cycle.month.slice(0, 7);
  const monthStart = cycle.month;
  const monthEnd = new Date(new Date(cycle.month).getFullYear(), new Date(cycle.month).getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  let created = 0;
  for (const s of sums) {
    const its = rows.filter((i) => i.employee_id === s.employee_id);
    const line = (i: ItemRow) =>
      `${nameOf.get(i.ref_id) ?? "?"} — ${fmt(i.score)}${i.required_score !== null ? ` (required ${i.required_score})` : ""}`;
    const skills = its.filter((i) => i.item_kind === "skill").map(line);
    const behavior = its.filter((i) => i.item_kind === "behavior").map(line);
    /* the improvement list is deterministic until Phase 5's coaching engine:
       every item below its required score, weakest first */
    const actions = its
      .filter((i) => i.required_score !== null && i.score !== null && i.score < i.required_score)
      .sort((a, b) => (a.score! - a.required_score!) - (b.score! - b.required_score!))
      .map((i) => `${nameOf.get(i.ref_id) ?? "?"} — ${fmt(i.score)} vs required ${i.required_score}`);

    const summary =
      `Overall ${fmt(s.overall)}${s.band ? ` — ${s.band.replace(/_/g, " ")}` : ""}` +
      `${s.delta_overall !== null ? ` (${delta(s.delta_overall).trim()} vs last month)` : ""}. ` +
      `Skills ${fmt(s.skills_avg)}${delta(s.delta_skills)} · Behavior ${fmt(s.behavior_avg)}${delta(s.delta_behavior)}.` +
      (s.partial ? " Partial month (joined or moved mid-cycle)." : "");

    const { data: report, error } = await supabaseServer
      .from("work_reports")
      .insert({
        tenant_id: cycle.tenant_id,
        template_key: TEMPLATE,
        author_account_id: auth.account_id,
        title: `Monthly rating ${monthLabel}`,
        period_start: monthStart,
        period_end: monthEnd,
        period_key: monthLabel,
        sections: [
          { id: "summary", text: summary },
          ...(skills.length ? [{ id: "skills", items: skills }] : []),
          ...(behavior.length ? [{ id: "behavior", items: behavior }] : []),
          ...(actions.length ? [{ id: "actions", items: actions }] : []),
        ],
        status: "submitted",
        confidential: true,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !report) continue;
    created += 1;

    const recipientAccount = accountOf.get(s.employee_id);
    const recipients = [
      ...(recipientAccount ? [{ report_id: report.id, account_id: recipientAccount, role: "to" as const }] : []),
      ...(recipientAccount !== auth.account_id ? [{ report_id: report.id, account_id: auth.account_id, role: "cc" as const }] : []),
    ];
    if (recipients.length > 0) {
      await supabaseServer.from("work_report_recipients").insert(recipients);
    }
  }
  return { created };
}

/** One notification per recipient when the cycle publishes. */
export async function notifyRatingPublished(
  cycle: { id: string; tenant_id: string; month: string },
): Promise<void> {
  const monthLabel = cycle.month.slice(0, 7);
  const { data: reports } = await supabaseServer
    .from("work_reports").select("id")
    .eq("tenant_id", cycle.tenant_id).eq("template_key", TEMPLATE)
    .eq("period_key", monthLabel);
  const ids = (reports ?? []).map((r) => r.id);
  if (ids.length === 0) return;

  const { data: recipients } = await supabaseServer
    .from("work_report_recipients").select("account_id, report_id")
    .in("report_id", ids).eq("role", "to");
  for (const r of recipients ?? []) {
    await notifyLite({
      tenantId: cycle.tenant_id,
      recipients: [r.account_id],
      type: "report_rating_published",
      subject: `Your monthly rating for ${monthLabel} is ready`,
      body: "Open Reports to read your rating, your deltas and what to improve next month.",
      link: `/reports/${r.report_id}`,
      supersede: { report_id: r.report_id },
    });
  }
}

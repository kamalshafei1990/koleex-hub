import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the summaries Koleex AI writes from what OTHER people
   sent: the team's (5A team summary, 6E weekly team summary) or the whole
   company's (5D executive summary and monthly review). One place builds the
   prompt, so the "Write it" button and the drafts the system prepares on
   schedule read the same reports the same way.

   The reports and the numbers go in FENCED (teamInstruction /
   execInstruction) — other people's words are data, never instructions — and
   every prompt carries AI_PROVENANCE_RULE. Nothing here writes anything; the
   callers decide what the text becomes. Nothing of a report is logged —
   counts, lengths and timings only.
   --------------------------------------------------------------------------- */

import type { ServerAuthContext } from "@/lib/server/auth";
import { chatWithTools } from "@/lib/server/ai/provider/registry";
import { meterTurn } from "@/lib/server/ai/cost/meter";
import { newFenceId } from "@/lib/server/ai/security/untrusted";
import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { companyMaterial, dropEchoedTitle, teamReadShape, toSection } from "@/lib/reports/ai-draft";
import { rangeLabel, teamFactsText } from "@/lib/reports/team";
import { behaviourKey, type ReportTemplateDef } from "@/lib/reports/templates";
import { EXEC_SYSTEM, TEAM_SYSTEM, execInstruction, loadTeamMaterial, teamInstruction, type TeamLang } from "@/lib/server/reports/team";

export interface SummaryPrompt { system: string; user: string; maxTokens: number; reports: number }

/** The prompt for a summary of what the team (or, for the executive types,
 *  the company) SENT between `from` and `to` — null when nothing was sent,
 *  so no model is ever asked about nothing. The weekly team summary reads in
 *  the Team tab's shape; the others are one section's paragraphs. */
export async function serverSummaryPrompt(auth: ServerAuthContext, tpl: ReportTemplateDef, from: string, to: string, lang: TeamLang, fence: string): Promise<SummaryPrompt | null> {
  const company = companyMaterial(tpl);
  const team = await loadTeamMaterial(auth, from, to, company);
  if (!team.included) return null;
  const facts = teamFactsText(team.facts.people, team.facts.tracking);
  const period = rangeLabel(from, to);
  const people = team.facts.people.length;
  if (company) {
    return { system: EXEC_SYSTEM + AI_PROVENANCE_RULE, user: execInstruction({ monthly: behaviourKey(tpl) === "exec_monthly_review", lang, period, people, material: team.text, facts, fence }), maxTokens: 900, reports: team.included };
  }
  const read = teamReadShape(tpl);
  return {
    system: TEAM_SYSTEM + AI_PROVENANCE_RULE,
    user: teamInstruction({ kind: read ? "read" : "section", lang, period, people, material: team.text, facts, fence }),
    maxTokens: read ? 1600 : 900,
    reports: team.included,
  };
}

/** 6E: the summary a draft prepared on schedule starts with — Koleex AI's
 *  text for the period, in the writer's language. `text` is null when there
 *  is nothing to say it with (nothing was sent: `reports` 0) or when the
 *  answer came back cut, empty or not within `budgetMs` — the draft is
 *  prepared anyway, and its "Write it" button is still there. `names` are
 *  the summary section's names in every language: an answer that opens with
 *  one as a heading loses that line. */
export async function writeScheduledSummary(
  auth: ServerAuthContext, tpl: ReportTemplateDef, period: { start: string; end: string }, lang: TeamLang, budgetMs: number, names: string[],
): Promise<{ text: string | null; reports: number }> {
  const prompt = await serverSummaryPrompt(auth, tpl, period.start, period.end, lang, newFenceId());
  if (!prompt) return { text: null, reports: 0 };
  const started = Date.now();
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, budgetMs)));
  const out = await Promise.race([
    chatWithTools({
      messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
      maxTokens: prompt.maxTokens,
      temperature: 0.2,
      modelClass: "GENERAL",
    }),
    deadline,
  ]);
  const ms = Date.now() - started;
  if (!out) {
    console.error(`[reports.schedule] summary key=${tpl.key} outcome=deadline reports=${prompt.reports} ms=${ms}`);
    return { text: null, reports: prompt.reports };
  }
  meterTurn(out, { tenantId: auth.tenant_id ?? null, accountId: auth.account_id, lane: "report-ai", traceId: null });
  /* A thinking model may put its reasoning in the answer; it is never text. */
  const answer = out.ok ? (out.response.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim() : "";
  /* A cut-off answer is refused, not kept: half a summary reads as whole. */
  const cut = out.ok && out.response.finishReason === "length";
  if (!out.ok || !answer || cut) {
    console.error(`[reports.schedule] summary key=${tpl.key} outcome=${!out.ok ? `status_${out.status}` : cut ? "length" : "empty"} reports=${prompt.reports} ms=${ms}`);
    return { text: null, reports: prompt.reports };
  }
  const text = toSection(dropEchoedTitle(answer, names), "text");
  console.warn(`[reports.schedule] summary key=${tpl.key} lang=${lang} reports=${prompt.reports} out=${text.length} ms=${ms}`);
  return { text: text || null, reports: prompt.reports };
}

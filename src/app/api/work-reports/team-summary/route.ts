import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/team-summary — the team summary (Phase 5A, owner's
   pick: "read + send up"). Body: { from, to, lang } — at most
   TEAM_LIMITS.rangeDays days.

   Koleex AI reads what the viewer's team SENT in those days (everyone under
   them at every level; a super admin, everyone — never a draft, never a
   confidential report) beside the team's numbers (reports owed and sent,
   attendance days, open and finished work), and answers a summary in the
   viewer's language. Nothing is stored: the Team tab shows it, and the
   manager may turn it into a "Team summary" report to send up.

   Answers { text, reports, total, truncated, people, facts, tracking } —
   with no report in those days, no model is asked: text is empty and the
   numbers still come. THE CHAIN: signed in, staff, a team, the days
   checked, then a budget (TEAM_LIMITS.perHour an hour). The prompt carries
   AI_PROVENANCE_RULE word for word; the reports and the numbers go in
   FENCED — other people's words are data, never instructions. Only
   { text … } or { error } leaves; nothing of a report is logged — counts,
   timings and outcomes only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { chatWithTools } from "@/lib/server/ai/provider/registry";
import { meterTurn } from "@/lib/server/ai/cost/meter";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { newFenceId } from "@/lib/server/ai/security/untrusted";
import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { TEAM_LIMITS, rangeLabel, teamFactsText, teamRange } from "@/lib/reports/team";
import { TEAM_SYSTEM, loadTeamMaterial, teamInstruction, type TeamLang } from "@/lib/server/reports/team";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Our own deadline, under the platform's: a killed function answers a bare
 *  504; this answers in words. */
const DEADLINE_MS = 50_000;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { from?: unknown; to?: unknown; lang?: unknown } | null;
  const range = teamRange(body?.from, body?.to);
  if (!range) return NextResponse.json({ error: "bad_range" }, { status: 400 });
  const lang: TeamLang = body?.lang === "zh" || body?.lang === "ar" ? body.lang : "en";

  let team;
  try {
    team = await loadTeamMaterial(auth, range.from, range.to);
  } catch (e) {
    console.error("[reports.team] load:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  if (!team.scope.owners.length) return NextResponse.json({ error: "no_team" }, { status: 403 });
  const base = { reports: team.included, total: team.total, truncated: team.truncated, people: team.facts.people.length, facts: team.facts.people, tracking: team.facts.tracking };
  /* Nothing sent in those days: no model is asked — the numbers still come. */
  if (!team.included) return NextResponse.json({ text: "", ...base }, { headers: { "Cache-Control": "private, no-store" } });

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), { bucket: "report_team_ai", windowSec: 3600, max: TEAM_LIMITS.perHour });
    if (!hit.allowed) {
      console.warn(`[reports.team] ratelimit count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json({ error: "busy" }, { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } });
      }
    }
  }

  const fence = newFenceId();
  const instruction = teamInstruction({
    kind: "read", lang, period: rangeLabel(range.from, range.to), people: team.facts.people.length,
    material: team.text, facts: teamFactsText(team.facts.people, team.facts.tracking), fence,
  });
  const started = Date.now();
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE_MS));
  const out = await Promise.race([
    chatWithTools({
      messages: [{ role: "system", content: TEAM_SYSTEM + AI_PROVENANCE_RULE }, { role: "user", content: instruction }],
      maxTokens: 1600,
      temperature: 0.2,
      modelClass: "GENERAL",
    }),
    deadline,
  ]);
  const ms = Date.now() - started;
  if (!out) {
    console.error(`[reports.team] outcome=deadline reports=${team.included} ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 504 });
  }
  meterTurn(out, { tenantId: auth.tenant_id ?? null, accountId: auth.account_id, lane: "report-team-ai", traceId: null });
  /* A thinking model may put its reasoning in the answer; it is never text. */
  const answer = out.ok ? (out.response.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim() : "";
  /* A cut-off answer is refused, not shown: half a summary reads as whole. */
  const cut = out.ok && out.response.finishReason === "length";
  if (!out.ok || !answer || cut) {
    console.error(`[reports.team] outcome=${!out.ok ? `status_${out.status}` : cut ? "length" : "empty"} reports=${team.included} ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
  console.warn(`[reports.team] lang=${lang} people=${base.people} reports=${team.included}/${team.total} in=${team.text.length} out=${answer.length} ms=${ms}`);
  return NextResponse.json({ text: answer.slice(0, 12_000), ...base }, { headers: { "Cache-Control": "private, no-store" } });
}

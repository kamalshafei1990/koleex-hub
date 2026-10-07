import "server-only";

/* ---------------------------------------------------------------------------
   ratings/coaching — Phase 5: the AI improvement suggestions.

   Runs right after the reports are born at finalize, best-effort: for every
   employee with items below their required score, one aiChat call turns the
   gap list into concrete, coach-toned suggestions, and the report's
   "actions" section is rewritten with them. If the model is unreachable or
   answers nothing usable, the deterministic gap list stays — a finalize
   NEVER fails because a provider hiccuped (owner's speed rule).

   The prompt is the guardrail (validate:ratings pins it): name the skill,
   never the person's worth; one action per suggestion; no comparison to
   colleagues; no numeric promises; no invented training courses.
   --------------------------------------------------------------------------- */

import { aiChat } from "@/lib/server/ai-provider";
import { supabaseServer } from "@/lib/server/supabase-server";

const TEMPLATE = "hr_monthly_rating";
const MAX_SUGGESTIONS = 3;

const COACH_SYSTEM = `You are a supportive performance coach inside Koleex Hub, writing improvement suggestions for an employee's monthly rating report.

Rules that may never break:
- Name the skill or behavior, never the person's character or worth.
- One concrete action per suggestion — something they can do next week.
- Never compare them to colleagues or averages.
- Never promise numbers ("will raise your score to 80").
- Never invent courses, links or programs.
- Warm, direct, professional tone. 1-2 short sentences per suggestion.
- Reply with ONLY the suggestions, one per line, no bullets markers, no numbering.`;

export async function generateCoaching(
  cycle: { id: string; tenant_id: string; month: string },
): Promise<{ coached: number }> {
  /* the reports this finalize just wrote */
  const monthLabel = cycle.month.slice(0, 7);
  const { data: reports } = await supabaseServer
    .from("work_reports").select("id, sections")
    .eq("tenant_id", cycle.tenant_id).eq("template_key", TEMPLATE)
    .eq("period_key", monthLabel);
  const list = (reports ?? []) as Array<{ id: string; sections: Array<{ id: string; items?: string[] }> }>;
  if (list.length === 0) return { coached: 0 };

  let coached = 0;
  for (const report of list) {
    const actions = report.sections.find((s) => s.id === "actions");
    const gaps = actions?.items ?? [];
    if (gaps.length === 0) continue; // a clean month keeps its "keep going" silence

    const summary = report.sections.find((s) => s.id === "summary") as { id: string; text?: string } | undefined;
    const userMsg =
      `Monthly rating summary: ${typeof summary?.text === "string" ? summary.text : ""}\n` +
      `Items below their required score (weakest first):\n${gaps.slice(0, 5).map((g) => `- ${g}`).join("\n")}\n\n` +
      `Write up to ${MAX_SUGGESTIONS} suggestions.`;

    try {
      const res = await aiChat(
        [
          { role: "system", content: COACH_SYSTEM },
          { role: "user", content: userMsg },
        ],
        { maxTokens: 400 },
      );
      if (!res?.reply) continue;

      const suggestions = res.reply
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter((l) => l.length > 12 && l.length < 400)
        .slice(0, MAX_SUGGESTIONS);
      if (suggestions.length === 0) continue;

      const sections = [
        ...report.sections.filter((s) => s.id !== "actions"),
        { id: "actions", items: suggestions },
      ];
      const { error } = await supabaseServer
        .from("work_reports")
        .update({ sections, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      if (!error) coached += 1;
    } catch {
      /* best-effort by design — the deterministic list stays */
    }
  }
  return { coached };
}

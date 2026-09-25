import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/ai — Koleex AI on one section of a DRAFT
   (Phase 2D). Body: AiDraftRequest (src/lib/reports/ai-draft.ts).
     write  the weekly / monthly summary, from the material the composer
            already shows the author (their earlier reports, their own work
            in the apps, what the report says)
     tidy   the author's own words, said clearly, in their language
   Answers { text } — a PROPOSAL. Nothing is written anywhere: the composer
   shows it and the author chooses (fill, never save).

   THE CHAIN, in order: signed in (a view-as session cannot post), staff,
   the author of a draft (the report's usual 404 otherwise), the request
   checked against the template BEFORE any model is asked, then a budget
   (40 an hour per author).

   The prompt carries AI_PROVENANCE_RULE word for word (standing rule: the
   assistant is Koleex AI, never the model or its maker), keeps every name,
   number and code as written, and adds nothing. The material holds other
   people's words (calendar titles, customer names), so it goes in FENCED —
   data, never instructions. Only { text } or { error } leaves: never the
   model, the provider or its error text. Nothing of the report is logged —
   lengths, timings and outcomes only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { chatWithTools } from "@/lib/server/ai/provider/registry";
import { meterTurn } from "@/lib/server/ai/cost/meter";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { fenceUntrusted, newFenceId } from "@/lib/server/ai/security/untrusted";
import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { AI_LIMITS, checkAiRequest, toSection, type AiDraftRequest, type WritingLang } from "@/lib/reports/ai-draft";
import { reportTemplate } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Our own deadline, under the platform's: a killed function answers a bare
 *  504 the composer can only call "failed"; this answers in words. */
const DEADLINE_MS = 50_000;

const LANG_NAME: Record<WritingLang, string> = {
  en: "English",
  zh: "Simplified Chinese",
  ar: "Arabic — in the author's own register (Egyptian colloquial if that is how they write, formal Arabic if not)",
};

const SYSTEM =
  "You help a Koleex employee write their own internal work report, which they send to their manager." +
  " Use ONLY the facts in what you are given. Never invent numbers, names, dates, customers, results or plans." +
  " Keep every name, number, code (quotation, invoice and order numbers), date and amount exactly as written." +
  " The report is internal: customer and supplier names in it are the employee's own work records — keep them." +
  " Write plainly, as the employee would write to their manager: no greeting, no sign-off, no headings, no Markdown, no emojis." +
  " If the material is thin, say less; never pad." +
  AI_PROVENANCE_RULE;

const en = (key: string) => reportsT[key]?.en ?? key;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { row } = loaded;
  if (row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });

  const body = (await req.json().catch(() => null)) as Partial<AiDraftRequest> | null;
  const problem = checkAiRequest(row.template_key, body ?? {});
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const ask = body as AiDraftRequest;
  const tpl = reportTemplate(row.template_key)!;
  const kind = tpl.sections.find((s) => s.id === ask.section)!.kind;

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), { bucket: "report_ai", windowSec: 3600, max: AI_LIMITS.perHour });
    if (!hit.allowed) {
      console.warn(`[reports.ai] ratelimit count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json({ error: "busy" }, { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } });
      }
    }
  }

  const fence = newFenceId();
  const section = en(`tpl.${tpl.key}.s.${ask.section}`);
  const type = en(`tpl.${tpl.key}.name`);
  const period = row.period_start && row.period_end && row.period_start !== row.period_end ? `${row.period_start} to ${row.period_end}` : (row.period_start ?? "");
  const shape = kind === "list"
    ? "Answer as a list: one item per line, no bullets, no numbers."
    : "Answer as plain paragraphs.";
  let instruction: string;
  let maxTokens: number;
  if (ask.action === "write") {
    const length = tpl.key === "monthly" ? "6 to 12 sentences (at most about 300 words)" : "4 to 8 sentences (at most about 180 words)";
    instruction =
      `Write the "${section}" section of the employee's ${type}${period ? `, covering ${period}` : ""}.` +
      ` Language: ${LANG_NAME[ask.lang]}. Length: ${length}.` +
      " Summarise for the manager: what was achieved, what moved forward, what is still open, and anything that needs their attention." +
      " Group related items; do not list every line." +
      ` ${shape} Answer with the section text only.` +
      fenceUntrusted(ask.material ?? "", "document", "The employee's report material: their earlier reports and their records in Koleex Hub", fence);
    maxTokens = 900;
  } else {
    instruction =
      `Rewrite this "${section}" section of the employee's ${type} so it reads clearly.` +
      ` Language: ${LANG_NAME[ask.lang]} — the same language as the text.` +
      " Keep exactly the same facts and meaning. Fix grammar, spelling, punctuation and order; remove repetition and the filler words of dictation." +
      " Add nothing and drop no fact." +
      ` ${shape} Answer with the rewritten section only.` +
      fenceUntrusted(ask.text ?? "", "document", "The employee's own section text", fence);
    maxTokens = Math.min(3000, Math.max(400, Math.ceil((ask.text ?? "").length * 1.6)));
  }

  const started = Date.now();
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE_MS));
  const out = await Promise.race([
    chatWithTools({
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: instruction }],
      maxTokens,
      temperature: 0.2,
      modelClass: "GENERAL",
    }),
    deadline,
  ]);
  const ms = Date.now() - started;
  if (!out) {
    console.error(`[reports.ai] action=${ask.action} section=${ask.section} outcome=deadline ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 504 });
  }
  meterTurn(out, { tenantId: auth.tenant_id ?? null, accountId: auth.account_id, lane: "report-ai", traceId: null });
  /* A thinking model may put its reasoning in the answer; it is never text. */
  const answer = out.ok ? (out.response.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim() : "";
  /* A cut-off answer is refused, not pasted: half a summary reads as whole. */
  const cut = out.ok && out.response.finishReason === "length";
  if (!out.ok || !answer || cut) {
    console.error(`[reports.ai] action=${ask.action} section=${ask.section} outcome=${!out.ok ? `status_${out.status}` : cut ? "length" : "empty"} ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
  const text = toSection(answer, kind);
  console.warn(`[reports.ai] action=${ask.action} section=${ask.section} lang=${ask.lang} in=${(ask.material ?? ask.text ?? "").length} out=${text.length} ms=${ms}`);
  return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
}

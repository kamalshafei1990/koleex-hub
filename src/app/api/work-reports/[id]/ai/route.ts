import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/work-reports/[id]/ai — Koleex AI on one section of a DRAFT
   (Phase 2D). Body: AiDraftRequest (src/lib/reports/ai-draft.ts).
     write  the weekly / monthly / quarterly / half-year / annual summary, from the material the composer
            already shows the author (their earlier reports, their own work
            in the apps, what the report says) — and (27/09/2026) the daily's
            and the weekly plan's lists, each told what belongs in it
            (WRITE_GUIDE); "NONE" from the model = nothing belongs → no_facts
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
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { chatWithTools } from "@/lib/server/ai/provider/registry";
import { meterTurn } from "@/lib/server/ai/cost/meter";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { fenceUntrusted, newFenceId } from "@/lib/server/ai/security/untrusted";
import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { AI_LIMITS, WRITE_LIST_MAX, checkAiRequest, companyMaterial, dropEchoedTitle, serverMaterial, toSection, writeGuide, type AiDraftRequest, type WritingLang } from "@/lib/reports/ai-draft";
import { rangeLabel, teamRange } from "@/lib/reports/team";
import { serverSummaryPrompt, type SummaryPrompt } from "@/lib/server/reports/summary-writer";
import { MGMT_MODULE } from "@/lib/reports/report-data";
import { behaviourKey } from "@/lib/reports/templates";
import { readSnapshot, templateOf, templateWords } from "@/lib/reports/custom-templates";
import { reportsT } from "@/lib/translations/reports";
import { REPORT_SECTION_WORDS } from "@/lib/translations/report-sections/all";

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

/* A section's name lives with its family's words (Phase 4C); the server has
   them all — a builder type's (4E) travel with its report. */
const enOf = (own: Record<string, { en: string }> | null) => (key: string) => (own?.[key] ?? reportsT[key] ?? REPORT_SECTION_WORDS[key])?.en ?? key;

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
  const tpl = templateOf(row);
  const problem = checkAiRequest(tpl, body ?? {});
  if (problem || !tpl) return NextResponse.json({ error: problem ?? "unknown_template" }, { status: 400 });
  const ask = body as AiDraftRequest;
  const kind = tpl.sections.find((s) => s.id === ask.section)!.kind;
  const snap = tpl.custom ? readSnapshot(row.template_snapshot) : null;
  const en = enOf(snap ? templateWords(tpl.key, snap.words) : null);

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
  let teamPrompt: SummaryPrompt | null = null;
  /* A team summary (5A, 6E's weekly one) is written from what the team SENT
     in the report's days — the server reads it (the same prompt the drafts
     prepared on schedule start from); the page sends no material. */
  if (ask.action === "write" && serverMaterial(tpl)) {
    const range = teamRange(row.period_start, row.period_end ?? row.period_start);
    if (!range) return NextResponse.json({ error: "no_material" }, { status: 400 });
    /* 5D: the company's reports — only with «Management Reports» (asked
       again here: a right taken away since the report was started). */
    const company = companyMaterial(tpl);
    if (company && !auth.is_super_admin && (await requireModuleAccess(auth, MGMT_MODULE)) !== null) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    try { teamPrompt = await serverSummaryPrompt(auth, tpl, range.from, range.to, ask.lang, fence); }
    catch (e) { console.error("[reports.ai] team:", e instanceof Error ? e.message : e); return NextResponse.json({ error: "failed" }, { status: 500 }); }
    if (!teamPrompt) return NextResponse.json({ error: "no_material" }, { status: 400 });
  }
  const section = en(`tpl.${tpl.key}.s.${ask.section}`);
  const type = en(`tpl.${tpl.key}.name`);
  /* Day first (the Hub's D/M/Y rule): the model writes dates the way it is
     told them — "2025-01-01 to 2025-03-31" came back in the first quarterly. */
  const period = row.period_start ? rangeLabel(row.period_start, row.period_end ?? row.period_start) : "";
  const shape = kind === "list"
    ? "Answer as a list: one item per line, no bullets, no numbers."
    : "Answer as plain paragraphs.";
  let instruction: string;
  let maxTokens: number;
  /* A list the daily or the weekly plan holds: told what belongs in it. */
  const guide = ask.action === "write" && kind === "list" ? writeGuide(tpl, ask.section) : null;
  if (guide) {
    instruction =
      `Write the "${section}" section of the employee's ${type}${period ? `, covering ${period}` : ""}: ${guide}` +
      ` Language: ${LANG_NAME[ask.lang]}. At most ${WRITE_LIST_MAX} items.` +
      " Each item is one short line in the employee's own voice, as they would write it to their manager; items that are the same thing become one." +
      " What the report's other sections already say is context: do not repeat their items here." +
      " Never add a day, date or time the material does not give; write a day exactly as the material writes it (e.g. 15/01), never as a weekday name." +
      " The brackets after an item say where it came from and when: use that day or time where the item needs one, but never copy the brackets or the app's name." +
      " Leave out anything that does not clearly belong in this section. If nothing does, answer with exactly: NONE" +
      ` ${shape} Answer with the section text only.` +
      fenceUntrusted(ask.material ?? "", "document", "The employee's report material: their earlier reports and their records in Koleex Hub", fence);
    maxTokens = 600;
  } else if (ask.action === "write") {
    /* The longer the period, the longer its summary (6D). */
    const length = ({
      monthly: "6 to 12 sentences (at most about 300 words)",
      quarterly: "8 to 14 sentences (at most about 380 words)",
      halfyear: "10 to 16 sentences (at most about 450 words)",
      annual: "10 to 18 sentences (at most about 500 words)",
    } as Record<string, string>)[behaviourKey(tpl)] ?? "4 to 8 sentences (at most about 180 words)";
    instruction =
      `Write the "${section}" section of the employee's ${type}${period ? `, covering ${period}` : ""}.` +
      ` Language: ${LANG_NAME[ask.lang]}. Length: ${length}.` +
      " Summarise for the manager: what was achieved, what moved forward, what is still open, and anything that needs their attention." +
      " Group related items; do not list every line." +
      ` ${shape} Answer with the section text only.` +
      fenceUntrusted(ask.material ?? "", "document", "The employee's report material: their earlier reports and their records in Koleex Hub", fence);
    maxTokens = ["quarterly", "halfyear", "annual"].includes(behaviourKey(tpl)) ? 1400 : 900;
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
      messages: teamPrompt
        ? [{ role: "system", content: teamPrompt.system }, { role: "user", content: teamPrompt.user }]
        : [{ role: "system", content: SYSTEM }, { role: "user", content: instruction }],
      maxTokens: teamPrompt ? teamPrompt.maxTokens : maxTokens,
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
  /* Nothing in the material belongs in this list — said, not pasted. */
  if (guide && /^none\.?$/i.test(answer)) {
    console.warn(`[reports.ai] action=write section=${ask.section} outcome=none ms=${ms}`);
    return NextResponse.json({ error: "no_facts" }, { status: 400 });
  }
  /* The section's names in every language: an answer opening with one of
     them as a heading loses that line. */
  const ownWords = snap ? templateWords(tpl.key, snap.words) : null;
  const nameKey = `tpl.${tpl.key}.s.${ask.section}`;
  const names = Object.values((ownWords?.[nameKey] ?? reportsT[nameKey] ?? REPORT_SECTION_WORDS[nameKey]) ?? {}).filter((v): v is string => typeof v === "string");
  const text = toSection(dropEchoedTitle(answer, names), kind);
  console.warn(`[reports.ai] action=${ask.action} section=${ask.section} lang=${ask.lang} in=${(ask.material ?? ask.text ?? "").length} out=${text.length} ms=${ms}`);
  return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
}

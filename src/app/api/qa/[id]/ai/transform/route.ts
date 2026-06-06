import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/[id]/ai/transform — reshape an EXISTING AI analysis (admin).

   Takes a stored qa_ai_sessions row's analysis and re-expresses it on demand:
     • summary  — a short bullet digest for a busy developer
     • ar       — explain in Modern Standard Arabic
     • zh       — explain in Simplified Chinese
     • solution — a concise, ordered "proposed fix" action plan

   This is advisory only — it reshapes text the AI already produced. It never
   reads new context, never touches code, never changes issue state. Output
   is returned to the client (read aloud / displayed); it is NOT persisted as
   a new session, so it can't be mistaken for a fresh analysis.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { runAnalysis } from "@/lib/qa/ai/providers";
import { ProviderError } from "@/lib/qa/ai/types";

export const maxDuration = 60;

type Mode = "summary" | "ar" | "zh" | "solution";

const SYSTEM =
  "You are Koleex AI, an advisory engineering assistant for the KOLEEX Hub. " +
  "You are given an existing debugging analysis and a transform instruction. " +
  "Reshape ONLY that analysis — do not invent new facts, files, or certainty. " +
  "You never edit code and never claim an issue is solved/fixed/done. Keep an " +
  "advisory tone (possible / likely / please verify).";

function instruction(mode: Mode): string {
  switch (mode) {
    case "summary":
      return "Summarise the analysis below in 4–6 short bullet points a busy developer can scan in 15 seconds. Lead with the most likely root cause. No headers, no preamble.";
    case "ar":
      return "اشرح التحليل التالي بالعربية الفصحى الواضحة، مع الحفاظ على البنية (السبب المحتمل، خطوات الفحص، المخاطر). نبرة استشارية فقط — لا تدّعِ أن المشكلة حُلّت. ابدأ مباشرة بدون مقدمة.";
    case "zh":
      return "用简体中文清晰地解释下面的分析，保留结构（可能的根本原因、调查步骤、风险）。仅作为建议——不要声称问题已解决。直接开始，无需前言。";
    case "solution":
      return "Based ONLY on the analysis below, write a concise, numbered action plan a developer can follow to fix this. Label it as a PROPOSED fix that still needs human verification. Do NOT claim it is already solved. End with one line: 'Verify visually before closing.'";
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { sessionId?: string; mode?: string } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const mode = body?.mode as Mode | undefined;
  if (!sessionId || !mode || !["summary", "ar", "zh", "solution"].includes(mode)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Load the source analysis (tenant-scoped). Reshape only what already exists.
  const { data: row } = await supabaseServer
    .from("qa_ai_sessions")
    .select("response_markdown, issue_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", sessionId)
    .maybeSingle();
  const source = (row as { response_markdown: string | null } | null)?.response_markdown;
  if (!source) return NextResponse.json({ error: "No analysis to transform." }, { status: 404 });

  const user = `${instruction(mode)}\n\n<<<ANALYSIS\n${source}\nANALYSIS>>>`;

  try {
    const result = await runAnalysis(SYSTEM, user);
    return NextResponse.json(
      { text: result.text, mode },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    if (e instanceof ProviderError) {
      const status = e.kind === "not_configured" ? 503 : e.kind === "rate_limited" ? 429 : e.kind === "timeout" ? 504 : 502;
      return NextResponse.json({ error: e.message, kind: e.kind }, { status });
    }
    console.error("[qa.ai.transform]", e);
    return NextResponse.json({ error: "Transform failed." }, { status: 500 });
  }
}

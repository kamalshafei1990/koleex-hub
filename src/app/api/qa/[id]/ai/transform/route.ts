import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/[id]/ai/transform — reshape an EXISTING AI analysis (admin).

   Body: { sessionId, mode, lang }
     mode: "summary" | "solution" | "explain"
     lang: "en" | "ar" | "zh"   (default "en")

   Every mode can be produced in any language, so the developer can read the
   summary or the proposed fix in English, Arabic, or Chinese.

   Advisory only — it reshapes text the AI already produced. It never reads new
   context, never touches code, never changes issue state. The output is
   returned to the client (read aloud / displayed); it is NOT persisted as a
   new session, so it can't be mistaken for a fresh analysis.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { runAnalysis } from "@/lib/qa/ai/providers";
import { ProviderError } from "@/lib/qa/ai/types";

export const maxDuration = 60;

type Mode = "summary" | "solution" | "explain";
type Lang = "en" | "ar" | "zh";

const SYSTEM =
  "You are Koleex AI, an advisory engineering assistant for the KOLEEX Hub. " +
  "You are given an existing debugging analysis and a transform instruction. " +
  "Reshape ONLY that analysis — do not invent new facts, files, or certainty. " +
  "You never edit code and never claim an issue is solved/fixed/done. Keep an " +
  "advisory tone (possible / likely / please verify).";

const MODE_INSTRUCTION: Record<Mode, string> = {
  summary: "Summarise the analysis below in 4–6 short bullet points a busy developer can scan in 15 seconds. Lead with the most likely root cause. No headers, no preamble.",
  solution: "Based ONLY on the analysis below, write a concise, numbered action plan a developer can follow to fix this. Label it clearly as a PROPOSED fix that still needs human verification — do NOT claim it is already solved. End with one line telling the developer to verify visually before closing.",
  explain: "Explain the analysis below in clear, plain language, keeping its structure (likely cause, investigation steps, risks). Advisory tone. Start directly, no preamble.",
};

const LANG_DIRECTIVE: Record<Lang, string> = {
  en: "Write the entire response in English.",
  ar: "اكتب الإجابة بالكامل بالعربية الفصحى الواضحة، بنبرة استشارية، دون ادّعاء أن المشكلة قد حُلّت.",
  zh: "请用简体中文书写整个回复，保持建议性语气，不要声称问题已解决。",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { sessionId?: string; mode?: string; lang?: string } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const mode = body?.mode as Mode | undefined;
  const lang = (["en", "ar", "zh"].includes(body?.lang ?? "") ? body!.lang : "en") as Lang;
  if (!sessionId || !mode || !["summary", "solution", "explain"].includes(mode)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: row } = await supabaseServer
    .from("qa_ai_sessions")
    .select("response_markdown")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", sessionId)
    .maybeSingle();
  const source = (row as { response_markdown: string | null } | null)?.response_markdown;
  if (!source) return NextResponse.json({ error: "No analysis to transform." }, { status: 404 });

  const user = `${MODE_INSTRUCTION[mode]}\n\n${LANG_DIRECTIVE[lang]}\n\n<<<ANALYSIS\n${source}\nANALYSIS>>>`;

  try {
    const result = await runAnalysis(SYSTEM, user);
    return NextResponse.json(
      { text: result.text, mode, lang },
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

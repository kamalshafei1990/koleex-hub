import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/[id]/ai/analyze — run one explicit AI investigation (admin).

   Builds the deterministic, sanitized workspace context, asks the configured
   provider for a structured engineering analysis, stores the session, and
   returns it. No streaming, rate-limited, timeout-protected. Never mutates
   code, the repo, or any other table.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { runAiAnalysis, AiBusyError, IssueNotFoundError } from "@/lib/qa/ai/analyze";
import { ProviderError } from "@/lib/qa/ai/types";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;

  try {
    const session = await runAiAnalysis(auth.tenant_id, id, auth.account_id);
    return NextResponse.json({ session }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof IssueNotFoundError) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (e instanceof AiBusyError) return NextResponse.json({ error: e.message }, { status: 429 });
    if (e instanceof ProviderError) {
      const status = e.kind === "not_configured" ? 503 : e.kind === "rate_limited" ? 429 : e.kind === "timeout" ? 504 : 502;
      return NextResponse.json({ error: e.message, kind: e.kind }, { status });
    }
    console.error("[qa.ai.analyze]", e);
    return NextResponse.json({ error: "AI analysis failed." }, { status: 500 });
  }
}

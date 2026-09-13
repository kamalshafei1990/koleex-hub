import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/usage?days=14 — how much Koleex AI is used, for the owner.

   Roadmap D3. SUPER ADMIN ONLY, decided here from the server's own auth
   context — never from anything the client says. Tenant-scoped counts over
   rows the product already writes; no message text, no arguments, no
   customer names are read into the answer. See ai/usage.ts.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { SUMMARY_HEADINGS, isSummaryMessage } from "@/lib/server/ai/voice/summary";
import {
  aggregateUsage,
  parseDays,
  type CallRow,
  type ConversationRow,
  type MessageRow,
  type ToolCallRow,
} from "@/lib/server/ai/usage";

export const dynamic = "force-dynamic";

/** Row caps per query: far above a month of this tenant's traffic, and a
 *  ceiling so a report can never become a table dump. */
const ROW_CAP = 20_000;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  const days = parseDays(new URL(req.url).searchParams.get("days"));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [messages, conversations, toolCalls, spoken] = await Promise.all([
    supabaseServer.from("ai_messages").select("created_at, role, source").eq("tenant_id", auth.tenant_id).gte("created_at", since).limit(ROW_CAP),
    supabaseServer.from("ai_conversations").select("created_at, account_id").eq("tenant_id", auth.tenant_id).gte("created_at", since).limit(ROW_CAP),
    supabaseServer.from("ai_tool_calls").select("created_at, tool_name, ok, account_id").eq("tenant_id", auth.tenant_id).gte("created_at", since).limit(ROW_CAP),
    /* Calls are counted by their summaries; the text is read here only to
       recognise the heading and is not returned. */
    supabaseServer
      .from("ai_messages")
      .select("created_at, content")
      .eq("tenant_id", auth.tenant_id)
      .eq("role", "assistant")
      .eq("source", "voice")
      .or(Object.values(SUMMARY_HEADINGS).map((h) => `content.ilike.%${h}%`).join(","))
      .gte("created_at", since)
      .limit(ROW_CAP),
  ]);
  const failed = [messages, conversations, toolCalls, spoken].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const calls: CallRow[] = ((spoken.data ?? []) as Array<{ created_at: string; content: string | null }>)
    .filter((r) => typeof r.content === "string" && isSummaryMessage(r.content))
    .map((r) => ({ created_at: r.created_at }));

  const report = aggregateUsage({
    days,
    messages: (messages.data ?? []) as MessageRow[],
    conversations: (conversations.data ?? []) as ConversationRow[],
    toolCalls: (toolCalls.data ?? []) as ToolCallRow[],
    calls,
  });
  console.log(`[ai.usage] ok days=${days} people=${report.people} turns=${report.totals.typed + report.totals.spoken} tools=${report.totals.tools}`);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}

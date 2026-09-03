import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/voice/summary — write down what a call came to.

   Body: { conversation_id, lang? }. Called by the call screen once, when the
   caller hangs up on a call that had a real exchange in it (the client checks
   that first; the server checks it again from what was actually saved).

   THE SAME CHAIN AS THE TRANSCRIPT ROUTE, in the same order: the voice gate,
   a budget, the body's shape, and the conversation being the caller's own
   (id, tenant, account). Then ai/voice/summary.ts decides which rows are
   this call and whether they are worth a summary; one routeAi call writes
   it; one ai_messages row keeps it, source 'voice', role assistant — the
   same lane the call's own words took.

   IDEMPOTENT: a second call for a summarised call returns the row it already
   wrote. NOTHING IS LOGGED but lengths and outcomes: the transcript and the
   summary are the caller's.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { authorizeVoice } from "@/lib/server/ai/voice/gate";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { supabaseServer } from "@/lib/server/supabase-server";
import { parseConversationParam } from "@/lib/server/ai/voice/history";
import { routeAi } from "@/lib/server/ai/router";
import {
  SUMMARY_ROWS,
  buildSummaryRequest,
  formatSummary,
  selectCallTurns,
  summaryLanguage,
  type SummaryRow,
} from "@/lib/server/ai/voice/summary";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseLang(raw: unknown): Lang {
  return raw === "ar" || raw === "zh" || raw === "en" ? raw : "en";
}

export async function POST(req: Request) {
  const gate = await authorizeVoice(req);
  if (gate instanceof NextResponse) return gate;

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(gate.accountId), BUDGETS.voiceSummaryPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.voice.summary] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Too many summaries just now." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const body: unknown = await req.json().catch(() => null);
  const obj = body && typeof body === "object" ? (body as { conversation_id?: unknown; lang?: unknown }) : {};
  const conversationId = parseConversationParam(String(obj.conversation_id ?? ""));
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id is required." }, { status: 400 });
  }
  const uiLang = parseLang(obj.lang);

  /* THE CONVERSATION IS THE CALLER'S — the same triple every mutation uses. */
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", gate.tenantId)
    .eq("account_id", gate.accountId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows } = await supabaseServer
    .from("ai_messages")
    .select("id, role, content, source, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(SUMMARY_ROWS);

  const selection = selectCallTurns((rows ?? []) as SummaryRow[]);
  if (selection.kind === "already") {
    return NextResponse.json({ message: selection.row, conversation: { id: conv.id, title: conv.title } });
  }
  if (selection.kind === "none") {
    /* Not an error: a short call is a short call. The client shows nothing. */
    return NextResponse.json({ message: null, conversation: { id: conv.id, title: conv.title } });
  }

  const lang = summaryLanguage(selection.turns, uiLang);
  const result = await routeAi({
    messages: [{ role: "user", content: buildSummaryRequest(selection.turns, lang) }],
    context: {
      userLang: lang,
      viewer: {
        name: gate.viewer.name,
        username: gate.viewer.username,
        role: gate.viewer.role,
        department: gate.viewer.department,
      },
      personalization: gate.viewer.personalization ?? null,
    },
    forceMode: "chat",
  });
  if (result.status !== "success" || !result.message.trim()) {
    console.error(`[ai.voice.summary] model failed turns=${selection.turns.length} provider=${result.provider}`);
    return NextResponse.json({ error: "Could not summarise the call." }, { status: 502 });
  }
  const content = formatSummary(result.message, lang);

  const { data: inserted, error } = await supabaseServer
    .from("ai_messages")
    .insert({
      tenant_id: gate.tenantId,
      conversation_id: conversationId,
      role: "assistant",
      content,
      provider: result.provider,
      source: "voice",
    })
    .select("*")
    .single();
  if (error || !inserted) {
    console.error(`[ai.voice.summary] insert failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Could not save the summary." }, { status: 500 });
  }

  await supabaseServer
    .from("ai_conversations")
    .update({
      last_preview: content.slice(0, 180),
      message_count: (conv.message_count ?? 0) + 1,
    })
    .eq("id", conversationId)
    .eq("tenant_id", gate.tenantId)
    .eq("account_id", gate.accountId);

  console.log(`[ai.voice.summary] ok turns=${selection.turns.length} chars=${content.length} lang=${lang}`);
  return NextResponse.json({ message: inserted, conversation: { id: conv.id, title: conv.title } });
}

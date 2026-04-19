import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/agent
     body: { conversationId: string, content: string, user_lang?: 'en'|'zh'|'ar' }
     response: AgentResponse  (see ai-agent/types.ts)

   Thin wrapper around the orchestrator:
   - requireAuth() + buildUserContext() to seed the permission layer
   - persist the user turn and the assistant final reply to ai_messages
   - auto-title on the first exchange (same rule as /chat)
   - roll last_preview + message_count

   Conversation storage stays in the existing ai_conversations /
   ai_messages tables so the sidebar, rename, delete flows keep
   working. Tool-call and tool-result steps live only in the wire
   response (replayed to the UI in this turn, then the audit table
   is the permanent record).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { buildUserContext } from "@/lib/server/ai-agent/permissions";
import { orchestrate } from "@/lib/server/ai-agent/orchestrator";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    content?: string;
    user_lang?: "en" | "zh" | "ar";
  };

  const content = body.content?.trim();
  const conversationId = body.conversationId;
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  /* Confirm the conversation is mine. Same tenant + account guard used by
     the rest of /api/ai/conversations. */
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /* History for multi-turn context. */
  const { data: history } = await supabaseServer
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  /* Persist the user turn BEFORE the model call so we never lose it on
     a provider blip. */
  await supabaseServer.from("ai_messages").insert({
    tenant_id: auth.tenant_id,
    conversation_id: conversationId,
    role: "user",
    content,
  });

  const ctx = await buildUserContext(auth);

  const userLang: "en" | "zh" | "ar" =
    body.user_lang === "zh" ? "zh" :
    body.user_lang === "ar" ? "ar" :
    "en";

  const agent = await orchestrate({
    ctx,
    history: (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
    userMessage: content,
    userLang,
    conversationId,
  });

  /* Persist the assistant final reply. Tool-call / tool-result steps
     live in the audit log rather than the chat transcript to keep
     history clean + token cost down on future turns. */
  const { data: assistantRow } = await supabaseServer
    .from("ai_messages")
    .insert({
      tenant_id: auth.tenant_id,
      conversation_id: conversationId,
      role: "assistant",
      content: agent.finalReply,
      provider: agent.provider,
    })
    .select("*")
    .single();

  /* Auto-title on the first exchange — same rule as the /chat route. */
  let finalTitle = conv.title;
  if ((conv.title === "New chat" || !conv.title) && (conv.message_count ?? 0) === 0) {
    const words = content.trim().split(/\s+/);
    if (words.length <= 4) {
      finalTitle = content.trim().slice(0, 60);
    } else {
      finalTitle = words.slice(0, 4).join(" ").slice(0, 60);
    }
  }

  await supabaseServer
    .from("ai_conversations")
    .update({
      title: finalTitle,
      last_preview: agent.finalReply.slice(0, 180),
      message_count: (conv.message_count ?? 0) + 2,
    })
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id);

  return NextResponse.json({
    agent,
    message: assistantRow,
    conversation: { id: conversationId, title: finalTitle },
  });
}

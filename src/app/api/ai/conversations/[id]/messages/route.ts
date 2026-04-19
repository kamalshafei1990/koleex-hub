import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { aiChat, aiProviderConfigured, getLastAiError, type ChatMessage } from "@/lib/server/ai-provider";

/* POST /api/ai/conversations/:id/messages
     body: { content: string, user_lang?: 'en'|'zh'|'ar' }
   Appends the user message, runs a chat completion, appends the
   assistant reply, and rolls the conversation's summary fields. Auto-
   generates a 4-word title when the conversation is still "New chat". */

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  if (!aiProviderConfigured()) {
    return NextResponse.json(
      {
        error: "no_provider",
        message: "Koleex AI is not configured. Add GEMINI_API_KEY in Vercel env.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as {
    content?: string;
    user_lang?: "en" | "zh" | "ar";
  };
  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  /* Confirm the conversation is mine. Same triple-predicate used on every
     other mutation so a crafted id from tenant A can't poke tenant B. */
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* Pull history so the model has multi-turn context */
  const { data: history } = await supabaseServer
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  /* Persist the user turn BEFORE the AI call so we don't lose it if the
     provider fails mid-call. */
  await supabaseServer.from("ai_messages").insert({
    tenant_id: auth.tenant_id,
    conversation_id: id,
    role: "user",
    content,
  });

  const langName = body.user_lang === "zh" ? "Chinese (Simplified)"
    : body.user_lang === "ar" ? "Arabic"
    : "English";

  const systemPrompt = `You are Koleex AI, the in-app assistant for Koleex Hub — a multilingual ERP used by Koleex International Group (a trading + manufacturing company headquartered in China).

Rules:
- Reply in ${langName}. Respect the user's locale even if they type in another language.
- Keep answers concise, business-focused, and well-formatted. Use bullet lists where helpful.
- You live inside an ERP with apps: CRM, Quotations, Invoices, Planning, Projects, To-do, Notes, Inbox, Customers, Suppliers, Products, Inventory, Landed Cost, Employees, HR.
- If the user asks about specific records (e.g. "how many overdue invoices?"), explain that data-context is a future upgrade and point them at the relevant app.
- Never invent invoice numbers, customer names, or any other data you haven't been given. Hallucinating business data is unacceptable.
- For translation requests, produce ONLY the translation.

Current user: ${auth.username} (${auth.user_type}).`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
    { role: "user", content },
  ];

  const result = await aiChat(messages);
  if (!result) {
    return NextResponse.json(
      {
        error: "provider_error",
        message: getLastAiError() ?? "AI provider is unreachable right now.",
      },
      { status: 502 },
    );
  }

  /* Persist the assistant turn + roll the conversation summary */
  const { data: assistantRow } = await supabaseServer
    .from("ai_messages")
    .insert({
      tenant_id: auth.tenant_id,
      conversation_id: id,
      role: "assistant",
      content: result.reply,
      provider: result.provider,
    })
    .select("*")
    .single();

  /* Auto-generate a title on the first exchange.
     Earlier prompt ("Summarise the user's first message…") confused some
     open models — Llama replied with literal phrases like "Hello user
     message" because it latched onto the structural wording. This prompt
     asks for a short topic label directly, and we scrub any lingering
     role words defensively. For very short inputs (≤3 words) we just use
     the input itself so one-word greetings like "Hello" become "Hello"
     instead of hallucinated titles. */
  let finalTitle = conv.title;
  if ((conv.title === "New chat" || !conv.title) && (conv.message_count ?? 0) === 0) {
    const wordCount = content.trim().split(/\s+/).length;

    if (wordCount <= 3) {
      finalTitle = content.trim().slice(0, 60);
    } else {
      const titlePrompt: ChatMessage[] = [
        {
          role: "system",
          content:
            "Generate a concise 2-4 word title describing the topic of this conversation, in the same language as the input. Reply with ONLY the title. No quotes. No punctuation. Do not include the words 'user', 'message', 'assistant', 'AI', 'chat', 'title', or 'conversation'.",
        },
        { role: "user", content },
      ];
      const titleRes = await aiChat(titlePrompt);
      const cleaned = titleRes?.reply
        .replace(/[\n\r"'`]/g, "")
        .replace(/^(title|topic)\s*[:\-–—]?\s*/i, "")
        .replace(/\b(user|assistant|ai|chat|message|conversation)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      if (cleaned) finalTitle = cleaned;
    }
  }

  await supabaseServer
    .from("ai_conversations")
    .update({
      title: finalTitle,
      last_preview: result.reply.slice(0, 180),
      message_count: (conv.message_count ?? 0) + 2,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id);

  return NextResponse.json({
    message: assistantRow,
    conversation: { id, title: finalTitle },
  });
}

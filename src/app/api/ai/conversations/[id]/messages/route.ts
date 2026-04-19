import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { aiChat, aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";

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
      { error: "provider_error", message: "AI provider is unreachable right now." },
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

  /* Auto-generate a title on the first exchange */
  let finalTitle = conv.title;
  if ((conv.title === "New chat" || !conv.title) && (conv.message_count ?? 0) === 0) {
    const titlePrompt: ChatMessage[] = [
      {
        role: "system",
        content:
          "Summarise the user's first message in at most 4 words, in the same language. Return ONLY the title text, no quotes, no punctuation at the end.",
      },
      { role: "user", content },
    ];
    const titleRes = await aiChat(titlePrompt);
    const cleaned = titleRes?.reply
      .replace(/[\n\r"']/g, "")
      .trim()
      .slice(0, 60);
    if (cleaned) finalTitle = cleaned;
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

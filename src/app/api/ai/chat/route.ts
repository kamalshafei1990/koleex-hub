import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aiChat, aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";

/* POST /api/ai/chat
     body: { messages: [{role, content}, ...], user_lang?: 'en'|'zh'|'ar' }
   response: { reply: string, provider: string }
            | { error: 'no_provider' | 'provider_error' }

   Injects a Koleex-aware system prompt so the assistant speaks in the
   user's language + knows it's living inside an ERP (not a generic
   chatbot). Later stages add data-context tools. */

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!aiProviderConfigured()) {
    return NextResponse.json(
      {
        error: "no_provider",
        message:
          "Koleex AI is not configured yet. Ask a Super Admin to add a GEMINI_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY) in Vercel env vars.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as {
    messages?: ChatMessage[];
    user_lang?: "en" | "zh" | "ar";
  };
  const msgs = body.messages ?? [];
  if (!Array.isArray(msgs) || msgs.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const langName = body.user_lang === "zh"
    ? "Chinese (Simplified)"
    : body.user_lang === "ar"
      ? "Arabic"
      : "English";

  const systemPrompt = `You are Koleex AI, the in-app assistant for Koleex Hub — a multilingual ERP used by Koleex International Group (a trading + manufacturing company headquartered in China).

Rules:
- Reply in ${langName}. Respect the user's locale even if they type in another language.
- Keep answers concise and business-focused. Bullet lists are welcome when helpful.
- You live inside an ERP with apps: CRM, Quotations, Invoices, Planning, Projects, To-do, Notes, Inbox, Customers, Suppliers, Products, Inventory, Landed Cost, Employees, HR. Reference those apps naturally.
- If the user asks about specific records (e.g. "how many overdue invoices?") and you haven't been given that data in-context yet, say you can't see the record set and suggest they navigate to the relevant app. (Data-context is a future upgrade.)
- Never invent invoice numbers, customer names, or any other data you haven't been given. Hallucinating business data is a fireable offence.
- When helping draft messages / emails / tasks, match the user's tone: formal for external communication, concise + direct for internal.
- For translation questions, produce the translation and nothing else.

Current user: ${auth.username} (${auth.user_type}).`;

  const augmented: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...msgs,
  ];

  const result = await aiChat(augmented);
  if (!result) {
    return NextResponse.json(
      { error: "provider_error", message: "AI provider is unreachable right now." },
      { status: 502 },
    );
  }

  return NextResponse.json({ reply: result.reply, provider: result.provider });
}

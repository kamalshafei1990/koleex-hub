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
    user_lang?: "en" | "zh" | "ar"; // accepted for back-compat, not used
  };
  const msgs = body.messages ?? [];
  if (!Array.isArray(msgs) || msgs.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  /* Performance fix: minimal system prompt + last 2-3 messages only.
     Keeps Groq chat round-trip under ~2s on llama-3.1-8b-instant.
     The prompt still tells the model to mirror the user's language
     so Arabic / Chinese users keep getting locale-appropriate replies. */
  const systemPrompt = "You are Koleex AI. Reply in the user's language. Be short and clear.";
  const recentMsgs = msgs.slice(-3);
  const augmented: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentMsgs,
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

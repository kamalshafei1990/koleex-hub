import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aiChat, aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";

/* Fast-path canned replies for the handful of prompts we see most.
   Matched server-side before any Groq call — returns in ~200 ms
   instead of ~2 s. Replies stay short, neutral, and always in the
   same language as the trigger. "Koleex" stays in Latin letters in
   every language per the brand rule. */
const FAST_REPLIES: Array<[RegExp, string]> = [
  // Greetings
  [/^(hi|hello|hey|yo|hola)[\s,!.?]*$/i,                      "Hi! How can I help?"],
  [/^(good\s+(morning|afternoon|evening|night))[\s,!.?]*$/i,  "Hello! How can I help?"],
  [/^(salam|salaam|مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/i,        "مرحبا! كيف أقدر أساعدك؟"],
  [/^(你好|您好|嗨)[\s,!.?]*$/,                                "你好!有什么可以帮您的吗?"],
  // Identity — English
  [/^who\s+(are|r)\s+you\s*\??$/i,                            "I'm Koleex AI, your assistant inside Koleex Hub."],
  [/^what\s+(are|r)\s+you\s*\??$/i,                           "I'm Koleex AI, your in-app assistant."],
  [/^what\s+can\s+you\s+do\s*\??$/i,                          "I help with quick answers, drafting, and navigating the hub. What do you need?"],
  // Identity — Arabic
  [/^(من\s+(أنت|انت)|مين\s+(أنت|انت))\s*[?؟]?$/,              "أنا Koleex AI، مساعدك داخل Koleex Hub."],
  [/^(ماذا\s+(تستطيع|يمكنك)|ما\s+الذي\s+(تستطيع|يمكنك)|شو\s+(تقدر|بتقدر)|ايش\s+تقدر).*[?؟]?$/, "أساعدك في إجابات سريعة والصياغة والتنقل داخل Koleex Hub. ما الذي تحتاجه؟"],
  // Identity — Chinese
  [/^你是谁\s*[?？]?$/,                                        "我是 Koleex AI,您在 Koleex Hub 的助手。"],
  [/^你(能|可以)(做|干)什么\s*[?？]?$/,                         "我可以帮您快速回答、起草内容和在 Koleex Hub 中导航。需要什么?"],
  // Acks
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,                  "You're welcome."],
  [/^(ok|okay|cool|got\s+it|understood)[\s!.?]*$/i,           "Okay."],
  [/^(bye|goodbye|see\s+you)[\s!.?]*$/i,                      "See you!"],
];

function tryFastReply(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const [pat, reply] of FAST_REPLIES) {
    if (pat.test(m)) return reply;
  }
  return null;
}

/* Hard caps on the Groq payload — prevents 413 "request too large"
   when the conversation carries long pastes / long past answers.
   Groq's free-tier limit bites around 10-20 KB; these are deliberately
   well under that. Tune via these constants only. */
const HISTORY_LIMIT     = 2;     // last N prior messages (excluding system)
const MAX_MESSAGE_CHARS = 2000;  // per-message cap, trailing truncation marker
const MAX_TOTAL_CHARS   = 6000;  // system prompt + trimmed history, combined

function clamp(str: string, max: number): { text: string; clipped: boolean } {
  if (str.length <= max) return { text: str, clipped: false };
  return { text: str.slice(0, max - 20) + " …[trimmed]", clipped: true };
}

/** Strip to the two fields Groq actually uses, cap each message, then
 *  cap the combined total by dropping older messages. Returns the
 *  trimmed list plus stats for the payload log. */
function prepareMessages(
  systemPrompt: string,
  msgs: ChatMessage[],
): {
  augmented: ChatMessage[];
  stats: {
    incoming: number;
    sent: number;
    bytes: number;
    perMsgTrim: boolean;
    historyTrim: boolean;
  };
} {
  const incoming = msgs.length;

  /* 1. Keep only the last HISTORY_LIMIT turns. Strip any unexpected
        fields the client might send — Groq only uses role + content. */
  let recent: ChatMessage[] = msgs.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    content: String(m.content ?? ""),
  }));

  /* 2. Per-message cap. Trailing "…[trimmed]" makes it visible to the
        model so it doesn't confabulate the missing tail. */
  let perMsgTrim = false;
  recent = recent.map((m) => {
    const c = clamp(m.content, MAX_MESSAGE_CHARS);
    if (c.clipped) perMsgTrim = true;
    return { role: m.role, content: c.text };
  });

  /* 3. Total cap. Drop oldest messages first; as a last resort,
        truncate the newest so we always return something bounded. */
  let historyTrim = false;
  const totalLen = () =>
    systemPrompt.length + recent.reduce((s, m) => s + m.content.length, 0);
  while (totalLen() > MAX_TOTAL_CHARS && recent.length > 1) {
    recent.shift();
    historyTrim = true;
  }
  if (totalLen() > MAX_TOTAL_CHARS && recent.length === 1) {
    const budget = Math.max(
      200,
      MAX_TOTAL_CHARS - systemPrompt.length - 20,
    );
    recent[0].content = recent[0].content.slice(0, budget) + " …[trimmed]";
    perMsgTrim = true;
  }

  const augmented: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...recent,
  ];
  const bytes = JSON.stringify(augmented).length;
  return {
    augmented,
    stats: {
      incoming,
      sent: augmented.length,
      bytes,
      perMsgTrim,
      historyTrim,
    },
  };
}

/* POST /api/ai/chat
     body: { messages: [{role, content}, ...], user_lang?: 'en'|'zh'|'ar' }
   response: { reply: string, provider: string }
            | { error: 'no_provider' | 'provider_error' }

   Injects a Koleex-aware system prompt so the assistant speaks in the
   user's language + knows it's living inside an ERP (not a generic
   chatbot). Later stages add data-context tools. */

export async function POST(req: Request) {
  const t0 = Date.now();
  const auth = await requireAuth();
  const tAuth = Date.now();
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

  /* Fast-path: short canned reply, no Groq call. Covers greetings,
     identity, thanks, etc. across EN/AR/ZH. Cuts latency on these
     prompts to roughly the auth round-trip. */
  const lastUser = msgs[msgs.length - 1]?.content ?? "";
  const fast = tryFastReply(lastUser);
  if (fast) {
    const tEnd = Date.now();
    console.log(
      `[ai.chat.timing] auth=${tAuth - t0}ms provider=0ms total=${tEnd - t0}ms fast=1`,
    );
    return NextResponse.json({ reply: fast, provider: "fast-path" });
  }

  /* Minimal system prompt. Explicitly blocks the model from launching
     into a Koleex company spiel — it was chewing tokens on that. The
     prompt still tells the model to mirror the user's language so
     Arabic / Chinese users keep getting locale-appropriate replies. */
  const systemPrompt =
    "You are Koleex AI. Reply briefly and clearly in the user's language. " +
    "Never describe Koleex, the company, its services, or its business scope " +
    "unless the user explicitly asks.";

  /* Hard payload guard — caps history to last 2, caps each message
     at 2000 chars, caps combined payload at 6000 chars. Bounded by
     construction; 413 from Groq becomes structurally impossible on
     this route. */
  const { augmented, stats } = prepareMessages(systemPrompt, msgs);
  console.log(
    `[ai.chat.payload] in=${stats.incoming} sent=${stats.sent} bytes=${stats.bytes}` +
      ` perMsgTrim=${stats.perMsgTrim ? 1 : 0} histTrim=${stats.historyTrim ? 1 : 0}`,
  );

  const tPre = Date.now();
  const result = await aiChat(augmented);
  const tPost = Date.now();
  if (!result) {
    console.log(
      `[ai.chat.timing] auth=${tAuth - t0}ms provider=${tPost - tPre}ms total=${tPost - t0}ms status=error`,
    );
    return NextResponse.json(
      { error: "provider_error", message: "AI provider is unreachable right now." },
      { status: 502 },
    );
  }

  const tEnd = Date.now();
  console.log(
    `[ai.chat.timing] auth=${tAuth - t0}ms provider=${tPost - tPre}ms total=${tEnd - t0}ms`,
  );
  return NextResponse.json({ reply: result.reply, provider: result.provider });
}

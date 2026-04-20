import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";
import { routeAi } from "@/lib/server/ai/router";
import { sealPricingSafety } from "@/lib/server/ai-agent/orchestrator";

/* ---------------------------------------------------------------------------
   POST /api/ai/chat — now powered by the hybrid router.

   Step 5: this route delegates to routeAi() instead of calling Groq
   directly. Classification happens server-side:
     · chat     → Groq
     · business → DeepSeek  (gated behind USE_DEEPSEEK + DEEPSEEK_API_KEY)
     · unknown  → Groq      (fallback per router spec)

   Response contract is unchanged: { reply, provider }. Callers continue
   to read `reply`; we translate the router's stable ProviderName
   ("groq" | "deepseek") into that field. The only previously-visible
   detail we drop is the ":model-id" suffix on the provider string —
   no caller in the app uses it, and keeping it out of the public
   contract keeps the future free to swap models without a UI change.

   /api/ai/agent is untouched by this change. Its orchestrator remains
   the authoritative agent path with its own tool-loop behaviour.
   --------------------------------------------------------------------------- */

/* Fast-path canned replies for the handful of prompts we see most.
   Matched server-side before any router call — returns in ~auth ms
   instead of waiting on the classifier + provider. Keep in sync
   with the orchestrator + /api/ai/agent copies. "Koleex" stays in
   Latin letters in every language per the brand rule. */
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

/* Hard cap on the user turn we hand to the router. The router is
   single-turn by design (prompt-builder owns the system prompt), so
   there's no history concatenation to bound — only the last message.
   Kept well under Groq's free-tier limit. */
const MAX_MESSAGE_CHARS = 2000;

function clamp(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 20) + " …[trimmed]";
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const auth = await requireAuth();
  const tAuth = Date.now();
  if (auth instanceof NextResponse) return auth;

  /* Keep the "no provider configured at all" guard for backward
     compat. aiProviderConfigured() checks the legacy chat key; the
     router additionally gates business mode on its own USE_DEEPSEEK
     flag, so this 503 only fires when the whole system is cold. */
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

  const lastUser = String(msgs[msgs.length - 1]?.content ?? "");
  const userLang = body.user_lang;

  /* Fast-path: short canned reply, no router call. Covers greetings,
     identity, thanks, etc. across EN/AR/ZH. Cuts latency on these
     prompts to roughly the auth round-trip. */
  const fast = tryFastReply(lastUser);
  if (fast) {
    const tEnd = Date.now();
    console.log(
      `[ai.chat.timing] auth=${tAuth - t0}ms route=0ms total=${tEnd - t0}ms fast=1`,
    );
    /* Belt-and-braces pricing guard on canned replies. The current
       FAST_REPLIES table has no pricing patterns so this is a no-op
       today, but keeps the chat-route contract uniform if anyone
       adds a new canned entry later. Chat mode has no tool steps,
       so evidence is always absent — any pricing-like content is
       replaced with PRICING_GUARD_MESSAGE. */
    const safeFast = sealPricingSafety(fast, []);
    return NextResponse.json({ reply: safeFast, provider: "fast-path" });
  }

  /* Delegate to the hybrid router. It classifies intent from the last
     user turn, builds the right prompt via prompt-builder, and calls
     Groq or DeepSeek accordingly. Strict failure policy — no cross-
     provider fallback; the router always returns a stable envelope. */
  const tPre = Date.now();
  const result = await routeAi({
    messages: [{ role: "user", content: clamp(lastUser, MAX_MESSAGE_CHARS) }],
    context: { userLang },
  });
  const tPost = Date.now();

  if (result.status === "error") {
    /* Keep the technical detail in server logs only — user-facing
       copy is deliberately generic per Step 5 spec. Business (DeepSeek
       disabled / unreachable) gets a softer phrasing than the Groq
       path so users don't see "DeepSeek" branding. */
    console.error(
      `[ai.chat.error] mode=${result.mode} provider=${result.provider}` +
        ` routing=${result.meta.routing} detail=${result.message}`,
    );
    console.log(
      `[ai.chat.timing] auth=${tAuth - t0}ms route=${tPost - tPre}ms total=${tPost - t0}ms status=error mode=${result.mode}`,
    );

    const userMessage =
      result.mode === "business"
        ? "I'm currently unable to process business requests. Please try again shortly."
        : "AI provider is unreachable right now.";
    return NextResponse.json(
      { error: "provider_error", message: userMessage },
      { status: 502 },
    );
  }

  const tEnd = Date.now();
  console.log(
    `[ai.chat.timing] auth=${tAuth - t0}ms route=${tPost - tPre}ms total=${tEnd - t0}ms` +
      ` mode=${result.mode} routing=${result.meta.routing}`,
  );
  /* Backward-compatible response: existing callers only read `reply`
     and (optionally) `provider`. We expose the stable ProviderName
     ("groq" | "deepseek") rather than "groq:llama-…" so future model
     swaps don't change the wire contract. */
  /* Chat-mode pricing guard. Chat mode has no tool-call steps, so
     hasValidPricingEvidence (inside sealPricingSafety) always returns
     false for this route — effective semantic: chat-mode replies
     cannot emit pricing. If the model emits any pricing-like text
     (currency amounts, labelled totals, numeric discount/margin, etc.)
     the guard replaces it with PRICING_GUARD_MESSAGE before it reaches
     the client — and therefore before TTS speaks it on the voice
     path. Non-pricing replies are a pure pass-through. */
  const safeReply = sealPricingSafety(result.reply, []);
  if (safeReply !== result.reply) {
    console.warn(
      `[ai.chat.pricing-guard] replaced hallucinated pricing mode=${result.mode}`,
    );
  }
  return NextResponse.json({ reply: safeReply, provider: result.provider });
}

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
/* Canned fast-path replies using the APPROVED Section 3 (Basic
   Conversation) text verbatim. Exact-match regexes — so variations
   still flow through the model and get a natural response. Q9
   "What are you?" intentionally NOT here — it overlaps with Section
   2 AI-identity answers and routes through brand knowledge. */
const Q1_GREETING =
  "Hello.\n\nKoleex AI is here and ready to help.\n\nFeel free to ask anything — about Koleex, business topics, or general questions — or to request assistance with tasks.\n\nHow can I help you today?";
const Q2_HOW_ARE_YOU =
  "I'm doing well, thank you for asking.\n\nEverything is running smoothly, and I'm ready to help with anything you need — whether it's a question, a task, or just a quick conversation.\n\nHow can I help you today?";
const Q3_HOW_OLD =
  "I don't have an age like a human.\n\nI'm a digital system, so I don't grow older, but I'm continuously updated and improved to provide better support and performance over time.\n\nYou can think of me as always up to date and evolving to serve you better.";
const Q4_WHAT_DOING =
  "I'm here with you and ready to help.\n\nRight now, I'm just waiting for your next question or anything you'd like me to do — whether it's answering something, helping with a task, or just having a quick chat.";
const Q5_WHERE_ARE_YOU =
  "I'm not in a physical place like a person.\n\nI exist digitally, so you can access me from anywhere — whether you're using a computer, a phone, or any connected device.\n\nSo in a way, I'm right here with you.";
const Q7_CAN_YOU_HELP =
  "Of course, I'd be happy to help.\n\nJust tell me what you need, and I'll do my best to assist — whether it's answering a question, helping with a task, or guiding you through something step by step.\n\nYou can keep it simple and just say what's on your mind. I'm here for you.";
const Q8_ARE_YOU_BUSY =
  "Not at all.\n\nI'm always available and ready to help you whenever you need.\n\nYou can ask anything or request any task, and I'll be here to support you. Take your time — I'm here.";
const Q10_PURPOSE =
  "My purpose is to make things easier for you.\n\nI'm here to help you find information, complete tasks, and communicate more smoothly — whether it's related to Koleex, business needs, or general questions.\n\nI'm designed to save you time, simplify processes, and support you whenever you need assistance.";

const FAST_REPLIES: Array<[RegExp, string]> = [
  // Q1 — greetings (EN)
  [/^(hi|hello|hey|yo|hola)[\s,!.?]*$/i,                       Q1_GREETING],
  [/^(good\s+(morning|afternoon|evening|night))[\s,!.?]*$/i,   Q1_GREETING],
  // Q1 — greetings (AR / ZH — approved English translated to language context kept short; full paragraph uses EN since user only provided EN for Section 3)
  [/^(salam|salaam|مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/i,         "مرحبا! أنا Koleex AI، جاهز لمساعدتك. اسأل عن أي شيء يخص Koleex أو أي موضوع آخر، أو اطلب مساعدة في أي مهمة."],
  [/^(你好|您好|嗨)[\s,!.?]*$/,                                 "你好!我是 Koleex AI,随时为您提供帮助。您可以问关于 Koleex、业务或任何其他话题的问题。"],

  // Q2 — how are you
  [/^how\s+(are|r)\s+(you|u)\s*[?!.]*$/i,                      Q2_HOW_ARE_YOU],
  [/^how's\s+it\s+going\s*[?!.]*$/i,                           Q2_HOW_ARE_YOU],

  // Q3 — how old are you
  [/^how\s+old\s+(are|r)\s+(you|u)\s*[?!.]*$/i,                Q3_HOW_OLD],

  // Q4 — what are you doing
  [/^what\s+(are|r)\s+(you|u)\s+doing(\s+now)?\s*[?!.]*$/i,    Q4_WHAT_DOING],

  // Q5 — where are you
  [/^where\s+(are|r)\s+(you|u)(\s+now)?\s*[?!.]*$/i,           Q5_WHERE_ARE_YOU],

  // Q7 — can you help / help me
  [/^(can\s+you\s+help\s+(me|us)|help\s+me)(\s+with\s+something)?\s*[?!.]*$/i, Q7_CAN_YOU_HELP],

  // Q8 — are you busy
  [/^(are|r)\s+(you|u)\s+busy(\s+right\s+now)?\s*[?!.]*$/i,    Q8_ARE_YOU_BUSY],

  // Q10 — what is your purpose
  [/^what('?s|\s+is)\s+your\s+purpose\s*[?!.]*$/i,             Q10_PURPOSE],

  /* Q9 "what are you?" + other identity questions (who are you /
     what can you do / etc.) intentionally DROPPED — they flow
     through the brand-knowledge pipeline to get Section 2 AI-identity
     answers with the approved structure. */

  // Acks
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,                   "You're welcome."],
  [/^(ok|okay|cool|got\s+it|understood)[\s!.?]*$/i,            "Okay."],
  [/^(bye|goodbye|see\s+you)[\s!.?]*$/i,                       "See you!"],
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

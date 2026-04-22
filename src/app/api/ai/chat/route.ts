import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";
import { routeAi, streamRouteAi } from "@/lib/server/ai/router";
import { sealPricingSafety } from "@/lib/server/ai-agent/orchestrator";
import { findLocalAnswer, pickLocalAnswer } from "@/lib/server/ai/local-knowledge";
import { detectLanguage } from "@/lib/server/ai/detect-language";
import { preprocessUserQuery } from "@/lib/server/ai/preprocess";
import { analyzeIntent } from "@/lib/server/ai/analyze-intent";
import { buildEgyptianResponse, removeRepetition } from "@/lib/language/rewrite-egyptian";

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

  const body = (await req.json()) as {
    messages?: ChatMessage[];
    user_lang?: "en" | "zh" | "ar";
    stream?: boolean;
  };
  const msgs = body.messages ?? [];
  if (!Array.isArray(msgs) || msgs.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const lastUser = String(msgs[msgs.length - 1]?.content ?? "");
  const userLang = body.user_lang;
  const wantsStream =
    body.stream === true || req.headers.get("accept") === "text/event-stream";

  /* Provider-configuration guard moved BELOW body parsing + local
     short-circuits (Phase 5). Canned fast-path + local-knowledge
     definitions don't need any provider, so we can serve them even
     when the system is cold — this matters in dev and during full
     provider outages. Providers-required branches still hit the
     guard before they call routeAi / streamRouteAi. */

  /* Fast-path: short canned reply, no router call. Covers greetings,
     identity, thanks, etc. across EN/AR/ZH. Cuts latency on these
     prompts to roughly the auth round-trip. */
  const fast = tryFastReply(lastUser);
  if (fast) {
    const tEnd = Date.now();
    console.log(
      `[ai.chat.timing] auth=${tAuth - t0}ms route=0ms total=${tEnd - t0}ms fast=1`,
    );
    /* Unified per-request log (Phase 1 observability). */
    console.log(
      `[ai] lane=fast ep=chat provider=fast-path intent=canned` +
        ` fallback=0 in_bytes=${lastUser.length} hist=0 ms=${tEnd - t0}`,
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

  /* ─── Phase 5: local-knowledge short-circuit ─────────────────────
     If the user asked a definition we have in our offline glossary,
     serve it directly — no provider call, no streaming race, no
     latency beyond the auth round-trip. Runs AFTER the canned FAST
     path (so "hi" still beats even this) and BEFORE the streaming
     branch. Works for both streaming and non-streaming requests. */
  const ppForLocal = preprocessUserQuery(lastUser);
  const localAnswer = findLocalAnswer(ppForLocal.normalizedQuery || lastUser);
  if (localAnswer) {
    const detectedForLocal = detectLanguage(lastUser);
    const replyText = pickLocalAnswer(localAnswer, detectedForLocal.language);
    const tEnd = Date.now();
    console.log(
      `[ai] lane=fast ep=chat provider=local intent=definition` +
        ` pp_intent=${ppForLocal.intent}` +
        ` msg_lang=${detectedForLocal.language} conf=${detectedForLocal.confidence.toFixed(2)}` +
        ` rewrote=${ppForLocal.rewrote ? 1 : 0} fallback=0 local=1` +
        ` in_bytes=${lastUser.length} norm_bytes=${ppForLocal.normalizedQuery.length}` +
        ` hist=0 ms=${tEnd - t0} reply_bytes=${replyText.length}`,
    );

    if (wantsStream) {
      /* Match the streaming contract: emit start → delta (full text,
         one chunk) → end. Client's SSE reader can't tell the
         difference from a provider-streamed response. */
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            send({
              type: "start",
              lane: "FAST",
              intent: "knowledge",
              mode: "chat",
              promptBytes: 0,
              originalQuery: ppForLocal.originalQuery,
              normalizedQuery: ppForLocal.normalizedQuery,
              ppIntent: ppForLocal.intent,
              rewrote: ppForLocal.rewrote,
              messageLang: detectedForLocal.language,
              messageLangConfidence: detectedForLocal.confidence,
            }),
          );
          controller.enqueue(send({ type: "delta", text: replyText }));
          controller.enqueue(
            send({
              type: "end",
              provider: "local",
              lane: "FAST",
              intent: "knowledge",
              reply: replyText,
              fallback: 0,
              ttfb_ms: 0,
              total_ms: tEnd - t0,
            }),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }
    return NextResponse.json({ reply: replyText, provider: "local" });
  }

  /* Provider-required from here down. The canned FAST_REPLIES and
     local-knowledge short-circuits above don't need any provider;
     everything below does. */
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

  /* ─── Streaming branch (Phase 2) ─────────────────────────────────
     SSE response. Lane is decided by the router (FAST for chat/unknown,
     SMART for knowledge/business-in-chat). Events:
       · start — lane/intent/prompt size (for UI badges)
       · delta — a token chunk (append to assistant bubble)
       · end   — canonical sealed reply + provider + timings
     The client MUST replace its accumulated deltas with `end.reply`
     so the post-hoc pricing guard wins over streamed raw tokens. */
  if (wantsStream) {
    const clampedUser = clamp(lastUser, MAX_MESSAGE_CHARS);
    const encoder = new TextEncoder();
    const send = (obj: unknown) =>
      encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const tStreamStart = Date.now();
        let ttfbMs: number | null = null;
        let rawReply = "";
        let providerName = "fallback";
        let lane = "FAST";
        let intent = "unknown";
        let fallback: 0 | 1 = 1;
        /* Phase 3 preprocessor fields — captured from the `start`
           event and reported on the unified [ai] log line. */
        let ppIntent = "unknown";
        let normBytes = clampedUser.length;
        let rewrote = 0;
        /* Phase 4 language detection fields. */
        let msgLang = "EN";
        let msgLangConf = 0;
        try {
          for await (const ev of streamRouteAi({
            messages: [{ role: "user", content: clampedUser }],
            context: { userLang },
          })) {
            if (ev.type === "start") {
              lane = ev.lane;
              intent = ev.intent;
              ppIntent = ev.ppIntent;
              normBytes = ev.normalizedQuery.length;
              rewrote = ev.rewrote ? 1 : 0;
              msgLang = ev.messageLang;
              msgLangConf = ev.messageLangConfidence;
              controller.enqueue(send(ev));
            } else if (ev.type === "delta") {
              if (ttfbMs === null) ttfbMs = Date.now() - tStreamStart;
              rawReply += ev.text;
              controller.enqueue(send(ev));
            } else if (ev.type === "end") {
              providerName = ev.provider;
              fallback = ev.fallback;
              /* Post-hoc pricing seal on the canonical reply. Chat mode
                 has no tool evidence so any pricing-like text is
                 replaced with PRICING_GUARD_MESSAGE before the UI ever
                 persists the final text. */
              let sealed = sealPricingSafety(ev.reply, []);
              if (sealed !== ev.reply) {
                console.warn(
                  `[ai.chat.pricing-guard] replaced hallucinated pricing lane=${lane}`,
                );
              }
              /* Phase 11 L2: Egyptian dialect builder. When the user
                 wrote EGY or FRANCO, run the intent-aware Level 2
                 builder on the canonical reply so the client sees
                 natural Egyptian phrasing with the right opener.
                 Phase 16: for non-EGY replies, still dedupe. */
              if (msgLang === "EGY" || msgLang === "FRANCO") {
                const rebuilt = buildEgyptianResponse(sealed, {
                  intentType: analyzeIntent(lastUser).type,
                  seed: lastUser,
                });
                if (rebuilt !== sealed) {
                  console.log(
                    `[ai.chat.egy] rewrote for msg_lang=${msgLang}`,
                  );
                  sealed = rebuilt;
                }
              } else {
                const deduped = removeRepetition(sealed);
                if (deduped !== sealed) {
                  console.log(`[ai.chat.dedupe] removed repetitions`);
                  sealed = deduped;
                }
              }
              controller.enqueue(
                send({
                  type: "end",
                  provider: ev.provider,
                  lane: ev.lane,
                  intent: ev.intent,
                  reply: sealed,
                  fallback: ev.fallback,
                  ttfb_ms: ev.ttfbMs,
                  total_ms: ev.totalMs,
                }),
              );
              rawReply = sealed;
            }
          }
        } catch (e) {
          controller.enqueue(
            send({
              type: "error",
              message: e instanceof Error ? e.message : String(e),
            }),
          );
        } finally {
          const tEnd = Date.now();
          /* Unified per-request log (Phase 2). lane, ttfb, prompt size,
             fallback flag — everything ops needs in one grep prefix. */
          const laneLabel =
            lane === "SMART" ? "smart" : lane === "FAST" ? "fast" : "protected";
          console.log(
            `[ai] lane=${laneLabel} ep=chat provider=${providerName}` +
              ` intent=${intent} pp_intent=${ppIntent}` +
              ` msg_lang=${msgLang} conf=${msgLangConf.toFixed(2)}` +
              ` rewrote=${rewrote} fallback=${fallback} local=0` +
              ` in_bytes=${lastUser.length} norm_bytes=${normBytes} hist=0` +
              ` ttfb_ms=${ttfbMs ?? "-"} ms=${tEnd - t0}` +
              ` stream=1 reply_bytes=${rawReply.length}`,
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
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
    /* Legacy branch — with multi-provider fallback (PR #64) the router
       now returns status:"success" with provider:"fallback" on total
       outage, not status:"error". This block only fires on rare
       pre-routing errors (empty message array, invalid req shape).
       Kept as defense in depth; logs the detail for debugging. */
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
  /* Unified per-request log (Phase 1 observability). Lane = smart when
     knowledge-intent routes to the reasoning provider first; otherwise
     fast. fallback=1 flags that the router's synthetic answer served. */
  const lane = result.meta.routing === "knowledge" ? "smart" : "fast";
  console.log(
    `[ai] lane=${lane} ep=chat provider=${result.provider} intent=${result.meta.routing}` +
      ` fallback=${result.provider === "fallback" ? 1 : 0}` +
      ` in_bytes=${lastUser.length} hist=0 ms=${tEnd - t0}`,
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

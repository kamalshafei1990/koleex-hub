import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { supabaseServer } from "@/lib/server/supabase-server";
import { aiProviderConfigured, type ChatMessage } from "@/lib/server/ai-provider";
import { routeAi, streamRouteAi } from "@/lib/server/ai/router";
import { orchestrate } from "@/lib/server/ai-agent/orchestrator";
/* Phase 2B — seals imported from the seal layer, not through the orchestrator. */
import { sealPricingSafety, stripProcessNarration } from "@/lib/server/ai/seals";
/* Phase 2A — lane decision and the approved canned answers now come from
   core/, so this route no longer carries its own copy of either. */
import { isWorkDataQuery } from "@/lib/server/ai/core/decide-turn";
import { tryCannedReply } from "@/lib/server/ai/core/canned-replies";
import { buildUserContext } from "@/lib/server/ai-agent/permissions";
import { findLocalAnswer, pickLocalAnswer } from "@/lib/server/ai/local-knowledge";
import { detectLanguage } from "@/lib/server/ai/detect-language";
/* The browser is told the LANE, not the vendor — see
   ai/observability/public-provider.ts (finding N11). */
import { publicProviderLabel } from "@/lib/server/ai/observability/public-provider";
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

   Response contract is unchanged in SHAPE: { reply, provider }. Callers
   continue to read `reply`; no caller in the app reads `provider` at all.

   WHAT `provider` CARRIES CHANGED (finding N11, review pass). It used to be
   the router's ProviderName — "groq", "deepseek" — which named the vendor to
   anyone with devtools for no consumer. It now goes through
   publicProviderLabel(), which keeps the LANE and drops the vendor half. The
   field is still present and still a string, so a standalone client that pins
   this response shape is unaffected; only the value is neutral. The real label
   is still written to ai_messages.provider, because the audit trail is not the
   browser.

   /api/ai/agent is untouched by this change. Its orchestrator remains
   the authoritative agent path with its own tool-loop behaviour.
   --------------------------------------------------------------------------- */


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
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  /* Identity for the prompt. The chat lane never passed one, so its
     "Current user" slot was always empty and the model concluded it had no
     idea who it was talking to — inside that user's own session. One extra
     lookup, same shape the agent lane already uses. */
  const viewerRes = await supabaseServer
    .from("accounts")
    .select("username, person:person_id(full_name), role:role_id(name), preferences")
    .eq("id", auth.account_id)
    .maybeSingle();
  const vRow = viewerRes.data as unknown as {
    username?: string;
    person?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
    role?: { name?: string | null } | Array<{ name?: string | null }> | null;
    preferences?: { ai_memory?: Record<string, string> } | null;
  } | null;
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  const viewer = {
    name: pickOne(vRow?.person)?.full_name ?? null,
    username: auth.username,
    role: pickOne(vRow?.role)?.name ?? null,
    department: auth.department ?? null,
  };
  const memory: Record<string, string> = {};
  for (const [k, val] of Object.entries(vRow?.preferences?.ai_memory ?? {})) {
    if (typeof k === "string" && typeof val === "string" && k.length <= 40 && val.length <= 200) {
      memory[k] = val;
    }
  }

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
  const fast = tryCannedReply(lastUser);
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
    /* Belt-and-braces pricing guard on canned replies. The shared
       CANNED_REPLIES table has no pricing patterns so this is a no-op
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

  /* Provider-required from here down. The canned replies and the
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

  /* ─── Work-tools lane (Discuss pinned Koleex AI parity) ──────────
     This route backs the Discuss "Koleex AI" chat (useAiChat), which
     historically had NO tools — "what are my tasks?" deflected, and a
     "create/assign a task" request could only be hallucinated. Work &
     schedule queries — and the short "yes" confirmation turn that
     follows a WRITE-WITH-CONFIRM preview — now run through the SAME
     orchestrator the /ai app uses: identical tools, identical
     permission gates, identical preview→confirm protocol. Everything
     else keeps the light tool-less lanes below. The client history is
     what the browser sent — same trust level as `content` itself; the
     orchestrator treats it as conversation text only. */
  const historyForAgent = msgs.slice(-7, -1).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content ?? "").slice(0, MAX_MESSAGE_CHARS),
  }));
  const lastAssistantTurn =
    [...historyForAgent].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const assistantAskedConfirm =
    /confirm|تأكيد|أكّ?د|أؤكد|确认|هل أنفذ/i.test(lastAssistantTurn);
  /* Mid-flow structural rule (same as the agent route): a short reply to
     an assistant QUESTION — confirm turn, detail turn, "which one?" turn —
     must reach the tool loop, or the tool-less lanes fabricate the write. */
  const assistantAskedQuestion = /[?؟？]\s*$/.test(lastAssistantTurn.trim());
  const isMidFlowReply =
    (assistantAskedConfirm || assistantAskedQuestion) && lastUser.trim().length <= 300;
  if (isWorkDataQuery(lastUser) || isMidFlowReply) {
    /* Groups this surface's rows in ai_tool_calls (uuid column, no FK).
       account_id already identifies the person; this marks the lane. */
    const DISCUSS_AGENT_CONVERSATION_ID = "00000000-0000-0000-0000-00000000d15c";
    const detectedWork = detectLanguage(lastUser);
    const wantsRewrite =
      detectedWork.language === "EGY" || detectedWork.language === "FRANCO";
    const ctx = await buildUserContext(auth);
    const langForAgent: "en" | "zh" | "ar" =
      userLang === "zh" ? "zh" : userLang === "ar" ? "ar" : "en";

    const polish = (raw: string): string => {
      let out = stripProcessNarration(raw);
      if (wantsRewrite) {
        out = buildEgyptianResponse(out, {
          intentType: analyzeIntent(lastUser).type,
          seed: lastUser,
        });
      } else {
        out = removeRepetition(out);
      }
      return out;
    };

    if (wantsStream) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let alive = true;
          /* SSE ":" comments keep proxies from closing the connection
             while the tool loop runs — the client parser ignores them. */
          const keepalive = setInterval(() => {
            if (!alive) return;
            try {
              controller.enqueue(encoder.encode(": ping\n\n"));
            } catch {
              /* Controller closed — nothing to do. */
            }
          }, 1500);
          try {
            controller.enqueue(
              send({ type: "start", lane: "AGENT", intent: "work", mode: "agent" }),
            );
            let liveDeltaCount = 0;
            const agent = await orchestrate({
              dialect: wantsRewrite ? ("egyptian" as const) : null,
              onDelta: (text) => {
                liveDeltaCount++;
                controller.enqueue(send({ type: "delta", text }));
              },
              ctx,
              history: historyForAgent,
              userMessage: clamp(lastUser, MAX_MESSAGE_CHARS),
              userLang: langForAgent,
              conversationId: DISCUSS_AGENT_CONVERSATION_ID,
            });
            const finalReply = polish(agent.finalReply ?? "");
            if (liveDeltaCount === 0 && finalReply) {
              controller.enqueue(send({ type: "delta", text: finalReply }));
            }
            controller.enqueue(
              send({
                type: "end",
                provider: publicProviderLabel(agent.provider),
                lane: "AGENT",
                intent: "work",
                reply: finalReply,
                fallback: 0,
                ttfb_ms: 0,
                total_ms: Date.now() - t0,
              }),
            );
            console.log(
              `[ai] lane=agent ep=chat provider=${agent.provider} intent=work` +
                ` midflow=${isMidFlowReply ? 1 : 0} fallback=0` +
                ` in_bytes=${lastUser.length} hist=${historyForAgent.length}` +
                ` ms=${Date.now() - t0} stream=1 reply_bytes=${finalReply.length}`,
            );
          } catch (e) {
            controller.enqueue(
              send({
                type: "error",
                message: e instanceof Error ? e.message : String(e),
              }),
            );
          } finally {
            alive = false;
            clearInterval(keepalive);
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

    /* Non-streaming callers get the same lane as plain JSON. */
    const agent = await orchestrate({
      dialect: wantsRewrite ? ("egyptian" as const) : null,
      ctx,
      history: historyForAgent,
      userMessage: clamp(lastUser, MAX_MESSAGE_CHARS),
      userLang: langForAgent,
      conversationId: DISCUSS_AGENT_CONVERSATION_ID,
    });
    const reply = polish(agent.finalReply ?? "");
    console.log(
      `[ai] lane=agent ep=chat provider=${agent.provider} intent=work` +
        ` midflow=${isMidFlowReply ? 1 : 0} fallback=0` +
        ` in_bytes=${lastUser.length} hist=${historyForAgent.length}` +
        ` ms=${Date.now() - t0} stream=0 reply_bytes=${reply.length}`,
    );
    return NextResponse.json({ reply, provider: publicProviderLabel(agent.provider) });
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
            context: { userLang, viewer, memory },
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
                  provider: publicProviderLabel(ev.provider),
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
    context: { userLang, viewer, memory },
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
  /* Backward-compatible response: existing callers only read `reply`.
     `provider` is kept in the shape but carries the lane, not the vendor —
     publicProviderLabel() turns "groq:llama-…" into "model". */
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
  return NextResponse.json({ reply: safeReply, provider: publicProviderLabel(result.provider) });
}

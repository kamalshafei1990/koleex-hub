import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/agent
     body: { conversationId: string, content: string, user_lang?: 'en'|'zh'|'ar' }
     response: AgentResponse  (see ai-agent/types.ts)

   Thin wrapper around the orchestrator:
   - requireAuth() + ownership check (sequential — 404 must stay side-effect-free)
   - fast-path for canned prompts (greetings / identity / thanks / acks):
       · skips history SELECT + buildUserContext + orchestrator entirely
       · three parallel DB writes (user insert, assistant insert, conv update)
       · response shape identical to the orchestrator path
   - non-canned path:
       · history SELECT (last 10), buildUserContext, user-insert run in parallel
       · orchestrate() once dependencies resolve
       · assistant-insert + conversation update run in parallel

   Conversation storage stays in the existing ai_conversations /
   ai_messages tables so the sidebar, rename, delete flows keep
   working. Tool-call and tool-result steps live only in the wire
   response (replayed to the UI in this turn, then the audit table
   is the permanent record).

   Timing log: [ai.agent.timing] reports auth / conv / deps / orch / writes
   / total ms. canned=1 flag marks the fast-path branch.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { buildUserContext } from "@/lib/server/ai-agent/permissions";
import {
  orchestrate,
  classifyBrandSection,
  isSmallTalk,
  isBusinessDataQuery,
  buildBrandSystemPrompt,
  buildMinimalSystemPrompt,
  sealPricingSafety,
} from "@/lib/server/ai-agent/orchestrator";
import { groqChatStream } from "@/lib/server/ai/providers/groq";
import { buildSmartPrompt } from "@/lib/server/ai/prompt-builder";
import { detectLanguage } from "@/lib/server/ai/detect-language";
import { analyzeIntent } from "@/lib/server/ai/analyze-intent";
import { convertFrancoToArabic } from "@/lib/language/franco-converter";
import { buildEgyptianResponse } from "@/lib/language/rewrite-egyptian";
import type { AgentResponse, AgentStep } from "@/lib/server/ai-agent/types";

/* Hard cap on history we ship to the orchestrator. 6 messages = 3
   user+assistant pairs; enough for short-term multi-turn context,
   small enough to keep agent payloads tight (30–40% smaller than the
   old 10-message cap). Pure performance/stability cap — does not
   alter tool routing or business behaviour. */
const HISTORY_LIMIT = 6;

/* Canned fast-path mirror. Keep in sync with /api/ai/chat FAST_REPLIES
   and orchestrator.ts. Matched server-side before any provider call —
   skips buildUserContext + history SELECT + orchestrator entirely so
   greetings / identity / acks return in roughly the auth+writes budget
   instead of auth+6-round-trips+provider. */
/* Canned replies using the APPROVED Section 3 (Basic Conversation)
   text verbatim. Exact-match regexes only — variations still flow
   to the orchestrator and get a natural response. Q9 "what are
   you?" intentionally NOT here — it routes through brand knowledge
   for the Section 2 identity answer. */
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
  // Q1 — greetings
  [/^(hi|hello|hey|yo|hola)[\s,!.?]*$/i,                       Q1_GREETING],
  [/^(good\s+(morning|afternoon|evening|night))[\s,!.?]*$/i,   Q1_GREETING],
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

  /* Identity questions (Q9 "what are you", "who are you", "who
     created you", "what can you do") DROPPED — they flow through
     the orchestrator for Section 2 brand-knowledge answers. */

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

/** Auto-title rule — identical to /chat. Pulled into a helper so the
 *  canned and non-canned branches can share it without drift. */
function computeTitle(
  conv: { title: string | null; message_count: number | null },
  content: string,
): string | null {
  if ((conv.title !== "New chat" && conv.title) || (conv.message_count ?? 0) !== 0) {
    return conv.title;
  }
  const trimmed = content.trim();
  const words = trimmed.split(/\s+/);
  return words.length <= 4
    ? trimmed.slice(0, 60)
    : words.slice(0, 4).join(" ").slice(0, 60);
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const auth = await requireAuth();
  const tAuth = Date.now();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    content?: string;
    user_lang?: "en" | "zh" | "ar";
    stream?: boolean;
  };

  const content = body.content?.trim();
  const conversationId = body.conversationId;
  const wantsStream =
    body.stream === true || req.headers.get("accept") === "text/event-stream";
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  /* Confirm the conversation is mine. Must stay sequential — a 404
     should be side-effect-free; no inserts fire if the conv isn't ours. */
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  const tConv = Date.now();
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userLang: "en" | "zh" | "ar" =
    body.user_lang === "zh" ? "zh" :
    body.user_lang === "ar" ? "ar" :
    "en";

  /* ─── Fast-path: canned reply ────────────────────────────────
     Skips buildUserContext + history SELECT + orchestrate. Writes
     (user turn, assistant turn, conversation update) are independent
     once we know the conversation is ours, so run them in parallel. */
  const fast = tryFastReply(content);
  if (fast) {
    const finalTitle = computeTitle(conv, content);
    const [, assistantInsert] = await Promise.all([
      supabaseServer.from("ai_messages").insert({
        tenant_id: auth.tenant_id,
        conversation_id: conversationId,
        role: "user",
        content,
      }),
      supabaseServer
        .from("ai_messages")
        .insert({
          tenant_id: auth.tenant_id,
          conversation_id: conversationId,
          role: "assistant",
          content: fast,
          provider: "fast-path",
        })
        .select("*")
        .single(),
      supabaseServer
        .from("ai_conversations")
        .update({
          title: finalTitle,
          last_preview: fast.slice(0, 180),
          message_count: (conv.message_count ?? 0) + 2,
        })
        .eq("id", conversationId)
        .eq("tenant_id", auth.tenant_id)
        .eq("account_id", auth.account_id),
    ]);
    const tEnd = Date.now();
    console.log(
      `[ai.agent.timing] auth=${tAuth - t0}ms conv=${tConv - tAuth}ms` +
        ` writes=${tEnd - tConv}ms total=${tEnd - t0}ms canned=1`,
    );
    /* Unified per-request log (Phase 1 observability). One line per AI
       request across chat + agent so ops can grep a single prefix to
       see lane / endpoint / provider / intent / fallback / sizes / ms. */
    console.log(
      `[ai] lane=protected ep=agent provider=fast-path intent=canned` +
        ` fallback=0 in_bytes=${content.length} hist=0 ms=${tEnd - t0}`,
    );

    const agent: AgentResponse = {
      steps: [{ kind: "answer", text: fast, permissionStatus: "allowed" }],
      finalReply: fast,
      provider: "fast-path",
      conversationId,
    };

    /* Phase 9 fix: when the client asked for SSE, emit this canned
       reply AS SSE (start → delta → end) so the uniform stream parser
       on the client doesn't end up scanning JSON for event frames
       and crashing to "No reply was received". Non-streaming callers
       continue to get the legacy JSON shape. */
    if (wantsStream) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(send({ type: "start", conversationId }));
          controller.enqueue(send({ type: "delta", text: fast }));
          controller.enqueue(
            send({
              type: "end",
              agent,
              message: assistantInsert.data,
              conversation: { id: conversationId, title: finalTitle },
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

    return NextResponse.json({
      agent,
      message: assistantInsert.data,
      conversation: { id: conversationId, title: finalTitle },
    });
  }

  /* ─── Streaming branch (Phase 6) ────────────────────────────
     SSE response. Runs the exact same orchestrator as the JSON path,
     then pseudo-streams the finalReply in small chunks so the UI
     can show progressive reveal + typing indicator.

     Events:
       start — turn kicked off; UI shows typing dots
       steps — tool-call / tool-result chips for the turn (if any)
       delta — a chunk of the finalReply text
       end   — persisted message + conversation update

     DB persistence runs in parallel with the text stream so the user
     never waits on the write — the end event includes the persisted
     row once it's available. */
  if (wantsStream) {
    const encoder = new TextEncoder();
    const send = (obj: unknown) =>
      encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(send({ type: "start", conversationId }));

          /* Load history + ctx + insert user turn in parallel, same
             as the JSON path — but emit a keepalive comment every
             ~1.5s so intermediate proxies don't close the connection
             and the client sees activity even when orchestrate is slow. */
          const [historyRes, ctx] = await Promise.all([
            supabaseServer
              .from("ai_messages")
              .select("role, content, created_at")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: false })
              .limit(HISTORY_LIMIT),
            buildUserContext(auth),
            supabaseServer.from("ai_messages").insert({
              tenant_id: auth.tenant_id,
              conversation_id: conversationId,
              role: "user",
              content,
            }),
          ]);

          const history = (historyRes.data ?? [])
            .slice()
            .reverse()
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content as string,
            }));

          /* Keepalive comments while orchestrate / fast-path runs.
             SSE treats lines starting with ":" as comments — they
             keep the connection warm without triggering client events. */
          let alive = true;
          const keepalive = setInterval(() => {
            if (!alive) return;
            try {
              controller.enqueue(encoder.encode(": ping\n\n"));
            } catch {
              /* Controller closed — nothing to do. */
            }
          }, 1500);

          /* ── Fast-path streaming (Phase 7 + Phase 10) ────────────
             Three lanes that bypass the heavy business-agent orchestrator:

               · brand     — buildBrandSystemPrompt + Groq stream
               · small     — buildMinimalSystemPrompt + Groq stream
               · general   — buildSmartPrompt + Groq stream (Phase 10)

             The GENERAL lane handles "any question" — definitions,
             explanations, translations, history, math, advice, coding
             help, casual chat — basically everything ChatGPT answers.
             We decide based on isBusinessDataQuery(): if it looks like
             a query that needs Koleex data (customers, invoices,
             products, quotations, order lookup, etc.) we fall through
             to the orchestrator so tool schemas, permissions, pricing
             guards all apply. Otherwise the open-assistant SMART
             prompt takes over and the model is free to answer. */
          /* ── Phase 11: Egyptian dialect engine — input normalisation ──
             If the user wrote Franco Arabic (Arabizi), convert it to
             proper Arabic script BEFORE sending to the model. Gives
             the model a cleaner input and lets the persona lock +
             rewrite layer do the rest. All other detection (brand /
             small / business) runs on the NORMALISED text so patterns
             like "عامل ايه" still match for Egyptian speakers who
             happened to type it in Franco ("3amel eh"). */
          const detected = detectLanguage(content);
          const wantsRewrite =
            detected.language === "EGY" || detected.language === "FRANCO";
          const normalizedContent =
            detected.language === "FRANCO"
              ? convertFrancoToArabic(content)
              : content;

          const brandSection = classifyBrandSection(normalizedContent);
          const isBrand = brandSection !== "none";
          const isSmall = isSmallTalk(normalizedContent);
          const isBusinessData = isBusinessDataQuery(normalizedContent);
          const fastPathKey = process.env.GROQ_API_KEY;
          let fastReply: string | null = null;
          let fastProvider: string | null = null;
          let fastLane: "brand" | "small" | "general" | null = null;

          const canFastPath = fastPathKey && (
            isBrand || isSmall || !isBusinessData
          );

          if (canFastPath) {
            fastLane = isBrand ? "brand" : isSmall ? "small" : "general";
            const analysis = analyzeIntent(normalizedContent);
            const systemPrompt =
              fastLane === "brand"
                ? buildBrandSystemPrompt(
                    ctx,
                    userLang,
                    brandSection as "company" | "ai" | "both",
                  )
                : fastLane === "small"
                  ? buildMinimalSystemPrompt(ctx, userLang)
                  : /* general */
                    buildSmartPrompt(normalizedContent, {
                      userLang,
                      messageLang: detected.language,
                      messageLangConfidence: detected.confidence,
                      intentType: analysis.type,
                      complexity: analysis.complexity,
                      expectedFormat: analysis.expectedFormat,
                    })[0].content;
            const fastMessages = [
              { role: "system" as const, content: systemPrompt },
              ...history,
              { role: "user" as const, content: normalizedContent },
            ];
            /* Token budget per lane. General gets a bigger ceiling
               than small-talk so explanations can breathe but still
               bounded so we don't run away on open-ended prompts. */
            const maxTokens =
              fastLane === "brand" ? 1200
              : fastLane === "small" ? 200
              : 1400;
            let accumulated = "";
            let gotFirst = false;
            try {
              for await (const ch of groqChatStream(fastMessages, {
                maxTokens,
              })) {
                if (ch.type === "delta" && ch.text) {
                  if (!gotFirst) gotFirst = true;
                  accumulated += ch.text;
                  controller.enqueue(send({ type: "delta", text: ch.text }));
                } else if (ch.type === "done") {
                  fastReply = ch.text ?? accumulated;
                  fastProvider = ch.provider ?? "groq:stream";
                } else if (ch.type === "error") {
                  /* Drop what we have and fall through to orchestrate.
                     Can't "un-emit" the deltas the client already got —
                     but gotFirst will be false on TTFB-timeout / auth
                     errors, which is the only realistic pre-first-
                     token failure mode. */
                  if (gotFirst) {
                    fastReply = accumulated || null;
                    fastProvider = "groq:stream";
                  }
                  break;
                }
              }
            } catch {
              /* Generator threw — fall through to orchestrate. */
            }
          }

          let agent: AgentResponse;
          if (fastReply !== null) {
            /* Fast-path served. Build a minimal AgentResponse shape so
               the persistence + end-event code below stays identical
               between the two branches. sealPricingSafety runs with no
               evidence steps — any pricing-like content in a brand /
               small-talk reply gets replaced with PRICING_GUARD_MESSAGE. */
            const sealed = sealPricingSafety(fastReply, []);
            agent = {
              steps: [
                { kind: "answer", text: sealed, permissionStatus: "allowed" },
              ],
              finalReply: sealed,
              provider: fastProvider ?? "groq:stream",
              conversationId: conversationId!,
            };
            /* If sealPricingSafety redacted content, the client has
               already seen raw deltas. The `end` event below carries
               the sealed reply and the client replaces its buffer
               with end.agent.finalReply — same contract as chat. */
          } else {
            agent = await orchestrate({
              ctx,
              history,
              userMessage: content,
              userLang,
              conversationId: conversationId!,
            });

            /* Emit tool-chip steps up front so the UI can render them
               above the streamed answer — mirrors how ChatGPT shows
               "Used tool: X" chips while the answer is still typing. */
            const toolSteps: AgentStep[] = agent.steps.filter(
              (s) => s.kind !== "answer",
            );
            if (toolSteps.length > 0) {
              controller.enqueue(send({ type: "steps", steps: toolSteps }));
            }

            /* Pseudo-stream the finalReply. Chunk size + delay
               calibrated to feel natural without dragging the total
               time out:
                 · ~28 chars/chunk
                 · 12 ms between chunks → ~2 200 chars/sec visible rate
               A 200-word (~1 200 char) answer streams in ~520 ms. */
            const full = agent.finalReply ?? "";
            const CHUNK = 28;
            for (let i = 0; i < full.length; i += CHUNK) {
              const text = full.slice(i, i + CHUNK);
              controller.enqueue(send({ type: "delta", text }));
              if (i + CHUNK < full.length) {
                await new Promise((r) => setTimeout(r, 12));
              }
            }
          }

          alive = false;
          clearInterval(keepalive);

          /* ── Phase 11 L2: Egyptian dialect response builder ───────
             Replaces the plain rewriter with the intent-aware Level 2
             builder. When the user wrote EGY or FRANCO, the output
             gets:
               · scrubbed of translator notes, MSA "لا أفهم" phrases,
                 system-text leaks
               · replaced with a natural clarify phrase if the model
                 was trying to ask for clarification in MSA/English
               · phrase-level Egyptian rewrites
               · an intent-aware opener (بص خليني اشرحلك... for
                 explanations, ببساطة كده... for definitions) when
                 the reply is substantive
             When nothing fires (model already landed in Egyptian
             with a clean reply) the builder is a no-op. */
          let rewroteReply = false;
          if (wantsRewrite && agent.finalReply) {
            const intentForBuilder =
              isBrand || isSmall
                ? "chat"
                : analyzeIntent(normalizedContent).type;
            const rebuilt = buildEgyptianResponse(agent.finalReply, {
              intentType: intentForBuilder,
              seed: normalizedContent,
            });
            if (rebuilt !== agent.finalReply) {
              agent = { ...agent, finalReply: rebuilt };
              rewroteReply = true;
            }
          }

          /* Persist in parallel with the stream close. The user sees
             the full text by now; the DB write can finish after the
             controller closes without affecting UX. */
          const finalTitle = computeTitle(conv, content);
          const [assistantInsert] = await Promise.all([
            supabaseServer
              .from("ai_messages")
              .insert({
                tenant_id: auth.tenant_id,
                conversation_id: conversationId,
                role: "assistant",
                content: agent.finalReply,
                provider: agent.provider,
              })
              .select("*")
              .single(),
            supabaseServer
              .from("ai_conversations")
              .update({
                title: finalTitle,
                last_preview: agent.finalReply.slice(0, 180),
                message_count: (conv.message_count ?? 0) + 2,
              })
              .eq("id", conversationId)
              .eq("tenant_id", auth.tenant_id)
              .eq("account_id", auth.account_id),
          ]);

          const tEnd = Date.now();
          controller.enqueue(
            send({
              type: "end",
              agent,
              message: assistantInsert.data,
              conversation: { id: conversationId, title: finalTitle },
              total_ms: tEnd - t0,
            }),
          );
          console.log(
            `[ai] lane=${fastLane ?? "protected"} ep=agent provider=${agent.provider} intent=agent` +
              ` fallback=${agent.provider === "fallback" ? 1 : 0}` +
              ` fast_stream=${fastReply !== null ? 1 : 0}` +
              ` msg_lang=${detected.language} rewrote_egy=${rewroteReply ? 1 : 0}` +
              ` in_bytes=${content.length} hist=${history.length} ms=${tEnd - t0}` +
              ` stream=1 reply_bytes=${agent.finalReply.length}`,
          );
        } catch (e) {
          controller.enqueue(
            send({
              type: "error",
              message: e instanceof Error ? e.message : String(e),
            }),
          );
        } finally {
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

  /* ─── Non-canned path ────────────────────────────────────────
     History load, permission context build, and the user-turn insert
     are independent of each other — Promise.all them. Orchestrate only
     needs history + ctx; the user insert is fire-and-wait purely so we
     don't lose the turn on a provider blip. */
  const [historyRes, ctx] = await Promise.all([
    supabaseServer
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    buildUserContext(auth),
    supabaseServer.from("ai_messages").insert({
      tenant_id: auth.tenant_id,
      conversation_id: conversationId,
      role: "user",
      content,
    }),
  ]);
  const tDeps = Date.now();

  /* Query pulled newest-first with a limit, then flipped back to
     chronological order for the orchestrator. Behaviour (tool routing,
     multi-turn context) is unchanged — only the window size is bounded. */
  const history = (historyRes.data ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const agent = await orchestrate({
    ctx,
    history,
    userMessage: content,
    userLang,
    conversationId,
  });
  const tOrch = Date.now();

  /* Final writes — assistant insert + conversation meta update are
     independent, so run them in parallel. */
  const finalTitle = computeTitle(conv, content);
  const [assistantInsert] = await Promise.all([
    supabaseServer
      .from("ai_messages")
      .insert({
        tenant_id: auth.tenant_id,
        conversation_id: conversationId,
        role: "assistant",
        content: agent.finalReply,
        provider: agent.provider,
      })
      .select("*")
      .single(),
    supabaseServer
      .from("ai_conversations")
      .update({
        title: finalTitle,
        last_preview: agent.finalReply.slice(0, 180),
        message_count: (conv.message_count ?? 0) + 2,
      })
      .eq("id", conversationId)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id),
  ]);
  const tEnd = Date.now();
  console.log(
    `[ai.agent.timing] auth=${tAuth - t0}ms conv=${tConv - tAuth}ms` +
      ` deps=${tDeps - tConv}ms orch=${tOrch - tDeps}ms writes=${tEnd - tOrch}ms` +
      ` total=${tEnd - t0}ms canned=0`,
  );
  /* Unified per-request log (Phase 1 observability). Mirrors the chat
     route's [ai] line. `provider` is whatever the orchestrator settled
     on (groq/deepseek/gemini/fallback); intent is reported as "agent"
     for tool-loop turns (the orchestrator's own brand fast-path logs
     its own line separately). */
  console.log(
    `[ai] lane=protected ep=agent provider=${agent.provider} intent=agent` +
      ` fallback=${agent.provider === "fallback" ? 1 : 0}` +
      ` in_bytes=${content.length} hist=${history.length} ms=${tEnd - t0}`,
  );

  return NextResponse.json({
    agent,
    message: assistantInsert.data,
    conversation: { id: conversationId, title: finalTitle },
  });
}

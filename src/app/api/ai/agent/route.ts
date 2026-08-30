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
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { fenceUntrusted, newFenceId } from "@/lib/server/ai/security/untrusted";
import { consumeBudget, limitMode, BUDGETS, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { ATTACH_SPLIT, resolveHistoryAttachEmbeds } from "@/lib/server/ai/attach-embed";
import { getTaughtAnswersBlock, getKnowledgeNudgeBlock } from "@/lib/server/ai-knowledge";
import { buildUserContext, checkModule } from "@/lib/server/ai-agent/permissions";
import {
  orchestrate,
  buildBrandSystemPrompt,
  buildMinimalSystemPrompt,
  sealPricingSafety,
  stripProcessNarration,
} from "@/lib/server/ai-agent/orchestrator";
/* Phase 2A — the lane decision now comes from the module that owns it,
   not from the orchestrator that used to re-export it. */
import {
  classifyBrandSection,
  isSmallTalk,
  isBusinessDataQuery,
  isWorkDataQuery,
  isLiveInfoQuery,
} from "@/lib/server/ai/core/decide-turn";
import { tryCannedReply } from "@/lib/server/ai/core/canned-replies";
import { deepseekChatStream } from "@/lib/server/ai/providers/deepseek";
import { buildSmartPrompt } from "@/lib/server/ai/prompt-builder";
import {
  detectLanguageDirective,
  getReplyLanguage,
  setReplyLanguage,
  replyLanguageLock,
} from "@/lib/server/ai/reply-language";
import { detectLanguage } from "@/lib/server/ai/detect-language";
import { analyzeIntent } from "@/lib/server/ai/analyze-intent";
import { convertFrancoToArabic } from "@/lib/language/franco-converter";
import { buildEgyptianResponse, removeRepetition } from "@/lib/language/rewrite-egyptian";
import { detectEntityScope } from "@/lib/server/ai/entity-scope";
import type { AgentResponse, AgentStep } from "@/lib/server/ai-agent/types";

/* Conversation memory window. 6 messages (3 exchanges) turned out to be
   the reason Koleex AI felt like a question-answerer rather than a
   conversation partner — anything said four exchanges ago was simply gone
   (owner: "make sure it has a memory and can remember the conversation").
   60 messages = 30 exchanges, bounded by HISTORY_CHAR_BUDGET so a
   long-winded thread cannot blow the payload: messages are kept newest-
   first until the budget runs out, so it degrades to exactly the old
   behaviour under heavy load. Attachment embeds stay bounded separately —
   resolveHistoryAttachEmbeds keeps only the newest document's text. */
const HISTORY_LIMIT = 60;
const HISTORY_CHAR_BUDGET = 48000;

/** Newest-first char-budget trim, applied AFTER the chronological flip:
 *  drop the OLDEST messages once the running total exceeds the budget. */
function trimHistoryToBudget<T extends { content: string }>(history: T[]): T[] {
  let total = 0;
  const kept: T[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    total += history[i].content.length;
    if (total > HISTORY_CHAR_BUDGET && kept.length > 0) break;
    kept.unshift(history[i]);
  }
  return kept;
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
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  /* ── AUDIT ISSUE 4 (P0): rate limiting ────────────────────────────────
     Nothing bounded AI volume before this. Authentication and
     requireInternalUser stop strangers; they do nothing about a compromised
     account or a client stuck in a retry loop, where each request costs four
     model calls. Checked AFTER auth so the counter is keyed to a real
     account, and before any provider work so a blocked request costs nothing.
     Fails OPEN if the counter store is unreachable — see the module header. */
  if (limitMode() !== "off") {
    const [perAccount, perTenant] = await Promise.all([
      consumeBudget(subjectFor.account(auth.account_id), BUDGETS.turnPerAccount()),
      consumeBudget(subjectFor.tenant(auth.tenant_id), BUDGETS.turnPerTenant()),
    ]);
    const hit = !perAccount.allowed ? perAccount : !perTenant.allowed ? perTenant : null;
    if (hit && !hit.allowed) {
      const scope = !perAccount.allowed ? "account" : "tenant";
      console.warn(`[ai.ratelimit] ep=agent scope=${scope} count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json(
          { error: "Koleex AI is handling a lot of requests from your account right now. Give it a moment and try again." },
          { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } },
        );
      }
    }
  }

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    content?: string;
    user_lang?: "en" | "zh" | "ar";
    stream?: boolean;
    /** Extracted by /api/ai/attachments — name + plain text only. */
    attachments?: Array<{ name?: string; text?: string }>;
    /** The composer's globe control. A nudge, not a command: it tells the
     *  orchestrator the user explicitly wants the web checked this turn. */
    web_search?: boolean;
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

  /* ── Attachments (owner feature 2026-08-03) ──
     Text was extracted by /api/ai/attachments. The FULL text rides only
     into the MODEL turn (attachBlock); the persisted user message gets a
     slim 📎 marker so history and later-turn payloads stay small. */
  const rawAtt = Array.isArray(body.attachments) ? body.attachments : [];
  let attBudget = 60000;
  const attFinal = rawAtt
    .filter((a) => a && typeof a.name === "string" && typeof a.text === "string" && a.text.trim())
    .slice(0, 6)
    .map((a) => {
      const text = String(a.text).slice(0, Math.max(0, Math.min(30000, attBudget)));
      attBudget -= text.length;
      return { name: String(a.name).slice(0, 120), text };
    })
    .filter((a) => a.text.length > 0);
  const attachMarker = attFinal.length
    ? "\n\n" + attFinal.map((a) => `📎 ${a.name}`).join("\n")
    : "";
  /* AUDIT ISSUE 5 (P0) — extracted text is fenced, not pasted.
     The previous framing said "answer using it" with a CONSTANT `"""`
     delimiter: a document containing its own `"""` line closed the fence
     early and everything after it read as top-level conversation. The fence
     id is now a per-turn nonce the document cannot have been written to
     contain. Images arrive through this same path (vision output is text),
     so this covers photographed instructions too. */
  const fenceId = newFenceId();
  const attachBlock = attFinal
    .map((a) => fenceUntrusted(a.text, "document", a.name, fenceId))
    .join("");


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

  /* ── Reply language ──
     The interface language is only the DEFAULT. A user who has said "always
     answer me in Arabic" gets Arabic even while typing English, and that
     preference has to survive into conversations that haven't started yet —
     the previous behaviour lived in the system prompt, so a new chat began
     with no memory of it at all.

     Detected deterministically rather than through a tool: the fast lanes
     below carry no tools, and they handle exactly the kind of short message
     this instruction arrives in. */
  const uiLang: "en" | "zh" | "ar" =
    body.user_lang === "zh" ? "zh" :
    body.user_lang === "ar" ? "ar" :
    "en";

  const directive = detectLanguageDirective(content);
  let lockedLang = await getReplyLanguage(auth.account_id);
  if (directive === "clear") {
    lockedLang = null;
    void setReplyLanguage(auth.account_id, null);
  } else if (directive) {
    lockedLang = directive;
    /* Fire-and-forget: the preference write must never delay the reply, and
       this turn already uses the new value from memory. */
    void setReplyLanguage(auth.account_id, directive);
  }

  const userLang: "en" | "zh" | "ar" = lockedLang ?? uiLang;
  const langLock = lockedLang ? replyLanguageLock(lockedLang) : "";

  /* ─── Fast-path: canned reply ────────────────────────────────
     Skips buildUserContext + history SELECT + orchestrate. Writes
     (user turn, assistant turn, conversation update) are independent
     once we know the conversation is ours, so run them in parallel. */
  const fast = attFinal.length > 0 ? null : tryCannedReply(content);
  if (fast) {
    const finalTitle = computeTitle(conv, content);
    const [, assistantInsert] = await Promise.all([
      supabaseServer.from("ai_messages").insert({
        tenant_id: auth.tenant_id,
        conversation_id: conversationId,
        role: "user",
        content: content + attachMarker,
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
        /* Audit P1 #4 — lifted out of try{} so the finally{} block at
           the bottom can always clearInterval(), even when an early
           load step throws before the original `const keepalive` line. */
        let alive = true;
        let keepalive: ReturnType<typeof setInterval> | null = null;
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
              content: content + attachMarker + (attachBlock ? ATTACH_SPLIT + attachBlock : ""),
            }),
          ]);

          const history = trimHistoryToBudget(
            resolveHistoryAttachEmbeds(
              (historyRes.data ?? [])
                .slice()
                .reverse()
                .map((m) => ({
                  role: m.role as "user" | "assistant",
                  content: m.content as string,
                })),
            ),
          );

          /* Keepalive comments while orchestrate / fast-path runs.
             SSE treats lines starting with ":" as comments — they
             keep the connection warm without triggering client events. */
          keepalive = setInterval(() => {
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

          /* Phase 19: Koleex entity-scope detection. Feeds a per-turn
             directive into the prompt so the model says
             "Koleex International Group" for company questions,
             "Koleex Hub" for platform questions, "Koleex machines"
             for product questions — never mixes them up. */
          const entity = detectEntityScope(normalizedContent, history);

          const brandSection = classifyBrandSection(normalizedContent);
          const isBrand = brandSection !== "none";
          const isSmall = isSmallTalk(normalizedContent);
          const isBusinessData = isBusinessDataQuery(normalizedContent);
          /* Work/schedule queries (my tasks, my calendar, "what's due")
             need the tool-calling orchestrator (listMyTodos etc.). The
             general fast-path has NO tools, so letting these through it
             makes the model deflect ("check the app / please log in")
             instead of reading the user's real data. Exclude them here
             so they always reach orchestrate(). */
          const isWorkData = isWorkDataQuery(normalizedContent);
          /* Live-information queries need the tool loop for the SAME reason
             work queries do: the general fast lane below carries no tools, so
             "what's the weather in Cairo right now?" was answered by a model
             apologising for having no live access while search_web sat one
             layer down, never reached. Guarding only the orchestrator's own
             fast paths was not enough — this route short-circuits BEFORE
             orchestrate() is ever called, so the exclusion has to exist here
             too. Any future tool that answers everyday questions needs the
             same treatment or this lane will swallow it. */
          const isLiveInfo =
            isLiveInfoQuery(normalizedContent) || body.web_search === true;
          /* Memory/teaching intents ("remember this", "save for the team",
             "احفظ", "تذكر", "记住") MUST reach the tool loop — the fast
             lanes carry no tools, so they can only HALLUCINATE a saved
             confirmation (observed live: "I've noted this for the team"
             with zero rows written). Same law as work/live-info guards. */
          const isMemoryIntent =
            /(remember|memoriz|save (this|that|it|for)|note (this|that) down|add (this|to) .*knowledge|knowledge base|don'?t forget)/i.test(normalizedContent) ||
            /احفظ|تذكّ?ر|لا تنسى?|أضف .*للمعرفة|سجّ?ل (هذه|هذا|ذلك)/.test(normalizedContent) ||
            /记住|保存|别忘|加入知识库/.test(normalizedContent);
          /* MID-FLOW replies must reach the tool loop. Two proven failure
             shapes when they don't (both fabricated writes in the tool-less
             general lane): (a) WRITE-WITH-CONFIRM turn 2 — "yes"/"ايوه"/
             "确认" carries no work nouns; (b) the DETAIL turn — the agent
             asked "what should the task say / when is it due?" and the
             user's answer is pure content ("call the shipping agent, high
             priority") with no work nouns either (observed live 2026-08-08:
             fast lane replied "已添加" with zero rows written). Structural
             rule, language-agnostic: if the last assistant turn asked for
             confirmation OR ended with a question mark, a reasonably short
             user reply is ANSWERING it — route it to orchestrate(), which
             handles small talk fine anyway. */
          const lastAssistantTurn =
            [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
          const assistantAskedConfirm =
            /confirm|تأكيد|أكّ?د|أؤكد|确认|هل أنفذ/i.test(lastAssistantTurn);
          const assistantAskedQuestion = /[?؟？]\s*$/.test(lastAssistantTurn.trim());
          const isMidFlowReply =
            (assistantAskedConfirm || assistantAskedQuestion) &&
            normalizedContent.trim().length <= 300;
          /* DeepSeek powers the fast lanes now (Groq fully removed).
             USE_DEEPSEEK + DEEPSEEK_API_KEY gate it via the provider. */
          const fastPathKey = process.env.DEEPSEEK_API_KEY;
          /* Owner-taught canonical answers ride EVERY lane — the fast
             paths too, since brand-ish questions are exactly what gets
             taught. Cached 60s in the lib. */
          const taughtBlock = await getTaughtAnswersBlock(auth.tenant_id ?? null);
          /* Knowledge nudge: strongest approved-knowledge hits for THIS
             question ride the fast lanes too — the fast paths carry no
             tools, so without this the curated knowledge base was
             invisible exactly where most casual questions land. */
          /* AUDIT ISSUE 7 (P1) — the nudge bypassed its own permission gate.
             `search_knowledge` is gated on the "AI Knowledge" module precisely
             so that someone who cannot open Knowledge cannot read ingested
             documents (with source title and page) by asking the agent. This
             block surfaces THE SAME corpus with THE SAME citations, and it was
             injected unconditionally on every fast lane for every internal
             user — the exact exposure the tool's gate was written to prevent,
             through a different door. Same module, same action.

             NOT gated: the taught-answers block above. That distinction is
             deliberate. Taught Q&A are canonical answers the owner WROTE FOR
             THE ASSISTANT TO GIVE to users; withholding them defeats their
             purpose. The nudge is document content with citations. Different
             thing, different rule. checkModule() is a pure in-memory read of
             the ctx we already built — no extra round-trip. */
          const canReadKnowledge = checkModule(ctx, "AI Knowledge", "view").allowed;
          const knowledgeNudge = canReadKnowledge
            ? await getKnowledgeNudgeBlock(auth.tenant_id ?? null, normalizedContent)
            : "";
          let fastReply: string | null = null;
          let fastProvider: string | null = null;
          let fastLane: "brand" | "small" | "general" | null = null;

          /* Data queries ALWAYS win over the tool-less fast lanes: a
             question can read as a brand question AND a catalog/data
             question ("which overlock models does Koleex have?") — the
             tool loop must answer those from real data, not prose. */
          const canFastPath =
            fastPathKey && !isBusinessData && !isWorkData && !isLiveInfo && !isMemoryIntent && !isMidFlowReply;

          if (canFastPath) {
            fastLane = isBrand ? "brand" : isSmall ? "small" : "general";
            const analysis = analyzeIntent(normalizedContent);
            const systemPromptBase =
              fastLane === "brand"
                ? buildBrandSystemPrompt(
                    ctx,
                    userLang,
                    brandSection as "company" | "ai" | "both",
                    wantsRewrite ? "egyptian" : null,
                  )
                : fastLane === "small"
                  ? buildMinimalSystemPrompt(ctx, userLang, wantsRewrite ? "egyptian" : null)
                  : /* general */
                    buildSmartPrompt(normalizedContent, {
                      userLang,
                      messageLang: detected.language,
                      messageLangConfidence: detected.confidence,
                      intentType: analysis.type,
                      complexity: analysis.complexity,
                      expectedFormat: analysis.expectedFormat,
                      entityScope: entity.scope,
                    })[0].content;
            const systemPrompt = systemPromptBase + taughtBlock + knowledgeNudge;
            /* Every lane, not just the tool loop: the general lane answers
               most ordinary messages, and it is where "you replied in English
               again" was coming from. */
            const fastMessages = [
              { role: "system" as const, content: systemPrompt + langLock },
              ...history,
              { role: "user" as const, content: normalizedContent + attachBlock },
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
              for await (const ch of deepseekChatStream(fastMessages, {
                maxTokens,
              })) {
                if (ch.type === "delta" && ch.text) {
                  if (!gotFirst) gotFirst = true;
                  accumulated += ch.text;
                  controller.enqueue(send({ type: "delta", text: ch.text }));
                } else if (ch.type === "done") {
                  fastReply = ch.text ?? accumulated;
                  /* Lane-truthful label. deepseekChatStream reports the
                     bare model id ("deepseek:deepseek-chat") — identical
                     to orchestrate()'s label, which made ai_messages
                     .provider useless for telling "tool loop ran" from
                     "tool-less fast lane answered" (it cost a full
                     mis-diagnosis on 2026-08-08). fast-<lane> keeps the
                     distinction queryable. */
                  fastProvider = `deepseek:fast-${fastLane}`;
                } else if (ch.type === "error") {
                  /* Drop what we have and fall through to orchestrate.
                     Can't "un-emit" the deltas the client already got —
                     but gotFirst will be false on TTFB-timeout / auth
                     errors, which is the only realistic pre-first-
                     token failure mode. */
                  if (gotFirst) {
                    fastReply = accumulated || null;
                    fastProvider = `deepseek:fast-${fastLane}`;
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
              provider: fastProvider ?? "deepseek:stream",
              conversationId: conversationId!,
            };
            /* If sealPricingSafety redacted content, the client has
               already seen raw deltas. The `end` event below carries
               the sealed reply and the client replaces its buffer
               with end.agent.finalReply — same contract as chat. */
          } else {
            let liveDeltaCount = 0;
            agent = await orchestrate({
              dialect: wantsRewrite ? ("egyptian" as const) : null,
              onDelta: (text) => {
                liveDeltaCount++;
                controller.enqueue(send({ type: "delta", text }));
              },
              ctx,
              history,
              userMessage: content + attachBlock,
              userLang,
              conversationId: conversationId!,
              webSearchRequested: body.web_search === true,
              languageLock: langLock,
              taughtAnswers: taughtBlock + knowledgeNudge,
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
            const full = liveDeltaCount > 0 ? "" : (agent.finalReply ?? "");
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
          if (keepalive) clearInterval(keepalive);

          /* ── Phase 11 L2 + Phase 16: response polish ──────────────
             Apply the Egyptian dialect builder for EGY / FRANCO users
             (scrub bad patterns, add natural openers, dedupe repeats).
             For every other language, still run removeRepetition as a
             safety net — repetition loops are a model failure mode
             that's language-agnostic. */
          let rewroteReply = false;
          /* Direct-voice backstop: drop a narration-only opening line
             ("لقيتلك التفاصيل", "I found what you need") before any
             dialect polish. */
          if (agent.finalReply) {
            const stripped = stripProcessNarration(agent.finalReply);
            if (stripped !== agent.finalReply) {
              agent = { ...agent, finalReply: stripped };
              rewroteReply = true;
            }
          }
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
          } else if (agent.finalReply) {
            /* Non-Egyptian: just dedupe. */
            const deduped = removeRepetition(agent.finalReply);
            if (deduped !== agent.finalReply) {
              agent = { ...agent, finalReply: deduped };
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
          /* Audit P1 #4 — keepalive must be cleared on every exit
             path, not just the happy one. If orchestrate() throws
             above, the original code skipped clearInterval and the
             server kept emitting ": ping" until TCP died on its own.
             Setting `alive = false` is belt-and-braces in case the
             interval callback already fired after clear. */
          alive = false;
          if (keepalive) clearInterval(keepalive);
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
      content: content + attachMarker + (attachBlock ? ATTACH_SPLIT + attachBlock : ""),
    }),
  ]);
  const tDeps = Date.now();

  /* Query pulled newest-first with a limit, then flipped back to
     chronological order for the orchestrator. Behaviour (tool routing,
     multi-turn context) is unchanged — only the window size is bounded. */
  const history = trimHistoryToBudget(
    resolveHistoryAttachEmbeds(
      (historyRes.data ?? [])
        .slice()
        .reverse()
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content as string,
        })),
    ),
  );

  const agent = await orchestrate({
    ctx,
    history,
    userMessage: content + attachBlock,
    userLang,
    conversationId,
    webSearchRequested: body.web_search === true,
    /* Same gate as the streaming path — see AUDIT ISSUE 7 note above. */
    taughtAnswers:
      (await getTaughtAnswersBlock(auth.tenant_id ?? null)) +
      (checkModule(ctx, "AI Knowledge", "view").allowed
        ? await getKnowledgeNudgeBlock(auth.tenant_id ?? null, content)
        : ""),
    languageLock: langLock,
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

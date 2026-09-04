import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/orchestrator — the tool-calling loop.

   Pipeline per user turn:

     1. Build the message list for Groq (system prompt + history + user msg).
     2. Call the provider with `tools = openAiToolSchemas(ctx)` — only the
        tools THIS caller may run — and `tool_choice = auto`.
     3. If the model replies with tool_calls, dispatch them all in parallel
        through the Koleex Hub connector, which owns the permission
        guards, the confirmation ledger and the audit log,
        attach results, loop.
     4. If the model replies with content, that's the final answer; stop.
     5. Hard-cap at MAX_ITERATIONS so a misbehaving model can't spin.

   The model NEVER sees raw DB rows it isn't allowed to see — tools
   strip sensitive fields before returning, and denied calls come back
   with permissionStatus so the model can explain honestly.
   --------------------------------------------------------------------------- */

import type {
  AgentStep,
  AgentResponse,
} from "./types";
/* Phase 2H — Hub data is reached through the named connector, never by
   calling the dispatcher directly. One door, so there is one place where the
   permission guard, the confirmation ledger and the audit trail apply. */
import { koleexHub } from "@/lib/server/ai/connectors/koleex-hub";
import { aiProviderConfigured } from "@/lib/server/ai-provider";
import { hasUntrustedContent } from "@/lib/server/ai/security/untrusted";
import { logSealTransform } from "@/lib/server/ai/observability/reply-log";
/* Phase 2E — the loop is now only the loop. What the model sees of a tool
   result, what the user sees of a call, the pre-dispatch guard, and the two
   recovery paths each live in their own module under core/. */
import type { TurnInput } from "@/lib/server/ai/core/types";
export type { TurnInput } from "@/lib/server/ai/core/types";
import { toLlmSafe, humaniseCall } from "@/lib/server/ai/core/wire";
import { preToolGuard } from "@/lib/server/ai/core/pre-tool-guard";
import { runDegradedTurn, fallback } from "@/lib/server/ai/core/recovery";
/* Phase 3C — the loop reaches a model through ONE function. It no longer
   knows the endpoint, the retry policy, or what a `choices[0].message` is;
   the adapter owns all of that. Everything BELOW the call sites is unchanged:
   the provider's answer is mapped back into the same `choice` shape the loop
   already used, so the tool loop, the seals and the rescue path see exactly
   what they saw before. */
/* Phase 4A — the provider LABEL comes from whichever adapter actually served
   the turn, not from a constant that said "deepseek" no matter what. With
   failover in the picture a hard-coded label would misreport every fallback
   turn, and the label is what the audit trail records. */
import { chatWithTools, providerConfigured, activeProviderLabel } from "@/lib/server/ai/provider/registry";
import { recordUsage } from "@/lib/server/ai/cost/meter";
import type { TurnMeta } from "@/lib/server/ai/provider/types";
import {
  fromOpenAiMessages,
  fromOpenAiTools,
  fromOpenAiToolChoice,
  type OpenAiMessage,
  type OpenAiTool,
  type OpenAiToolChoice,
  type TurnResponse,
} from "@/lib/server/ai/provider/turn-ir";
/* Phase 2C — the system prompts moved out. The loop builds a prompt; it is
   no longer also the place prompts are written. */
import {
  buildSystemPrompt,
  buildMinimalSystemPrompt,
  buildBrandSystemPrompt,
} from "@/lib/server/ai/prompts";
/* Phase 2B — the seal chain moved out. sealFinalReply is still THE one
   funnel; it simply no longer lives in the middle of the loop that calls it.
   See ai/seals/index.ts for the order, which is asserted by a test. */
import {
  sealFinalReply,
  cleanAssistantText,
  looksLikeDebug,
  rescueFromToolResults,
  normaliseBrandName,
  GENERIC_FOLLOWUP,
  BANNED_ECHOES,
} from "@/lib/server/ai/seals";
/* Phase 2A — the lane decision moved out. Every detector below used to be
   defined in this file and re-exported to the API routes; it now lives in
   core/decide-turn.ts, which the routes import directly. The loop keeps only
   what it uses. See that file's header for why it is import-free. */
import {
  tryFastReply,
  isSmallTalk,
  classifyBrandSection,
  isChoiceShapedQuestion,
  isTradeTermQuestion,
  isBusinessDataQuery,
  isWorkDataQuery,
  isLiveInfoQuery,
  isImageCreationRequest,
  isMemoryIntentQuery,
} from "@/lib/server/ai/core/decide-turn";

/* How much of the thread an identity turn sees — enough to avoid repeating
   itself, not enough to matter to the request size. */
const IDENTITY_HISTORY_TURNS = 6;
const IDENTITY_HISTORY_CHARS = 400;

const MAX_ITERATIONS = 4;
/* Hard ceiling on total tool executions per user turn. Prevents small
   models from loop-calling the same tool 50 times and blowing past
   Groq's 413 request-size limit. Unique (tool,args) pairs are cached
   inside a single turn so a model that re-asks for the same data just
   gets the cached result without another DB hit. */
const MAX_TOOLS_PER_TURN = 6;
/* Cap on parallel tool_calls in a single iteration — 8B will sometimes
   emit the same call three times in one step. */
const MAX_PARALLEL_TOOLS = 3;
/* Phase 3C. The provider layer returns a neutral TurnResponse; the loop below
   was written against the wire-shaped `choice`. Rather than rewrite two
   hundred lines of loop, the answer is mapped back into that shape at the one
   place it enters — so the tool loop, the seals, the dedupe and the rescue
   path are untouched by Phase 3 and cannot have been changed by it.

   `tool_calls: undefined` when empty (not `[]`) reproduces exactly what the
   streaming branch built before. */
/* Phase 5B. The label for a turn that HAPPENED comes from the outcome, not
   from activeProviderLabel() — after a failover those differ, and the outcome
   is the one telling the truth. Falls back to the predicted label only when
   the registry did not name a server (no adapter ran at all). */
function servedLabel(meta: TurnMeta): string {
  return meta.servedBy && meta.model ? `${meta.servedBy}:${meta.model}` : activeProviderLabel();
}

function toChoice(r: TurnResponse): { role?: string; content: string | null; tool_calls?: OpenAiMessage["tool_calls"] } {
  return {
    role: "assistant",
    content: r.content,
    tool_calls:
      r.toolCalls.length > 0
        ? (r.toolCalls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: c.argumentsJson },
          })) as OpenAiMessage["tool_calls"])
        : undefined,
  };
}

export async function orchestrate(input: TurnInput): Promise<AgentResponse> {
  const tStart = Date.now();
  const {
    ctx, history, userMessage, userLang, dialect, conversationId, onDelta, onStep,
    webSearchRequested = false, languageLock = "", taughtAnswers = "",
  } = input;
  /* True when a user-uploaded document's extracted text is in play — this
     turn or retained history. Gates the recital exemption in
     sealFinalReply(). */
  /* AUDIT ISSUE 5 (P0) — scope narrowed to THIS TURN.

     The recital exemption exists for a real reason: an invoice summary trips
     every pricing pattern by nature, and v3 reads its "Total:" lines as
     ungrounded field claims. But the old condition also scanned RETAINED
     HISTORY — so one attachment anywhere in the 60-message window switched
     the field-grounding and pricing seals OFF for every subsequent turn in
     that conversation, long after the document stopped being the subject.

     That is the widest blast radius in the seal chain, and it compounds with
     document injection: text inside an uploaded file is untrusted, and the
     turn that carries it was also the turn with the fewest guards.

     A document being recited is a property of the CURRENT turn. If the user
     asks about it again, they attach it again or it is in this message. */
  const attachedDocCtx = hasUntrustedContent(userMessage);
  /* Phase 3C: ask the registry rather than the environment. With a single
     adapter this is the same boolean it always was — Boolean(DEEPSEEK_API_KEY)
     — but the question the loop asks is now "is a provider available?", which
     is the one it actually means. */
  const providerReady = providerConfigured();
  /* Phase 2F — the tools this caller may actually run, resolved ONCE per turn
     and handed to every model call in it. Two reasons this is not "all tools":
     a Sales user offered 45 schemas will try the ones they cannot use and
     burn a turn being denied, and the schemas are most of the request body.
     dispatchTool still re-checks — a model can name a tool it was not given. */
  const tools = koleexHub.toolSchemas(input.ctx);

  /* Graceful Groq-missing fallback. The orchestrator's tool-calling
     features genuinely need Groq's OpenAI-style tool schema (and the
     dispatchTool loop below), so we can't run the agent loop without
     it. But if ANY other provider is configured (Gemini / Anthropic /
     OpenAI), routing the turn through the simpler chat completion
     path lets the user still get a conversational reply instead of a
     dead "configure GROQ_API_KEY" wall.

     Tools-affirming queries (those that would have triggered tool
     calls under Groq) will still produce a best-effort natural-
     language answer; they just won't read live data. The reply also
     includes a one-line note so the operator knows tools are off
     until Groq is wired up. */
  if (!providerReady) {
    if (!aiProviderConfigured()) {
      /* User-facing copy: no vendor names (AI_PROVENANCE_RULE applies to
         our own strings too — any signed-in employee can see this). */
      return fallback(
        "Koleex AI isn't configured yet. Ask an administrator to complete the AI setup in the deployment settings.",
        conversationId,
        userMessage,
      );
    }
    return runDegradedTurn(input, tStart);
  }

  /* Canned fast-reply — narrow EN/AR/ZH exact-match triggers for
     greetings / identity / "what can you do" / thanks. Returns
     instantly without any Groq call. Never matches business prompts
     (they never look like plain "hello"). */
  const fastReply = tryFastReply(userMessage);
  if (fastReply) {
    console.log(
      `[ai.agent.timing] fast=canned provider=0ms total=${Date.now() - tStart}ms`,
    );
    const cannedSteps: AgentStep[] = [
      { kind: "answer", text: fastReply, permissionStatus: "allowed" },
    ];
    const safeReply = sealFinalReply(fastReply, cannedSteps, userMessage, attachedDocCtx);
    logSealTransform(fastReply, safeReply, "canned");
    return {
      steps: cannedSteps,
      finalReply: safeReply,
      provider: "fast-path",
      conversationId,
    };
  }

  /* Route on message intent:
     - Brand questions → fast-path prompt WITH BRAND_KNOWLEDGE + no
       tools. Preserves quality for "who's the CEO", "Vision 2035",
       "founders", etc. Narrow keyword list (see isBrandQuestion) so
       vague prompts don't get the heavy brand prompt.
     - Small-talk → fast-path prompt with MINIMAL system text (no
       brand knowledge, no tool routing). Short + fast answers.
     - Everything else → full tool-calling loop. */
  /* Data queries always outrank the tool-less fast paths: a message
     can read as a brand question AND a catalog/data question ("which
     overlock models does Koleex have?") — those must run the tool
     loop and answer from real data, not brand prose. */
  const isDataQuery =
    isBusinessDataQuery(userMessage) ||
    isWorkDataQuery(userMessage) ||
    /* Live-info questions must reach the tool loop for the same reason
       work queries must: the fast paths carry NO tools, so "what's the
       weather in Cairo" would be answered by a model apologising for
       having no live access — with search_web sitting one layer away. */
    webSearchRequested ||
    isLiveInfoQuery(userMessage) ||
    /* A picture to MAKE needs generate_image, which only the tool loop has. */
    isImageCreationRequest(userMessage) ||
    isMemoryIntentQuery(userMessage);
  const brandSection = isDataQuery ? "none" : classifyBrandSection(userMessage);
  const isBrand = brandSection !== "none";
  const isSmall = !isDataQuery && isSmallTalk(userMessage);
  const useFastPath = isBrand || isSmall;
  /* Three-way choice:
      · small-talk → minimal prompt (no brand, no agent rules)
      · brand question → LEAN brand prompt (~300 chars of framing +
        the single relevant section). Strips all tool/pricing/agent
        discipline that bloats buildSystemPrompt by ~4 KB and was
        pushing brand requests over Groq's 413 threshold.
      · everything else → full agent buildSystemPrompt. */
  const basePrompt =
    isBrand
      ? buildBrandSystemPrompt(
          ctx,
          userLang,
          brandSection as "company" | "ai" | "both",
          dialect,
          userMessage,
        )
      : useFastPath && isSmall
        ? buildMinimalSystemPrompt(ctx, userLang, dialect)
        : buildSystemPrompt(ctx, userLang, { dialect }) +
          /* Appended rather than baked in: the flag is per-turn, and the
             instruction only makes sense on the turn the user asked for it. */
          (webSearchRequested
            ? "\n\nThe user turned WEB SEARCH on for this message. Prefer calling search_web before answering, unless the question is purely about Koleex's own records or needs no lookup at all."
            : "");
  /* The language lock applies to ALL THREE prompts, not just the full one.
     A brand answer or a one-line greeting in the wrong language is exactly
     as wrong as a long one, and those two lanes handle the short messages
     users send most. */
  const systemPrompt = basePrompt + taughtAnswers + languageLock;

  /* Drop deprecated assistant phrases from history before forwarding
     it to the model. Older turns still live in ai_messages; without
     this filter the model can echo them on the current turn and the
     user sees strings the current code no longer produces. User
     turns are always preserved. */
  const sanitisedHistory = history.filter((m) => {
    if (m.role !== "assistant") return true;
    const content = m.content ?? "";
    return !BANNED_ECHOES.some((re) => re.test(content));
  });

  /* Brand fast-path: the approved knowledge is self-contained and
     brand questions are rarely multi-turn, so history just burns
     payload bytes and risks another 413. Drop history entirely on
     the COMPANY path. Other paths keep the full sanitised history.

     IDENTITY TURNS KEEP A CLIPPED TAIL. "Never repeat an identity answer
     word for word in one conversation" was an instruction the model could
     not follow with no history in front of it — and it repeated, every
     time. The last few turns, each cut short, are enough to know what was
     already said and cost a few hundred bytes, not the 413 the full thread
     risked. */
  const isIdentityTurn = brandSection === "ai" || brandSection === "both";
  const effectiveHistory = isBrand
    ? isIdentityTurn
      ? sanitisedHistory.slice(-IDENTITY_HISTORY_TURNS).map((m) => ({
          ...m,
          content: (m.content ?? "").slice(0, IDENTITY_HISTORY_CHARS),
        }))
      : []
    : sanitisedHistory;

  const messages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt },
    ...effectiveHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const steps: AgentStep[] = [];
  let finalReply = "";
  /* Per-turn cache of tool results keyed by `${name}|${argsJson}`. If
     the model re-emits the same call we serve it from cache instead of
     letting it spiral. Also a running count so we stop the loop when
     the model has had enough chances. */
  const toolCache = new Map<string, { result: unknown; cached: boolean }>();
  let totalToolRuns = 0;

  /* ── Small-talk / brand fast-path ──
     For greetings, identity, thanks, or brand/company-profile questions
     we skip tool schemas entirely. Single Groq call, no chance to waste
     a round-trip — and crucially the payload fits under Groq's 413
     limit even with the full BRAND_KNOWLEDGE loaded. */
  if (useFastPath) {
    const tPre = Date.now();
    /* Brand answers are structured multi-section prose (Q3 alone is
       ~200 words); small-talk is one or two sentences. Size the
       token budget accordingly so brand answers complete instead of
       truncating. */
    const out = await chatWithTools({
      messages: fromOpenAiMessages(messages),
      maxTokens: isBrand ? 1200 : 160,
      /* WARMER FOR IDENTITY. At 0.3 the same prompt yields the same
         paragraph; the facts are pinned by the prompt and checked by the
         seal, so the words can afford to move. Everything else keeps 0.3. */
      temperature: isIdentityTurn ? 0.85 : 0.3,
      /* Phase 4E. A greeting must not pay reasoning-model latency — the plan's
         primary speed lever. Advisory: with no AI_MODEL_CLASSES entry every
         class resolves to the adapter's default, which is today's behaviour. */
      modelClass: isBrand ? "GENERAL" : "FAST",
    });
    const tPost = Date.now();
    recordUsage({
      tenantId: ctx.auth.tenant_id ?? null,
      accountId: ctx.auth.account_id ?? null,
      lane: isBrand ? "brand" : "fast",
      provider: out.servedBy ?? "none",
      model: out.model ?? "unknown",
      inputTokens: out.ok ? (out.response.usage?.inputTokens ?? null) : null,
      outputTokens: out.ok ? (out.response.usage?.outputTokens ?? null) : null,
      ms: out.ms ?? tPost - tPre,
      traceId: conversationId,
    });
    if (out.ok) {
      const rawReply = out.response.content.trim();
      /* Strip any leaked tool-call markers BEFORE brand-name
         normalisation so we never ship raw <function=…> syntax to
         the user even on the fast path. */
      const reply = normaliseBrandName(cleanAssistantText(rawReply));
      if (reply) {
        steps.push({ kind: "answer", text: reply, permissionStatus: "allowed" });
        const safeReply = sealFinalReply(reply, steps, userMessage, attachedDocCtx);
        logSealTransform(reply, safeReply, "brand-fast");
        console.log(
          `[ai.agent.timing] fast=${isBrand ? "brand" : "small"} provider=${tPost - tPre}ms total=${Date.now() - tStart}ms`,
        );
        return {
          steps,
          finalReply: safeReply,
          provider: servedLabel(out),
          conversationId,
        };
      }
    }
    /* Fall through to the full agent loop on any failure. */
  }

  const wantsChoiceCard = isChoiceShapedQuestion(userMessage);
  /* Attempts, not a boolean: the provider does not always honour a named
     tool_choice on the first request — measured, it answered with another
     lookup and only called askUser on the next pass. Two attempts absorbs
     that without ever becoming a loop. */
  /* Phase 5B — declared at TURN scope, not per round, because the label it
     feeds is read after the loop has finished. It records the LAST model call
     of the turn, which is the one that produced the answer being returned.
     Everything here used to call activeProviderLabel(), which names the first
     CONFIGURED adapter and is therefore wrong on any turn that failed over —
     and that label is what the audit trail stores. */
  let turnMeta: TurnMeta = {};
  let forcedAsk = 0;
  /* Set when a choice-shaped turn came back as PROSE with no tool calls at
     all. Measured on prod: the model answered "which spreading machine should
     I choose?" with four numbered questions and never touched a tool, so the
     force below — which waited for a lookup — never got its turn. Nothing had
     streamed yet at that point, so the reply can be thrown away and re-asked. */
  let proseRefused = false;

  /* TRADE TERMS — force the lookup on the FIRST request of the turn.

     Same lesson as the choice card above, arrived at the same way. The
     system prompt tells the model to always call searchTradeTerms for
     Incoterms and payment-term questions. Measured against the live model:
     it obeyed for "What does CIF mean?" and for the Arabic payment-terms
     question, then answered "explain a transferable letter of credit"
     straight from memory with no tool call at all. A rule the model follows
     only sometimes is not a rule, and "sometimes sourced" is the one
     outcome this knowledge base exists to prevent — the whole point is that
     the answer comes from ICC's own text rather than from whatever the
     model absorbed, which still carries the "ship's rail" error deleted
     from the rules in 2010.

     Narrow and cheap: it fires only on a trade-terms question, only on the
     first request (totalToolRuns === 0), and only once (forcedTrade), so a
     turn that also needs a customer or pricing lookup is free to make it
     immediately afterwards. */
  const wantsTradeTerms = isTradeTermQuestion(userMessage);
  let forcedTrade = false;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    /* After the per-turn tool budget is spent, disable tools so the
       model can only produce a final answer. */
    /* Force the card on choice-shaped turns once the lookups are done —
       the model has candidates in hand and would otherwise write prose.
       See CHOICE_OPENER. `forcedAsk` makes it strictly once per turn. */
    const forceAskNow =
      wantsChoiceCard &&
      forcedAsk < 2 &&
      (totalToolRuns > 0 || proseRefused) &&
      totalToolRuns < MAX_TOOLS_PER_TURN;
    if (forceAskNow) forcedAsk += 1;
    /* Trade-terms lookup on the first request — see wantsTradeTerms. */
    const forceTradeNow = wantsTradeTerms && !forcedTrade && totalToolRuns === 0;
    if (forceTradeNow) forcedTrade = true;
    const toolChoice: OpenAiToolChoice =
      totalToolRuns >= MAX_TOOLS_PER_TURN
        ? "none"
        : forceAskNow
          ? { type: "function", function: { name: "askUser" } }
          : forceTradeNow
            ? { type: "function", function: { name: "searchTradeTerms" } }
            : "auto";
    /* REAL answer streaming (perf fix 2026-08-03): once tools have run,
       the next call is (almost always) the final answer — stream it so
       the user reads while it generates instead of waiting ~8-12s for
       the whole completion. The first (tool-deciding) call stays
       non-streamed: it emits only compact tool_calls JSON. */
    let choice:
      | { role?: string; content: string | null; tool_calls?: OpenAiMessage["tool_calls"] }
      | undefined;
    let callFailedStatus = 0;
    let callFailedBody = "";
    const liveEmit = totalToolRuns > 0 ? onDelta : undefined;
    {
      /* One call, streaming or not. The truncated-body case that used to be
         caught here is now the adapter's — it still comes back as a FAILED
         call (502) rather than an exception, which is what keeps the rescue
         path in charge instead of a raw 500. */
      const out = await chatWithTools(
        {
          messages: fromOpenAiMessages(messages),
          tools: fromOpenAiTools(tools as unknown as OpenAiTool[]),
          toolChoice: fromOpenAiToolChoice(toolChoice),
          maxTokens: 2048,
          temperature: 0.3,
          /* The tool loop is the multi-step, evidence-gathering path — the one
             turn where a slower, stronger model is worth its latency. */
          modelClass: "REASONING",
          stream: Boolean(liveEmit),
        },
        liveEmit ? { onDelta: liveEmit } : undefined,
      );
      turnMeta = { servedBy: out.servedBy, model: out.model, ms: out.ms, failedOver: out.failedOver };
      recordUsage({
        tenantId: ctx.auth.tenant_id ?? null,
        accountId: ctx.auth.account_id ?? null,
        lane: "agent",
        provider: out.servedBy ?? "none",
        model: out.model ?? "unknown",
        inputTokens: out.ok ? (out.response.usage?.inputTokens ?? null) : null,
        outputTokens: out.ok ? (out.response.usage?.outputTokens ?? null) : null,
        ms: out.ms ?? 0,
        traceId: conversationId,
      });
      if (!out.ok) {
        callFailedStatus = out.status || 500;
        callFailedBody = out.bodyText;
      } else {
        choice = toChoice(out.response);
      }
    }

    if (callFailedStatus) {
      console.error("[ai.agent.groq]", callFailedStatus, callFailedBody.slice(0, 500));

      /* Rescue-first: if tools already produced valid data this turn,
         don't discard that work because a secondary Groq call failed.
         Surface the freshest tool-result text as the final answer so
         the user sees the data they asked for — no "handling a lot of
         requests" banner over a successful search. */
      const rescued = rescueFromToolResults(steps);
      if (rescued) {
        steps.push({ kind: "answer", text: rescued, permissionStatus: "allowed" });
        const safeReply = sealFinalReply(rescued, steps, userMessage, attachedDocCtx);
        logSealTransform(rescued, safeReply, "rescue-after-call-failure");
        return {
          steps,
          finalReply: safeReply,
          provider: servedLabel(turnMeta),
          conversationId,
        };
      }

      /* No rescue available — fall back to the generic error copy.
         Rate limits (429) and overloaded (503) get the friendly
         "handling a lot of requests" line; everything else gets the
         clean generic retry prompt. Raw status stays in the log. */
      const isRateLimited = callFailedStatus === 429 || callFailedStatus === 503;
      const msg = isRateLimited
        ? "Koleex AI is handling a lot of requests right now. Give it a moment and try again."
        : "I couldn't complete that request. Please try again.";
      steps.push({ kind: "answer", text: msg, permissionStatus: "denied" });
      const safeReply = sealFinalReply(msg, steps, userMessage, attachedDocCtx);
      logSealTransform(msg, safeReply, "call-failed");
      return {
        steps,
        finalReply: safeReply,
        provider: servedLabel(turnMeta),
        conversationId,
      };
    }

    if (!choice) {
      /* Rescue-first on malformed/empty response too. If tools ran
         earlier this turn, prefer their output over a generic error. */
      const rescued = rescueFromToolResults(steps);
      if (rescued) {
        steps.push({ kind: "answer", text: rescued, permissionStatus: "allowed" });
        const safeReply = sealFinalReply(rescued, steps, userMessage, attachedDocCtx);
        logSealTransform(rescued, safeReply, "rescue-no-choice");
        return {
          steps,
          finalReply: safeReply,
          provider: servedLabel(turnMeta),
          conversationId,
        };
      }
      return fallback(
        "I couldn't complete that request. Please try again.",
        conversationId,
        userMessage,
      );
    }

    const toolCalls = choice.tool_calls ?? [];
    const content = choice.content ?? "";

    // If the model asked for tool calls we execute them all, otherwise
    // this is the final assistant turn.
    if (toolCalls.length === 0) {
      /* Sanitise the assistant's content before it becomes the
         final reply. Models sometimes verbalise their own tool-call
         syntax when they mis-parse the tool schema; cleanAssistantText
         strips those markers so nothing raw ever reaches the UI.

         Rescue-first precedence when the model's content is empty
         after tools ran: prefer the latest successful tool-result
         text over GENERIC_FOLLOWUP, so a valid search/lookup answer
         isn't replaced with "Could you share a bit more so I can
         help?" just because the summariser returned nothing. */
      /* CHOICE-SHAPED TURN THAT ANSWERED IN PROSE — reject it and ask again
         with askUser named. Only while NOTHING has been streamed yet
         (totalToolRuns === 0 means liveEmit was never armed), so we are
         discarding a reply the user has not seen, not retracting one they
         have. The messages array is left untouched: the very same request
         goes back out, differing only in tool_choice. Bounded by forcedAsk. */
      if (wantsChoiceCard && forcedAsk < 2 && totalToolRuns === 0) {
        proseRefused = true;
        continue;
      }

      const cleaned = cleanAssistantText(content);
      const attempted = normaliseBrandName(cleaned);
      finalReply =
        attempted || rescueFromToolResults(steps) || GENERIC_FOLLOWUP;
      steps.push({
        kind: "answer",
        text: finalReply,
        permissionStatus: "allowed",
      });
      break;
    }

    /* Dedupe + cap parallel tool calls.
       Small models sometimes emit the same tool call 3× in one
       iteration. Without guarding we'd hit the DB and chat transcript
       with duplicates and, if the loop recurs, hit Groq's 413 payload
       limit. Strategy:
         · dedupe within this iteration by (name + argsJson)
         · cap at MAX_PARALLEL_TOOLS per iteration
         · cap at MAX_TOOLS_PER_TURN across all iterations (serve
           previously-run calls from toolCache, still appear as
           tool-role messages so the model sees its own data). */
    const seenThisIter = new Set<string>();
    const dedupedCalls: typeof toolCalls = [];
    for (const tc of toolCalls) {
      const argsRaw = tc.function.arguments ?? "{}";
      const cacheKey = `${tc.function.name}|${argsRaw}`;
      if (seenThisIter.has(cacheKey)) continue;
      seenThisIter.add(cacheKey);
      dedupedCalls.push(tc);
      if (dedupedCalls.length >= MAX_PARALLEL_TOOLS) break;
    }

    // Push the assistant turn (with the deduped tool_calls array) so the
    // tool results we append next reference the right call_ids.
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: dedupedCalls,
    });

    // Execute tool calls in parallel. Each dispatched through the registry,
    // which runs permission + audit + error isolation.
    const toolRuns = await Promise.all(
      dedupedCalls.map(async (tc) => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          parsedArgs = {};
        }

        /* Pre-tool guard — runs BEFORE any step is pushed, before
           any DB hit, before any audit row. A guard failure is
           surfaced ONLY to the model (via the tool-role message the
           outer loop emits below); no chip, no "denied" UI state,
           no user-visible permission pretence. The next iteration
           lets the model rephrase the rejection as a natural ask. */
        const guard = preToolGuard(tc.function.name, parsedArgs);
        if (!guard.ok) {
          return {
            tc,
            result: {
              ok: false,
              /* "denied" is the closest match in the ToolResult
                 union but this object never reaches steps[] — it
                 only reaches the model via toLlmSafe() so the LLM
                 sees the guidance and asks the user in natural
                 language. No UI chip renders. */
              permissionStatus: "denied" as const,
              data: null,
              message: guard.message,
            },
            guarded: true as const,
          };
        }

        const cacheKey = `${tc.function.name}|${JSON.stringify(parsedArgs)}`;

        steps.push({
          kind: "tool-call",
          tool: tc.function.name,
          text: humaniseCall(tc.function.name, parsedArgs),
          payload: parsedArgs,
        });
        /* Announced NOW, before the tool runs: this is what lets the screen
           show what is being looked up during the seconds it takes. A copy,
           so a listener cannot reach into the loop's own list. */
        try {
          onStep?.(steps.slice());
        } catch {
          /* A listener that throws must not take the turn down. */
        }

        /* Serve cached result when the model asks for the same thing
           twice in one turn. Counts against MAX_TOOLS_PER_TURN but
           doesn't hit the DB or produce a new audit entry. */
        const hit = toolCache.get(cacheKey);
        if (hit) {
          steps.push({
            kind: "tool-result",
            tool: tc.function.name,
            text: "(cached)",
            payload: hit.result,
            permissionStatus: "allowed",
          });
          return {
            tc,
            result: {
              ok: true,
              permissionStatus: "allowed" as const,
              data: hit.result,
              message: "(cached)",
            },
          };
        }

        totalToolRuns++;
        const result = await koleexHub.invoke(ctx, tc.function.name, parsedArgs, {
          conversationId,
        });
        toolCache.set(cacheKey, { result: result.data, cached: false });

        steps.push({
          kind: "tool-result",
          tool: tc.function.name,
          text: result.message,
          payload: result.data,
          permissionStatus: result.permissionStatus,
          sources: result.sources,
          filteredFields: result.filteredFields,
        });

        return { tc, result };
      }),
    );

    // Feed tool outputs back as tool-role messages. We only send a
    // minimal, LLM-safe projection — never the full raw object if it
    // could contain anything sensitive we haven't already filtered.
    for (const { tc, result } of toolRuns) {
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(toLlmSafe(result)),
      });
    }

    /* Hit the hard ceiling — force the next iteration to produce a
       final answer instead of calling more tools. MUST be pushed AFTER
       the tool-role feed above: providers require the assistant
       tool_calls message to be IMMEDIATELY followed by its tool
       replies, and injecting this system message between them returned
       400 "insufficient tool messages following tool_calls" — the turn
       then fell back to raw tool text as the user-visible answer. */
    if (totalToolRuns >= MAX_TOOLS_PER_TURN) {
      messages.push({
        role: "system",
        content: "Tool-call budget reached. Summarise what you have with no further tool calls.",
      });
    }

    /* Short-circuit only on REAL permission denials — NOT on guard
       rejections. Guarded calls carry permissionStatus="denied"
       internally (the union has no neutral option) but they represent
       missing input, not access refusal. Letting the loop continue
       means the model will see the guard message via the tool-role
       feed and rephrase it as a natural question to the user on the
       next iteration. */
    /* A CLARIFYING QUESTION ENDS THE TURN. Without this the model would ask
       and then answer itself on the next iteration, which is the exact
       behaviour the tool exists to replace. The question becomes the reply;
       the options ride along as a step the UI renders as buttons, and the
       user's pick arrives as an ordinary next message. */
    const asked = toolRuns.find(
      (r) => r.tc.function.name === "askUser" && r.result.ok && r.result.data,
    );
    if (asked) {
      const payload = asked.result.data as { question: string; options: unknown[] };
      steps.push({
        kind: "question",
        text: payload.question,
        tool: "askUser",
        payload,
        permissionStatus: "allowed",
      });
      finalReply = payload.question;
      break;
    }

    const toolExecutions = toolRuns.filter(
      (r) => !(r as { guarded?: boolean }).guarded,
    );
    const allDenied =
      toolExecutions.length > 0 &&
      toolExecutions.every((r) => r.result.permissionStatus === "denied");
    if (allDenied) {
      const lastMsg = toolExecutions[toolExecutions.length - 1]?.result.message
        ?? "Access denied.";
      steps.push({
        kind: "denied",
        text: lastMsg,
        permissionStatus: "denied",
      });
      finalReply = lastMsg;
      break;
    }
  }

  // Safety: if we hit max iterations without a clean answer, compose a
  // short message from the last tool result so the UI gets *something*.
  // Skip any step text that reads like internal debug / validation
  // output ("(cached)", "productId required.", "Please provide …") so
  // we don't promote engineering-speak into a user-facing reply.
  if (!finalReply) {
    const candidate = [...steps]
      .reverse()
      .map((s) => cleanAssistantText(s.text ?? ""))
      .find((t) => t && !looksLikeDebug(t)) ?? "";
    finalReply = normaliseBrandName(candidate) ||
      "I couldn't complete that request. Could you rephrase?";
    steps.push({
      kind: "answer",
      text: finalReply,
      permissionStatus: "allowed",
    });
  }

  /* Final-reply finalizer — centralises the full guard chain and
     syncs the last "answer" step. Every return site in orchestrate()
     funnels through sealFinalReply so no path can leak an unsealed
     reply to the route handler (which persists finalReply into
     ai_messages.content → the bubble the user sees). */
  const safeReply = sealFinalReply(finalReply, steps, userMessage, attachedDocCtx);
  logSealTransform(finalReply, safeReply, "main");

  return {
    steps,
    finalReply: safeReply,
    provider: servedLabel(turnMeta),
    conversationId,
  };
}


import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/orchestrator — the tool-calling loop.

   Pipeline per user turn:

     1. Build the message list for Groq (system prompt + history + user msg).
     2. Call Groq with `tools = openAiToolSchemas()` and `tool_choice = auto`.
     3. If the model replies with tool_calls, dispatch them all in parallel
        through dispatchTool() (permission guards + audit log apply),
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
  UserContext,
  ToolResult,
} from "./types";
import { openAiToolSchemas, dispatchTool } from "./tool-registry";
import { BRAND_KNOWLEDGE } from "./brand-knowledge";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/* Default to Llama 3.1 8B Instant for the agent path — 30k tokens /
   minute on Groq's free tier (vs 6k for 3.3 70B) and roughly 3× faster
   inference. Tool-calling quality is still strong for ERP-style
   orchestration; we're not asking the model to reason deeply, just to
   pick the right tool and summarise results. `GROQ_AGENT_MODEL` env
   overrides, so we can A/B swap to 70B later without a deploy. */
const GROQ_MODEL =
  process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.1-8b-instant";
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

/* OpenAI-compatible message shapes — kept loose because the Groq API
   accepts the whole family (system/user/assistant/tool). */
interface WireMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface OrchestrateInput {
  ctx: UserContext;
  /** Conversation history — role/content pairs, oldest first. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** Latest user message (already persisted by the caller). */
  userMessage: string;
  userLang: "en" | "zh" | "ar";
  conversationId: string;
}

/** Small-talk / meta detector. Short greetings, identity questions,
 *  thanks, etc. never need a business-data lookup — we reply in one
 *  tool-less Groq call which uses ~500 tokens instead of ~4 000 (the
 *  tool schemas alone are most of the cost). Keeps the free-tier
 *  RPM/TPM allowance intact for the requests that actually need it. */
/* ── Canned fast-reply table ────────────────────────────────
   Narrow exact-match list: greetings, identity, "what can you do",
   thanks — EN / AR / ZH. Hits return instantly without any Groq call.
   Keep this tight; business prompts must NEVER match here. */
const FAST_REPLIES: Array<[RegExp, string]> = [
  // English
  [/^(hi|hello|hey)[\s,!.?]*$/i,                              "Hi! How can I help?"],
  [/^who\s+(are|r)\s+you\s*\??$/i,                            "I'm Koleex AI, your assistant inside Koleex Hub."],
  [/^what\s+can\s+you\s+do\s*\??$/i,                          "I help with quick answers, drafting, and navigating the hub. What do you need?"],
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,                  "You're welcome."],
  // Arabic
  [/^(مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/,                      "مرحبا! كيف أقدر أساعدك؟"],
  [/^(من\s+(أنت|انت)|مين\s+(أنت|انت))\s*[?؟]?$/,              "أنا Koleex AI، مساعدك داخل Koleex Hub."],
  [/^(ماذا\s+(تستطيع|يمكنك)|ما\s+الذي\s+(تستطيع|يمكنك)|شو\s+(تقدر|بتقدر)|ايش\s+تقدر).*[?؟]?$/, "أساعدك في إجابات سريعة والصياغة والتنقل داخل Koleex Hub. ما الذي تحتاجه؟"],
  [/^(شكرا|شكراً)[\s!.؟]*$/,                                   "العفو."],
  // Chinese
  [/^(你好|您好|嗨)[\s,!.?]*$/,                                "你好!有什么可以帮您的吗?"],
  [/^你是谁\s*[?？]?$/,                                        "我是 Koleex AI,您在 Koleex Hub 的助手。"],
  [/^你(能|可以)(做|干)什么\s*[?？]?$/,                         "我可以帮您快速回答、起草内容和在 Koleex Hub 中导航。需要什么?"],
  [/^谢谢[\s!。?？]*$/,                                        "不客气。"],
];

function tryFastReply(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const [pat, reply] of FAST_REPLIES) {
    if (pat.test(m)) return reply;
  }
  return null;
}

function isSmallTalk(msg: string): boolean {
  const s = msg.trim().toLowerCase();
  if (!s) return true;
  if (s.length < 3) return true;
  const patterns: RegExp[] = [
    /^(hi|hello|hey|yo|hola|salam|salaam|مرحبا|اهلا|أهلا|السلام|你好|hi there)[\s,!.?؟]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s,!.?؟]*$/i,
    /who\s+(are|r)\s+you\s*\??$/i,
    /what\s+(are|r)\s+you\s*\??$/i,
    /what\s+can\s+you\s+do\s*\??$/i,
    /what\s+do\s+you\s+know\s*\??$/i,
    /how\s+do\s+you\s+work\s*\??$/i,
    /what\s+kind\s+of\s+ai\s+are\s+you\s*\??$/i,
    /how\s+are\s+you[\s,!.?؟]*$/i,
    /^(thanks|thank\s+you|thx|ty|شكرا|谢谢)[\s!.؟]*$/i,
    /^(ok|okay|good|great|nice|cool|got\s+it|understood)[\s!.؟]*$/i,
    /^(bye|goodbye|see\s+you|مع السلامة|再见)[\s!.؟]*$/i,
    /من\s+أنت\s*\??$/, // Arabic: "who are you?"
    /你\s*是\s*谁/,        // Chinese: "who are you?"
  ];
  return patterns.some((p) => p.test(s));
}

/** Brand / company-profile question detector. Matches requests that can
 *  be answered from BRAND_KNOWLEDGE alone (no DB lookup, no tool
 *  schemas). Routing these to the no-tools fast-path keeps the agent
 *  request under Groq's payload limit (413) while still giving full
 *  brand answers. Covers EN / AR / ZH keywords. */
/** Post-process any model reply to enforce the brand-name rule:
 *  "Koleex" (and its sub-brand names) must appear in Latin letters in
 *  every language. Small models drift here — they echo the user's
 *  Arabic/Chinese transliteration even when the system prompt forbids
 *  it. A deterministic string-replace is the simplest guarantee. */
const BRAND_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/كوليكس/g, "Koleex"],
  [/كوليكس جروب/g, "Koleex Group"],
  [/مجموعة كوليكس/g, "Koleex Group"],
  [/柯莱克斯/g, "Koleex"],
  [/科莱克斯/g, "Koleex"],
  [/كوليكس هاب/g, "Koleex Hub"],
];
function normaliseBrandName(text: string): string {
  let out = text;
  for (const [pattern, replacement] of BRAND_NAME_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function isBrandQuestion(msg: string): boolean {
  const s = msg.trim().toLowerCase();
  if (!s) return false;
  /* Narrow trigger list — only phrases that clearly ask for company /
     brand facts (history, mission, vision, CEO, founders, official
     brand material). Vague prompts like "tell me something" or bare
     "company" no longer count so they don't get the heavy brand-
     knowledge prompt. Canned small-talk (hello / who are you /
     thanks) is handled by the canned fast-path above — never reaches
     this check. */
  const brandKeywords = [
    // English — explicit brand / company facts only
    "koleex",                              // direct brand name
    "koleex group", "koleex international",
    "koleex story", "koleex history",
    "company history", "history", "heritage",
    "founded", "founder", "founders",
    "ceo",
    "mission", "vision", "core values",
    "vision 2035",
    "official brand", "brand guidelines", "brand story",
    "kas", "eskn", "nefertiti", "shafei",
    "k-o-l-e-e-x",
    // Arabic — explicit brand / company terms only
    "كوليكس", "شافعي",
    "مؤسس", "المؤسس",
    "الرئيس التنفيذي", "المدير التنفيذي",
    "رؤية", "مهمة", "رسالة",
    "القيم", "القيم الأساسية",
    "تاريخ", "تراث",
    // Chinese — explicit brand / company terms only
    "柯莱克斯", "科莱克斯",
    "创始人", "首席执行官",
    "愿景", "使命", "价值观", "历史",
  ];
  return brandKeywords.some((k) => s.includes(k));
}

export async function orchestrate(input: OrchestrateInput): Promise<AgentResponse> {
  const tStart = Date.now();
  const { ctx, history, userMessage, userLang, conversationId } = input;
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return fallback(
      "Koleex AI isn't configured. Ask an admin to add GROQ_API_KEY.",
      conversationId,
    );
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
    return {
      steps: [{ kind: "answer", text: fastReply, permissionStatus: "allowed" }],
      finalReply: fastReply,
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
  const isBrand = isBrandQuestion(userMessage);
  const isSmall = isSmallTalk(userMessage);
  const useFastPath = isBrand || isSmall;
  const systemPrompt = useFastPath && isSmall && !isBrand
    ? buildMinimalSystemPrompt(ctx, userLang)
    : buildSystemPrompt(ctx, userLang, { includeBrandKnowledge: isBrand });

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

  const messages: WireMsg[] = [
    { role: "system", content: systemPrompt },
    ...sanitisedHistory.map((m) => ({ role: m.role, content: m.content })),
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
    const res = await callGroqPlain(key, messages);
    const tPost = Date.now();
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawReply = (json.choices?.[0]?.message?.content ?? "").trim();
      /* Strip any leaked tool-call markers BEFORE brand-name
         normalisation so we never ship raw <function=…> syntax to
         the user even on the fast path. */
      const reply = normaliseBrandName(cleanAssistantText(rawReply));
      if (reply) {
        steps.push({ kind: "answer", text: reply, permissionStatus: "allowed" });
        console.log(
          `[ai.agent.timing] fast=${isBrand ? "brand" : "small"} provider=${tPost - tPre}ms total=${Date.now() - tStart}ms`,
        );
        return {
          steps,
          finalReply: reply,
          provider: `groq:${GROQ_MODEL}`,
          conversationId,
        };
      }
    }
    /* Fall through to the full agent loop on any failure. */
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    /* After the per-turn tool budget is spent, disable tools so the
       model can only produce a final answer. */
    const toolChoice: "auto" | "none" = totalToolRuns >= MAX_TOOLS_PER_TURN ? "none" : "auto";
    const res = await callGroqWithRetry(key, messages, { toolChoice });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[ai.agent.groq]", res.status, bodyText.slice(0, 500));

      /* Rescue-first: if tools already produced valid data this turn,
         don't discard that work because a secondary Groq call failed.
         Surface the freshest tool-result text as the final answer so
         the user sees the data they asked for — no "handling a lot of
         requests" banner over a successful search. */
      const rescued = rescueFromToolResults(steps);
      if (rescued) {
        steps.push({ kind: "answer", text: rescued, permissionStatus: "allowed" });
        return {
          steps,
          finalReply: rescued,
          provider: `groq:${GROQ_MODEL}`,
          conversationId,
        };
      }

      /* No rescue available — fall back to the generic error copy.
         Rate limits (429) and overloaded (503) get the friendly
         "handling a lot of requests" line; everything else gets the
         clean generic retry prompt. Raw status stays in the log. */
      const isRateLimited = res.status === 429 || res.status === 503;
      const msg = isRateLimited
        ? "Koleex AI is handling a lot of requests right now. Give it a moment and try again."
        : "I couldn't complete that request. Please try again.";
      steps.push({ kind: "answer", text: msg, permissionStatus: "denied" });
      return {
        steps,
        finalReply: msg,
        provider: `groq:${GROQ_MODEL}`,
        conversationId,
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          role: string;
          content: string | null;
          tool_calls?: WireMsg["tool_calls"];
        };
        finish_reason?: string;
      }>;
    };

    const choice = json.choices?.[0]?.message;
    if (!choice) {
      /* Rescue-first on malformed/empty response too. If tools ran
         earlier this turn, prefer their output over a generic error. */
      const rescued = rescueFromToolResults(steps);
      if (rescued) {
        steps.push({ kind: "answer", text: rescued, permissionStatus: "allowed" });
        return {
          steps,
          finalReply: rescued,
          provider: `groq:${GROQ_MODEL}`,
          conversationId,
        };
      }
      return fallback(
        "I couldn't complete that request. Please try again.",
        conversationId,
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
        const result = await dispatchTool(ctx, tc.function.name, parsedArgs, {
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

    /* Hit the hard ceiling — force the next iteration to produce a
       final answer instead of calling more tools. We signal the model
       by appending a synthetic system message and disabling tools on
       the next call (set tool_choice="none"). */
    if (totalToolRuns >= MAX_TOOLS_PER_TURN) {
      messages.push({
        role: "system",
        content: "Tool-call budget reached. Summarise what you have with no further tool calls.",
      });
    }

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

    /* Short-circuit only on REAL permission denials — NOT on guard
       rejections. Guarded calls carry permissionStatus="denied"
       internally (the union has no neutral option) but they represent
       missing input, not access refusal. Letting the loop continue
       means the model will see the guard message via the tool-role
       feed and rephrase it as a natural question to the user on the
       next iteration. */
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

  return {
    steps,
    finalReply,
    provider: `groq:${GROQ_MODEL}`,
    conversationId,
  };
}

/* ─── Helpers ─────────────────────────────────────────── */

/** Minimal system prompt for small-talk that escaped the canned
 *  fast-reply table (e.g. "hey Koleex", "hi there Koleex AI"). Skips
 *  the tool-routing instructions + brand-knowledge block so the
 *  Groq request stays tiny and fast. Language mirror is kept — it's
 *  the only rule that matters for small-talk. */
function buildMinimalSystemPrompt(
  ctx: UserContext,
  userLang: "en" | "zh" | "ar",
): string {
  const uiLangHint =
    userLang === "zh" ? "Chinese (Simplified)" :
    userLang === "ar" ? "Arabic" :
    "English";
  return `You are Koleex AI, the assistant inside Koleex Hub.

Reply in the same language the user wrote in. If the message is too short to tell (e.g. "ok", "thanks"), fall back to ${uiLangHint}. Keep answers to one short sentence.

Current user: ${ctx.auth.username}.`;
}

function buildSystemPrompt(
  ctx: UserContext,
  userLang: "en" | "zh" | "ar",
  opts: { includeBrandKnowledge: boolean } = { includeBrandKnowledge: false },
): string {
  /* Hint from the client about the UI language. Not a hard rule — the
     model is instructed to MIRROR the user's message language per turn,
     which is what users actually expect. `userLang` is only used as a
     fallback tiebreaker when a turn is too short to language-detect
     (e.g. "ok", "thanks"). */
  const uiLangHint =
    userLang === "zh" ? "Chinese (Simplified)" :
    userLang === "ar" ? "Arabic" :
    "English";

  /* BRAND_KNOWLEDGE is ~2.5k tokens. Loading it alongside tool schemas
     pushes the request past Groq's payload limit (413). It's only
     needed on the fast-path, where tool schemas are absent. */
  const brandBlock = opts.includeBrandKnowledge
    ? `\n\n${BRAND_KNOWLEDGE}\n`
    : "";

  return `You are Koleex AI, the business agent inside Koleex Hub (a multilingual ERP).

Language rules (critical):
- Detect the language of the user's latest message and REPLY IN THAT SAME LANGUAGE.
- If the user writes in Arabic, reply in Arabic. If they write in Chinese, reply in Chinese. If they write in English, reply in English. Same for any other language.
- Keep the language stable across the whole conversation — if the user opened in Arabic, keep replying in Arabic even if the system's UI language hint differs.
- Only switch languages when the user explicitly asks ("answer in English from now on", "رد بالعربية", "请用中文回答"). Mirror the language they switched to, and keep using it until they switch again.
- If the user's message is too short to classify (like "ok" or "thanks"), fall back to ${uiLangHint}.

Be concise.

Tool routing:
- "how many products / how many X" → countProducts (optionally with brand/family filter) or getCatalogStats.
- "what brands / categories / families exist" → getCatalogStats.
- "list products" / "show products" / "what products do we have" → searchProducts with NO query (empty args). Do NOT pass the literal word "products" as the query.
- "find / search products about Y" → searchProducts(query=Y).
- "find customer Z" → getCustomerByName / getCustomerByCode.
- Quotation drafting → follow the workflow below.

Ask-first rules (critical — never call a tool with empty or missing required arguments):
- If the user says "search customer" / "find customer" / "look up a customer" WITHOUT naming one, do NOT call a tool. Ask: "Which customer should I look up? You can send a name or customer code."
- If the user says "I want a quotation" / "create a quotation" WITHOUT giving the customer and at least one product with quantity, do NOT call any tool. Ask for whatever is missing.
- If a tool returns a message starting with "I need" or "Which …", DO NOT echo it verbatim. Rephrase it into a natural question addressed to the user.
- Never invent a customer, product code, id, or quantity to satisfy a required field.

Output rules (critical):
- NEVER write tool-call syntax like <function=…>, <tool_call>, or [tool:…] in your reply. Use the structured tool_calls field when calling tools.
- Keep replies short and business-appropriate. No internal field names, no stack traces, no "validation failed" phrasing.

Do NOT call tools for meta questions. Answer these directly:
- "who are you", "what are you", "what can you do", "hello", "hi", thanks, greetings, small talk, language/identity questions.
- Any question about the Koleex brand itself — company identity, mission, vision, values, the meaning of K-O-L-E-E-X, slogan, tone, personality, visual identity. Use the BRAND FACTS (when provided below) as the single source of truth; do not invent details that aren't there.${brandBlock}

Never invent data. If a tool returns empty, say so. Never reveal values the permission layer filtered out (status="limited"/"denied" means the user isn't allowed to see them — don't guess around them).

Quotation drafting workflow (strict, only triggered when the user asks to create/draft/prepare a quotation):
  1) Resolve the customer → getCustomerByName / getCustomerByCode.
  2) Resolve each product → searchProducts / getProductByCode.
  3) calculateQuotationPricing({ customerId, lines:[{productId, qty}] }) — you NEVER multiply numbers yourself.
  4) Show the totals and ASK the user to confirm.
  5) Only after confirmation, call createQuotationDraft. Status stays 'draft' — never sent, never final.

If pricing is unresolved or out of policy, say so — don't hide it.

Current user: ${ctx.auth.username} (${ctx.auth.user_type}${ctx.isSuperAdmin ? ", super admin" : ""}).`;
}

function toLlmSafe(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    permissionStatus: result.permissionStatus,
    message: result.message,
    data: result.data,
    filteredFields: result.filteredFields,
    sources: result.sources,
  };
}

function humaniseCall(toolName: string, args: Record<string, unknown>): string {
  const q = (args.query as string | undefined) ?? (args.code as string | undefined);
  if (q) return `Running ${toolName}("${q}")…`;
  return `Running ${toolName}…`;
}

/* ─── Tool-syntax sanitizer ─────────────────────────────────────────
   Llama 3.x models occasionally emit tool-call syntax inline in the
   assistant `content` field instead of the structured `tool_calls`
   array (known quirk on 8B-instant; also seen on 70B under load).
   When that happens the raw markers flow into the chat bubble and
   users see something like:
       <function=searchProducts>{"query":"DD"}</function>
   This helper strips those markers unconditionally before the reply
   leaves the server. Three forms are covered:
     · <function=NAME>…</function>
     · <tool_call>…</tool_call>
     · [tool:NAME(…)]
   After stripping, whitespace is collapsed. If nothing is left we
   return "" so callers can substitute a clean follow-up instead of
   showing a blank message. */
function cleanAssistantText(raw: string): string {
  if (!raw) return "";
  const stripped = raw
    .replace(/<function[=\s][\s\S]*?<\/function>/gi, "")
    .replace(/<function[=\s][^>]*\/?>/gi, "") // orphan open/self-close
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_call[^>]*\/?>/gi, "")
    .replace(/\[tool\s*:[^\]]*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped;
}

/** Text patterns that look like internal debug/validation strings
 *  and should NOT be promoted to the user's final reply. Keeps the
 *  safety-fallback picker from grabbing "(cached)" or a terse tool
 *  error message like "productId required." and showing it raw. */
function looksLikeDebug(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t === "(cached)") return true;
  if (/^[a-zA-Z_]+\s+(required|missing)\.?$/i.test(t)) return true;
  if (/^(need|please provide)\b/i.test(t) && t.length < 80) return true;
  return false;
}

/** Picked when we have nothing clean to surface — keeps the tone
 *  conversational rather than exposing internals. */
const GENERIC_FOLLOWUP = "Could you share a bit more so I can help?";

/** Best-effort rescue when the post-tool Groq call fails (429, 5xx,
 *  empty response). Scans steps[] from newest to oldest and returns
 *  the most recent successful tool-result text so the user sees the
 *  data the tools already fetched instead of a generic error banner.
 *
 *  Returns "" when nothing usable is in steps[] — the caller then
 *  falls back to its original error/follow-up message. */
function rescueFromToolResults(steps: AgentStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      s.text
    ) {
      const cleaned = cleanAssistantText(s.text);
      if (cleaned && !looksLikeDebug(cleaned)) {
        return normaliseBrandName(cleaned);
      }
    }
  }
  return "";
}

/** Deprecated phrasings that older builds of the agent used to emit.
 *  They were removed from the code but still live inside ai_messages
 *  rows from past conversations. If we forward those turns to Groq
 *  as history, the model can quote them verbatim on the next turn —
 *  users then see "Need a customerId and at least one valid line"
 *  even though the code no longer produces that string anywhere.
 *
 *  The history sanitiser (applied before building the Groq message
 *  list) drops any ASSISTANT history row whose content matches one
 *  of these patterns. User turns are always preserved. */
const BANNED_ECHOES: RegExp[] = [
  /Need a customer[Ii]d and at least one valid line/i,
  /productId required\.?$/i,
  /customerId required\.?$/i,
  /Please provide a search query\.?$/i,
  /Please provide a customer code\.?$/i,
  /\bUnknown tool\b/i,
];

/* ─── Pre-tool guard ────────────────────────────────────────────────
   Runs AFTER the model emits tool_calls but BEFORE dispatchTool().
   Rejects calls that are clearly invalid — missing customer, missing
   product, missing quantity — so we never hit the DB with junk and
   never burn the audit trail on ghost calls.

   Importantly, guard failures are INTERNAL:
     · no `tool-call` step is pushed (no chip shown)
     · no `tool-result` step is pushed (no red "denied" chip either)
     · the rejection is fed only to the model via the tool-role
       message that the outer loop emits for every toolRuns entry
     · the next model iteration sees the guard message and rephrases
       it as a natural question to the user

   Missing input is NOT a permission denial. The user just sees the
   assistant asking for the info it needs, in the same bubble style
   as any other reply. No red lock chip, no "denied" state.
   ───────────────────────────────────────────────────────────────── */

/** Canonical v4 UUID shape. Blocks stub/hallucinated ids like
 *  "customer-1", "CUSTOMER", "00000000" that small models occasionally
 *  invent to satisfy a required field. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GuardResult = { ok: true } | { ok: false; message: string };

function preToolGuard(
  name: string,
  args: Record<string, unknown>,
): GuardResult {
  switch (name) {
    /* Whitelisted — "list products" / counts / catalogue stats must
       keep working with no args. */
    case "searchProducts":
    case "countProducts":
    case "getCatalogStats":
      return { ok: true };

    case "getCustomerByName": {
      const q = String(args.query ?? "").trim();
      if (!q) {
        return {
          ok: false,
          message:
            "Which customer should I look up? You can send a name or customer code.",
        };
      }
      return { ok: true };
    }

    case "getCustomerByCode": {
      const code = String(args.code ?? "").trim();
      if (!code) {
        return { ok: false, message: "Which customer code should I use?" };
      }
      return { ok: true };
    }

    case "getProductByCode": {
      const code = String(args.code ?? "").trim();
      if (!code) {
        return {
          ok: false,
          message: "Which product code should I look up?",
        };
      }
      return { ok: true };
    }

    case "getProductDetails": {
      const id = String(args.productId ?? "").trim();
      if (!id || !UUID_RE.test(id)) {
        return {
          ok: false,
          message: "I need a product first. Which product should I use?",
        };
      }
      return { ok: true };
    }

    /* Quotation workflow — strictest gate.
       Require (a) a syntactically-valid customerId UUID AND
               (b) at least one line with a valid product UUID + qty > 0.
       Both tools share the same arg shape, so the guard is identical. */
    case "calculateQuotationPricing":
    case "createQuotationDraft": {
      const customerId = String(args.customerId ?? "").trim();
      const rawLines = Array.isArray(args.lines) ? args.lines : [];
      const validLines = rawLines.filter((l) => {
        const rec = l as { productId?: unknown; qty?: unknown };
        const pid = String(rec.productId ?? "").trim();
        const qty = Number(rec.qty ?? 0);
        return pid && UUID_RE.test(pid) && qty > 0;
      });
      const customerOk = customerId && UUID_RE.test(customerId);
      const linesOk = validLines.length > 0;

      if (!customerOk && !linesOk) {
        /* Nothing usable at all — fully-generic ask. */
        return {
          ok: false,
          message:
            "To prepare a quotation, I need the customer name or code, plus the product and quantity.",
        };
      }
      if (!customerOk) {
        return {
          ok: false,
          message:
            "Who is this quotation for? Please send the customer name or code.",
        };
      }
      if (!linesOk) {
        return {
          ok: false,
          message:
            "Which product and quantity should I include in the quotation?",
        };
      }
      return { ok: true };
    }

    default:
      /* Unknown tool names fall through — the registry dispatcher is
         still the enforcement point for unknown-tool and permission
         checks. We only gate the specific arg shapes we know about. */
      return { ok: true };
  }
}

function fallback(msg: string, conversationId: string): AgentResponse {
  return {
    steps: [{ kind: "answer", text: msg, permissionStatus: "denied" }],
    finalReply: msg,
    provider: `groq:${GROQ_MODEL}`,
    conversationId,
  };
}

/* ─── Groq call with retry-after aware backoff ────────────────────────
   Groq's free tier is ~6k tokens / minute on Llama 3.3 70B. With the
   agent loop invoking the model several times per user turn (tool
   schemas alone cost 2-3k tokens each call), bursts can hit 429 even
   on normal use. When that happens Groq returns a `retry-after`
   header (seconds). We honour it up to 3 times before giving up so a
   brief rate-limit doesn't surface as a scary error. */
/** Same retry semantics as callGroqWithRetry but the model call does
 *  NOT include tools. Used for the small-talk fast-path so chit-chat
 *  doesn't burn the tool-schema token overhead on every turn. */
/* Retry budget: up to 3 extra attempts with exponential backoff,
   capped by Groq's `retry-after` when provided. Total wait stays
   under ~10s so the UI doesn't feel frozen, but it's enough for a
   typical Groq free-tier rate-limit window to clear. */
const MAX_RETRIES = 3;
const BACKOFF_CAP_MS = 8000;

function backoffWaitMs(res: Response, attempt: number): number {
  const ra = Number(res.headers.get("retry-after"));
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, BACKOFF_CAP_MS);
  // 1s, 2s, 4s, …
  return Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS);
}

async function callGroqPlain(
  key: string,
  messages: WireMsg[],
  attempt = 0,
): Promise<Response> {
  /* Tighter params for the no-tool fast-path. Agent-loop params stay
     in callGroqWithRetry (max_tokens 2048) so tool responses can still
     reach the full length the model needs. */
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 160,
    }),
  });
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return callGroqPlain(key, messages, attempt + 1);
  }
  return res;
}

async function callGroqWithRetry(
  key: string,
  messages: WireMsg[],
  opts: { toolChoice?: "auto" | "none" } = {},
  attempt = 0,
): Promise<Response> {
  const toolChoice = opts.toolChoice ?? "auto";
  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 2048,
  };
  if (toolChoice !== "none") {
    body.tools = openAiToolSchemas();
    body.tool_choice = "auto";
  }
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  /* Retry budget: up to MAX_RETRIES with exponential backoff, capped
     by Groq's `retry-after` and BACKOFF_CAP_MS. Gives a brief Groq
     free-tier rate-limit window time to clear before we surface the
     friendly "handling a lot of requests" message. */
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return callGroqWithRetry(key, messages, opts, attempt + 1);
  }
  return res;
}

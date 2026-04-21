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
import { brandKnowledgeFor } from "./brand-knowledge";

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
/* Narrow canned fast-replies: only the truly trivial phrases
   ("hi", "thanks") where a longer answer would feel performative.
   Identity / capability questions ("who are you", "what can you do")
   are deliberately NOT in this table anymore — they now hit the model
   which gives a proper, substantive answer about what the assistant
   can actually help with. */
const FAST_REPLIES: Array<[RegExp, string]> = [
  // English
  [/^(hi|hello|hey)[\s,!.?]*$/i,              "Hi! How can I help?"],
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,  "You're welcome."],
  // Arabic
  [/^(مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/,      "مرحبا! كيف أقدر أساعدك؟"],
  [/^(شكرا|شكراً)[\s!.؟]*$/,                   "العفو."],
  // Chinese
  [/^(你好|您好|嗨)[\s,!.?]*$/,                "你好!有什么可以帮您的吗?"],
  [/^谢谢[\s!。?？]*$/,                        "不客气。"],
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

/* Classify which brand-knowledge section(s) a message needs.
   Returns one of "none" | "company" | "ai" | "both". The orchestrator
   injects only the relevant slice — loading both sections at once
   exceeds Groq's request-size limit (413). AI-identity triggers win
   over company triggers when both could match, since phrases like
   "Koleex AI" are Section-2-specific. */
function classifyBrandSection(msg: string): "none" | "company" | "ai" | "both" {
  const s = msg.trim().toLowerCase();
  if (!s) return "none";

  /* Regex-based matchers — tolerant to common typos, missing
     punctuation, verb-tense variations, and word-order differences.
     Rigid substring lists missed real user turns like "who create
     you" (no 'd'), "whats ur name", etc. Each regex is tight to its
     intent to avoid false positives on unrelated chat. */

  /* AI-identity triggers — Section 2. */
  const aiPatterns: RegExp[] = [
    // The brand-AI product name (strongest signal for Section 2)
    /\bkoleex\s+ai\b/i,

    // "who are you" / "who r u" / "who you are"
    /\bwho\s+(?:are|r|u|is)\s+(?:you|u)\b/i,
    // "what are you" / "what r u" / "what kind of ai"
    /\bwhat\s+(?:are|r)\s+(?:you|u)\b/i,
    /\bwhat\s+kind\s+of\s+ai\b/i,
    // "what can you do" / "what do you know" / "what you can do"
    /\bwhat\s+(?:can|do)\s+you\s+(?:do|know)\b/i,
    /\bwhat\s+you\s+can\s+do\b/i,

    // Name questions — tolerate missing apostrophe, extra spaces
    /\bwhat('?s| is| are)?\s+your\s+name\b/i,
    /\byour\s+name\b/i,

    // Who created/made/built you — present OR past tense (fixes "who create you")
    /\bwho\s+(?:create[sd]?|made?|build[ts]?|built|design[esd]?|developed?|trained?)\s+(?:you|u)\b/i,

    // "Are you a real person" / "are you human" / "are you real"
    /\bare\s+you\s+(?:a\s+)?(?:real|human)(?:\s+person)?\b/i,
    /\bare\s+you\s+real\b/i,

    // Trust / reliability of answers
    /\b(?:can\s+i\s+)?trust\s+your\s+(?:answer|reply|response)/i,

    // Replace human support
    /\breplace\s+humans?(?:\s+support)?\b/i,

    // Data/order access
    /\baccess\s+my\s+(?:data|order|orders|account|record)/i,
    /\bsee\s+my\s+(?:order|orders|account|record)/i,

    // Open "can I talk to you"
    /\bcan\s+i\s+talk\s+to\s+you\b/i,

    // Arabic
    /\bما\s+اسمك\b/,
    /\bما\s+هو\s+اسمك\b/,
    /\bاسمك\b/,
    /\bمن\s+(?:أنت|انت)\b/,
    /\bمين\s+(?:أنت|انت)\b/,
    /\bمن\s+(?:صنعك|طورك|بناك|أنشأك|انشأك)\b/,
    /\bهل\s+(?:أنت|انت)\s+إنسان\b/,
    /\bهل\s+(?:أنت|انت)\s+انسان\b/,

    // Chinese
    /你叫什么名字/,
    /你的名字/,
    /你是谁/,
    /你是(?:真人|人类)吗/,
    /你(?:能|可以)做什么/,
  ];

  /* Company-brand triggers — Section 1. Explicit brand / company
     facts (history, mission, vision, CEO, founders, official brand
     material). Word-boundary matching on "koleex" prevents stray
     matches inside URLs or file paths. */
  const companyPatterns: RegExp[] = [
    // English
    /\bkoleex\b/i,
    /\bkoleex\s+(?:group|international|story|history)\b/i,
    /\bcompany\s+history\b/i,
    /\b(?:history|heritage|founded|founder|founders)\b/i,
    /\bceo\b/i,
    /\b(?:mission|vision|core\s+values)\b/i,
    /\bvision\s+2035\b/i,
    /\b(?:official\s+brand|brand\s+guidelines|brand\s+story)\b/i,
    /\b(?:kas|eskn|nefertiti|shafei)\b/i,
    /\bk-o-l-e-e-x\b/i,

    // Where / when / what / who for the company
    /\bwhere\s+is\s+koleex\b/i,
    /\bwhere\s+(?:are|is)\s+you\s+based\b/i,
    /\bheadquarters\b/i,
    /\bwhen\s+(?:was|did)\s+koleex\b/i,
    /\bwhat\s+(?:is|does|industries)\s+koleex\b/i,

    // Arabic
    /\bكوليكس\b/,
    /\bشافعي\b/,
    /\b(?:مؤسس|المؤسس)\b/,
    /\bالرئيس\s+التنفيذي\b/,
    /\bالمدير\s+التنفيذي\b/,
    /\b(?:رؤية|مهمة|رسالة|القيم|تاريخ|تراث)\b/,

    // Chinese
    /柯莱克斯/,
    /科莱克斯/,
    /创始人/,
    /首席执行官/,
    /(?:愿景|使命|价值观|历史)/,
  ];

  const hitsAi = aiPatterns.some((re) => re.test(s));
  const hitsCompany = companyPatterns.some((re) => re.test(s));

  /* AI-identity wins when both match — e.g. "What is Koleex AI?"
     matches both koleex-ai (ai) and koleex (company) but is
     unambiguously a Section 2 question. */
  if (hitsAi) return "ai";
  if (hitsCompany) return "company";
  return "none";
}

/** Thin shim kept for callers that only need a bool. */
function isBrandQuestion(msg: string): boolean {
  return classifyBrandSection(msg) !== "none";
}

export async function orchestrate(input: OrchestrateInput): Promise<AgentResponse> {
  const tStart = Date.now();
  const { ctx, history, userMessage, userLang, conversationId } = input;
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return fallback(
      "Koleex AI isn't configured. Ask an admin to add GROQ_API_KEY.",
      conversationId,
      userMessage,
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
    const cannedSteps: AgentStep[] = [
      { kind: "answer", text: fastReply, permissionStatus: "allowed" },
    ];
    console.warn("[ai.agent.final.before]", fastReply);
    const safeReply = sealFinalReply(fastReply, cannedSteps, userMessage);
    console.warn("[ai.agent.final.after]", safeReply);
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
  const brandSection = classifyBrandSection(userMessage);
  const isBrand = brandSection !== "none";
  const isSmall = isSmallTalk(userMessage);
  const useFastPath = isBrand || isSmall;
  /* Three-way choice:
      · small-talk → minimal prompt (no brand, no agent rules)
      · brand question → LEAN brand prompt (~300 chars of framing +
        the single relevant section). Strips all tool/pricing/agent
        discipline that bloats buildSystemPrompt by ~4 KB and was
        pushing brand requests over Groq's 413 threshold.
      · everything else → full agent buildSystemPrompt. */
  const systemPrompt =
    isBrand
      ? buildBrandSystemPrompt(
          ctx,
          userLang,
          brandSection as "company" | "ai" | "both",
        )
      : useFastPath && isSmall
        ? buildMinimalSystemPrompt(ctx, userLang)
        : buildSystemPrompt(ctx, userLang);

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
     this path. Other paths keep the full sanitised history. */
  const effectiveHistory = isBrand ? [] : sanitisedHistory;

  const messages: WireMsg[] = [
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
    const res = await callGroqPlain(key, messages, {
      maxTokens: isBrand ? 1200 : 160,
    });
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
        console.warn("[ai.agent.final.before]", reply);
        const safeReply = sealFinalReply(reply, steps, userMessage);
        console.warn("[ai.agent.final.after]", safeReply);
        console.log(
          `[ai.agent.timing] fast=${isBrand ? "brand" : "small"} provider=${tPost - tPre}ms total=${Date.now() - tStart}ms`,
        );
        return {
          steps,
          finalReply: safeReply,
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
        console.warn("[ai.agent.final.before]", rescued);
        const safeReply = sealFinalReply(rescued, steps, userMessage);
        console.warn("[ai.agent.final.after]", safeReply);
        return {
          steps,
          finalReply: safeReply,
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
      console.warn("[ai.agent.final.before]", msg);
      const safeReply = sealFinalReply(msg, steps, userMessage);
      console.warn("[ai.agent.final.after]", safeReply);
      return {
        steps,
        finalReply: safeReply,
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
        console.warn("[ai.agent.final.before]", rescued);
        const safeReply = sealFinalReply(rescued, steps, userMessage);
        console.warn("[ai.agent.final.after]", safeReply);
        return {
          steps,
          finalReply: safeReply,
          provider: `groq:${GROQ_MODEL}`,
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

  /* Final-reply finalizer — centralises the full guard chain and
     syncs the last "answer" step. Every return site in orchestrate()
     funnels through sealFinalReply so no path can leak an unsealed
     reply to the route handler (which persists finalReply into
     ai_messages.content → the bubble the user sees). */
  console.warn("[ai.agent.final.before]", finalReply);
  const safeReply = sealFinalReply(finalReply, steps, userMessage);
  console.warn("[ai.agent.final.after]", safeReply);

  return {
    steps,
    finalReply: safeReply,
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
  return `You are Koleex AI, a friendly general-purpose assistant inside Koleex Hub.

Reply in the same language the user wrote in. If the message is too short to tell (e.g. "ok"), fall back to ${uiLangHint}.

Style:
- Be warm and personable. Match the user's tone.
- Give substantive answers. For questions, a couple of paragraphs or a short list is usually right — explain context, give examples, anticipate follow-up. For small talk, a few natural sentences that invite more conversation work well.
- Don't pad for length, but don't clip to one sentence either. Treat each question as worth a real answer.

Current user: ${ctx.auth.username}.`;
}

/** Lean prompt used ONLY on the brand fast-path. Strips the tool /
 *  pricing / execution / field-grounding rules from the full agent
 *  prompt that bloat the request by ~4 KB. Instead it carries the
 *  FINAL PRODUCTION output-style rules that OVERRIDE any formatting
 *  rules printed inside the approved knowledge — Sections 1/2 carry
 *  their own headers like "### Q4: What is your name?" and
 *  "### Identity" which the model was dumping verbatim. These rules
 *  tell the model to treat the block as source material and rewrite
 *  into natural prose. */
function buildBrandSystemPrompt(
  ctx: UserContext,
  userLang: "en" | "zh" | "ar",
  section: "company" | "ai" | "both",
): string {
  const langName =
    userLang === "zh" ? "Chinese (Simplified)" :
    userLang === "ar" ? "Arabic" :
    "English";
  return `You are Koleex AI.

Language rules (read carefully):
- Default: reply in the user's current message language. If it's too short to tell, fall back to ${langName}.
- Explicit override: if the user explicitly tells you which language to reply in (e.g. "reply in Arabic", "respond in Chinese", "answer me in English", "رد بالعربية", "请用中文回答"), honor that override for ALL subsequent replies, even if they keep asking you in a different language — until they ask you to switch again. The request-language and the reply-language can be different; this is intentional.
- When the user writes in English but asks you to reply in Arabic / Chinese (or any other combination), keep their request as-is and answer in the language they asked for.

Content-fidelity rule for languages other than English:
- The approved knowledge below is written in English. When you answer in Arabic or Chinese (or any other language), translate it faithfully into natural, professional phrasing in that language. Do NOT shorten, paraphrase loosely, or drop structure. Your non-English answer should match the English answer's richness — same number of sections, same bullets, same tone.
- Use native structure in the target language (e.g. proper RTL phrasing for Arabic, idiomatic connectors in Chinese). Do not leave English words untranslated unless they are brand names ("Koleex", "Koleex AI", product codes, etc., which always stay in Latin script in every language).

Dialect + tone + messy-input handling:
- Match the user's DIALECT and REGISTER, not just the language. Egyptian Arabic in → Egyptian Arabic out. Formal MSA in → formal MSA out. Casual English in → casual English out. Professional English in → professional English out.
- Franco Arabic / Arabizi: if the user writes Arabic with Latin letters and numerals (3→ع, 7→ح, 2→ء, 5→خ, 6→ط, 9→ص), understand it as Arabic (usually Egyptian) and answer in proper Arabic script.
- Tolerate typos, broken grammar, and partial sentences. If you are ~80% sure what they meant, answer that — never ask them to rephrase.

Current user: ${ctx.auth.username}.

Use the approved knowledge below as your SOURCE OF TRUTH. Never invent anything beyond it. Never emit prices, costs, margins, or financial figures.

OUTPUT & RESPONSE STYLE — FINAL PRODUCTION RULES (these OVERRIDE any formatting rules printed inside the approved knowledge; the knowledge is reference material, not a template to copy):

Content selection (CRITICAL — read before answering):
- Less is better. Clarity beats completeness. The user should grasp the answer in under 5 seconds.
- Do NOT include all available information from the approved knowledge. Select only the most important, most relevant points.
- Lead with the MAIN idea. Surface only the key categories. Drop details that don't move the answer forward.
- Before you write, run each candidate point through this filter:
    · Essential → keep
    · Secondary → remove
    · Repetitive → remove
    · Too detailed → remove
- If you're not sure whether to include something, remove it.

Tone:
- Speak naturally, like a real human assistant. Friendly, professional, easy to understand.
- Use "I" / "me" for casual or basic replies (e.g. "My name is Koleex AI."). For structured business answers, stay neutral.

Length + structure — hard caps (never exceed, no matter how detailed the approved source is):
- Simple question → 1–3 natural lines. No titles, no bullets.
- Informative / complex question → AT MOST 1 short intro line, then MAX 4 sections, MAX 5 bullets per section.
- Pick the 4 most important sections and drop the rest. Pick the 5 most important bullets in each section and drop the rest.

Bullet rules:
- One idea per bullet.
- One line per bullet — keep them short.
- Never cram multiple points into one bullet.
- Never merge different categories into a single list.
- No explanations inside bullets. If an idea needs explanation, put it in a short prose line above the bullets, not inside them.

Strict prohibitions:
- Do NOT list everything the approved knowledge mentions.
- Do NOT mix separate categories into one combined list.
- Do NOT pad with repetition or rephrasing of points already made.
- Do NOT overload a single section with too many items.

Visual layout (treat answers like a premium product interface):
- Never output a dense block of text.
- Structure: short intro → section title on its own line → short bullets under it → blank line → next section.
- Each section title is plain text on its own line (not Markdown).
- Leave a blank line between sections so the answer is easy to scan.
- Keep each section focused; don't overload.

Formatting restrictions — plain clean text only:
- NEVER use "###", "##", or "#" Markdown headers. Just put the plain title on its own line.
- NEVER use "**bold**" markdown around labels or titles.
- NEVER use "---" separator lines.
- NEVER use other heavy Markdown (tables, code fences) unless the user specifically asks for code.
- Use only: short plain titles, "- " bullets, and blank lines between sections.

Never include in your reply:
- Question numbers or labels like "Q1", "Q4", "**Q4: What is your name?**"
- Internal section markers copied from the approved content ("### Identity", "### Role", "#### Purpose", "#### Summary").
- Any hint of how the answer was assembled ("according to the approved knowledge", "based on Section 2", etc.).

Example layout for an informative answer:

My purpose is to make things easier for you.

What I focus on
- Finding information fast
- Helping with tasks and workflows
- Supporting clear communication

How I work
- Always available, no waiting time
- Consistent, structured responses
- Open to casual questions and business topics

Examples of the right tone:

User: "what is your name?"
Reply: "My name is Koleex AI — the official assistant built by Koleex International Group to help with information, tasks, and day-to-day support. You can give me a different name if you'd prefer a more personal touch."

User: "who created you?"
Reply: "I was built by Koleex International Group, with the vision driven by Mr. Kamal Shafei, the Founder and CEO. The goal behind me is to make communication and support easier across the Koleex ecosystem." (natural, first person, 2–4 sentences, no Q3/### markers).

---

${brandKnowledgeFor(section)}`;
}

function buildSystemPrompt(
  ctx: UserContext,
  userLang: "en" | "zh" | "ar",
  opts: { brandSection?: "company" | "ai" | "both" | null } = {},
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

  /* Brand knowledge is large (~8k tokens for Section 2 alone). Only
     inject the section the user is actually asking about — loading
     both at once exceeds Groq's request-size limit (413). The fast
     path also has no tool schemas so there's room for the section. */
  const brandBlock = opts.brandSection
    ? `\n\n${brandKnowledgeFor(opts.brandSection)}\n`
    : "";

  return `You are Koleex AI, the business agent inside Koleex Hub (a multilingual ERP).

Language rules (critical):
- Detect the language of the user's latest message and REPLY IN THAT SAME LANGUAGE.
- If the user writes in Arabic, reply in Arabic. If they write in Chinese, reply in Chinese. If they write in English, reply in English. Same for any other language.
- Keep the language stable across the whole conversation — if the user opened in Arabic, keep replying in Arabic even if the system's UI language hint differs.
- Only switch languages when the user explicitly asks ("answer in English from now on", "رد بالعربية", "请用中文回答"). Mirror the language they switched to, and keep using it until they switch again.
- If the user's message is too short to classify (like "ok" or "thanks"), fall back to ${uiLangHint}.

Answer style:
- Give real, substantive answers. A couple of paragraphs, a short list, or an explanation with an example is usually the right length for a question.
- For small talk, a few friendly sentences that continue the conversation work well — not a one-liner.
- For tool results (a product list, a price, a customer lookup), summarise the data clearly and then add one line of useful context: what it means, what the user might want to do next.
- Don't pad for length and don't clip to one sentence. Match length to the question.
- Use headings, bullets, or numbered steps when they genuinely help; otherwise prose is fine.

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
- Keep the tone business-appropriate. No internal field names, no stack traces, no "validation failed" phrasing. Length should match the question — see the Answer style section above.

Do NOT call tools for meta questions. Answer these directly:
- "who are you", "what are you", "what can you do", "hello", "hi", thanks, greetings, small talk, language/identity questions.
- Any question about the Koleex brand itself — company identity, mission, vision, values, the meaning of K-O-L-E-E-X, slogan, tone, personality, visual identity. Use the BRAND FACTS (when provided below) as the single source of truth; do not invent details that aren't there.${brandBlock}

Never invent data. If a tool returns empty, say so. Never reveal values the permission layer filtered out (status="limited"/"denied" means the user isn't allowed to see them — don't guess around them).

Execution honesty (HARD RULES — the server enforces these):
- NEVER claim that you searched the database, found a customer, found a product, resolved an ID, checked the catalog, or calculated anything unless that result was returned by a successful tool in the current turn.
- If no tool has run yet, ask for input or say you need to use system tools first — do not narrate fake internal workflow.
- Do not write phrases like "I found the customer", "I found the product", "Product ID is …", "Customer ID is …", "Let me check", "checking the database", "I'll calculate", or "Please wait while I check" without matching tool evidence in this turn.

Structured-section discipline (HARD RULES — the server enforces these):
- NEVER output placeholder fields such as [Insert Price], [Insert Address], [Insert Contact Person], [TBD], [To be confirmed], or similar template text.
- NEVER write structured sections like "Customer Resolution", "Product Resolution", "Order Details", "Quotation Details", "Customer Name: …", "Customer Code: …", "Product Name: …", "Product Code: …", "Contact Person: …", or "Address: …" unless the matching fields were returned by a successful tool in the current turn.
- If a customer has not been resolved by a customer lookup tool, do not claim customer details.
- If a product has not been resolved by a product lookup tool, do not claim product details.
- If quotation pricing has not been resolved by a pricing tool, do not write quotation-detail or order-detail sections.
- Keep the answer short. Do not narrate internal workflow.

Field-level grounding (HARD RULES — the server enforces these):
- Do NOT output named fields like Customer Name, Customer Code, Address, Contact Person, Phone, Email, Product Name, Product Code, Description, Specifications, Brand, Model, Quantity, Unit Price, Line Total, Subtotal, Total, Grand Total, Discount, Margin, or Markup UNLESS that exact field was returned by a successful tool in the current turn.
- Partial evidence does NOT justify extra fields. A successful customer lookup does not authorise address/contact/phone/email. A successful product lookup does not authorise code/description/specs/brand/model. A successful pricing call does not authorise every quotation field — only the fields actually returned.
- Keep the answer short and factual.

Quotation drafting workflow (strict, only triggered when the user asks to create/draft/prepare a quotation):
  1) Resolve the customer → getCustomerByName / getCustomerByCode.
  2) Resolve each product → searchProducts / getProductByCode.
  3) calculateQuotationPricing({ customerId, lines:[{productId, qty}] }) — you NEVER multiply numbers yourself.
  4) Show the totals and ASK the user to confirm.
  5) Only after confirmation, call createQuotationDraft. Status stays 'draft' — never sent, never final.

If pricing is unresolved or out of policy, say so — don't hide it.

Pricing Discipline Rules (STRICT) — the server enforces these; if you violate them, the server will override your response.

You must follow these rules at all times:

1. NEVER generate or suggest any numbers related to:
   - price
   - cost
   - unit price
   - total
   - subtotal
   - quotation value
   - discount percentage
   - margin
   - markup

2. You are ONLY allowed to show pricing if:
   - You have just received a successful response from the tool "calculateQuotationPricing"
   - AND the response contains real numeric pricing data.

3. If pricing data is NOT available:
   - DO NOT estimate
   - DO NOT calculate manually
   - DO NOT infer from context
   - DO NOT reuse previous numbers

4. If the user requests a quotation and pricing is not yet calculated:
   - Ask for missing data (customer, product, quantity), OR
   - Call the appropriate tool
   - DO NOT generate any numbers in your response

5. If you accidentally think of a number:
   - DO NOT include it in the response

6. These rules apply to:
   - sentences
   - bullet points
   - tables
   - summaries
   - explanations

7. If you violate these rules, the system will override your response.

Always prioritize correctness over completeness. Never hallucinate pricing.

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

/* ─── Pricing safety guard ──────────────────────────────────────────
   The model CAN hallucinate prices — unit price, totals, discount %,
   margin %, currency amounts. The system prompt tells it not to; this
   server-side guard enforces it regardless of what the model does.

   Before any finalReply leaves orchestrate(), it passes through
   sealPricingSafety(). If the text contains pricing-like output AND
   no pricing tool ran successfully THIS turn, the text is replaced
   with a fixed safe message and the last "answer" step in steps[]
   is updated to match so the UI bubble is consistent.

   Only current-turn steps[] counts as evidence — history is NEVER
   trusted. "denied" pricing-tool results don't count either (the
   tool didn't actually price anything). "approval_required" DOES
   count — that's real numbers that just need sign-off.
   ───────────────────────────────────────────────────────────────── */

/** The ONLY tool whose success counts as real pricing evidence.
 *  createQuotationDraft is intentionally EXCLUDED — the model was
 *  using its presence as a cover to emit invented numbers. The draft
 *  handler internally re-prices, but for the guard's purposes we
 *  only trust calculateQuotationPricing directly: that tool's
 *  payload is the authoritative pricing engine output. */
const PRICING_TOOLS = new Set<string>([
  "calculateQuotationPricing",
]);

/** Numeric fields in a pricing-tool payload that count as "real
 *  pricing data." Must be a positive finite number — strings that
 *  happen to look numeric do NOT qualify. The engine returns
 *  numbers; anything else is either a placeholder or fake. */
const PRICING_PAYLOAD_KEYS: string[] = [
  "total",
  "subtotal",
  "grand_total",
  "grandTotal",
  "unit_price",
  "unitPrice",
  "line_total",
  "lineTotal",
  "price",
];

function isPositiveNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Verify the pricing-tool payload actually contains pricing fields.
 *  Looks at top-level keys and then inside each `lines[]` row, so
 *  both aggregate-level and per-line prices count. Returns false if
 *  the payload is null, empty, or only has non-pricing metadata. */
function payloadHasPricingFields(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const root = payload as Record<string, unknown>;

  for (const k of PRICING_PAYLOAD_KEYS) {
    if (isPositiveNumber(root[k])) return true;
  }

  const lines = root.lines;
  if (Array.isArray(lines)) {
    for (const l of lines) {
      if (!l || typeof l !== "object") continue;
      const row = l as Record<string, unknown>;
      for (const k of PRICING_PAYLOAD_KEYS) {
        if (isPositiveNumber(row[k])) return true;
      }
    }
  }

  return false;
}

/** Patterns that flag assistant text as containing pricing output.
 *  Chosen conservatively — prefer false positives (block a valid but
 *  oddly-phrased reply) to false negatives (let a hallucinated
 *  number through). Ordered roughly from highest-signal to lowest. */
const PRICING_PATTERNS: RegExp[] = [
  // Currency symbol + amount:  $1,200 · €500 · ¥3,400 · £900
  /[$€£¥]\s?\d[\d,]*(\.\d+)?/,
  // Amount + currency symbol:  1,200$ · 500 €
  /\d[\d,]*(\.\d+)?\s?[$€£¥]/,
  // ISO code + amount:         USD 1,200 · EGP 50,000 · CNY 3400
  /\b(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|BRL|IDR|JPY|KRW)\s?\d[\d,]*(\.\d+)?/i,
  // Amount + ISO code:         1,200 USD · 50000 EGP · 3400CNY
  /\d[\d,]*(\.\d+)?\s?(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|BRL|IDR|JPY|KRW)\b/i,
  // Labelled totals near a number
  /\b(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|quotation\s+total|quote\s+total|line\s+total|extended\s+price|list\s+price)\b[^.\n]{0,40}\d/i,
  // Numeric discount / margin / markup
  /\b(discount|margin|markup)\b[^.\n]{0,20}\d+\s*%/i,
  /\b\d+\s*%\s*(discount|margin|markup|off)\b/i,
  // Direct labels with a number right after
  /\b(price|cost|amount|subtotal|total)\s*[:=]\s*\d/i,

  // v2 — bullet / list line starting with a pricing label. Fires on
  // the LABEL alone so multi-line "* Unit Price\n  $1,200" shapes
  // are blocked even when label and number are split across lines.
  // Catches "* Unit Price: …", "- Total Price", "• Grand Total",
  // "**Unit Price**", etc.
  /^\s*(?:[*\-•]|\*\*)\s*(?:\*\*)?\s*(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|line\s+total|quote\s+total|quotation\s+total|extended\s+price|list\s+price)\b/im,

  // v2 — markdown table header naming a pricing column. Catches
  // "| Product | Qty | Unit Price | Total |" where numbers sit in
  // the row below without any currency adornment.
  /\|\s*(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|line\s+total|quote\s+total|quotation\s+total|extended\s+price|list\s+price|price|cost)\s*\|/i,

  // v2 — bare pricing label alone on a line. Catches
  //   Unit Price:
  //     2,500
  // where the label sits on its own line and the value on the next.
  /^\s*(unit\s+price|total\s+price|grand\s+total|quotation\s+total|quote\s+total)\s*[:\-–]?\s*$/im,
];

function containsPricingOutput(text: string): boolean {
  if (!text) return false;
  return PRICING_PATTERNS.some((re) => re.test(text));
}

/** Evidence gate (v2): requires three ANDed conditions on a single
 *  step in THIS turn's steps[].
 *    1. kind === "tool-result"
 *    2. tool === "calculateQuotationPricing"   (see PRICING_TOOLS)
 *    3. permissionStatus !== "denied"
 *    4. payload contains a positive-number pricing field
 *       (top-level or inside a lines[] row).
 *  All four must hold on the same step. A pricing-tool row with a
 *  null/empty payload no longer counts — that was the v1 hole. */
function hasValidPricingEvidence(steps: AgentStep[]): boolean {
  for (const s of steps) {
    if (s.kind !== "tool-result") continue;
    if (!s.tool || !PRICING_TOOLS.has(s.tool)) continue;
    if (s.permissionStatus === "denied") continue;
    if (!payloadHasPricingFields(s.payload)) continue;
    return true;
  }
  return false;
}

/** Fixed replacement text — the exact wording required by spec.
 *  "Customer and product" is slightly optimistic in the edge case
 *  where neither was resolved, but the guard's intent is to stop
 *  fabricated pricing, not to narrate flow state. */
export const PRICING_GUARD_MESSAGE =
  "I found the customer and product, but I cannot provide pricing until the pricing calculation completes successfully.";

/** Single gate every orchestrate-return path calls. Returns the
 *  cleaned finalReply and mutates the last "answer" step's text in
 *  place so the UI matches. No-op when either (a) the reply has no
 *  pricing-like content or (b) a pricing tool ran successfully this
 *  turn. */
export function sealPricingSafety(finalReply: string, steps: AgentStep[]): string {
  if (!containsPricingOutput(finalReply)) return finalReply;
  if (hasValidPricingEvidence(steps)) return finalReply;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text: PRICING_GUARD_MESSAGE,
        permissionStatus: "allowed",
      };
      break;
    }
  }
  console.warn(
    "[ai.agent.pricing-guard] replaced hallucinated pricing; no pricing-tool evidence this turn.",
  );
  return PRICING_GUARD_MESSAGE;
}

/* ─── Execution safety guard ────────────────────────────────────────
   Sibling of the pricing guard. Catches "fake workflow narration" —
   the model claiming it searched the database, found a customer or
   product, resolved an ID, or performed a calculation when no tool
   has actually run in THIS turn's steps[].

   Independent of the pricing guard: this one looks at execution-
   claim phrasing ("I found the customer", "Product ID is …",
   "checking the database") and asks "is there ANY successful tool
   result in this turn?" If not, the narration is hallucinated and
   gets replaced with a short "I need to use system tools" message.

   Runs BEFORE sealPricingSafety at every return site so execution
   hallucinations are caught before the pricing check sees them.
   ───────────────────────────────────────────────────────────────── */

const FAKE_EXECUTION_PATTERNS: RegExp[] = [
  /\bI'?ll try to find\b/i,
  /\bI found .* in (our|the) database\b/i,
  /\bI found the product\b/i,
  /\bI found the customer\b/i,
  /\bProduct ID is\b/i,
  /\bCustomer ID is\b/i,
  /\bLet me check\b/i,
  /\bNow I'?ll calculate\b/i,
  /\bI'?ll calculate\b/i,
  /\bchecking the database\b/i,
  /\bchecking the catalog\b/i,
  /\bI'?ll try to find .* in our database\b/i,
  /\bI'?ll try to find .* in our catalog\b/i,
  /\bPlease wait for a moment while I check\b/i,
];

function containsFakeExecution(text: string): boolean {
  if (!text) return false;
  return FAKE_EXECUTION_PATTERNS.some((re) => re.test(text));
}

/** Any non-denied tool-result in the current turn counts as real
 *  execution evidence. Intentionally tool-agnostic: if the agent
 *  actually ran something, narration is allowed. If no tool fired
 *  at all, any "I found…" / "Let me check…" phrasing is fabricated
 *  and gets replaced. */
function hasRealToolEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) => s.kind === "tool-result" && s.permissionStatus !== "denied",
  );
}

const EXECUTION_GUARD_MESSAGE =
  "I need to use system tools to retrieve real data before proceeding.";

function sealExecutionSafety(finalReply: string, steps: AgentStep[]): string {
  if (!containsFakeExecution(finalReply)) return finalReply;
  if (hasRealToolEvidence(steps)) return finalReply;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text: EXECUTION_GUARD_MESSAGE,
        permissionStatus: "allowed",
      };
      break;
    }
  }
  console.warn(
    "[ai.agent.execution-guard] replaced hallucinated execution text; no tool evidence this turn.",
  );
  return EXECUTION_GUARD_MESSAGE;
}

/* ─── Execution safety guard v2 ─────────────────────────────────────
   Sibling of v1. v1 catches fake workflow narration ("I'll check",
   "Let me search"). v2 catches a different attack vector: fake
   RESOLVED summaries and placeholder fields.

   Targets:
     · placeholder tokens like [Insert Price], [TBD], <insert X>
     · structured sections the model writes as if tools succeeded
       ("Customer Name: …", "Product Code: …", "Order Details")
       when the matching tool did not actually run this turn

   Unlike v1 (which allows any successful tool-result to authorise
   any narration), v2 uses TOOL-FAMILY-SPECIFIC evidence:
     · customer claims require a customer tool result
     · product claims require a product tool result
     · quotation/order-detail claims require a pricing/quotation
       tool result
   Placeholders are always blocked, even with evidence — a
   hallucinated "[Insert Address]" is not legitimised by a
   successful getCustomerByName call.

   Runs AFTER v1, BEFORE sealPricingSafety at every return site. */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[Insert [^\]]+\]/i,
  /\[Enter [^\]]+\]/i,
  /\[Add [^\]]+\]/i,
  /\[TBD\]/i,
  /\[To be [^\]]+\]/i,
  /<insert [^>]+>/i,
];

const FAKE_RESOLUTION_PATTERNS: RegExp[] = [
  /\bwe have found the customer\b/i,
  /\bwe have found the product\b/i,
  /\bi found the customer\b/i,
  /\bi found the product\b/i,
  /\bcustomer resolution\b/i,
  /\bproduct resolution\b/i,
  /\bits details are as follows\b/i,
  /\bdetails are as follows\b/i,
  /\bquotation details\b/i,
  /\border details\b/i,
  /\bcustomer name\s*:/i,
  /\bcustomer code\s*:/i,
  /\bproduct name\s*:/i,
  /\bproduct code\s*:/i,
  /\bcontact person\s*:/i,
  /\baddress\s*:/i,
];

function containsPlaceholders(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

function containsFakeResolvedSummary(text: string): boolean {
  if (!text) return false;
  return FAKE_RESOLUTION_PATTERNS.some((re) => re.test(text));
}

/** Customer-family evidence: a non-denied result from a customer
 *  lookup tool in the current turn. */
function hasCustomerEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "getCustomerByName" || s.tool === "getCustomerByCode"),
  );
}

/** Product-family evidence: a non-denied result from any product
 *  lookup tool in the current turn. */
function hasProductEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "searchProducts" ||
        s.tool === "getProductByCode" ||
        s.tool === "getProductDetails"),
  );
}

/** Quotation-family evidence: a non-denied pricing/draft result in
 *  the current turn. This is broader than PRICING_TOOLS (which is
 *  pricing-only); quotation-detail sections are allowed if EITHER
 *  pricing OR draft succeeded, while actual numeric pricing still
 *  requires PRICING_TOOLS evidence via the separate pricing guard. */
function hasQuotationEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "calculateQuotationPricing" ||
        s.tool === "createQuotationDraft"),
  );
}

const EXECUTION_GUARD_V2_MESSAGE =
  "I need to use verified system results before I can confirm customer, product, or quotation details.";

/** Helper: swap the text of the most recent "answer" step so the
 *  UI bubble matches a replaced finalReply. Shared by every branch
 *  below. */
function replaceLastAnswerStep(steps: AgentStep[], text: string): void {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text,
        permissionStatus: "allowed",
      };
      break;
    }
  }
}

function sealExecutionSafetyV2(
  finalReply: string,
  steps: AgentStep[],
): string {
  const text = finalReply || "";

  const hasPlaceholder = containsPlaceholders(text);
  const hasResolvedSummary = containsFakeResolvedSummary(text);
  if (!hasPlaceholder && !hasResolvedSummary) return finalReply;

  // Placeholders are always blocked, regardless of tool evidence.
  if (hasPlaceholder) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn("[ai.agent.execution-guard-v2] replaced placeholder output.");
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  const customerOk = hasCustomerEvidence(steps);
  const productOk = hasProductEvidence(steps);
  const quotationOk = hasQuotationEvidence(steps);

  // Customer summary without customer-family evidence → block.
  if (/\bcustomer\b/i.test(text) && !customerOk) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced customer summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  // Product summary without product-family evidence → block.
  if (/\bproduct\b/i.test(text) && !productOk) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced product summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  // Quotation/order-detail section without quotation-family evidence → block.
  if (
    /\b(quotation details|order details|quotation|quote)\b/i.test(text) &&
    !quotationOk
  ) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced quotation summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  return finalReply;
}

/* ─── Execution safety guard v3 ─────────────────────────────────────
   FIELD-LEVEL grounding guard. v2 gates on tool-family evidence;
   v3 gates on the exact field. Even if a customer tool ran
   successfully, the model can only write "Customer Name: X" if
   `customer_name` (or its alias) was present in that tool's payload.
   Same for every labelled field across customer / product /
   quotation families.

   This is strictly stricter than v2. Partial evidence (a succeeded
   search, an empty customer match, a list of products) does NOT
   justify field claims — only fields actually returned in the
   payload do. Address/contact/phone/email on a customer, code/brand/
   description/model on a product, unit_price/total/discount on a
   quotation — each must be grounded individually.

   Runs AFTER v2, BEFORE sealPricingSafety at every return site. */

type GroundedFields = {
  customer: Set<string>;
  product: Set<string>;
  quotation: Set<string>;
};

function readObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function addIfPresent(
  set: Set<string>,
  obj: Record<string, unknown>,
  key: string,
  alias?: string,
): void {
  const v = obj[key];
  if (
    v !== null &&
    v !== undefined &&
    !(typeof v === "string" && v.trim() === "")
  ) {
    set.add(alias ?? key);
  }
}

function collectGroundedFields(steps: AgentStep[]): GroundedFields {
  const grounded: GroundedFields = {
    customer: new Set<string>(),
    product: new Set<string>(),
    quotation: new Set<string>(),
  };

  for (const s of steps) {
    if (s.kind !== "tool-result") continue;
    if (s.permissionStatus === "denied") continue;

    const payload = readObject(s.payload);
    if (!payload) continue;

    // Customer tools
    if (s.tool === "getCustomerByName" || s.tool === "getCustomerByCode") {
      addIfPresent(grounded.customer, payload, "customer_name", "customer_name");
      addIfPresent(grounded.customer, payload, "name", "customer_name");
      addIfPresent(grounded.customer, payload, "customer_code", "customer_code");
      addIfPresent(grounded.customer, payload, "code", "customer_code");
      addIfPresent(grounded.customer, payload, "address", "address");
      addIfPresent(grounded.customer, payload, "contact_person", "contact_person");
      addIfPresent(grounded.customer, payload, "contact_name", "contact_person");
      addIfPresent(grounded.customer, payload, "phone", "phone");
      addIfPresent(grounded.customer, payload, "email", "email");
    }

    // Product tools
    if (
      s.tool === "searchProducts" ||
      s.tool === "getProductByCode" ||
      s.tool === "getProductDetails"
    ) {
      addIfPresent(grounded.product, payload, "product_name", "product_name");
      addIfPresent(grounded.product, payload, "name", "product_name");
      addIfPresent(grounded.product, payload, "product_code", "product_code");
      addIfPresent(grounded.product, payload, "code", "product_code");
      addIfPresent(grounded.product, payload, "description", "description");
      addIfPresent(grounded.product, payload, "specifications", "specifications");
      addIfPresent(grounded.product, payload, "specs", "specifications");
      addIfPresent(grounded.product, payload, "brand", "brand");
      addIfPresent(grounded.product, payload, "model", "model");
    }

    // Quotation / pricing tools
    if (
      s.tool === "calculateQuotationPricing" ||
      s.tool === "createQuotationDraft"
    ) {
      addIfPresent(grounded.quotation, payload, "quantity", "quantity");
      addIfPresent(grounded.quotation, payload, "qty", "quantity");
      addIfPresent(grounded.quotation, payload, "unit_price", "unit_price");
      addIfPresent(grounded.quotation, payload, "line_total", "line_total");
      addIfPresent(grounded.quotation, payload, "subtotal", "subtotal");
      addIfPresent(grounded.quotation, payload, "total", "total");
      addIfPresent(grounded.quotation, payload, "grand_total", "grand_total");
      addIfPresent(grounded.quotation, payload, "discount", "discount");
      addIfPresent(grounded.quotation, payload, "margin", "margin");
      addIfPresent(grounded.quotation, payload, "markup", "markup");
    }
  }

  return grounded;
}

/** Labelled field claims the model might write. Each key is the
 *  canonical grounded-field name; each value is the regex that
 *  detects the corresponding label in assistant text. */
const FIELD_CLAIM_PATTERNS: Record<string, RegExp> = {
  customer_name:   /\bcustomer name\s*:/i,
  customer_code:   /\bcustomer code\s*:/i,
  address:         /\baddress\s*:/i,
  contact_person:  /\bcontact person\s*:/i,
  phone:           /\bphone\s*:/i,
  email:           /\bemail\s*:/i,

  product_name:    /\bproduct name\s*:/i,
  product_code:    /\bproduct code\s*:/i,
  description:     /\bdescription\s*:/i,
  specifications:  /\b(specifications|specs)\s*:/i,
  brand:           /\bbrand\s*:/i,
  model:           /\bmodel\s*:/i,

  quantity:        /\b(quantity|qty)\s*:/i,
  unit_price:      /\bunit price\s*:/i,
  line_total:      /\bline total\s*:/i,
  subtotal:        /\bsubtotal\s*:/i,
  total:           /\b(total|grand total)\s*:/i,
  discount:        /\bdiscount\s*:/i,
  margin:          /\bmargin\s*:/i,
  markup:          /\bmarkup\s*:/i,
};

const EXECUTION_GUARD_V3_MESSAGE =
  "I can only confirm fields that were returned by verified system results in this turn.";

function sealExecutionSafetyV3(
  finalReply: string,
  steps: AgentStep[],
): string {
  const text = finalReply || "";
  const grounded = collectGroundedFields(steps);

  const claimedMissing: string[] = [];

  for (const [field, re] of Object.entries(FIELD_CLAIM_PATTERNS)) {
    if (!re.test(text)) continue;

    // Field claim is allowed only if the EXACT canonical name is
    // grounded in at least one of the three family sets.
    if (
      grounded.customer.has(field) ||
      grounded.product.has(field) ||
      grounded.quotation.has(field)
    ) {
      continue;
    }

    claimedMissing.push(field);
  }

  if (claimedMissing.length === 0) return finalReply;

  replaceLastAnswerStep(steps, EXECUTION_GUARD_V3_MESSAGE);
  console.warn(
    "[ai.agent.execution-guard-v3] replaced field claims without grounding:",
    claimedMissing.join(", "),
  );
  return EXECUTION_GUARD_V3_MESSAGE;
}

/* ─── Final-reply finalizer ─────────────────────────────────────────
   Single entry point every orchestrate-return path must call. Runs
   all four guards in the required order and then forcibly syncs the
   last "answer" step in steps[] to match the sealed text — so the
   chat-bubble text (which the route handler persists via
   ai_messages.content = finalReply) and any downstream renderer
   seeing steps[] can never diverge.

   Before this helper, each return site chained the four guards
   inline. A single site drifting (missing a guard, wrong order,
   returning the pre-seal variable by mistake) was enough to leak
   hallucinated output. Centralising in one helper makes drift
   structurally impossible. */

function syncLastAnswerStep(steps: AgentStep[], text: string): void {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text,
        permissionStatus: "allowed",
      };
      return;
    }
  }
}

/* ─── Quotation Hard Mode ───────────────────────────────────────────
   When the user asks for a quotation, we DO NOT trust the model's
   final text at all. Instead we build the reply deterministically
   from the tool-result payloads in steps[]. This is the only
   correctness story for pricing — guards only reduce leak probability;
   hard mode removes model authorship of the reply entirely.

   Detection is pattern-based on the user's turn. If matched, the
   orchestrator's final step replaces `finalReply` with
   `buildSafeQuotationReply(steps)` and the full guard chain still
   runs on the deterministic text as defence in depth. */

const QUOTATION_REQUEST_PATTERNS: RegExp[] = [
  /\b(create|make|draft|prepare|generate|issue|send|build|write)\s+(me\s+|us\s+)?(a\s+|the\s+|an\s+)?(quotation|quote)\b/i,
  /\bquotation\s+for\b/i,
  /\bquote\s+for\b/i,
  /\bprice\s+quote\b/i,
  /\bpricing\s+for\s+\d+\s*(units?|pcs|pieces|sets|boxes|machines)\b/i,
  /\bquotation\s+draft\b/i,
  /\bdraft\s+quotation\b/i,
  /\bI\s+want\s+(a|to\s+(create|make|prepare|draft)\s+a?\s*)\s*(quotation|quote)\b/i,
];

function isQuotationRequest(userMessage: string): boolean {
  const m = String(userMessage ?? "").trim();
  if (!m) return false;
  return QUOTATION_REQUEST_PATTERNS.some((re) => re.test(m));
}

/** Pick the most-specific resolved customer row from this turn.
 *  Priority: getCustomerByCode (single row) > getCustomerByName
 *  (first of up-to-5 matches). Returns null if no customer lookup
 *  succeeded with a populated payload. */
function pickCustomerRow(steps: AgentStep[]): Record<string, unknown> | null {
  let byNameFirst: Record<string, unknown> | null = null;
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool === "getCustomerByCode") {
      const row = readObject(s.payload);
      if (row) return row;
    }
    if (s.tool === "getCustomerByName" && !byNameFirst) {
      if (Array.isArray(s.payload) && s.payload.length > 0) {
        const first = readObject(s.payload[0]);
        if (first) byNameFirst = first;
      }
    }
  }
  return byNameFirst;
}

/** Pick the most-specific resolved product row from this turn.
 *  Priority: getProductByCode / getProductDetails (single row) >
 *  searchProducts (first of .products[]). */
function pickProductRow(steps: AgentStep[]): Record<string, unknown> | null {
  let searchFirst: Record<string, unknown> | null = null;
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool === "getProductByCode" || s.tool === "getProductDetails") {
      const row = readObject(s.payload);
      if (row) return row;
    }
    if (s.tool === "searchProducts" && !searchFirst) {
      const p = readObject(s.payload);
      if (!p) continue;
      const products = p.products;
      if (Array.isArray(products) && products.length > 0) {
        const first = readObject(products[0]);
        if (first) searchFirst = first;
      }
    }
  }
  return searchFirst;
}

/** Pick the pricing-engine payload from this turn. Only counts when
 *  payloadHasPricingFields() agrees — empty-payload pricing calls
 *  (rare but possible) do NOT count as successful pricing. */
function pickPricingPayload(
  steps: AgentStep[],
): Record<string, unknown> | null {
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool !== "calculateQuotationPricing") continue;
    const p = readObject(s.payload);
    if (p && payloadHasPricingFields(p)) return p;
  }
  return null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstPositiveNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/** Deterministic quotation reply. Builds the text from tool payload
 *  fields ONLY — never from model prose. Follows the strict rule:
 *  output a field only if it exists in the payload (and only fields
 *  explicitly whitelisted here; address / contact / specs / discount
 *  / margin / markup / description / product_code are never output,
 *  per spec). Missing pieces fall back to short, fixed questions. */
function buildSafeQuotationReply(steps: AgentStep[]): string {
  const customer = pickCustomerRow(steps);
  if (!customer) {
    return "Who is this quotation for? Please send the customer name or code.";
  }

  const product = pickProductRow(steps);
  if (!product) {
    return "Which product should I include? You can send a product name or code.";
  }

  const pricing = pickPricingPayload(steps);
  if (!pricing) {
    return PRICING_GUARD_MESSAGE;
  }

  const customerName = firstString(customer.name, customer.customer_name);
  const productName = firstString(product.product_name, product.name);
  const currency = firstString(pricing.currency, pricing.currency_code) ?? "";

  // Whitelisted per-line and aggregate pricing fields.
  const pricingLines = Array.isArray(pricing.lines) ? pricing.lines : [];
  const firstLine = pricingLines.length > 0 ? readObject(pricingLines[0]) : null;

  const quantity = firstLine
    ? firstPositiveNumber(firstLine.quantity, firstLine.qty)
    : null;
  const unitPrice = firstLine
    ? firstPositiveNumber(firstLine.unit_price, firstLine.unitPrice, firstLine.price)
    : null;
  const lineTotal = firstLine
    ? firstPositiveNumber(firstLine.line_total, firstLine.lineTotal)
    : null;
  const total = firstPositiveNumber(
    pricing.total,
    pricing.grand_total,
    pricing.grandTotal,
  );

  const out: string[] = ["Quotation summary:"];
  if (customerName) out.push(`- Customer: ${customerName}`);
  if (productName) out.push(`- Product: ${productName}`);
  if (quantity !== null) out.push(`- Quantity: ${quantity}`);
  if (unitPrice !== null) {
    out.push(`- Unit price: ${unitPrice}${currency ? " " + currency : ""}`);
  }
  if (lineTotal !== null) {
    out.push(`- Line total: ${lineTotal}${currency ? " " + currency : ""}`);
  }
  if (total !== null) {
    out.push(`- Total: ${total}${currency ? " " + currency : ""}`);
  }
  return out.join("\n");
}

/* ─── Final-reply sealer ───────────────────────────────────────────
   Single funnel every orchestrate-return path calls. Two modes:

     · Quotation hard mode: if the user turn was a quotation/pricing
       request, the model's text is DISCARDED and the reply is built
       deterministically from tool payloads via
       buildSafeQuotationReply. The full guard chain still runs on
       the deterministic output — defense in depth.

     · Normal mode: v1 → v2 → v3 → pricing on the model's text.

   Either way the last "answer" step is force-synced to the returned
   text so steps[] and finalReply cannot diverge. */

function sealFinalReply(
  finalReply: string,
  steps: AgentStep[],
  userMessage?: string,
): string {
  // Start from the model's text. In quotation hard mode we replace
  // it entirely with a deterministic reply before running the guard
  // chain. The guards still run as belt-and-braces.
  let sealed = finalReply;
  if (userMessage && isQuotationRequest(userMessage)) {
    sealed = buildSafeQuotationReply(steps);
    console.warn(
      "[ai.agent.quotation-hard-mode] model reply discarded; deterministic text used.",
    );
  }
  sealed = sealExecutionSafety(sealed, steps);
  sealed = sealExecutionSafetyV2(sealed, steps);
  sealed = sealExecutionSafetyV3(sealed, steps);
  sealed = sealPricingSafety(sealed, steps);
  syncLastAnswerStep(steps, sealed);
  return sealed;
}

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

function fallback(
  msg: string,
  conversationId: string,
  userMessage?: string,
): AgentResponse {
  /* Defense-in-depth: even this helper — which today is only called
     with fixed server-controlled strings — passes through the
     pricing-safety gate. Keeps every AgentResponse exit consistent. */
  const steps: AgentStep[] = [
    { kind: "answer", text: msg, permissionStatus: "denied" },
  ];
  console.warn("[ai.agent.final.before]", msg);
  const safeReply = sealFinalReply(msg, steps, userMessage);
  console.warn("[ai.agent.final.after]", safeReply);
  return {
    steps,
    finalReply: safeReply,
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
  opts: { maxTokens?: number } = {},
  attempt = 0,
): Promise<Response> {
  /* Fast-path parameters. Caller passes maxTokens based on the
     expected answer length — small-talk needs ~160; brand answers
     are structured multi-paragraph responses that need ~1200 to
     complete without truncation. The agent loop uses its own
     callGroqWithRetry with 2048 tokens. */
  const maxTokens = opts.maxTokens ?? 160;
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
      max_tokens: maxTokens,
    }),
  });
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return callGroqPlain(key, messages, opts, attempt + 1);
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

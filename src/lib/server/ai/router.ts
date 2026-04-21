import "server-only";

/* ---------------------------------------------------------------------------
   ai/router — intent classifier + provider orchestrator.

   Step 1 ships classifyIntent() + modeFor() + a routeAi() whose provider
   dispatch is stubbed. Providers land in Steps 2–3; the stub returns a
   structured error so callers wired up now don't crash when the router
   is called before providers exist.

   Classification is phrase-based, not raw-keyword — we match short
   patterns across EN/AR/ZH. False positives default to chat (safer:
   Groq handles small talk well; DeepSeek shouldn't be asked "hi").
   False negatives on genuine business intent fall through to the
   "unknown" bucket which ALSO routes to chat per the spec.
   --------------------------------------------------------------------------- */

import type {
  AiMessage,
  AiRequest,
  AiResponse,
  ProviderName,
  TaskIntent,
  TaskMode,
} from "./types";
import { buildBusinessPrompt, buildChatPrompt } from "./prompt-builder";
import { groqChat, getLastGroqError } from "./providers/groq";
import { geminiChat } from "../ai-provider";
import {
  deepseekChat,
  getLastDeepseekError,
  isDeepseekEnabled,
} from "./providers/deepseek";

/* ─── Intent classification ──────────────────────────────────── */

/** Chat / meta phrases. Greeting patterns are anchored at the START
 *  of the string (not $-ended) so "hello Koleex AI" or "hi there" still
 *  matches. The classifier runs business patterns FIRST — so greetings
 *  followed by a business phrase (e.g. "hi make me a quote") correctly
 *  route to business. Chat only wins when no business intent is present.
 *  System-info lookups ("list products", "what customers do we have")
 *  also land here — the chat model deflects "I can't see live data,
 *  open the X app" which is the right behaviour for those. */
const CHAT_PATTERNS: RegExp[] = [
  // Short standalone replies.
  /^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,
  /^(ok|okay|cool|got\s+it|understood)[\s!.?]*$/i,
  /^(bye|goodbye|see\s+you)[\s!.?]*$/i,
  // Greetings — match at start, allow trailing words (e.g. "hello Koleex AI").
  /^(hi|hello|hey|yo|hola|salam|salaam)\b/i,
  /^(good\s*(morning|afternoon|evening|night))\b/i,
  // Identity / help meta-questions.
  /who\s+(are|r)\s+you\s*\??/i,
  /what\s+(are|r)\s+you\s*\??/i,
  /what\s+can\s+you\s+do\s*\??/i,
  /what\s+do\s+you\s+know\s*\??/i,
  /how\s+do\s+you\s+work\s*\??/i,
  /how\s+are\s+you[\s,!.?]*/i,
  /what\s+kind\s+of\s+ai\s+are\s+you\s*\??/i,
  // System-info lookups — "list / show / display / tell me about X".
  /^(list|show|display|tell\s+me\s+about)\b/i,
  /^what\s+(products?|customers?|suppliers?|items?|orders?|accounts?|users?|apps?|features?|modules?|categories|brands?)\b/i,
  // Arabic / Chinese basics.
  /مرحبا|اهلا|أهلا|السلام/,
  /من\s+أنت/,
  /你好|你是谁|您好/,
];

/** Business-intent phrases. Phrase-based so we catch "prepare an
 *  offer" and "how much will this cost me" without false-matching on
 *  "price of democracy" or other noise. Add patterns here when the
 *  classifier misses a real business query in production. */
const BUSINESS_PATTERNS: RegExp[] = [
  // Explicit commercial artefacts.
  /\b(quot(e|ation|ing)|proposal)s?\b/i,
  /\boffer\b(?!\s+(?:me|the|a\s+hand|help|suggestion))/i,
  /\binvoices?\b/i,
  // Action + commercial noun within a short window.
  /\b(prepare|make|create|draft|send|generate|build|issue)\b[^.?!]{0,40}\b(offer|quote|quotation|invoice|pricing|proposal|deal)\b/i,
  // Pricing questions.
  /\bprice\s+(for|of|list|per)\b/i,
  /\bhow\s+(much|many)\b/i,
  /\bwhat(?:'s|\s+is)\s+the\s+(price|cost|margin|discount|rate|commission)\b/i,
  /\bcost\s+(breakdown|structure|analysis|per)\b/i,
  // Math / reasoning verbs.
  /\b(calculate|estimate|compute)\b/i,
  // Standalone commercial topics.
  /\b(margin|discount|commission|approval|credit\s*(limit|days|line)?)\b/i,
  /\blanded\s+cost\b/i,
  /\bpricing\s+(breakdown|structure|engine|ladder)\b/i,
  // Quantity × commodity ("for 100 DD machines", "by 50 units").
  /\b(for|by|of)\s+\d+\s*(units?|pcs|pieces|machines|items|sets|boxes)\b/i,
  // Payment / trade terms.
  /\b(fob|cif|exw|payment\s+terms)\b/i,
  // Arabic commercial phrases.
  /عرض\s*سعر|عرض\s*تجاري|تسعير|فاتورة|خصم|هامش|عمولة|تكلفة|كم\s+يكلف|كم\s+السعر|احسب/,
  // Chinese commercial phrases.
  /报价|价格|成本|发票|折扣|利润|佣金|多少钱|计算|商业/,
];

/** Knowledge-intent patterns — general reasoning / explanation /
 *  learning / translation questions. These benefit from DeepSeek's
 *  deeper reasoning over Groq's speed. Ordered AFTER business (so
 *  commercial-specific phrasings win) and AFTER chat-system-info
 *  lookups (so "list products" stays fast-chat).
 *
 *  Narrow patterns — we don't catch bare "why" or "how" without
 *  context to avoid sending small talk here. */
const KNOWLEDGE_PATTERNS: RegExp[] = [
  // English — explanation verbs
  /^(please\s+)?explain\b/i,
  /^(please\s+)?define\b/i,
  /\bmeaning\s+of\b/i,
  /\bwhat\s+does\s+.+\s+mean\b/i,

  // "what is / what are" — generic conceptual questions. Excludes
  // identity questions (already in chat) and Koleex-data questions
  // (already in chat via "what products/customers" etc.) because
  // those are caught in CHAT_PATTERNS before knowledge.
  /^what\s+(is|are|was|were)\s+(?!your\b|you\b|koleex\b)/i,

  // "how does X work", "how do I X", "how to X"
  /^how\s+(does|do\s+i|to)\b/i,

  // Translation / language learning
  /\btranslate\b/i,
  /^(teach|help)\s+me\s+(learn|with)\b/i,
  /^learn\s+(about|how|to)\b/i,
  /\bhow\s+do\s+you\s+say\b/i,

  // Factual / historical
  /^why\s+(does|is|do|are|was|were)\b/i,
  /^when\s+(did|was|were)\b/i,
  /^where\s+(is|are|was|were)\s+(?!you\b|koleex\b)/i,

  // Arabic equivalents
  /\bاشرح\b|\bاشرحي\b/,          // explain
  /\bما\s+معنى\b/,                // what is the meaning of
  /\bما\s+هو\s+(?!اسمك)/,        // what is X (not "what is your name")
  /\bترجم\b/,                     // translate

  // Chinese equivalents
  /解释一下|解释下/,               // explain
  /什么是/,                        // what is
  /翻译/,                          // translate
  /如何/,                          // how
];

export function classifyIntent(message: string): TaskIntent {
  const m = String(message ?? "").trim();
  if (!m) return "chat";
  if (m.length <= 2) return "chat";

  /* Order matters:
     1. Business — most specific (commercial artefacts + quantity × commodity).
     2. Chat — greetings, identity, system-info lookups (specific
        Koleex data questions stay fast).
     3. Knowledge — general reasoning / explanation / translation
        (broader patterns, prefer DeepSeek).
     4. Unknown — nothing matched. */
  for (const p of BUSINESS_PATTERNS) if (p.test(m)) return "business";
  for (const p of CHAT_PATTERNS) if (p.test(m)) return "chat";
  for (const p of KNOWLEDGE_PATTERNS) if (p.test(m)) return "knowledge";
  return "unknown";
}

/** Both "chat" and "knowledge" use the chat prompt (general-purpose
 *  assistant tone). They differ only in which provider we try first,
 *  not in how we prompt the model. Business uses its own prompt. */
export function modeFor(intent: TaskIntent): TaskMode {
  return intent === "business" ? "business" : "chat";
}

/** Spec: chat → Groq, business → DeepSeek. */
export function providerFor(mode: TaskMode): ProviderName {
  return mode === "business" ? "deepseek" : "groq";
}

/** Build the correct prompt for a mode. Exposed so the voice pipeline
 *  and other callers can reuse it without importing prompt-builder
 *  directly. */
export function buildPromptFor(
  mode: TaskMode,
  userMessage: string,
  ctx: AiRequest["context"] = {},
): AiMessage[] {
  return mode === "business"
    ? buildBusinessPrompt(userMessage, ctx)
    : buildChatPrompt(userMessage, ctx);
}

/* ─── Provider dispatch (STEP 4) ─────────────────────────────── */

/** Build the error envelope once so every failure path returns the
 *  same shape. Keeps the `status: "error"` contract stable and avoids
 *  sprinkling boilerplate across the branches. No data shape drift. */
function errorResponse(
  provider: ProviderName,
  mode: TaskMode,
  intent: TaskIntent,
  t0: number,
  message: string,
): AiResponse {
  return {
    provider,
    mode,
    message,
    status: "error",
    meta: { routing: intent, duration_ms: Date.now() - t0 },
    reply: message,
  };
}

/** Ordered cascade for each mode. Chat-first questions prefer Groq
 *  (fast, high rate limits). Business-reasoning questions prefer
 *  DeepSeek (stronger commercial reasoning). Both fall back through
 *  every configured provider and finally to a synthetic answer.
 *
 *  Each item is `[providerName, callerFn, lastErrorFn?]`. caller
 *  returns `{reply, provider}` on success, `null` on failure. */
type ProviderStep = [
  name: "groq" | "deepseek" | "gemini",
  call: (messages: AiMessage[]) => Promise<{ reply: string; provider: string } | null>,
  lastError?: () => string | null,
];

function chainFor(mode: TaskMode, intent: TaskIntent): ProviderStep[] {
  /* Reasoning-heavy intents prefer DeepSeek's deeper model over
     Groq's speed. Commercial (business) and general-knowledge
     (knowledge) both go to DeepSeek first. Fast-chat stays on Groq
     first for snappy response times. */
  const reasoningFirst = mode === "business" || intent === "knowledge";
  if (reasoningFirst) {
    return [
      ["deepseek", deepseekChat, getLastDeepseekError],
      ["groq", groqChat, getLastGroqError],
      ["gemini", geminiChat],
    ];
  }
  return [
    ["groq", groqChat, getLastGroqError],
    ["deepseek", deepseekChat, getLastDeepseekError],
    ["gemini", geminiChat],
  ];
}

/** Synthetic last-resort answer when every provider fails. Brief
 *  intent sniff so common turns (greetings, thanks) get a natural
 *  reply even during an outage. Everything else gets a short
 *  "please try again" — the system NEVER returns an empty or
 *  error-looking response. */
function generateFallbackAnswer(userMsg: string, userLang?: "en" | "zh" | "ar"): string {
  const m = (userMsg ?? "").trim().toLowerCase();
  const lang = userLang ?? "en";

  if (
    /^(hi|hello|hey|yo|hola|salam|salaam)\b/i.test(m) ||
    /^(مرحبا|اهلا|أهلا|السلام)\b/.test(m) ||
    /^(你好|您好|嗨)\b/.test(m)
  ) {
    return lang === "ar"
      ? "مرحبًا! أنا هنا — إن كنت لا أرد بوضوح الآن فهناك خلل مؤقت، حاول مجددًا بعد لحظات."
      : lang === "zh"
      ? "你好!如果我一时没能顺畅回复,可能是系统临时问题,请稍后再试。"
      : "Hello! I'm here. If I'm a bit slow right now, it's a temporary hiccup — please try again in a moment.";
  }

  if (/^(thanks|thank\s+you|thx|ty)\b/i.test(m) || /^(شكرا|شكراً)\b/.test(m) || /^谢谢/.test(m)) {
    return lang === "ar" ? "العفو." : lang === "zh" ? "不客气。" : "You're welcome.";
  }

  if (/\btranslat/i.test(m)) {
    return lang === "ar"
      ? "لا أستطيع معالجة الترجمة الآن. يُرجى إعادة المحاولة خلال لحظات."
      : lang === "zh"
      ? "我暂时无法处理翻译请求,请稍后再试。"
      : "I can't process a translation right now. Please try again in a moment.";
  }

  return lang === "ar"
    ? "أواجه مشكلة مؤقتة في الوصول إلى نظامي. هل يمكنك المحاولة مرة أخرى بعد لحظات أو إعادة صياغة السؤال؟"
    : lang === "zh"
    ? "我的系统暂时有些问题。请稍后再试,或换一种方式问我。"
    : "I'm having a bit of trouble reaching my systems right now. Could you try again in a moment, or rephrase your question?";
}

/** Route a request to the correct provider and return a stable
 *  envelope.
 *
 *  Multi-provider fallback chain (per spec):
 *    Chat / unknown → Groq → DeepSeek → Gemini → synthetic fallback
 *    Business       → DeepSeek → Groq → Gemini → synthetic fallback
 *
 *  Guarantees the router ALWAYS returns a usable message. status
 *  will be "success" even on the synthetic fallback path; the
 *  `provider` field reports which provider served the reply (or
 *  "fallback" if every provider failed). Callers should not treat
 *  status !== "success" as a normal outcome anymore — the only
 *  time that can happen now is a pre-routing error (e.g. empty
 *  messages array) which callers already validate.
 *
 *  The pricing guard (sealPricingSafety, wired into /api/ai/chat
 *  in PR #41) still enforces the no-fabricated-pricing rule on
 *  whichever provider's text comes back. */
export async function routeAi(req: AiRequest): Promise<AiResponse> {
  const t0 = Date.now();
  const last = req.messages[req.messages.length - 1]?.content ?? "";
  const intent: TaskIntent = req.forceMode
    ? req.forceMode === "business"
      ? "business"
      : "chat"
    : classifyIntent(last);
  const mode: TaskMode = modeFor(intent);

  /* Build prompt messages once. Prompt-builder owns system-prompt
     shape, language, cost-disclosure rules, etc. */
  const messages: AiMessage[] = buildPromptFor(mode, last, req.context ?? {});

  /* Oversized-prompt regression detector (Phase 1 observability).
     Chat-path prompts should stay well under 16KB — if a future edit
     to prompt-builder or a runaway context injection pushes the system
     prompt past that threshold we want a warn line in the logs, not a
     silent latency / 413 regression. Does not alter behaviour. */
  const promptBytes = messages.reduce(
    (n, m) => n + (m.content?.length ?? 0),
    0,
  );
  if (promptBytes > 16_000) {
    console.warn(
      `[ai.warn] oversize_prompt bytes=${promptBytes} intent=${intent} mode=${mode}`,
    );
  }

  /* Walk the cascade. First provider whose call returns non-null
     wins. DeepSeek's gate (isDeepseekEnabled) is applied before its
     call so a disabled DeepSeek doesn't count as a real attempt.
     `errors` accumulates diagnostic detail on every skip/failure
     so the [ai.router] final log tells ops exactly which providers
     were tried and why each didn't serve.

     Per-provider timeout (Phase 1 stability): if a provider hangs,
     we abort and move to the next one instead of blocking the user
     for 30+ seconds. Reasoning-heavy providers get a longer budget
     (DeepSeek/Gemini can legitimately take several seconds for
     complex turns); fast-chat providers (Groq) get a tighter one. */
  const timeoutFor = (name: "groq" | "deepseek" | "gemini"): number =>
    name === "groq" ? 12_000 : 25_000;

  const errors: string[] = [];
  const chain = chainFor(mode, intent);
  for (const [name, call, lastErr] of chain) {
    if (name === "deepseek" && !isDeepseekEnabled()) {
      errors.push("deepseek: disabled");
      continue;
    }
    try {
      const budget = timeoutFor(name);
      const result = await Promise.race<
        { reply: string; provider: string } | null
      >([
        call(messages),
        new Promise<never>((_r, reject) =>
          setTimeout(
            () => reject(new Error(`timeout ${budget}ms`)),
            budget,
          ),
        ),
      ]);
      if (result) {
        /* Success log — tells ops which provider served each turn,
           what intent drove the routing choice, and whether we
           fell back off the preferred provider. Cheap (one line
           per successful turn) and invaluable during incidents. */
        const fellBack = chain[0]?.[0] !== name;
        console.log(
          `[ai.router] provider=${name} intent=${intent} mode=${mode}` +
            ` fallback=${fellBack ? 1 : 0} ms=${Date.now() - t0}` +
            (errors.length ? ` skipped=${errors.join(";")}` : ""),
        );
        return {
          provider: name as ProviderName,
          mode,
          message: result.reply,
          status: "success",
          meta: { routing: intent, duration_ms: Date.now() - t0 },
          reply: result.reply,
        };
      }
      errors.push(`${name}: ${(lastErr?.() ?? "failed")}`);
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /* Every provider failed — return a synthetic fallback. The user
     never sees an empty or error-looking reply; the real errors are
     logged so operations can see what went wrong. */
  console.error("[ai.router] all providers failed:", errors.join(" | "));
  const synthetic = generateFallbackAnswer(last, req.context?.userLang);
  return {
    provider: "fallback" as ProviderName,
    mode,
    message: synthetic,
    status: "success",
    meta: { routing: intent, duration_ms: Date.now() - t0 },
    reply: synthetic,
  };
}

// errorResponse helper is retained but no longer used at runtime —
// left available for future pre-routing validation paths.
void errorResponse;

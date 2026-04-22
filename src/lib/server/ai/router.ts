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
  Lane,
  ProviderName,
  TaskIntent,
  TaskMode,
} from "./types";
import {
  buildBusinessPrompt,
  buildChatPrompt,
  buildFastPrompt,
  buildSmartPrompt,
} from "./prompt-builder";
import { preprocessUserQuery, type PreprocessResult } from "./preprocess";
import { detectLanguage, type LanguageDetection } from "./detect-language";
import { analyzeIntent, type IntentAnalysis } from "./analyze-intent";
import { findLocalAnswer, pickLocalAnswer } from "./local-knowledge";
import { detectEntityScope } from "./entity-scope";
import {
  groqChat,
  groqChatStream,
  getLastGroqError,
  type StreamChunk,
} from "./providers/groq";
import { geminiChat } from "../ai-provider";
import {
  deepseekChat,
  deepseekChatStream,
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

/* ─── Phase 2: 3-lane architecture ───────────────────────────────
   Authoritative routing entry point. Given an intent + optional
   forceMode, returns the lane that decides everything downstream
   (provider selection, prompt shape, fallback behaviour).

   Lane detection rules — deliberately simple so ops can predict
   routing from reading the last user message:
     · forceMode === "business" (admin "Create quote" button etc.) → SMART
       (chat route has no tools; reasoning provider is the right
       fit. PROTECTED lane is exclusively served by /api/ai/agent.)
     · intent ∈ {knowledge, business} → SMART (explanation /
       reasoning / commercial framing in chat mode)
     · intent ∈ {chat, unknown}       → FAST (speed wins) */
export function detectLane(
  intent: TaskIntent,
  forceMode?: TaskMode,
): Lane {
  if (forceMode === "business") return "SMART";
  if (intent === "knowledge" || intent === "business") return "SMART";
  return "FAST";
}

/** Provider chain for each lane. Fallback stays inside the same
 *  lane — FAST never crosses into DeepSeek/Gemini; SMART never
 *  falls back to Groq's 8B model. */
export function providersForLane(lane: Lane): Array<"groq" | "deepseek" | "gemini"> {
  if (lane === "FAST") return ["groq"];
  if (lane === "SMART") return ["deepseek", "gemini"];
  return []; // PROTECTED handled by orchestrator, not this router
}

/** Lane-aware prompt builder. FAST gets the slim <2KB prompt;
 *  SMART gets the <4KB reasoning prompt; PROTECTED/business force
 *  uses the existing commercial prompt.
 *
 *  Returns `{full, slim, minimal}` so the router can retry a failed
 *  provider three ways before moving to the next one:
 *    · full    — lane's primary prompt
 *    · slim    — the FAST prompt (lane-neutral, ~1.2KB)
 *    · minimal — single-sentence system + user query only (~80 B)
 *
 *  The minimal attempt is the last-ditch try before a provider swap;
 *  every model can handle "answer concisely in X. <question>" even
 *  when a fuller prompt was what triggered the failure. */
export function buildLanePrompt(
  lane: Lane,
  userMessage: string,
  ctx: AiRequest["context"] = {},
  forceMode?: TaskMode,
): { full: AiMessage[]; slim: AiMessage[]; minimal: AiMessage[] } {
  const minimal = buildMinimalAttempt(userMessage, ctx);
  if (forceMode === "business") {
    const full = buildBusinessPrompt(userMessage, ctx);
    return { full, slim: buildFastPrompt(userMessage, ctx), minimal };
  }
  if (lane === "SMART") {
    return {
      full: buildSmartPrompt(userMessage, ctx),
      slim: buildFastPrompt(userMessage, ctx),
      minimal,
    };
  }
  /* FAST — full === slim (no middle tier); retry jumps straight to minimal. */
  const fast = buildFastPrompt(userMessage, ctx);
  return { full: fast, slim: fast, minimal };
}

/** Minimal last-ditch prompt. Used as the 3rd retry attempt before
 *  swapping providers. Target size: ~80 bytes. Deliberately
 *  content-free — just enough to anchor language + tone. */
function buildMinimalAttempt(
  userMessage: string,
  ctx: AiRequest["context"] = {},
): AiMessage[] {
  const lang =
    ctx.userLang === "ar"
      ? "Arabic"
      : ctx.userLang === "zh"
      ? "Chinese"
      : "English";
  return [
    {
      role: "system",
      content: `Answer the user helpfully in ${lang}. Be concise.`,
    },
    { role: "user", content: userMessage },
  ];
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

/** Legacy ordered cascade — retained for the non-streaming routeAi()
 *  back-compat path. New lane-based routing (providersForLane) is
 *  the authoritative source for streaming + primary chat calls. */
type ProviderStep = [
  name: "groq" | "deepseek" | "gemini",
  call: (messages: AiMessage[]) => Promise<{ reply: string; provider: string } | null>,
  lastError?: () => string | null,
];

/** Build the non-streaming caller chain for a lane. Same provider
 *  order as providersForLane(), but resolved to callable functions
 *  with their last-error accessors. */
function callersForLane(lane: Lane): ProviderStep[] {
  const names = providersForLane(lane);
  return names.map((name) => {
    if (name === "deepseek") return ["deepseek", deepseekChat, getLastDeepseekError] as ProviderStep;
    if (name === "groq") return ["groq", groqChat, getLastGroqError] as ProviderStep;
    return ["gemini", geminiChat] as ProviderStep;
  });
}

/** Phase 5: preambles for local-knowledge fallbacks. When every
 *  provider fails but the user asked a definition we happen to have
 *  in our glossary, we lead with a short apology-free line and then
 *  serve the real local answer — no generic "try again" fluff. */
const LOCAL_PREAMBLES = {
  EN:  "The AI service is temporarily slow, but here's a quick take:",
  AR:  "خدمة الذكاء الاصطناعي بطيئة مؤقتًا، ولكن إليك شرحًا مختصرًا:",
  EGY: "بص، حصل بطء بسيط في الخدمة دلوقتي، بس خليني أشرحلك الموضوع:",
  ZH:  "AI 服务暂时较慢,不过这里先给你一个简短说明:",
} as const;

/** Try to serve a local-knowledge answer instead of a generic
 *  "try again" fallback. Returns null when we have nothing useful
 *  in the glossary — caller falls through to generateFallbackAnswer. */
function localKnowledgeFallback(
  userMsg: string,
  msgLang: import("./detect-language").DetectedLang,
  ppIntent?: import("./preprocess").QueryIntent,
  intentType?: import("./analyze-intent").IntentType,
): string | null {
  /* Only the definition / business types are likely to hit the
     glossary. Explanations and translations fall through. */
  const likelyDefinition =
    intentType === "definition" ||
    ppIntent === "definition" ||
    ppIntent === "business";
  if (!likelyDefinition) return null;

  const ans = findLocalAnswer(userMsg);
  if (!ans) return null;

  const body = pickLocalAnswer(ans, msgLang);
  const preambleKey: keyof typeof LOCAL_PREAMBLES =
    msgLang === "AR"
      ? "AR"
      : msgLang === "EGY" || msgLang === "FRANCO"
      ? "EGY"
      : msgLang === "ZH"
      ? "ZH"
      : "EN";
  return `${LOCAL_PREAMBLES[preambleKey]}\n\n${body}`;
}

/** Synthetic last-resort answer when every provider fails across
 *  every retry. Intent-aware (Phase 3) + local-knowledge-aware
 *  (Phase 5). NEVER returns a generic "I couldn't complete that
 *  request" — the system always gives the user a concrete next
 *  step or an actual answer from the local glossary. */
function generateFallbackAnswer(
  userMsg: string,
  userLang?: "en" | "zh" | "ar",
  ppIntent?: import("./preprocess").QueryIntent,
): string {
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

  /* Intent-aware fallbacks. Each one names what the user asked for
     and suggests a specific next step — never a generic apology. */
  if (ppIntent === "translation" || /\btranslat/i.test(m)) {
    return lang === "ar"
      ? "لا أستطيع معالجة الترجمة الآن — هناك مشكلة مؤقتة في الاتصال بمزود الذكاء الاصطناعي. جرّب مرة أخرى خلال لحظات."
      : lang === "zh"
      ? "我暂时无法处理翻译请求 — AI 服务暂时出现问题,请稍后再试。"
      : "I can't process a translation right now — the AI provider is temporarily unreachable. Please try again in a moment.";
  }

  if (ppIntent === "definition") {
    return lang === "ar"
      ? "كنت سأشرح لك المصطلح بالتفصيل، لكن خدمة الذكاء الاصطناعي غير متاحة حاليًا. جرّب مرة أخرى خلال لحظات، أو اطرح السؤال بصيغة أبسط."
      : lang === "zh"
      ? "本来可以详细解释这个术语,但 AI 服务暂时不可用。请稍后再试,或换一种更简单的问法。"
      : "I'd normally walk you through the meaning of that term, but the AI service is temporarily unavailable. Please try again in a moment, or ask it in a shorter form.";
  }

  if (ppIntent === "explanation") {
    return lang === "ar"
      ? "أردت أن أشرح لك كيف يعمل ذلك، لكن الخدمة غير متاحة مؤقتًا. جرّب مرة أخرى خلال لحظات، أو قسّم السؤال إلى خطوة واحدة."
      : lang === "zh"
      ? "我本想解释它的运作方式,但服务暂时不可用。请稍后再试,或把问题拆成一步来问。"
      : "I'd normally walk you through how that works, but the service is temporarily unavailable. Please try again in a moment, or ask about it one step at a time.";
  }

  if (ppIntent === "business") {
    return lang === "ar"
      ? "هذا سؤال تجاري يحتاج حسابًا دقيقًا، ولن أستطيع الرد الآن بسبب مشكلة مؤقتة في النظام. لأي أرقام حقيقية، افتح تطبيق Koleex المناسب (تسعير، عروض أسعار، فواتير) — لن أختلق أي قيم."
      : lang === "zh"
      ? "这是一个需要精确计算的业务问题,但系统暂时无法响应。需要真实数据时,请打开对应的 Koleex 应用(定价、报价、发票)— 我不会编造数字。"
      : "That's a commercial question that needs precise numbers, and I can't reach my systems right now. For any actual figures, please open the relevant Koleex app (Pricing, Quotations, Invoices) — I won't invent any values.";
  }

  /* Knowledge / chat / unknown — a concrete "try again or rephrase"
     still beats a generic apology. */
  return lang === "ar"
    ? "أواجه مشكلة مؤقتة في الوصول إلى نظامي. حاول مرة أخرى خلال لحظات، أو أعد صياغة السؤال بشكل أبسط."
    : lang === "zh"
    ? "我暂时无法连接到系统。请稍后再试,或换一种更简单的方式问我。"
    : "I'm temporarily unable to reach my systems. Please try again in a moment, or rephrase your question in simpler terms.";
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
  const rawLast = req.messages[req.messages.length - 1]?.content ?? "";

  /* Phase 3: preprocess the user query BEFORE classification and
     model call. Fixes common broken-English grammar ("whats mean by
     X" → "what does X mean?"), normalises whitespace/punctuation,
     and tags a lightweight intent bucket for logging. The UI keeps
     showing the user's original text — only the model-facing path
     sees the normalised version. */
  const pp: PreprocessResult = preprocessUserQuery(rawLast);
  const last = pp.normalizedQuery || rawLast;

  /* Phase 4: detect language from the ORIGINAL user text (not the
     normalised one) so Franco Arabic / Egyptian dialect markers that
     preprocess.ts might have reshaped still register. The preprocessor
     never changes script or dialect, so rawLast is safe here. */
  const detected: LanguageDetection = detectLanguage(rawLast);

  const intent: TaskIntent = req.forceMode
    ? req.forceMode === "business"
      ? "business"
      : "chat"
    : classifyIntent(last);
  const mode: TaskMode = modeFor(intent);
  const lane: Lane = detectLane(intent, req.forceMode);

  /* Phase 5: richer intent + response-format hint. Consumed by the
     prompt builder's formatHint(). Runs on the normalised query so
     "whats mean by X" already reads as a definition by this point. */
  const analysis: IntentAnalysis = analyzeIntent(last);

  /* Phase 19: Koleex entity scope — COMPANY / HUB / PRODUCT. */
  const entity = detectEntityScope(last);

  const enrichedCtx: AiRequest["context"] = {
    ...(req.context ?? {}),
    messageLang: detected.language,
    messageLangConfidence: detected.confidence,
    intentType: analysis.type,
    complexity: analysis.complexity,
    expectedFormat: analysis.expectedFormat,
    entityScope: entity.scope,
  };

  const { full, slim, minimal } = buildLanePrompt(
    lane,
    last,
    enrichedCtx,
    req.forceMode,
  );

  const promptBytes = full.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (promptBytes > 16_000) {
    console.warn(
      `[ai.warn] oversize_prompt bytes=${promptBytes} lane=${lane} intent=${intent}`,
    );
  }

  const timeoutFor = (name: "groq" | "deepseek" | "gemini"): number =>
    name === "groq" ? 12_000 : 25_000;

  /* Phase 3 retry ladder (per provider, in order):
       0 — full    lane's primary prompt
       1 — slim    FAST prompt regardless of lane
       2 — minimal single-line system + user query (~80 B)
     Only after all three attempts fail do we move to the next
     provider in the lane. For FAST lane full === slim so the
     ladder collapses to [full, minimal]. */
  const buildAttempts = (): AiMessage[][] => {
    if (full === slim) return [full, minimal];
    return [full, slim, minimal];
  };

  const errors: string[] = [];
  const chain = callersForLane(lane);
  for (const [name, call, lastErr] of chain) {
    if (name === "deepseek" && !isDeepseekEnabled()) {
      errors.push("deepseek: disabled");
      continue;
    }

    const attempts = buildAttempts();
    for (let i = 0; i < attempts.length; i++) {
      const messages = attempts[i];
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
          const fellBack = chain[0]?.[0] !== name;
          console.log(
            `[ai.router] lane=${lane} provider=${name} intent=${intent}` +
              ` pp_intent=${pp.intent} rewrote=${pp.rewrote ? 1 : 0}` +
              ` msg_lang=${detected.language} conf=${detected.confidence.toFixed(2)}` +
              ` fallback=${fellBack ? 1 : 0} retry=${i} ms=${Date.now() - t0}` +
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
        errors.push(`${name}#${i}: ${(lastErr?.() ?? "failed")}`);
      } catch (e) {
        errors.push(`${name}#${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.error(
    `[ai.router] lane=${lane} pp_intent=${pp.intent} all providers failed:`,
    errors.join(" | "),
  );
  /* Phase 5: try local glossary BEFORE generic synthetic — a real
     definition beats a "try again" message even during an outage. */
  const local = localKnowledgeFallback(
    last,
    detected.language,
    pp.intent,
    analysis.type,
  );
  const synthetic =
    local ??
    generateFallbackAnswer(last, req.context?.userLang, pp.intent);
  return {
    provider: "fallback" as ProviderName,
    mode,
    message: synthetic,
    status: "success",
    meta: { routing: intent, duration_ms: Date.now() - t0 },
    reply: synthetic,
  };
}

/* ─── Streaming (Phase 2) ──────────────────────────────────────── */

/** Metadata yielded at the start of every stream. The client uses
 *  this to show lane/provider badges while tokens arrive. Phase 3
 *  adds preprocess output so the UI can show "normalised" hints. */
export interface RouteStreamStart {
  type: "start";
  lane: Lane;
  intent: TaskIntent;
  mode: TaskMode;
  promptBytes: number;
  originalQuery: string;
  normalizedQuery: string;
  ppIntent: import("./preprocess").QueryIntent;
  rewrote: boolean;
  /** Phase 4: detected message language + confidence. Client can
   *  surface a "replying in Egyptian Arabic" hint if desired. */
  messageLang: import("./detect-language").DetectedLang;
  messageLangConfidence: number;
}

/** Final event at the end of a stream. `reply` is the full text the
 *  client should persist (supersedes accumulated deltas — this is
 *  the canonical, post-processed version). `fallback:1` means the
 *  synthetic generator served because every provider failed. */
export interface RouteStreamEnd {
  type: "end";
  provider: ProviderName;
  lane: Lane;
  intent: TaskIntent;
  reply: string;
  fallback: 0 | 1;
  ttfbMs: number | null;
  totalMs: number;
}

/** Per-token delta. */
export interface RouteStreamDelta {
  type: "delta";
  text: string;
}

export type RouteStreamEvent =
  | RouteStreamStart
  | RouteStreamDelta
  | RouteStreamEnd;

/** Stream a reply token-by-token using lane-scoped provider selection
 *  and intelligent retry. Rules (Phase 2):
 *    · FAST lane  → Groq only. On failure, retry with slim prompt,
 *                   then synthetic.
 *    · SMART lane → DeepSeek primary → Gemini fallback. Each provider
 *                   gets a full-prompt attempt then a slim-prompt
 *                   retry before we move to the next one.
 *    · Providers are attempted one at a time. First provider whose
 *      stream opens AND emits a first chunk within TTFB_BUDGET wins;
 *      we commit to it and pass tokens through unchanged.
 *    · If no provider can stream a first chunk, we yield one synthetic
 *      delta + end with provider="fallback".
 *
 *  The yielded reply is NOT sealed against the pricing guard here —
 *  the chat route applies sealPricingSafety on the final `end.reply`
 *  before persisting / sending the final SSE event, so consumers
 *  should trust `end.reply` as the canonical text. */
const TTFB_BUDGET_MS = 6_000;

export async function* streamRouteAi(
  req: AiRequest,
): AsyncGenerator<RouteStreamEvent> {
  const t0 = Date.now();
  const rawLast = req.messages[req.messages.length - 1]?.content ?? "";

  /* Phase 3 preprocessing — same rules as routeAi(). See that function
     for rationale. Downstream code uses `last` (normalised); we surface
     both values in the `start` event + final log for observability. */
  const pp: PreprocessResult = preprocessUserQuery(rawLast);
  const last = pp.normalizedQuery || rawLast;

  /* Phase 4: detect from original text — see routeAi() for rationale. */
  const detected: LanguageDetection = detectLanguage(rawLast);

  /* Phase 5 intent analysis for prompt shaping + telemetry. */
  const analysis: IntentAnalysis = analyzeIntent(last);

  const intent: TaskIntent = req.forceMode
    ? req.forceMode === "business"
      ? "business"
      : "chat"
    : classifyIntent(last);
  const mode: TaskMode = modeFor(intent);
  const lane: Lane = detectLane(intent, req.forceMode);
  /* Phase 19: Koleex entity scope. */
  const entity = detectEntityScope(last);
  const enrichedCtx: AiRequest["context"] = {
    ...(req.context ?? {}),
    messageLang: detected.language,
    messageLangConfidence: detected.confidence,
    intentType: analysis.type,
    complexity: analysis.complexity,
    expectedFormat: analysis.expectedFormat,
    entityScope: entity.scope,
  };
  const { full, slim, minimal } = buildLanePrompt(
    lane,
    last,
    enrichedCtx,
    req.forceMode,
  );

  const promptBytes = full.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (promptBytes > 16_000) {
    console.warn(
      `[ai.warn] oversize_prompt bytes=${promptBytes} lane=${lane} intent=${intent}`,
    );
  }

  yield {
    type: "start",
    lane,
    intent,
    mode,
    promptBytes,
    originalQuery: pp.originalQuery,
    normalizedQuery: pp.normalizedQuery,
    ppIntent: pp.intent,
    rewrote: pp.rewrote,
    messageLang: detected.language,
    messageLangConfidence: detected.confidence,
  };

  const providers = providersForLane(lane);
  const errors: string[] = [];
  let ttfbMs: number | null = null;

  /* 3-tier retry ladder (see routeAi for details). FAST collapses
     [full, slim, minimal] to [full, minimal]. */
  const attemptsForLane: AiMessage[][] =
    full === slim ? [full, minimal] : [full, slim, minimal];

  for (const provider of providers) {
    if (provider === "deepseek" && !isDeepseekEnabled()) {
      errors.push("deepseek: disabled");
      continue;
    }

    const attempts = attemptsForLane;
    for (let i = 0; i < attempts.length; i++) {
      const messages = attempts[i];
      const attemptStart = Date.now();
      try {
        const served = yield* tryStreamProvider(
          provider,
          messages,
          attemptStart,
        );
        if (served) {
          ttfbMs = served.ttfbMs;
          const totalMs = Date.now() - t0;
          console.log(
            `[ai.router.stream] lane=${lane} provider=${served.providerLabel}` +
              ` intent=${intent} pp_intent=${pp.intent}` +
              ` msg_lang=${detected.language} conf=${detected.confidence.toFixed(2)}` +
              ` rewrote=${pp.rewrote ? 1 : 0} retry=${i} ttfb_ms=${ttfbMs}` +
              ` total_ms=${totalMs}` +
              (errors.length ? ` skipped=${errors.join(";")}` : ""),
          );
          yield {
            type: "end",
            provider: provider as ProviderName,
            lane,
            intent,
            reply: served.reply,
            fallback: 0,
            ttfbMs,
            totalMs,
          };
          return;
        }
        errors.push(`${provider}#${i}: no first chunk`);
      } catch (e) {
        errors.push(
          `${provider}#${i}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  /* All providers failed → emit synthetic as a single delta so the
     UI still progresses, then end. Phase 5: prefer a local-knowledge
     answer (a real definition) over the generic intent-aware
     synthetic when the query is a definition we recognise. */
  console.error(
    `[ai.router.stream] lane=${lane} pp_intent=${pp.intent} all providers failed:`,
    errors.join(" | "),
  );
  const local = localKnowledgeFallback(
    last,
    detected.language,
    pp.intent,
    analysis.type,
  );
  const synthetic =
    local ??
    generateFallbackAnswer(last, req.context?.userLang, pp.intent);
  yield { type: "delta", text: synthetic };
  yield {
    type: "end",
    provider: "fallback",
    lane,
    intent,
    reply: synthetic,
    fallback: 1,
    ttfbMs: null,
    totalMs: Date.now() - t0,
  };
}

/** Try one provider with one prompt. Opens its stream, races the
 *  first chunk against TTFB_BUDGET_MS. If the first chunk arrives in
 *  time, yields all deltas and returns `{reply, providerLabel, ttfbMs}`
 *  on completion. If the first chunk never arrives in time (or the
 *  provider errors before then), aborts and returns null so the
 *  caller moves to the next attempt. */
async function* tryStreamProvider(
  provider: "groq" | "deepseek" | "gemini",
  messages: AiMessage[],
  attemptStart: number,
): AsyncGenerator<
  RouteStreamDelta,
  { reply: string; providerLabel: string; ttfbMs: number } | null
> {
  /* Gemini has no streaming wrapper — fall back to a single-shot
     call and synthesise a one-chunk stream so the lane contract
     (always streams) holds. */
  if (provider === "gemini") {
    const timed = await Promise.race([
      geminiChat(messages),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TTFB_BUDGET_MS + 20_000),
      ),
    ]);
    if (!timed) return null;
    const ttfbMs = Date.now() - attemptStart;
    yield { type: "delta", text: timed.reply };
    return { reply: timed.reply, providerLabel: timed.provider, ttfbMs };
  }

  const gen = provider === "groq"
    ? groqChatStream(messages)
    : deepseekChatStream(messages);

  /* Race the first chunk against TTFB_BUDGET_MS. If the generator
     emits a delta in time, commit; otherwise abort and return null. */
  let gotFirst = false;
  let ttfbMs = 0;
  let assembled = "";
  let providerLabel = provider;

  const firstResult = await Promise.race([
    gen.next(),
    new Promise<IteratorResult<StreamChunk>>((resolve) =>
      setTimeout(
        () =>
          resolve({
            value: { type: "error", error: "ttfb_timeout" } as StreamChunk,
            done: false,
          }),
        TTFB_BUDGET_MS,
      ),
    ),
  ]);

  if (firstResult.done) return null;
  const firstChunk = firstResult.value;
  if (firstChunk.type === "error") {
    /* Ensure the underlying stream is cleaned up. */
    try { await gen.return?.(undefined); } catch { /* noop */ }
    return null;
  }
  if (firstChunk.type === "delta" && firstChunk.text) {
    gotFirst = true;
    ttfbMs = Date.now() - attemptStart;
    assembled += firstChunk.text;
    yield { type: "delta", text: firstChunk.text };
  }
  if (firstChunk.type === "done") {
    /* Empty stream — treat as failure, retry next. */
    return null;
  }

  /* Drain the rest. Each subsequent chunk is yielded to the caller
     unchanged. `done` delivers the cleaned full reply for telemetry
     / post-processing; we prefer that over our accumulated `assembled`
     because providers may strip thinking tags at close. */
  while (true) {
    const { value, done } = await gen.next();
    if (done) break;
    if (value.type === "delta" && value.text) {
      assembled += value.text;
      yield { type: "delta", text: value.text };
    } else if (value.type === "done") {
      if (value.provider) providerLabel = value.provider as typeof provider;
      return {
        reply: value.text ?? assembled,
        providerLabel,
        ttfbMs,
      };
    } else if (value.type === "error") {
      /* Mid-stream error: return what we have so the caller can
         decide (chat route will seal + persist if gotFirst). */
      break;
    }
  }

  if (!gotFirst) return null;
  return { reply: assembled, providerLabel, ttfbMs };
}

// errorResponse helper is retained but no longer used at runtime —
// left available for future pre-routing validation paths.
void errorResponse;

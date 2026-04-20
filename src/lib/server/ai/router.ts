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

export function classifyIntent(message: string): TaskIntent {
  const m = String(message ?? "").trim();
  if (!m) return "chat";
  if (m.length <= 2) return "chat";

  /* Business wins when both match — so greetings followed by a real
     business phrase ("hi, make me a quote for 10 units") route
     correctly. Chat patterns are looser now (greeting can have
     trailing words) which is only safe with this order. */
  for (const p of BUSINESS_PATTERNS) if (p.test(m)) return "business";
  for (const p of CHAT_PATTERNS) if (p.test(m)) return "chat";
  return "unknown";
}

/** Spec: `unknown` falls back to chat (Groq). */
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

/* ─── Provider dispatch (STEP 1 STUB) ────────────────────────── */

/** Real dispatch lands in Step 2 (Groq extract) + Step 3 (DeepSeek).
 *  Leaving this as a structured error instead of `throw` keeps the
 *  router contract stable — a caller hitting the router prematurely
 *  gets a `status: "error"` with a clear message instead of a 500. */
export async function routeAi(req: AiRequest): Promise<AiResponse> {
  const t0 = Date.now();
  const last = req.messages[req.messages.length - 1]?.content ?? "";
  const intent: TaskIntent = req.forceMode
    ? req.forceMode === "business"
      ? "business"
      : "chat"
    : classifyIntent(last);
  const mode: TaskMode = modeFor(intent);
  const provider: ProviderName = providerFor(mode);

  const message =
    "AI is warming up. Hybrid router is live; providers wire in the next step.";
  return {
    provider,
    mode,
    message,
    status: "error",
    meta: { routing: intent, duration_ms: Date.now() - t0 },
    reply: message,
  };
}

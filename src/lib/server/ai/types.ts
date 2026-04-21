import "server-only";

/* ---------------------------------------------------------------------------
   ai/types — shared types for the hybrid AI system.
   Kept minimal. Adding fields here is cheap; retiring fields is costly
   because downstream callers pin on them — resist the urge to over-model.
   --------------------------------------------------------------------------- */

/** Chosen task mode after classification. Drives prompt + provider. */
export type TaskMode = "chat" | "business";

/** Classifier output. `unknown` exists so the caller can tell the
 *  difference between a confident "this is chat" and a fallback
 *  assumption. The router maps `unknown` → chat (Groq) per the
 *  routing rule; metadata still reports the original `unknown`. */
export type TaskIntent = "chat" | "business" | "knowledge" | "unknown";

/** Explicit 3-lane architecture (Phase 2). Every AI request belongs
 *  to exactly one lane; the lane decides provider, prompt shape, and
 *  fallback behaviour.
 *
 *    FAST       Chat / unknown. Groq 8B only, minimal prompt, no
 *               heavy reasoning. Target: sub-1s first token.
 *    SMART      Knowledge / reasoning / explanation / chat-mode
 *               business reasoning. DeepSeek primary, Gemini
 *               fallback. Target: depth over speed.
 *    PROTECTED  Tool-loop agent at /api/ai/agent. Owns tools, DB,
 *               permissions, pricing guards. The chat-route router
 *               never produces PROTECTED — that lane is served
 *               exclusively by the orchestrator. */
export type Lane = "FAST" | "SMART" | "PROTECTED";

/** Provider id exposed to clients (UI badge + telemetry). */
export type ProviderName = "groq" | "deepseek" | "gemini" | "fallback";

/** OpenAI-compatible chat message shape. */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Optional request context — shapes the prompt but never changes
 *  routing. Keep additive; new fields default to undefined. */
export interface AiContext {
  /** Shown in the system prompt as "Current user: <username>". */
  username?: string | null;
  /** UI language — drives the "Reply in X" system instruction. */
  userLang?: "en" | "zh" | "ar";
  /** When false the business prompt explicitly blocks cost disclosure
   *  and uses the neutral redirect. Defaults to true. */
  canSeeCost?: boolean;
}

/** Inbound to the router. */
export interface AiRequest {
  /** Full conversation so far. The LAST element is the new user turn
   *  — that's what the classifier reads. Prior turns pass through to
   *  the provider as-is so multi-turn context is preserved. */
  messages: AiMessage[];
  context?: AiContext;
  /** Escape hatch: skip classification and use this mode directly.
   *  Used by callers that already know the mode (e.g. a "Create
   *  Quotation" button that always routes business). */
  forceMode?: TaskMode;
}

export interface AiMeta {
  /** The classifier's decision, even if it's `unknown`. */
  routing: TaskIntent;
  /** Wall-clock router duration, server-measured. */
  duration_ms: number;
}

/** Router output — the public response contract. */
export interface AiResponse {
  provider: ProviderName;
  mode: TaskMode;
  /** Primary field. Clients should read this. */
  message: string;
  status: "success" | "error";
  meta: AiMeta;
  /** Back-compat alias. Existing callers (FloatingPanel, tests) read
   *  `reply`. New code should use `message`. */
  reply: string;
}

/* ---------------------------------------------------------------------------
   QA AI Investigation Assistant (Phase 8) — shared types.

   The AI layer is an analyst only. These types describe the request it
   receives, the provider result it produces, and the stored session row.
   No type here implies code mutation, execution, or autonomous action.
   --------------------------------------------------------------------------- */

export type AiProviderName = "claude" | "openai" | "gemini" | "groq" | "deepseek";

export type AiSessionStatus = "pending" | "completed" | "failed";

/** Normalised result returned by every provider adapter. */
export interface ProviderResult {
  text: string;
  provider: string;     // e.g. "claude:claude-3-5-sonnet-20241022"
  providerName: AiProviderName;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number;
}

/** Typed provider failure so routes can map to the right HTTP status. */
export type ProviderErrorKind =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "empty_response"
  | "bad_request";

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}

/** A stored AI session (mirrors qa_ai_sessions columns; client-safe subset). */
export interface AiSession {
  id: string;
  issue_id: string;
  workspace_id: string | null;
  provider: string | null;
  model: string | null;
  status: AiSessionStatus;
  response_markdown: string | null;
  error: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  created_at: string;
  /** Parsed confidence label (High/Medium/Low) extracted from the response. */
  confidence?: string | null;
}

import "server-only";

/* ---------------------------------------------------------------------------
   claude — Anthropic Messages API adapter (the initial AI provider).

   Stateless, no SDK dependency: a single fetch with an AbortController
   timeout. Returns a normalised ProviderResult or throws a typed
   ProviderError so the route can map failures to the right HTTP status and
   store a 'failed' session. Never throws raw network errors to the caller.
   --------------------------------------------------------------------------- */

import { ProviderError, type ProviderResult } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
const TIMEOUT_MS = Number(process.env.QA_AI_TIMEOUT_MS) || 45_000;
const MAX_TOKENS = Number(process.env.QA_AI_MAX_TOKENS) || 2200;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callClaude(system: string, user: string): Promise<ProviderResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ProviderError("not_configured", "Anthropic API key is not configured.");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ProviderError("timeout", `Claude request timed out after ${TIMEOUT_MS}ms.`);
    }
    throw new ProviderError("provider_error", e instanceof Error ? e.message : "Network error reaching Claude.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new ProviderError("rate_limited", "Claude rate limit reached. Try again shortly.", 429);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderError("provider_error", `Claude ${res.status}: ${body.slice(0, 300)}`, 502);
  }

  let json: {
    content?: Array<{ type: string; text?: string }>;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  try {
    json = await res.json();
  } catch {
    throw new ProviderError("provider_error", "Claude returned a malformed (non-JSON) response.", 502);
  }

  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  if (!text) throw new ProviderError("empty_response", "Claude returned an empty response.");

  const model = json.model || DEFAULT_MODEL;
  return {
    text,
    provider: `claude:${model}`,
    providerName: "claude",
    model,
    tokensInput: json.usage?.input_tokens ?? null,
    tokensOutput: json.usage?.output_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

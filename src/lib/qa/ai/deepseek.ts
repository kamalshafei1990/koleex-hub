import "server-only";

/* ---------------------------------------------------------------------------
   deepseek — DeepSeek adapter for the QA AI analyst (primary provider).

   DeepSeek exposes an OpenAI-compatible Chat Completions API, so this mirrors
   claude.ts exactly: a single fetch with an AbortController timeout, returning
   a normalised ProviderResult or throwing a typed ProviderError. No SDK.

   Activation: presence of DEEPSEEK_API_KEY alone (no extra flag) — so the
   "Ask AI to Analyse" button works automatically once the key is set.

   Security: this adapter ONLY ever receives the already-sanitized workspace
   prompt + system prompt passed by analyze.ts (sanitizeWorkspaceForAI runs
   upstream). It sends nothing else — no env, no secrets, no cookies, no DB.
   --------------------------------------------------------------------------- */

import { ProviderError, type ProviderResult } from "./types";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const TIMEOUT_MS = Number(process.env.QA_AI_TIMEOUT_MS) || 45_000;
const MAX_TOKENS = Number(process.env.QA_AI_MAX_TOKENS) || 2200;

export function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function callDeepseek(system: string, user: string): Promise<ProviderResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new ProviderError("not_configured", "Koleex AI is not configured.");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        // System + sanitized user context as OpenAI-style messages.
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ProviderError("timeout", `Koleex AI request timed out after ${TIMEOUT_MS}ms.`);
    }
    throw new ProviderError("provider_error", "Koleex AI could not be reached. Please try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new ProviderError("rate_limited", "Koleex AI is busy right now. Please try again shortly.", 429);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[qa.ai.koleex]", res.status, body.slice(0, 200));
    throw new ProviderError("provider_error", `Koleex AI service error (${res.status}).`, 502);
  }

  let json: {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    json = await res.json();
  } catch {
    throw new ProviderError("provider_error", "Koleex AI returned a malformed response.", 502);
  }

  // deepseek-reasoner can prefix <think>…</think>; deepseek-chat does not, but
  // strip defensively so the stored analysis is clean (no-op on clean output).
  const raw = json.choices?.[0]?.message?.content ?? "";
  const text = raw.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
  if (!text) throw new ProviderError("empty_response", "Koleex AI returned an empty response.");

  const model = json.model || DEFAULT_MODEL;
  return {
    text,
    provider: `deepseek:${model}`,
    providerName: "deepseek",
    model,
    tokensInput: json.usage?.prompt_tokens ?? null,
    tokensOutput: json.usage?.completion_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/adapters/openai-compatible — the second provider.

   Phase 4B. The plan named Qwen/DashScope as the China-accessible candidate
   and this file was going to hard-code its endpoint. It does not, for a reason
   worth writing down rather than hiding:

     THE ENDPOINT COULD NOT BE VERIFIED FROM HERE. This environment's egress
     policy refuses CONNECT to dashscope.aliyuncs.com, so the URL, the path and
     the model ids would have been written from memory and shipped as fact.
     A wrong constant in a failover path is worse than no failover: it looks
     configured, and it fails at the exact moment the primary is already down.

   So the vendor is configuration, not code. Set four environment variables and
   any OpenAI-compatible service becomes the fallback — Qwen/DashScope,
   Moonshot, Zhipu, a mainland-hosted gateway, or a self-hosted vLLM. That is
   also the stronger reading of the standing rule "do not hard-code one AI
   provider into the architecture": the SECOND provider is the one where that
   rule actually gets tested.

     AI_FALLBACK_BASE_URL   e.g. https://<host>/compatible-mode/v1
     AI_FALLBACK_API_KEY
     AI_FALLBACK_MODEL      e.g. qwen-plus
     AI_FALLBACK_LABEL      optional; defaults to the host name

   INERT UNTIL CONFIGURED, by construction. configured() requires all three of
   url, key and model, so an unset deployment behaves exactly as it did before
   this file existed — the registry skips it and DeepSeek serves every turn.
   There is no key for it in any environment today, which means this adapter is
   proved by its contract and by fakes, NOT against a live service. Said plainly
   because the difference matters: the interface is tested, the vendor is not.

   HTTPS IS REQUIRED. The API key travels in an Authorization header; over
   plaintext http:// an operator typo would put a live credential on the wire.
   A non-https base URL disables the adapter rather than downgrading it.
   --------------------------------------------------------------------------- */

import {
  postChat,
  postChatStreaming,
  isTransientNetError,
} from "@/lib/server/ai/core/transport";
import { toOpenAiBody, type TurnRequest, type TurnResponse } from "../turn-ir";
import type { ProviderAdapter, TurnOutcome } from "../types";
import { modelForClass } from "@/lib/server/ai/router/model-classes";

/** Parsed once at module load. `null` means "not configured", which is the
 *  normal state and is not an error. */
interface FallbackConfig {
  readonly chatUrl: string;
  readonly model: string;
  readonly label: string;
}

/** Exported for the test: the validation rules are the security-bearing part
 *  of this file, so they are proved directly rather than through env fiddling. */
export function parseFallbackConfig(env: {
  AI_FALLBACK_BASE_URL?: string;
  AI_FALLBACK_API_KEY?: string;
  AI_FALLBACK_MODEL?: string;
  AI_FALLBACK_LABEL?: string;
}): FallbackConfig | null {
  const base = env.AI_FALLBACK_BASE_URL?.trim();
  const model = env.AI_FALLBACK_MODEL?.trim();
  /* The key is only checked for PRESENCE here and is never carried in the
     returned config — it is read at call time and handed straight to the
     transport, so it cannot be captured in a module-scope object that a stack
     trace or a debug dump might print. */
  const hasKey = Boolean(env.AI_FALLBACK_API_KEY?.trim());
  if (!base || !model || !hasKey) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  /* Plaintext would put the credential on the wire. Refuse rather than
     downgrade — a fallback that leaks the key is not a fallback. */
  if (url.protocol !== "https:") return null;

  const trimmed = base.replace(/\/+$/, "");
  return {
    chatUrl: `${trimmed}/chat/completions`,
    model,
    label: env.AI_FALLBACK_LABEL?.trim() || url.hostname,
  };
}

/* Read explicitly rather than passing process.env: this project types
   ProcessEnv strictly, and naming the four variables here is also the only
   place a reader has to look to know what this adapter consumes. */
const CONFIG = parseFallbackConfig({
  AI_FALLBACK_BASE_URL: process.env.AI_FALLBACK_BASE_URL,
  AI_FALLBACK_API_KEY: process.env.AI_FALLBACK_API_KEY,
  AI_FALLBACK_MODEL: process.env.AI_FALLBACK_MODEL,
  AI_FALLBACK_LABEL: process.env.AI_FALLBACK_LABEL,
});

function readKey(): string | undefined {
  return process.env.AI_FALLBACK_API_KEY?.trim() || undefined;
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/* Deliberately identical to the DeepSeek adapter's parse, and deliberately NOT
   shared with it. The two providers agree on this shape today; the moment one
   of them does not, the fix must be possible in ONE adapter without touching
   the other. A shared helper here would be the exact coupling the provider
   layer exists to prevent. The response contract they must both satisfy is
   what is shared, and that lives in ../types. */
function toTurnResponse(json: OpenAiChatResponse): TurnResponse {
  const choice = json.choices?.[0];
  const msg = choice?.message;
  return {
    content: msg?.content ?? "",
    toolCalls: (msg?.tool_calls ?? []).map((c) => ({
      id: c.id,
      name: c.function.name,
      argumentsJson: c.function.arguments,
    })),
    finishReason: choice?.finish_reason ?? null,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
    },
  };
}

export const openAiCompatibleAdapter: ProviderAdapter = {
  name: CONFIG?.label ?? "fallback",

  configured: () => CONFIG !== null && Boolean(readKey()),

  model: () => CONFIG?.model ?? "unconfigured",

  async chat(req: TurnRequest, opts): Promise<TurnOutcome> {
    const key = readKey();
    if (!CONFIG || !key) {
      return { ok: false, status: 503, bodyText: "fallback provider not configured" };
    }
    const body = toOpenAiBody(req, modelForClass(CONFIG.label, CONFIG.model, req.modelClass));

    if (opts?.onDelta) {
      const s = await postChatStreaming(CONFIG.chatUrl, key, body, opts.onDelta);
      if (!s.ok) return { ok: false, status: s.status || 500, bodyText: s.bodyText };
      return {
        ok: true,
        response: {
          content: s.content,
          toolCalls: s.toolCalls.map((c) => ({
            id: c.id,
            name: c.function.name,
            argumentsJson: c.function.arguments,
          })),
          finishReason: null,
        },
      };
    }

    const res = await postChat(CONFIG.chatUrl, key, body);
    if (!res.ok) {
      return { ok: false, status: res.status, bodyText: await res.text().catch(() => "") };
    }
    try {
      return { ok: true, response: toTurnResponse((await res.json()) as OpenAiChatResponse) };
    } catch (e) {
      if (!isTransientNetError(e)) throw e;
      return { ok: false, status: 502, bodyText: "response body terminated mid-read" };
    }
  },
};

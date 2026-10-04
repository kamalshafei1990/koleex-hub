import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/adapters/deepseek — the first adapter, and the reference one.

   Phase 3B introduced it as a thin delegate. Phase 4A gave it the things that
   actually make it an adapter rather than a wrapper: THIS file now owns the
   endpoint URL, the model id and the API key. They used to live in
   core/transport.ts, which meant "the core is vendor-neutral" was true of the
   loop but not of the layer underneath it.

   Vendor surface, in one place so it is auditable:
     · endpoint  https://api.deepseek.com/v1/chat/completions
     · model     DEEPSEEK_AGENT_MODEL / DEEPSEEK_MODEL / "deepseek-chat"
     · key       DEEPSEEK_API_KEY
   The key is read here and handed to transport as an argument. It is never
   logged, never put in an error message, and never reaches the model, the
   prompt, or the client.

   DeepSeek's HTTP API is OpenAI-compatible — same chat/completions body, same
   `tools` + `tool_choice` function-calling contract, same
   `choices[].message.tool_calls` response shape — so the shared Turn IR
   conversions in ../turn-ir cover it without a vendor-specific body builder.

   ON THE KILL-SWITCH: `USE_DEEPSEEK` IS consulted here, as of Phase 7.

   4D deliberately did not, because under the old test — `=== "true"` — an
   UNSET variable meant disabled, so honouring it would have taken the agent
   down in any environment holding the key without the flag. The switch now
   lives in router/provider-policy.ts where ABSENCE MEANS ENABLED, which
   removes that risk entirely: an environment that never set the variable is
   unaffected, and only an explicit "false"/"0"/"off" turns anything off.

   So the flag finally does what its name says, on every path. `configured()`
   is where it belongs rather than inside `chat()`: an adapter that is switched
   off should not be SELECTED, so the registry skips it and fails over to the
   next provider instead of returning a failure from a provider nobody wanted.
   --------------------------------------------------------------------------- */

import {
  postChat,
  postChatStreaming,
  isTransientNetError,
} from "@/lib/server/ai/core/transport";
import { toOpenAiBody, type TurnRequest, type TurnResponse } from "../turn-ir";
import type { ProviderAdapter, TurnOutcome } from "../types";
import { modelForClass } from "@/lib/server/ai/router/model-classes";
import { deepseekEnabled } from "@/lib/server/ai/router/provider-policy";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

/* Read at module scope, as it always has been. A key rotated without a
   redeploy will not be picked up — true before 4A and unchanged by it. */
const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_AGENT_MODEL ||
  process.env.DEEPSEEK_MODEL ||
  "deepseek-chat";

function readKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY;
}

/** The provider's answer shape. Parsed here so the loop never sees it. */
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

/** Exported for the differential test: it feeds canned provider JSON through
 *  this and compares the result with what the agent loop used to build inline. */
export { toTurnResponse as parseOpenAiChatResponse };

export const deepseekAdapter: ProviderAdapter = {
  name: "deepseek",

  configured: () => deepseekEnabled() && Boolean(readKey()),

  model: () => DEEPSEEK_MODEL,

  async chat(req: TurnRequest, opts): Promise<TurnOutcome> {
    const key = readKey();
    if (!key) return { ok: false, status: 503, bodyText: "no provider key configured" };

    /* ONE body builder for both paths, and the same one the IR differential
       test pins against recorded goldens. Before 4A the streaming path and
       the tool path each hard-coded max_tokens: 2048 inside transport while
       the IR carried its own value — they agreed, but only by coincidence. */
    const body = toOpenAiBody(req, modelForClass("deepseek", DEEPSEEK_MODEL, req.modelClass));

    /* ── Streaming ────────────────────────────────────────────────────
       transport reassembles fragmented tool_calls by index — the behaviour
       an incident pin in validate:ai-baseline protects — and returns them
       parsed, so there is no JSON to read here. */
    if (opts?.onDelta) {
      const s = await postChatStreaming(DEEPSEEK_URL, key, body, opts.onDelta);
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
          /* Phase 5B. Present only when the provider volunteered it on an SSE
             frame; null otherwise, and never estimated. */
          usage: s.usage ?? { inputTokens: null, outputTokens: null },
        },
      };
    }

    const res = await postChat(DEEPSEEK_URL, key, body);
    if (!res.ok) {
      return { ok: false, status: res.status, bodyText: await res.text().catch(() => "") };
    }
    try {
      return { ok: true, response: toTurnResponse((await res.json()) as OpenAiChatResponse) };
    } catch (e) {
      /* A 200 whose body died mid-read. The loop's rescue path expects this
         as a FAILED call, not an exception — it is the difference between a
         friendly hand-back and a raw 500. */
      if (!isTransientNetError(e)) throw e;
      return { ok: false, status: 502, bodyText: "response body terminated mid-read" };
    }
  },
};

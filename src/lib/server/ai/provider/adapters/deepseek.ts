import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/adapters/deepseek — the first adapter, and the reference one.

   Phase 3B. It does NOT re-implement the HTTP call. It delegates to
   core/transport.ts, which Phase 2D isolated for exactly this moment: the
   endpoint, key, retry policy and streaming reassembly stay where they are and
   keep behaving identically, while the SHAPE the loop sees becomes neutral.

   What is genuinely new here is the parsing. Two of the three call sites used
   to parse the provider's JSON inside the agent loop; that parse lives here
   now, so the loop no longer knows what a `choices[0].message` is. A
   differential test pins the result against what the loop used to build.
   --------------------------------------------------------------------------- */

import {
  callGroqPlain,
  callGroqStreamingOnce,
  callGroqWithRetry,
  readProviderKey,
  isTransientNetError,
  agentModel,
  type WireMsg,
  type ToolSchema,
  type ToolChoice,
} from "@/lib/server/ai/core/transport";
import {
  toOpenAiMessages,
  toOpenAiTools,
  toOpenAiToolChoice,
  type TurnRequest,
  type TurnResponse,
} from "../turn-ir";
import type { ProviderAdapter, TurnOutcome } from "../types";

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

  configured: () => Boolean(readProviderKey()),

  model: () => agentModel(),

  async chat(req: TurnRequest, opts): Promise<TurnOutcome> {
    const key = readProviderKey();
    if (!key) return { ok: false, status: 503, bodyText: "no provider key configured" };

    const messages = toOpenAiMessages(req.messages) as unknown as WireMsg[];
    const tools = req.tools ? (toOpenAiTools(req.tools) as unknown as ToolSchema[]) : undefined;
    const toolChoice = req.toolChoice ? (toOpenAiToolChoice(req.toolChoice) as ToolChoice) : undefined;

    /* ── Streaming ────────────────────────────────────────────────────
       transport already reassembles fragmented tool_calls by index — the
       behaviour an incident pin in validate:ai-baseline protects — and
       returns them parsed, so there is no JSON to read here. */
    if (opts?.onDelta) {
      const s = await callGroqStreamingOnce(key, messages, {
        toolChoice: toolChoice ?? "auto",
        onDelta: opts.onDelta,
        /* The streaming call site in the loop always supplies tools, so this
           fallback does not fire today. It is `[]` rather than `undefined`
           because that call sends `tools` whenever the choice is not "none" —
           see toOpenAiBody, where an EMPTY tool list and NO tools are
           deliberately different requests. */
        tools: tools ?? [],
      });
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

    /* ── No tools: the small-talk / brand fast path ───────────────────
       A turn with no tools goes through the plain call, which sends neither
       `tools` nor `tool_choice` — see toOpenAiBody for why that distinction
       is load-bearing. */
    const res = req.tools === undefined
      ? await callGroqPlain(key, messages, { maxTokens: req.maxTokens })
      : await callGroqWithRetry(key, messages, { toolChoice: toolChoice ?? "auto", tools });

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

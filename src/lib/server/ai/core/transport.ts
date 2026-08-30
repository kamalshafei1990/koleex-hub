import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/transport — the ONLY place that speaks to a model provider.

   Phase 2D. Every raw `fetch` to a completions endpoint, the endpoint URL, the
   model id, the API key read, the retry/backoff policy and the streaming
   `tool_calls` reassembly now live here and nowhere else. Before this they sat
   in the middle of the tool loop, which is why "swap the provider" read as a
   change to the orchestrator rather than a change to one module.

   This is deliberately the LAST thing extracted in the core refactor, because
   it is the seam Phase 3 cuts along: the provider abstraction replaces the
   inside of this file with adapters and a Turn IR, and nothing above it has to
   move again. Isolating it first is what makes that a contained change.

   VENDOR SURFACE, stated plainly so it is auditable in one place:
     · endpoint  AGENT_LLM_URL
     · model     AGENT_MODEL (DEEPSEEK_AGENT_MODEL / DEEPSEEK_MODEL / default)
     · key       DEEPSEEK_API_KEY, read via readProviderKey()
     · label     providerLabel() — the string reported back as `provider`
   The key is read here and passed as an argument; it is never logged, never
   put in an error message, and never reaches the model or the client.

   The layering item recorded in 2D is CLOSED (Phase 2F): tools are passed IN
   as `opts.tools`, not fetched here. Transport no longer imports the tool
   registry and has no opinion about which tools exist — which is what let
   exposure become permission-scoped, since only the caller knows who is
   asking.

   The helper names still say "Groq" — the provider changed in 2026-07 and the
   names did not. Renaming them is churn that would obscure this diff; Phase 3
   replaces the functions outright.
   --------------------------------------------------------------------------- */

/* Agent LLM provider = DeepSeek ONLY (owner decision, 2026-07-20: Groq
   removed). DeepSeek's HTTP API is OpenAI-compatible — same chat/completions
   body, same `tools` + `tool_choice:"auto"` function-calling contract, same
   `choices[].message.tool_calls` response shape — so the whole tool loop below
   works against it unchanged. `DEEPSEEK_AGENT_MODEL`/`DEEPSEEK_MODEL` env can
   override the default. The internal helper names still say "Groq" for now;
   only the endpoint/model/key changed. */
const AGENT_LLM_URL = "https://api.deepseek.com/v1/chat/completions";
const AGENT_MODEL =
  process.env.DEEPSEEK_AGENT_MODEL ||
  process.env.DEEPSEEK_MODEL ||
  "deepseek-chat";

/* OpenAI-compatible message shapes — kept loose because the Groq API
   accepts the whole family (system/user/assistant/tool). */
export interface WireMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}


/* OpenAI-shaped tool_choice. "auto" lets the model decide, "none" strips
   the tools entirely, and the object form NAMES a function the model must
   call on that one request. We use the third form for exactly one case —
   see isChoiceShapedQuestion in core/decide-turn.ts. */
/** The OpenAI-compatible tool schema, as the caller hands it in. Transport
 *  does not know or care which tools exist — Phase 2F made that the caller's
 *  business, because only the caller knows WHO is asking. */
export interface ToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

export type ToolChoice = "auto" | "none" | { type: "function"; function: { name: string } };

/** Read the provider key. Returns undefined when unconfigured, which is what
 *  puts a turn on the degraded lane rather than throwing. */
export function readProviderKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY;
}

/** The `provider` string reported back on every AgentResponse. It was written
 *  out as a template literal at seven separate return sites; one function
 *  means a provider change cannot leave six of them stale. */
export function providerLabel(): string {
  return `deepseek:${AGENT_MODEL}`;
}

/** The bare model id, without the provider prefix. The adapter needs it to
 *  report its own model; providerLabel() is the composed string the loop puts
 *  on an AgentResponse. Two callers, one source. */
export function agentModel(): string {
  return AGENT_MODEL;
}

/* ─── Groq call with retry-after aware backoff ────────────────────────
   Groq's free tier is ~6k tokens / minute on Llama 3.3 70B. With the
   agent loop invoking the model several times per user turn (tool
   schemas alone cost 2-3k tokens each call), bursts can hit 429 even
   on normal use. When that happens Groq returns a `retry-after`
   header (seconds). We honour it up to 3 times before giving up so a
   brief rate-limit doesn't surface as a scary error. */
/** Same retry semantics as callGroqWithRetry but the model call does
 *  NOT include tools. Used for the small-talk fast-path so chit-chat
 *  doesn't burn the tool-schema token overhead on every turn. */
/* Retry budget: up to 3 extra attempts with exponential backoff,
   capped by Groq's `retry-after` when provided. Total wait stays
   under ~10s so the UI doesn't feel frozen, but it's enough for a
   typical Groq free-tier rate-limit window to clear. */
const MAX_RETRIES = 3;
const BACKOFF_CAP_MS = 8000;

/* Transient NETWORK failures (socket terminated mid-request, connection
   reset) reject the fetch promise instead of returning a status — they used
   to escape every handler here and surface as a raw HTTP 500 to the user
   (caught live twice in one 12-question probe). Convert them into a
   synthetic 502 Response so the same failed-status paths (retry → rescue →
   friendly copy) absorb them. */
/* ── The request body, in ONE place ─────────────────────────────────────
   Phase 3A. The three call sites below built this inline, which meant the
   only way to check "does the new provider layer send exactly what we send
   today?" was to read three fetch calls and believe the reading. It is a
   function now, so the two can be DIFFED — validate:ai-turn-ir runs both over
   a matrix of turns and compares the JSON.

   Behaviour is unchanged and deliberately so, down to two details that look
   like oversights and are not:
     · `tools` is OMITTED entirely when tool_choice is "none", not sent empty.
     · `stream` is present only on the streaming call, never `stream:false`.
   Both reproduce what has been going over the wire; the golden test pins them. */
export function buildChatBody(args: {
  messages: WireMsg[];
  maxTokens: number;
  toolChoice?: ToolChoice;
  tools?: ToolSchema[];
  stream?: boolean;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: AGENT_MODEL,
    messages: args.messages,
    temperature: 0.3,
    max_tokens: args.maxTokens,
  };
  if (args.stream) body.stream = true;
  if (args.toolChoice !== undefined && args.toolChoice !== "none") {
    body.tools = args.tools ?? [];
    body.tool_choice = args.toolChoice;
  }
  return body;
}

export function isTransientNetError(e: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = e;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const any = cur as { code?: string; message?: string; cause?: unknown };
    if (
      any.code === "UND_ERR_SOCKET" ||
      any.code === "ECONNRESET" ||
      any.code === "EPIPE" ||
      /terminated|socket|network|fetch failed/i.test(any.message ?? "")
    ) {
      return true;
    }
    cur = any.cause;
  }
  return false;
}

const SYNTH_NET_FAIL = () =>
  new Response("upstream socket error (network)", { status: 502 });

function backoffWaitMs(res: Response, attempt: number): number {
  const ra = Number(res.headers.get("retry-after"));
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, BACKOFF_CAP_MS);
  // 1s, 2s, 4s, …
  return Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS);
}

export async function callGroqPlain(
  key: string,
  messages: WireMsg[],
  opts: { maxTokens?: number } = {},
  attempt = 0,
): Promise<Response> {
  /* Fast-path parameters. Caller passes maxTokens based on the
     expected answer length — small-talk needs ~160; brand answers
     are structured multi-paragraph responses that need ~1200 to
     complete without truncation. The agent loop uses its own
     callGroqWithRetry with 2048 tokens. */
  const maxTokens = opts.maxTokens ?? 160;
  let res: Response;
  try {
    res = await fetch(AGENT_LLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(buildChatBody({ messages, maxTokens })),
    });
  } catch (e) {
    if (isTransientNetError(e) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS)));
      return callGroqPlain(key, messages, opts, attempt + 1);
    }
    if (isTransientNetError(e)) return SYNTH_NET_FAIL();
    throw e;
  }
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return callGroqPlain(key, messages, opts, attempt + 1);
  }
  return res;
}

/** One STREAMING chat-completions call. Content tokens are forwarded to
 *  onDelta live (until a tool_call appears — tool rounds stay silent);
 *  streamed tool_call fragments are re-assembled by index so the normal
 *  dispatch loop can run unchanged. */
export async function callGroqStreamingOnce(
  key: string,
  messages: WireMsg[],
  opts: { toolChoice: ToolChoice; onDelta: (t: string) => void; tools: ToolSchema[] },
): Promise<{
  ok: boolean;
  status: number;
  bodyText: string;
  content: string;
  toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
}> {
  const body = buildChatBody({
    messages,
    maxTokens: 2048,
    stream: true,
    toolChoice: opts.toolChoice,
    tools: opts.tools,
  });
  let res: Response;
  try {
    res = await fetch(AGENT_LLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    /* Socket died before any byte arrived — nothing was emitted, so the
       caller's failed-status path can retry/rescue safely. */
    if (isTransientNetError(e)) {
      return { ok: false, status: 502, bodyText: "upstream socket error (network)", content: "", toolCalls: [] };
    }
    throw e;
  }
  if (!res.ok || !res.body) {
    return {
      ok: false,
      status: res.status,
      bodyText: await res.text().catch(() => ""),
      content: "",
      toolCalls: [],
    };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  let sawTool = false;
  const calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  while (true) {
    let step: { value?: Uint8Array; done: boolean };
    try {
      step = await reader.read();
    } catch (e) {
      /* Stream terminated mid-read. NO retry here — deltas may already be
         on the user's screen and a re-run would duplicate them. Surface as
         a failed status so rescue-first / friendly copy takes over. */
      if (isTransientNetError(e)) {
        return { ok: false, status: 502, bodyText: "stream terminated mid-read", content, toolCalls: [] };
      }
      throw e;
    }
    const { value, done } = step;
    if (done) break;
    if (value) buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
        };
        const d = j.choices?.[0]?.delta;
        if (!d) continue;
        if (d.tool_calls) {
          sawTool = true;
          for (const tc of d.tool_calls) {
            const i = tc.index ?? 0;
            while (calls.length <= i) {
              calls.push({ id: "", type: "function", function: { name: "", arguments: "" } });
            }
            if (tc.id) calls[i].id = tc.id;
            if (tc.function?.name) calls[i].function.name += tc.function.name;
            if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
          }
        }
        if (typeof d.content === "string" && d.content) {
          content += d.content;
          if (!sawTool) opts.onDelta(d.content);
        }
      } catch {
        /* partial frame across chunks — next iteration completes it */
      }
    }
  }
  return { ok: true, status: 200, bodyText: "", content, toolCalls: calls.filter((c) => c.function.name) };
}

export async function callGroqWithRetry(
  key: string,
  messages: WireMsg[],
  opts: { toolChoice?: ToolChoice; tools?: ToolSchema[] } = {},
  attempt = 0,
): Promise<Response> {
  const toolChoice = opts.toolChoice ?? "auto";
  const body = buildChatBody({
    messages,
    maxTokens: 2048,
    toolChoice,
    tools: opts.tools,
  });
  let res: Response;
  try {
    res = await fetch(AGENT_LLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isTransientNetError(e) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS)));
      return callGroqWithRetry(key, messages, opts, attempt + 1);
    }
    if (isTransientNetError(e)) return SYNTH_NET_FAIL();
    throw e;
  }
  /* Retry budget: up to MAX_RETRIES with exponential backoff, capped
     by Groq's `retry-after` and BACKOFF_CAP_MS. Gives a brief Groq
     free-tier rate-limit window time to clear before we surface the
     friendly "handling a lot of requests" message. */
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return callGroqWithRetry(key, messages, opts, attempt + 1);
  }
  return res;
}

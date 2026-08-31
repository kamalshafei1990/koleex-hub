import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/transport — HTTP to a chat-completions endpoint. Nothing else.

   Phase 4A. Before this, "transport" meant three things at once: it built the
   request body, it knew the vendor's URL/model/key, AND it did the HTTP. That
   bundle is why a second provider was still not addable after Phase 3 — the
   adapter could be swapped, but everything it delegated to was DeepSeek's.

   What is left here is the part that is genuinely the same for every
   OpenAI-compatible provider:

     · POST a JSON body, with retry-after-aware backoff on 429/503
     · turn a transient socket failure into a status instead of an exception
     · read one SSE stream and re-assemble fragmented `tool_calls` by index

   What LEFT here, and where it went:

     · the request body  → provider/turn-ir.ts `toOpenAiBody()`, which was
       already proved byte-identical to the old builder and until 4A was DEAD
       CODE: the IR produced the right body and nothing sent it. It sends it
       now, so there is one body builder instead of two.
     · endpoint, model id, API key → provider/adapters/deepseek.ts, which is
       where vendor identity belongs. `core/` now contains no vendor string at
       all, which is what Phase 3's acceptance criterion actually asked for.
     · WireMsg / ToolSchema / ToolChoice → they were structural duplicates of
       turn-ir's OpenAiMessage / OpenAiTool / OpenAiToolChoice, which is why the
       adapter was full of `as unknown as` casts. One definition now.

   The key is passed in as an argument. It is never logged, never put in an
   error message, never interpolated into anything the model or the client can
   see. That property is asserted by validate:ai-core-boundaries.

   The helper names no longer say "Groq". They said it for a year after the
   provider changed; 4A had to touch every signature anyway, so the rename
   costs nothing here and stops the next reader chasing a vendor that left.
   --------------------------------------------------------------------------- */

/* Retry budget: up to 3 extra attempts with exponential backoff, capped by the
   provider's `retry-after` when it sends one. Total wait stays under ~10s so
   the UI does not feel frozen, but it is enough for a typical rate-limit
   window to clear before we surface the friendly "handling a lot of requests"
   copy. */
const MAX_RETRIES = 3;
const BACKOFF_CAP_MS = 8000;

/* Transient NETWORK failures (socket terminated mid-request, connection reset)
   reject the fetch promise instead of returning a status — they used to escape
   every handler here and surface as a raw HTTP 500 to the user (caught live
   twice in one 12-question probe). Convert them into a synthetic 502 Response
   so the same failed-status paths (retry → rescue → friendly copy) absorb them. */
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

/* ── Timeouts (Phase 4, closing a gap that predates it) ────────────────────
   NEITHER of the calls below carried a deadline. `fetch` has none by default,
   so a provider that ACCEPTS the connection and then never answers held a real
   user turn open until the platform killed the function — and the AI routes
   set no maxDuration, so that ceiling is the platform default, not a number
   anyone here chose. The user waits, watching nothing, for a provider that is
   never going to reply. Worse, a hang is the one failure mode failover exists
   for and the one it could not see: no status ever came back, so the next
   provider was never tried.

   A TIMEOUT IS A STATUS, NOT AN EXCEPTION — 504, which is already in the
   failover table and already counts as a provider fault, so a hung provider
   now fails over to a healthy one with no change to the registry at all.

   THE VALUES ARE DELIBERATELY GENEROUS, because the failure this prevents is
   rare and the failure a tight timeout CAUSES is not: cutting off a slow but
   working turn would be a self-inflicted outage. These are ceilings for
   pathology, not latency targets.

     · Non-streaming gets ONE overall bound. Many providers buffer a
       non-streamed completion and send no headers until generation is done,
       so "time to headers" and "time to answer" are the same thing here and
       cannot be separated. Two minutes is far beyond any real completion.

     · Streaming gets TWO, because one would be wrong. A long answer that
       keeps producing tokens is HEALTHY and must never be cut off, so there
       is no overall bound. What is bounded is silence: time to the response
       headers, and then the gap BETWEEN chunks. A stream still delivering
       tokens can run as long as it likes.

   Both are env-tunable, read per call so an operator can widen them without
   waiting on a code change, and clamped: a mistyped 0 must not turn every
   turn into an instant failure. */
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_STALL_MS = 45_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;

function timeoutMs(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(n)));
}

/** Whether this rejection is our own deadline firing rather than the network
 *  failing. It must be asked BEFORE isTransientNetError, which does not match
 *  an abort's message and would let it escape as a raw exception. */
export function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

const SYNTH_TIMEOUT = (ms: number) =>
  new Response(`upstream timed out after ${ms}ms`, { status: 504 });

function backoffWaitMs(res: Response, attempt: number): number {
  const ra = Number(res.headers.get("retry-after"));
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, BACKOFF_CAP_MS);
  // 1s, 2s, 4s, …
  return Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS);
}

function authHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/** One non-streaming chat-completions POST, with retry.
 *
 *  This is one function where there used to be two (`callGroqPlain` for the
 *  tool-less fast path and `callGroqWithRetry` for the agent loop). They were
 *  never actually different: identical retry rules, identical error handling,
 *  and the ONLY thing that varied was the body each one built. Once the body
 *  is built by the caller they collapse, and the fast path and the tool path
 *  provably share one retry policy rather than two copies of it. */
export async function postChat(
  url: string,
  key: string,
  body: unknown,
  attempt = 0,
): Promise<Response> {
  const budget = timeoutMs(process.env.AI_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(budget),
    });
  } catch (e) {
    /* A TIMEOUT IS NOT RETRIED, and that is the whole point of separating it
       from a transient socket error. A socket that died is worth one more
       attempt; a provider that went silent for two minutes has told us it is
       not answering, and three more attempts would spend six more minutes to
       learn the same thing while the user waits. 504 sends the turn to the
       next provider instead — which is the answer a hang always needed. */
    if (isAbortError(e)) return SYNTH_TIMEOUT(budget);
    if (isTransientNetError(e) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, BACKOFF_CAP_MS)));
      return postChat(url, key, body, attempt + 1);
    }
    if (isTransientNetError(e)) return SYNTH_NET_FAIL();
    throw e;
  }
  if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, backoffWaitMs(res, attempt)));
    return postChat(url, key, body, attempt + 1);
  }
  return res;
}

/** What one streaming call yields once the SSE frames are re-assembled. */
export interface StreamOutcome {
  ok: boolean;
  status: number;
  bodyText: string;
  content: string;
  toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  /** Token counts, when the provider volunteered them.
   *
   *  Phase 5B. Read OPPORTUNISTICALLY: OpenAI-compatible providers usually
   *  put a `usage` object on one of the last SSE frames, but not all of them
   *  do, and several require `stream_options:{include_usage:true}` to be asked
   *  for. That option is NOT sent — a provider that does not recognise it can
   *  reject the whole request with a 400, which would trade "we cannot measure
   *  cost" for "the turn fails". Measuring must never break the thing being
   *  measured.
   *
   *  So this is null on providers that stay quiet, and the meter records
   *  tokens as unknown rather than guessing them. Said plainly because a
   *  fabricated token count is worse than a missing one: someone budgets on it. */
  usage: { inputTokens: number | null; outputTokens: number | null } | null;
}

/** One STREAMING chat-completions call. Content tokens are forwarded to
 *  onDelta live (until a tool_call appears — tool rounds stay silent);
 *  streamed tool_call fragments are re-assembled by index so the normal
 *  dispatch loop can run unchanged. That reassembly is pinned by an incident
 *  assertion in validate:ai-baseline; it is the reason this function exists
 *  rather than the caller reading the stream itself. */
export async function postChatStreaming(
  url: string,
  key: string,
  body: unknown,
  onDelta: (t: string) => void,
): Promise<StreamOutcome> {
  /* ONE controller for the whole call, with the deadline MOVED rather than
     multiplied. It starts as a bound on reaching the response headers; once
     they arrive that timer is cleared and replaced by a stall timer that is
     re-armed after every chunk. So the abort always means "this provider has
     gone silent", never "this answer is taking a while". */
  const headerBudget = timeoutMs(process.env.AI_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const stallBudget = timeoutMs(process.env.AI_HTTP_STALL_MS, DEFAULT_STALL_MS);
  const ctrl = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | null = setTimeout(() => ctrl.abort(), headerBudget);
  const clearDeadline = () => {
    if (deadline) clearTimeout(deadline);
    deadline = null;
  };
  /* Re-armed after every successful read. The gap between chunks is what is
     bounded, so a stream that keeps producing tokens runs as long as it likes
     — cutting off a long but healthy answer would be a worse bug than the one
     this fixes. */
  const armStall = () => {
    clearDeadline();
    deadline = setTimeout(() => ctrl.abort(), stallBudget);
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearDeadline();
    if (isAbortError(e)) {
      return { ok: false, status: 504, bodyText: `upstream timed out after ${headerBudget}ms`, content: "", toolCalls: [], usage: null };
    }
    /* Socket died before any byte arrived — nothing was emitted, so the
       caller's failed-status path can retry/rescue safely. */
    if (isTransientNetError(e)) {
      return { ok: false, status: 502, bodyText: "upstream socket error (network)", content: "", toolCalls: [], usage: null };
    }
    throw e;
  }
  if (!res.ok || !res.body) {
    clearDeadline();
    return {
      ok: false,
      status: res.status,
      bodyText: await res.text().catch(() => ""),
      content: "",
      toolCalls: [],
      usage: null,
    };
  }
  /* Headers arrived, so the connect bound has done its job. From here the
     only thing bounded is silence between chunks. */
  armStall();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  let sawTool = false;
  let usage: { inputTokens: number | null; outputTokens: number | null } | null = null;
  const calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  while (true) {
    let step: { value?: Uint8Array; done: boolean };
    try {
      step = await reader.read();
    } catch (e) {
      clearDeadline();
      /* The stall deadline fired: the provider opened the stream and stopped
         sending. Whatever tokens DID arrive are returned rather than thrown
         away — the user can already see them on screen, and a status carrying
         no content would make the caller's rescue path replace a partial
         answer with an error where a truncated answer is the better outcome. */
      if (isAbortError(e)) {
        return { ok: false, status: 504, bodyText: `upstream stalled for ${stallBudget}ms`, content, toolCalls: [], usage: null };
      }
      /* Stream terminated mid-read. NO retry here — deltas may already be
         on the user's screen and a re-run would duplicate them. Surface as
         a failed status so rescue-first / friendly copy takes over. */
      if (isTransientNetError(e)) {
        return { ok: false, status: 502, bodyText: "stream terminated mid-read", content, toolCalls: [], usage: null };
      }
      throw e;
    }
    const { value, done } = step;
    if (done) {
      /* Leaving a live timer behind would abort a controller nobody is
         reading any more, and on a serverless runtime a pending timer can
         hold the invocation open past the response. */
      clearDeadline();
      break;
    }
    armStall();
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
          usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
        };
        /* Usage arrives on its own frame, typically the last one before
           [DONE], and that frame usually has an EMPTY choices array — so this
           must be read BEFORE the `if (!d) continue` below, or it is skipped
           on exactly the frame that carries it. */
        if (j.usage && (typeof j.usage.prompt_tokens === "number" || typeof j.usage.completion_tokens === "number")) {
          usage = {
            inputTokens: typeof j.usage.prompt_tokens === "number" ? j.usage.prompt_tokens : null,
            outputTokens: typeof j.usage.completion_tokens === "number" ? j.usage.completion_tokens : null,
          };
        }
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
          if (!sawTool) onDelta(d.content);
        }
      } catch {
        /* partial frame across chunks — next iteration completes it */
      }
    }
  }
  return { ok: true, status: 200, bodyText: "", content, toolCalls: calls.filter((c) => c.function.name), usage };
}

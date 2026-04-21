import "server-only";

/* ---------------------------------------------------------------------------
   ai/providers/groq — Groq chat + translate adapter.

   STEP 2: this is a VERBATIM extraction of the groq* functions that
   currently live in src/lib/server/ai-provider.ts. Same URL, same
   model env var, same temperature / max_tokens, same <think> strip,
   same error-body extraction, same console.error keys, same null-on-
   failure return contract. Nothing is refactored, nothing is
   optimised, nothing is connected to the new router yet.

   ai-provider.ts still holds its own copy of this logic and continues
   to serve every existing caller (translate endpoint, chat endpoint).
   Step 4/5 switch ai-provider.ts over to delegate here; until then
   this file is dark code — imported by nothing, guaranteeing zero
   behavioural change on prod.

   The only intentional difference: `lastProviderError` state is
   private to this module (with getLastGroqError() for later callers)
   instead of sharing the ai-provider.ts module-level variable. That's
   a pure isolation choice — the caller-visible behaviour of
   groqChat() and groqTranslate() is unchanged.
   --------------------------------------------------------------------------- */

import type {
  ChatMessage,
  ChatResult,
  TranslateInput,
  TranslateResult,
} from "../../ai-provider";

/* Chat uses the fast 8B Instant model for sub-2s latency; translate
   keeps the 70B model for accuracy. Both env-overridable. */
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_CHAT_MODEL =
  process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";

/** Last detailed error from a Groq call. Scoped to this module so the
 *  extraction stays isolated from ai-provider.ts's state. Callers that
 *  care read it via getLastGroqError(); nobody does today (dark code). */
let lastGroqError: string | null = null;
export function getLastGroqError(): string | null {
  return lastGroqError;
}

/** Pull the human-readable `.error.message` out of a Groq error body
 *  — falls back to the first 200 chars if the JSON shape is different
 *  from what we expected. Copied verbatim from ai-provider.ts. */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch { /* non-JSON */ }
  return body.slice(0, 200);
}

/** Strip DeepSeek / reasoning-model `<think>…</think>` blocks so the chat
 *  UI never shows raw chain-of-thought. Safe to call on any reply since
 *  models without thinking tags pass through untouched. Copied verbatim. */
function stripThinking(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
}

export async function groqChat(messages: ChatMessage[]): Promise<ChatResult | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 120,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[ai.groq.chat]", res.status, bodyText);
    lastGroqError = `Groq ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const reply = stripThinking(raw);
  if (!reply) return null;
  lastGroqError = null;
  return { reply, provider: `groq:${GROQ_CHAT_MODEL}` };
}

export async function groqTranslate(input: TranslateInput): Promise<TranslateResult | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const langNames: Record<string, string> = { en: "English", zh: "Chinese (Simplified)", ar: "Arabic" };
  const targetName = langNames[input.targetLang] ?? input.targetLang;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You are a professional translator for a business ERP system. Translate the user message to ${targetName}. Return ONLY the translated text — no explanations, no quotes, no commentary. Preserve product codes, numbers, proper nouns, and punctuation exactly.`,
    },
    { role: "user", content: input.text },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[ai.groq.translate]", res.status, bodyText);
    lastGroqError = `Groq ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const translated = stripThinking(json.choices?.[0]?.message?.content ?? "");
  if (!translated) return null;
  lastGroqError = null;
  return { translated, provider: `groq:${GROQ_MODEL}` };
}

/** The resolved CHAT model id — exposed so later callers (router,
 *  voice) can report it in logs / provider badges without re-reading
 *  the env var. Not used today. */
export const GROQ_MODEL_ID = GROQ_CHAT_MODEL;

/* ─── Streaming chat (Phase 2) ──────────────────────────────────
   OpenAI-compatible SSE. Groq's completions endpoint supports
   stream:true — we parse `data: ...` frames line-by-line and yield
   each delta. On completion we emit one final "done" chunk with the
   full concatenated reply so callers can post-process (pricing
   guard, persistence) in one place.

   Failure modes mirror the non-streaming path: network/HTTP error
   before the stream opens → yields {type:"error"} and returns.
   A mid-stream abort returns whatever was collected so far (caller
   decides whether to discard or accept a partial). */
export interface StreamChunk {
  type: "delta" | "done" | "error";
  text?: string;
  provider?: string;
  error?: string;
}

export async function* groqChatStream(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<StreamChunk> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    yield { type: "error", error: "GROQ_API_KEY not configured" };
    return;
  }

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 512,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lastGroqError = `Groq network error: ${msg}`;
    yield { type: "error", error: msg };
    return;
  }

  if (!res.ok || !res.body) {
    const bodyText = await res.text().catch(() => "");
    console.error("[ai.groq.stream]", res.status, bodyText);
    lastGroqError = `Groq ${res.status}: ${extractErrorMessage(bodyText)}`;
    yield { type: "error", error: lastGroqError };
    return;
  }

  /* OpenAI-compatible SSE: each event is `data: <json>\n\n`, final
     event is `data: [DONE]\n\n`. Buffer across reads to handle
     chunk boundaries that split a single event. */
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const ev of events) {
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            full += delta;
            yield { type: "delta", text: delta };
          }
        } catch {
          /* Malformed JSON in one frame — skip it, keep streaming. */
        }
      }
    }
  }

  const cleaned = stripThinking(full);
  lastGroqError = null;
  yield {
    type: "done",
    text: cleaned,
    provider: `groq:${GROQ_CHAT_MODEL}`,
  };
}

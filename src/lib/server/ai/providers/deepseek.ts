import "server-only";

/* ---------------------------------------------------------------------------
   ai/providers/deepseek — DeepSeek chat adapter.

   STEP 3: new provider, fully isolated. Not imported by anything; the
   router still returns its Step 1 stub. Steps 4/5 wire this module
   into the router + /api/ai/chat.

   DeepSeek's HTTP API is OpenAI-compatible (same request body, same
   response shape). That lets the adapter mirror providers/groq.ts
   exactly — same signature, same result shape, same null-on-failure
   contract — so swapping providers upstream is a trivial branch.

   Kill-switch: USE_DEEPSEEK=true is REQUIRED in addition to
   DEEPSEEK_API_KEY. When either is missing, deepseekChat() returns
   null with a descriptive lastDeepseekError set; the caller surfaces
   a clean error per the strict-fallback rule (no silent Groq
   replacement for business tasks).

   Response parsing is explicit (choices[0].message.content). No
   undocumented DeepSeek fields are relied on — if the shape ever
   shifts we fail closed (null → error), never improvise.
   --------------------------------------------------------------------------- */

import type { ChatMessage, ChatResult } from "../../ai-provider";

/** Default DeepSeek model. deepseek-chat is the production V3 chat
 *  model — NOT the reasoner (which streams `<think>…</think>` blocks).
 *  Override with DEEPSEEK_MODEL env if a different variant is wanted. */
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/** Endpoint pinned here so the router never has to know the URL. */
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

/** Last detailed error from a DeepSeek call. Scoped to this module —
 *  same isolation pattern as providers/groq.ts. */
let lastDeepseekError: string | null = null;
export function getLastDeepseekError(): string | null {
  return lastDeepseekError;
}

/** Whether DeepSeek is usable right now: both the kill-switch flag
 *  and the API key must be set. Exported so the router can make a
 *  fast client-side check without calling the provider and having
 *  it return null. */
export function isDeepseekEnabled(): boolean {
  return (
    process.env.USE_DEEPSEEK === "true" && !!process.env.DEEPSEEK_API_KEY
  );
}

/** Pull the human-readable `.error.message` out of an error body —
 *  same shape as Groq / OpenAI. Falls back to the first 200 chars
 *  when the response isn't JSON or lacks the expected field. Copied
 *  from providers/groq.ts to keep the isolation strict (no
 *  cross-provider shared helper yet). */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch { /* non-JSON */ }
  return body.slice(0, 200);
}

/** Strip `<think>…</think>` blocks defensively. deepseek-chat doesn't
 *  emit them (that's deepseek-reasoner's behaviour), but stripping is
 *  a no-op on clean output and costs ~nothing. Keeps parity with
 *  providers/groq.ts. */
function stripThinking(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Call DeepSeek with an OpenAI-compatible messages array. Returns
 * `null` on any failure mode — caller treats that as "provider is
 * unavailable" and surfaces a clear error (per the strict no-silent-
 * fallback rule).
 *
 * Failure modes, each sets `lastDeepseekError` to a readable string
 * and returns null:
 *   · USE_DEEPSEEK flag not set     → "DeepSeek disabled"
 *   · DEEPSEEK_API_KEY missing      → "DEEPSEEK_API_KEY not configured"
 *   · non-2xx response              → "DeepSeek ${status}: ${msg}"
 *   · empty reply body              → "DeepSeek returned an empty reply"
 *   · fetch throw / network error   → "DeepSeek network error: ${msg}"
 */
export async function deepseekChat(
  messages: ChatMessage[],
): Promise<ChatResult | null> {
  if (process.env.USE_DEEPSEEK !== "true") {
    lastDeepseekError = "DeepSeek disabled (USE_DEEPSEEK flag not set to 'true')";
    return null;
  }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    lastDeepseekError = "DEEPSEEK_API_KEY is not configured";
    return null;
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        /* Business reasoning — lower temp than the Groq chat default
           (0.6) so deterministic outputs are preferred over creative
           flourishes. Tweakable later via env if needed. */
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[ai.deepseek.chat]", res.status, bodyText);
      lastDeepseekError = `DeepSeek ${res.status}: ${extractErrorMessage(bodyText)}`;
      return null;
    }

    /* Parse explicitly. We rely only on the documented OpenAI-
       compatible fields (choices[0].message.content). Any deviation
       fails closed rather than guessing at alternative shapes. */
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const reply = stripThinking(raw);
    if (!reply) {
      lastDeepseekError = "DeepSeek returned an empty reply";
      return null;
    }
    lastDeepseekError = null;
    return { reply, provider: `deepseek:${DEEPSEEK_MODEL}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai.deepseek.chat] network", msg);
    lastDeepseekError = `DeepSeek network error: ${msg}`;
    return null;
  }
}

/** Resolved model id — exposed for telemetry / logs, matching
 *  GROQ_MODEL_ID in providers/groq.ts. */
export const DEEPSEEK_MODEL_ID = DEEPSEEK_MODEL;

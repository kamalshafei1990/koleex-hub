import "server-only";

/* ---------------------------------------------------------------------------
   ai-provider — thin adapter layer so the rest of Koleex never knows which
   model is behind it. Adding Claude / OpenAI later is a matter of
   implementing the same two functions; the apps that call translate() /
   chat() don't change at all.

   Picks the provider at runtime based on env vars so the same code path
   works whether the tenant has configured free Gemini, Anthropic,
   OpenAI, or nothing at all. If nothing is configured, every call
   returns `null` and the client-side code falls back to the original
   text — never throws.
   --------------------------------------------------------------------------- */

export interface TranslateInput {
  text: string;
  sourceLang?: string;     // omit to let the model auto-detect
  targetLang: "en" | "zh" | "ar";
}

export interface TranslateResult {
  translated: string;
  provider: string;
  detectedSource?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResult {
  reply: string;
  provider: string;
}

/** Last detailed error from a provider call — surfaces through the
 *  /api/ai/chat response so the UI can show "quota exceeded" etc.
 *  instead of a generic "unreachable". Module-level lets us avoid
 *  threading it through every call signature. */
let lastProviderError: string | null = null;
export function getLastAiError(): string | null {
  return lastProviderError;
}

/* Provider priority:
   1. Groq (free tier, no billing, works regardless of region — current primary)
   2. Gemini (kept so we can switch back if billing gets enabled)
   3. Claude / OpenAI (reserved slots for later)
   Callers don't know or care which one is behind aiChat() / aiTranslate(). */
function pickProvider(): "groq" | "gemini" | "claude" | "openai" | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/* Translate uses the bigger 70B model for accuracy; chat swapped to
   the fast 8B Instant model for sub-2s latency. Both env-overridable. */
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_CHAT_MODEL =
  process.env.GROQ_CHAT_MODEL || "llama-3.1-8b-instant";

/* ── Gemini Flash (free tier) ────────────────────────────── */

async function geminiTranslate(input: TranslateInput): Promise<TranslateResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const langNames: Record<string, string> = { en: "English", zh: "Chinese (Simplified)", ar: "Arabic" };
  const targetName = langNames[input.targetLang] ?? input.targetLang;

  const prompt = `You are a professional translator for a business ERP system. Translate the following text to ${targetName}. Return ONLY the translated text, no explanations, no quotes, no commentary. Preserve product codes, numbers, proper nouns, and punctuation exactly.

Text to translate:
${input.text}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[ai.gemini.translate]", res.status, bodyText);
    lastProviderError = `Gemini ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const translated = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!translated) return null;
  lastProviderError = null;
  return { translated, provider: "gemini" };
}

/** Pull the human-readable `.error.message` out of a Gemini error body
 *  — falls back to the first 200 chars if the JSON shape is different
 *  from what we expected. */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch { /* non-JSON */ }
  return body.slice(0, 200);
}

export async function geminiChat(messages: ChatMessage[]): Promise<ChatResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  // Gemini has a separate "systemInstruction" field vs a "contents"
  // array of user/model turns — reshape from our normalised message
  // list into that structure.
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 2048,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[ai.gemini.chat]", res.status, bodyText);
    lastProviderError = `Gemini ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) return null;
  lastProviderError = null;
  return { reply, provider: "gemini" };
}

/* ── Public surface ───────────────────────────────────────── */

/* ── Groq (Llama 3.3 70B — free tier, OpenAI-compatible) ── */

/** Strip DeepSeek / reasoning-model `<think>…</think>` blocks so the chat
 *  UI never shows raw chain-of-thought. Safe to call on any reply since
 *  models without thinking tags pass through untouched. */
function stripThinking(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
}

async function groqChat(messages: ChatMessage[]): Promise<ChatResult | null> {
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
    lastProviderError = `Groq ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const reply = stripThinking(raw);
  if (!reply) return null;
  lastProviderError = null;
  return { reply, provider: `groq:${GROQ_CHAT_MODEL}` };
}

async function groqTranslate(input: TranslateInput): Promise<TranslateResult | null> {
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
    lastProviderError = `Groq ${res.status}: ${extractErrorMessage(bodyText)}`;
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const translated = stripThinking(json.choices?.[0]?.message?.content ?? "");
  if (!translated) return null;
  lastProviderError = null;
  return { translated, provider: `groq:${GROQ_MODEL}` };
}

/**
 * Translate a string to the target language. Returns null if no AI
 * provider is configured OR the call failed — callers should treat
 * that as "show the original".
 */
export async function aiTranslate(input: TranslateInput): Promise<TranslateResult | null> {
  const provider = pickProvider();
  if (!provider) return null;
  try {
    if (provider === "groq") return await groqTranslate(input);
    if (provider === "gemini") return await geminiTranslate(input);
    // Room for Claude / OpenAI to be added later without touching callers.
    return null;
  } catch (e) {
    console.error("[ai.translate]", e);
    return null;
  }
}

/**
 * Run a chat completion. Returns null on failure — the caller should
 * show a graceful "AI unavailable" message rather than a 500.
 */
export async function aiChat(messages: ChatMessage[]): Promise<ChatResult | null> {
  const provider = pickProvider();
  if (!provider) return null;
  try {
    if (provider === "groq") return await groqChat(messages);
    if (provider === "gemini") return await geminiChat(messages);
    return null;
  } catch (e) {
    console.error("[ai.chat]", e);
    return null;
  }
}

export function aiProviderConfigured(): boolean {
  return pickProvider() !== null;
}

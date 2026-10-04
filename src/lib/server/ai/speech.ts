import "server-only";

/* ---------------------------------------------------------------------------
   ai/speech — a recording in, its words and their language out (CEO Brand's
   quick capture, owner 30/09/2026: "I speak, Koleex AI writes the post").

   THE PROVIDER IS CONFIGURATION, NOT CODE (the standing rule), tried in this
   order, the first that answers winning:
     1. AI_STT_BASE_URL / AI_STT_API_KEY / AI_STT_MODEL — any OpenAI-
        compatible chat-completions endpoint that takes `input_audio` (https
        only);
     2. the speech model of the account Koleex AI's voice calls already use
        (AI_VOICE_*), when that account is the Qwen family on Alibaba Cloud —
        its non-realtime recogniser, qwen3-asr-flash, answers the same way
        (checked against its API reference on 30/09/2026);
     3. GEMINI_API_KEY, audio inline.
   Every failure — no key, a refusal, a timeout, an empty answer — is null,
   never a throw: the caller falls back to what the person typed.

   Nothing here names the model or the vendor to a caller: the words come
   back, and the language as a code. Logs carry the provider's label, timing
   and sizes only — never the words.
   --------------------------------------------------------------------------- */

export interface SpeechResult {
  text: string;
  /** ISO 639-1 when the provider says it (e.g. "ar", "en", "zh"), else null. */
  lang: string | null;
}

interface SttProvider { url: string; key: string; model: string; label: string }

const TIMEOUT_MS = 45_000;
const BYTES_MAX = 10 * 1024 * 1024;

/* An OpenAI-style base URL → its chat-completions URL; https only. */
function chatUrl(base: string): string | null {
  try {
    const u = new URL(base.trim());
    if (u.protocol !== "https:") return null;
    const path = u.pathname.replace(/\/+$/, "");
    u.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
    return u.toString();
  } catch {
    return null;
  }
}

export function configuredStt(env: NodeJS.ProcessEnv = process.env): SttProvider | null {
  const url = env.AI_STT_BASE_URL ? chatUrl(env.AI_STT_BASE_URL) : null;
  const key = (env.AI_STT_API_KEY ?? "").trim();
  const model = (env.AI_STT_MODEL ?? "").trim();
  return url && key && model ? { url, key, model, label: new URL(url).host } : null;
}

/** The voice calls' own account, when it is the Qwen family on Alibaba
 *  Cloud: the same host (its realtime URL made https) serves the
 *  OpenAI-compatible mode, with the same key. */
export function voiceAccountStt(env: NodeJS.ProcessEnv = process.env): SttProvider | null {
  const base = (env.AI_VOICE_BASE_URL ?? "").trim();
  const key = (env.AI_VOICE_API_KEY ?? "").trim();
  const model = (env.AI_VOICE_MODEL ?? "").trim().toLowerCase();
  if (!base || !key || !model.startsWith("qwen")) return null;
  let host: string;
  try {
    host = new URL(base.replace(/^wss?:\/\//i, "https://")).host;
  } catch {
    return null;
  }
  if (!/(^|\.)aliyuncs\.com$/i.test(host)) return null;
  return { url: `https://${host}/compatible-mode/v1/chat/completions`, key, model: "qwen3-asr-flash", label: host };
}

const langCode = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const m = /^([a-z]{2})\b/i.exec(v.trim());
  return m ? m[1].toLowerCase() : null;
};

async function askCompatible(p: SttProvider, bytes: Uint8Array, mime: string): Promise<SpeechResult | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` } }] }],
        stream: false,
        asr_options: { enable_itn: false },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[ai.speech] ${p.label} HTTP ${res.status} ms=${Date.now() - t0}`);
      return null;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown; annotations?: Array<{ language?: unknown }> } }> };
    const msg = json.choices?.[0]?.message;
    const content = msg?.content;
    const text = (typeof content === "string" ? content
      : Array.isArray(content) ? content.map((c: { text?: unknown }) => (typeof c?.text === "string" ? c.text : "")).join("") : "").trim();
    if (!text) return null;
    console.log(`[ai.speech] ok via=${p.label} ms=${Date.now() - t0} chars=${text.length}`);
    return { text, lang: langCode(msg?.annotations?.[0]?.language) };
  } catch (e) {
    console.error(`[ai.speech] ${p.label} failed ms=${Date.now() - t0}`, e instanceof Error ? e.name : "");
    return null;
  }
}

async function askGemini(key: string, bytes: Uint8Array, mime: string): Promise<SpeechResult | null> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      /* The key in a header, never the URL. */
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inline_data: { mime_type: mime, data: Buffer.from(bytes).toString("base64") } },
          { text: 'Transcribe this recording exactly, in the language spoken (Arabic stays Arabic, including dialect). Reply with JSON only: {"language":"<ISO 639-1 code>","text":"<the words>"}' },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[ai.speech] gemini HTTP ${res.status} ms=${Date.now() - t0}`);
      return null;
    }
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const reply = (json.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? "").join("");
    const s = reply.indexOf("{");
    const e = reply.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    const o = JSON.parse(reply.slice(s, e + 1)) as { language?: unknown; text?: unknown };
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) return null;
    console.log(`[ai.speech] ok via=gemini ms=${Date.now() - t0} chars=${text.length}`);
    return { text, lang: langCode(o.language) };
  } catch (e) {
    console.error(`[ai.speech] gemini failed ms=${Date.now() - t0}`, e instanceof Error ? e.name : "");
    return null;
  }
}

/** A recording's words, or null when no provider could read it. */
export async function transcribe(bytes: Uint8Array, mimeType: string): Promise<SpeechResult | null> {
  if (!bytes.length || bytes.length > BYTES_MAX) return null;
  const mime = (mimeType.split(";")[0] || "audio/webm").trim().toLowerCase();
  for (const p of [configuredStt(), voiceAccountStt()]) {
    if (!p) continue;
    const out = await askCompatible(p, bytes, mime);
    if (out) return out;
  }
  const gemini = (process.env.GEMINI_API_KEY ?? "").trim();
  return gemini ? askGemini(gemini, bytes, mime) : null;
}

/** Whether any speech provider is configured (the screen says so). */
export function speechConfigured(): boolean {
  return !!(configuredStt() || voiceAccountStt() || (process.env.GEMINI_API_KEY ?? "").trim());
}

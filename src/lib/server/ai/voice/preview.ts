import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/preview — a few spoken words in a voice, so a caller can hear it
   before choosing it.

   THE OWNER (2026-09-07): "when I press a voice it should say some sample
   words so I can listen to the voice before I select it". A voice picker
   that shows five names and five shapes still asks the caller to switch the
   live call to find out what each one sounds like — a rebuild of the
   session per guess. A sample is one short sentence, spoken by the vendor's
   text-to-speech in the SAME voice id the call would use, fetched by our
   server and handed to the browser as bytes.

   TWO LANES, TWO SYNTHESISERS, ONE SHAPE. Each lane's vendor offers plain
   text-to-speech beside its realtime model, with the same voice ids:
     · the socket lane's vendor answers a POST with the audio itself;
     · the mainland lane's vendor answers with JSON that names a URL the
       audio can be fetched from.
   Both are described here as a PLAN — url, headers, body, and how to read
   the answer — built by pure functions from configuration, so the suite can
   prove the plans without reaching either vendor (this environment cannot).
   Endpoints and models are environment variables with defaults, like every
   other vendor fact in this product; nothing here names a vendor to a
   caller.

   THE KEY GOES OUT IN THE PLAN'S HEADERS AND NOWHERE ELSE: never in a log,
   never in an error, never in the bytes returned. A URL the mainland vendor
   hands back is fetched only after the same address check every server-side
   fetch of an outside address goes through (lib/server/safe-url.ts).

   THE SENTENCE IS THE PRODUCT'S. It says who is speaking — Koleex AI — in
   the caller's UI language, and nothing about which vendor made the voice.
   --------------------------------------------------------------------------- */

import type { Lang } from "@/lib/i18n";
import type { VoiceEnv } from "./config";
import type { GrokVoiceEnv } from "./grok";

export type PreviewLane = "rtc" | "ws";

/** What a voice says when it is auditioned. One sentence, in the UI language,
 *  the product's name and no one else's. */
export const PREVIEW_SAMPLE: Record<Lang, string> = {
  en: "Hi, I'm Koleex AI. This is how I sound. Ask me anything about your work, and I'll help.",
  zh: "你好，我是 Koleex AI。这是我的声音。工作上有什么问题，随时问我。",
  ar: "أهلاً، أنا Koleex AI. ده صوتي. اسألني عن أي حاجة في شغلك وأنا أساعدك.",
};

export type TtsPlan = {
  url: string;
  headers: Record<string, string>;
  body: string;
  /** How the vendor answers: the audio bytes themselves, or a JSON envelope
   *  naming a URL the audio is fetched from. */
  answer: "binary" | "json-url";
  /** The type to serve when the vendor names none. */
  fallbackType: string;
};

/* ── The socket lane's synthesiser ─────────────────────────────────────── */

export const GROK_DEFAULT_TTS_URL = "https://api.x.ai/v1/tts";

export type GrokTtsEnv = GrokVoiceEnv & { AI_VOICE_GROK_TTS_URL?: string };

/** The vendor's `language` codes for the sample's language. */
const GROK_LANG: Record<Lang, string> = { en: "en", zh: "zh", ar: "ar" };

/** Pure. null when the lane is off or the url is not https. */
export function planGrokTts(env: GrokTtsEnv, vendorId: string, lang: Lang): TtsPlan | null {
  if ((env.AI_VOICE_GROK_LANE ?? "").trim().toLowerCase() === "off") return null;
  const key = env.AI_VOICE_GROK_API_KEY?.trim();
  if (!key || !vendorId) return null;
  const raw = (env.AI_VOICE_GROK_TTS_URL ?? "").trim() || GROK_DEFAULT_TTS_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return {
    url: url.toString(),
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg, audio/*", Authorization: `Bearer ${key}` },
    /* The speech endpoint's ids are lowercase (the vendor's console shows
       `voice_id: "eve"`); the realtime session's are capitalised. One
       catalogue, lowered here. */
    body: JSON.stringify({ text: PREVIEW_SAMPLE[lang], voice_id: vendorId.toLowerCase(), language: GROK_LANG[lang] }),
    answer: "binary",
    fallbackType: "audio/mpeg",
  };
}

/* ── The mainland lane's synthesiser ───────────────────────────────────── */

/** The vendor's plain text-to-speech path, on the same host as the realtime
 *  endpoint the lane already uses. Overridable, like everything else. */
export const MAINLAND_TTS_PATH = "/api/v1/services/aigc/multimodal-generation/generation";
export const MAINLAND_DEFAULT_TTS_MODEL = "qwen3-tts-flash";

export type MainlandTtsEnv = VoiceEnv & { AI_VOICE_TTS_URL?: string; AI_VOICE_TTS_MODEL?: string };

/** Pure. The synthesiser's url is AI_VOICE_TTS_URL when set, otherwise the
 *  realtime base's HOST with the vendor's synthesis path — the realtime base
 *  carries its own path and query, neither of which is the synthesiser's.
 *  null when the lane is off or no https url can be formed. */
export function planMainlandTts(env: MainlandTtsEnv, vendorId: string, lang: Lang): TtsPlan | null {
  const key = env.AI_VOICE_API_KEY?.trim();
  if (!key || !vendorId) return null;
  let url: URL;
  try {
    const explicit = (env.AI_VOICE_TTS_URL ?? "").trim();
    if (explicit) url = new URL(explicit);
    else {
      const base = (env.AI_VOICE_BASE_URL ?? "").trim();
      if (!base) return null;
      const b = new URL(base);
      url = new URL(MAINLAND_TTS_PATH, `https://${b.host}`);
    }
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const model = (env.AI_VOICE_TTS_MODEL ?? "").trim() || MAINLAND_DEFAULT_TTS_MODEL;
  void lang; /* The vendor detects the language from the text itself. */
  return {
    url: url.toString(),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: { text: PREVIEW_SAMPLE[lang], voice: vendorId } }),
    answer: "json-url",
    fallbackType: "audio/wav",
  };
}

/** Read the audio url out of the mainland vendor's envelope: `output.audio.url`,
 *  https only. Pure; null for anything else. */
export function extractAudioUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const output = (body as { output?: unknown }).output;
  if (!output || typeof output !== "object") return null;
  const audio = (output as { audio?: unknown }).audio;
  if (!audio || typeof audio !== "object") return null;
  const url = (audio as { url?: unknown }).url;
  if (typeof url !== "string") return null;
  const s = url.trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

/* ── Fetching the sample ───────────────────────────────────────────────── */

export const PREVIEW_TIMEOUT_MS = 10_000;
/** A sentence of speech is well under a megabyte; four is a ceiling, not a
 *  budget. */
export const PREVIEW_MAX_BYTES = 4_000_000;

export type PreviewAudio = { bytes: Uint8Array; type: string };

export type PreviewFetchDeps = {
  fetchFn?: typeof fetch;
  /** The address check for a URL the vendor hands back. Injected so the
   *  suite can run without DNS. */
  assertSafeUrl: (raw: string, schemes: readonly string[]) => Promise<URL>;
};

/** Run a plan to bytes. Never throws; null on any failure, with the stage
 *  and the status (never a body, never the key) in the log. */
export async function fetchPreviewAudio(plan: TtsPlan, deps: PreviewFetchDeps): Promise<PreviewAudio | null> {
  const fetchFn = deps.fetchFn ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PREVIEW_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetchFn(plan.url, { method: "POST", headers: plan.headers, body: plan.body, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      console.error(`[ai.voice.preview] synthesis refused status=${res.status} afterMs=${Date.now() - t0}`);
      return null;
    }
    if (plan.answer === "binary") {
      const bytes = await readCapped(res, PREVIEW_MAX_BYTES);
      if (!bytes || bytes.byteLength === 0) return null;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      return { bytes, type: type.startsWith("audio/") ? type : plan.fallbackType };
    }
    const audioUrl = extractAudioUrl(await res.json().catch(() => null));
    if (!audioUrl) {
      console.error(`[ai.voice.preview] synthesis envelope unreadable afterMs=${Date.now() - t0}`);
      return null;
    }
    const safe = await deps.assertSafeUrl(audioUrl, ["https:"]);
    const got = await fetchFn(safe.toString(), { signal: ctrl.signal, cache: "no-store" });
    if (!got.ok) {
      console.error(`[ai.voice.preview] audio fetch refused status=${got.status} afterMs=${Date.now() - t0}`);
      return null;
    }
    const bytes = await readCapped(got, PREVIEW_MAX_BYTES);
    if (!bytes || bytes.byteLength === 0) return null;
    const type = (got.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    return { bytes, type: type.startsWith("audio/") ? type : plan.fallbackType };
  } catch (e) {
    const name = e && typeof e === "object" ? String((e as { name?: unknown }).name ?? "") : "";
    const msg = e instanceof Error ? e.message : "";
    console.error(`[ai.voice.preview] ${name === "AbortError" ? "timed out" : msg === "blocked_host" ? "audio host refused" : "failed"} afterMs=${Date.now() - t0}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > max ? null : buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/grok — the second voice lane: a realtime vendor reached over a
   WebSocket from the browser, for callers OUTSIDE mainland China.

   WHY A SECOND LANE, AND WHY THIS SHAPE (owner, 2026-09-08): "I like Grok
   voice more than Qwen, but Grok can't work in China — so two: for China
   and out of China." The mainland lane (session/route.ts, WebRTC) stays
   exactly as it is; the standing rule that mainland core functionality
   never depends on a VPN is untouched because a mainland caller never
   meets this lane at all. The SERVER decides which lane a call takes, from
   the country Vercel stamps on the request — never the client, and never
   a guess about VPNs: a caller whose traffic arrives from outside China
   IS outside China for every purpose this lane cares about.

   WHY WEBSOCKET. This vendor's realtime API speaks the OpenAI-Realtime
   protocol over a WebSocket and offers no browser-side SDP exchange (its
   own WebRTC sample relays through a server). The browser therefore
   connects to the vendor directly with a SHORT-LIVED CLIENT SECRET this
   server mints from the real key — the vendor's designed browser flow.
   The real key never leaves this process; the secret expires in minutes
   and can open one session. The event protocol on the socket is the one
   the rest of the voice client already speaks (transcripts, tool calls,
   session.update), so everything above the transport is shared.

   THE VENDOR IS CONFIGURATION. Endpoint, secrets endpoint, model, voices,
   sample rate and the subprotocol shape are environment variables with
   defaults, because the vendor's voice product is labelled beta and any
   of them may move; none is in code. Nothing here names the vendor to a
   caller — the product is Koleex AI.
   --------------------------------------------------------------------------- */

import { parseVoiceOptions, type VoiceOption } from "./config";

export type GrokVoiceEnv = {
  AI_VOICE_GROK_API_KEY?: string;
  /** The realtime WebSocket. Default: the vendor's documented endpoint. */
  AI_VOICE_GROK_URL?: string;
  /** Where a client secret is minted. Default: the vendor's documented path. */
  AI_VOICE_GROK_SECRETS_URL?: string;
  /** Optional realtime model id, appended as a query parameter when set. */
  AI_VOICE_GROK_MODEL?: string;
  /** vendorId:Label pairs, same grammar as AI_VOICE_VOICES. */
  AI_VOICE_GROK_VOICES?: string;
  /** PCM16 sample rate both ways. */
  AI_VOICE_GROK_SAMPLE_RATE?: string;
  /** How the secret travels on the socket: a subprotocol template with
   *  `{token}`; a template without the placeholder is refused. */
  AI_VOICE_GROK_PROTOCOL?: string;
  /** "off" disables the lane without removing the key. */
  AI_VOICE_GROK_LANE?: string;
};

export const GROK_DEFAULT_URL = "wss://api.x.ai/v1/realtime";
export const GROK_DEFAULT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";
/* THE LANE'S OWN VOICES, UNDER THEIR OWN NAMES. The owner (2026-09-08):
   "when I use Grok voice I want the Grok voice choices, not Qwen". Five
   voices, the vendor's ids lowercase as its console shows them, labelled by
   the names the voices themselves carry — neutral first names, nothing
   that says which vendor. A voice key is positional (v1..v5) on either
   lane, so a saved key still resolves to a voice when the lane changes. */
export const GROK_DEFAULT_VOICES = "ara:Ara,eve:Eve,rex:Rex,leo:Leo,sal:Sal";
export const GROK_DEFAULT_SAMPLE_RATE = 24_000;
export const GROK_DEFAULT_PROTOCOL = "xai-client-secret.{token}";
/** Long enough to open the socket after a slow handshake; short enough
 *  that a secret found in a log is worth nothing by the time it is read. */
export const GROK_SECRET_TTL_SEC = 600;

export type GrokVoiceConfig = {
  url: string;
  secretsUrl: string;
  model: string | null;
  voices: VoiceOption[];
  sampleRate: number;
  protocolTemplate: string;
};

/** null means the lane is off — no key, a bad url, or an explicit off. The
 *  key is checked for presence only and never carried in the config. Pure. */
export function parseGrokVoiceConfig(env: GrokVoiceEnv): GrokVoiceConfig | null {
  if ((env.AI_VOICE_GROK_LANE ?? "").trim().toLowerCase() === "off") return null;
  if (!env.AI_VOICE_GROK_API_KEY?.trim()) return null;
  const url = (env.AI_VOICE_GROK_URL ?? "").trim() || GROK_DEFAULT_URL;
  const secretsUrl = (env.AI_VOICE_GROK_SECRETS_URL ?? "").trim() || GROK_DEFAULT_SECRETS_URL;
  let u: URL;
  let s: URL;
  try {
    u = new URL(url);
    s = new URL(secretsUrl);
  } catch {
    return null;
  }
  /* The secret travels on the socket and the key on the mint: both only
     over TLS. */
  if (u.protocol !== "wss:" || s.protocol !== "https:") return null;
  const protocolTemplate = (env.AI_VOICE_GROK_PROTOCOL ?? "").trim() || GROK_DEFAULT_PROTOCOL;
  if (!protocolTemplate.includes("{token}")) return null;
  const rate = Number(env.AI_VOICE_GROK_SAMPLE_RATE);
  const sampleRate = Number.isInteger(rate) && rate >= 8_000 && rate <= 48_000 ? rate : GROK_DEFAULT_SAMPLE_RATE;
  const catalogue = (env.AI_VOICE_GROK_VOICES ?? "").trim();
  return {
    url: u.toString(),
    secretsUrl: s.toString(),
    model: (env.AI_VOICE_GROK_MODEL ?? "").trim() || null,
    voices: parseVoiceOptions(catalogue || GROK_DEFAULT_VOICES),
    sampleRate,
    protocolTemplate,
  };
}

export function readGrokVoiceEnv(): GrokVoiceEnv {
  return {
    AI_VOICE_GROK_API_KEY: process.env.AI_VOICE_GROK_API_KEY,
    AI_VOICE_GROK_URL: process.env.AI_VOICE_GROK_URL,
    AI_VOICE_GROK_SECRETS_URL: process.env.AI_VOICE_GROK_SECRETS_URL,
    AI_VOICE_GROK_MODEL: process.env.AI_VOICE_GROK_MODEL,
    AI_VOICE_GROK_VOICES: process.env.AI_VOICE_GROK_VOICES,
    AI_VOICE_GROK_SAMPLE_RATE: process.env.AI_VOICE_GROK_SAMPLE_RATE,
    AI_VOICE_GROK_PROTOCOL: process.env.AI_VOICE_GROK_PROTOCOL,
    AI_VOICE_GROK_LANE: process.env.AI_VOICE_GROK_LANE,
  };
}

/** The socket url the browser opens: the endpoint, with the model as a
 *  query parameter when one is configured. Pure. */
export function grokSocketUrl(cfg: GrokVoiceConfig): string {
  if (!cfg.model) return cfg.url;
  const u = new URL(cfg.url);
  u.searchParams.set("model", cfg.model);
  return u.toString();
}

/** The subprotocol list the browser offers, the secret inside it. Pure. */
export function grokProtocols(cfg: GrokVoiceConfig, token: string): string[] {
  return [cfg.protocolTemplate.replace("{token}", token)];
}

/* ── Which lane ─────────────────────────────────────────────────────────── */

export type VoiceLane = "rtc" | "ws";

/** MAINLAND STAYS ON THE MAINLAND LANE. Everything else takes the WebSocket
 *  lane when it is configured. The country is what Vercel stamps on the
 *  request from the connecting address — a caller on a VPN arrives from
 *  wherever the VPN exits, and that is the right answer for them: it is
 *  the network their browser will actually reach the vendor over. No
 *  country (local dev, a proxy that strips it) reads as not-mainland only
 *  when there is no mainland lane to prefer. Pure. */
export function chooseVoiceLane(input: { country: string | null; rtc: boolean; ws: boolean }): VoiceLane | null {
  const { country, rtc, ws } = input;
  if (!rtc && !ws) return null;
  if (!ws) return "rtc";
  if (!rtc) return "ws";
  const cc = (country ?? "").trim().toUpperCase();
  if (cc === "CN" || cc === "") return "rtc";
  return "ws";
}

/* ── Minting a client secret ────────────────────────────────────────────── */

const MINT_TIMEOUT_MS = 8_000;

/** Read the secret out of whatever envelope the vendor uses: the value at
 *  the top, or under `client_secret` (as a string or an object). Pure. */
export function extractClientSecret(body: unknown): { value: string; expiresAt: number | null } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const nested = o.client_secret;
  let value = "";
  let expires: unknown = o.expires_at;
  if (typeof o.value === "string") value = o.value;
  else if (typeof nested === "string") value = nested;
  else if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.value === "string") value = n.value;
    if (n.expires_at !== undefined) expires = n.expires_at;
  }
  value = value.trim();
  if (!value) return null;
  const expiresAt = typeof expires === "number" && Number.isFinite(expires) ? expires : null;
  return { value, expiresAt };
}

/** Ask the vendor for a short-lived client secret. The real key goes out
 *  in this one request and nowhere else. Never throws; null on any failure,
 *  with the status (never the body) in the log. */
export async function mintClientSecret(
  cfg: GrokVoiceConfig,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ value: string; expiresAt: number | null } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MINT_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetchFn(cfg.secretsUrl, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ expires_after: { seconds: GROK_SECRET_TTL_SEC } }),
    });
    if (!res.ok) {
      console.error(`[ai.voice.ws] secret refused status=${res.status} afterMs=${Date.now() - t0}`);
      return null;
    }
    const secret = extractClientSecret(await res.json().catch(() => null));
    if (!secret) {
      console.error(`[ai.voice.ws] secret envelope unreadable afterMs=${Date.now() - t0}`);
      return null;
    }
    console.log(`[ai.voice.ws] secret ok afterMs=${Date.now() - t0}`);
    return secret;
  } catch (e) {
    const name = e && typeof e === "object" ? String((e as { name?: unknown }).name ?? "") : "";
    console.error(`[ai.voice.ws] secret ${name === "AbortError" ? "timed out" : "failed"} afterMs=${Date.now() - t0}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

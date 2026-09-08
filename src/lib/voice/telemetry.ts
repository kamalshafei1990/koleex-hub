/* ---------------------------------------------------------------------------
   voice/telemetry — one beacon when a call fails, so the server's log can say
   why. States and counts only; see /api/ai/voice/telemetry for the reader.
   Fire-and-forget: a failed beacon is a missing log line, never an error in
   a call that has already failed for its own reason.
   --------------------------------------------------------------------------- */

export const VOICE_TELEMETRY_PATH = "/api/ai/voice/telemetry";

export type VoiceTelemetryFields = {
  reason: string;
  resumes?: number;
  elapsed_ms?: number;
  ice?: string;
  dc?: string;
  last_event?: string;
  tool_calls?: number;
  region?: string;
  ice_ever_connected?: boolean;
  err?: string;
  /** Which lane the call was on, and whether this failure moved it. */
  lane?: string;
  fell_back?: boolean;
  events?: string;
  /** Socket lane: redials on this call, and the last close code. */
  ws_reconnects?: number;
  ws_close?: string;
  /** A queued beacon carries when it was made. */
  queued_at?: number;
};

export type VoiceTelemetry = VoiceTelemetryFields;

export function sendVoiceTelemetry(t: VoiceTelemetry, post: (path: string, body: string) => void = defaultPost): void {
  try {
    /* OFFLINE, THE BEACON WAITS (2026-09-08 02:40: the phone's network was
       down for five seconds, the call died in those seconds, and the beacon
       that would have said so died with it — the log had nothing). A beacon
       sent while the browser says it is offline is queued on the device and
       sent by flushVoiceTelemetry when the network is back or the page is
       next loaded. Bounded, oldest dropped. */
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      queueVoiceTelemetry(t);
      return;
    }
    post(VOICE_TELEMETRY_PATH, JSON.stringify(t));
  } catch {
    /* Never an error. */
  }
}

export const TELEMETRY_QUEUE_KEY = "koleex-voice-telemetry-queue";
export const TELEMETRY_QUEUE_MAX = 10;

type QueueStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function storage(): QueueStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function queueVoiceTelemetry(t: VoiceTelemetry, store: QueueStorage | null = storage()): void {
  if (!store) return;
  try {
    const raw = store.getItem(TELEMETRY_QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    const arr = Array.isArray(list) ? list : [];
    arr.push({ ...t, queued_at: Date.now() });
    store.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(arr.slice(-TELEMETRY_QUEUE_MAX)));
  } catch {
    /* ignore */
  }
}

/** Send what was queued while offline. Returns how many went. */
export function flushVoiceTelemetry(post: (path: string, body: string) => void = defaultPost, store: QueueStorage | null = storage()): number {
  if (!store) return 0;
  let arr: unknown[] = [];
  try {
    const raw = store.getItem(TELEMETRY_QUEUE_KEY);
    if (!raw) return 0;
    const list = JSON.parse(raw) as unknown;
    arr = Array.isArray(list) ? list : [];
    store.removeItem(TELEMETRY_QUEUE_KEY);
  } catch {
    return 0;
  }
  let sent = 0;
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    try {
      post(VOICE_TELEMETRY_PATH, JSON.stringify(item));
      sent++;
    } catch {
      /* ignore */
    }
  }
  return sent;
}

function defaultPost(path: string, body: string): void {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    /* A Blob with a JSON type is a "simple" request the beacon can carry. */
    navigator.sendBeacon(path, new Blob([body], { type: "application/json" }));
    return;
  }
  if (typeof fetch === "function") {
    void fetch(path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

/* ---------------------------------------------------------------------------
   voice/telemetry — one beacon when a call fails, so the server's log can say
   why. States and counts only; see /api/ai/voice/telemetry for the reader.
   Fire-and-forget: a failed beacon is a missing log line, never an error in
   a call that has already failed for its own reason.
   --------------------------------------------------------------------------- */

export const VOICE_TELEMETRY_PATH = "/api/ai/voice/telemetry";

export type VoiceTelemetry = {
  reason: string;
  resumes?: number;
  elapsed_ms?: number;
  ice?: string;
  dc?: string;
  last_event?: string;
  tool_calls?: number;
  region?: string;
  ice_ever_connected?: boolean;
};

export function sendVoiceTelemetry(t: VoiceTelemetry, post: (path: string, body: string) => void = defaultPost): void {
  try {
    post(VOICE_TELEMETRY_PATH, JSON.stringify(t));
  } catch {
    /* Never an error. */
  }
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

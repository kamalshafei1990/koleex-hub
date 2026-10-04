/* ---------------------------------------------------------------------------
   voice/lane-probe — can THIS browser reach the WebSocket lane's vendor?

   THE SERVER CANNOT KNOW (2026-09-07 17:27). The lane was chosen from the
   country the platform stamps on the request to OUR server. The owner
   switched a VPN on and still got the mainland voice: a VPN on a phone in
   China routes only the blocked hosts through the tunnel, and our own host
   is not blocked — so the request to us left the country from a mainland
   address (CN → mainland lane) while the browser could have reached the
   vendor through the tunnel the whole time. The converse holds too: no
   header can tell the server that a caller's browser cannot reach a host.

   So the BROWSER finds out, once, ahead of the call: it asks our route for
   a socket and a secret exactly as a call would, opens the socket, and
   hangs up the moment the socket says "open". Opens within the deadline:
   the lane works from here. Anything else — a reset, an error, silence —
   it does not. The result is remembered on the device (voice-pref.ts) so
   the next call starts on the right lane with no probe at all, and is
   re-checked after a while because networks change.

   The probe is only run when the server's own answer was "mainland" and
   the socket lane exists: a caller the server already sends to the socket
   lane needs no probe, and a deployment with no socket lane has nothing to
   probe. A probe costs one short-lived secret and no audio.
   --------------------------------------------------------------------------- */

import { WS_SESSION_PATH, type VoiceSocket } from "./session";

/* FIVE SECONDS FOR THE FAR SIDE'S FIRST WORD (2026-09-08: a socket that
   opened and said nothing for ninety-six seconds passed a probe that only
   asked whether it opened — session.ts WS_FIRST_EVENT_MS has the account).
   The probe now waits for the first event, through the relay when there
   is one: our route, the relay, the vendor, the vendor's hello. */
export const LANE_PROBE_TIMEOUT_MS = 5_000;

export type LaneProbeDeps = {
  fetchFn: typeof fetch;
  createWebSocket: (url: string, protocols: string[]) => VoiceSocket;
  timeoutMs?: number;
};

/**
 * True when a socket to the vendor opens from this browser AND the far
 * side sends its first event within the deadline. Never throws; every
 * failure is false.
 */
export async function probeWsLane(deps: LaneProbeDeps): Promise<boolean> {
  const timeoutMs = deps.timeoutMs ?? LANE_PROBE_TIMEOUT_MS;
  let url = "";
  let protocols: string[] = [];
  try {
    /* With a body, like the call's own handshake (session.ts dialWs,
       2026-09-08): the empty POST was the one request that never arrived. */
    const res = await deps.fetchFn(WS_SESSION_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
      credentials: "include",
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(timeoutMs * 3) } : {}),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { url?: unknown; protocols?: unknown };
    url = typeof body.url === "string" ? body.url : "";
    protocols = Array.isArray(body.protocols) ? body.protocols.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
    if (!/^wss:\/\//i.test(url) || protocols.length === 0) return false;
  } catch {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let ws: VoiceSocket | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          ws.close();
        } catch { /* already closed */ }
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      ws = deps.createWebSocket(url, protocols);
    } catch {
      finish(false);
      return;
    }
    /* Open is not enough: a stalled tunnel opens and says nothing. */
    ws.onopen = () => {};
    ws.onmessage = () => finish(true);
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}

import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/grok-probe — does the socket lane's vendor SPEAK to us right now?

   WHY THIS EXISTS (2026-09-08 06:21–06:47). From the owner's phone and then
   his Mac, both through a VPN, the socket to the socket-lane vendor OPENED
   and then said nothing — no session.created, no ping, nothing — for as
   long as anyone waited. The route's secret minting worked in the same
   minutes. That leaves two explanations that need opposite fixes: the
   vendor's realtime endpoint went silent for everyone, or the path between
   those devices and the vendor is what a stalled tunnel looks like. Nothing
   we ran could tell them apart, because nothing of ours had ever opened
   that socket from anywhere but a browser.

   THIS OPENS IT FROM OUR OWN FUNCTION, exactly as a browser does: a
   short-lived client secret minted with the real key, the socket url and
   the subprotocol the route composes, and then a wait for the far side's
   FIRST EVENT. The verdict is one of:

     spoke      the socket opened and an event arrived — the vendor is fine,
                and a silent socket elsewhere is the path, not the vendor
     silent     the socket opened and nothing arrived by the deadline — the
                vendor accepted the connection and did not speak
     refused    the socket closed before a word (a bad secret, a refused
                protocol, a blocked host)
     no-secret  the mint failed; grok.ts logged why
     unsupported this runtime has no WebSocket

   NEVER THE TOKEN, NEVER THE URL. The log line carries the verdict, the
   time, the first event's TYPE and a close code — nothing that names the
   host or could be replayed. A session is opened and closed within
   seconds; no audio is sent and no model answers, so no tokens are spent
   beyond the secret itself.
   --------------------------------------------------------------------------- */

import {
  type GrokVoiceConfig,
  grokProtocols,
  grokSocketUrl,
  mintClientSecret,
} from "./grok";

export const SOCKET_PROBE_TIMEOUT_MS = 8_000;

export type SocketProbeVerdict = "spoke" | "silent" | "refused" | "no-secret" | "unsupported";

export type SocketProbe = {
  verdict: SocketProbeVerdict;
  /** From the mint's start to the verdict. */
  ms: number;
  /** Milliseconds from dialling to the socket saying open; null if it never did. */
  openMs: number | null;
  /** The far side's first event type, when it spoke. Names only. */
  first: string | null;
  /** The close code, when the socket closed before a word. */
  closeCode: number | null;
};

/** The socket shape the probe needs — the browser's and Node's WebSocket
 *  both satisfy it; the suite hands in a fake. */
export type ProbeSocket = {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

export type SocketProbeDeps = {
  fetchFn?: typeof fetch;
  createWebSocket?: (url: string, protocols: string[]) => ProbeSocket;
  timeoutMs?: number;
  /** The url to dial for a given minted secret; default the vendor's own.
   *  The watchdog passes the relay's (with a ticket) to probe that path. */
  dialUrl?: (token: string) => string;
};

/** The event's `type`, read the way the client reads it: parsed, never a
 *  substring match. Anything unreadable is "?". */
function eventTypeOf(data: unknown): string {
  if (typeof data !== "string") return "?";
  try {
    const v = JSON.parse(data) as { type?: unknown };
    return typeof v?.type === "string" ? v.type.replace(/[^\w.]/g, "").slice(0, 60) || "?" : "?";
  } catch {
    return "?";
  }
}

function closeCodeOf(ev: unknown): number | null {
  const code = ev && typeof ev === "object" ? (ev as { code?: unknown }).code : undefined;
  return typeof code === "number" && Number.isFinite(code) ? code : null;
}

/** Open the socket lane once, from here, and report whether the far side
 *  spoke. Never throws. */
export async function probeGrokSocket(
  cfg: GrokVoiceConfig,
  apiKey: string,
  deps: SocketProbeDeps = {},
): Promise<SocketProbe> {
  const timeoutMs = deps.timeoutMs ?? SOCKET_PROBE_TIMEOUT_MS;
  const t0 = Date.now();
  const done = (verdict: SocketProbeVerdict, extra: Partial<SocketProbe> = {}): SocketProbe => ({
    verdict,
    ms: Date.now() - t0,
    openMs: null,
    first: null,
    closeCode: null,
    ...extra,
  });

  const create =
    deps.createWebSocket ??
    (typeof WebSocket === "undefined"
      ? null
      : (url: string, protocols: string[]) => new WebSocket(url, protocols) as unknown as ProbeSocket);
  if (!create) return done("unsupported");

  const secret = await mintClientSecret(cfg, apiKey, deps.fetchFn ?? fetch);
  if (!secret) return done("no-secret");

  return new Promise<SocketProbe>((resolve) => {
    let settled = false;
    let sock: ProbeSocket | null = null;
    let openMs: number | null = null;
    const dialledAt = Date.now();
    const finish = (verdict: SocketProbeVerdict, extra: Partial<SocketProbe> = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (sock) {
        sock.onopen = null;
        sock.onmessage = null;
        sock.onclose = null;
        sock.onerror = null;
        try {
          sock.close();
        } catch { /* already closed */ }
      }
      resolve(done(verdict, { openMs, ...extra }));
    };
    const timer = setTimeout(() => finish(openMs === null ? "refused" : "silent"), timeoutMs);
    try {
      sock = create(deps.dialUrl ? deps.dialUrl(secret.value) : grokSocketUrl(cfg), grokProtocols(cfg, secret.value));
    } catch {
      finish("refused");
      return;
    }
    sock.onopen = () => {
      openMs = Date.now() - dialledAt;
    };
    sock.onmessage = (m) => finish("spoke", { first: eventTypeOf(m.data) });
    sock.onclose = (ev) => finish("refused", { closeCode: closeCodeOf(ev) });
    sock.onerror = () => {
      /* A close follows an error; the close carries the code. */
    };
  });
}

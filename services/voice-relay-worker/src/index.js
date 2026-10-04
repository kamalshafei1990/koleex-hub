/* ---------------------------------------------------------------------------
   Koleex AI voice relay — Cloudflare Worker (free replacement for Railway).

   Same job as services/voice-relay/server.mjs: the browser in mainland China
   cannot reach api.x.ai directly, so the socket goes to this relay (on
   Cloudflare's edge) and the relay dials the vendor. Text frames are carried
   both ways; the keepalive frame is answered here and never forwarded.

   Security (mirrors the Node relay):
     · The vendor API key never comes here — the browser presents the
       short-lived CLIENT SECRET in the subprotocol, forwarded to the vendor.
     · A connection is admitted only with a TICKET the Koleex route signed:
       HMAC-SHA256(token.exp) with the shared VOICE_RELAY_SECRET.
     · The upstream host is fixed; only a model id (allow-listed) is appended.

   v1 is STATELESS: it proxies and answers keepalive. The Node relay's
   park/resume/handover (for China's ~30s socket cuts) needs state and is a
   follow-up on Durable Objects if the cuts appear on the Cloudflare path.
   --------------------------------------------------------------------------- */

const UPSTREAM_URL = "wss://api.x.ai/v1/realtime";
const PROTOCOL_PREFIX = "xai-client-secret.";
const TICKET_MAX_AGE_S = 15 * 60;
const MAX_FRAME_BYTES = 1024 * 1024;
const KEEPALIVE_FRAME = '{"type":"koleex.keepalive"}';

/** The client secret out of the subprotocol header, or null. */
function tokenFromProtocols(header) {
  if (typeof header !== "string") return null;
  for (const raw of header.split(",")) {
    const p = raw.trim();
    if (p.startsWith(PROTOCOL_PREFIX) && p.length > PROTOCOL_PREFIX.length && p.length <= 512) {
      return p.slice(PROTOCOL_PREFIX.length);
    }
  }
  return null;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** True only for a well-formed, unexpired ticket whose signature matches. */
async function verifyTicket(secret, token, ticket, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !token || typeof ticket !== "string") return false;
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(ticket);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < nowSec || exp > nowSec + TICKET_MAX_AGE_S) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return await crypto.subtle.verify("HMAC", key, hexToBytes(m[2]), enc.encode(`${token}.${exp}`));
}

/** An origin entry with `*` as a whole-host pattern (never a dot). */
function hostPattern(entry) {
  const body = entry.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]*");
  return new RegExp(`^${body}$`);
}

/** Browsers always send Origin; a request without one is our own watchdog
    (admitted to the ticket check, the real gate). A foreign browser origin
    is refused. */
function originAllowed(origin, suffixesRaw) {
  if (!origin) return true;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  const suffixes = (suffixesRaw || "koleexgroup.com,koleex-*.vercel.app")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return suffixes.some((s) => (s.includes("*") ? hostPattern(s).test(host) : host === s || host.endsWith(`.${s}`)));
}

/** The upstream url: the fixed endpoint, plus the client's model when it is a
    plain identifier. */
function upstreamUrlFor(model) {
  const u = new URL(UPSTREAM_URL);
  if (typeof model === "string" && /^[\w.-]{1,64}$/.test(model)) u.searchParams.set("model", model);
  return u.toString();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({ ok: true, configured: Boolean(env.VOICE_RELAY_SECRET) }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (url.pathname !== "/v1/realtime") return new Response("not-found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected-websocket", { status: 426 });

    const secret = (env.VOICE_RELAY_SECRET || "").trim();
    if (!secret) return new Response("unconfigured", { status: 503 });

    if (!originAllowed(request.headers.get("Origin"), env.VOICE_RELAY_ORIGINS)) {
      return new Response("origin", { status: 403 });
    }

    const token = tokenFromProtocols(request.headers.get("sec-websocket-protocol"));
    if (!token) return new Response("protocol", { status: 400 });

    const ticket = url.searchParams.get("t");
    if (!(await verifyTicket(secret, token, ticket))) {
      return new Response("ticket", { status: 403 });
    }

    const model = url.searchParams.get("model");
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = Object.values(pair);
    serverWs.accept();

    // Stateless v1: a resume has no parked/live session to attach to, so tell
    // the client at once (close code 4001, the Node relay's NO_SESSION_CODE)
    // and it dials afresh.
    if (url.searchParams.get("resume") === "1") {
      try { serverWs.close(4001, "no-session"); } catch { /* gone */ }
      return new Response(null, {
        status: 101,
        webSocket: clientWs,
        headers: { "Sec-WebSocket-Protocol": `${PROTOCOL_PREFIX}${token}` },
      });
    }

    const upstream = new WebSocket(upstreamUrlFor(model), [`${PROTOCOL_PREFIX}${token}`]);
    let opened = false;

    serverWs.addEventListener("message", (ev) => {
      const text = typeof ev.data === "string" ? ev.data : "";
      if (!text) return; // ignore binary frames, as the Node relay does
      if (text === KEEPALIVE_FRAME) {
        try { serverWs.send(KEEPALIVE_FRAME); } catch { /* closing */ }
        return;
      }
      if (upstream.readyState === 1) {
        try { upstream.send(text); } catch { /* closing */ }
      }
    });

    serverWs.addEventListener("close", () => {
      try { upstream.close(1000, "client-closed"); } catch { /* gone */ }
    });
    serverWs.addEventListener("error", () => {
      try { upstream.close(1011, "client-error"); } catch { /* gone */ }
    });

    upstream.addEventListener("open", () => { opened = true; });
    upstream.addEventListener("message", (ev) => {
      if (serverWs.readyState === 1) {
        try { serverWs.send(typeof ev.data === "string" ? ev.data : ev.data); } catch { /* closing */ }
      }
    });
    upstream.addEventListener("close", () => {
      try { serverWs.close(1011, "upstream-closed"); } catch { /* gone */ }
    });
    upstream.addEventListener("error", () => {
      try { serverWs.close(1011, "upstream-error"); } catch { /* gone */ }
    });

    return new Response(null, {
      status: 101,
      webSocket: clientWs,
      headers: { "Sec-WebSocket-Protocol": `${PROTOCOL_PREFIX}${token}` },
    });
  },
};

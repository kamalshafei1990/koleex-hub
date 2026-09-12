/* ---------------------------------------------------------------------------
   Koleex AI voice relay — the socket lane, carried through our own domain.

   WHY THIS EXISTS (2026-09-08). From mainland China the browser's direct
   socket to the socket-lane vendor opened and then said nothing — from a
   phone and a Mac, through a VPN, for as long as anyone waited — while
   every request to OUR origin went through. A caller's device reaches
   Koleex; it does not reliably reach the vendor. So the socket goes to
   Koleex: the browser opens ONE socket to this relay, and the relay opens
   the socket to the vendor and carries frames both ways. Nothing above the
   transport changes: the events, the audio frames, the tool relay are the
   vendor's protocol, untouched.

   WHAT THIS IS NOT. It is not an open proxy and it holds no key:
     · The vendor's API key never comes here. The browser presents the
       SHORT-LIVED CLIENT SECRET the Koleex route minted for it, in the
       subprotocol, exactly as it would to the vendor; the relay forwards
       that subprotocol upstream and the vendor authenticates it.
     · A connection is admitted only with a TICKET the Koleex route signed:
       HMAC-SHA256 over the client secret and an expiry, with a secret this
       relay and the route share (VOICE_RELAY_SECRET). No ticket, a stale
       ticket, a ticket for another secret: refused before anything is
       dialled. Someone with their own vendor secret cannot use our relay.
     · The upstream host is this process's configuration, never the
       client's. The client may name a MODEL (allow-listed characters), which
       becomes the upstream's query parameter, nothing else.
     · Text frames only, bounded; a session is capped; a client that sends
       nothing for a while is pinged, and one that does not answer is closed.
     · Logs carry counts, durations and close codes — never a secret, a
       ticket, or a frame.
   --------------------------------------------------------------------------- */

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT) || 8080;
const UPSTREAM_URL = (process.env.VOICE_UPSTREAM_URL || "wss://api.x.ai/v1/realtime").trim();
const SECRET = (process.env.VOICE_RELAY_SECRET || "").trim();
/** The subprotocol prefix the vendor expects; the token follows it. */
const PROTOCOL_PREFIX = (process.env.VOICE_PROTOCOL_PREFIX || "xai-client-secret.").trim();
/** Origins allowed to open a socket (comma-separated; suffix match on the
 *  host). Defence in depth beside the ticket: a browser cannot forge it. */
const ORIGIN_SUFFIXES = (process.env.VOICE_RELAY_ORIGINS || "koleexgroup.com,vercel.app")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const MAX_FRAME_BYTES = 1024 * 1024;   // one audio frame is ~10 KB; a session config ~50 KB
export const MAX_SESSION_MS = 60 * 60 * 1000;   // an hour; the vendor's own limit is shorter
export const UPSTREAM_OPEN_MS = 10_000;         // the vendor must open in this long
export const PING_EVERY_MS = 20_000;            // keeps a NAT / border path alive
export const MAX_CONNECTIONS = 200;
export const MAX_PER_ADDRESS = 8;
export const TICKET_MAX_AGE_S = 15 * 60;        // a ticket cannot outlive the secret it names by much

/* ── The keepalive ──────────────────────────────────────────────────────── */

/** THE FRAME THAT KEEPS A MIDDLEBOX FROM CUTTING THE LINE (2026-09-11 15:07
 *  UTC: the browser's socket to this relay died twice at exactly 36 s,
 *  `client-closed 1006`, with audio frames flowing the whole time — the
 *  shape of a proxy on the phone's path that times out a WebSocket it does
 *  not see application traffic on, protocol pings notwithstanding). The
 *  browser sends this small text frame every few seconds; the relay
 *  answers it and never forwards it — the vendor must not see an event it
 *  does not know. Exact match, so nothing else can pretend to be it. */
export const KEEPALIVE_FRAME = '{"type":"koleex.keepalive"}';
export function isKeepalive(text) {
  return text === KEEPALIVE_FRAME;
}

/* ── The ticket ─────────────────────────────────────────────────────────── */

/** `exp.sig`: sig = HMAC-SHA256(secret, `${token}.${exp}`) as hex. Pure. */
export function signTicket(secret, token, exp) {
  return `${exp}.${createHmac("sha256", secret).update(`${token}.${exp}`).digest("hex")}`;
}

/** True only for a well-formed, unexpired ticket whose signature matches
 *  THIS token. Constant-time on the signature. Pure. */
export function verifyTicket(secret, token, ticket, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !token || typeof ticket !== "string") return false;
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(ticket);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < nowSec || exp > nowSec + TICKET_MAX_AGE_S) return false;
  const expected = createHmac("sha256", secret).update(`${token}.${exp}`).digest();
  const given = Buffer.from(m[2], "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The client secret out of the subprotocol header, or null. Pure. */
export function tokenFromProtocols(header) {
  if (typeof header !== "string") return null;
  for (const raw of header.split(",")) {
    const p = raw.trim();
    if (p.startsWith(PROTOCOL_PREFIX) && p.length > PROTOCOL_PREFIX.length && p.length <= 512) {
      return p.slice(PROTOCOL_PREFIX.length);
    }
  }
  return null;
}

/** The upstream url for one connection: the configured endpoint, plus the
 *  client's model when it is a plain identifier. Pure. */
export function upstreamUrlFor(model) {
  const u = new URL(UPSTREAM_URL);
  if (typeof model === "string" && /^[\w.-]{1,64}$/.test(model)) u.searchParams.set("model", model);
  return u.toString();
}

/** Browsers always send Origin; a request WITHOUT one is not a browser —
 *  our own watchdog dialling from a Vercel function (Node's WebSocket
 *  cannot set the header; 2026-09-08 20:30: `refused origin code=403` on
 *  every probe, so the path a caller takes was never measured). It is
 *  admitted to the TICKET check, which is the real gate; the origin check
 *  only ever narrowed browsers. A browser origin that is not ours is still
 *  refused. */
export function originAllowed(origin) {
  if (origin === undefined || origin === null || origin === "") return true;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ORIGIN_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

/* ── The server ─────────────────────────────────────────────────────────── */

const perAddress = new Map();
let connections = 0;
let sessions = 0;

function log(line) {
  console.log(`[voice-relay] ${line}`);
}

export function createRelay() {
  const http = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true, connections, configured: Boolean(SECRET) }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_FRAME_BYTES,
    /* The vendor's subprotocol is echoed back to the browser, as the vendor
       itself would: a browser drops a socket whose chosen protocol is not
       one it offered. */
    handleProtocols: (protocols) => {
      for (const p of protocols) if (p.startsWith(PROTOCOL_PREFIX)) return p;
      return false;
    },
  });

  http.on("upgrade", (req, socket, head) => {
    const refuse = (code, why) => {
      log(`refused ${why} code=${code}`);
      socket.write(`HTTP/1.1 ${code} ${why}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!SECRET) return refuse(503, "unconfigured");
    const url = new URL(req.url || "/", "http://relay");
    if (url.pathname !== "/v1/realtime") return refuse(404, "path");
    if (!originAllowed(req.headers.origin)) return refuse(403, "origin");
    const token = tokenFromProtocols(req.headers["sec-websocket-protocol"]);
    if (!token) return refuse(400, "protocol");
    if (!verifyTicket(SECRET, token, url.searchParams.get("t"))) return refuse(403, "ticket");
    if (connections >= MAX_CONNECTIONS) return refuse(503, "busy");
    const address = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    if ((perAddress.get(address) || 0) >= MAX_PER_ADDRESS) return refuse(429, "too-many");

    wss.handleUpgrade(req, socket, head, (client) => {
      bridge(client, token, url.searchParams.get("model"), address);
    });
  });

  /* The region is in the first line so the deploy log answers "where is it
     running" without a dashboard: on 2026-09-12 the service was found in
     Amsterdam while the notes said Singapore, and nothing in the logs had
     said so for four days. Railway sets RAILWAY_REPLICA_REGION on each
     instance. */
  http.listen(PORT, () => log(`listening port=${PORT} upstream=${new URL(UPSTREAM_URL).host} configured=${Boolean(SECRET)} region=${process.env.RAILWAY_REPLICA_REGION || "unknown"}`));
  return http;
}

function bridge(client, token, model, address) {
  const id = ++sessions;
  const t0 = Date.now();
  connections++;
  perAddress.set(address, (perAddress.get(address) || 0) + 1);
  let up = 0;
  let down = 0;
  let upstreamOpenedAt = 0;
  let closed = false;

  const upstream = new WebSocket(upstreamUrlFor(model), [`${PROTOCOL_PREFIX}${token}`], {
    handshakeTimeout: UPSTREAM_OPEN_MS,
    maxPayload: MAX_FRAME_BYTES,
  });
  /* Frames the browser sends before the vendor is open wait here, in order. */
  const pending = [];

  const finish = (why, code = 1000) => {
    if (closed) return;
    closed = true;
    connections--;
    const n = (perAddress.get(address) || 1) - 1;
    if (n <= 0) perAddress.delete(address);
    else perAddress.set(address, n);
    clearInterval(pinger);
    clearTimeout(cap);
    try { client.close(code); } catch { /* gone */ }
    try { upstream.close(); } catch { /* gone */ }
    log(`session=${id} end why=${why} code=${code} ms=${Date.now() - t0} openMs=${upstreamOpenedAt ? upstreamOpenedAt - t0 : "none"} up=${up} down=${down}`);
  };

  const cap = setTimeout(() => finish("cap", 1000), MAX_SESSION_MS);
  let alive = true;
  const pinger = setInterval(() => {
    if (!alive) return finish("silent-client", 1001);
    alive = false;
    try { client.ping(); } catch { /* closing */ }
  }, PING_EVERY_MS);
  client.on("pong", () => { alive = true; });

  upstream.on("open", () => {
    upstreamOpenedAt = Date.now();
    for (const f of pending) upstream.send(f);
    pending.length = 0;
    log(`session=${id} upstream open openMs=${upstreamOpenedAt - t0} queued=${up}`);
  });
  upstream.on("message", (data, isBinary) => {
    if (isBinary) return;
    down++;
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });
  upstream.on("close", (code) => finish("upstream-closed", code >= 1000 && code < 5000 ? code : 1011));
  upstream.on("error", (e) => {
    log(`session=${id} upstream error name=${e?.code || e?.name || "error"}`);
    finish("upstream-error", 1011);
  });

  client.on("message", (data, isBinary) => {
    if (isBinary) return;
    alive = true;
    const text = data.toString();
    /* Answered here, counted nowhere, forwarded never. */
    if (isKeepalive(text)) {
      if (client.readyState === WebSocket.OPEN) client.send(KEEPALIVE_FRAME);
      return;
    }
    up++;
    if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
    else if (upstream.readyState === WebSocket.CONNECTING) {
      if (pending.length < 200) pending.push(text);
    }
  });
  client.on("close", (code) => finish("client-closed", code >= 1000 && code < 5000 ? code : 1001));
  client.on("error", () => finish("client-error", 1011));
  log(`session=${id} start model=${typeof model === "string" && /^[\w.-]{1,64}$/.test(model) ? model : "default"}`);
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) createRelay();

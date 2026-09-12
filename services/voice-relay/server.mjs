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
/** Sockets one ticket may hold at once: the live one, a redial that
 *  overlaps it while the dead one drains, and one spare. */
export const MAX_PER_TICKET = 3;
/** Frames queued while the vendor opens, in bytes: a session configuration
 *  and a second or two of audio, never a memory of the whole handshake. */
export const MAX_PENDING_BYTES = 2 * 1024 * 1024;

/** The peer the edge actually spoke to: the LAST x-forwarded-for hop (the
 *  edge appends it), else the socket's own address. A browser can write the
 *  front of that header; it cannot write the end. Pure. */
export function clientAddress(forwardedFor, remoteAddress) {
  const hops = String(forwardedFor || "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : String(remoteAddress || "");
}
export const TICKET_MAX_AGE_S = 15 * 60;        // a ticket cannot outlive the secret it names by much

/* ── The parked session ─────────────────────────────────────────────────── */

/** THE LINE DROPS EVERY THIRTY SECONDS AND THE CONVERSATION USED TO DROP
 *  WITH IT (2026-09-12 16:58–17:00 UTC: sessions 15–19, `client-closed
 *  code=1006` at 3.0 / 28.9 / 29.2 / 28.3 / 32.9 s on the owner's Japan
 *  exit; the same shape at 05:35). Each redial opened a NEW vendor session:
 *  a fresh configuration, an empty context, the answer in flight lost. The
 *  vendor's side of the line was never the problem — so it is kept. A
 *  client that vanishes abnormally leaves its upstream PARKED for a short
 *  grace; a redial presenting the same secret with `resume=1` is attached
 *  to it, hears the frames that arrived meanwhile, and the conversation
 *  goes on where it was. A clean close (the caller hung up) parks nothing. */
export const RESUME_GRACE_MS = 12_000;
/** Frames held for the absent client, in bytes; past this the session ends
 *  rather than grow (a minute of answer audio is ~1.5 MB of base64). */
export const MAX_PARK_BYTES = 1024 * 1024;
/** The relay's own first frame on a resumed socket, so the client knows
 *  not to configure the session again. Never forwarded upstream. */
export function relayHello(resumed) {
  return JSON.stringify({ type: "koleex.relay", resumed: Boolean(resumed) });
}
/** A client loss the caller did not choose (1006: the socket died with no
 *  close frame) parks; a close frame from the client (1000, 1005, 1001) is
 *  the caller leaving, and ends the session as before. Pure. */
export function shouldPark(clientCloseCode) {
  return clientCloseCode === 1006;
}
/** Close code on a resume that finds nothing parked: the client dials
 *  afresh at once instead of waiting out a backoff. */
export const NO_SESSION_CODE = 4001;

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
/** Open sockets per admission ticket (see MAX_PER_TICKET). */
const perTicket = new Map();
/** Sessions whose client vanished abnormally, by client secret, for
 *  RESUME_GRACE_MS (see the constant). */
const parked = new Map();
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
    /* THE ADDRESS THE EDGE SAW, not the one the browser wrote (security
       review, 2026-09-12): a client can put anything in front of
       x-forwarded-for; the edge appends the peer it actually spoke to at
       the END. The per-address cap keys on that last hop. */
    const address = clientAddress(req.headers["x-forwarded-for"], req.socket.remoteAddress);
    if ((perAddress.get(address) || 0) >= MAX_PER_ADDRESS) return refuse(429, "too-many");
    /* ONE TICKET, A FEW SOCKETS. A ticket is not single-use — a redial on a
       dropped line presents the same one — but it admits at most
       MAX_PER_TICKET sockets at once, so a copied ticket cannot fill the
       relay on its own. */
    const ticketKey = url.searchParams.get("t") || "";
    if ((perTicket.get(ticketKey) || 0) >= MAX_PER_TICKET) return refuse(429, "too-many-ticket");
    const wantsResume = url.searchParams.get("resume") === "1";

    wss.handleUpgrade(req, socket, head, (client) => {
      if (wantsResume) {
        /* A resume attaches to the session this secret parked, or is told
           at once that there is none — never a second upstream on a secret
           the vendor may already have seen. */
        const park = parked.get(token);
        if (park) {
          parked.delete(token);
          park.attach(client, address);
        } else {
          log(`resume miss`);
          try { client.close(NO_SESSION_CODE, "no-session"); } catch { /* gone */ }
        }
        return;
      }
      bridge(client, token, url.searchParams.get("model"), address, ticketKey);
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

function bridge(firstClient, token, model, firstAddress, ticketKey = "") {
  perTicket.set(ticketKey, (perTicket.get(ticketKey) || 0) + 1);
  const id = ++sessions;
  const t0 = Date.now();
  connections++;
  let client = firstClient;
  let address = firstAddress;
  perAddress.set(address, (perAddress.get(address) || 0) + 1);
  let up = 0;
  let down = 0;
  let resumes = 0;
  let upstreamOpenedAt = 0;
  let closed = false;
  /* While parked: the client is null, downstream frames wait here. */
  let parkedAt = 0;
  let parkTimer = null;
  const held = [];
  let heldBytes = 0;

  const upstream = new WebSocket(upstreamUrlFor(model), [`${PROTOCOL_PREFIX}${token}`], {
    handshakeTimeout: UPSTREAM_OPEN_MS,
    maxPayload: MAX_FRAME_BYTES,
  });
  /* Frames the browser sends before the vendor is open wait here, in order. */
  const pending = [];
  let pendingBytes = 0;

  const releaseAddress = () => {
    const n = (perAddress.get(address) || 1) - 1;
    if (n <= 0) perAddress.delete(address);
    else perAddress.set(address, n);
  };

  const finish = (why, code = 1000) => {
    if (closed) return;
    closed = true;
    connections--;
    if (client) releaseAddress();
    const t = (perTicket.get(ticketKey) || 1) - 1;
    if (t <= 0) perTicket.delete(ticketKey);
    else perTicket.set(ticketKey, t);
    clearInterval(pinger);
    clearTimeout(cap);
    if (parkTimer) clearTimeout(parkTimer);
    if (parked.get(token)?.attach === attach) parked.delete(token);
    try { client?.close(code); } catch { /* gone */ }
    try { upstream.close(); } catch { /* gone */ }
    log(`session=${id} end why=${why} code=${code} ms=${Date.now() - t0} openMs=${upstreamOpenedAt ? upstreamOpenedAt - t0 : "none"} up=${up} down=${down} resumes=${resumes}`);
  };

  const cap = setTimeout(() => finish("cap", 1000), MAX_SESSION_MS);
  let alive = true;
  const pinger = setInterval(() => {
    /* A parked session has no client to ping; the grace timer bounds it. */
    if (!client) return;
    if (!alive) return finish("silent-client", 1001);
    alive = false;
    try { client.ping(); } catch { /* closing */ }
  }, PING_EVERY_MS);

  /** The client's side of the bridge, attached once per socket. */
  const wire = (c) => {
    c.on("pong", () => { alive = true; });
    c.on("message", (data, isBinary) => {
      if (c !== client || isBinary) return;
      alive = true;
      const text = data.toString();
      /* Answered here, counted nowhere, forwarded never. */
      if (isKeepalive(text)) {
        if (c.readyState === WebSocket.OPEN) c.send(KEEPALIVE_FRAME);
        return;
      }
      up++;
      if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
      else if (upstream.readyState === WebSocket.CONNECTING) {
        /* Bounded by BYTES, not frames (security review, 2026-09-12): two
           hundred frames of the maximum size was two hundred megabytes held
           per socket while the vendor opened. */
        if (pendingBytes + text.length <= MAX_PENDING_BYTES) {
          pending.push(text);
          pendingBytes += text.length;
        }
      }
    });
    c.on("close", (code) => {
      if (c !== client) return;
      const clean = code >= 1000 && code < 5000 ? code : 1001;
      if (shouldPark(code) && upstream.readyState === WebSocket.OPEN && !closed) return park();
      finish("client-closed", clean);
    });
    c.on("error", () => { if (c === client) finish("client-error", 1011); });
  };

  /** The client is gone without a word: keep the vendor's side for a while. */
  const park = () => {
    releaseAddress();
    client = null;
    parkedAt = Date.now();
    parked.set(token, { attach });
    parkTimer = setTimeout(() => {
      parkTimer = null;
      if (!client) finish("resume-expired", 1001);
    }, RESUME_GRACE_MS);
    log(`session=${id} parked ms=${parkedAt - t0} up=${up} down=${down}`);
  };

  /** A redial with the same secret takes the parked session over. */
  const attach = (c, addr) => {
    if (closed) {
      try { c.close(NO_SESSION_CODE, "no-session"); } catch { /* gone */ }
      return;
    }
    if (parkTimer) clearTimeout(parkTimer);
    parkTimer = null;
    client = c;
    address = addr;
    perAddress.set(address, (perAddress.get(address) || 0) + 1);
    alive = true;
    resumes++;
    const gapMs = parkedAt ? Date.now() - parkedAt : 0;
    parkedAt = 0;
    wire(c);
    try {
      c.send(relayHello(true));
      for (const f of held) c.send(f);
    } catch { /* the new socket died at once; its close handles it */ }
    log(`session=${id} resumed gapMs=${gapMs} held=${held.length}`);
    held.length = 0;
    heldBytes = 0;
  };

  upstream.on("open", () => {
    upstreamOpenedAt = Date.now();
    for (const f of pending) upstream.send(f);
    pending.length = 0;
    log(`session=${id} upstream open openMs=${upstreamOpenedAt - t0} queued=${up}`);
  });
  upstream.on("message", (data, isBinary) => {
    if (isBinary) return;
    down++;
    const text = data.toString();
    if (client) {
      if (client.readyState === WebSocket.OPEN) client.send(text);
      return;
    }
    /* Parked: held for the client that comes back, bounded. */
    if (heldBytes + text.length > MAX_PARK_BYTES) return finish("park-overflow", 1011);
    held.push(text);
    heldBytes += text.length;
  });
  upstream.on("close", (code) => finish("upstream-closed", code >= 1000 && code < 5000 ? code : 1011));
  upstream.on("error", (e) => {
    log(`session=${id} upstream error name=${e?.code || e?.name || "error"}`);
    finish("upstream-error", 1011);
  });

  wire(client);
  log(`session=${id} start model=${typeof model === "string" && /^[\w.-]{1,64}$/.test(model) ? model : "default"}`);
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) createRelay();

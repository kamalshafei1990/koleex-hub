import "server-only";

/* ---------------------------------------------------------------------------
   Koleex AI voice relay — Vercel Function port of services/voice-relay.

   WHY THIS FILE EXISTS (2026-10-03). The relay used to be its own long-lived
   process (Railway); the free tier there ended, and moving the domain's
   nameservers is impossible while it is registered at Wix. Vercel's native
   WebSocket support (public beta, 2026-06) lets this same relay live as a
   Function inside koleex-hub itself — the origin the caller's device already
   reaches from mainland China. The logic below is a line-for-line port of
   services/voice-relay/server.mjs; the security model is unchanged:
     · The vendor's API key never comes here. The browser presents the
       SHORT-LIVED CLIENT SECRET in the subprotocol; the relay forwards it
       upstream and the vendor authenticates it.
     · A connection is admitted only with a TICKET the Koleex route signed
       (HMAC-SHA256 over the client secret and an expiry, VOICE_RELAY_SECRET
       shared with the minting route).
     · The upstream host is this deployment's configuration, never the
       client's. The client may name a MODEL (allow-listed characters) only.

   ONE DIFFERENCE FROM THE PROCESS VERSION. The admission checks that the old
   server ran on the raw upgrade request run here BEFORE the upgrade, in the
   route handler (route.ts) — a refusal is a plain HTTP response, exactly as
   before. State (per-address, per-ticket, parked, live) is per Function
   instance: a resume that lands on a different instance finds nothing parked
   and is told so at once (NO_SESSION_CODE); the client then dials afresh,
   which is the degradation the client already handles. Handovers and resumes
   within one instance behave exactly as the process version.
   --------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocket } from "ws";

const UPSTREAM_URL = (process.env.VOICE_UPSTREAM_URL || "wss://api.x.ai/v1/realtime").trim();
const SECRET = (process.env.VOICE_RELAY_SECRET || "").trim();
/** The subprotocol prefix the vendor expects; the token follows it. */
const PROTOCOL_PREFIX = (process.env.VOICE_PROTOCOL_PREFIX || "xai-client-secret.").trim();
/** Origins allowed to open a socket (comma-separated). A plain entry is a
 *  host suffix (`koleexgroup.com` admits `hub.koleexgroup.com`); an entry
 *  with `*` is a pattern on the whole host, `*` standing for letters, digits
 *  and hyphens (`koleex-*.vercel.app`). */
const ORIGIN_SUFFIXES = (process.env.VOICE_RELAY_ORIGINS || "koleexgroup.com,koleex-*.vercel.app")
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
/** Frames queued while the vendor opens, in bytes. */
export const MAX_PENDING_BYTES = 2 * 1024 * 1024;

/** The peer the edge actually spoke to: the LAST x-forwarded-for hop (the
 *  edge appends it), else the socket's own address. A browser can write the
 *  front of that header; it cannot write the end. Pure. */
export function clientAddress(forwardedFor: string | null | undefined, remoteAddress?: string | null): string {
  const hops = String(forwardedFor || "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : String(remoteAddress || "");
}
export const TICKET_MAX_AGE_S = 15 * 60;        // a ticket cannot outlive the secret it names by much

/* ── The parked session ─────────────────────────────────────────────────── */

export const RESUME_GRACE_MS = 12_000;
/** Frames held for the absent client, in bytes; past this the session ends
 *  rather than grow (a minute of answer audio is ~1.5 MB of base64). */
export const MAX_PARK_BYTES = 1024 * 1024;
/** The relay's own first frame on a resumed socket, so the client knows
 *  not to configure the session again. Never forwarded upstream. */
export function relayHello(resumed: boolean): string {
  return JSON.stringify({ type: "koleex.relay", resumed: Boolean(resumed) });
}
/** A client loss the caller did not choose (1006: the socket died with no
 *  close frame) parks; a close frame from the client (1000, 1005, 1001) is
 *  the caller leaving, and ends the session as before. Pure. */
export function shouldPark(clientCloseCode: number): boolean {
  return clientCloseCode === 1006;
}
/** Close code on a resume that finds nothing parked: the client dials
 *  afresh at once instead of waiting out a backoff. */
export const NO_SESSION_CODE = 4001;

/* ── The handover ───────────────────────────────────────────────────────── */

export const HANDOVER_CODE = 4002;
export const HANDOVER_DRAIN_MS = 1500;

/* ── The vendor's pacing ──────────────────────────────────────────────────
   For every audio delta the relay notes how far AHEAD of real time the
   answer's audio is, the longest silence between two deltas of one answer,
   and how many silences passed PACING_GAP_MS. Summarised in the end line.
   Nothing is parsed beyond two regexes; the audio itself is never kept. */
export const WIRE_RATE = 24_000;
export const PACING_GAP_MS = 250;
const DELTA_RE = /"type"\s*:\s*"response\.(?:output_)?audio\.delta"/;
const AUDIO_DONE_RE = /"type"\s*:\s*"response\.(?:output_)?audio\.done"/;
const DELTA_B64_RE = /"delta"\s*:\s*"([A-Za-z0-9+/=]*)"/;
/** The PCM16 bytes inside one delta frame, or null. */
export function deltaBytes(text: string): Buffer | null {
  const m = DELTA_B64_RE.exec(text);
  if (!m) return null;
  return Buffer.from(m[1], "base64");
}
/** Milliseconds of PCM16 at the wire rate inside one delta frame. */
export function audioMsOf(text: string): number {
  const b = deltaBytes(text);
  return b ? b.length / 2 / (WIRE_RATE / 1000) : 0;
}
/* Clicks, clipping and the loudest sample, counted never kept. */
export const CLICK_JUMP = 16_000;
export const CLIP_LEVEL = 32_000;
/** Scan one frame's PCM16: clicks inside it, the jump at its start against
 *  `prevLast` (null for the first frame of an answer), peak and clipped
 *  samples. */
export function scanPcm16(buf: Buffer, prevLast: number | null) {
  const n = Math.floor(buf.length / 2);
  let clicks = 0;
  let peak = 0;
  let clip = 0;
  let edge = 0;
  let prev = prevLast;
  for (let i = 0; i < n; i++) {
    const v = buf.readInt16LE(i * 2);
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    if (a >= CLIP_LEVEL) clip++;
    if (prev !== null) {
      const d = v > prev ? v - prev : prev - v;
      if (i === 0) edge = d;
      else if (d > CLICK_JUMP) clicks++;
    }
    prev = v;
  }
  return { clicks, edge, peak, clip, last: n > 0 ? prev : prevLast };
}
export function createPacing() {
  let deltas = 0;
  let audioMs = 0;
  let gaps = 0;
  let maxGap = 0;
  let minAhead = 0;
  let open = false;
  let firstAt = 0;
  let lastAt = 0;
  let answerMs = 0;
  let clicks = 0;
  let edges = 0;
  let peak = 0;
  let clip = 0;
  let prevLast: number | null = null;
  return {
    note(text: string, now = Date.now()) {
      if (DELTA_RE.test(text)) {
        const bytes = deltaBytes(text);
        const ms = bytes ? bytes.length / 2 / (WIRE_RATE / 1000) : 0;
        deltas++;
        audioMs += ms;
        if (bytes) {
          const sc = scanPcm16(bytes, open ? prevLast : null);
          clicks += sc.clicks;
          if (sc.edge > CLICK_JUMP) edges++;
          if (sc.peak > peak) peak = sc.peak;
          clip += sc.clip;
          prevLast = sc.last;
        }
        if (!open) {
          open = true;
          firstAt = now;
          lastAt = now;
          answerMs = 0;
        } else {
          const gap = now - lastAt;
          if (gap > PACING_GAP_MS) gaps++;
          if (gap > maxGap) maxGap = gap;
        }
        const ahead = answerMs - (now - firstAt);
        if (ahead < minAhead) minAhead = ahead;
        answerMs += ms;
        lastAt = now;
        return;
      }
      if (open && AUDIO_DONE_RE.test(text)) open = false;
    },
    summary() {
      return `deltas=${deltas} audioMs=${Math.round(audioMs)} gaps=${gaps} maxGap=${Math.round(maxGap)} minAhead=${Math.round(minAhead)} clicks=${clicks} edges=${edges} peak=${Math.round((peak / 32768) * 100)} clip=${clip}`;
    },
  };
}

/** THE FRAME THAT KEEPS A MIDDLEBOX FROM CUTTING THE LINE: the browser
 *  sends this small text frame every few seconds; the relay answers it and
 *  never forwards it — the vendor must not see an event it does not know.
 *  Exact match, so nothing else can pretend to be it. */
export const KEEPALIVE_FRAME = '{"type":"koleex.keepalive"}';
export function isKeepalive(text: string): boolean {
  return text === KEEPALIVE_FRAME;
}

/* ── The ticket ─────────────────────────────────────────────────────────── */

/** `exp.sig`: sig = HMAC-SHA256(secret, `${token}.${exp}`) as hex. Pure. */
export function signTicket(secret: string, token: string, exp: number): string {
  return `${exp}.${createHmac("sha256", secret).update(`${token}.${exp}`).digest("hex")}`;
}

/** True only for a well-formed, unexpired ticket whose signature matches
 *  THIS token. Constant-time on the signature. `graceSec` admits a ticket
 *  that expired at most that long ago — only ever passed for a resume of a
 *  session the same ticket opened (resumeTicketOk). Pure. */
export function verifyTicket(secret: string, token: string, ticket: unknown, nowSec = Math.floor(Date.now() / 1000), graceSec = 0): boolean {
  if (!secret || !token || typeof ticket !== "string") return false;
  const m = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(ticket);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < nowSec - graceSec || exp > nowSec + TICKET_MAX_AGE_S) return false;
  const expected = createHmac("sha256", secret).update(`${token}.${exp}`).digest();
  const given = Buffer.from(m[2], "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The client secret out of the subprotocol header, or null. Pure. */
export function tokenFromProtocols(header: string | null | undefined): string | null {
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
export function upstreamUrlFor(model: string | null): string {
  const u = new URL(UPSTREAM_URL);
  if (typeof model === "string" && /^[\w.-]{1,64}$/.test(model)) u.searchParams.set("model", model);
  return u.toString();
}

/** An origin entry with `*` as a whole-host pattern: `*` is one run of
 *  letters, digits and hyphens (never a dot), everything else literal. Pure. */
export function hostPattern(entry: string): RegExp {
  const body = entry.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]*");
  return new RegExp(`^${body}$`);
}

/** Browsers always send Origin; a request WITHOUT one is not a browser —
 *  our own watchdog dialling from a Vercel function. It is admitted to the
 *  TICKET check, which is the real gate. A browser origin that is not ours
 *  is still refused. */
export function originAllowed(origin: string | null | undefined): boolean {
  if (origin === undefined || origin === null || origin === "") return true;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ORIGIN_SUFFIXES.some((s) => (s.includes("*") ? hostPattern(s).test(host) : host === s || host.endsWith(`.${s}`)));
}

/* ── The state (per Function instance — see the header comment) ─────────── */

const perAddress = new Map<string, number>();
/** Open sockets per admission ticket (see MAX_PER_TICKET). */
const perTicket = new Map<string, number>();
/** Sessions whose client vanished abnormally, by client secret, for
 *  RESUME_GRACE_MS. */
const parked = new Map<string, { attach: AttachFn; ticketKey: string }>();
/** Sessions with a client attached, by client secret, for the handover. A
 *  session is in one map or the other, never both. */
const live = new Map<string, { handover: AttachFn; ticketKey: string }>();
let connections = 0;
let sessions = 0;

type AttachFn = (c: WebSocket, addr: string) => void;

function log(line: string) {
  console.log(`[voice-relay] ${line}`);
}

/** THE CALL OUTLIVES ITS TICKET: a RESUME of a session that is still here —
 *  live or parked — and that THIS SAME ticket opened is admitted on an
 *  expired ticket, for as long as a session may last. Pure over the maps. */
export function resumeTicketOk(secret: string, token: string, ticket: unknown, sessionsByToken: Map<string, { ticketKey: string }>[], nowSec = Math.floor(Date.now() / 1000)): boolean {
  const s = sessionsByToken.map((m) => m.get(token)).find(Boolean);
  if (!s || typeof ticket !== "string" || s.ticketKey !== ticket) return false;
  return verifyTicket(secret, token, ticket, nowSec, Math.ceil(MAX_SESSION_MS / 1000));
}

/* ── Admission (runs BEFORE the upgrade, in the route handler) ──────────── */

export type RelayAdmission =
  | { ok: true; token: string; address: string; ticketKey: string; model: string | null; resume: boolean }
  | { ok: false; code: number; why: string };

export function relayConfigured(): boolean {
  return Boolean(SECRET);
}

export function relayConnections(): number {
  return connections;
}

/** Every check the process version ran on the raw upgrade request, in the
 *  same order, with the same refusal codes — only the refusal itself moved
 *  to the route handler as a plain HTTP response. */
export function admitRelay(args: {
  protocolHeader: string | null;
  origin: string | null;
  xForwardedFor: string | null;
  ticket: string | null;
  model: string | null;
  resume: boolean;
}): RelayAdmission {
  if (!SECRET) return { ok: false, code: 503, why: "unconfigured" };
  if (!originAllowed(args.origin)) return { ok: false, code: 403, why: "origin" };
  const token = tokenFromProtocols(args.protocolHeader);
  if (!token) return { ok: false, code: 400, why: "protocol" };
  if (!verifyTicket(SECRET, token, args.ticket)) {
    if (!(args.resume && resumeTicketOk(SECRET, token, args.ticket, [live, parked]))) return { ok: false, code: 403, why: "ticket" };
    log("resume on an expired ticket");
  }
  if (connections >= MAX_CONNECTIONS) return { ok: false, code: 503, why: "busy" };
  /* THE ADDRESS THE EDGE SAW, not the one the browser wrote: the edge
     appends the peer it actually spoke to at the END of x-forwarded-for. */
  const address = clientAddress(args.xForwardedFor);
  if ((perAddress.get(address) || 0) >= MAX_PER_ADDRESS) return { ok: false, code: 429, why: "too-many" };
  /* ONE TICKET, A FEW SOCKETS (see MAX_PER_TICKET). */
  const ticketKey = args.ticket || "";
  if ((perTicket.get(ticketKey) || 0) >= MAX_PER_TICKET) return { ok: false, code: 429, why: "too-many-ticket" };
  return { ok: true, token, address, ticketKey, model: args.model, resume: args.resume };
}

/** Entry point for an admitted socket, from the upgrade handler: resolves
 *  the resume / handover / fresh-bridge decision exactly where the process
 *  version resolved it — after admission, at attach time. */
export function attachRelaySocket(client: WebSocket, adm: Extract<RelayAdmission, { ok: true }>): void {
  if (adm.resume) {
    /* A resume attaches to the session this secret parked, or is told at
       once that there is none — never a second upstream on a secret the
       vendor may already have seen. */
    const park = parked.get(adm.token);
    if (park) {
      parked.delete(adm.token);
      park.attach(client, adm.address);
      return;
    }
    /* Live, not parked: the client is leaving its socket before the path
       cuts it (HANDOVER_CODE). */
    const session = live.get(adm.token);
    if (session) {
      session.handover(client, adm.address);
      return;
    }
    log(`resume miss`);
    try { client.close(NO_SESSION_CODE, "no-session"); } catch { /* gone */ }
    return;
  }
  bridge(client, adm.token, adm.model, adm.address, adm.ticketKey);
}

function bridge(firstClient: WebSocket, token: string, model: string | null, firstAddress: string, ticketKey = "") {
  perTicket.set(ticketKey, (perTicket.get(ticketKey) || 0) + 1);
  const id = ++sessions;
  const t0 = Date.now();
  connections++;
  let client: WebSocket | null = firstClient;
  let address = firstAddress;
  perAddress.set(address, (perAddress.get(address) || 0) + 1);
  let up = 0;
  let down = 0;
  let resumes = 0;
  let handovers = 0;
  let upstreamOpenedAt = 0;
  let closed = false;
  /* While parked: the client is null, downstream frames wait here. */
  let parkedAt = 0;
  let parkTimer: ReturnType<typeof setTimeout> | null = null;
  const held: string[] = [];
  let heldBytes = 0;
  /* During a handover: the socket being emptied, and its time limit. */
  let draining: WebSocket | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;
  const endDrain = () => {
    if (!draining) return;
    draining = null;
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = null;
    if (!client) return; /* parked meanwhile: the frames wait for the resume */
    try {
      for (const f of held) if (client.readyState === WebSocket.OPEN) client.send(f);
    } catch { /* the new socket died; its close handles it */ }
    held.length = 0;
    heldBytes = 0;
  };
  const pacing = createPacing();

  const upstream = new WebSocket(upstreamUrlFor(model), [`${PROTOCOL_PREFIX}${token}`], {
    handshakeTimeout: UPSTREAM_OPEN_MS,
    maxPayload: MAX_FRAME_BYTES,
  });
  /* Frames the browser sends before the vendor is open wait here, in order. */
  const pending: string[] = [];
  let pendingBytes = 0;

  const releaseAddress = () => {
    const n = (perAddress.get(address) || 1) - 1;
    if (n <= 0) perAddress.delete(address);
    else perAddress.set(address, n);
  };

  const finish = (why: string, code = 1000) => {
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
    if (drainTimer) clearTimeout(drainTimer);
    if (parked.get(token)?.attach === attach) parked.delete(token);
    if (live.get(token)?.handover === handover) live.delete(token);
    try { client?.close(code); } catch { /* gone */ }
    try { upstream.close(); } catch { /* gone */ }
    log(`session=${id} end why=${why} code=${code} ms=${Date.now() - t0} openMs=${upstreamOpenedAt ? upstreamOpenedAt - t0 : "none"} up=${up} down=${down} resumes=${resumes} handovers=${handovers} ${pacing.summary()}`);
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
  const wire = (c: WebSocket) => {
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
        /* Bounded by BYTES, not frames. */
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
    /* A replacement that died mid-handover: what was held stays held, for
       the resume, and nothing is being emptied any more. */
    draining = null;
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = null;
    live.delete(token);
    parkedAt = Date.now();
    parked.set(token, { attach, ticketKey });
    parkTimer = setTimeout(() => {
      parkTimer = null;
      if (!client) finish("resume-expired", 1001);
    }, RESUME_GRACE_MS);
    log(`session=${id} parked ms=${parkedAt - t0} up=${up} down=${down}`);
  };

  /** A redial with the same secret takes the parked session over. */
  const attach: AttachFn = (c, addr) => {
    if (closed) {
      try { c.close(NO_SESSION_CODE, "no-session"); } catch { /* gone */ }
      return;
    }
    if (parkTimer) clearTimeout(parkTimer);
    parkTimer = null;
    client = c;
    address = addr;
    perAddress.set(address, (perAddress.get(address) || 0) + 1);
    live.set(token, { handover, ticketKey });
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

  /** A second socket from the same caller while the first is still up
   *  (HANDOVER_CODE): it is the client from now on; the first is closed with
   *  the handover code after the frames already written to it. */
  const handover: AttachFn = (c, addr) => {
    if (closed || !client) {
      try { c.close(NO_SESSION_CODE, "no-session"); } catch { /* gone */ }
      return;
    }
    /* A second handover before the first finished emptying: release what
       was held to the socket that is about to be replaced, in order. */
    endDrain();
    const old = client;
    releaseAddress();
    client = c;
    address = addr;
    perAddress.set(address, (perAddress.get(address) || 0) + 1);
    alive = true;
    handovers++;
    wire(c);
    try { c.send(relayHello(true)); } catch { /* the new socket died at once; its close handles it */ }
    draining = old;
    old.once("close", () => { if (draining === old) endDrain(); });
    drainTimer = setTimeout(() => { if (draining === old) endDrain(); }, HANDOVER_DRAIN_MS);
    try { old.close(HANDOVER_CODE, "handover"); } catch { endDrain(); }
    log(`session=${id} handover ms=${Date.now() - t0} up=${up} down=${down}`);
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
    pacing.note(text);
    if (client && !draining) {
      if (client.readyState === WebSocket.OPEN) client.send(text);
      return;
    }
    /* Parked, or a handover still emptying the old socket: held for the
       client, bounded. */
    if (heldBytes + text.length > MAX_PARK_BYTES) return finish("park-overflow", 1011);
    held.push(text);
    heldBytes += text.length;
  });
  upstream.on("close", (code) => finish("upstream-closed", code >= 1000 && code < 5000 ? code : 1011));
  upstream.on("error", (e) => {
    const err = e as { code?: string; name?: string } | null;
    log(`session=${id} upstream error name=${err?.code || err?.name || "error"}`);
    finish("upstream-error", 1011);
  });

  live.set(token, { handover, ticketKey });
  wire(client);
  log(`session=${id} start model=${typeof model === "string" && /^[\w.-]{1,64}$/.test(model) ? model : "default"}`);
}

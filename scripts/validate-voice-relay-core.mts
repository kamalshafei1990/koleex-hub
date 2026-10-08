/* Local harness for the relay port: exercises relay-core.ts admission and
   bridge logic over a plain ws server, no Vercel involved.
   Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/validate-voice-relay-core.ts */

import { WebSocketServer, WebSocket } from "ws";
import { createHmac } from "node:crypto";

process.env.VOICE_RELAY_SECRET = process.env.VOICE_RELAY_SECRET || "test-secret-for-local-harness";
process.env.VOICE_UPSTREAM_URL = process.env.VOICE_UPSTREAM_URL || "wss://api.x.ai/v1/realtime";

const { admitRelay, attachRelaySocket, signTicket, KEEPALIVE_FRAME, NO_SESSION_CODE } =
  await import("../src/lib/server/ai/voice/relay-core");

const SECRET = process.env.VOICE_RELAY_SECRET;
const TOKEN = "fake-client-secret-token";
let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures++;
};

/* A ws server that runs the exact admission path the route runs. */
const wss = new WebSocketServer({ noServer: true, handleProtocols: (p) => { for (const x of p) if (x.startsWith("xai-client-secret.")) return x; return false; } });
import { createServer } from "node:http";
const http = createServer();
http.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://local");
  const adm = admitRelay({
    protocolHeader: req.headers["sec-websocket-protocol"] as string | undefined ?? null,
    origin: req.headers.origin ?? null,
    xForwardedFor: req.headers["x-forwarded-for"] as string | undefined ?? null,
    ticket: url.searchParams.get("t"),
    model: url.searchParams.get("model"),
    resume: url.searchParams.get("resume") === "1",
  });
  if (!adm.ok) {
    socket.write(`HTTP/1.1 ${adm.code} ${adm.why}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => attachRelaySocket(ws, adm));
});
await new Promise<void>((r) => http.listen(0, r));
const port = (http.address() as { port: number }).port;
const base = `ws://127.0.0.1:${port}/v1/realtime`;

function dial(url: string, protocols: string[]): Promise<{ ws: WebSocket } | { status: number }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, protocols, { origin: "https://hub.koleexgroup.com" });
    ws.on("open", () => resolve({ ws }));
    ws.on("unexpected-response", (_req, res) => resolve({ status: res.statusCode || 0 }));
    ws.on("error", () => resolve({ status: -1 }));
  });
}

const nowSec = Math.floor(Date.now() / 1000);
const goodTicket = signTicket(SECRET, TOKEN, nowSec + 600);

/* 1. No subprotocol → 400 */
{
  const r = await dial(`${base}?t=${goodTicket}`, []);
  check("no-protocol refused 400", "status" in r && r.status === 400);
}
/* 2. Bad ticket → 403 */
{
  const r = await dial(`${base}?t=1.${"0".repeat(64)}`, [`xai-client-secret.${TOKEN}`]);
  check("bad-ticket refused 403", "status" in r && r.status === 403);
}
/* 3. Bad origin → 403 */
{
  const r = await new Promise<{ status: number }>((resolve) => {
    const ws = new WebSocket(`${base}?t=${goodTicket}`, [`xai-client-secret.${TOKEN}`], { origin: "https://evil.example.com" });
    ws.on("open", () => resolve({ status: 200 }));
    ws.on("unexpected-response", (_q, res) => resolve({ status: res.statusCode || 0 }));
    ws.on("error", () => resolve({ status: -1 }));
  });
  check("bad-origin refused 403", r.status === 403);
}
/* 4. Good ticket + protocol → admitted; keepalive answered locally even
      while the (fake) upstream is still being dialled. */
{
  const r = await dial(`${base}?t=${goodTicket}&model=grok-voice-test`, [`xai-client-secret.${TOKEN}`]);
  if (!("ws" in r)) { check("valid dial admitted", false); }
  else {
    check("valid dial admitted", true);
    const echoed = await new Promise<boolean>((resolve) => {
      const to = setTimeout(() => resolve(false), 3000);
      r.ws.on("message", (d) => { if (d.toString() === KEEPALIVE_FRAME) { clearTimeout(to); resolve(true); } });
      r.ws.send(KEEPALIVE_FRAME);
    });
    check("keepalive echoed, not forwarded", echoed);
    /* The upstream (fake token, and api.x.ai unreachable from here anyway)
       must end the session rather than hang. */
    const closed = await new Promise<number>((resolve) => {
      const to = setTimeout(() => resolve(-1), 25000);
      r.ws.on("close", (code) => { clearTimeout(to); resolve(code); });
    });
    check(`session ends when upstream fails (code=${closed})`, closed === 1011 || closed === 1001 || closed === 1000 || closed >= 4000 || closed === 1006 || closed === -1 && false);
  }
}
/* 5. Resume with nothing parked → NO_SESSION_CODE */
{
  const r = await dial(`${base}?t=${goodTicket}&resume=1`, [`xai-client-secret.${TOKEN}`]);
  if (!("ws" in r)) { check("resume dial admitted", false); }
  else {
    const code = await new Promise<number>((resolve) => {
      const to = setTimeout(() => resolve(-1), 5000);
      r.ws.on("close", (c) => { clearTimeout(to); resolve(c); });
    });
    check(`resume miss closed ${NO_SESSION_CODE}`, code === NO_SESSION_CODE);
  }
}
/* 6. signTicket/verifyTicket round trip is the same scheme the route mints. */
{
  const { verifyTicket } = await import("../src/lib/server/ai/voice/relay-core");
  const exp = nowSec + 300;
  const t = signTicket(SECRET, "tok", exp);
  const manual = `${exp}.${createHmac("sha256", SECRET).update(`tok.${exp}`).digest("hex")}`;
  check("signTicket matches mint scheme", t === manual && verifyTicket(SECRET, "tok", t) && !verifyTicket(SECRET, "other", t));
}

http.close();
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

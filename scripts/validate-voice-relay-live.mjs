/* Live end-to-end check of the production voice relay at
   wss://voice.koleexgroup.com/v1/realtime — admission, keepalive, and
   session teardown, with a locally minted ticket and a fake client secret
   (the vendor refuses it; the relay must end the session cleanly). */
import WebSocket from "ws";
import { createHmac } from "node:crypto";

const SECRET = process.argv[2];
if (!SECRET) { console.error("usage: live-check.mjs <relay-secret>"); process.exit(2); }
const BASE = "wss://voice.koleexgroup.com/v1/realtime";
const TOKEN = "live-check-fake-token";
const KEEPALIVE = '{"type":"koleex.keepalive"}';
let failures = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) failures++; };

const exp = Math.floor(Date.now() / 1000) + 600;
const ticket = `${exp}.${createHmac("sha256", SECRET).update(`${TOKEN}.${exp}`).digest("hex")}`;

function dial(url, protocols, origin = "https://hub.koleexgroup.com") {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, protocols, { origin });
    ws.on("open", () => resolve({ ws }));
    ws.on("unexpected-response", (_q, res) => resolve({ status: res.statusCode || 0 }));
    ws.on("error", () => resolve({ status: -1 }));
  });
}

/* 1. No subprotocol → 400 */
{
  const r = await dial(`${BASE}?t=${ticket}`, []);
  check("no-protocol refused 400", "status" in r && r.status === 400);
}
/* 2. Bad ticket → 403 */
{
  const r = await dial(`${BASE}?t=1.${"0".repeat(64)}`, [`xai-client-secret.${TOKEN}`]);
  check("bad-ticket refused 403", "status" in r && r.status === 403);
}
/* 3. Foreign origin → 403 */
{
  const r = await dial(`${BASE}?t=${ticket}`, [`xai-client-secret.${TOKEN}`], "https://evil.example.com");
  check("bad-origin refused 403", "status" in r && r.status === 403);
}
/* 4. Valid dial → admitted; keepalive answered; session ends when the
      vendor refuses the fake token. */
{
  const r = await dial(`${BASE}?t=${ticket}&model=live-check`, [`xai-client-secret.${TOKEN}`]);
  if (!("ws" in r)) { check("valid dial admitted", false); }
  else {
    check("valid dial admitted", true);
    const echoed = await new Promise((resolve) => {
      const to = setTimeout(() => resolve(false), 5000);
      r.ws.on("message", (d) => { if (d.toString() === KEEPALIVE) { clearTimeout(to); resolve(true); } });
      r.ws.send(KEEPALIVE);
    });
    check("keepalive echoed", echoed);
    const code = await new Promise((resolve) => {
      const to = setTimeout(() => resolve(-1), 30000);
      r.ws.on("close", (c) => { clearTimeout(to); resolve(c); });
    });
    check(`session ends on vendor refusal (code=${code})`, code !== -1);
  }
}
console.log(failures === 0 ? "LIVE ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

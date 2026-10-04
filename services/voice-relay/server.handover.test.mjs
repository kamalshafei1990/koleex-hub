/* The handover, on real sockets: a fake vendor, the relay, two clients.
   (HANDOVER_CODE in server.mjs.) */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocketServer, WebSocket } from "ws";

const SECRET = "relay-secret-for-tests";
process.env.VOICE_RELAY_SECRET = SECRET;
const upstream = new WebSocketServer({ port: 0, host: "127.0.0.1" });
await once(upstream, "listening");
process.env.VOICE_UPSTREAM_URL = `ws://127.0.0.1:${upstream.address().port}/v1/realtime`;
const PORT = 20_000 + Math.floor(Math.random() * 20_000);
process.env.PORT = String(PORT);
const { createRelay, signTicket, HANDOVER_CODE, NO_SESSION_CODE, HANDOVER_DRAIN_MS } = await import("./server.mjs");
const http = createRelay();
await once(http, "listening");
after(() => {
  http.close();
  upstream.close();
});

const ticketFor = (token) => signTicket(SECRET, token, Math.floor(Date.now() / 1000) + 300);
const dial = (token, resume = false, ticket = ticketFor(token)) =>
  new WebSocket(`ws://127.0.0.1:${PORT}/v1/realtime?t=${ticket}${resume ? "&resume=1" : ""}`, [`xai-client-secret.${token}`], { origin: "https://koleex-preview.vercel.app" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (p) => p.then(([d]) => String(d));

test("a resume while the session is LIVE is a handover: the new socket is the client from then on, the old is closed with the handover code, the vendor's side never notices", async () => {
  const token = "tok-handover";
  const upP = once(upstream, "connection");
  const a = dial(token);
  await once(a, "open");
  const [up] = await upP;
  up.send("d1");
  assert.equal(await text(once(a, "message")), "d1", "downstream reaches the first socket");
  a.send("u1");
  assert.equal(await text(once(up, "message")), "u1", "upstream from the first socket");

  const b = dial(token, true);
  const helloP = once(b, "message");
  const aClosedP = once(a, "close");
  await once(b, "open");
  assert.equal(await text(helloP), '{"type":"koleex.relay","resumed":true}', "the replacement is told the session is its own");
  const [aCode] = await aClosedP;
  assert.equal(aCode, HANDOVER_CODE, "the old socket is closed by the relay with the handover code");
  assert.equal(up.readyState, WebSocket.OPEN, "the vendor's side is untouched");

  up.send("d2");
  assert.equal(await text(once(b, "message")), "d2", "downstream now reaches the replacement");
  b.send("u2");
  assert.equal(await text(once(up, "message")), "u2", "upstream from the replacement");

  /* A second handover, from the replacement to a third socket. */
  const c = dial(token, true);
  const hello2P = once(c, "message");
  const bClosedP = once(b, "close");
  await once(c, "open");
  assert.equal(await text(hello2P), '{"type":"koleex.relay","resumed":true}');
  assert.equal((await bClosedP)[0], HANDOVER_CODE);
  up.send("d3");
  assert.equal(await text(once(c, "message")), "d3");

  /* The caller hangs up on the current socket: the session ends. */
  const upClosedP = once(up, "close");
  c.close(1000);
  await upClosedP;
  assert.notEqual(up.readyState, WebSocket.OPEN, "a clean close from the current client ends the vendor's side");
});

test("a resume for a secret with nothing live and nothing parked is refused with the no-session code", async () => {
  const c = dial("tok-nobody", true);
  const [code] = await once(c, "close");
  assert.equal(code, NO_SESSION_CODE);
});

test("the old socket is emptied before the new one speaks: frames sent during a handover wait until the old socket has closed", async () => {
  const token = "tok-drain";
  const upP = once(upstream, "connection");
  const a = dial(token);
  await once(a, "open");
  const [up] = await upP;
  const got = [];
  a.on("message", (d) => got.push(`a:${d}`));
  /* The old path stops reading: it has not yet seen the relay's close. */
  a._socket.pause();

  const b = dial(token, true);
  b.on("message", (d) => { if (!String(d).startsWith("{")) got.push(`b:${d}`); });
  await once(b, "open");
  await sleep(100);
  up.send("d1");
  await sleep(300);
  assert.deepEqual(got.filter((g) => g.startsWith("b:")), [], "nothing reaches the new socket while the old one is still being emptied");

  a._socket.resume();
  await once(a, "close");
  await sleep(100);
  assert.deepEqual(got.filter((g) => g.startsWith("b:")), ["b:d1"], "once the old socket closed, the held frame arrives, once");
  up.send("d2");
  await sleep(100);
  assert.deepEqual(got.filter((g) => g.startsWith("b:")), ["b:d1", "b:d2"], "and after that, frames flow straight through");
  b.close(1000);
});

test("an old path that never answers the close does not stall the call: the held frames go after the drain limit", async () => {
  const token = "tok-drain-stuck";
  const upP = once(upstream, "connection");
  const a = dial(token);
  await once(a, "open");
  const [up] = await upP;
  a._socket.pause();
  const b = dial(token, true);
  const frames = [];
  b.on("message", (d) => { if (!String(d).startsWith("{")) frames.push(String(d)); });
  await once(b, "open");
  await sleep(100);
  up.send("late");
  await sleep(HANDOVER_DRAIN_MS + 300);
  assert.deepEqual(frames, ["late"], "released at the limit");
  a.terminate();
  b.close(1000);
});

test("a handover after the ticket has expired is still admitted — the call outlives its ten-minute ticket — but a fresh dial on it is not", async () => {
  const token = "tok-old-ticket";
  const shortTicket = signTicket(SECRET, token, Math.floor(Date.now() / 1000) + 1);
  const upP = once(upstream, "connection");
  const a = dial(token, false, shortTicket);
  await once(a, "open");
  const [up] = await upP;
  await sleep(2200); // the ticket is now expired

  const b = dial(token, true, shortTicket);
  const helloP = once(b, "message");
  await once(b, "open");
  assert.equal(String((await helloP)[0]), '{"type":"koleex.relay","resumed":true}', "the handover on the expired ticket is the same session");
  assert.equal(up.readyState, WebSocket.OPEN);

  const fresh = dial("tok-someone-new", false, signTicket(SECRET, "tok-someone-new", Math.floor(Date.now() / 1000) - 5));
  const [req1, res] = await once(fresh, "unexpected-response");
  req1.destroy();
  assert.equal(res.statusCode, 403, "a fresh dial on an expired ticket is refused as before");

  const stranger = dial("tok-nobody-expired", true, signTicket(SECRET, "tok-nobody-expired", Math.floor(Date.now() / 1000) - 5));
  const [req2, res2] = await once(stranger, "unexpected-response");
  req2.destroy();
  assert.equal(res2.statusCode, 403, "a resume on an expired ticket with no session behind it is refused");
  b.close(1000);
});
